# Pipecat Research — 05: WhatsApp Integration
## For: Agentic E-Commerce Hackathon

---

## Overview

Pipecat has **native WhatsApp voice call support** via `WhatsAppTransport`. When a user calls your WhatsApp Business number, Pipecat handles the WebRTC signaling and runs a full voice pipeline.

**What this enables:**
- User calls WhatsApp Business number → talks to ShopBot by voice
- Same shopping pipeline as the browser (search, cart, order)
- No extra infrastructure — same Pipecat code, different transport

**What it does NOT cover:** WhatsApp text messages and voice notes (those are handled via the WhatsApp Cloud API webhook directly in FastAPI — separate from Pipecat).

---

## Setup Requirements

### 1. Meta Developer Console Setup
1. Create a Meta Business App at https://developers.facebook.com
2. Add WhatsApp product to your app
3. Get a phone number with **voice calling capability** enabled
4. Set up a webhook URL (needs public HTTPS — use ngrok for local dev)
5. Get `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`

### 2. Install
```bash
uv add "pipecat-ai[webrtc]"   # WhatsApp uses SmallWebRTC internally
```

---

## WhatsApp Voice Bot — Complete Implementation

```python
# backend/app/voice/whatsapp_voice.py
import asyncio
import os
import aiohttp
from fastapi import FastAPI, Request, Query, HTTPException
from pipecat.transports.services.whatsapp import WhatsAppTransport, WhatsAppClient
from pipecat.transports.network.small_webrtc import SmallWebRTCTransport, SmallWebRTCParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.worker import PipelineWorker
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAILLMService
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

from src.app.voice.tools import SHOPPING_TOOLS, SYSTEM_PROMPT

app = FastAPI()

# Shared aiohttp session
_http_session: aiohttp.ClientSession = None
whatsapp_client: WhatsAppClient = None


@app.on_event("startup")
async def startup():
    global _http_session, whatsapp_client
    _http_session = aiohttp.ClientSession()
    whatsapp_client = WhatsAppClient(
        token=os.environ["WHATSAPP_TOKEN"],
        phone_number_id=os.environ["WHATSAPP_PHONE_NUMBER_ID"],
        session=_http_session,
        app_secret=os.environ.get("WHATSAPP_APP_SECRET"),
    )


@app.on_event("shutdown")
async def shutdown():
    await whatsapp_client.terminate_all_calls()
    await _http_session.close()


# ── Webhook verification (GET) ────────────────────────────────────────────────

@app.get("/whatsapp/voice-webhook")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token")
):
    if hub_verify_token == os.environ["WHATSAPP_WEBHOOK_VERIFICATION_TOKEN"]:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Invalid verify token")


# ── Incoming call webhook (POST) ─────────────────────────────────────────────

@app.post("/whatsapp/voice-webhook")
async def handle_webhook(request: Request):
    body = await request.json()
    
    async def on_call_connected(connection, call_data):
        """Called when WhatsApp establishes WebRTC connection with caller."""
        asyncio.create_task(
            run_shopping_bot(connection, call_data)
        )
    
    await whatsapp_client.handle_webhook(body, on_call_connected)
    return {"status": "ok"}


# ── Shopping bot pipeline ─────────────────────────────────────────────────────

async def run_shopping_bot(connection, call_data):
    """Create and run a full shopping voice pipeline for one WhatsApp call."""
    
    # Transport — SmallWebRTC connection from WhatsApp
    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=SmallWebRTCParams(
            audio_out_enabled=True,
            vad_enabled=True,
        )
    )

    # STT — Deepgram streaming
    stt = DeepgramSTTService(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        model="nova-2",
        punctuate=True,
        interim_results=True,
    )

    # LLM — GPT-4o with shopping tools
    llm = OpenAILLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        model="gpt-4o",
    )

    # TTS — Cartesia
    tts = CartesiaTTSService(
        api_key=os.environ["CARTESIA_API_KEY"],
        voice_id=os.environ["CARTESIA_VOICE_ID"],
    )

    # Context with tools and system prompt
    context = OpenAILLMContext(
        messages=[{"role": "system", "content": SYSTEM_PROMPT}],
        tools=SHOPPING_TOOLS,
    )
    context_aggregator = llm.create_context_aggregator(context)

    # Pipeline
    pipeline = Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])

    # Worker with user context
    worker = PipelineWorker(
        pipeline,
        app_resources={
            "user_phone": call_data.From,
            "call_id": call_data.id,
        }
    )

    runner = PipelineRunner()
    
    # Greet the caller
    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        from pipecat.frames.frames import LLMMessagesFrame
        await worker.queue_frame(LLMMessagesFrame([{
            "role": "system",
            "content": f"The customer just called. Greet them warmly and ask how you can help them shop today."
        }]))
    
    await runner.run(worker)
```

---

## WhatsApp Text Messages (Separate — FastAPI Direct)

Text messages on WhatsApp don't go through Pipecat. They hit the webhook directly and we process them in FastAPI, routing to the LangChain shopping agent.

```python
# backend/app/api/v1/routes/whatsapp.py
@router.post("/webhook")
async def receive_whatsapp_message(request: Request):
    body = await request.json()
    
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            messages = change.get("value", {}).get("messages", [])
            for message in messages:
                msg_type = message["type"]
                from_number = message["from"]
                
                if msg_type == "text":
                    # Route to LangChain agent
                    user_text = message["text"]["body"]
                    response = await langchain_agent.ainvoke(
                        {"input": user_text},
                        session_id=f"wa:{from_number}"
                    )
                    await send_whatsapp_text(from_number, response["output"])
                
                elif msg_type == "audio":
                    # Download voice note → Deepgram STT → LangChain
                    audio_url = await get_media_url(message["audio"]["id"])
                    text = await transcribe_with_deepgram(audio_url)
                    response = await langchain_agent.ainvoke(
                        {"input": text},
                        session_id=f"wa:{from_number}"
                    )
                    await send_whatsapp_text(from_number, response["output"])
                
                elif msg_type == "interactive":
                    # Button/list selections
                    button_id = message["interactive"]["button_reply"]["id"]
                    await handle_button_action(from_number, button_id)
    
    return {"status": "ok"}
```

---

## WhatsApp Response Formatting

```python
async def send_whatsapp_text(to: str, text: str):
    """Send a plain text message."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text[:4096]}  # WA text limit
    }
    await _call_whatsapp_api(payload)


async def send_product_list_message(to: str, products: list[dict]):
    """Send products as a WhatsApp interactive list."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": "🛍️ Products Found"},
            "body": {"text": "Here are the best matches for you:"},
            "footer": {"text": "Tap to view details"},
            "action": {
                "button": "View Products",
                "sections": [{
                    "title": "Search Results",
                    "rows": [
                        {
                            "id": f"product_{p['id']}",
                            "title": p["name"][:24],
                            "description": f"${p['price']} ⭐ {p['rating']}"
                        }
                        for p in products[:10]  # WA list limit = 10
                    ]
                }]
            }
        }
    }
    await _call_whatsapp_api(payload)


async def send_order_confirmation(to: str, order: dict):
    """Send order confirmation with track/continue buttons."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": (
                    f"✅ Order #{order['id'][:8]} placed!\n"
                    f"Total: ${order['total_price']:.2f}\n"
                    f"Est. delivery: {order['estimated_delivery']}"
                )
            },
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": f"track_{order['id']}", "title": "Track Order"}},
                    {"type": "reply", "reply": {"id": "keep_shopping", "title": "Keep Shopping"}}
                ]
            }
        }
    }
    await _call_whatsapp_api(payload)
```

---

## Local Development with ngrok

Meta requires a public HTTPS URL for webhooks. For local dev:

```bash
# Install ngrok, then:
ngrok http 8000

# Copy the https URL (e.g. https://abc123.ngrok.io)
# Set in Meta Developer Console:
# Webhook URL: https://abc123.ngrok.io/api/v1/whatsapp/voice-webhook
# Subscribe to: messages, calls
```

---

## Env Variables

```env
WHATSAPP_TOKEN=EAAxxxxx...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN=my_secret_verify_token
WHATSAPP_APP_SECRET=abc123...   # for HMAC webhook validation

DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=...
```

---

## Key Limitations / Notes

1. **WhatsApp only supports SHA-256 SDP fingerprints** — Pipecat's WhatsAppClient automatically filters incompatible ones
2. **Voice calls only** — Pipecat handles voice. Text/image messages go through FastAPI directly
3. **One bot instance per call** — each incoming call creates its own pipeline worker
4. **Session cleanup** — call `terminate_all_calls()` on shutdown to avoid orphaned sessions
5. **ngrok for dev** — Meta won't send webhooks to localhost; must be public HTTPS
6. **Phone number must have calling enabled** — not all WhatsApp Business numbers support voice by default
