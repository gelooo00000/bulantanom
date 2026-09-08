/**
 * A tiny publish/subscribe channel so the notification bell reloads the
 * moment an action produces a notification.
 *
 * The bell previously fetched only on mount and when its popover opened, so
 * after adding a plant or submitting an assessment the badge stayed stale
 * until the Farmer happened to click it. Actions now announce themselves and
 * the bell refetches immediately — no polling, no fixed delay.
 *
 * Deliberately a module-level listener set rather than React context: the
 * publishers are scattered across unrelated pages, and threading a callback
 * down to each one would couple them to the header. This mirrors the pattern
 * already used by `lib/theme/theme-context`.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes the bell. Returns an unsubscribe function for effect cleanup. */
export function subscribeToNotificationRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Announces that the server may have new notifications for this user.
 *
 * Call immediately after an action Django notifies on — adding a plant,
 * submitting an assessment, saving a soil recommendation. Safe to call when
 * no bell is mounted; it simply has no subscribers.
 */
export function requestNotificationRefresh(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // One misbehaving subscriber must not stop the others being told.
    }
  }
}
