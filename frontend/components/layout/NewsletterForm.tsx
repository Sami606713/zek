"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";

type Status = "idle" | "loading" | "error" | "done";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    // TODO: POST to /api/newsletter once the BFF route exists.
    await new Promise((r) => setTimeout(r, 700));
    setStatus("done");
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-2">
      <label htmlFor="newsletter-email" className="text-[14px] font-medium text-ink">
        Email address
      </label>
      <AnimatePresence mode="wait" initial={false}>
        {status === "done" ? (
          <motion.p
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 py-3 text-[15px] text-ink"
            role="status"
          >
            <CheckCircle size={20} weight="fill" className="text-brand" />
            You are on the list. Check your inbox to confirm.
          </motion.p>
        ) : (
          <motion.div
            key="form"
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 rounded-full border bg-bg p-1.5 pl-5 transition focus-within:border-brand ${
              status === "error" ? "border-[#d93a3a]" : "border-line"
            }`}
          >
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="you@example.com"
              aria-invalid={status === "error"}
              aria-describedby="newsletter-help"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-subtle"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {status === "loading" ? "Joining" : "Join"}
              <ArrowRight size={14} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <p
        id="newsletter-help"
        className={`text-[13px] ${status === "error" ? "text-[#d93a3a] dark:text-[#ff8a8a]" : "text-subtle"}`}
      >
        {status === "error"
          ? "Enter a valid email address, like name@example.com."
          : "New drops and price alerts. One email a week, at most."}
      </p>
    </form>
  );
}
