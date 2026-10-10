# Pipecat Research — 01: Overview & Architecture
## For: Agentic E-Commerce Hackathon

---

## What is Pipecat?

Pipecat is an open-source Python framework for building real-time voice and multimodal AI agents. It orchestrates AI services (STT, LLM, TTS), network transports, and audio processing into a unified pipeline with ultra-low latency — typically completing a full speech-to-speech round trip in under 1 second.

**GitHub:** https://github.com/pipecat-ai/pipecat  
**Docs:** https://docs.pipecat.ai  
**Install:** `uv add "pipecat-ai[daily,openai,deepgram,cartesia]"`

---

## Why Pipecat for Agentic E-Commerce?

| Problem | Pipecat Solution |
|---|---|
| User wants to shop by voice | Real-time STT → LLM → TTS pipeline |
| Agent needs to search products mid-conversation | Function/tool calling built into LLM service |
| WhatsApp voice calls to shop | Native WhatsAppTransport |
| Phone calls to the shop | Twilio/Daily telephony integration |
| Browser voice shopping UI | WebRTC via Daily.co or SmallWebRTC |
| Connect to our FastAPI MCP tools | MCPClient connects Pipecat to any MCP server |

---

## Core Architecture: The 4 Concepts

### 1. Frames
Data packages that flow through the pipeline. Every piece of information is a frame:
- `InputAudioRawFrames` — raw microphone audio from user
- `TranscriptionFrame` — STT output (spoken text)
- `LLMTextFrame` — LLM token output
- `TTSAudioRawFrames` — synthesized speech audio
- `SystemFrames` — high-priority control signals (interruptions, end pipeline)

### 2. Frame Processors
Modular workers — each does one job:
- Receives specific frame types
- Processes data (transcribe / generate / synthesize)
- Pushes new frames downstream
- Passes through frames it doesn't handle (non-destructive)

### 3. Pipeline
Connects processors in sequence. Order is critical:
```
transport.input() → STT → LLM → TTS → transport.output()
```

### 4. Workers
A `PipelineWorker` runs a pipeline. It is the "agent." A `WorkerRunner` manages lifecycle and signals. Multiple workers can share a message bus (multi-agent).

---

## Full Voice Processing Flow

```
User speaks
    ↓
Browser/Phone captures audio (WebRTC/WebSocket)
    ↓
transport.input() → InputAudioRawFrames
    ↓
Silero VAD (built-in) → detects speech start/end
    ↓
Deepgram STT → TranscriptionFrame ("find me headphones")
    ↓
Context Aggregator → adds to conversation history
    ↓
OpenAI LLM → streams LLMTextFrames + tool calls
    ↓ (tool call detected)
    → search_products("headphones") → FastAPI/MCP
    → result returned to LLM
    ↓
LLM continues: "I found 3 great options..."
    ↓
Cartesia TTS → TTSAudioRawFrames (streaming, sentence by sentence)
    ↓
transport.output() → audio streamed back to user
    ↓
User hears response while LLM is still generating
```

**Key optimization:** TTS starts speaking the first sentence while LLM is still generating the rest. Parallel processing = ~200ms perceived latency.

---

## Installation Options (for our stack)

```bash
# Core + Web (browser shopping)
uv add "pipecat-ai[daily,openai,deepgram,cartesia,webrtc]"

# Add WhatsApp support
uv add "pipecat-ai[webrtc]"   # WhatsApp uses SmallWebRTC

# Add Twilio phone support
# Twilio serializer is built-in (no extra install)

# Add LangChain framework integration
uv add "pipecat-ai[langchain]"   # if available, else use MCPClient
```

---

## Frame Processing Lanes

| Lane | Frame Types | Priority |
|---|---|---|
| System lane | SystemFrames (interruptions, errors, audio input) | HIGH — never discarded |
| Non-system lane | DataFrames, ControlFrames (audio output, text) | Normal — ordered queue |

Interruption handling: when user speaks while bot is talking, SystemFrames cancel in-flight DataFrames (audio output stops, bot listens again).

---

## Key Design Principles for Our Build

1. **Processors are modular** — swap Deepgram for AssemblyAI without touching other code
2. **Pipeline order is strict** — STT before LLM, LLM before TTS, TTS before output
3. **Parallel processing** — TTS streams while LLM generates (low latency)
4. **Tool calls are seamless** — function results auto-injected into conversation context
5. **One bot = one pipeline worker** — each user call gets its own worker instance
