# Pipecat Research — 02: Transports
## For: Agentic E-Commerce Hackathon

---

## What is a Transport?

A transport is the communication layer between the user and the Pipecat bot. It handles:
- Receiving audio/video from users
- Sending synthesized audio back to users
- Managing connection lifecycle

Every pipeline needs exactly two transport methods:
```python
pipeline = Pipeline([
    transport.input(),   # receives user audio → InputAudioRawFrames
    stt,
    llm,
    tts,
    transport.output(),  # sends bot audio → user hears it
])
```

**Rule:** Client transport and server transport must be a matching pair. If your web client uses `DailyTransport`, your server pipeline must also use `DailyTransport`.

---

## Available Transports (relevant to our project)

### 1. Daily Transport — WebRTC (Primary for Browser)
**Best for:** Browser-based voice shopping UI  
**Install:** `uv add "pipecat-ai[daily]"`  
**How it works:** Daily.co manages WebRTC infrastructure — no DIY NAT traversal, media routing, or signaling. Enterprise-grade, globally distributed.

```python
from pipecat.transports.services.daily import DailyTransport, DailyParams

transport = DailyTransport(
    room_url,           # Daily.co room URL
    token,              # participant token
    "ShopBot",          # bot display name
    DailyParams(
        audio_out_enabled=True,
        vad_enabled=True,         # voice activity detection
        transcription_enabled=False,  # we use Deepgram STT
    )
)
```

**Features:**
- Bidirectional audio/video streams
- Participant management (know when user joins/leaves)
- Built-in NAT traversal + global routing
- PSTN integration (real phone calls via Daily phone numbers)
- Recording capabilities
- Telephony via SIP/PSTN

---

### 2. SmallWebRTC Transport — Direct WebRTC (Lightweight Browser)
**Best for:** Self-hosted WebRTC without Daily.co dependency  
**Install:** `uv add "pipecat-ai[webrtc]"`  
**How it works:** Peer-to-peer WebRTC connection, no third-party platform needed.

```python
from pipecat.transports.network.small_webrtc import SmallWebRTCTransport

transport = SmallWebRTCTransport(
    webrtc_connection=connection,
    params=SmallWebRTCParams(audio_out_enabled=True)
)
```

**Used by:** WhatsAppTransport internally (WhatsApp uses SmallWebRTC under the hood).

---

### 3. WhatsApp Transport — WhatsApp Voice Calls
**Best for:** Users calling via WhatsApp Business number  
**Install:** `uv add "pipecat-ai[webrtc]"` (uses SmallWebRTC)  
**How it works:** WhatsApp Business API sends webhook events when user calls → Pipecat accepts call → establishes WebRTC → runs voice pipeline

```python
from pipecat.transports.services.whatsapp import WhatsAppTransport, WhatsAppClient
import aiohttp

async with aiohttp.ClientSession() as session:
    whatsapp_client = WhatsAppClient(
        token=WHATSAPP_TOKEN,
        phone_number_id=WHATSAPP_PHONE_NUMBER_ID,
        session=session,
        app_secret=WHATSAPP_APP_SECRET,  # for webhook HMAC validation
    )
```

**Webhook flow:**
```
User calls WhatsApp Business number
    ↓
Meta sends POST to your webhook URL
    ↓
WhatsAppClient.handle_webhook(request_data)
    ↓
Establishes SmallWebRTCConnection
    ↓
Passes connection to bot with metadata:
    WhatsAppConnectCall(
        From="whatsapp:+1234567890",
        To="whatsapp:+0987654321",
        id="call_id",
        direction="inbound",
        timestamp=...
    )
    ↓
Bot pipeline runs with SmallWebRTCTransport
```

**Env vars needed:**
```env
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN=...
WHATSAPP_APP_SECRET=...    # optional but recommended
```

---

### 4. FastAPI WebSocket Transport — Server-to-Server / Telephony
**Best for:** Twilio phone calls, server-to-server  
**Install:** `uv add "pipecat-ai[websocket]"`  
**How it works:** WebSocket connection with FrameSerializer for telephony-specific audio encoding

```python
from pipecat.transports.network.fastapi_websocket import FastAPIWebsocketTransport
from pipecat.serializers.twilio import TwilioFrameSerializer

transport = FastAPIWebsocketTransport(
    websocket=websocket,
    params=FastAPIWebsocketParams(
        audio_out_enabled=True,
        serializer=TwilioFrameSerializer(stream_sid)
    )
)
```

**Built-in telephony serializers:** Twilio, Telnyx, Plivo, Vonage, Exotel, Genesys

---

### 5. LiveKit Transport
**Best for:** Enterprise deployments needing their own WebRTC infrastructure  
**Install:** `uv add "pipecat-ai[livekit]"`

---

## WebRTC vs WebSocket — Decision Guide

| Factor | WebRTC (Daily/SmallWebRTC) | WebSocket (FastAPI) |
|---|---|---|
| Latency | Ultra-low (UDP, optimized) | Higher (TCP, head-of-line blocking) |
| Audio quality | Echo cancellation, noise reduction, AGC | Manual implementation |
| Reconnection | Automatic | Manual |
| Best for | Browser, mobile, WhatsApp | Telephony (Twilio), prototyping |
| Network resilience | High (handles packet loss) | Low |

**Our choices:**
- Browser voice UI → **Daily Transport** (WebRTC)
- WhatsApp voice calls → **WhatsAppTransport** (SmallWebRTC)
- Phone calls (Twilio) → **FastAPI WebSocket** + TwilioSerializer

---

## Telephony Integration Paths

### Path A: Daily PSTN (Recommended)
```
User calls phone number → Daily.co PSTN → Daily room → DailyTransport → Pipeline
```
- Buy phone numbers directly from Daily
- Best audio quality (WebRTC end-to-end)
- Supports warm transfers, SIP

### Path B: Twilio + WebSocket
```
User calls Twilio number → Twilio webhook → FastAPI → WebSocket → Pipeline
```
- Use existing Twilio numbers
- WebSocket serializer (built-in)
- Good for Twilio Studio/Flex integration

### Path C: Daily + Twilio SIP (Hybrid)
```
User calls Twilio number → SIP forwarding → Daily room → DailyTransport → Pipeline
```
- Keeps existing Twilio numbers
- Gets WebRTC quality benefits
- More complex setup

---

## Transport Setup in FastAPI (Our Architecture)

```python
# FastAPI endpoint that spins up a bot per WhatsApp call
@app.post("/whatsapp/voice-webhook")
async def whatsapp_voice(request: Request):
    body = await request.json()
    
    async def connection_callback(connection, call_data):
        # Each call gets its own pipeline instance
        asyncio.create_task(run_shopping_bot(connection, call_data))
    
    await whatsapp_client.handle_webhook(body, connection_callback)
    return {"status": "ok"}

async def run_shopping_bot(connection, call_data):
    transport = SmallWebRTCTransport(webrtc_connection=connection)
    pipeline = create_shopping_pipeline(transport, call_data.From)
    runner = PipelineRunner()
    await runner.run(pipeline)
```
