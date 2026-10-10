# Pipecat Research — Index
## Deep Research for Agentic E-Commerce Hackathon

---

## Research Files

| File | Contents |
|---|---|
| [01_overview.md](./01_overview.md) | What Pipecat is, 4 core concepts (Frames, Processors, Pipeline, Workers), full voice flow diagram |
| [02_transports.md](./02_transports.md) | All transport options — Daily (browser), SmallWebRTC, WhatsApp, Twilio WebSocket, decision guide |
| [03_stt_tts_services.md](./03_stt_tts_services.md) | STT (Deepgram, AssemblyAI) and TTS (Cartesia, ElevenLabs, OpenAI) with config examples |
| [04_function_calling_mcp.md](./04_function_calling_mcp.md) | Tool calling for shopping (search, cart, order), MCPClient integration, parallel tools |
| [05_whatsapp_integration.md](./05_whatsapp_integration.md) | WhatsApp voice bot complete code, text messages, response formatting, ngrok setup |
| [06_fastapi_integration.md](./06_fastapi_integration.md) | Full FastAPI + Pipecat integration, browser voice session, shared pipeline builder |

---

## TL;DR — Key Decisions

### Tech Stack (Chosen)
```
STT:      Deepgram nova-2 (streaming, lowest latency)
LLM:      OpenAI GPT-4o (best tool calling)
TTS:      Cartesia sonic-2 (ultra-low latency, word timestamps)
VAD:      Silero (built-in, 150ms faster than cloud VAD)
Browser:  Daily Transport (WebRTC, enterprise-grade)
WhatsApp: WhatsAppTransport → SmallWebRTC (native Pipecat)
Phone:    Twilio + WebSocket serializer (built-in)
Tools:    MCPClient → FastAPI MCP Server (single source of truth)
```

### Install
```bash
uv add "pipecat-ai[daily,openai,deepgram,cartesia,webrtc]"
```

### Pipeline Structure (Same for All Transports)
```python
Pipeline([
    transport.input(),
    DeepgramSTTService(...),
    context_aggregator.user(),
    OpenAILLMService(...),          # + tool calling
    CartesiaTTSService(...),
    transport.output(),
    context_aggregator.assistant(),
])
```

### Key Facts
1. **One pipeline worker per user call** — each call is isolated
2. **Tools auto-call FastAPI** — via MCPClient connecting to `/mcp` endpoint
3. **WhatsApp voice** — native `WhatsAppTransport`, needs WhatsApp Business API
4. **Voice responses must be short** — tune system prompt for voice
5. **Markdown filter** — always add `MarkdownTextFilter()` to TTS (LLM uses markdown)
6. **ngrok for local dev** — Meta webhooks need public HTTPS

---

## MCP ↔ Pipecat Relationship

```
Our FastAPI server exposes:
  /mcp  ← MCP server (tools: search, cart, order)
  
Pipecat MCPClient connects to:
  /mcp  ← auto-discovers all tools
  
Voice bot uses tools via:
  MCPClient.tools() → LLMContext(tools=...)
  
Result: one tool definition, two users:
  - LangChain agent (text chat)
  - Pipecat bot (voice / WhatsApp voice)
```

---

## Latency Budget (Target: <1 second round trip)

| Step | Typical Latency |
|---|---|
| Silero VAD (speech end detection) | ~50ms |
| Deepgram STT (final transcript) | ~150-300ms |
| OpenAI GPT-4o (first token) | ~300-500ms |
| Cartesia TTS (first audio chunk) | ~100-150ms |
| **Total: first audio to user** | **~600-1000ms** |

---

## Sources
- [Pipecat Official Docs](https://docs.pipecat.ai)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [WhatsApp Transport Docs](https://docs.pipecat.ai/api-reference/server/services/transport/whatsapp)
- [Function Calling Guide](https://docs.pipecat.ai/guides/learn/function-calling)
- [MCPClient Docs](https://docs.pipecat.ai/api-reference/server/utilities/mcp/mcp)
- [MCP Transport Docs](https://docs.pipecat.ai/api-reference/server/services/transport/mcp)
- [Supported Services](https://docs.pipecat.ai/api-reference/server/services/supported-services)
- [Transports Guide](https://docs.pipecat.ai/pipecat/learn/transports)
- [AssemblyAI + Pipecat Tutorial](https://www.assemblyai.com/blog/building-a-voice-agent-with-pipecat)
- [LangGraph + Pipecat Example](https://github.com/langchain-ai/pipecat-langgraph-example)
