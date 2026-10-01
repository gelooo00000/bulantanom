"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Fades and lifts its content in the first time it scrolls into view — for
 * sections further down a page, where FadeIn (which plays on load) would
 * have finished before anyone saw it. Static for reduced-motion users.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  /** Milliseconds, e.g. to stagger cards in a row. */
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ delay: delay / 1000, duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
