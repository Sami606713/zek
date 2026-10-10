"use client";

import { MotionConfig } from "motion/react";

// reducedMotion="user" drops transform animations for visitors with
// prefers-reduced-motion, without changing server-rendered markup.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
