#!/bin/bash

echo "Installing Woolworths MCP Server..."
echo ""

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies!"
    exit 1
fi
echo ""

echo "Step 2: Building TypeScript code..."
npm run build
if [ $? -ne 0 ]; then
    echo "Failed to build project!"
    exit 1
fi
echo ""

echo "========================================"
echo "Installation complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Add this to your Claude Desktop config:"
echo ""
echo '   {'
echo '     "mcpServers": {'
echo '       "woolworths": {'
echo '         "command": "node",'
echo "         \"args\": [\"$(pwd)/dist/index.js\"]"
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "2. Restart Claude Desktop"
echo ""
echo "Config file location:"
echo "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "Linux: ~/.config/Claude/claude_desktop_config.json"
echo ""
echo "See SETUP.md for more details."
echo ""

