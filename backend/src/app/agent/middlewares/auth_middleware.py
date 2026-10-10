import asyncio
from typing import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.messages import ToolMessage
from langchain.tools.tool_node import ToolCallRequest
from langgraph.types import Command


class ZekAuthMiddleware(AgentMiddleware):
    def __init__(self):
        super().__init__()
        self._mcp_tools = []

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        mcp_tools = asyncio.run(self.get_mcp_tools())
        request = request.override(tools=[*request.tools, *mcp_tools])

        # runtime:
        runtime= request.runtime
        print("Runtime: ",runtime)
        return handler(request)

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        self._mcp_tools = await self.get_mcp_tools()
        request = request.override(tools=[*request.tools, *self._mcp_tools])

        # runtime:
        runtime= request.runtime
        print("Runtime: ",runtime)
        return await handler(request)

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        tool_name = request.tool_call["name"]
        tool = next((t for t in self._mcp_tools if t.name == tool_name), None)
        if tool:
            return handler(request.override(tool=tool))
        
         # runtime:
        runtime= request.runtime
        print("Runtime: ",runtime)
        return handler(request)

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        tool_name = request.tool_call["name"]
        tool = next((t for t in self._mcp_tools if t.name == tool_name), None)
        if tool:
            return await handler(request.override(tool=tool))
        
        # runtime:
        runtime= request.runtime
        print("Runtime: ",runtime)
        return await handler(request)

    async def get_mcp_tools(self):
        from langchain.mcp import MCPAdapter
        async with MCPAdapter("http://127.0.0.1:2024/mcp") as adapter:
            tools = await adapter.list_tools()
            # print("Tools: ", tools)
        return tools