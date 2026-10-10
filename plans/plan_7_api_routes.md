# Plan 7: API Routes — Build Order

## Overview
The database now has all store tables (migration `f2cfc5de5d49`). This plan builds the FastAPI routes on top of them, **one resource at a time**. Each step is finished, tested and approved before the next one starts.

Users/auth routes are already done (`/api/v1/users`).

---

## Conventions (same as the finished user routes)

**Files per resource**
```
src/app/api/v1/
├── schemas/<resource>.py      # Pydantic request/response models
├── services/<resource>_service.py   # DB logic, raises HTTPException
└── routes/<resource>.py       # Thin endpoints, registered in routes/__init__.py
```

**Rules**
- All routes under `/api/v1`, one tag per resource.
- Auth from `deps.py`: public, `CurrentUser` (signed in), or `AdminUser`.
- Lists return `{items, total, skip, limit}` with `skip`/`limit` (max 100) and filters as query params.
- Money in and out as decimals (strings in JSON), never floats.
- Every endpoint has a `summary` and documented error responses.
- Public endpoints never show drafts, archived or soft-deleted records.
- Admin writes add a row to `audit_logs`.
- MCP: only the routes the agent needs are exposed as tools (tag `Agent tools`); everything else stays excluded, like `Users`.
- Each step ends with an end-to-end test on a temporary database (same as the user routes), then a short review with you.

---

## Build Order

### Step 1 — Categories
| Method | Path | Auth |
|---|---|---|
| GET | `/categories` | Public (active only, nested by parent) |
| GET | `/categories/{slug}` | Public |
| POST | `/categories` | Admin |
| PATCH | `/categories/{id}` | Admin |
| DELETE | `/categories/{id}` | Admin (blocked if products still use it) |

Small and has no dependencies, so it sets the pattern for the rest.

### Step 2 — Products (with variants and images)
| Method | Path | Auth |
|---|---|---|
| GET | `/products` | Public. Filters: `category`, `q`, `min_price`, `max_price`, `min_rating`, `on_sale`, `in_stock`, `sort` (featured, newest, price_asc, price_desc, rating) |
| GET | `/products/{slug}` | Public. Includes images, variants, stock, category |
| GET | `/products/{slug}/related` | Public |
| POST | `/products` | Admin (created as draft, at least one variant) |
| PATCH | `/products/{id}` | Admin (status change publishes/archives) |
| DELETE | `/products/{id}` | Admin (soft delete) |
| POST / PATCH / DELETE | `/products/{id}/variants[/{variant_id}]` | Admin |
| POST / PATCH / DELETE | `/products/{id}/images[/{image_id}]` | Admin (URL now; Cloudinary upload in a later step) |
| PATCH | `/admin/inventory/{variant_id}` | Admin (set or adjust stock, audit logged) |

Matches the storefront's `/products` filters so the frontend can switch from mock data.

### Step 3 — Collections
| Method | Path | Auth |
|---|---|---|
| GET | `/collections` | Public (published and in date window) |
| GET | `/collections/{slug}` | Public, with its products in order |
| POST / PATCH / DELETE | `/collections[/{id}]` | Admin |
| PUT | `/collections/{id}/products` | Admin (replace the ordered product list) |

### Step 4 — Cart
| Method | Path | Auth |
|---|---|---|
| GET | `/cart` | Signed in, or guest via `X-Session-Id` header |
| POST | `/cart/items` | Add variant + quantity (checks stock) |
| PATCH | `/cart/items/{item_id}` | Change quantity |
| DELETE | `/cart/items/{item_id}` | Remove |
| DELETE | `/cart` | Clear |
| POST / DELETE | `/cart/discount` | Apply / remove promo code |
| POST | `/cart/merge` | Signed in: merge the guest cart after login |

Response includes the same totals the frontend computes today (subtotal, discount, shipping, tax, total, free-shipping remaining), calculated on the server.

### Step 5 — Addresses
| Method | Path | Auth |
|---|---|---|
| GET / POST | `/me/addresses` | Signed in |
| PATCH / DELETE | `/me/addresses/{id}` | Signed in (own only) |
| POST | `/me/addresses/{id}/default` | Signed in |

### Step 6 — Discounts
| Method | Path | Auth |
|---|---|---|
| POST | `/discounts/validate` | Public (code + subtotal → valid?, amount) |
| GET / POST | `/admin/discounts` | Admin |
| PATCH / DELETE | `/admin/discounts/{id}` | Admin |

Replaces the hard-coded `ZEK10` in the frontend.

### Step 7 — Orders and checkout
| Method | Path | Auth |
|---|---|---|
| POST | `/checkout` | Signed in or guest. Cart + address + delivery + payment method → order. In one transaction: re-price on the server, check and reserve stock, apply discount, snapshot items, write status history, clear cart |
| GET | `/orders` | Signed in (own orders, filter by status) |
| GET | `/orders/{order_number}` | Signed in (own) or guest with email |
| POST | `/orders/{order_number}/cancel` | Owner, only before packed; restores stock |
| GET | `/admin/orders` | Admin. Filters: status, payment, channel, date range, search |
| GET | `/admin/orders/{id}` | Admin |
| PATCH | `/admin/orders/{id}` | Admin. Status, tracking number, internal note (writes status history) |
| POST | `/admin/orders/{id}/refunds` | Admin. Full or partial refund |

The biggest step. Card payments stay simulated here; Stripe comes in Step 12.

### Step 8 — Wishlist
| Method | Path | Auth |
|---|---|---|
| GET | `/me/wishlist` | Signed in |
| POST | `/me/wishlist` | Signed in (product, optional variant) |
| DELETE | `/me/wishlist/{product_id}` | Signed in |

### Step 9 — Reviews
| Method | Path | Auth |
|---|---|---|
| GET | `/products/{slug}/reviews` | Public (published only, sort by newest/rating) |
| POST | `/products/{slug}/reviews` | Signed in, one per product; "verified purchase" if they ordered it |
| PATCH / DELETE | `/reviews/{id}` | Owner |
| PATCH | `/admin/reviews/{id}` | Admin (hide/publish) |

Updates `products.rating_avg` and `review_count` on every change.

### Step 10 — Agent tools and conversations
| Method | Path | Auth |
|---|---|---|
| POST | `/agent/chat` | Signed in or guest. SSE stream from the LangChain agent; saves messages and tool calls |
| GET | `/agent/conversations/{session_id}` | Owner |
| GET | `/admin/conversations` | Admin. Filters: channel, outcome, flagged |
| GET | `/admin/conversations/{id}` | Admin. Full transcript with tool calls |
| PATCH | `/admin/conversations/{id}` | Admin. Flag, note, outcome, take over |

Also: tag the read-only routes the agent should call (product search, product detail, cart add, order status) as `Agent tools` so MCP exposes exactly those. Fix the WhatsApp webhook import (`src.agent` → `src.app.agent`) and register it, saving its chats as `whatsapp` conversations.

### Step 11 — Admin dashboard, audit log, settings
| Method | Path | Auth |
|---|---|---|
| GET | `/admin/stats?range=7d` | Admin. Revenue, orders, AOV, channel split, chart series, needs-attention counts |
| GET | `/admin/customers`, `/admin/customers/{id}` | Admin. Users plus order count and lifetime value |
| GET | `/admin/audit-logs` | Admin |
| GET / PUT | `/admin/settings` | Admin. Shipping, tax, store info (read by cart and checkout) |

Powers the admin panel in Plan 6.

### Step 12 — Integrations (when the core works)
- Stripe: PaymentIntent on checkout, webhook to mark orders paid, real refunds.
- Cloudinary image upload for products.
- Emails: order confirmation, password reset link.
- pgvector embeddings for semantic product search.

---

## Order at a glance

| Step | Resource | Depends on |
|---|---|---|
| 1 | Categories | — |
| 2 | Products, variants, images, inventory | 1 |
| 3 | Collections | 2 |
| 4 | Cart | 2, 6 (promo optional at first) |
| 5 | Addresses | Users |
| 6 | Discounts | — |
| 7 | Orders and checkout | 2, 4, 5, 6 |
| 8 | Wishlist | 2 |
| 9 | Reviews | 2, 7 |
| 10 | Agent and conversations | 2, 4, 7 |
| 11 | Admin stats, customers, audit, settings | 7, 10 |
| 12 | Stripe, uploads, emails, embeddings | 7 |

**Hackathon cut:** Steps 1, 2, 4, 7 and 10 give the full story (browse → cart → order → the agent doing it by chat).

---

## Also needed along the way
- A seed script (`scripts/seed.py` exists) filling categories, products, variants and collections from the frontend's mock catalogue, so the storefront looks the same on real data.
- Reserved stock is released if an order is cancelled.
