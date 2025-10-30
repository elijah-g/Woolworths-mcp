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

// Cookie storage
let sessionCookies: any[] = [];
let browser: Browser | null = null;
let currentPage: Page | null = null;

// Tool definitions
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
          description: "Whether to run browser in headless mode (default: false for easier login)",
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
          description: "Sort order: TraderRelevance, PriceAsc, PriceDesc, Name (default: TraderRelevance)",
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
          description: "Optional category filter (e.g., 'fruit-veg', 'meat-seafood')",
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
    description: "Update the quantity of a product in the shopping cart/trolley",
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
];

// Helper function to get cookie header string
function getCookieHeader(): string {
  return sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

// Helper function to make API requests with cookies
async function makeWoolworthsRequest(
  url: string,
  options: any = {}
): Promise<any> {
  if (sessionCookies.length === 0) {
    throw new Error(
      "No session cookies available. Please use woolworths_get_cookies first."
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  return response.json();
}

// Tool handlers
async function handleOpenBrowser(args: any): Promise<any> {
  if (browser) {
    return {
      success: false,
      message: "Browser is already open. Close it first with woolworths_close_browser.",
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

  // Set user agent to appear more like a real browser
  await currentPage.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Navigate to Woolworths homepage
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
    message: `Captured ${cookies.length} cookies from the current session.`,
    cookies: cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
    })),
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

async function handleSearchProducts(args: any): Promise<any> {
  const searchTerm = args.searchTerm;
  const pageNumber = args.pageNumber ?? 1;
  const pageSize = args.pageSize ?? 36;
  const sortType = args.sortType ?? "TraderRelevance";
  const isSpecial = args.isSpecial ?? false;

  // Woolworths search API endpoint (POST method)
  const url = `https://www.woolworths.com.au/apis/ui/Search/products`;

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
    const data = await makeWoolworthsRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      searchTerm,
      totalResults: data.SearchResultsCount || 0,
      products: data.Products || [],
      pagination: data.Pagination || {
        TotalRecords: data.SearchResultsCount || 0,
        PageNumber: pageNumber,
        PageSize: pageSize,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleGetProductDetails(args: any): Promise<any> {
  const stockcode = args.stockcode;

  const url = `https://www.woolworths.com.au/apis/ui/product/detail/${stockcode}`;

  try {
    const data = await makeWoolworthsRequest(url);
    return {
      success: true,
      product: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleGetSpecials(args: any): Promise<any> {
  const category = args.category || "";
  const pageSize = args.pageSize ?? 20;

  let url = `https://www.woolworths.com.au/apis/ui/browse/category`;

  if (category) {
    url += `?category=${encodeURIComponent(category)}&filter=Specials&pageSize=${pageSize}`;
  } else {
    url += `?category=specials&pageSize=${pageSize}`;
  }

  try {
    const data = await makeWoolworthsRequest(url);
    return {
      success: true,
      category: category || "all",
      totalResults: data.TotalRecordCount || 0,
      products: data.Products || data.Bundles || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleGetCategories(args: any): Promise<any> {
  const url = `https://www.woolworths.com.au/apis/ui/PiesCategoriesWithSpecials`;

  try {
    const data = await makeWoolworthsRequest(url);
    return {
      success: true,
      categories: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleAddToCart(args: any): Promise<any> {
  const stockcode = args.stockcode;
  const quantity = args.quantity ?? 1;

  const url = `https://www.woolworths.com.au/api/v3/ui/trolley/update`;

  try {
    const data = await makeWoolworthsRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    return {
      success: true,
      cart: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleGetCart(args: any): Promise<any> {
  const url = `https://www.woolworths.com.au/apis/ui/Trolley`;

  try {
    const data = await makeWoolworthsRequest(url);
    return {
      success: true,
      cart: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleRemoveFromCart(args: any): Promise<any> {
  const stockcode = args.stockcode;

  const url = `https://www.woolworths.com.au/api/v3/ui/trolley/update`;

  try {
    const data = await makeWoolworthsRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    return {
      success: true,
      cart: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function handleUpdateCartQuantity(args: any): Promise<any> {
  const stockcode = args.stockcode;
  const quantity = args.quantity;

  const url = `https://www.woolworths.com.au/api/v3/ui/trolley/update`;

  try {
    const data = await makeWoolworthsRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    return {
      success: true,
      cart: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main server setup
async function main() {
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

