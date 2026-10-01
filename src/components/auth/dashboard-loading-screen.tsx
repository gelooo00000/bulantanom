"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { FadeIn } from "@/components/motion/fade-in";

/** How long the screen stays up before opening the dashboard. */
export const DASHBOARD_LOADING_MS = 5000;

/** How long each crop stays in the ring: about ten crops over the 5 seconds. */
export const CROP_STEP_MS = 500;

/** Layuan Farm's own crops, as on the landing page's crop strip. */
export const LOADING_CROPS: [emoji: string, name: string][] = [
  ["🌽", "Corn"],
  ["🍅", "Tomato"],
  ["🥬", "Pechay"],
  ["🍆", "Eggplant"],
  ["🥭", "Mango"],
  ["🍌", "Banana"],
  ["🍍", "Pineapple"],
  ["🥥", "Coconut"],
  ["🍈", "Papaya"],
  ["🍠", "Ube"],
  ["🥒", "Okra"],
  ["🍉", "Watermelon"],
];

/**
 * The short "Preparing your dashboard..." step shown after a Farmer or LGU
 * Officer signs in, and after a Farmer creates an account. It sits in the
 * sign-in layout in place of the form, and opens `destination` after
 * exactly DASHBOARD_LOADING_MS. Admin skips it.
 */
export function DashboardLoadingScreen({
  destination,
  firstName,
  newAccount = false,
}: {
  destination: string;
  firstName?: string;
  /** A just-created account is welcomed in, not welcomed back. */
  newAccount?: boolean;
}) {
  const router = useRouter();
  // Starts empty and fills over the full duration; set on the next frame so
  // the width change is animated rather than applied at once.
  const [filled, setFilled] = useState(false);
  const [cropIndex, setCropIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const [emoji, cropName] = LOADING_CROPS[cropIndex % LOADING_CROPS.length];

  useEffect(() => {
    const ticker = window.setInterval(() => setCropIndex((i) => i + 1), CROP_STEP_MS);
    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    const timer = window.setTimeout(() => router.replace(destination), DASHBOARD_LOADING_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [destination, router]);

  return (
    <FadeIn duration={400}>
      <AuthCard>
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-5 py-4 text-center sm:py-6"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex size-24 items-center justify-center sm:size-28">
              <LoaderCircle
                aria-hidden="true"
                strokeWidth={1.5}
                className="absolute inset-0 size-full animate-spin"
                style={{ color: "var(--landing-accent)" }}
              />
              {/* One crop at a time pops into the ring; keyed so each swap
                  replays the entrance. */}
              <motion.span
                key={cropIndex}
                aria-hidden="true"
                className="text-4xl leading-none select-none sm:text-5xl"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -20 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 420, damping: 18 }
                }
              >
                {emoji}
              </motion.span>
            </div>
            <span
              aria-hidden="true"
              className="text-muted-foreground h-4 text-xs font-medium tracking-wide"
            >
              {cropName}
            </span>
          </div>

          <div>
            <p className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
              Preparing your dashboard...
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {firstName
                ? newAccount
                  ? `Welcome to BulanTanom, ${firstName}. `
                  : `Welcome back, ${firstName}. `
                : ""}
              This only takes a moment.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="bg-muted h-1.5 w-full max-w-60 overflow-hidden rounded-full"
          >
            <div
              className="h-full rounded-full ease-linear"
              style={{
                background: "var(--landing-accent)",
                width: filled ? "100%" : "0%",
                transitionProperty: "width",
                transitionDuration: `${DASHBOARD_LOADING_MS}ms`,
              }}
            />
          </div>
        </div>
      </AuthCard>
    </FadeIn>
  );
}
