# Pipecat Research — 04: Function Calling & MCP Integration
## For: Agentic E-Commerce Hackathon

---

## Function Calling (Tool Calling)

This is the most critical feature for agentic e-commerce. It allows the LLM inside the voice pipeline to call our FastAPI/MCP tools mid-conversation.

### How It Works

```
User: "Find me wireless headphones under $80"
    ↓
LLM detects tool call needed
    ↓
[TOOL CALL] search_products(query="wireless headphones", max_price=80)
    ↓
Pipecat executes the function handler
    ↓
Handler calls FastAPI/MCP → gets product list
    ↓
Result injected back into LLM context
    ↓
LLM: "I found 3 great options! The Sony WH-XB910N at $79..."
    ↓
TTS speaks response
```

**Context integration:** Tool calls and results are automatically stored in conversation history — no manual wiring needed.

---

### Defining Tools — Direct Function Pattern (Recommended)

The preferred pattern: one async function = schema + handler. Pipecat auto-derives name, description, parameters from the function's signature and docstring.

```python
from pipecat.services.llm import FunctionCallParams

async def search_products(
    params: FunctionCallParams,
    query: str,
    category: str = None,
    max_price: float = None,
    min_rating: float = None,
    limit: int = 5
) -> None:
    """
    Search the product catalog for items matching the query.
    
    Args:
        query: Search query describing what the user wants.
        category: Product category to filter by (electronics, clothing, etc.).
        max_price: Maximum price in USD.
        min_rating: Minimum star rating (1.0 to 5.0).
        limit: Maximum number of results to return (default 5).
    """
    # Call our FastAPI backend
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/api/v1/products/search",
            params={"q": query, "category": category, "max_price": max_price, "limit": limit}
        )
        products = response.json()["data"]
    
    # Return result to LLM
    await params.result_callback(products)


async def add_to_cart(
    params: FunctionCallParams,
    product_id: str,
    quantity: int = 1
) -> None:
    """
    Add a product to the user's shopping cart.
    
    Args:
        product_id: The unique ID of the product to add.
        quantity: Number of units to add (default 1).
    """
    user_id = params.app_resources.get("user_id")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/cart/items",
            json={"product_id": product_id, "quantity": quantity, "user_id": user_id}
        )
        cart = response.json()["data"]
    
    await params.result_callback({
        "success": True,
        "message": f"Added to cart. Your cart now has {cart['total_items']} items.",
        "cart_total": cart["total_price"]
    })


async def get_order_status(
    params: FunctionCallParams,
    order_id: str
) -> None:
    """
    Get the current status and tracking information for an order.
    
    Args:
        order_id: The order ID to look up.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(f"http://localhost:8000/api/v1/orders/{order_id}")
        order = response.json()["data"]
    
    await params.result_callback({
        "order_id": order["id"],
        "status": order["status"],
        "estimated_delivery": order["delivery_date"],
        "items": [f"{item['name']} x{item['quantity']}" for item in order["items"]]
    })
```

---

### Registering Tools with the LLM

```python
from pipecat.services.openai import OpenAILLMService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

# Define context with tools
context = OpenAILLMContext(
    messages=[],
    tools=[
        search_products,    # direct function reference
        add_to_cart,
        get_order_status,
        # ... more tools
    ]
)

# LLM service
llm = OpenAILLMService(
    api_key=os.environ["OPENAI_API_KEY"],
    model="gpt-4o",
)

# Context aggregators (manage conversation history)
context_aggregator = llm.create_context_aggregator(context)
```

---

### Passing Shared Resources (user_id, db session)

Tools need the current user's ID to personalize results. Use `app_resources`:

```python
# Pass user context when creating the worker
worker = PipelineWorker(
    pipeline,
    app_resources={
        "user_id": current_user.id,
        "user_phone": call_data.From,
        "session_id": f"voice_{call_data.id}",
    }
)

# Access in any tool handler
async def add_to_cart(params: FunctionCallParams, product_id: str, quantity: int = 1):
    user_id = params.app_resources["user_id"]
    # ...
```

---

### Tool Call Behavior Options

```python
from pipecat.services.llm import tool_options

# Default: synchronous — LLM waits for result before responding
async def search_products(params, query: str): ...

# Async: conversation continues while tool runs (for slow operations)
@tool_options(cancel_on_interruption=False, timeout_secs=10)
async def check_shipping_estimate(params, address: dict): ...

# Cancellable by LLM (user changes mind mid-lookup)
@tool_options(cancel_on_interruption=False, cancellable_by_llm=True, timeout_secs=15)
async def find_best_deal(params, category: str): ...
```

---

## MCP Integration — Two Directions

Pipecat has **bidirectional** MCP support:

| Direction | What | Use Case |
|---|---|---|
| **MCPClient** | Pipecat bot calls an MCP server | Connect voice bot to our FastAPI MCP tools |
| **MCP Transport** | Pipecat bot IS an MCP server | External agents (Claude) talk to our voice bot |

---

### Direction 1: MCPClient — Voice Bot Calls Our MCP Server

This connects our Pipecat voice bot directly to our FastAPI MCP server (Plan 4). Instead of writing tool functions manually, the bot auto-discovers tools from the MCP server.

```python
from pipecat.mcp import MCPClient
from mcp.client.session_group import StreamableHttpParameters

# Connect to our FastAPI MCP server
mcp_client = MCPClient(
    server_params=StreamableHttpParameters(
        url="http://localhost:8000/mcp",
        headers={"Authorization": f"Bearer {user_jwt_token}"}
    ),
    # Only expose specific tools to the LLM (security best practice)
    allowed_tools=["search_products", "add_to_cart", "get_order_status", "get_recommendations"]
)

# Get tools (auto-discovers from MCP server)
tools = await mcp_client.tools()

# Register with LLM context
context = OpenAILLMContext(messages=[], tools=tools)
```

**Advantages of MCPClient:**
- No duplicate tool definitions — MCP server is the single source of truth
- Tools auto-updated when MCP server changes
- Auth passed via headers (JWT bearer token)
- Works with Stdio, SSE, or Streamable HTTP transport

---

### Direction 2: MCP Transport — Our Bot as an MCP Server

`pipecat-mcp-transport` serves the Pipecat bot as an MCP server. External agents (Claude Desktop, LangChain) can call `start` and `chat` to interact with the voice bot via text.

```python
from pipecat_mcp_transport import McpBotServer

server = McpBotServer(
    bot_function=create_shopping_bot,
    name="agentshop-voice-bot",
    host="127.0.0.1",
    port=7870,
    path="/mcp",
)

await server.run()
```

**Exposed MCP tools:**
- `start` — creates new shopping session, returns session handle
- `chat` — sends message to bot, returns full text reply

**Use case for us:** A LangChain agent or Claude could call our voice bot as a tool to handle complex shopping conversations.

---

## Complete Shopping Voice Bot — Tool Setup

```python
# All shopping tools for the voice agent
SHOPPING_TOOLS = [
    search_products,        # search catalog
    get_product_detail,     # get specs/reviews
    compare_products,       # side-by-side comparison
    add_to_cart,            # add item to cart
    view_cart,              # see cart contents
    remove_from_cart,       # remove item
    place_order,            # checkout
    get_order_status,       # track order
    get_recommendations,    # personalized suggestions
]

# System prompt for voice shopping
SYSTEM_PROMPT = """
You are ShopBot, an AI voice shopping assistant for AgentShop.
Help users find products, compare options, manage their cart, and place orders.

Voice rules:
- Keep responses SHORT — 1-2 sentences max per turn
- Confirm before adding to cart
- Confirm ALWAYS before placing an order
- Say product names and prices clearly
- If listing products, name only 2-3, then offer to list more
- Never read out full specifications unless asked
"""

context = OpenAILLMContext(
    messages=[{"role": "system", "content": SYSTEM_PROMPT}],
    tools=SHOPPING_TOOLS
)
```

---

## Parallel Tool Calls

OpenAI GPT-4o can call multiple tools in one turn. Pipecat handles this:

```python
llm = OpenAILLMService(
    api_key=...,
    model="gpt-4o",
    # Both True by default — controls parallel tool execution
    parallel_tool_calls=True,     # run tools concurrently
    run_llm_on_tool_complete=True, # wait for all tools, then one LLM call
)
```

**Example:** User asks "Compare Sony and Bose headphones" → LLM calls `get_product_detail(sony_id)` and `get_product_detail(bose_id)` in parallel → both results arrive → LLM makes one comparison response.

---

## Changing Tools Mid-Conversation

For flows where tool availability should change (e.g., after user adds to cart, show checkout tools):

```python
from pipecat.frames.frames import LLMSetToolsFrame

# Push new tool set mid-conversation
await pipeline.push_frame(
    LLMSetToolsFrame(tools=[view_cart, place_order, continue_shopping])
)
```
