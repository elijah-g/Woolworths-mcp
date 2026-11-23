#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";
import fetch from "node-fetch";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EndpointConfig {
  url: string;
  method: "GET" | "POST";
  discoveryPatterns: string[];
  discoveryPageUrl: string;
  responseValidator: (data: unknown) => boolean;
}

type EndpointKey =
  | "searchProducts"
  | "productDetail"
  | "browseCategory"
  | "categories"
  | "trolleyUpdate"
  | "trolleyGet"
  | "fulfilment"
  | "deliveryInfo";

interface DiscoveredEndpoint {
  url: string;
  method: string;
  discoveredAt: string;
}

type DiscoveryCache = Partial<Record<EndpointKey, DiscoveredEndpoint>>;

type ErrorClass =
  | "ok"
  | "auth_required"
  | "transient"
  | "endpoint_moved"
  | "schema_changed";

interface RawFetchResult {
  status: number;
  data: unknown;
  rawText: string;
}

// ---------------------------------------------------------------------------
// Default Endpoint Registry
// ---------------------------------------------------------------------------

const DEFAULT_ENDPOINTS: Record<EndpointKey, EndpointConfig> = {
  searchProducts: {
    url: "https://www.woolworths.com.au/apis/ui/Search/products",
    method: "POST",
    discoveryPatterns: ["Search/products", "search/products"],
    discoveryPageUrl:
      "https://www.woolworths.com.au/shop/search/products?searchTerm=milk",
    responseValidator: (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return (
        obj != null &&
        typeof obj === "object" &&
        ("Products" in obj || "SearchResultsCount" in obj)
      );
    },
  },
  productDetail: {
    url: "https://www.woolworths.com.au/apis/ui/product/detail",
    method: "GET",
    discoveryPatterns: ["product/detail", "Product/Detail"],
    discoveryPageUrl:
      "https://www.woolworths.com.au/shop/productdetails/123456/product",
    responseValidator: (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return (
        obj != null &&
        typeof obj === "object" &&
        ("Product" in obj ||
          "Stockcode" in obj ||
          "Name" in obj ||
          "DisplayName" in obj)
      );
    },
  },
  browseCategory: {
    url: "https://www.woolworths.com.au/apis/ui/browse/category",
    method: "GET",
    discoveryPatterns: ["browse/category", "Browse/Category"],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/browse/specials",
    responseValidator: (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return (
        obj != null &&
        typeof obj === "object" &&
        ("Products" in obj ||
          "Bundles" in obj ||
          "TotalRecordCount" in obj)
      );
    },
  },
  categories: {
    url: "https://www.woolworths.com.au/apis/ui/PiesCategoriesWithSpecials",
    method: "GET",
    discoveryPatterns: [
      "PiesCategoriesWithSpecials",
      "CategoriesWithSpecials",
      "categories",
    ],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/browse",
    responseValidator: (d: unknown) => {
      return Array.isArray(d) || (d != null && typeof d === "object");
    },
  },
  trolleyUpdate: {
    url: "https://www.woolworths.com.au/api/v3/ui/trolley/update",
    method: "POST",
    discoveryPatterns: ["trolley/update", "Trolley/Update", "trolley"],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/mylist",
    responseValidator: (d: unknown) => {
      return d != null && typeof d === "object";
    },
  },
  trolleyGet: {
    url: "https://www.woolworths.com.au/apis/ui/Trolley",
    method: "GET",
    discoveryPatterns: ["ui/Trolley", "trolley"],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/mylist",
    responseValidator: (d: unknown) => {
      return d != null && typeof d === "object";
    },
  },
  fulfilment: {
    url: "https://www.woolworths.com.au/apis/ui/Fulfilment",
    method: "POST",
    discoveryPatterns: ["ui/Fulfilment", "fulfilment"],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/checkout",
    responseValidator: (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return obj != null && typeof obj === "object" && "IsSuccessful" in obj;
    },
  },
  deliveryInfo: {
    url: "https://www.woolworths.com.au/apis/ui/Delivery/DeliveryInfo",
    method: "GET",
    discoveryPatterns: ["Delivery/DeliveryInfo", "delivery/deliveryinfo"],
    discoveryPageUrl: "https://www.woolworths.com.au/shop/checkout",
    responseValidator: (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return (
        obj != null &&
        typeof obj === "object" &&
        ("DeliveryMethod" in obj || "Address" in obj)
      );
    },
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let sessionCookies: any[] = [];
let browser: Browser | null = null;
let currentPage: Page | null = null;
let discoveryCache: DiscoveryCache = {};
const discoveryLocks = new Map<EndpointKey, Promise<DiscoveredEndpoint | null>>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "discovered-endpoints.json");

// ---------------------------------------------------------------------------
// Discovery Cache (disk persistence)
// ---------------------------------------------------------------------------

async function loadDiscoveryCache(): Promise<void> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    discoveryCache = JSON.parse(raw) as DiscoveryCache;
    console.error(
      `[discovery] Loaded ${Object.keys(discoveryCache).length} cached endpoint(s)`
    );
  } catch {
    discoveryCache = {};
  }
}

async function saveDiscoveryCache(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(discoveryCache, null, 2));
}

// ---------------------------------------------------------------------------
// Endpoint Resolution
// ---------------------------------------------------------------------------

function resolveEndpoint(key: EndpointKey): { url: string; method: string } {
  const cached = discoveryCache[key];
  if (cached) {
    return { url: cached.url, method: cached.method };
  }
  const def = DEFAULT_ENDPOINTS[key];
  return { url: def.url, method: def.method };
}

// ---------------------------------------------------------------------------
// Raw Fetch (structured errors with status)
// ---------------------------------------------------------------------------

async function rawFetch(
  url: string,
  options: any = {}
): Promise<RawFetchResult> {
  if (sessionCookies.length === 0) {
    throw Object.assign(
      new Error(
        "No session cookies available. Please use woolworths_get_cookies first."
      ),
      { status: 0, errorClass: "auth_required" as ErrorClass }
    );
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: "https://www.woolworths.com.au",
    Referer: "https://www.woolworths.com.au/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    Priority: "u=1, i",
    Cookie: getCookieHeader(),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const rawText = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = rawText;
  }

  return { status: response.status, data, rawText };
}

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

function classifyError(
  result: RawFetchResult,
  endpointKey: EndpointKey
): ErrorClass {
  const { status, data } = result;

  // Auth errors — user must re-authenticate
  if (status === 401 || status === 403) return "auth_required";

  // Transient server errors
  if (status === 429 || status >= 500) return "transient";

  // Endpoint moved
  if (status === 404) return "endpoint_moved";

  // Bad request may indicate schema change
  if (status === 400) return "schema_changed";

  // 2xx — check response shape
  if (status >= 200 && status < 300) {
    // If we got HTML instead of JSON, endpoint probably redirected
    if (typeof data === "string") return "schema_changed";

    const config = DEFAULT_ENDPOINTS[endpointKey];
    if (!config.responseValidator(data)) return "schema_changed";

    return "ok";
  }

  // Any other unexpected status
  return "endpoint_moved";
}

// ---------------------------------------------------------------------------
// URL Mutation (lightweight discovery — no browser)
// ---------------------------------------------------------------------------

// Known Woolworths API path migration patterns
const URL_MUTATIONS: Array<{ from: RegExp; to: string }> = [
  // /apis/ui/Foo → /api/v3/ui/foo (the pattern from the cart migration)
  { from: /\/apis\/ui\//i, to: "/api/v3/ui/" },
  // /api/v3/ui/foo → /api/v2/ui/foo (version downgrade)
  { from: /\/api\/v3\/ui\//i, to: "/api/v2/ui/" },
  // /api/v2/ui/foo → /api/v3/ui/foo (version upgrade)
  { from: /\/api\/v2\/ui\//i, to: "/api/v3/ui/" },
  // /api/v3/ui/foo → /apis/ui/foo (revert to old pattern)
  { from: /\/api\/v3\/ui\//i, to: "/apis/ui/" },
  // /api/v2/ui/foo → /apis/ui/foo
  { from: /\/api\/v2\/ui\//i, to: "/apis/ui/" },
  // /apis/ui/Foo → /api/v4/ui/foo (future version)
  { from: /\/apis\/ui\//i, to: "/api/v4/ui/" },
  { from: /\/api\/v3\/ui\//i, to: "/api/v4/ui/" },
];

function generateMutations(originalUrl: string): string[] {
  const seen = new Set<string>([originalUrl]);
  const mutations: string[] = [];

  for (const { from, to } of URL_MUTATIONS) {
    if (from.test(originalUrl)) {
      const mutated = originalUrl.replace(from, to);
      if (!seen.has(mutated)) {
        seen.add(mutated);
        mutations.push(mutated);
      }
      // Also try lowercase path variant
      const url = new URL(mutated);
      const lower = url.origin + url.pathname.toLowerCase() + url.search;
      if (!seen.has(lower)) {
        seen.add(lower);
        mutations.push(lower);
      }
    }
  }

  return mutations;
}

async function tryUrlMutations(
  endpointKey: EndpointKey,
  originalUrl: string,
  options: any
): Promise<{ url: string; method: string; data: unknown } | null> {
  const mutations = generateMutations(originalUrl);
  if (mutations.length === 0) return null;

  console.error(
    `[mutations] Trying ${mutations.length} URL variant(s) for "${endpointKey}"`
  );

  for (const mutatedUrl of mutations) {
    try {
      console.error(`[mutations] Trying: ${mutatedUrl}`);
      const result = await rawFetch(mutatedUrl, options);
      const cls = classifyError(result, endpointKey);
      if (cls === "ok") {
        // Validate response shape before caching — prevents caching wrong endpoints
        const validator = DEFAULT_ENDPOINTS[endpointKey].responseValidator;
        const defaultMethod = DEFAULT_ENDPOINTS[endpointKey].method;
        if (!validator(result.data)) {
          console.error(`[mutations] ${mutatedUrl} returned OK but failed response validation — skipping`);
          continue;
        }
        console.error(`[mutations] Hit: ${mutatedUrl}`);
        discoveryCache[endpointKey] = {
          url: mutatedUrl,
          method: defaultMethod,
          discoveredAt: new Date().toISOString(),
        };
        await saveDiscoveryCache();
        return { url: mutatedUrl, method: defaultMethod, data: result.data };
      }
    } catch {
      // mutation failed, try next
    }
  }

  console.error(`[mutations] No URL variants worked for "${endpointKey}"`);
  return null;
}

// ---------------------------------------------------------------------------
// Discovery Engine (Puppeteer — last resort)
// ---------------------------------------------------------------------------

async function discoverEndpoint(
  endpointKey: EndpointKey
): Promise<DiscoveredEndpoint | null> {
  // Dedup lock — if discovery is already running for this key, wait for it
  const existing = discoveryLocks.get(endpointKey);
  if (existing) return existing;

  const promise = _doDiscover(endpointKey);
  discoveryLocks.set(endpointKey, promise);
  try {
    return await promise;
  } finally {
    discoveryLocks.delete(endpointKey);
  }
}

async function _doDiscover(
  endpointKey: EndpointKey
): Promise<DiscoveredEndpoint | null> {
  const config = DEFAULT_ENDPOINTS[endpointKey];
  console.error(
    `[discovery] Starting discovery for "${endpointKey}" via ${config.discoveryPageUrl}`
  );

  let discoveryBrowser: Browser | null = null;
  try {
    discoveryBrowser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await discoveryBrowser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Inject session cookies
    if (sessionCookies.length > 0) {
      const puppeteerCookies = sessionCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".woolworths.com.au",
        path: c.path || "/",
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        ...(c.expires ? { expires: c.expires } : {}),
      }));
      await page.setCookie(...puppeteerCookies);
    }

    // Intercept network requests
    const capturedRequests: Array<{
      url: string;
      method: string;
    }> = [];

    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const reqUrl = req.url();
      const reqMethod = req.method();

      // Check if this request matches any discovery pattern
      const matchesPattern = config.discoveryPatterns.some((pattern) =>
        reqUrl.includes(pattern)
      );

      if (
        matchesPattern &&
        (req.resourceType() === "xhr" || req.resourceType() === "fetch")
      ) {
        capturedRequests.push({ url: reqUrl, method: reqMethod });
        console.error(
          `[discovery] Captured: ${reqMethod} ${reqUrl}`
        );
      }

      req.continue();
    });

    // Navigate to the discovery page
    await page.goto(config.discoveryPageUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit more for any late XHRs
    await new Promise((r) => setTimeout(r, 2000));

    await page.close();
    await discoveryBrowser.close();
    discoveryBrowser = null;

    if (capturedRequests.length === 0) {
      console.error(
        `[discovery] No matching requests captured for "${endpointKey}"`
      );
      return null;
    }

    // Validate captured matches against the response validator before accepting.
    // Use the default method — discovery should not override POST→GET or vice versa,
    // as captured request methods may come from unrelated page-rendering endpoints.
    const defaultMethod = DEFAULT_ENDPOINTS[endpointKey].method;
    const validator = config.responseValidator;

    for (const match of capturedRequests) {
      // Skip matches whose method conflicts with the default
      if (match.method !== defaultMethod) {
        console.error(
          `[discovery] Skipping ${match.method} ${match.url} — expected ${defaultMethod}`
        );
        continue;
      }

      // Validate by actually fetching the endpoint and checking the response shape
      try {
        const testResult = await rawFetch(match.url, { method: defaultMethod });
        if (testResult.status >= 200 && testResult.status < 300 && validator(testResult.data)) {
          const discovered: DiscoveredEndpoint = {
            url: match.url,
            method: defaultMethod,
            discoveredAt: new Date().toISOString(),
          };
          console.error(
            `[discovery] Validated "${endpointKey}": ${discovered.method} ${discovered.url}`
          );
          discoveryCache[endpointKey] = discovered;
          await saveDiscoveryCache();
          return discovered;
        } else {
          console.error(
            `[discovery] ${match.url} failed validation — response doesn't match expected shape`
          );
        }
      } catch {
        console.error(
          `[discovery] ${match.url} failed fetch during validation`
        );
      }
    }

    console.error(
      `[discovery] No captured requests passed validation for "${endpointKey}"`
    );
    return null;
  } catch (err: any) {
    console.error(`[discovery] Failed for "${endpointKey}": ${err.message}`);
    return null;
  } finally {
    if (discoveryBrowser) {
      try {
        await discoveryBrowser.close();
      } catch {
        // ignore
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Resilient Request Wrapper
// ---------------------------------------------------------------------------

async function resilientRequest(
  endpointKey: EndpointKey,
  urlOverride: string | null,
  options: any = {}
): Promise<any> {
  const endpoint = resolveEndpoint(endpointKey);
  const url = urlOverride ?? endpoint.url;
  const method = options.method ?? endpoint.method;

  // First attempt
  let result = await rawFetch(url, { ...options, method });
  let errorClass = classifyError(result, endpointKey);

  if (errorClass === "ok") return result.data;

  // Auth errors — user must act, no recovery
  if (errorClass === "auth_required") {
    throw new Error(
      "Authentication required. Please re-open the browser, log in, and run woolworths_get_cookies to refresh your session."
    );
  }

  // Transient — retry once after 2s
  if (errorClass === "transient") {
    console.error(
      `[resilient] Transient error (${result.status}) for "${endpointKey}", retrying in 2s...`
    );
    await new Promise((r) => setTimeout(r, 2000));
    result = await rawFetch(url, { ...options, method });
    errorClass = classifyError(result, endpointKey);
    if (errorClass === "ok") return result.data;
    // If still failing after retry, fall through to discovery
    if (errorClass === "transient") {
      throw new Error(
        `API request failed after retry: ${result.status}. The server may be experiencing issues.`
      );
    }
  }

  // Endpoint moved or schema changed — try lightweight mutations first, then Puppeteer
  if (
    errorClass === "endpoint_moved" ||
    errorClass === "schema_changed"
  ) {
    console.error(
      `[resilient] ${errorClass} detected for "${endpointKey}" (status ${result.status}), trying URL mutations...`
    );

    // Layer 1: URL mutations (fast, no browser)
    const mutationHit = await tryUrlMutations(endpointKey, url, {
      ...options,
      method,
    });
    if (mutationHit) return mutationHit.data;

    // Layer 2: Puppeteer network interception (last resort)
    console.error(
      `[resilient] Mutations failed for "${endpointKey}", falling back to Puppeteer discovery...`
    );

    const discovered = await discoverEndpoint(endpointKey);
    if (!discovered) {
      throw new Error(
        `API request failed (${result.status}) and auto-discovery could not find the new endpoint for "${endpointKey}". The Woolworths API may have changed significantly.`
      );
    }

    // Retry with discovered endpoint
    // For endpoints like productDetail where we append a path suffix, we need to
    // reconstruct the URL. We use the discovered base URL.
    let discoveredUrl = discovered.url;

    // If the original call had a URL override (e.g. with stockcode appended),
    // try to map it onto the discovered base
    if (urlOverride && urlOverride !== endpoint.url) {
      const defaultBase = DEFAULT_ENDPOINTS[endpointKey].url;
      const suffix = urlOverride.slice(defaultBase.length);
      if (suffix) {
        const baseDiscovered = discovered.url.split("?")[0];
        discoveredUrl = baseDiscovered + suffix;
      }
    }

    result = await rawFetch(discoveredUrl, {
      ...options,
      method: discovered.method,
    });
    errorClass = classifyError(result, endpointKey);

    if (errorClass === "ok") return result.data;

    throw new Error(
      `API request failed even after discovery (${result.status}). Discovered URL: ${discoveredUrl}`
    );
  }

  // Fallback — shouldn't normally reach here
  throw new Error(
    `API request failed: ${result.status}. Response: ${result.rawText.slice(0, 500)}`
  );
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: "woolworths_open_browser",
    description:
      "Opens a browser and navigates to Woolworths website. This is the first step to establish a session.",
    inputSchema: {
      type: "object",
      properties: {
        headless: {
          type: "boolean",
          description:
            "Whether to run browser in headless mode (default: false for easier login)",
          default: false,
        },
      },
    },
  },
  {
    name: "woolworths_navigate",
    description: "Navigate to a specific URL on the Woolworths website",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "woolworths_get_cookies",
    description:
      "Retrieves session cookies from the current browser session. Run this after logging in or establishing a session.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "woolworths_close_browser",
    description: "Closes the browser instance",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "woolworths_search_products",
    description:
      "Search for products on Woolworths. Requires session cookies to be obtained first.",
    inputSchema: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          description: "The product search term",
        },
        pageNumber: {
          type: "number",
          description: "Page number for pagination (default: 1)",
          default: 1,
        },
        pageSize: {
          type: "number",
          description: "Number of results to return (default: 36)",
          default: 36,
        },
        sortType: {
          type: "string",
          description:
            "Sort order: TraderRelevance, PriceAsc, PriceDesc, Name (default: TraderRelevance)",
          enum: ["TraderRelevance", "PriceAsc", "PriceDesc", "Name"],
          default: "TraderRelevance",
        },
        isSpecial: {
          type: "boolean",
          description: "Filter for special offers only (default: false)",
          default: false,
        },
      },
      required: ["searchTerm"],
    },
  },
  {
    name: "woolworths_get_product_details",
    description:
      "Get detailed information about a specific product by its stockcode",
    inputSchema: {
      type: "object",
      properties: {
        stockcode: {
          type: "string",
          description: "The product stockcode/ID",
        },
      },
      required: ["stockcode"],
    },
  },
  {
    name: "woolworths_get_specials",
    description: "Get current specials and deals from Woolworths",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional category filter (e.g., 'fruit-veg', 'meat-seafood')",
        },
        pageSize: {
          type: "number",
          description: "Number of results to return (default: 20)",
          default: 20,
        },
      },
    },
  },
  {
    name: "woolworths_get_categories",
    description: "Get the list of available product categories",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "woolworths_add_to_cart",
    description: "Add a product to the shopping cart/trolley",
    inputSchema: {
      type: "object",
      properties: {
        stockcode: {
          type: "number",
          description: "The product stockcode/ID to add",
        },
        quantity: {
          type: "number",
          description: "Quantity to add (default: 1)",
          default: 1,
        },
      },
      required: ["stockcode"],
    },
  },
  {
    name: "woolworths_get_cart",
    description: "Get the contents of the shopping cart/trolley",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "woolworths_remove_from_cart",
    description: "Remove a product from the shopping cart/trolley",
    inputSchema: {
      type: "object",
      properties: {
        stockcode: {
          type: "number",
          description: "The product stockcode/ID to remove",
        },
      },
      required: ["stockcode"],
    },
  },
  {
    name: "woolworths_update_cart_quantity",
    description:
      "Update the quantity of a product in the shopping cart/trolley",
    inputSchema: {
      type: "object",
      properties: {
        stockcode: {
          type: "number",
          description: "The product stockcode/ID",
        },
        quantity: {
          type: "number",
          description: "New quantity",
        },
      },
      required: ["stockcode", "quantity"],
    },
  },
  {
    name: "woolworths_get_delivery_info",
    description:
      "Get current delivery address, store, and fulfilment method",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "woolworths_set_fulfilment",
    description:
      "Set the delivery address and fulfilment method (delivery, pickup, or direct to boot)",
    inputSchema: {
      type: "object",
      properties: {
        addressId: {
          type: "number",
          description: "Address ID (from delivery info or address list)",
        },
        fulfilmentMethod: {
          type: "string",
          description:
            "Fulfilment method: Courier, Pickup, or DirectToBoot",
          enum: ["Courier", "Pickup", "DirectToBoot"],
          default: "Courier",
        },
      },
      required: ["addressId"],
    },
  },
];

// ---------------------------------------------------------------------------
// Helper: cookie header
// ---------------------------------------------------------------------------

function getCookieHeader(): string {
  return sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

// ---------------------------------------------------------------------------
// Tool Handlers — Browser management (unchanged)
// ---------------------------------------------------------------------------

async function handleOpenBrowser(args: any): Promise<any> {
  if (browser) {
    return {
      success: false,
      message:
        "Browser is already open. Close it first with woolworths_close_browser.",
    };
  }

  const headless = args.headless ?? false;

  browser = await puppeteer.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  currentPage = await browser.newPage();

  await currentPage.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await currentPage.goto("https://www.woolworths.com.au", {
    waitUntil: "networkidle2",
  });

  return {
    success: true,
    message:
      "Browser opened and navigated to Woolworths homepage. You can now log in manually if needed, then use woolworths_get_cookies to capture the session.",
    url: currentPage.url(),
  };
}

async function handleNavigate(args: any): Promise<any> {
  if (!browser || !currentPage) {
    throw new Error("Browser is not open. Use woolworths_open_browser first.");
  }

  await currentPage.goto(args.url, { waitUntil: "networkidle2" });

  return {
    success: true,
    url: currentPage.url(),
    title: await currentPage.title(),
  };
}

async function handleGetCookies(args: any): Promise<any> {
  if (!browser || !currentPage) {
    throw new Error("Browser is not open. Use woolworths_open_browser first.");
  }

  const cookies = await currentPage.cookies();
  sessionCookies = cookies;

  return {
    success: true,
    message: `Captured ${cookies.length} cookies. Session ready.`,
  };
}

async function handleCloseBrowser(args: any): Promise<any> {
  if (!browser) {
    return {
      success: false,
      message: "Browser is not open.",
    };
  }

  await browser.close();
  browser = null;
  currentPage = null;

  return {
    success: true,
    message: "Browser closed. Session cookies have been preserved.",
  };
}

// ---------------------------------------------------------------------------
// Response slimming — strip bloat before returning to LLM
// ---------------------------------------------------------------------------

function slimProduct(p: any): any {
  return {
    Stockcode: p.Stockcode,
    Name: p.DisplayName || p.Name,
    Price: p.Price,
    WasPrice: p.WasPrice !== p.Price ? p.WasPrice : undefined,
    CupString: p.CupString,
    IsOnSpecial: p.IsOnSpecial || undefined,
    IsAvailable: p.IsAvailable,
    PackageSize: p.PackageSize || undefined,
    Unit: p.Unit || undefined,
    IsInTrolley: p.QuantityInTrolley ? true : undefined,
    QuantityInTrolley: p.QuantityInTrolley || undefined,
  };
}

function slimProducts(raw: any[]): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((group) => {
    // Search results nest products in { Products: [...] }
    if (group.Products && Array.isArray(group.Products)) {
      return group.Products.map(slimProduct);
    }
    return slimProduct(group);
  }).flat();
}

function slimCart(data: any): any {
  return {
    TotalItems: data.TotalTrolleyItemQuantity,
    SubTotal: data.Totals?.SubTotal,
    Total: data.Totals?.Total,
    DeliveryFee: data.DeliveryFee?.Total,
    Savings: data.Totals?.TotalSavings || 0,
    UpdatedItems: data.UpdatedItems?.map((i: any) => ({
      Stockcode: i.Stockcode,
      Name: i.DisplayName,
      Quantity: i.QuantityInTrolley ?? i.Quantity,
      Price: i.SalePrice ?? i.ListPrice,
      IsAvailable: i.IsAvailable,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tool Handlers — API endpoints (now using resilientRequest)
// ---------------------------------------------------------------------------

async function handleSearchProducts(args: any): Promise<any> {
  const searchTerm = args.searchTerm;
  const pageNumber = args.pageNumber ?? 1;
  const pageSize = args.pageSize ?? 36;
  const sortType = args.sortType ?? "TraderRelevance";
  const isSpecial = args.isSpecial ?? false;

  const requestBody = {
    searchTerm,
    pageNumber,
    pageSize,
    sortType,
    location: `/shop/search/products?searchTerm=${encodeURIComponent(searchTerm)}`,
    formatObject: JSON.stringify({ name: searchTerm }),
    isSpecial,
    isBundle: false,
    isMobile: false,
    filters: [],
    groupEdmVariants: false,
  };

  try {
    const data = await resilientRequest("searchProducts", null, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      searchTerm,
      totalResults: data.SearchResultsCount || 0,
      products: slimProducts(data.Products || []),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleGetProductDetails(args: any): Promise<any> {
  const stockcode = args.stockcode;
  const { url: baseUrl } = resolveEndpoint("productDetail");
  const url = `${baseUrl}/${stockcode}`;

  try {
    const data = await resilientRequest("productDetail", url, {});
    return { success: true, product: slimProduct(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleGetSpecials(args: any): Promise<any> {
  const category = args.category || "";
  const pageSize = args.pageSize ?? 20;

  const { url: baseUrl } = resolveEndpoint("browseCategory");
  let url: string;
  if (category) {
    url = `${baseUrl}?category=${encodeURIComponent(category)}&filter=Specials&pageSize=${pageSize}`;
  } else {
    url = `${baseUrl}?category=specials&pageSize=${pageSize}`;
  }

  try {
    const data = await resilientRequest("browseCategory", url, {});
    return {
      success: true,
      category: category || "all",
      totalResults: data.TotalRecordCount || 0,
      products: slimProducts(data.Products || data.Bundles || []),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleGetCategories(args: any): Promise<any> {
  try {
    const data = await resilientRequest("categories", null, {});
    return { success: true, categories: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleAddToCart(args: any): Promise<any> {
  const stockcode = args.stockcode;
  const quantity = args.quantity ?? 1;

  try {
    const data = await resilientRequest("trolleyUpdate", null, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            stockcode,
            quantity,
            source: "ProductDetail",
            diagnostics: "0",
            searchTerm: null,
            evaluateRewardPoints: false,
            offerId: null,
            profileId: null,
            priceLevel: null,
          },
        ],
      }),
    });
    return { success: true, cart: slimCart(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleGetCart(args: any): Promise<any> {
  try {
    const data = await resilientRequest("trolleyGet", null, {});
    return { success: true, cart: slimCart(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleRemoveFromCart(args: any): Promise<any> {
  const stockcode = args.stockcode;

  try {
    const data = await resilientRequest("trolleyUpdate", null, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            stockcode,
            quantity: 0,
            source: "ProductDetail",
            diagnostics: "0",
            searchTerm: null,
            evaluateRewardPoints: false,
            offerId: null,
            profileId: null,
            priceLevel: null,
          },
        ],
      }),
    });
    return { success: true, cart: slimCart(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleUpdateCartQuantity(args: any): Promise<any> {
  const stockcode = args.stockcode;
  const quantity = args.quantity;

  try {
    const data = await resilientRequest("trolleyUpdate", null, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            stockcode,
            quantity,
            source: "ProductDetail",
            diagnostics: "0",
            searchTerm: null,
            evaluateRewardPoints: false,
            offerId: null,
            profileId: null,
            priceLevel: null,
          },
        ],
      }),
    });
    return { success: true, cart: slimCart(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Tool Handlers — Fulfilment / Delivery
// ---------------------------------------------------------------------------

async function handleGetDeliveryInfo(_args: any): Promise<any> {
  try {
    const data = await resilientRequest("deliveryInfo", null, {});
    const info = data as Record<string, unknown>;
    return {
      success: true,
      deliveryMethod: info.DeliveryMethod,
      address: info.Address,
      currentDate: info.CurrentDateAtFulfilmentStore,
      reservedDate: info.ReservedDate,
      reservedTime: info.ReservedTime,
      isExpress: info.IsExpress,
      canLeaveUnattended: info.CanLeaveUnattended,
      deliveryInstructions: info.DeliveryInstructions,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleSetFulfilment(args: any): Promise<any> {
  const addressId = args.addressId;
  const fulfilmentMethod = args.fulfilmentMethod || "Courier";

  try {
    const data = await resilientRequest("fulfilment", null, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId,
        fulfilmentMethod,
      }),
    });
    const result = data as Record<string, unknown>;
    return {
      success: result.IsSuccessful === true,
      message: result.Message || (result.IsSuccessful ? "Fulfilment updated" : "Failed to update"),
      isNonServiced: result.IsNonServiced,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


// ---------------------------------------------------------------------------
// Main server setup
// ---------------------------------------------------------------------------

async function main() {
  // Load any previously discovered endpoints from disk
  await loadDiscoveryCache();

  const server = new Server(
    {
      name: "woolworths-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case "woolworths_open_browser":
          result = await handleOpenBrowser(args || {});
          break;

        case "woolworths_navigate":
          result = await handleNavigate(args || {});
          break;

        case "woolworths_get_cookies":
          result = await handleGetCookies(args || {});
          break;

        case "woolworths_close_browser":
          result = await handleCloseBrowser(args || {});
          break;

        case "woolworths_search_products":
          result = await handleSearchProducts(args || {});
          break;

        case "woolworths_get_product_details":
          result = await handleGetProductDetails(args || {});
          break;

        case "woolworths_get_specials":
          result = await handleGetSpecials(args || {});
          break;

        case "woolworths_get_categories":
          result = await handleGetCategories(args || {});
          break;

        case "woolworths_add_to_cart":
          result = await handleAddToCart(args || {});
          break;

        case "woolworths_get_cart":
          result = await handleGetCart(args || {});
          break;

        case "woolworths_remove_from_cart":
          result = await handleRemoveFromCart(args || {});
          break;

        case "woolworths_update_cart_quantity":
          result = await handleUpdateCartQuantity(args || {});
          break;

        case "woolworths_get_delivery_info":
          result = await handleGetDeliveryInfo(args || {});
          break;

        case "woolworths_set_fulfilment":
          result = await handleSetFulfilment(args || {});
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Cleanup on exit
  process.on("SIGINT", async () => {
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Woolworths MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
