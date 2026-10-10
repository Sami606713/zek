#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""server - Pipecat Voice Agent

Agentic E-Commerce voice bot for AgentShop.
Cascade pipeline: Speech-to-Text → LLM → Text-to-Speech

Services:
- Deepgram  (STT)
- Agnes     (LLM — OpenAI-compatible)
- Cartesia  (TTS)
- MCP       (shopping tools via FastAPI MCP server)

Run::
    uv run bot.py
"""

import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from mcp.client.session_group import StreamableHttpParameters

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.mcp_service import MCPClient
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner

# ── Load .env from server/ folder ─────────────────────────────────────────────
load_dotenv(override=True)

# ── MCP client — connects to our FastAPI MCP server ───────────────────────────
mcp = MCPClient(
    server_params=StreamableHttpParameters(
        url=os.getenv("MCP_URL", "http://127.0.0.1:2024/mcp"),
        headers=None,
        timeout=5,
        sse_read_timeout=300,
        terminate_on_close=True,
    )
)


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    """Run the voice bot pipeline for one session."""
    logger.info("Starting AgentShop voice bot")

    # ── STT: Deepgram ─────────────────────────────────────────────────────────
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    # ── TTS: Cartesia ─────────────────────────────────────────────────────────
    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        settings=CartesiaTTSService.Settings(
            voice=os.getenv("CARTESIA_VOICE_ID", "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"),
        ),
    )

    # ── LLM: Agnes via OpenAI-compatible API ──────────────────────────────────
    llm = OpenAILLMService(
        api_key=os.getenv("AGNES_API_KEY"),
        base_url=os.getenv("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1"),
        settings=OpenAILLMService.Settings(
            model=os.getenv("AGNES_MODEL", "agnes-3.0-flash"),
            system_instruction=(
                "You are ShopBot, an AI voice shopping assistant for AgentShop. "
                "Help customers find products, compare options, add to cart, and place orders. "
                "Your responses will be spoken aloud — avoid emojis, bullet points, markdown, "
                "or any formatting that cannot be spoken. "
                "Keep responses short and conversational (1-2 sentences max per turn). "
                "Always confirm before adding anything to the cart. "
                "Always confirm before placing any order. "
                "Be warm, helpful, and friendly."
            ),
        ),
    )

    # ── Context + MCP tools ───────────────────────────────────────────────────
    context = LLMContext(
        messages=[
            {
                "role": "developer",
                "content": (
                    "You are a helpful voice shopping assistant. "
                    "You have access to shopping tools via MCP. "
                    "Keep all responses brief and conversational."
                ),
            }
        ],
        tools=await mcp.tools(),
    )

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    # ── Pipeline ──────────────────────────────────────────────────────────────
    pipeline = Pipeline(
        [
            transport.input(),       # audio/video from browser
            stt,                     # speech → text
            user_aggregator,         # accumulate user turns
            llm,                     # generate response + tool calls
            tts,                     # text → speech
            transport.output(),      # audio/video to browser
            assistant_aggregator,    # accumulate bot turns
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=[],
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)

    # ── Greet on client ready ─────────────────────────────────────────────────
    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        context.add_message(
            {
                "role": "developer",
                "content": (
                    "The customer just connected. "
                    "Greet them warmly as ShopBot and ask how you can help them shop today."
                ),
            }
        )
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await runner.cancel()

    await runner.run()


async def bot(runner_args: RunnerArguments):
    """Main bot entry point — called by the Pipecat runner."""

    transport_params = {
        "webrtc": lambda: TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            video_in_enabled=True,   # video input enabled for multimodal
        ),
    }

    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
