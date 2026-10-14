# Plan 8: Connect the admin panel to the backend

The admin panel (`frontend/app/(admin)/admin/*`) is built but static: every page reads
`frontend/lib/admin/mock.ts`. This plan replaces the mock data with the real API, page by
page, and locks `/admin` to admin accounts.

Test admin from the seed (`backend/scripts/seed.py`): `admin@zek.shop` / `Admin@1234`.

---

## What exists today

### Frontend admin pages (all mock)

| Page | Route | Component |
|---|---|---|
| Dashboard | `/admin` | `dashboard/Dashboard.tsx` |
| Orders list + detail | `/admin/orders`, `/admin/orders/[id]` | `orders/OrdersTable.tsx`, `OrderDetail.tsx` |
| Products list, new, edit | `/admin/products`, `/new`, `/[id]` | `products/ProductsTable.tsx`, `ProductForm.tsx` |
| Inventory | `/admin/inventory` | `inventory/InventoryTable.tsx` |
| Collections | `/admin/collections` | `collections/CollectionsManager.tsx` |
| Discounts | `/admin/discounts` | `discounts/DiscountsManager.tsx` |
| Customers list + detail | `/admin/customers`, `/[id]` | `customers/CustomersTable.tsx`, `CustomerDetail.tsx` |
| Agent insights + conversations | `/admin/agent`, `/agent/conversations[/id]` | `agent/*` |
| Settings | `/admin/settings` | `settings/SettingsView.tsx` |

### Backend admin API (ready)

| Area | Endpoints | Filters |
|---|---|---|
| Orders | `GET /admin/orders`, `GET/PATCH /admin/orders/{id}`, `POST /admin/orders/{id}/refunds` | status, payment_status, channel, date_from, date_to, q |
| Products | `GET /products?include_unpublished&status`, `GET /products/id/{id}`, POST/PATCH/DELETE, variants, stock (`PATCH …/variants/{id}/stock`), images (upload, by URL, reorder) | q, category, brand, price, stock, sort |
| Categories | full CRUD, `include_inactive` | |
| Collections | full CRUD, set/add/remove products, image | `include_unpublished` |
| Discounts | full CRUD | search, status |
| Customers | `GET /users`, `GET/PATCH/DELETE /users/{id}`, `POST /users/{id}/unlock` | search |

### Gaps (no backend endpoint yet)

| Needed by | Missing |
|---|---|
| Dashboard | Stats: revenue, orders, AOV, by-day series, by channel, by category, top products |
| Inventory | A flat list of variants with stock and low-stock flag (today stock sits inside each product) |
| Customer detail | Per-customer totals (orders count, total spent); orders can be fetched with `q` = email |
| Agent pages | Conversations list/transcript and agent stats (LangGraph `/threads/search` has the raw data) |
| Settings | Store settings, team, integrations: no tables at all |

---

## Phases

### Phase 0 — Foundation (do first)

1. **`lib/api/admin.ts`**: typed admin API calls on the existing `api` client (sends the token).
2. **Mappers**: API shapes → the `AdminOrder` / `AdminProduct` / `AdminCustomer` / `Discount` types the
   components already use, so the components change as little as possible.
3. **Admin guard**:
   - Frontend: `proxy.ts` + a check in `admin/layout.tsx`. Not logged in → `/login?next=/admin`;
     logged in but not admin → home page. Needs `role` saved in the user store at login (from `/users/me`).
   - The backend already enforces `require_admin`, so the guard is for UX; security stays server side.
4. **Shared states**: loading skeletons, empty states, error banner with retry, toast on save.

### Phase 1 — Orders (most used, API fully ready)

- Orders table: server-side paging and filters (status, payment, channel, date range, search).
- Order detail: lines, customer, address, status timeline.
- Actions: change status (confirmed → packed → shipped → delivered / cancelled), add tracking/note, refund.
- Status changes here are what customers then see on their own order page.

### Phase 2 — Products, categories, inventory

- Products table: real list with `include_unpublished=true`, status filter, search.
- Product form (new/edit): fields, category picker, variants (add/edit/delete), images
  (upload file, add by URL, reorder, delete), publish/draft/archive.
- Delete with confirm dialog.
- Inventory: adjust stock per variant with a reason (`PATCH …/stock`).
  - First version: built from the product list in the frontend.
  - **Backend addition (small):** `GET /admin/inventory` (variants + stock + low-stock flag, filter by low/out of stock).

### Phase 3 — Collections & discounts

- Collections: list, create/edit, publish toggle, set products, image.
- Discounts: list with status filter, create/edit/delete, active toggle.

### Phase 4 — Customers

- Customers table: `GET /users` with search and paging.
- Customer detail: profile, their orders (`/admin/orders?q=<email>`), lock/unlock, change role, deactivate.
- **Backend addition (small):** order count + total spent per customer, either in `GET /users` or a
  new `GET /admin/customers/{id}/stats`.

### Phase 5 — Dashboard

- **Backend addition:** `GET /admin/stats?days=7|30|90` returning totals vs previous period, a by-day
  series (revenue, orders, by channel), sales by category, top products, low-stock count, recent orders.
- Wire the existing cards and Recharts charts to it.

### Phase 6 — Agent insights (optional)

- Conversations list + transcript from LangGraph `POST /threads/search` and `GET /threads/{id}/state`
  (needs the user id stored in thread metadata when a chat starts).
- Stats (chats/day, outcomes, top questions) need a backend summary endpoint; can stay mock for the demo.

### Phase 7 — Settings (optional)

- Keep static for now, or add a small `store_settings` table (store name, currency, shipping fee,
  tax). Team = `GET /users?role=admin`. Integrations stay static.

---

## Backend additions summary

| # | Endpoint | Phase | Size |
|---|---|---|---|
| B1 | `GET /admin/inventory` | 2 | small |
| B2 | Customer order count + total spent | 4 | small |
| B3 | `GET /admin/stats` | 5 | medium |
| B4 | Agent conversations + stats | 6 | medium (optional) |
| B5 | Store settings | 7 | small (optional) |

## Order of work

Phase 0 → 1 → 2 → 3 → 4 → 5, then 6 and 7 if there is time. Each phase ends with a check in the
browser as `admin@zek.shop`, and `lib/admin/mock.ts` is deleted once no page imports it.
