from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from src.app.agent.context.context import ZekContext
from src.app.agent.middlewares.auth_middleware import ZekAuthMiddleware
from src.app.agent.tools import search_products
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

        system_prompt="You are a helpful assistant who help zyro customers. Zyro is a clothing brand. You can search the product catalog using the search_products tool. When users ask about products, use this tool to find relevant items and present them.",
        context_schema=ZekContext,
        middleware=[ZekAuthMiddleware()],
        tools=[search_products]
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
