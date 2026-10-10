// LangGraph server running the ZEK agent (`langgraph dev` in /backend).
// assistantId is the graph name from backend/langgraph.json -> "graphs": { "chat": ... }
export const AGENT_API_URL = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://127.0.0.1:2024";
export const AGENT_ASSISTANT_ID = process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID ?? "chat";
