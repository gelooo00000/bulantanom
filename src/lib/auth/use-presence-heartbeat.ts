"use client";

import { useEffect } from "react";

import { sendHeartbeat } from "@/lib/api/auth-api";
import { useAuth } from "@/lib/auth/auth-context";

// Must stay under the backend's ONLINE_WINDOW (2 minutes, accounts/presence.py)
// so a Farmer who is still reading a page never flickers offline.
export const HEARTBEAT_MS = 60_000;

/**
 * Keeps the LGU's online indicator honest while this user has BulanTanom
 * open: one beat on arrival, then one a minute while the tab is visible.
 * A hidden tab stops beating, so a Farmer who walked away drops offline
 * within the window, and beats again the moment they come back.
 */
export function usePresenceHeartbeat() {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      // Presence is best-effort; a missed beat must never disturb the page.
      sendHeartbeat(accessToken).catch(() => {});
    };

    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [accessToken]);
}
