"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Crop emojis drifting slowly over the hero photograph — the farm's own
 * crops, so the page reads as a farm's tool at a glance. Decorative only:
 * hidden from screen readers, never in the way of a click, and still for
 * reduced-motion users.
 */
const CROPS: { emoji: string; top: string; left: string; size: string; delay: number }[] = [
  { emoji: "🍍", top: "14%", left: "58%", size: "text-4xl", delay: 0 },
  { emoji: "🌱", top: "30%", left: "88%", size: "text-3xl", delay: 0.8 },
  { emoji: "🥭", top: "10%", left: "80%", size: "text-3xl", delay: 1.6 },
  { emoji: "🍆", top: "44%", left: "70%", size: "text-3xl", delay: 0.4 },
  { emoji: "🌽", top: "22%", left: "44%", size: "text-2xl", delay: 2.2 },
  { emoji: "🍌", top: "54%", left: "92%", size: "text-3xl", delay: 1.2 },
];

export function FloatingCrops() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] hidden md:block">
      {CROPS.map(({ emoji, top, left, size, delay }) =>
        reduceMotion ? (
          <span key={emoji} className={`absolute ${size} opacity-80`} style={{ top, left }}>
            {emoji}
          </span>
        ) : (
          <motion.span
            key={emoji}
            className={`absolute ${size} drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]`}
            style={{ top, left }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.9, scale: 1, y: [0, -14, 0], rotate: [-4, 4, -4] }}
            transition={{
              opacity: { delay: 1 + delay * 0.3, duration: 0.8 },
              scale: { delay: 1 + delay * 0.3, duration: 0.8 },
              y: { delay, duration: 5 + delay, repeat: Infinity, ease: "easeInOut" },
              rotate: { delay, duration: 6 + delay, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            {emoji}
          </motion.span>
        ),
      )}
    </div>
  );
}
