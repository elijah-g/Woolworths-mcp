# Cart API Update

## Summary
Updated the Woolworths MCP server to use the correct Woolworths cart API endpoint and request format.

## Changes Made

### 1. Updated Endpoint
- **Old**: `/apis/ui/Trolley/AddItem`, `/apis/ui/Trolley/RemoveItem`, `/apis/ui/Trolley/UpdateItem`
- **New**: `/api/v3/ui/trolley/update` (unified endpoint for all cart operations)

### 2. Updated Request Body Format
The new API uses a standardized request body format:

```json
{
  "items": [
    {
      "stockcode": 184653,
      "quantity": 1,
      "source": "ProductDetail",
      "diagnostics": "0",
      "searchTerm": null,
      "evaluateRewardPoints": false,
      "offerId": null,
      "profileId": null,
      "priceLevel": null
    }
  ]
}
```

### 3. Updated Headers
Added additional headers to match the current Woolworths API requirements:
- `Accept: */*`
- `sec-fetch-dest: empty`
- `sec-fetch-mode: cors`
- `sec-fetch-site: same-origin`
- `Priority: u=1, i`

### 4. Functions Updated
- `handleAddToCart()` - Now uses the new endpoint and request format
- `handleRemoveFromCart()` - Now uses the new endpoint with `quantity: 0`
- `handleUpdateCartQuantity()` - Now uses the new endpoint and request format
- `makeWoolworthsRequest()` - Updated headers to match current API requirements

## Testing
After restarting Cursor/Claude Desktop, the cart functionality should work correctly. You can test by:
1. Opening the browser with `woolworths_open_browser`
2. Getting cookies with `woolworths_get_cookies`
3. Adding items to cart with `woolworths_add_to_cart`

## Next Steps
To apply these changes:
1. Restart Cursor or Claude Desktop to reload the MCP server
2. Test the cart functionality with the roast dinner ingredients

