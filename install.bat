@echo off
echo Installing Woolworths MCP Server...
echo.

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)
echo.

echo Step 2: Building TypeScript code...
call npm run build
if errorlevel 1 (
    echo Failed to build project!
    pause
    exit /b 1
)
echo.

echo ========================================
echo Installation complete!
echo ========================================
echo.
echo Next steps:
echo 1. Add this to your Claude Desktop config:
echo.
echo    {
echo      "mcpServers": {
echo        "woolworths": {
echo          "command": "node",
echo          "args": ["%CD%\\dist\\index.js"]
echo        }
echo      }
echo    }
echo.
echo 2. Restart Claude Desktop
echo.
echo Config file location:
echo Windows: %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo See SETUP.md for more details.
echo.
pause

