from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from src.app.agent.context.context import ZekContext
from src.app.agent.middlewares.auth_middleware import ZekAuthMiddleware
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()

def create_zek_agent():
    model = ChatOpenAI(
        base_url="https://apihub.agnes-ai.com/v1",
        api_key=os.getenv("AGNES_API_KEY"),
        model="agnes-3.0-flash",
    )
    

    agent = create_agent(
        model=model,

        system_prompt="You are a helpful assistant who help zyro customers zyro is a clothing brand.",
        context_schema=ZekContext,
        middleware=[ZekAuthMiddleware()]
    )
    return agent




zek_agent = create_zek_agent()


if __name__ == "__main__":
    print("Running agent...")
    response = asyncio.run(zek_agent.ainvoke({
        "messages": [
            {
                "role": "user",
                "content": "i want to buy cap"
            }
        ]
    }))
    print("Response: ", response)
