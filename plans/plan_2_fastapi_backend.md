# Plan 2: FastAPI Backend — Agentic E-Commerce

## Overview
The FastAPI backend is the core server that handles product data, user management, order processing, and acts as the orchestration layer connecting the Next.js frontend, LangChain agents, MCP tools, and Pipecat voice pipelines.

---

## Tech Stack
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (via SQLAlchemy async + Alembic migrations)
- **Cache:** Redis (sessions, cart, agent memory)
- **Auth:** JWT (python-jose) + OAuth2
- **Task Queue:** Celery + Redis (async order processing, notifications)
- **Real-time:** SSE (Server-Sent Events) for agent streaming
- **WebSocket:** FastAPI WebSocket for live updates
- **Storage:** AWS S3 / Cloudinary (product images)
- **Payment:** Stripe SDK

---

## Folder Structure
```
backend/
├── app/
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # Settings (pydantic-settings)
│   ├── database.py               # Async SQLAlchemy engine
│   ├── deps.py                   # Shared dependencies (get_db, get_user)
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py           # /auth/login, /auth/register
│   │   │   ├── products.py       # /products CRUD
│   │   │   ├── cart.py           # /cart endpoints
│   │   │   ├── orders.py         # /orders endpoints
│   │   │   ├── agent.py          # /agent/chat (SSE streaming)
│   │   │   ├── mcp.py            # /mcp tool endpoints
│   │   │   └── whatsapp.py       # /whatsapp webhook
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── cart.py
│   │   ├── order.py
│   │   └── conversation.py       # Agent chat history
│   │
│   ├── schemas/
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── cart.py
│   │   ├── order.py
│   │   └── agent.py              # Chat request/response schemas
│   │
│   ├── services/
│   │   ├── product_service.py
│   │   ├── order_service.py
│   │   ├── cart_service.py
│   │   └── notification_service.py
│   │
│   ├── agents/                   # LangChain agent (see Plan 3)
│   ├── mcp/                      # MCP tools (see Plan 4)
│   └── voice/                    # Pipecat integration (see Plan 5)
│
├── alembic/                      # DB migrations
├── tests/
├── .env
└── requirements.txt
```

---

## Core API Endpoints

### Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

### Products
```
GET    /api/v1/products                  # List with filters
GET    /api/v1/products/{id}             # Product detail
POST   /api/v1/products                  # Create (admin)
PUT    /api/v1/products/{id}             # Update (admin)
DELETE /api/v1/products/{id}             # Delete (admin)
GET    /api/v1/products/search?q=...     # Semantic/keyword search
```

### Cart
```
GET    /api/v1/cart                      # Get current cart
POST   /api/v1/cart/items                # Add item
PUT    /api/v1/cart/items/{id}           # Update quantity
DELETE /api/v1/cart/items/{id}           # Remove item
DELETE /api/v1/cart                      # Clear cart
```

### Orders
```
POST   /api/v1/orders                    # Place order
GET    /api/v1/orders                    # Order history
GET    /api/v1/orders/{id}              # Order detail
PUT    /api/v1/orders/{id}/cancel        # Cancel order
```

### Agent Chat (SSE Streaming)
```
POST   /api/v1/agent/chat               # SSE streaming endpoint
GET    /api/v1/agent/history/{session}  # Chat history
DELETE /api/v1/agent/history/{session}  # Clear history
```

### WhatsApp Webhook
```
GET    /api/v1/whatsapp/webhook         # Verification challenge
POST   /api/v1/whatsapp/webhook         # Incoming messages
```

---

## Agent Chat — SSE Endpoint
```python
@router.post("/chat")
async def agent_chat(request: ChatRequest, user: User = Depends(get_current_user)):
    async def event_stream():
        async for chunk in langchain_agent.astream(
            input=request.message,
            session_id=request.session_id,
            user_id=user.id
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

---

## Database Models

### Product
```
id, name, description, price, category, brand,
stock_qty, images[], rating, tags[], embedding (pgvector)
```

### Order
```
id, user_id, items[], total_price, status,
payment_status, shipping_address, created_at
```

### Conversation
```
id, session_id, user_id, role (user/assistant),
content, tool_calls[], created_at
```

---

## Environment Variables
```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/agentshop
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
STRIPE_SECRET_KEY=...
OPENAI_API_KEY=...
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=...
```

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | Project setup, DB models, Alembic migrations |
| Phase 2 | Auth endpoints (JWT) |
| Phase 3 | Product, Cart, Order CRUD |
| Phase 4 | Agent SSE streaming endpoint |
| Phase 5 | WhatsApp webhook handler |
| Phase 6 | Payment (Stripe), notifications |

---

## Notes
- Use `asyncpg` for fully async DB operations
- Enable pgvector extension for semantic product search
- All endpoints return consistent `{data, message, status}` envelope
- Rate limit agent endpoint (expensive LLM calls)
- CORS configured for Next.js frontend origin
