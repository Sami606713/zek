# Plan 7: Connect the Frontend to the Backend

## Overview
The frontend (Next.js) is fully built on mock data and browser storage. The FastAPI backend now exposes 83 endpoints under `/api/v1`. This plan replaces every mock with a real API call, **one area at a time**, so each step can be tested before the next one starts.

---

## What the backend gives us

| Area | Endpoints | Auth |
|---|---|---|
| Auth & profile | `POST /users/register`, `/login`, `/refresh-token`, `/forgot-password`, `/reset-password`; `GET/PATCH /users/me`; `POST /users/me/change-password` | Bearer JWT |
| Categories | `GET /categories`, `/categories/tree`, `/categories/{slug}` | Public |
| Products | `GET /products` (filters: `category, q, brand, min_price, max_price, min_rating, on_sale, in_stock, featured, sort, skip, limit`), `GET /products/{slug}`, `/products/{slug}/related` | Public |
| Collections | `GET /collections`, `GET /collections/{slug}` | Public |
| Cart | `GET/DELETE /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/{id}`, `POST/DELETE /cart/discount`, `POST /cart/merge` | Bearer **or** `X-Session-Id` (guest) |
| Checkout & orders | `POST /checkout`, `GET /orders`, `GET /orders/{order_number}` (guests add `?email=`), `POST /orders/{order_number}/cancel` | Bearer or `X-Session-Id` |
| Addresses | `GET/POST /me/addresses`, `GET/PATCH/DELETE /me/addresses/{id}`, `POST /me/addresses/{id}/default` | Bearer |
| Wishlist | `GET/POST/DELETE /me/wishlist`, `GET /me/wishlist/ids`, `DELETE /me/wishlist/{product_id}` | Bearer |
| Discounts | `POST /discounts/validate` (public); admin CRUD | Admin |
| Admin | products, variants, stock, images, collections, categories, discounts, users, `admin/orders` (status, tracking, notes, refunds) | Admin |

**Key facts**
- **Auth:** JWT access token (30 min) + refresh token (7 days), sent as `Authorization: Bearer`. The access token carries `role` (`customer` or `admin`).
- **Guest cart:** send a random `X-Session-Id` header. After login, `POST /cart/merge` moves the guest cart into the account.
- **CORS:** already allows `http://localhost:3000` with credentials.
- **Seed data:** `scripts/seed.py` loads the same 16 products, 5 categories and 4 collections as the frontend. Product slug = frontend id without `p-` (`p-vela-35` → `vela-35`).
- **Money comes back as strings** (`"129.00"`), and the server computes all cart totals, shipping, tax and discounts.
- **Products are bought by variant** (`variant_id`), e.g. one variant per color.

---

## Approach

### 1. One API layer, components barely change
```
frontend/lib/api/
├── client.ts        # fetch wrapper: base URL, JSON, Bearer token, X-Session-Id, 401 → refresh → retry, typed errors
├── types.ts         # generated from the backend OpenAPI spec (openapi-typescript)
├── mappers.ts       # API shapes → the frontend types components already use (Product, Order, ...)
├── auth.ts          # login, register, me, refresh, logout
├── catalog.ts       # products, categories, collections
├── cart.ts, orders.ts, addresses.ts, wishlist.ts, admin.ts
```
Mappers convert API responses into the shapes the UI already uses (string prices → numbers, `compare_at_price` → `compareAt`, etc.), so most components only swap where their data comes from.

### 2. Where data is fetched
- **Catalogue pages** (home, products, product detail, collections): fetched on the **server** for fast first paint and SEO. Cached and revalidated every few minutes.
- **Personal data** (cart, orders, wishlist, account, admin): fetched in the **browser** with **TanStack Query**, which handles loading, caching, retries and refreshing after changes.

### 3. Tokens and sessions
- Access and refresh tokens are kept in the existing persisted user store (localStorage). When a request gets a 401, the client refreshes once and retries.
- A guest session ID is created on first visit and sent as `X-Session-Id`.
- Trade-off: localStorage is the quickest option for the hackathon. httpOnly cookies through a Next.js BFF are safer and can come later without changing components.

### 4. Config
```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_LANGGRAPH_API_URL=http://127.0.0.1:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=chat
```
Use `localhost` (not `127.0.0.1`) for the API so it matches the CORS origin exactly.

---

## Steps (one at a time, each tested before the next)

| Step | Area | What changes in the frontend | Done when |
|---|---|---|---|
| **0** | Setup | Start Postgres, run migrations + seed, run API on :8000. Add `lib/api/client.ts`, generate types, add TanStack Query provider, `.env.local`. Health check banner in dev if the API is down. | `GET /health` OK from the browser, types compile |
| **1** | Auth | Login, register, logout, refresh, `GET /users/me`. Navbar shows the real user. Account → Profile (`PATCH /users/me`) and Security (`change-password`). Replaces `lib/auth.ts` mocks. | Register → login → reload stays logged in → token refresh works |
| **2** | Catalogue | Home rails, `/products` (filters and sort mapped to query params), product detail by slug + related, `/collections` and `/collections/[slug]`, category pills from `/categories`. Remove `lib/catalog.ts` data (keep helpers). | All storefront pages render from the API |
| **3** | Cart | Cart store becomes a thin cache of `GET /cart`. Add / update / remove / promo code call the API; totals, shipping and tax come from the server. Guest `X-Session-Id`; `POST /cart/merge` right after login. Product page picks the **variant** for the chosen color. | Add as guest → log in → bag is kept; promo `ZEK10` applied by server |
| **4** | Checkout | `POST /checkout` with address (or saved `address_id`), delivery, payment, `expected_total`. Confirmation page loads `GET /orders/{order_number}` (guests pass `?email=`). | Order placed, cart emptied server-side, confirmation shows real data |
| **5** | Orders | `/orders` from `GET /orders`, detail from `GET /orders/{n}`, cancel via `POST /orders/{n}/cancel`. Timeline uses `status_history` and `packed_at` / `shipped_at` / `delivered_at`. Remove the simulated status logic. | Statuses and cancel come from the server |
| **6** | Addresses & wishlist | Account → Addresses on `/me/addresses` (+ default). Hearts use `/me/wishlist` when logged in; guests keep the local list, which is pushed to the server on login. Checkout's "saved address" chips use the API list. | Saved data survives logging in on another browser |
| **7** | Admin | Products (create/edit, variants, stock, image upload), Orders (`/admin/orders`: status, tracking, notes, refunds), Collections, Discounts, Customers (`/users`). Add `require admin` guard in `proxy.ts` using the token's `role`. | Admin changes appear in the store |
| **8** | Agent | Chat panel already uses `useStream`. Once the LangGraph server runs, pass the user's token to the agent so it can see their cart and orders. | Real agent replies in the panel |

---

## Backend gaps found (need backend work or a frontend workaround)

| Gap | Impact | Suggestion |
|---|---|---|
| `ProductListItem` has no variant id | "Add to bag" on product cards can't call `POST /cart/items` without one | Add `default_variant_id` to list items (workaround: fetch product detail on click) |
| No `DELETE /users/me` | Account → "Delete account" can't work for customers | Add a self-delete endpoint, or hide the button |
| No notification preferences on the user | Account → Notifications toggles have nowhere to save | Add a `preferences` JSON field, or keep them local for now |
| No admin stats endpoint | Admin dashboard KPIs and charts | Add `GET /admin/stats?range=`, or compute from `admin/orders` for now |
| No agent conversations endpoints | Admin → Agent insights / Conversations | Read from LangGraph threads API, or add endpoints later |
| No store settings endpoint (model exists) | Admin → Settings | Add `GET/PUT /admin/settings` |
| Forgot password only creates a token | No email is sent | Keep "coming soon" until an email service is added |
| Payment is simulated (`card_last4`) | No real charge | Fine for the hackathon; Stripe later |
| Agent server won't start | Chat panel shows "couldn't reply" | Fix OpenTelemetry versions and the `http.app` path in `langgraph.json` |

---

## Risks and notes
- **Product IDs → slugs:** routes stay `/products/[id]`, but the param becomes the slug (`vela-35`). Old links with `p-` can redirect.
- **Static pages:** product and collection pages are currently prerendered from local data. With the API they become server-rendered with revalidation; the API must be running for `next build`.
- **Local storage clean-up:** after Steps 3 and 6, old local cart, order and wishlist data is migrated once (pushed to the server) and then cleared.
- **Rate limit:** the API rate-limits per IP; TanStack Query caching keeps request counts low.
- **Admin role:** the frontend admin guard is only for UX; the backend already checks `role == admin` on every admin endpoint.
