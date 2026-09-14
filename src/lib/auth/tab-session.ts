/**
 * Whether this browser tab holds a signed-in BulanTanom session.
 *
 * The refresh cookie outlives any single tab - it lasts until the browser
 * itself quits - so closing every BulanTanom tab and coming back used to
 * restore the old session silently: the landing page looked signed out, but
 * choosing a role jumped straight into the previous account.
 *
 * A tab therefore restores the cookie session only when it already held it
 * (sessionStorage survives a reload but not a closed tab) or another open
 * BulanTanom tab vouches for it. With no such tab, the session ended when the
 * last tab closed.
 */

const TAB_KEY = "bulantanom_tab_signed_in";
const CHANNEL = "bulantanom:auth-presence";

/** How long a newly opened tab waits for an open tab to answer. */
export const PRESENCE_TIMEOUT_MS = 300;

type PresenceMessage = { type: "ping" } | { type: "present" };

// sessionStorage access throws in some privacy modes, hence the guards.

export function markTabSignedIn(): void {
  try {
    window.sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    // Unavailable storage only costs this tab its reload restore.
  }
}

export function clearTabSignedIn(): void {
  try {
    window.sessionStorage.removeItem(TAB_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

export function isTabSignedIn(): boolean {
  try {
    return window.sessionStorage.getItem(TAB_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Resolves true when this tab, or another open BulanTanom tab, is signed in -
 * the only cases in which the cookie session should be restored.
 *
 * Without BroadcastChannel there is no way to ask the other tabs, so it
 * resolves true and the cookie decides, exactly as before.
 */
export function hasSignedInTab(timeoutMs = PRESENCE_TIMEOUT_MS): Promise<boolean> {
  if (isTabSignedIn()) return Promise.resolve(true);
  if (typeof BroadcastChannel === "undefined") return Promise.resolve(true);

  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL);
    const finish = (present: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(present);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
      if (event.data?.type === "present") finish(true);
    };
    channel.postMessage({ type: "ping" } satisfies PresenceMessage);
  });
}

/**
 * Answers other tabs asking whether anyone is signed in, while `isSignedIn`
 * holds. Returns a cleanup that stops answering.
 */
export function answerPresence(isSignedIn: () => boolean): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};

  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
    if (event.data?.type === "ping" && isSignedIn()) {
      channel.postMessage({ type: "present" } satisfies PresenceMessage);
    }
  };
  return () => channel.close();
}
