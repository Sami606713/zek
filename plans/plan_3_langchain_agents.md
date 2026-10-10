# Plan 3: LangChain Agent Integration — Agentic E-Commerce

## Overview
The LangChain agent is the brain of the agentic commerce system. It understands user shopping intent, calls tools (search products, add to cart, check orders), and returns conversational + structured responses. It runs inside the FastAPI backend.

---

## Tech Stack
- **Framework:** LangChain + LangGraph (for stateful agent flows)
- **LLM:** OpenAI GPT-4o (primary) / Claude 3.5 (fallback)
- **Memory:** LangChain ConversationBufferWindowMemory + Redis persistence
- **Vector Store:** pgvector (PostgreSQL) for semantic product search
- **Embeddings:** OpenAI text-embedding-3-small
- **Streaming:** LangChain `astream_events` for SSE

---

## Folder Structure
```
backend/app/agents/
├── __init__.py
├── shopping_agent.py         # Main agent definition
├── tools/
│   ├── __init__.py
│   ├── product_tools.py      # Search, get product, compare
│   ├── cart_tools.py         # Add, remove, view cart
│   ├── order_tools.py        # Place order, track order
│   ├── user_tools.py         # Get preferences, history
│   └── recommendation_tool.py # Personalized recommendations
├── prompts/
│   ├── system_prompt.py      # Agent system prompt
│   └── few_shot_examples.py  # Few-shot shopping examples
├── memory/
│   ├── redis_memory.py       # Redis-backed chat memory
│   └── user_profile.py       # Long-term user preferences
└── graph/
    └── shopping_graph.py     # LangGraph stateful flow
```

---

## Agent Architecture

### Agent Type: ReAct (Reasoning + Acting)
The agent follows a Thought → Action → Observation loop:

```
User: "Find me wireless headphones under $80 with good bass"
  ↓
[Thought] I need to search for wireless headphones with price filter
  ↓
[Action] search_products(query="wireless headphones bass", max_price=80)
  ↓
[Observation] [{id: 1, name: "Sony WH-XB910N", price: 79, rating: 4.5}, ...]
  ↓
[Thought] Found 3 options, should present them with comparison
  ↓
[Response] "I found 3 great options for you! Here are the top picks..."
           + structured product cards
```

---

## Tools Definition

### 1. Product Search Tool
```python
@tool
async def search_products(
    query: str,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    brand: Optional[str] = None,
    min_rating: Optional[float] = None,
    limit: int = 5
) -> list[dict]:
    """Search for products using semantic search and filters."""
    # Uses pgvector similarity search + SQL filters
```

### 2. Get Product Detail Tool
```python
@tool
async def get_product_detail(product_id: str) -> dict:
    """Get full details, specs, and reviews for a specific product."""
```

### 3. Compare Products Tool
```python
@tool
async def compare_products(product_ids: list[str]) -> dict:
    """Compare multiple products side by side on key attributes."""
```

### 4. Add to Cart Tool
```python
@tool
async def add_to_cart(
    product_id: str,
    quantity: int = 1,
    user_id: str = None
) -> dict:
    """Add a product to the user's cart."""
```

### 5. View Cart Tool
```python
@tool
async def view_cart(user_id: str) -> dict:
    """Get current cart contents and total price."""
```

### 6. Place Order Tool
```python
@tool
async def place_order(
    user_id: str,
    shipping_address: dict,
    payment_method: str
) -> dict:
    """Place an order from the current cart."""
```

### 7. Track Order Tool
```python
@tool
async def track_order(order_id: str) -> dict:
    """Get current status and tracking info for an order."""
```

### 8. Get Recommendations Tool
```python
@tool
async def get_recommendations(
    user_id: str,
    context: Optional[str] = None
) -> list[dict]:
    """Get personalized product recommendations based on user history."""
```

---

## System Prompt
```python
SYSTEM_PROMPT = """
You are ShopBot, an intelligent shopping assistant for AgentShop.
You help users find products, compare options, manage their cart, and place orders.

Your personality:
- Friendly and conversational
- Concise but helpful
- Proactively suggest alternatives if something is out of stock or over budget

Your capabilities:
- Search and filter products
- Compare products
- Add items to cart
- Place orders
- Track orders
- Give personalized recommendations

Rules:
- Always confirm before placing an order
- Never add to cart without user's explicit intent
- If unsure about a product, show options rather than guessing
- Format product lists as structured data (the UI will render them as cards)
- Keep responses short — let the product cards do the visual work

Current user: {user_name}
Session ID: {session_id}
"""
```

---

## Memory Architecture

### Short-term (per session)
- `ConversationBufferWindowMemory` — last 20 messages
- Stored in Redis with TTL of 24 hours
- Key: `session:{session_id}:history`

### Long-term (per user)
- User preferences extracted from conversations
- Stored in PostgreSQL `user_profiles` table
- Fields: preferred_brands, price_range, categories, past_purchases

### Memory Flow
```
New message arrives
       ↓
Load session history from Redis
       ↓
Inject into agent context
       ↓
Agent generates response + tool calls
       ↓
Save updated history to Redis
       ↓
Async: extract preferences → update user_profile in DB
```

---

## LangGraph — Stateful Shopping Flow

For complex multi-step flows (full purchase), LangGraph manages state:

```
[understand_intent]
       ↓
[search_or_recommend]  →  [clarify_requirements] (if ambiguous)
       ↓
[present_options]
       ↓
[add_to_cart]          →  [confirm_selection]
       ↓
[collect_shipping]
       ↓
[confirm_order]
       ↓
[place_order]
       ↓
[order_confirmation]
```

---

## Streaming Integration with FastAPI
```python
async def stream_agent_response(message: str, session_id: str, user_id: str):
    agent = get_shopping_agent(session_id, user_id)
    
    async for event in agent.astream_events(
        {"input": message}, 
        version="v2"
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            yield {"type": "token", "content": chunk}
        
        elif event["event"] == "on_tool_end":
            yield {"type": "tool_result", "tool": event["name"], "data": event["data"]["output"]}
```

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | Basic ReAct agent with search + cart tools |
| Phase 2 | Redis memory integration |
| Phase 3 | All 8 tools implemented and tested |
| Phase 4 | LangGraph full purchase flow |
| Phase 5 | Long-term user preferences |
| Phase 6 | Prompt tuning, edge case handling |

---

## Notes
- Use `langchain-community` for pgvector integration
- Tool outputs should include both raw data AND a human-friendly summary
- Agent should handle ambiguity gracefully ("Do you mean X or Y?")
- Log all tool calls to DB for analytics and debugging
