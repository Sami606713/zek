import { create } from "zustand";

// UI state for the chat panel. The conversation itself lives in useStream
// (LangGraph thread); this store only tracks visibility, the thread id and
// a prompt waiting to be sent when the panel opens.
const THREAD_KEY = "zek-agent-thread";

const readThread = () => {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(THREAD_KEY);
  } catch {
    return null;
  }
};

type AgentState = {
  open: boolean;
  threadId: string | null;
  pendingPrompt: string | null;
  lastPrompt: string | null;
  setLastPrompt: (prompt: string) => void;
  openPanel: (prompt?: string) => void;
  closePanel: () => void;
  takePrompt: () => string | null;
  setThreadId: (id: string | null) => void;
  hydrate: () => void;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  open: false,
  threadId: null,
  pendingPrompt: null,
  lastPrompt: null,

  setLastPrompt: (prompt) => set({ lastPrompt: prompt }),
  openPanel: (prompt) => set({ open: true, pendingPrompt: prompt?.trim() || null }),
  closePanel: () => set({ open: false }),

  takePrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt) set({ pendingPrompt: null });
    return prompt;
  },

  setThreadId: (id) => {
    try {
      if (id) localStorage.setItem(THREAD_KEY, id);
      else localStorage.removeItem(THREAD_KEY);
    } catch {
      // storage blocked; the chat still works for this page view
    }
    set({ threadId: id });
  },

  // Restore the last conversation after mount (keeps SSR markup stable).
  hydrate: () => set({ threadId: readThread() }),
}));
