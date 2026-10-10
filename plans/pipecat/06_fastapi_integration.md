# Pipecat Research — 06: FastAPI Integration & Full Architecture
## For: Agentic E-Commerce Hackathon

---

## How Pipecat Runs Alongside FastAPI

Pipecat bots run as separate async tasks — not inside FastAPI request handlers. The FastAPI server handles webhooks and session setup, then spawns bot tasks that run independently.

### Two Deployment Options

#### Option A: Same Process (Hackathon — Simple)
Pipecat bot tasks run inside the same FastAPI process as `asyncio.create_task()`.

```
FastAPI app (port 8000)
├── /api/v1/* — REST API routes
├── /whatsapp/* — WhatsApp webhooks
├── /voice/* — Daily.co session creation
└── background tasks: Pipecat bot workers
```

**Pros:** Simple, single process, shared state
**Cons:** Bot CPU/memory competes with API, harder to scale independently

#### Option B: Separate Pipecat Service (Production)
Pipecat runs as its own FastAPI app on a different port.

```
FastAPI Main App (port 8000)    Pipecat Service (port 8001)
├── /api/v1/*                   ├── /voice/start
├── /whatsapp/text-webhook      ├── /whatsapp/voice-webhook
└── database, auth, etc.        └── bot workers
```

**Pros:** Independent scaling, isolated failures
**Cons:** More deployment complexity

---

## Option A: Integrated Architecture (for Hackathon)

```python
# backend/src/app/main.py
from contextlib import asynccontextmanager
import aiohttp
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.api.v1.routes.user import router as user_router
from src.app.voice.whatsapp_text import router as whatsapp_text_router
from src.app.voice.whatsapp_voice import setup_whatsapp_voice, whatsapp_voice_router
from src.app.voice.browser_voice import router as browser_voice_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — initialize shared resources
    app.state.http_session = aiohttp.ClientSession()
    await setup_whatsapp_voice(app.state.http_session)
    yield
    # Shutdown
    await app.state.http_session.close()


app = FastAPI(title="AgentShop API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes
app.include_router(user_router, prefix="/api/v1")

# Voice routes
app.include_router(whatsapp_voice_router)   # POST /whatsapp/voice-webhook
app.include_router(whatsapp_text_router)    # POST /whatsapp/text-webhook
app.include_router(browser_voice_router)    # POST /voice/session
```

---

## Browser Voice Session — Daily.co Flow

When user clicks "Voice" in the browser, the frontend requests a Daily room, then connects WebRTC.

```python
# backend/src/app/voice/browser_voice.py
import asyncio
import os
import httpx
from fastapi import APIRouter, Depends
from pipecat.transports.services.daily import DailyTransport, DailyParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.worker import PipelineWorker

from src.app.api.v1.models.users import User
from src.app.voice.shopping_pipeline import build_shopping_pipeline

router = APIRouter(prefix="/voice", tags=["Voice"])


async def create_daily_room() -> dict:
    """Create a Daily.co room and participant token."""
    async with httpx.AsyncClient() as client:
        # Create room
        room_resp = await client.post(
            "https://api.daily.co/v1/rooms",
            headers={"Authorization": f"Bearer {os.environ['DAILY_API_KEY']}"},
            json={"properties": {"max_participants": 2, "exp": 3600}}
        )
        room = room_resp.json()
        
        # Create participant token for user
        token_resp = await client.post(
            "https://api.daily.co/v1/meeting-tokens",
            headers={"Authorization": f"Bearer {os.environ['DAILY_API_KEY']}"},
            json={"properties": {"room_name": room["name"], "is_owner": False}}
        )
        token = token_resp.json()
        
        # Create bot token
        bot_token_resp = await client.post(
            "https://api.daily.co/v1/meeting-tokens",
            headers={"Authorization": f"Bearer {os.environ['DAILY_API_KEY']}"},
            json={"properties": {"room_name": room["name"], "is_owner": True}}
        )
        bot_token = bot_token_resp.json()
        
    return {
        "room_url": room["url"],
        "user_token": token["token"],
        "bot_token": bot_token["token"],
        "room_name": room["name"],
    }


@router.post("/session")
async def start_voice_session(current_user: User = Depends(get_current_user)):
    """Start a voice session for the browser. Returns Daily room credentials."""
    
    room = await create_daily_room()
    
    # Spawn bot in background
    asyncio.create_task(
        run_browser_bot(
            room_url=room["room_url"],
            bot_token=room["bot_token"],
            user_id=current_user.id,
        )
    )
    
    return {
        "room_url": room["room_url"],
        "token": room["user_token"],   # frontend uses this to join
    }


async def run_browser_bot(room_url: str, bot_token: str, user_id: str):
    """Run the shopping bot for a browser voice session."""
    
    transport = DailyTransport(
        room_url,
        bot_token,
        "ShopBot",
        DailyParams(
            audio_out_enabled=True,
            vad_enabled=True,
        )
    )
    
    pipeline = await build_shopping_pipeline(transport, user_id=user_id)
    
    worker = PipelineWorker(
        pipeline,
        app_resources={"user_id": user_id}
    )
    
    runner = PipelineRunner()
    await runner.run(worker)
```

---

## Shared Shopping Pipeline Builder

```python
# backend/src/app/voice/shopping_pipeline.py
import os
from pipecat.pipeline.pipeline import Pipeline
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAILLMService
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.audio.filters.markdown import MarkdownTextFilter

from src.app.voice.tools import get_shopping_tools, SYSTEM_PROMPT


async def build_shopping_pipeline(transport, user_id: str = None) -> Pipeline:
    """Build the standard shopping pipeline. Works with any transport."""
    
    stt = DeepgramSTTService(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        model="nova-2",
        punctuate=True,
        interim_results=True,
    )
    
    llm = OpenAILLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        model="gpt-4o",
    )
    
    tts = CartesiaTTSService(
        api_key=os.environ["CARTESIA_API_KEY"],
        voice_id=os.environ["CARTESIA_VOICE_ID"],
        text_filters=[MarkdownTextFilter()],  # strip **bold** etc.
    )
    
    # Load tools — optionally connect to MCP server
    tools = await get_shopping_tools(user_id=user_id)
    
    context = OpenAILLMContext(
        messages=[{"role": "system", "content": SYSTEM_PROMPT}],
        tools=tools,
    )
    context_aggregator = llm.create_context_aggregator(context)
    
    return Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])
```

---

## Shopping Tools Setup (with MCPClient)

```python
# backend/src/app/voice/tools.py
import os
from mcp.client.session_group import StreamableHttpParameters
from pipecat.mcp import MCPClient


SYSTEM_PROMPT = """
You are ShopBot, a voice shopping assistant for AgentShop.
Help users find products, add to cart, and place orders.

Voice rules:
- Be very concise — 1-2 sentences max
- Confirm before adding to cart  
- ALWAYS confirm before placing any order
- Mention only the product name and price when listing options
- Ask if user wants more details rather than reading all specs
- Use natural, conversational language
"""


async def get_shopping_tools(user_id: str = None, jwt_token: str = None):
    """Get shopping tools from MCP server or as direct functions."""
    
    if os.environ.get("USE_MCP_TOOLS") == "true":
        # Connect to our FastAPI MCP server
        mcp_client = MCPClient(
            server_params=StreamableHttpParameters(
                url=f"{os.environ['API_BASE_URL']}/mcp",
                headers={"Authorization": f"Bearer {jwt_token}"} if jwt_token else {}
            ),
            allowed_tools=[
                "search_products",
                "get_product_detail", 
                "add_to_cart",
                "view_cart",
                "place_order",
                "get_order_status",
                "get_recommendations",
            ]
        )
        return await mcp_client.tools()
    
    else:
        # Direct function tools (simpler for hackathon)
        from src.app.voice.direct_tools import (
            search_products, add_to_cart, view_cart,
            place_order, get_order_status, get_recommendations
        )
        return [search_products, add_to_cart, view_cart, place_order, get_order_status, get_recommendations]
```

---

## Frontend Integration (Next.js)

```typescript
// hooks/useVoice.ts
import { useCallback, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'

export function useVoice() {
  const [isConnected, setIsConnected] = useState(false)
  const [call, setCall] = useState(null)

  const startVoiceSession = useCallback(async () => {
    // 1. Get Daily room credentials from our API
    const res = await fetch('/api/v1/voice/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    const { room_url, token } = await res.json()

    // 2. Create Daily call object and join
    const callObj = DailyIframe.createCallObject()
    await callObj.join({ url: room_url, token })
    
    setCall(callObj)
    setIsConnected(true)
    
    callObj.on('left-meeting', () => setIsConnected(false))
  }, [])

  const endVoiceSession = useCallback(async () => {
    if (call) await call.leave()
    setIsConnected(false)
  }, [call])

  return { isConnected, startVoiceSession, endVoiceSession }
}
```

---

## Environment Variables — Complete List for Voice

```env
# Daily.co (browser voice)
DAILY_API_KEY=...

# WhatsApp (voice calls)
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN=my_secret
WHATSAPP_APP_SECRET=...

# STT
DEEPGRAM_API_KEY=...

# LLM
OPENAI_API_KEY=...

# TTS
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=...

# MCP integration
USE_MCP_TOOLS=true
API_BASE_URL=http://localhost:8000
```

---

## Install Summary

```bash
# All Pipecat dependencies for our project
uv add "pipecat-ai[daily,openai,deepgram,cartesia,webrtc]"
uv add pipecat-mcp-transport   # if using MCP transport
uv add httpx aiohttp           # HTTP clients for tool handlers
```

---

## Implementation Order (Hackathon Sprint)

| Step | Task | Time |
|---|---|---|
| 1 | Basic Pipecat pipeline with Daily transport | 1h |
| 2 | STT + LLM + TTS working in browser | 1h |
| 3 | Add search_products tool (direct function) | 1h |
| 4 | Add cart + order tools | 1h |
| 5 | Connect tools to FastAPI via MCPClient | 1h |
| 6 | WhatsApp voice webhook + bot | 2h |
| 7 | Frontend voice UI (Daily SDK) | 1h |
| 8 | Polish, error handling, voice prompts | 1h |
