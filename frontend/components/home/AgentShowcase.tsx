"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import {
  ArrowRight,
  ChatCircleText,
  Microphone,
  Sparkle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { agentDemoProduct, formatPrice } from "@/lib/catalog";
import { AskZekButton } from "@/components/agent/AskZekButton";

const ease = [0.16, 1, 0.3, 1] as const;

// Demo script. Timings in ms from the moment the panel scrolls into view.
const script = [
  { at: 300, step: 1 },
  { at: 1100, step: 2 },
  { at: 2300, step: 3 },
  { at: 3900, step: 4 },
  { at: 4600, step: 5 },
  { at: 5600, step: 6 },
];

const channels = [
  {
    icon: ChatCircleText,
    title: "Chat on the web",
    body: "Ask follow-ups, compare options, and build a bag without leaving the conversation.",
  },
  {
    icon: Microphone,
    title: "Talk to it",
    body: "Hands busy? Switch to voice and shop out loud.",
  },
  {
    icon: WhatsappLogo,
    title: "Continue on WhatsApp",
    body: "Pick up the same conversation on your phone, order updates included.",
  },
];

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex w-fit gap-1 rounded-[16px] rounded-bl-[6px] bg-surface px-4 py-3"
      aria-label="ZEK is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-subtle"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </motion.div>
  );
}

function Bubble({
  from,
  children,
}: {
  from: "user" | "agent";
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      className={
        from === "user"
          ? "ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[6px] bg-ink px-4 py-2.5 text-[14px] text-bg"
          : "w-fit max-w-[88%] rounded-[16px] rounded-bl-[6px] bg-surface px-4 py-2.5 text-[14px] leading-relaxed text-ink"
      }
    >
      {children}
    </motion.div>
  );
}

export function AgentShowcase() {
  const panelRef = useRef<HTMLDivElement>(null);
  const inView = useInView(panelRef, { once: true, amount: 0.45 });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Reduced motion: jump straight to the finished conversation.
    const steps = reduce ? [{ at: 0, step: 6 }] : script;
    const timers = steps.map(({ at, step }) =>
      window.setTimeout(() => setStep(step), at),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduce]);

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-8 md:py-28">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease }}
          className="order-2 rounded-panel bg-brand-soft p-3 md:p-5 lg:order-1 lg:col-span-7"
        >
          <div className="overflow-hidden rounded-[16px] border border-line bg-bg">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink">
                <Sparkle size={15} weight="fill" />
              </span>
              <p className="text-[14px] font-medium text-ink">ZEK</p>
            </div>

            <div className="flex min-h-[400px] flex-col gap-3 p-4 md:min-h-[440px] md:p-6">
              <AnimatePresence initial={false}>
                {step >= 1 && (
                  <Bubble key="u1" from="user">
                    I want a film camera to learn on. Under $150.
                  </Bubble>
                )}
                {step === 2 && <TypingDots key="t1" />}
                {step >= 3 && (
                  <motion.div
                    key="a1"
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease }}
                    className="flex flex-col gap-2"
                  >
                    <Bubble from="agent">
                      The Vela 35 fits. Fully manual, light, and it is on sale
                      this week.
                    </Bubble>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.25, ease }}
                      className="flex w-full max-w-[340px] items-center gap-3 rounded-[16px] border border-line bg-surface p-2.5"
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                        <Image
                          src={agentDemoProduct.image}
                          alt={agentDemoProduct.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-ink">
                          {agentDemoProduct.name}
                        </p>
                        <p className="text-[13px] text-subtle">
                          {agentDemoProduct.brand}
                        </p>
                        <p className="mt-0.5 text-[14px] font-medium text-ink">
                          {formatPrice(agentDemoProduct.price)}
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
                {step >= 4 && (
                  <Bubble key="u2" from="user">
                    Add it to my bag.
                  </Bubble>
                )}
                {step === 5 && <TypingDots key="t2" />}
                {step >= 6 && (
                  <Bubble key="a2" from="agent">
                    Done. Want me to check out with your saved card?
                  </Bubble>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <div className="order-1 lg:order-2 lg:col-span-5">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
            className="text-[12px] font-medium uppercase tracking-[0.16em] text-brand"
          >
            The ZEK agent
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.05, ease }}
            className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl"
          >
            Shopping that answers back.
          </motion.h2>

          <ul className="mt-10 flex flex-col gap-7">
            {channels.map(({ icon: Icon, title, body }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease }}
                className="flex gap-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{title}</h3>
                  <p className="mt-1 max-w-[42ch] text-[15px] leading-relaxed text-subtle">
                    {body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>

          <AskZekButton
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
          >
            Ask ZEK
            <ArrowRight
              size={16}
              weight="bold"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </AskZekButton>
        </div>
      </div>
    </section>
  );
}
