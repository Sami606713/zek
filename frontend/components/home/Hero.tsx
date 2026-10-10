"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRight, ArrowUpRight, Microphone, Plus } from "@phosphor-icons/react";
import { agentDemoProduct, formatPrice, heroImage } from "@/lib/catalog";
import { useAgentStore } from "@/store/agentStore";

const prompts = [
  "A film camera for a beginner",
  "A gift for a runner who has everything",
  "Desk lamp that works in a small room",
  "Where is my last order?",
];

const ease = [0.16, 1, 0.3, 1] as const;

function MagneticButton({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  return (
    <motion.button
      type="submit"
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
        y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-3 text-[15px] font-medium text-brand-ink"
    >
      {children}
    </motion.button>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const [promptIndex, setPromptIndex] = useState(0);
  const [value, setValue] = useState("");
  const openPanel = useAgentStore((s) => s.openPanel);
  const visualRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: visualRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "14%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], reduce ? [1.04, 1.04] : [1.04, 1.12]);
  const cardY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "-40%"]);

  useEffect(() => {
    if (value) return;
    const id = window.setInterval(
      () => setPromptIndex((i) => (i + 1) % prompts.length),
      3200,
    );
    return () => window.clearInterval(id);
  }, [value]);

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease },
  });

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-12 px-4 pb-16 pt-24 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pb-12">
        <div className="lg:col-span-6 lg:pr-6">
          <motion.h1
            {...rise(0.1)}
            className="text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-ink md:text-6xl lg:text-7xl"
          >
            Describe it.
            <br />
            <span className="text-brand">ZEK finds it.</span>
          </motion.h1>

          <motion.p
            {...rise(0.22)}
            className="mt-6 max-w-[44ch] text-lg leading-relaxed text-subtle"
          >
            Ask in plain words, by chat or voice. ZEK compares thousands of
            products and brings back the right ones.
          </motion.p>

          <motion.div {...rise(0.34)} className="mt-9 max-w-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openPanel(value);
                setValue("");
              }}
              className="flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-soft transition focus-within:border-brand"
            >
              <label htmlFor="hero-ask" className="sr-only">
                What are you shopping for?
              </label>
              <div className="relative min-w-0 flex-1">
                <input
                  id="hero-ask"
                  name="q"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="off"
                  className="w-full bg-transparent py-2 text-[15px] text-ink outline-none"
                />
                {!value && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[15px] text-subtle"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={promptIndex}
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -14, opacity: 0 }}
                        transition={{ duration: 0.35, ease }}
                        className="truncate"
                      >
                        {prompts[promptIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => openPanel()}
                aria-label="Ask with your voice"
                className="hidden size-11 shrink-0 place-items-center rounded-full text-ink transition hover:bg-surface-2 sm:grid"
              >
                <Microphone size={20} />
              </button>
              <MagneticButton>
                Ask ZEK
                <ArrowRight size={16} weight="bold" />
              </MagneticButton>
            </form>

            <Link
              href="/products"
              className="group mt-5 inline-flex items-center gap-1.5 pl-5 text-[15px] font-medium text-ink"
            >
              Shop all
              <ArrowUpRight
                size={16}
                className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </motion.div>
        </div>

        <div ref={visualRef} className="relative lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.15, ease }}
            className="relative ml-auto aspect-[4/5] w-full max-w-[560px] overflow-hidden rounded-panel bg-surface-2 lg:max-h-[78dvh]"
          >
            <motion.div
              style={{ y: imageY, scale: imageScale }}
              className="absolute inset-0"
            >
              <Image
                src={heroImage}
                alt="Studio photograph of a featured product"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </motion.div>
          </motion.div>

          <motion.div
            style={{ y: cardY }}
            className="absolute -bottom-6 left-3 right-3 sm:left-6 sm:right-auto sm:w-[340px] lg:-left-10 lg:bottom-12"
          >
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.7 }}
              className="rounded-panel border border-line bg-surface/90 p-3 shadow-soft backdrop-blur-xl"
            >
              <div className="ml-auto w-fit max-w-[85%] rounded-[16px] rounded-br-[6px] bg-ink px-3.5 py-2 text-[13px] text-bg">
                Film camera under $150
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.25, ease }}
                className="mt-3 flex items-center gap-3 rounded-[14px] bg-bg p-2"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                  <Image
                    src={agentDemoProduct.image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {agentDemoProduct.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-subtle">
                    <span className="font-medium text-ink">
                      {formatPrice(agentDemoProduct.price)}
                    </span>
                    {agentDemoProduct.compareAt && (
                      <span className="ml-2 line-through">
                        {formatPrice(agentDemoProduct.compareAt)}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-ink"
                >
                  <Plus size={14} weight="bold" />
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
