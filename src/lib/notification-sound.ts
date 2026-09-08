"use client";

/**
 * A short chime for arriving notifications, shared by all three roles.
 *
 * Synthesised with the Web Audio API rather than shipped as an audio file:
 * nothing to bundle or fetch, it works offline, and there is no extra asset
 * for a Content-Security-Policy to allow. The tone is deliberately quiet and
 * brief — this fires whenever a Farmer's assessment is evaluated or an Admin
 * approves an account, so it has to be unobtrusive enough to hear all day.
 *
 * Two guarantees matter here:
 *
 * 1. It is muteable, and the choice persists. A sound a user cannot switch
 *    off is worse than no sound at all.
 * 2. It never throws. Browsers block audio until the user has interacted with
 *    the page, so the very first attempt after a cold load can legitimately
 *    fail. That must never surface as an error in a notification bell.
 */

export const SOUND_STORAGE_KEY = "bulantanom_notification_sound";

// Two notes a fourth apart (A5 -> D6): a rising interval reads as "something
// arrived" rather than as an alert or an error.
const NOTES = [880, 1174.7];
const NOTE_DURATION = 0.12;
const PEAK_GAIN = 0.14;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  // One context reused for the session — browsers cap how many can exist.
  audioContext ??= new Ctor();
  return audioContext;
}

// ---------------------------------------------------------------------------
// Mute preference
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Default on: a notification system that is silent until configured
    // would look broken rather than considerate.
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode with storage denied: the toggle still works for this
    // session, it just will not be remembered.
  }
  for (const listener of listeners) listener();
}

/** Subscribe/snapshot pair for `useSyncExternalStore`. */
export function subscribeToSoundPreference(onChange: () => void): () => void {
  listeners.add(onChange);
  // Keep other tabs of the same app in sync.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const getSoundPreference = isNotificationSoundEnabled;
/** The server cannot read localStorage, so it renders the default. */
export const getSoundPreferenceServerSnapshot = () => true;

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/**
 * Prepares audio on a real user gesture.
 *
 * Browsers create every AudioContext in a `suspended` state and only allow it
 * to resume while the page has user activation. A notification arrives on a
 * timer, not on a click, so by then the gesture is long gone — resuming at
 * that moment can be refused outright.
 *
 * So the context is created and resumed on the first click or keypress after
 * load (signing in is normally the first of these), and stays running for the
 * rest of the session. Safe to call repeatedly; it does nothing once running.
 */
export function unlockNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    // Audio is a nicety; never let it break the caller.
  }
}

/**
 * Plays the chime, unless the user has muted it.
 *
 * Silently does nothing when audio is unavailable or still blocked by the
 * browser's autoplay policy — an inaudible notification is a much smaller
 * problem than a thrown error inside the header.
 */
export async function playNotificationSound(): Promise<void> {
  if (!isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume *before* reading currentTime. A suspended context has a frozen
    // clock, so scheduling against it and resuming afterwards puts every note
    // in the past and nothing is ever heard.
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (ctx.state !== "running") return;

    const startOfChime = ctx.currentTime;

    NOTES.forEach((frequency, index) => {
      const startAt = startOfChime + index * NOTE_DURATION;
      const endAt = startAt + NOTE_DURATION;

      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      // Ramped rather than switched on: an instant start or stop produces an
      // audible click on most hardware.
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });
  } catch {
    // Audio is a nicety; never let it break the bell.
  }
}
