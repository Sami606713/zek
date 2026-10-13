"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStream } from "@langchain/react";
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { ArrowClockwise, Sparkle, WarningCircle, WhatsappLogo, X } from "@phosphor-icons/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatProductList, type ChatProduct } from "./ChatProductCard";
import { AGENT_API_URL, AGENT_ASSISTANT_ID } from "@/lib/agent/config";
import { useAgentStore } from "@/store/agentStore";
import { useUserStore } from "@/store/userStore";

const suggestions = [
  "A film camera for a beginner",
  "Gift ideas under $50",
  "Wireless keyboard for my desk",
  "Where is my order?",
];

// ─── Product cards for tool results ──────────────────────────────────────────

// Pull products out of a tool result (JSON string, arrays or nested objects).
function productsFrom(output: unknown): ChatProduct[] {
  const found: ChatProduct[] = [];
  const seen = new Set<string>();

  const visit = (v: unknown, depth: number) => {
    if (depth > 5 || found.length >= 12 || v == null) return;
    if (typeof v === "string") {
      if (/^[[{]/.test(v.trim())) {
        try {
          visit(JSON.parse(v), depth + 1);
        } catch {
          /* plain text output */
        }
      }
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.name === "string" && typeof o.slug === "string" && o.price !== undefined) {
        if (!seen.has(o.slug)) {
          seen.add(o.slug);
          found.push(o as unknown as ChatProduct);
        }
        return;
      }
      Object.values(o).forEach((x) => visit(x, depth + 1));
    }
  };

  visit(output, 0);
  return found;
}

// ─── Message rendering ───────────────────────────────────────────────────────

function reasoningOf(msg: AIMessage) {
  try {
    return msg.contentBlocks
      .filter((b) => b.type === "reasoning")
      .map((b) => (b as { reasoning?: string }).reasoning ?? "")
      .join("\n");
  } catch {
    return "";
  }
}

function AssistantTurn({
  msg,
  results,
  streaming,
}: {
  msg: AIMessage;
  results: Map<string, ToolMessage>;
  streaming: boolean;
}) {
  const reasoning = reasoningOf(msg);
  const text = msg.text;

  return (
    <div className="flex flex-col gap-3">
      {reasoning && (
        <Reasoning isStreaming={streaming && !text}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoning}</ReasoningContent>
        </Reasoning>
      )}

      {(msg.tool_calls ?? []).map((tc, i) => {
        const result = tc.id ? results.get(tc.id) : undefined;
        const output = result ? (result.text || result.content) : undefined;
        const products = result ? productsFrom(result.content) : [];
        const failed = result?.status === "error";
        if (products.length > 0) {
          return <ChatProductList key={tc.id ?? i} products={products} />;
        }
        return (
          <Tool key={tc.id ?? i}>
            <ToolHeader
              type="dynamic-tool"
              toolName={tc.name}
              title={tc.name.replace(/_/g, " ")}
              state={failed ? "output-error" : result ? "output-available" : "input-available"}
            />
            <ToolContent>
              <ToolInput input={tc.args} />
              {result && (
                <ToolOutput output={failed ? undefined : output} errorText={failed ? String(output) : undefined} />
              )}
            </ToolContent>
          </Tool>
        );
      })}

      {text && (
        <Message from="assistant">
          <MessageContent>
            <MessageResponse>{text}</MessageResponse>
          </MessageContent>
        </Message>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function AgentPanel() {
  const open = useAgentStore((s) => s.open);
  const threadId = useAgentStore((s) => s.threadId);
  const setThreadId = useAgentStore((s) => s.setThreadId);
  const closePanel = useAgentStore((s) => s.closePanel);
  const takePrompt = useAgentStore((s) => s.takePrompt);
  const pendingPrompt = useAgentStore((s) => s.pendingPrompt);
  const hydrate = useAgentStore((s) => s.hydrate);
  const lastPrompt = useAgentStore((s) => s.lastPrompt);
  const setLastPrompt = useAgentStore((s) => s.setLastPrompt);

  useEffect(() => hydrate(), [hydrate]);

  // The stream stays mounted while the panel is closed, so a reply keeps
  // arriving and the conversation survives page changes.
  const stream = useStream({
    apiUrl: AGENT_API_URL,
    assistantId: AGENT_ASSISTANT_ID,
    threadId,
    onThreadId: setThreadId,
    // Fail fast when the agent server is down so the Retry message shows up.
    maxReconnectAttempts: 2,
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!t || stream.isLoading) return;
    setLastPrompt(t);
    // The agent reads the shopper's JWT from its runtime context (ZekContext.token).
    // LangGraph copies config.configurable into context when no context is sent.
    // Read it at send time so a fresh login or token refresh is picked up.
    const token = useUserStore.getState().user?.token ?? "";
    void stream.submit(
      { messages: [{ type: "human", content: t }] },
      { config: { configurable: { token } } },
    );
  };

  // Send a prompt handed over by the hero ask-bar or another "Ask ZEK" trigger.
  useEffect(() => {
    if (!open || !pendingPrompt || stream.isLoading) return;
    const prompt = takePrompt();
    if (prompt) send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt, stream.isLoading]);

  // Escape closes; focus returns to whatever opened the panel.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("#agent-panel textarea")?.focus(), 250);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [open, closePanel]);

  const messages = stream.messages as BaseMessage[];
  const results = new Map<string, ToolMessage>();
  for (const m of messages) if (ToolMessage.isInstance(m)) results.set(m.tool_call_id, m);
  const last = messages[messages.length - 1];
  const waiting = stream.isLoading && (!last || HumanMessage.isInstance(last) || ToolMessage.isInstance(last));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="agent-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closePanel}
            className="fixed inset-0 z-50 bg-[#0e0f12]/30 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.aside
            key="agent-panel"
            id="agent-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Chat with ZEK"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden bg-bg shadow-soft md:inset-y-3 md:right-3 md:w-[460px] md:rounded-panel md:border md:border-line"
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-ink">
                <Sparkle size={16} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-ink">ZEK</h2>
                <p className="text-[12px] text-subtle">{stream.isLoading ? "Working on it" : "Shopping assistant"}</p>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    void stream.stop();
                    setThreadId(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-subtle transition hover:bg-surface-2 hover:text-ink"
                >
                  <ArrowClockwise size={14} /> New chat
                </button>
              )}
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close chat"
                className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </header>

            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="gap-5 px-4 py-6">
                {messages.length === 0 && !stream.isLoading ? (
                  <div className="flex min-h-[50dvh] flex-col justify-end gap-5 md:min-h-[60vh]">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-ink">What are you looking for?</h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-subtle">
                        Describe it in your own words. Add a budget and I&rsquo;ll stick to it.
                      </p>
                    </div>
                    <Suggestions>
                      {suggestions.map((s) => (
                        <Suggestion key={s} suggestion={s} onClick={send} className="rounded-full" />
                      ))}
                    </Suggestions>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    if (HumanMessage.isInstance(msg)) {
                      return (
                        <Message key={msg.id ?? i} from="user">
                          <MessageContent>{msg.text}</MessageContent>
                        </Message>
                      );
                    }
                    if (AIMessage.isInstance(msg)) {
                      return (
                        <AssistantTurn
                          key={msg.id ?? i}
                          msg={msg}
                          results={results}
                          streaming={stream.isLoading && i === messages.length - 1}
                        />
                      );
                    }
                    return null;
                  })
                )}

                {waiting && <Shimmer className="text-[14px]">Looking through the store…</Shimmer>}

                {Boolean(stream.error) && !stream.isLoading && (
                  <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[14px] text-ink">
                    <WarningCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">ZEK couldn&rsquo;t reply.</p>
                      <p className="mt-0.5 text-[13px] text-subtle">
                        Check that the agent server is running at {AGENT_API_URL}.
                      </p>
                    </div>
                    {lastPrompt && (
                      <button
                        type="button"
                        onClick={() => send(lastPrompt)}
                        className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="border-t border-line px-4 pb-4 pt-3">
              <PromptInput onSubmit={({ text }) => send(text)}>
                <PromptInputBody>
                  <PromptInputTextarea placeholder="Ask for anything in the store" aria-label="Message ZEK" />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <a
                      href="https://wa.me/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-subtle hover:text-ink"
                    >
                      <WhatsappLogo size={14} /> Continue on WhatsApp
                    </a>
                  </PromptInputTools>
                  <PromptInputSubmit
                    status={stream.isLoading ? "streaming" : stream.error ? "error" : "ready"}
                    onStop={() => void stream.stop()}
                  />
                </PromptInputFooter>
              </PromptInput>
              <p className="mt-2 px-1 text-[12px] text-subtle">ZEK can make mistakes. Check details before you buy.</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
