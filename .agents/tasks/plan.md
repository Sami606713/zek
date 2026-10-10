# Implementation Plan

## Context
This plan addresses multiple issues:
1. **Build error**: `promoCodes` export doesn't exist - this is already fixed in `/home/sami-ullah/Desktop/hackaton/frontend/lib/pricing.ts` (the export exists, so this may be a stale build cache issue)
2. **Backend**: Add a `search_products` LangChain tool that queries the FastAPI products endpoint at http://localhost:2024/api/v1/products
3. **Frontend**: Enhance ProductChip in AgentPanel.tsx to show images, quantity controls, and "Add to Cart" functionality
4. **Data flow**: The agent will return live product data from the backend API; ProductChip needs to receive and display this data (currently it only looks up by ID in a local mock catalog)

The backend runs on port 2024. The frontend API client is configured to use `http://localhost:8000/api/v1` by default, but the agent runs on 2024.

## Implementation Steps

- [ ] 1. Fix the build error by clearing Next.js cache and rebuilding.
      The `promoCodes` export exists in `/home/sami-ullah/Desktop/hackaton/frontend/lib/pricing.ts` but the build may have stale cache.
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/.next/` (cache directory)
      Verify: Run `npm run build` in the frontend directory and confirm no export errors.

- [ ] 2. Create `/home/sami-ullah/Desktop/hackaton/backend/src/app/agent/tools.py` with a `search_products` LangChain tool.
      The tool should use `httpx` or `requests` to call `http://localhost:2024/api/v1/products` with query parameters: `q` (search query), `category`, `brand`, `min_price`, `max_price`, `limit` (default 6).
      The tool must return a JSON list of product objects with fields: `id` (UUID as string), `slug`, `name`, `price` (Decimal/float), `compare_at_price` (optional), `brand`, and `image` (URL from the first image in the `image` field of `ProductListItem` schema).
      Use the `@tool` decorator from `langchain_core.tools` to define the tool. The description should be clear for the LLM: "Search for products in the catalog. Use this when the user asks about products, categories, or shopping recommendations."
      Files: `/home/sami-ullah/Desktop/hackaton/backend/src/app/agent/tools.py` (create new)
      Verify: Import the tool in Python REPL and call it with test parameters to confirm it returns product data.

- [ ] 3. Register the `search_products` tool in `/home/sami-ullah/Desktop/hackaton/backend/src/app/agent/agent.py`.
      Import the tool from `tools.py` and pass it to `create_agent` via the `tools` parameter (check LangChain docs for the exact parameter name - likely `tools=[search_products]` in the `create_agent` call).
      Update the system prompt to mention: "You can search the product catalog using the search_products tool. When users ask about products, use this tool to find relevant items and present them."
      Files: `/home/sami-ullah/Desktop/hackaton/backend/src/app/agent/agent.py`
      Verify: Run the agent locally (python -m src.app.agent.agent) and send a message like "show me caps" to confirm the tool is invoked and returns product data.

- [ ] 4. Update `/home/sami-ullah/Desktop/hackaton/frontend/components/agent/AgentPanel.tsx` to enhance ProductChip with quantity controls and images.
      Changes to ProductChip component:
      - Add local state: `const [quantity, setQuantity] = useState(1);`
      - Import `Minus` and `Plus` icons from `@phosphor-icons/react`
      - Add quantity controls before the "Add to Cart" button: two icon buttons (Minus/Plus) with `border border-line rounded-md text-[13px]` styling, calling `setQuantity(Math.max(1, quantity - 1))` and `setQuantity(quantity + 1)`
      - Update the button label from "Add to bag" to "Add to Cart"
      - Pass quantity to the add function: `add(product.id, quantity)` instead of `add(product.id)`
      - For the product image: the `<Image>` tag already uses `product.image`. Ensure `product.image` URLs are properly handled. The backend returns Cloudinary URLs (based on ProductListItem schema). Next.js images require domain configuration.
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/components/agent/AgentPanel.tsx`
      Verify: Open the agent panel in the browser, trigger a product search, and confirm quantity controls appear and work, and the "Add to Cart" button passes the quantity.

- [ ] 5. Configure Next.js to allow external image domains from the backend.
      The backend serves images from Cloudinary. Add Cloudinary domains to `next.config.ts` under `images.remotePatterns`.
      Cloudinary URLs typically use `res.cloudinary.com` domain. Add: `{ protocol: "https", hostname: "res.cloudinary.com" }` to the `remotePatterns` array.
      Also add the backend API domain if images are served directly: `{ protocol: "http", hostname: "localhost" }` for local development.
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/next.config.ts`
      Verify: Restart the Next.js dev server (`npm run dev`) and confirm product images load without Next.js image optimization errors in the console.

- [ ] 6. Update `productIdsFrom()` helper in AgentPanel.tsx to extract product data objects instead of just IDs.
      The current implementation looks for product IDs and resolves them via `getProduct(id)` from the local mock catalog. With the backend tool, the agent will return full product objects in the tool output.
      Refactor:
      - Rename `productIdsFrom(output)` to `extractProducts(output): Product[]` 
      - Look for objects with `id`, `name`, `price`, `brand`, `image` fields (matching the backend ProductListItem schema)
      - Return an array of product objects directly, not IDs
      - Update the `AssistantTurn` component to map over the extracted products: `extractProducts(result.content).map(product => <ProductChip key={product.id} product={product} />)`
      - Update the `ProductChip` signature from `({ id }: { id: string })` to accept a product object: `({ product }: { product: Product })`
      - Inside ProductChip, remove the `getProduct(id)` lookup and use the passed `product` directly
      - Update the Product type to match backend schema (accept UUID strings for `id`, and handle the backend's `compare_at_price` field)
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/components/agent/AgentPanel.tsx`, potentially `/home/sami-ullah/Desktop/hackaton/frontend/lib/catalog.ts` (to add a compatible type or type mapping)
      Verify: Trigger a product search via the agent, confirm products are displayed with data from the backend (not the mock catalog). Check that product names, prices, and images match what the backend API returns.

- [ ] 7. Handle the type mismatch between backend UUID (string) and frontend product IDs.
      Backend returns `id` as UUID string. Frontend catalog uses string IDs like "p-vela-35". The agent will return backend UUIDs.
      Decision: ProductChip should accept backend product shape. Add a type guard or type alias for backend products vs mock catalog products, OR unify them.
      Simplest approach: Create a `BackendProduct` type in `lib/api/types.ts` (or inline in AgentPanel.tsx) matching the backend schema, and have ProductChip accept `Product | BackendProduct`. Handle both shapes inside ProductChip (check if `id` is a UUID or a prefixed string).
      Alternatively: map backend products to the frontend Product type in `extractProducts()` helper.
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/components/agent/AgentPanel.tsx`, `/home/sami-ullah/Desktop/hackaton/frontend/lib/api/types.ts` (or create it)
      Verify: Confirm TypeScript compiles without errors and both mock and backend products can be added to cart.

- [ ] 8. Update the `add` function in cartStore to accept product data when adding items.
      The `add` function signature is: `add: (id: string, quantity?: number, color?: string, variantId?: string, product?: { ... }) => Promise<void>`
      The `product` parameter already exists and allows passing product metadata for display before backend sync.
      When calling `add(product.id, quantity)` from ProductChip, pass the product data: `add(product.id, quantity, undefined, undefined, { name: product.name, brand: product.brand, image: product.image, price: product.price, compareAt: product.compare_at_price })`.
      This ensures the cart displays the product immediately even if the backend variant lookup hasn't completed.
      Files: `/home/sami-ullah/Desktop/hackaton/frontend/components/agent/AgentPanel.tsx` (update the `add` call in ProductChip)
      Verify: Add a product from the agent panel, open the cart, and confirm the product details (name, price, image) are shown correctly.

## Notes and Gotchas

- **Port mismatch**: The backend runs on port 2024, but the frontend API client defaults to 8000. The agent tool must call `http://localhost:2024/api/v1/products` explicitly. Verify the backend is actually running on 2024.

- **Image domain configuration**: Next.js `<Image>` requires `remotePatterns` configuration for external URLs. The backend images come from Cloudinary (based on the product schema). If images don't load, check the browser console for Next.js image errors and add the correct domain.

- **Product ID type**: Backend uses UUIDs, frontend mock catalog uses prefixed strings like "p-vela-35". The agent will return UUIDs. ProductChip must handle both or convert/map them. The simplest path is to pass full product objects to ProductChip and not rely on ID lookups.

- **Data flow**: The current `productIdsFrom()` helper assumes products exist in the local catalog. After adding the backend tool, the agent will return products NOT in the catalog. The plan refactors this to extract and pass product objects directly.

- **LangChain tool registration**: The `create_agent` function signature in `backend/src/app/agent/agent.py` shows it accepts `model`, `system_prompt`, `context_schema`, and `middleware`. Check LangChain's `create_agent` API docs (or inspect the function signature) to confirm where tools are passed. It may be via `tools=[...]` parameter or via middleware.

- **Build cache**: The original error about `promoCodes` not existing may be a Next.js Turbopack cache issue. Step 1 clears the cache. If the error persists, check that the import statement in `CartSummary.tsx` matches the export in `pricing.ts` exactly (named export `promoCodes`).

- **Quantity state**: ProductChip is rendered in a list and will create independent quantity state for each product. This is correct behavior - each product card manages its own quantity before being added to the cart.

- **CartStore variant handling**: The `add` function accepts a `variantId` for backend cart sync. Products from the agent may not have variant information initially (just product-level data). The cart will work optimistically with the product data, but backend sync may fail if a variantId is required. Check if the backend `/cart` endpoint requires a variant or can accept a product ID. If variants are required, the agent tool response should include default variant IDs.
