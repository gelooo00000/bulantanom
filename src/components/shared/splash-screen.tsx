"use client";

import { useEffect, useState } from "react";

import { Logo } from "@/components/shared/logo";

/** Set for the rest of the browser tab's visit once the splash has shown. */
const SPLASH_STORAGE_KEY = "bulantanom-splash-seen";
/** How long the splash stays up. */
export const SPLASH_MS = 5000;
/** The fade out at the end. */
const FADE_MS = 500;

/**
 * Runs before paint: on a reload or a second page in the same visit the
 * splash was already seen, so <html data-splash-seen> hides it at once
 * instead of flashing it before React takes over.
 */
export const SPLASH_INIT_SCRIPT = `
(function () {
  try {
    if (sessionStorage.getItem(${JSON.stringify(SPLASH_STORAGE_KEY)})) {
      document.documentElement.setAttribute("data-splash-seen", "");
    }
  } catch (e) {}
})();
`;

/**
 * The BulanTanom splash: the farm's logo and the name over the whole screen
 * for five seconds when the site is first opened (on Render's free tier
 * that is often right after the server woke up), with a bar filling as the
 * time runs. Once per visit: later pages and reloads go straight in.
 *
 * Rendered on the server too, so it is the first thing painted rather than
 * a flash of the page underneath.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"showing" | "leaving" | "gone">("showing");

  useEffect(() => {
    // Already seen this visit: the CSS keeps it hidden; nothing to time.
    if (document.documentElement.hasAttribute("data-splash-seen")) return;
    try {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    } catch {
      // Private mode or blocked storage: it shows again next load; harmless.
    }
    const fade = window.setTimeout(() => setPhase("leaving"), SPLASH_MS - FADE_MS);
    const done = window.setTimeout(() => setPhase("gone"), SPLASH_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-label="Loading BulanTanom"
      className="splash-screen bg-background fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 transition-opacity motion-reduce:transition-none"
      style={{ opacity: phase === "leaving" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="splash-pop flex flex-col items-center gap-4">
        <Logo className="size-28 rounded-3xl shadow-xl sm:size-32" px={128} />
        <p className="font-brand text-foreground text-4xl tracking-wide sm:text-5xl">BulanTanom</p>
        <p className="text-muted-foreground text-sm">Layuan Nature Integrated Farm</p>
      </div>
      <div className="bg-muted mt-2 h-1.5 w-48 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="splash-bar bg-primary h-full rounded-full"
          style={{ animationDuration: `${SPLASH_MS}ms` }}
        />
      </div>
    </div>
  );
}
