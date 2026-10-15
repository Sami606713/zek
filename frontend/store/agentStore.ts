import { create } from "zustand";

// UI state for the chat panel. The conversation itself lives in useStream
// (LangGraph thread); this store only tracks visibility, the thread id and
// a prompt waiting to be sent when the panel opens.
//
// The thread id is saved per account ("zek-agent-thread:<user id>" or
// ":guest"), so logging out or signing in as someone else on the same browser
// never shows another person's conversation.
const LEGACY_KEY = "zek-agent-thread"; // old browser-wide key, owner unknown
const keyFor = (owner: string) => `${LEGACY_KEY}:${owner}`;

const storage = {
  get: (key: string) => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      // storage blocked; the chat still works for this page view
    }
  },
};

type AgentState = {
  open: boolean;
  /** Who the current chat belongs to: a user id, "guest", or null before the session loads. */
  owner: string | null;
  threadId: string | null;
  pendingPrompt: string | null;
  lastPrompt: string | null;
  setLastPrompt: (prompt: string) => void;
  openPanel: (prompt?: string) => void;
  closePanel: () => void;
  takePrompt: () => string | null;
  setThreadId: (id: string | null) => void;
  /** Switch to this account's own chat (on load, login, logout or account switch). */
  setOwner: (owner: string) => void;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  open: false,
  owner: null,
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
    const { owner } = get();
    if (owner) storage.set(keyFor(owner), id);
    set({ threadId: id });
  },

  setOwner: (owner) => {
    if (owner === get().owner) return;
    // The old shared key can't be traced to an account, so it's dropped rather than shown to anyone.
    storage.set(LEGACY_KEY, null);
    set({ owner, threadId: storage.get(keyFor(owner)), lastPrompt: null });
  },
}));
