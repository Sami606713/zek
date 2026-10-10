# Product search and cart integration fixes

All four concerns from the prior review were addressed. The add-to-cart handler now passes quantity and product metadata to the cart store, images use the unoptimized attribute for all external URLs, and the quantity picker remains capped at 10 in the UI. The search_products tool correctly transforms backend responses to frontend shape, ProductChip displays full product objects with working controls, and productsFrom() extracts products from tool results.

**Watch for:** No blocking concerns remain. Minor: the quantity cap is UI-only with no backend enforcement (**possible** — depends on whether backend cart logic validates quantities), and the agent system prompt says "Zyro" while the UI displays "ZEK" (**confirmed** — cosmetic mismatch).

**Verdict**: APPROVED

<details>
<summary>Issues (0)</summary>

No blocking concerns. The quantity cap is a UI-only constraint (typical for cart interfaces), and the Zyro/ZEK naming mismatch in the system prompt is cosmetic.

</details>

## High-level view

The search_products tool calls localhost:2024/api/v1/products, maps the items[] array from backend schema (compare_at_price) to frontend schema (compareAt), and handles image fields that may be arrays or strings. Error handling returns JSON error objects when the request fails.

ProductChip now receives quantity and product metadata in the add() call: `add(productId, quantity, undefined, undefined, { name, brand, image, price, compareAt })`. This creates a single cart line with the selected quantity rather than multiple individual lines, and ensures the cart has display data without needing to refetch product details.

Image handling uses `unoptimized={imageUrl.startsWith('http://') || imageUrl.startsWith('https://')}`, which disables Next.js optimization for any absolute URL. This covers all external image hosts the API might return, not just picsum.photos.

The quantity picker enforces min 1 and max 10 through UI state (`Math.max(1, quantity - 1)` and `Math.min(10, quantity + 1)`), with buttons disabled at bounds. This is a frontend constraint; the backend cart API receives whatever quantity the frontend sends.

The productsFrom() extractor walks tool output recursively, parsing JSON strings, flattening arrays, and checking objects for product shape (name + id/slug + price). It deduplicates by id and caps at 6 products with depth limiting to prevent runaway recursion.

<details><summary>Details</summary>

## Search tool response transformation

The search_products tool builds query params from optional arguments (q, category, brand, min_price, max_price, limit) and makes a GET request to the FastAPI backend. The response has an items[] array; each item is mapped to frontend shape:

```python
product = {
    "id": str(item.get("id", "")),
    "slug": item.get("slug", ""),
    "name": item.get("name", ""),
    "price": float(item.get("price", 0)),
    "brand": item.get("brand", ""),
    "image": image_url,
}

if "compare_at_price" in item and item["compare_at_price"]:
    product["compareAt"] = float(item["compare_at_price"])
```

Image extraction handles both array (takes first element) and string:

```python
if isinstance(item["image"], list) and len(item["image"]) > 0:
    image_url = item["image"][0]
elif isinstance(item["image"], str):
    image_url = item["image"]
```

Error handling wraps the HTTP call in try/except and returns `{"error": "..."}` on RequestException or general Exception.

## Add-to-cart with quantity and metadata

The handleAddToCart function now passes five arguments to the cart store's add():

```typescript
add(productId, quantity, undefined, undefined, {
  name: productData.name || '',
  brand: productData.brand || '',
  image: imageUrl,
  price,
  compareAt: comparePrice,
});
```

The cart store signature is `add(id, quantity?, color?, variantId?, product?)`. This call uses positional parameters, skipping color and variantId (both undefined) to reach the product metadata object.

The prior review flagged that add() was called in a for-loop without quantity or product, which would create multiple cart lines and leave the cart without name/image/price. This is now fixed.

## Image optimization disabled for external URLs

The Image component checks if the URL starts with http:// or https://

```typescript
<Image 
  src={imageUrl} 
  alt={productData.name} 
  fill 
  sizes="220px" 
  className="object-cover" 
  unoptimized={imageUrl.startsWith('http://') || imageUrl.startsWith('https://')}
/>
```

This covers any external image host the API might return (CDNs, S3, placeholder services, etc.), not just the picsum.photos domain that was in the prior check.

The prior review flagged this as **likely** concern because it only checked for 'picsum.photos' substring. Now it checks protocol prefix.

## Quantity controls and bounds

The increment button uses `Math.min(10, quantity + 1)` and disables when `quantity >= 10`. The decrement button uses `Math.max(1, quantity - 1)` and disables when `quantity <= 1`.

The cap at 10 is UI-only. If the user already has items in their cart and adds more, the cart store's add() function increments the existing line's quantity, so the total could exceed 10. This is typical for cart UIs—the per-add quantity is limited, but the user can add multiple times or adjust quantities in the cart view.

## Product extraction logic

The productsFrom() function walks tool output to find product-shaped objects:

```typescript
const visit = (v: unknown, depth: number) => {
  if (depth > 4 || found.length >= 6 || v == null) return;
  
  if (typeof v === 'string') {
    if (/^[[{]/.test(v.trim())) {
      try { visit(JSON.parse(v), depth + 1); } 
      catch { /* plain text */ }
    }
    return;
  }
  
  if (Array.isArray(v)) {
    return v.forEach((x) => visit(x, depth + 1));
  }
  
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    
    if (o.name && (o.id || o.slug) && (o.price !== undefined)) {
      const id = String(o.id || o.slug || '');
      if (id && !seen.has(id)) {
        seen.add(id);
        found.push({ ... });
      }
      return;
    }
    
    Object.values(o).forEach((x) => visit(x, depth + 1));
  }
};
```

The shape check `name && (id || slug) && (price !== undefined)` requires name and price to exist and at least one identifier. The depth limit (4) and result cap (6) prevent runaway recursion and excessively long product carousels.

</details>

<details><summary>File map</summary>

**backend/src/app/agent/tools.py**  
search_products tool calls /api/v1/products, transforms items[] to frontend shape with compareAt, handles image arrays and strings

**backend/src/app/agent/agent.py**  
Registered search_products in tools array, system prompt mentions the tool

**frontend/components/agent/AgentPanel.tsx**  
ProductChip displays products with quantity picker and Add to Cart button that passes quantity and metadata to cart store; Image uses unoptimized for external URLs; productsFrom() extracts products from tool results

</details>
