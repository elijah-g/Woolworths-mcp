# Woolworths MCP Server - Documentation Index

Welcome! This is your complete guide to the Woolworths MCP Server.

## 📚 Documentation Files

### 🚀 Getting Started (Start Here!)

1. **[QUICK_START.md](QUICK_START.md)** ⭐ **START HERE**
   - 5-minute quick start guide
   - Installation in 30 seconds
   - First use walkthrough
   - Common commands reference

2. **[SETUP.md](SETUP.md)**
   - Detailed installation instructions
   - Configuration guide for Claude Desktop
   - Troubleshooting common issues
   - Development tips

3. **[README.md](README.md)**
   - Complete feature overview
   - All 12 tools documented
   - Usage examples
   - Technical details

### 📖 Reference Documentation

4. **[FEATURES.md](FEATURES.md)**
   - Complete feature list (50+ features)
   - Use cases
   - Security features
   - Future enhancements

5. **[woolworths-api-docs.md](woolworths-api-docs.md)**
   - Reverse-engineered API documentation
   - All endpoints with examples
   - Request/response formats
   - Authentication details

6. **[TESTING.md](TESTING.md)**
   - 40+ manual test cases
   - Testing checklist
   - Debugging tips
   - Known issues

### 🏗️ Technical Documentation

7. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**
   - System architecture
   - Technology stack
   - File structure
   - Development workflow

## 🔧 Configuration Files

### Installation Scripts
- **install.bat** - Windows automated installation
- **install.sh** - Unix/Mac automated installation

### Configuration Examples
- **claude_desktop_config.example.json** - Example MCP client config
- **package.json** - Node.js dependencies and scripts
- **tsconfig.json** - TypeScript compiler configuration
- **.gitignore** - Git ignore rules
- **.npmrc** - NPM configuration

## 📁 Source Code

### Main Application
- **src/index.ts** - Complete MCP server implementation (~650 lines)
  - Browser automation with Puppeteer
  - 12 MCP tools
  - Session cookie management
  - API request handling
  - Error handling

## 🎯 Quick Navigation

### "I want to..."

| Goal | Document | Section |
|------|----------|---------|
| Get started in 5 minutes | [QUICK_START.md](QUICK_START.md) | All |
| Install and configure | [SETUP.md](SETUP.md) | Setup Guide |
| Learn all features | [FEATURES.md](FEATURES.md) | All |
| Understand the architecture | [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | Architecture |
| Use specific tools | [README.md](README.md) | Available Tools |
| Test the server | [TESTING.md](TESTING.md) | Test Suite |
| Understand the API | [woolworths-api-docs.md](woolworths-api-docs.md) | All endpoints |
| Troubleshoot issues | [SETUP.md](SETUP.md) | Troubleshooting |
| See examples | [README.md](README.md) | Example Usage Scenario |

## 🛠️ Available Tools (12 Total)

### Browser Tools
1. **woolworths_open_browser** - Launch Chrome browser
2. **woolworths_navigate** - Navigate to URL
3. **woolworths_get_cookies** - Capture session cookies
4. **woolworths_close_browser** - Close browser

### Product Tools
5. **woolworths_search_products** - Search catalog with filters
6. **woolworths_get_product_details** - Get product info
7. **woolworths_get_specials** - Browse special offers
8. **woolworths_get_categories** - List categories

### Shopping Cart Tools
9. **woolworths_add_to_cart** - Add item to cart
10. **woolworths_get_cart** - View cart contents
11. **woolworths_remove_from_cart** - Remove item
12. **woolworths_update_cart_quantity** - Update quantity

## 📊 Project Statistics

- **Total Files**: 13+ files
- **Documentation Pages**: 7 comprehensive guides
- **Lines of Code**: ~650 (TypeScript)
- **Tools Provided**: 12 MCP tools
- **API Endpoints**: 8+ Woolworths APIs
- **Features**: 50+ features
- **Test Cases**: 40+ tests

## 🎓 Learning Path

### Beginner
1. Read [QUICK_START.md](QUICK_START.md)
2. Install using install script
3. Try basic commands in Claude
4. Read [README.md](README.md) for more details

### Intermediate
1. Review [FEATURES.md](FEATURES.md) for all capabilities
2. Learn API details in [woolworths-api-docs.md](woolworths-api-docs.md)
3. Configure for your use case
4. Explore shopping cart features

### Advanced
1. Study [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) architecture
2. Review source code in `src/index.ts`
3. Run test suite from [TESTING.md](TESTING.md)
4. Consider contributing enhancements

## 🔗 External Resources

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Puppeteer](https://pptr.dev/) - Browser automation
- [Woolworths Australia](https://www.woolworths.com.au/) - Official website

## 📞 Support

### Documentation
- **Quick Issues**: See [SETUP.md](SETUP.md) Troubleshooting
- **Testing**: Follow [TESTING.md](TESTING.md) checklist
- **Features**: Check [FEATURES.md](FEATURES.md) for capabilities

### Common Questions

**Q: How do I install?**  
A: Run `install.bat` (Windows) or `install.sh` (Unix/Mac)

**Q: How do I configure Claude Desktop?**  
A: See [SETUP.md](SETUP.md) Step 3

**Q: What tools are available?**  
A: See [README.md](README.md) "Available Tools" section

**Q: How do I get session cookies?**  
A: Follow [QUICK_START.md](QUICK_START.md) Step 1-4

**Q: Can I add to shopping cart?**  
A: Yes! See [README.md](README.md) tools 9-12

## ⚖️ Legal

**Disclaimer**: This is an unofficial tool for educational purposes. Not affiliated with Woolworths Group Limited. See [woolworths-api-docs.md](woolworths-api-docs.md) disclaimer for details.

**License**: MIT

---

## 🎉 Ready to Start?

👉 **[Click here to get started with QUICK_START.md](QUICK_START.md)**

Or jump to any section above based on what you need!

---

**Last Updated**: October 30, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

