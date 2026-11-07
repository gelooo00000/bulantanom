"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";

/** How long the celebration stays before closing by itself. */
const SHOW_MS = 6000;

const CONFETTI_COLORS = ["#22c55e", "#facc15", "#f97316", "#ec4899", "#3b82f6", "#a855f7", "#14b8a6"];
const BALLOON_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7", "#14b8a6", "#f97316"];

/** A fixed pseudo-random sequence, so every render draws the same burst. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seeded(42);
const CONFETTI = Array.from({ length: 70 }, (_, i) => {
  const angle = rand() * Math.PI * 2;
  const reach = 160 + rand() * 260;
  return {
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    // Out from the middle, then down as it falls.
    x: Math.cos(angle) * reach,
    y: Math.sin(angle) * reach * 0.7,
    fall: 260 + rand() * 260,
    rotate: (rand() - 0.5) * 720,
    width: 6 + rand() * 6,
    round: rand() > 0.7,
    delay: rand() * 0.15,
    duration: 2.2 + rand() * 1.2,
  };
});
const BALLOONS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  color: BALLOON_COLORS[i % BALLOON_COLORS.length],
  left: 4 + (i / 9) * 88 + (rand() - 0.5) * 6,
  size: 44 + rand() * 26,
  sway: 12 + rand() * 18,
  delay: 0.1 + rand() * 0.9,
  duration: 4 + rand() * 2,
}));

/** The harvested crop raining down the screen, in two waves. */
const RAIN = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: rand() * 96,
  size: 26 + rand() * 26,
  spin: (rand() - 0.5) * 540,
  drift: (rand() - 0.5) * 80,
  delay: 0.3 + (i % 2) * 1.4 + rand() * 1.2,
  duration: 2.4 + rand() * 1.6,
}));

/** Twinkles around the crop in the middle. */
const SPARKLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    id: i,
    x: Math.cos(angle) * (95 + rand() * 25),
    y: Math.sin(angle) * (95 + rand() * 25),
    delay: 0.5 + rand() * 1.5,
  };
});

function Balloon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 40 64" aria-hidden="true">
      <ellipse cx="20" cy="20" rx="17" ry="20" fill={color} />
      <ellipse cx="13" cy="12" rx="4" ry="6" fill="white" opacity="0.35" />
      <path d="M17 39 L23 39 L20 43 Z" fill={color} />
      <path d="M20 43 C 16 50, 24 55, 20 64" stroke={color} strokeWidth="1.2" fill="none" opacity="0.7" />
    </svg>
  );
}

/**
 * The moment a plant is marked harvested: its crop blooms in the middle of
 * the screen, confetti bursts out and balloons float up. Closes by itself,
 * or with Continue, Escape or a tap anywhere.
 */
export function HarvestCelebration({ plant, onClose }: { plant: BackendPlant; onClose: () => void }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const timer = setTimeout(onClose, SHOW_MS);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("celebrate.title")}
      className="bg-background/75 fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      {!reduceMotion && (
        <>
          {/* The crop raining down from above the screen. */}
          {RAIN.map((drop) => (
            <motion.span
              key={`rain-${drop.id}`}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 drop-shadow"
              style={{ left: `${drop.left}%`, fontSize: drop.size }}
              initial={{ y: "-15vh", x: 0, rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", x: drop.drift, rotate: drop.spin, opacity: [1, 1, 0.6] }}
              transition={{ delay: drop.delay, duration: drop.duration, ease: "easeIn" }}
            >
              {plant.crop.emoji}
            </motion.span>
          ))}

          {/* Balloons rising from below the screen. */}
          {BALLOONS.map((b) => (
            <motion.div
              key={b.id}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0"
              style={{ left: `${b.left}%` }}
              initial={{ y: "110%", x: 0 }}
              animate={{ y: "-110vh", x: [0, b.sway, -b.sway, b.sway / 2] }}
              transition={{ delay: b.delay, duration: b.duration, ease: "easeIn" }}
            >
              <Balloon color={b.color} size={b.size} />
            </motion.div>
          ))}

          {/* Confetti bursting out of the crop. */}
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2">
            {CONFETTI.map((c) => (
              <motion.span
                key={c.id}
                className="absolute block"
                style={{
                  width: c.width,
                  height: c.round ? c.width : c.width * 0.45,
                  borderRadius: c.round ? "9999px" : "2px",
                  backgroundColor: c.color,
                }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
                animate={{
                  x: c.x,
                  y: [0, c.y, c.y + c.fall],
                  opacity: [1, 1, 0],
                  rotate: c.rotate,
                  scale: 1,
                }}
                transition={{ delay: 0.2 + c.delay, duration: c.duration, ease: "easeOut", times: [0, 0.35, 1] }}
              />
            ))}
          </div>
        </>
      )}

      <motion.div
        className="relative flex max-w-sm flex-col items-center text-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* The bloom: rings opening out behind the crop. */}
        <div className="relative flex size-44 items-center justify-center">
          {!reduceMotion &&
            [0, 1, 2].map((ring) => (
              <motion.span
                key={ring}
                aria-hidden="true"
                className="border-primary/40 absolute inset-0 rounded-full border-4"
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ delay: 0.1 + ring * 0.35, duration: 1.6, ease: "easeOut", repeat: 1 }}
              />
            ))}
          {!reduceMotion &&
            SPARKLES.map((sparkle) => (
              <motion.span
                key={`sparkle-${sparkle.id}`}
                aria-hidden="true"
                className="absolute text-2xl"
                style={{ x: sparkle.x, y: sparkle.y }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ delay: sparkle.delay, duration: 1.2, repeat: 2, repeatDelay: 0.4 }}
              >
                ✨
              </motion.span>
            ))}
          <span
            aria-hidden="true"
            className="bg-primary/15 ring-primary/30 absolute inset-4 rounded-full ring-8"
          />
          <motion.span
            aria-hidden="true"
            className="relative text-7xl drop-shadow-lg"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: [0, 1.35, 1], rotate: [-30, 10, 0] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {plant.crop.emoji}
          </motion.span>
        </div>

        <h2 className="font-heading mt-4 text-3xl font-semibold">{t("celebrate.title")}</h2>
        <p className="mt-2 text-base">{t("celebrate.text", { name: plant.display_name })}</p>
        <Button ref={buttonRef} size="lg" className="mt-5" onClick={onClose}>
          {t("celebrate.continue")}
        </Button>
      </motion.div>
    </motion.div>
  );
}
