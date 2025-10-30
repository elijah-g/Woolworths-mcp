# Testing Guide for Woolworths MCP Server

## Manual Testing Checklist

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Project built (`npm run build`)
- [ ] Claude Desktop configured with server

## Test Suite

### 1. Installation Tests

#### Test 1.1: Dependencies Install
```bash
npm install
```
**Expected**: All dependencies install without errors

#### Test 1.2: TypeScript Compilation
```bash
npm run build
```
**Expected**: 
- No TypeScript errors
- `dist/` directory created
- `dist/index.js` exists

### 2. Browser Automation Tests

#### Test 2.1: Open Browser (Non-Headless)
**Command to Claude**: "Open the Woolworths browser"

**Expected**:
- Chrome window opens
- Navigates to woolworths.com.au
- Page loads completely
- Response includes:
  ```json
  {
    "success": true,
    "message": "Browser opened...",
    "url": "https://www.woolworths.com.au"
  }
  ```

#### Test 2.2: Navigate to Specific URL
**Command to Claude**: "Navigate to https://www.woolworths.com.au/shop/browse/fruit-veg"

**Expected**:
- Browser navigates to fruit & veg category
- Response includes current URL and page title

#### Test 2.3: Capture Cookies
**Command to Claude**: "Get the Woolworths cookies"

**Expected**:
- Response shows cookie count (typically 10-20 cookies)
- Cookie names include: `w-rctx`, `wow-auth-token`, etc.
- Response format:
  ```json
  {
    "success": true,
    "message": "Captured X cookies...",
    "cookies": [...]
  }
  ```

#### Test 2.4: Close Browser
**Command to Claude**: "Close the browser"

**Expected**:
- Browser window closes
- Response confirms closure
- Cookies preserved message

#### Test 2.5: Prevent Double Browser Open
**Steps**:
1. Open browser
2. Try to open again without closing

**Expected**: Error message about browser already open

### 3. Product Search Tests

#### Test 3.1: Basic Search
**Command to Claude**: "Search for milk"

**Expected**:
- Returns list of milk products
- Total results count > 0
- Products have: Stockcode, Name, Price, Brand
- Image URLs present
- Response includes pagination info

#### Test 3.2: Search with Pagination
**Command to Claude**: "Search for bread, page 2, 24 results per page"

**Expected**:
- Returns page 2 of results
- Page size is 24
- Pagination info shows correct page number

#### Test 3.3: Search with Sorting (Price Low to High)
**Command to Claude**: "Search for coffee sorted by price ascending"

**Expected**:
- Products sorted from cheapest to most expensive
- First product cheaper than last product

#### Test 3.4: Search with Sorting (Price High to Low)
**Command to Claude**: "Search for wine sorted by price descending"

**Expected**:
- Products sorted from most expensive to cheapest
- First product more expensive than last product

#### Test 3.5: Search for Specials Only
**Command to Claude**: "Search for specials on fruit"

**Expected**:
- Returns only products with IsOnSpecial = true
- Shows discount information

#### Test 3.6: Search with No Results
**Command to Claude**: "Search for xyzabc123notarealproduct"

**Expected**:
- Returns 0 results
- No error, just empty products array

### 4. Product Detail Tests

#### Test 4.1: Get Product Details
**Steps**:
1. Search for a product
2. Note the Stockcode (e.g., 123456)
3. **Command**: "Get details for stockcode 123456"

**Expected**:
- Detailed product information
- More fields than search results
- Includes description, nutritional info, etc.

#### Test 4.2: Invalid Stockcode
**Command to Claude**: "Get details for stockcode 999999999"

**Expected**: Error response (404 or product not found)

### 5. Specials Tests

#### Test 5.1: Get All Specials
**Command to Claude**: "What are the current specials?"

**Expected**:
- List of products on special
- Each has PromotionDescription
- IsOnSpecial = true
- Shows savings/discounts

#### Test 5.2: Get Specials by Category
**Command to Claude**: "Show me specials in meat and seafood"

**Expected**:
- Filtered specials for specific category
- Products from that category only

### 6. Category Tests

#### Test 6.1: Get All Categories
**Command to Claude**: "Show me all product categories"

**Expected**:
- Hierarchical category structure
- Categories have: nodeId, description, urlFriendlyName
- Nested children categories
- Common categories present:
  - Fruit & Veg
  - Meat & Seafood
  - Dairy, Eggs & Fridge
  - Bakery
  - etc.

### 7. Shopping Cart Tests

**⚠️ Important**: Cart operations require authentication (logged in session)

#### Test 7.1: Add Item to Cart
**Steps**:
1. Log in to Woolworths in the browser
2. Capture cookies
3. Close browser
4. Search for a product and note its stockcode
5. **Command**: "Add stockcode 123456 to my cart, quantity 2"

**Expected**:
- Success response
- trolleyItemCount increases
- trolleyTotal shows updated price
- Item details returned

#### Test 7.2: View Cart
**Command to Claude**: "Show me my cart"

**Expected**:
- List of items in cart
- Quantities
- Line totals
- Subtotal
- Total savings
- Item count

#### Test 7.3: Update Cart Quantity
**Command to Claude**: "Update cart stockcode 123456 to quantity 5"

**Expected**:
- Quantity updated
- New totals calculated

#### Test 7.4: Remove from Cart
**Command to Claude**: "Remove stockcode 123456 from cart"

**Expected**:
- Item removed
- Cart totals updated
- Success confirmation

#### Test 7.5: Cart Operations Without Login
**Steps**:
1. Don't log in (skip login step)
2. Try to add to cart

**Expected**: May return error or empty cart (depends on Woolworths API)

### 8. Error Handling Tests

#### Test 8.1: API Call Without Cookies
**Steps**:
1. Restart server (loses cookies)
2. Try to search without opening browser first

**Expected**: Error: "No session cookies available"

#### Test 8.2: Expired Cookies
**Steps**:
1. Get cookies
2. Wait 2+ hours
3. Try to search

**Expected**: HTTP 401/403 error indicating expired session

#### Test 8.3: Invalid Tool Name
**Command**: Use MCP client to call non-existent tool

**Expected**: Error: "Unknown tool: [toolname]"

#### Test 8.4: Missing Required Parameters
**Command**: Call tool without required parameter

**Expected**: Parameter validation error

### 9. Session Management Tests

#### Test 9.1: Cookie Persistence Across API Calls
**Steps**:
1. Get cookies
2. Close browser
3. Search for product A
4. Search for product B
5. Get specials
6. Get categories

**Expected**: All calls succeed using same cookies

#### Test 9.2: Multiple Browser Sessions
**Steps**:
1. Open browser
2. Close it
3. Open browser again

**Expected**: New browser instance created successfully

### 10. Integration Tests

#### Test 10.1: Full Shopping Workflow
**Complete workflow**:
1. Open browser → ✅
2. Log in manually → ✅
3. Capture cookies → ✅
4. Close browser → ✅
5. Search for "coffee" → ✅
6. Get details of first result → ✅
7. Add to cart → ✅
8. View cart → ✅
9. Update quantity → ✅
10. Remove item → ✅

**Expected**: All steps complete without errors

#### Test 10.2: Browse and Compare Workflow
**Workflow**:
1. Get categories → ✅
2. Search in category (e.g., dairy) → ✅
3. Get specials in that category → ✅
4. Compare prices → ✅

**Expected**: Can explore catalog systematically

## Performance Tests

### Test P.1: Response Time
**Measure**:
- Browser open: Should complete in < 5 seconds
- Cookie capture: Should complete in < 1 second
- Product search: Should complete in < 3 seconds
- Product details: Should complete in < 2 seconds

### Test P.2: Large Result Sets
**Command**: "Search for bread with 100 results per page"

**Expected**: Should handle large page sizes (Woolworths may cap at 36)

### Test P.3: Concurrent Requests
**Steps**: Make multiple API calls in quick succession

**Expected**: All complete successfully (but respect rate limits)

## Security Tests

### Test S.1: Cookie Inspection
**Check**: Cookies not logged to console or files

**Expected**: Cookies only in memory, not visible in logs

### Test S.2: HTTPS Verification
**Check**: All API calls use HTTPS

**Expected**: No HTTP requests (all HTTPS)

### Test S.3: User Data Directory
**Check**: Browser user data isolation

**Expected**: Separate profile, no cross-contamination

## Compatibility Tests

### Test C.1: Windows
**Platform**: Windows 10/11
**Expected**: All features work

### Test C.2: macOS
**Platform**: macOS 12+
**Expected**: All features work

### Test C.3: Linux
**Platform**: Ubuntu/Debian
**Expected**: All features work

## Regression Tests

After any code changes, run this minimal regression suite:

1. ✅ Open browser
2. ✅ Capture cookies
3. ✅ Close browser
4. ✅ Search products
5. ✅ Get product details
6. ✅ Get specials
7. ✅ Get categories

## Known Issues & Limitations

| Issue | Impact | Workaround |
|-------|--------|------------|
| Cookies expire after ~1 hour | Must recapture | Re-open browser and capture cookies |
| Some features need login | Cart requires auth | Log in before capturing cookies |
| API rate limiting | May throttle requests | Add delays between bulk operations |
| Woolworths API changes | Server may break | Update endpoints as needed |

## Test Results Template

```
Date: ___________
Tester: ___________
Platform: ___________ (Windows/macOS/Linux)
Node Version: ___________

Browser Automation: [Pass/Fail]
Product Search: [Pass/Fail]
Product Details: [Pass/Fail]
Specials: [Pass/Fail]
Categories: [Pass/Fail]
Shopping Cart: [Pass/Fail]
Error Handling: [Pass/Fail]

Notes:
_______________________________________
_______________________________________
_______________________________________
```

## Automated Testing (Future)

To add automated tests in the future, consider:

- **Unit Tests**: Test individual functions
- **Integration Tests**: Test tool workflows
- **Mock API**: Mock Woolworths responses
- **CI/CD**: Automated testing on commits

Example test framework setup:
```bash
npm install --save-dev jest @types/jest ts-jest
```

## Debugging Tips

### Enable Verbose Logging
Modify `src/index.ts` to add console.error statements

### Inspect Network Traffic
Use Chrome DevTools Network tab while browser is open

### Check Cookie Contents
Add temporary logging to see cookie values (remove in production)

### MCP Client Logs
Check Claude Desktop logs for MCP communication issues

---

**Testing Checklist Summary**

- [ ] Installation (2 tests)
- [ ] Browser Automation (5 tests)
- [ ] Product Search (6 tests)
- [ ] Product Details (2 tests)
- [ ] Specials (2 tests)
- [ ] Categories (1 test)
- [ ] Shopping Cart (5 tests)
- [ ] Error Handling (4 tests)
- [ ] Session Management (2 tests)
- [ ] Integration (2 tests)
- [ ] Performance (3 tests)
- [ ] Security (3 tests)
- [ ] Compatibility (3 tests)

**Total Test Cases**: 40+

Happy Testing! 🧪

