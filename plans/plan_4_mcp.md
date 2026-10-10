# Plan 4: MCP (Model Context Protocol) — Agentic E-Commerce

## Overview
MCP (Model Context Protocol) exposes the e-commerce backend as a set of standardized tools that any MCP-compatible AI client (Claude Desktop, custom agents, etc.) can call. It runs as a server alongside FastAPI, letting external AI systems interact with the shop's data and actions in a structured, discoverable way.

---

## What is MCP here?
MCP turns your FastAPI backend into a **tool server** that AI agents can call with a standard protocol. Instead of hardcoding tool logic into LangChain, MCP exposes them as discoverable endpoints — any compatible client (LangChain, Claude, OpenAI functions) can auto-discover and use them.

---

## Tech Stack
- **MCP SDK:** `mcp` Python SDK (`pip install mcp`)
- **Transport:** HTTP + SSE (running on FastAPI)
- **Integration:** FastAPI mounts the MCP server as a sub-application
- **Auth:** Bearer token (same JWT as main API)

---

## Folder Structure
```
backend/app/mcp/
├── __init__.py
├── server.py                 # MCP server setup + mount into FastAPI
├── tools/
│   ├── __init__.py
│   ├── product_tools.py      # MCP product tool definitions
│   ├── cart_tools.py         # MCP cart tool definitions
│   ├── order_tools.py        # MCP order tool definitions
│   └── user_tools.py         # MCP user tool definitions
├── resources/
│   ├── catalog_resource.py   # Expose product catalog as MCP resource
│   └── user_resource.py      # Expose user profile as MCP resource
└── prompts/
    └── shopping_prompts.py   # MCP prompt templates
```

---

## MCP Server Setup
```python
# backend/app/mcp/server.py
from mcp.server.fastapi import create_mcp_router
from mcp import Server, Tool, Resource

mcp_server = Server("agentshop-mcp")

# Mount into FastAPI
app.include_router(
    create_mcp_router(mcp_server),
    prefix="/mcp"
)
```

---

## MCP Tools Exposed

### Product Tools
```python
@mcp_server.tool()
async def search_products(
    query: str,
    category: str = None,
    min_price: float = None,
    max_price: float = None,
    limit: int = 5
) -> list[dict]:
    """
    Search the product catalog using semantic search.
    Returns a list of matching products with id, name, price, rating, image.
    """

@mcp_server.tool()
async def get_product(product_id: str) -> dict:
    """
    Get full details for a single product including specs, images, and reviews.
    """

@mcp_server.tool()
async def get_featured_products(limit: int = 10) -> list[dict]:
    """
    Get currently featured/promoted products.
    """
```

### Cart Tools
```python
@mcp_server.tool()
async def add_to_cart(product_id: str, quantity: int = 1) -> dict:
    """
    Add a product to the authenticated user's cart.
    Returns updated cart summary.
    """

@mcp_server.tool()
async def get_cart() -> dict:
    """
    Get the current user's cart with all items, quantities, and total.
    """

@mcp_server.tool()
async def remove_from_cart(cart_item_id: str) -> dict:
    """
    Remove an item from the cart.
    """

@mcp_server.tool()
async def clear_cart() -> dict:
    """
    Remove all items from the current cart.
    """
```

### Order Tools
```python
@mcp_server.tool()
async def place_order(
    shipping_address: dict,
    payment_method_id: str
) -> dict:
    """
    Place an order from the current cart contents.
    Requires confirmed cart and valid payment method.
    Returns order ID and confirmation details.
    """

@mcp_server.tool()
async def get_order(order_id: str) -> dict:
    """
    Get details and current status of a specific order.
    """

@mcp_server.tool()
async def list_orders(limit: int = 10) -> list[dict]:
    """
    List the user's recent orders with status and summary.
    """

@mcp_server.tool()
async def cancel_order(order_id: str, reason: str = None) -> dict:
    """
    Cancel an order if it hasn't shipped yet.
    """
```

### User Tools
```python
@mcp_server.tool()
async def get_user_profile() -> dict:
    """
    Get the authenticated user's profile and preferences.
    """

@mcp_server.tool()
async def get_recommendations(context: str = None) -> list[dict]:
    """
    Get personalized product recommendations for the user.
    Optional context string to guide recommendations.
    """
```

---

## MCP Resources

Resources expose read-only data that AI clients can pull as context:

```python
@mcp_server.resource("catalog://categories")
async def get_categories() -> str:
    """Returns all product categories as JSON."""

@mcp_server.resource("catalog://brands")
async def get_brands() -> str:
    """Returns all available brands."""

@mcp_server.resource("user://profile")
async def get_user_context() -> str:
    """Returns current user's profile and purchase history summary."""
```

---

## MCP Prompts

Reusable prompt templates that AI clients can request:

```python
@mcp_server.prompt()
def shopping_assistant_prompt(user_name: str, context: str = "") -> str:
    """System prompt template for the shopping assistant."""
    return f"""
    You are a helpful shopping assistant for AgentShop.
    User: {user_name}
    Context: {context}
    Use the available tools to help the user find, compare, and purchase products.
    """

@mcp_server.prompt()
def product_comparison_prompt(product_ids: list[str]) -> str:
    """Prompt to compare specific products."""
```

---

## MCP Endpoints (auto-generated)

```
GET  /mcp/tools/list              # List all available tools
POST /mcp/tools/call              # Call a specific tool
GET  /mcp/resources/list          # List all resources
GET  /mcp/resources/read          # Read a resource
GET  /mcp/prompts/list            # List prompt templates
POST /mcp/prompts/get             # Get a rendered prompt
GET  /mcp/                        # SSE stream (MCP protocol)
```

---

## Integration with LangChain Agent

The LangChain agent (Plan 3) can use MCP tools directly:

```python
from langchain_mcp import MCPToolkit

# Load tools from MCP server
mcp_toolkit = MCPToolkit(server_url="http://localhost:8000/mcp")
tools = await mcp_toolkit.get_tools()

# Pass to LangChain agent
agent = create_react_agent(llm, tools, prompt)
```

---

## External Client Usage (Claude Desktop)

Add to Claude Desktop `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "agentshop": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer <user_jwt_token>"
      }
    }
  }
}
```

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | MCP server setup, mount into FastAPI |
| Phase 2 | Product tools (search, get, featured) |
| Phase 3 | Cart and Order tools |
| Phase 4 | Resources and Prompts |
| Phase 5 | LangChain MCP toolkit integration |
| Phase 6 | Auth (JWT in MCP context), testing with Claude Desktop |

---

## Notes
- MCP tools are the **single source of truth** for tool definitions — LangChain tools (Plan 3) wrap MCP calls rather than reimplementing logic
- This means one tool codebase serves both the internal LangChain agent AND external AI clients
- Tool descriptions must be very clear — AI models use them to decide when/how to call each tool
- Keep tool granularity fine-grained (one action per tool)
