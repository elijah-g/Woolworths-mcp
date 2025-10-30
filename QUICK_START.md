# Quick Start Guide

## Installation (30 seconds)

```bash
# Windows
install.bat

# macOS/Linux
chmod +x install.sh && ./install.sh
```

## Configuration (1 minute)

1. Open Claude Desktop config:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add this configuration:

```json
{
  "mcpServers": {
    "woolworths": {
      "command": "node",
      "args": ["YOUR_PATH_HERE\\dist\\index.js"]
    }
  }
}
```

3. Replace `YOUR_PATH_HERE` with your actual project path

4. Restart Claude Desktop

## First Use (2 minutes)

### Step 1: Get Session Cookies

Say to Claude:

> "Open the Woolworths browser"

A Chrome window will open showing woolworths.com.au

### Step 2: Log In (Optional)

If you want to access your account or shopping cart:
- Log in manually in the browser window
- Otherwise, skip this step for browsing only

### Step 3: Capture Cookies

Say to Claude:

> "Get the Woolworths cookies"

Claude will capture your session and confirm.

### Step 4: Close Browser

Say to Claude:

> "Close the browser"

The browser closes but cookies remain active.

### Step 5: Start Shopping! 🛒

Now you can:

> "Search for milk"

> "What are today's specials?"

> "Show me the fruit and vegetables category"

> "Add product 123456 to my cart"

> "Show me my cart"

## Common Commands

| What you want | Say to Claude |
|---------------|---------------|
| Search products | "Search for [product name]" |
| View specials | "What are the current specials?" |
| Product details | "Get details for stockcode [number]" |
| Categories | "Show me the product categories" |
| Add to cart | "Add stockcode [number] to my cart" |
| View cart | "Show me my cart" |
| Remove from cart | "Remove stockcode [number] from cart" |

## Tips

- 💡 You need to get cookies before using API features
- 🔄 If you get a 403 error, your cookies expired - recapture them
- 🛍️ Shopping cart features require you to be logged in
- 📦 Note the stockcode from search results to add items to cart

## Full Documentation

- `README.md` - Complete feature documentation
- `SETUP.md` - Detailed installation guide
- `PROJECT_SUMMARY.md` - Technical overview
- `woolworths-api-docs.md` - API reference

## Troubleshooting

**"Browser is not open"** → Run `woolworths_open_browser` first

**"No session cookies"** → Capture cookies with `woolworths_get_cookies`

**"API request failed: 403"** → Cookies expired, recapture them

**Server won't start** → Check you've run `npm run build`

## Support

For issues, check `SETUP.md` for detailed troubleshooting steps.

---

**That's it! You're ready to shop with AI! 🎉**

