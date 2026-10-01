"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/shared/logo";

/** How long the screen stays up before opening the dashboard. */
export const DASHBOARD_LOADING_MS = 5000;

/**
 * The short "Preparing your dashboard..." step shown after a Farmer or LGU
 * Officer signs in. It sits in the sign-in layout in place of the form, and
 * opens `destination` after exactly DASHBOARD_LOADING_MS. Admin skips it.
 */
export function DashboardLoadingScreen({
  destination,
  firstName,
}: {
  destination: string;
  firstName?: string;
}) {
  const router = useRouter();
  // Starts empty and fills over the full duration; set on the next frame so
  // the width change is animated rather than applied at once.
  const [filled, setFilled] = useState(false);

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
          <div className="relative flex size-24 items-center justify-center sm:size-28">
            {/* The spinner rings the logo, so the mark stays still and legible. */}
            <LoaderCircle
              aria-hidden="true"
              strokeWidth={1.5}
              className="absolute inset-0 size-full animate-spin"
              style={{ color: "var(--landing-accent)" }}
            />
            <Logo px={56} className="size-14 rounded-xl sm:size-16" />
          </div>

          <div>
            <p className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
              Preparing your dashboard...
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {firstName ? `Welcome back, ${firstName}. ` : ""}This only takes a moment.
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
