# Setup Guide for Woolworths MCP Server

## Quick Start

Follow these steps to get the Woolworths MCP server up and running:

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP SDK for building the server
- `puppeteer` - Browser automation for capturing session cookies
- `node-fetch` - Making HTTP requests to Woolworths APIs
- TypeScript and type definitions

### 2. Build the Project

```bash
npm run build
```

This compiles the TypeScript code in `src/` to JavaScript in `dist/`.

### 3. Configure Claude Desktop (or your MCP client)

#### For Claude Desktop:

1. Locate your Claude Desktop config file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Edit the file and add the Woolworths server configuration:

```json
{
  "mcpServers": {
    "woolworths": {
      "command": "node",
      "args": ["C:\\Users\\eglass\\Projects\\Woolworths\\dist\\index.js"]
    }
  }
}
```

**Important**: Update the path in `args` to match your actual installation directory!

3. Restart Claude Desktop

### 4. Verify Installation

After restarting Claude Desktop, you should see the Woolworths tools available. Try asking:

> "What Woolworths tools do you have available?"

You should see 8 tools listed:
- woolworths_open_browser
- woolworths_navigate
- woolworths_get_cookies
- woolworths_close_browser
- woolworths_search_products
- woolworths_get_product_details
- woolworths_get_specials
- woolworths_get_categories

## First Time Usage

### Getting Session Cookies

The first thing you need to do is capture session cookies from Woolworths:

1. **Open the browser**:
   ```
   "Open the Woolworths browser"
   ```
   
   A Chrome browser window will open and navigate to woolworths.com.au

2. **Log in (if needed)**:
   - If you want to access your account features, log in manually in the browser window
   - If you just want to browse products, you can skip this step

3. **Capture cookies**:
   ```
   "Get the Woolworths cookies"
   ```
   
   This captures all cookies from the current session

4. **Close browser**:
   ```
   "Close the browser"
   ```
   
   The browser closes but cookies remain in memory

5. **Use the API tools**:
   Now you can search products, view specials, etc.:
   ```
   "Search for milk"
   "What are the current specials?"
   "Show me the fruit and veg category"
   ```

## Example Conversations

### Shopping List Search

```
User: Open the Woolworths browser
Assistant: [Opens browser]

User: Get the cookies
Assistant: [Captures 15 cookies]

User: Close the browser
Assistant: [Closes browser]

User: Search for bread
Assistant: [Returns list of bread products with prices]

User: Search for milk
Assistant: [Returns list of milk products]

User: What are today's specials?
Assistant: [Returns current specials]
```

### Product Research

```
User: Open Woolworths browser and get cookies
Assistant: [Opens browser, then captures cookies]

User: Close it
Assistant: [Closes browser]

User: Search for organic bananas
Assistant: [Returns organic banana products]

User: Get details for stockcode 123456
Assistant: [Returns detailed product information]
```

## Troubleshooting

### "Browser is not open" Error

**Problem**: You tried to get cookies but the browser isn't open.

**Solution**: Run `woolworths_open_browser` first.

### "No session cookies available" Error

**Problem**: You tried to search products but haven't captured cookies yet.

**Solution**: 
1. Open browser with `woolworths_open_browser`
2. Capture cookies with `woolworths_get_cookies`
3. Close browser with `woolworths_close_browser`
4. Then try your search again

### "API request failed: 403" Error

**Problem**: The session cookies have expired or are invalid.

**Solution**: Re-capture cookies by opening the browser again and running through the cookie capture process.

### Puppeteer Install Issues

**Problem**: Puppeteer fails to install or can't find Chrome.

**Solution**: 
```bash
# Reinstall Puppeteer
npm install puppeteer --force

# Or set custom Chrome path
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

### Server Won't Start

**Problem**: Error when running `npm start`.

**Solution**:
1. Make sure you've built the project: `npm run build`
2. Check that `dist/index.js` exists
3. Check Node.js version (requires 18+): `node --version`

## Development Tips

### Watch Mode

For development, use watch mode to auto-recompile on changes:

```bash
npm run dev
```

Keep this running in one terminal, and start the server in another terminal.

### Testing Changes

After making changes:

1. Stop the MCP server (restart Claude Desktop)
2. Rebuild: `npm run build`
3. Start Claude Desktop again

### Debugging

The server logs errors to stderr. You can see these in:
- Claude Desktop: Check the developer console (if available)
- Terminal: Run the server directly with `node dist/index.js` and watch output

## Advanced Configuration

### Headless Mode

If you don't need to see the browser (e.g., cookies are already valid), use headless mode:

```json
{
  "headless": true
}
```

### Custom User Data Directory

To persist browser data between sessions, modify the Puppeteer launch options in `src/index.ts`:

```typescript
browser = await puppeteer.launch({
  headless,
  userDataDir: './browser-data',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

## Security Notes

- **Cookies in Memory**: Session cookies are stored in memory only and are lost when the server restarts
- **No Persistence**: This server doesn't save any data to disk (except for build artifacts)
- **HTTPS Only**: All communication with Woolworths uses HTTPS
- **Local Only**: The server only accepts connections via stdio (local only, no network exposure)

## Next Steps

Now that you have the server running, you can:

1. Browse the Woolworths catalog
2. Search for products
3. Check current specials
4. Get detailed product information
5. Explore categories

Enjoy shopping with AI assistance! 🛒

