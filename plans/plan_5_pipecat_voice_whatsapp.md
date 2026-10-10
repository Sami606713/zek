# Plan 5: Pipecat Voice + WhatsApp Integration — Agentic E-Commerce

## Overview
This plan covers two real-time communication channels:
1. **Pipecat** — voice shopping via WebRTC (browser or phone call)
2. **WhatsApp** — text + voice message shopping via WhatsApp Business API

Both channels connect to the same LangChain shopping agent (Plan 3), giving users a unified experience across web voice, WhatsApp messages, and WhatsApp voice calls.

---

## Tech Stack
- **Voice Pipeline:** Pipecat (Python)
- **WebRTC:** Daily.co (Pipecat's default transport)
- **STT:** Deepgram (Speech-to-Text)
- **TTS:** ElevenLabs / Cartesia (Text-to-Speech)
- **LLM:** OpenAI GPT-4o (via Pipecat's LLM service)
- **WhatsApp:** WhatsApp Business Cloud API (Meta)
- **Webhook Server:** FastAPI (handles WhatsApp webhooks)
- **Phone Calls:** Twilio (optional — for phone-to-shop calls)

---

## Folder Structure
```
backend/app/voice/
├── __init__.py
├── pipecat_server.py             # Pipecat bot server
├── pipelines/
│   ├── shopping_pipeline.py      # Main voice shopping pipeline
│   └── whatsapp_voice_pipeline.py # WhatsApp voice note pipeline
├── services/
│   ├── stt_service.py            # Deepgram STT wrapper
│   ├── tts_service.py            # ElevenLabs TTS wrapper
│   └── agent_service.py          # Bridge to LangChain agent
└── whatsapp/
    ├── handler.py                # WhatsApp webhook handler
    ├── message_processor.py      # Process incoming WA messages
    ├── voice_processor.py        # Process WA voice notes
    └── response_builder.py       # Build WA response messages
```

---

## Part 1: Pipecat Voice Pipeline

### Architecture
```
Browser (WebRTC) ←→ Daily.co ←→ Pipecat Server
                                      ↓
                              Deepgram (STT)
                                      ↓
                          LangChain Shopping Agent
                                      ↓
                              ElevenLabs (TTS)
                                      ↓
                         Browser (audio playback)
```

### Main Pipeline
```python
# backend/app/voice/pipelines/shopping_pipeline.py
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.transports.services.daily import DailyTransport
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.openai import OpenAILLMService
from pipecat.processors.frameworks.langchain import LangchainProcessor

async def create_shopping_pipeline(room_url: str, token: str, user_id: str):
    transport = DailyTransport(
        room_url=room_url,
        token=token,
        bot_name="ShopBot",
        params=DailyParams(audio_out_enabled=True, vad_enabled=True)
    )

    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)
    
    tts = ElevenLabsTTSService(
        api_key=ELEVENLABS_API_KEY,
        voice_id="shopping_assistant_voice_id"
    )

    # Use LangChain agent as the LLM processor
    agent = LangchainProcessor(
        chain=get_shopping_agent(user_id=user_id)
    )

    pipeline = Pipeline([
        transport.input(),      # Receive audio from user
        stt,                    # Convert speech → text
        agent,                  # Process with shopping agent
        tts,                    # Convert response → speech
        transport.output()      # Send audio back to user
    ])

    return pipeline
```

### Pipecat Server (runs on separate port)
```python
# backend/app/voice/pipecat_server.py
from fastapi import FastAPI
import aiohttp

pipecat_app = FastAPI()

@pipecat_app.post("/start-voice-session")
async def start_voice_session(user_id: str, token: str = Depends(verify_token)):
    # Create Daily.co room
    room = await create_daily_room()
    
    # Start pipeline in background
    asyncio.create_task(
        run_pipeline(room.url, room.token, user_id)
    )
    
    return {
        "room_url": room.url,
        "token": room.participant_token
    }
```

### Frontend Voice Connection
```typescript
// hooks/useVoice.ts
import Daily from '@daily-co/daily-js';

export function useVoice(userId: string) {
    const startVoiceSession = async () => {
        // Get room credentials from Pipecat server
        const { room_url, token } = await api.post('/voice/start-voice-session');
        
        // Join Daily.co room
        const call = Daily.createCallObject();
        await call.join({ url: room_url, token });
        
        // Audio streams automatically — user speaks, bot responds
    };

    return { startVoiceSession };
}
```

---

## Part 2: WhatsApp Integration

### WhatsApp Message Flow
```
User sends WA message
        ↓
Meta → POST /api/v1/whatsapp/webhook
        ↓
FastAPI webhook handler
        ↓
message_processor.py determines type:
  - Text message → LangChain agent
  - Voice note  → Deepgram STT → LangChain agent
  - Image       → Vision model → LangChain agent
        ↓
Agent processes, calls tools (search, cart, order)
        ↓
response_builder formats reply:
  - Text: plain message or list message
  - Products: template message with images
  - Order confirm: interactive buttons
        ↓
Send via WhatsApp API
```

### Webhook Handler
```python
# backend/app/voice/whatsapp/handler.py
from fastapi import APIRouter, Request
import httpx

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token")
):
    """WhatsApp webhook verification"""
    if hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403)


@router.post("/webhook")
async def receive_message(request: Request):
    """Handle incoming WhatsApp messages"""
    body = await request.json()
    
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            messages = change.get("value", {}).get("messages", [])
            
            for message in messages:
                await process_message(message)
    
    return {"status": "ok"}
```

### Message Processor
```python
# backend/app/voice/whatsapp/message_processor.py
async def process_message(message: dict):
    msg_type = message["type"]
    from_number = message["from"]
    
    # Get or create user session
    session_id = f"whatsapp:{from_number}"
    user = await get_user_by_phone(from_number)
    
    if msg_type == "text":
        user_input = message["text"]["body"]
    
    elif msg_type == "audio":
        # Download voice note and transcribe
        audio_url = await get_media_url(message["audio"]["id"])
        user_input = await transcribe_audio(audio_url)  # Deepgram
    
    elif msg_type == "image":
        # Analyze image for product search
        image_url = await get_media_url(message["image"]["id"])
        user_input = await analyze_product_image(image_url)  # Vision model
    
    # Run through LangChain agent
    response = await shopping_agent.ainvoke(
        {"input": user_input},
        session_id=session_id,
        user_id=user.id if user else None
    )
    
    # Send response back via WhatsApp
    await send_whatsapp_response(from_number, response)
```

### Response Builder (WhatsApp-formatted replies)
```python
# backend/app/voice/whatsapp/response_builder.py

async def send_text_message(to: str, text: str):
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text}
    }
    await whatsapp_api_call(payload)

async def send_product_list(to: str, products: list[dict]):
    """Send products as WhatsApp list message"""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": "🛍️ Products Found"},
            "body": {"text": "Here are the best matches:"},
            "action": {
                "button": "View Products",
                "sections": [{
                    "title": "Results",
                    "rows": [
                        {"id": p["id"], "title": p["name"][:24], "description": f"${p['price']} ⭐ {p['rating']}"}
                        for p in products[:10]
                    ]
                }]
            }
        }
    }
    await whatsapp_api_call(payload)

async def send_order_confirmation(to: str, order: dict):
    """Send order confirmation with buttons"""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": f"Order #{order['id']} placed!\nTotal: ${order['total']}\nEstimated delivery: {order['delivery_date']}"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": f"track_{order['id']}", "title": "Track Order"}},
                    {"type": "reply", "reply": {"id": "continue_shopping", "title": "Keep Shopping"}}
                ]
            }
        }
    }
    await whatsapp_api_call(payload)
```

---

## WhatsApp Voice Call (via Twilio + Pipecat)
```
User calls WhatsApp Business number
        ↓
Twilio receives call → triggers webhook
        ↓
FastAPI creates Pipecat voice session
        ↓
Pipecat handles: STT → Agent → TTS
        ↓
User hears voice response in real-time
```

```python
@router.post("/whatsapp/voice-call")
async def handle_voice_call(From: str = Form(), CallSid: str = Form()):
    # Start Pipecat session for this caller
    session = await create_voice_session(phone=From, call_sid=CallSid)
    
    # Return TwiML to connect Twilio to Pipecat
    return Response(
        content=f'<Response><Connect><Stream url="wss://yourserver.com/voice/{session.id}"/></Connect></Response>',
        media_type="application/xml"
    )
```

---

## Environment Variables
```env
# Pipecat / Daily
DAILY_API_KEY=...
DAILY_API_URL=https://api.daily.co/v1

# STT / TTS
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

# WhatsApp
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...

# Twilio (optional, for voice calls)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

---

## Development Phases

| Phase | Tasks |
|-------|-------|
| Phase 1 | WhatsApp webhook setup + text message handling |
| Phase 2 | Connect WhatsApp text to LangChain agent |
| Phase 3 | WhatsApp voice note → Deepgram STT → Agent |
| Phase 4 | Rich WA replies (list messages, buttons) |
| Phase 5 | Pipecat server setup + Daily.co room creation |
| Phase 6 | Voice pipeline (STT → Agent → TTS) |
| Phase 7 | Frontend voice UI (WebRTC via Daily SDK) |
| Phase 8 | WhatsApp voice call via Twilio (optional) |

---

## Notes
- Test WhatsApp webhook locally using `ngrok` (Meta requires a public HTTPS URL)
- Pipecat runs as a separate service (different port from main FastAPI)
- Voice responses should be shorter than text responses — optimize agent prompts for voice
- WhatsApp image search is a powerful differentiator: user photos a product → agent finds similar items
- Keep WhatsApp session memory in Redis (same as web sessions)
