/**
 * Why the last session ended, kept for the sign-in page to explain once.
 * Only one reason exists today: another device signed in to the account
 * (the backend allows one device at a time).
 */
const KEY = "bt-signed-out-reason";

export type SignedOutReason = "signed_in_elsewhere";

export function rememberSignedOutReason(reason: SignedOutReason): void {
  try {
    sessionStorage.setItem(KEY, reason);
  } catch {
    // Storage blocked: the page still signs out, just without the note.
  }
}

/** The reason, read once: it is cleared so a later visit does not repeat it. */
export function takeSignedOutReason(): SignedOutReason | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value === "signed_in_elsewhere" ? value : null;
  } catch {
    return null;
  }
}
