"use client";

import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, Leaf } from "lucide-react";

/**
 * What a farmer actually gets, shown instead of described: one plant as the
 * app shows it, with its growth bar filling in. Sample figures only.
 */
export function SamplePlantCard() {
  const reduceMotion = useReducedMotion();
  const grown = 38;

  return (
    <div className="liquid-glass w-full max-w-sm rounded-2xl p-5 text-[var(--glass-fg)]">
      <p className="text-[11px] tracking-[0.18em] text-[var(--glass-fg-subtle)] uppercase">
        This week at Layuan Farm
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-xl bg-[var(--glass-tile)] text-2xl"
        >
          🍍
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Queen (Formosa)</p>
          <p className="text-xs text-[var(--glass-fg-muted)]">Pineapple · day 170</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-400/20 px-2 py-0.5 text-xs font-medium text-emerald-100">
          <Leaf className="size-3" />
          Low risk
        </span>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-[var(--glass-fg-muted)]">
          <span>Growing well</span>
          <span>{grown}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--glass-tile)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400"
            initial={{ width: reduceMotion ? `${grown}%` : "0%" }}
            animate={{ width: `${grown}%` }}
            transition={{ delay: 1.8, duration: 1.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[var(--glass-tile)] p-2.5">
          <p className="text-[var(--glass-fg-faint)]">Next check</p>
          <p className="mt-0.5 flex items-center gap-1 font-medium">
            <CalendarClock className="size-3" />
            in 3 days
          </p>
        </div>
        <div className="rounded-lg bg-[var(--glass-tile)] p-2.5">
          <p className="text-[var(--glass-fg-faint)]">Ready from</p>
          <p className="mt-0.5 font-medium">Dec 2027 🌾</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-[var(--glass-fg-faint)]">
        Sample plant — yours appear once you add them.
      </p>
    </div>
  );
}
