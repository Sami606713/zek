# Pipecat Research — 03: STT & TTS Services
## For: Agentic E-Commerce Hackathon

---

## Speech-to-Text (STT)

### Two STT Service Types

#### Type 1: STTService (Streaming — Recommended)
- Maintains a persistent WebSocket to the provider
- Continuously streams audio for real-time transcription
- **Lower latency** — no per-request round trip
- Best for: Deepgram, AssemblyAI, Cartesia, Google

#### Type 2: SegmentedSTTService (HTTP-based)
- Uses local Silero VAD to detect speech chunks
- POSTs each chunk as a WAV file
- **Higher latency** — HTTP per segment
- Best for: OpenAI Whisper, Groq Whisper, local Moonshine

---

### Recommended STT Services for Our Project

#### Deepgram (Primary Recommendation)
**Why:** Best latency + accuracy for conversational voice, multilingual support, built-in VAD integration, widely used with Pipecat.

```python
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.transcriptions.language import Language

stt = DeepgramSTTService(
    api_key=os.environ["DEEPGRAM_API_KEY"],
    language=Language.EN,
    model="nova-2",           # best accuracy/speed balance
    punctuate=True,           # better LLM comprehension
    interim_results=True,     # faster interruption detection
)
```

**For multilingual (important for e-commerce):**
```python
stt = DeepgramSTTService(
    api_key=...,
    language="multi",   # auto-detect + multi-language
)
```

#### AssemblyAI (Alternative)
**Why:** Universal-Streaming API, excellent for noisy environments (users calling from stores, outside)
```python
from pipecat.services.assemblyai import AssemblyAISTTService
stt = AssemblyAISTTService(api_key=os.environ["ASSEMBLYAI_API_KEY"])
```

#### Cartesia STT (If using Cartesia TTS — unified billing)
```python
from pipecat.services.cartesia import CartesiaSTTService
stt = CartesiaSTTService(api_key=os.environ["CARTESIA_API_KEY"])
```

---

### STT Pipeline Placement (Critical)

```python
pipeline = Pipeline([
    transport.input(),    # ← STT must come AFTER this
    stt,                  # ← STT here
    context_aggregator.user(),
    llm,
    tts,
    transport.output(),
    context_aggregator.assistant(),
])
```

### STT Best Practices

```python
# 1. Use local Silero VAD (150-200ms faster than cloud VAD)
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import PipelineParams

await runner.run(
    PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        )
    )
)

# 2. Enable interim results for faster interruption detection
stt = DeepgramSTTService(
    ...,
    interim_results=True,   # signals context aggregator that more text is coming
)
```

---

## Text-to-Speech (TTS)

### TTS Processing Flow

1. LLM streams `LLMTextFrames` (tokens) to TTS
2. TTS aggregates into sentences (default `TextAggregationMode.SENTENCE`)
3. First sentence is synthesized → starts playing immediately
4. LLM continues generating sentence 2, 3... while user hears sentence 1
5. Result: ~200ms Time to First Audio (TTFA)

### Recommended TTS Services for Our Project

#### Cartesia (Primary Recommendation)
**Why:** Ultra-low latency, word timestamps (precise interruption handling), expressive voices, WebSocket streaming

```python
from pipecat.services.cartesia import CartesiaTTSService

tts = CartesiaTTSService(
    api_key=os.environ["CARTESIA_API_KEY"],
    voice_id="your_voice_id",    # shopping assistant voice
    model="sonic-2",             # best quality
    language="en",
)
```

**Word timestamps** (unique to Cartesia/ElevenLabs/Rime):
- Accurately captures which words were spoken if user interrupts
- Enables real-time subtitles in the browser UI
- Better context management during interruptions

#### ElevenLabs (Alternative — best voice quality)
**Why:** Most natural-sounding voices, emotion control, voice cloning (create custom brand voice)

```python
from pipecat.services.elevenlabs import ElevenLabsTTSService

tts = ElevenLabsTTSService(
    api_key=os.environ["ELEVENLABS_API_KEY"],
    voice_id="shopping_voice_id",
    model="eleven_turbo_v2",   # lowest latency model
)
```

#### OpenAI TTS (Simplest — if already using OpenAI)
```python
from pipecat.services.openai import OpenAITTSService

tts = OpenAITTSService(
    api_key=os.environ["OPENAI_API_KEY"],
    voice="nova",   # friendly, clear voice
    model="tts-1",
)
```

---

### TTS Pipeline Placement (Critical)

```python
pipeline = Pipeline([
    transport.input(),
    stt,
    context_aggregator.user(),
    llm,
    tts,                         # ← after LLM
    transport.output(),          # ← before output
    context_aggregator.assistant(), # ← after output (captures spoken text)
])
```

### TTS Configuration for Voice Commerce

```python
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.audio.filters.markdown import MarkdownTextFilter

tts = CartesiaTTSService(
    api_key=...,
    voice_id=...,
    # Filter markdown from LLM responses (don't say "asterisk asterisk")
    text_filters=[MarkdownTextFilter()],
)
```

**Why markdown filter matters:** Our LLM will return product lists with markdown (`**Sony WH-1000XM5**`). Without the filter, TTS will speak asterisks aloud.

### Voice Commerce Specific — Short Responses

The LLM system prompt should instruct the agent to keep voice responses short:
```
"When responding via voice, be concise. Say product names and prices.
Do not read out full specifications. Ask if user wants more details."
```

---

## Realtime LLMs (Speech-to-Speech — Advanced Option)

These are multi-modal models that skip STT→LLM→TTS entirely, taking audio in and outputting audio directly:

| Service | Pipecat Support | Notes |
|---|---|---|
| OpenAI GPT-4o Realtime | ✅ Built-in | Best quality, expensive |
| Gemini Live | ✅ Built-in | Good quality |
| AWS Nova Sonic | ✅ Built-in | AWS ecosystem |

**For hackathon:** Start with STT→LLM→TTS (more control, easier debugging). Realtime LLMs are harder to debug and tool calling is less reliable.

---

## Service Comparison Matrix

| Service | Latency | Quality | Cost | Tool Calling |
|---|---|---|---|---|
| Deepgram STT | ⚡ Lowest | ⭐⭐⭐⭐ | $$ | N/A |
| AssemblyAI | ⚡ Low | ⭐⭐⭐⭐⭐ | $$ | N/A |
| Cartesia TTS | ⚡ Lowest | ⭐⭐⭐⭐ | $$ | N/A |
| ElevenLabs TTS | ⚡ Low | ⭐⭐⭐⭐⭐ | $$$ | N/A |
| OpenAI TTS | Medium | ⭐⭐⭐⭐ | $$ | N/A |
| OpenAI GPT-4o | Medium | ⭐⭐⭐⭐⭐ | $$$ | ✅ Best |

---

## Recommended Stack for Our Project

```
STT:  Deepgram (nova-2, streaming)
LLM:  OpenAI GPT-4o (best tool calling)
TTS:  Cartesia (sonic-2, word timestamps)
VAD:  Silero (built-in, fastest)
Transport: Daily (browser) + SmallWebRTC (WhatsApp)
```

**Install:**
```bash
uv add "pipecat-ai[daily,openai,deepgram,cartesia,webrtc]"
```
