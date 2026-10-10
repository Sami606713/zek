"use client";

import { useAgentStore } from "@/store/agentStore";

type AskZekButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  prompt?: string;
};

// Opens the chat panel in place instead of navigating to a new page.
export function AskZekButton({ prompt, onClick, children, ...props }: AskZekButtonProps) {
  const openPanel = useAgentStore((s) => s.openPanel);
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        openPanel(prompt);
      }}
    >
      {children}
    </button>
  );
}
