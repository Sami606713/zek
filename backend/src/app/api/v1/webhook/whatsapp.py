import os
import asyncio
import json

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from src.app.agent.agent import zek_agent
from src.app.agent.context.context import ZekContext

router = APIRouter(
    prefix="/api/v1/webhooks/whatsapp",
    tags=["WhatsApp Webhook"],
)


VERIFY_TOKEN = os.getenv(
    "META_WHATSAPP_VERIFY_TOKEN",
    "thebotlab_whatsapp_verify",
)

WHATSAPP_TOKEN = os.getenv("ACCESS_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NBR_ID")


@router.get("")
async def verify_whatsapp(request: Request):
    params = request.query_params

    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    print("=== WHATSAPP VERIFICATION ===")
    print("Mode:", mode)
    print("Token:", token)
    print("Challenge:", challenge)

    if mode == "subscribe" and token == VERIFY_TOKEN:
        print("✅ Verification successful")
        return PlainTextResponse(
            challenge,
            status_code=200,
        )

    print("❌ Verification failed")

    return PlainTextResponse(
        "Forbidden",
        status_code=403,
    )


async def accept_call(call_id: str, sdp_answer: str):
    url = f"https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/calls"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "call_id": call_id,
        "action": "accept",
        "session": {
            "sdp_type": "answer",
            "sdp": sdp_answer,
        },
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        print(f"Accept call response: {response.status_code} {response.text}")


async def run_agent(user_text: str) -> str:
    result = await zek_agent.ainvoke(
        {"messages": [{"role": "user", "content": user_text}]},
        context=ZekContext(),
    )
    return result["messages"][-1].content


async def send_whatsapp_message(to: str, text: str):
    url = f"https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        print(f"Send message response: {response.status_code} {response.text}")


@router.post("")
async def whatsapp_webhook(request: Request):
    body = await request.json()

    print("📩 WhatsApp webhook received")
    print("Data:", body)

    try:
        value = body["entry"][0]["changes"][0]["value"]

        messages = value.get("messages", [])

        if not messages:
            print("No message in webhook")
            return {"status": "ignored"}

        message = messages[0]

        # Currently handle text messages only
        if message.get("type") != "text":
            print("Unsupported message type")
            return {"status": "ignored"}

        sender = message["from"]
        user_text = message["text"]["body"]

        print(f"👤 Customer: {user_text}")

        # Run AI agent and reply on WhatsApp
        reply = await run_agent(user_text)
        print(f"🤖 Agent: {reply}")

        await send_whatsapp_message(sender, reply)
        print("✅ Response sent")

        return {"status": "ok"}

    except Exception as e:
        print("❌ Webhook error:", repr(e))

        return {
            "status": "error",
            "message": str(e),
        }