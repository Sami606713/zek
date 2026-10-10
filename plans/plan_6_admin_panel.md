# Plan 6: Admin Panel — ZEK Store Back Office

## Overview
The admin panel is where the ZEK team runs the store: manage products and stock, process orders, look after customers, and see what the AI agent is doing across web chat, voice and WhatsApp.

It lives inside the existing Next.js app under `/admin`, with its own layout (sidebar, no storefront navbar/footer), and is only reachable by users whose `role` is `admin` (the `users.role` column already exists in the backend).

---

## Goals
1. Run day-to-day operations without touching the database: products, stock, orders, refunds, customers.
2. See store health at a glance: revenue, orders, low stock, conversion.
3. Oversee the agent: read conversations, spot failed answers, see which tools it calls.
4. Stay fast to build for the hackathon: reuse the storefront's tokens, mock data first, real API second.

## Non-goals (for the hackathon)
- Multi-store / multi-currency
- Fine-grained permissions beyond `admin` vs `customer` (a `staff` role is listed as a later phase)
- Custom report builder, CSV import of the full catalogue

---

## Tech Stack
- **Framework:** Next.js App Router, same app as the storefront (`app/(admin)/admin/...`)
- **UI:** Tailwind v4 + the existing ZEK tokens (`globals.css`), shadcn/ui for dense controls (table, dialog, dropdown, sheet, tabs), customised to ZEK radii and colours
- **Tables:** TanStack Table (sorting, filtering, pagination, row selection)
- **Charts:** Recharts (revenue line, orders bar, category donut)
- **Forms:** React Hook Form + Zod (product editor, refunds)
- **Data:** TanStack Query against the FastAPI admin endpoints, through Next.js BFF routes in `app/api/admin/*`
- **Icons:** Phosphor (same as storefront)
- **Auth guard:** Next.js `proxy.ts` (Next 16 replacement for middleware) checks the session cookie and role before any `/admin` route renders

> Design note: the storefront follows the taste skill's landing-page rules. The admin is a dense product UI, so it uses a compact, data-first layout (higher density, smaller type, tables over cards) while keeping the same palette, font and radius tokens so it still feels like ZEK.

---

## Folder Structure
```
frontend/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       ├── layout.tsx              # Sidebar + top bar, role guard
│   │       ├── page.tsx                # Dashboard
│   │       ├── orders/
│   │       │   ├── page.tsx            # Orders table
│   │       │   └── [id]/page.tsx       # Order detail + actions
│   │       ├── products/
│   │       │   ├── page.tsx            # Products table
│   │       │   ├── new/page.tsx        # Create product
│   │       │   └── [id]/page.tsx       # Edit product
│   │       ├── inventory/page.tsx      # Stock levels, low-stock list
│   │       ├── collections/page.tsx    # Curate collections
│   │       ├── customers/
│   │       │   ├── page.tsx            # Customers table
│   │       │   └── [id]/page.tsx       # Customer profile + orders
│   │       ├── discounts/page.tsx      # Promo codes (e.g. ZEK10)
│   │       ├── agent/
│   │       │   ├── page.tsx            # Agent overview + metrics
│   │       │   └── conversations/
│   │       │       ├── page.tsx        # All chats (web, voice, WhatsApp)
│   │       │       └── [id]/page.tsx   # Single transcript + tool calls
│   │       └── settings/page.tsx       # Store info, shipping, tax, team
│   └── api/admin/                      # BFF routes proxying FastAPI
├── components/admin/
│   ├── AdminSidebar.tsx
│   ├── AdminTopbar.tsx                 # Search, notifications, profile
│   ├── DataTable.tsx                   # TanStack Table wrapper
│   ├── StatCard.tsx
│   ├── charts/RevenueChart.tsx, OrdersChart.tsx, CategoryDonut.tsx
│   ├── orders/OrderStatusSelect.tsx, RefundDialog.tsx
│   ├── products/ProductForm.tsx, ImageUploader.tsx, VariantEditor.tsx
│   └── agent/TranscriptView.tsx, ToolCallCard.tsx
├── lib/admin/
│   ├── api.ts                          # Typed fetchers
│   └── mock.ts                         # Mock data until endpoints exist
└── proxy.ts                            # Role guard for /admin/*
```

---

## Pages & Features

### 1. Dashboard (`/admin`)
- KPI cards: revenue (today / 7d / 30d), orders, average order value, conversion rate, each with change vs previous period
- Revenue over time (line), orders by day (bar), sales by category (donut)
- "Needs attention" list: orders waiting to ship, low-stock products, failed payments, agent conversations flagged as unresolved
- Recent orders (last 10) and top products (last 30 days)
- Channel split: orders that came through web shop vs agent chat vs WhatsApp vs voice

### 2. Orders (`/admin/orders`, `/admin/orders/[id]`)
- Table: order number, customer, date, items, total, payment status, fulfilment status, channel
- Filters: status, date range, payment method (card / cash on delivery), channel; search by order number, email or product
- Bulk actions: mark as packed, mark as shipped, export CSV
- Detail page: items, totals, address, payment, timeline of status changes, internal notes
- Actions: update status (confirmed → packed → shipped → delivered), add tracking number, cancel, full or partial refund (Stripe), resend confirmation email

### 3. Products (`/admin/products`, `/new`, `/[id]`)
- Table: image, name, brand, category, price, stock, status (active / draft / archived), rating
- Filters: category, status, stock level; search
- Bulk actions: publish, archive, change category, adjust price by %
- Product editor:
  - Name, brand, category, description, details list
  - Price and compare-at price (sale)
  - Images: upload, reorder, delete (S3 / Cloudinary)
  - Variants: colours (name + hex) and per-variant stock
  - Tags and SEO title/description
  - Live preview of the storefront product card
- Saving a product triggers re-embedding for the agent's semantic search (pgvector), so the agent can find new products straight away

### 4. Inventory (`/admin/inventory`)
- Stock per product/variant, inline edit
- Low-stock threshold per product, with a "low stock" filter (mirrors the storefront's "Only N left")
- Stock history: who changed what and when

### 5. Collections (`/admin/collections`)
- Create/edit collections: title, blurb, banner image, slug
- Pick and order products by drag and drop
- Show/hide on the storefront

### 6. Customers (`/admin/customers`, `/[id]`)
- Table: name, email, phone, orders, total spent, last order, joined, status (active / locked)
- Profile: contact details, addresses, order history, lifetime value, agent conversations with this customer
- Actions: lock/unlock account (uses existing `is_locked`), verify, reset password email

### 7. Discounts (`/admin/discounts`)
- Create promo codes: code, percent or fixed amount, minimum order, start/end date, usage limit
- Table with usage count and revenue influenced
- Replaces the hard-coded `ZEK10` in `lib/pricing.ts`

### 8. Agent (`/admin/agent`, `/admin/agent/conversations`)
This is the part specific to ZEK.
- Overview metrics: conversations per day by channel, messages, average response time, orders placed through the agent, agent-assisted revenue, hand-off / failure rate
- Top questions and top searched products (what customers ask for that we don't stock is a buying signal)
- Conversations table: customer, channel (web / voice / WhatsApp), started, messages, outcome (purchase, answered, unresolved), flagged
- Transcript view: the full chat, each tool call shown as a card (e.g. `search_products`, `add_to_cart`, `get_order_status`) with its input and output
- Actions: flag/unflag, add a note, take over a WhatsApp conversation as a human

### 9. Settings (`/admin/settings`)
- Store info: name, logo, support email, currency
- Shipping: free-shipping threshold (currently $50), flat rate ($5.99), express ($14.99), delivery windows
- Tax rate (currently 8% estimate)
- Team: invite admins, change roles
- Integrations status: Stripe, WhatsApp, Pipecat, OpenAI-compatible model key (read-only health check)

---

## Layout & UX
- Left sidebar (collapsible to icons): Dashboard, Orders, Products, Inventory, Collections, Customers, Discounts, Agent, Settings. Badge counts on Orders (to ship) and Agent (flagged).
- Top bar: global search (orders, products, customers), date-range picker on data pages, notifications, admin profile menu, "View store" link
- Tables are the main pattern: sticky header, row hover, row click opens detail, URL-synced filters (shareable, like the storefront `/products`)
- Every list has loading skeletons, empty states and error states
- Destructive actions (delete product, refund, cancel order) go through a confirm dialog
- Toasts for save / error feedback
- Light and dark mode from the same tokens; mobile gets a drawer sidebar and stacked cards in place of wide tables

---

## Access Control
1. User logs in through the normal `/login` flow; backend returns JWT with `role`.
2. `proxy.ts` runs on every `/admin/*` request:
   - No session → redirect to `/login?next=/admin`
   - Session with `role !== "admin"` → 404 (don't reveal the admin exists)
3. Admin BFF routes (`app/api/admin/*`) forward the token; FastAPI checks the role again with a `require_admin` dependency. The frontend guard is for UX; the backend check is the real security.
4. Audit log: every admin write (status change, refund, price change, stock edit) records who, what, when.

---

## Backend Endpoints Needed (FastAPI, `/api/v1/admin`)
All require `role == "admin"`.
```
GET    /admin/stats?range=7d                 # Dashboard KPIs + chart series
GET    /admin/orders?status=&q=&page=         # List
GET    /admin/orders/{id}
PATCH  /admin/orders/{id}                     # Status, tracking number, notes
POST   /admin/orders/{id}/refund              # Stripe refund (full/partial)
GET    /admin/products?...                    # List incl. drafts
POST   /admin/products
PUT    /admin/products/{id}
DELETE /admin/products/{id}                   # Soft delete / archive
POST   /admin/products/{id}/images            # Upload
PATCH  /admin/inventory/{product_id}          # Stock adjust
GET    /admin/collections, POST, PUT, DELETE
GET    /admin/customers?..., GET /admin/customers/{id}
PATCH  /admin/customers/{id}                  # Lock/unlock, verify
GET    /admin/discounts, POST, PUT, DELETE
GET    /admin/agent/stats?range=7d
GET    /admin/agent/conversations?channel=&outcome=
GET    /admin/agent/conversations/{id}        # Messages + tool calls
PATCH  /admin/agent/conversations/{id}        # Flag, note
GET    /admin/audit-log
GET    /admin/settings, PUT /admin/settings
```

New/changed models: `orders.channel` (web/agent/whatsapp/voice), `orders.status_history`, `products.status` (active/draft/archived), `products.low_stock_threshold`, `discounts`, `collections`, `audit_log`, `conversations.outcome` and `conversations.flagged`.

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | `/admin` route group, layout (sidebar + top bar), `proxy.ts` guard, shared `DataTable`, `StatCard`, mock data |
| Phase 2 | Dashboard (KPIs, charts, needs-attention) on mock data |
| Phase 3 | Orders list + detail with status updates, cancel, refund dialog |
| Phase 4 | Products list + product editor (images, variants), Inventory |
| Phase 5 | Customers, Collections, Discounts |
| Phase 6 | Agent overview + conversations + transcript with tool calls |
| Phase 7 | Settings, audit log, connect every page to real FastAPI admin endpoints |
| Later | `staff` role with limited permissions, CSV import/export, email templates |

**Hackathon cut (if time is short):** Phase 1, Dashboard, Orders, Products, Agent conversations. These show the full story: the agent sells, the admin sees it and fulfils it.

---

## Notes
- Build frontend pages on `lib/admin/mock.ts` first so UI work is not blocked by the backend; swap fetchers in `lib/admin/api.ts` later without touching components.
- Reuse storefront logic where it already exists: `lib/pricing.ts` (totals), `lib/orderStatus.ts` (status labels), `StatusBadge`.
- Keep admin out of search engines: `robots: { index: false }` on the admin layout.
- Never expose Stripe secret keys or model API keys to the browser; all sensitive calls go through BFF routes.
- Current backend login returns placeholder tokens (`access_{id}`); real JWT with `role` claim is a prerequisite for Phase 7.
