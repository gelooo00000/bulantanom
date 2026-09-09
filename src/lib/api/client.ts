import { setAccessToken } from "@/lib/auth/token-storage";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function extractError(body: unknown, fallback: string): { message: string; fieldErrors?: Record<string, string[]> } {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") {
      return { message: record.detail };
    }

    // DRF validation-error shape: { field: ["message", ...], ... }
    const fieldErrors: Record<string, string[]> = {};
    let firstMessage: string | null = null;
    for (const [key, value] of Object.entries(record)) {
      if (Array.isArray(value)) {
        const messages = value.filter((v): v is string => typeof v === "string");
        if (messages.length > 0) {
          fieldErrors[key] = messages;
          firstMessage ??= messages[0];
        }
      }
    }
    if (firstMessage) {
      return { message: firstMessage, fieldErrors };
    }
  }
  return { message: fallback };
}

/**
 * Silent re-authentication after the 15-minute access token expires.
 *
 * The access token deliberately lives in memory only and is short-lived; the
 * refresh token is an HttpOnly cookie the backend rotates. Until now nothing
 * connected the two after boot, so once the access token expired every request
 * failed with 401 until the user reloaded the page - the session looked dead
 * while it was still perfectly valid.
 *
 * A single in-flight refresh is shared by every caller: a dashboard firing
 * five parallel queries must produce one refresh, not five. Five would rotate
 * the token five times and, with BLACKLIST_AFTER_ROTATION, invalidate each
 * other.
 *
 * That guard is per-document, which was not far enough. Two tabs are two
 * documents, so each refreshed independently, both presenting the same cookie:
 * the first rotated it, the second arrived with a blacklisted token and got a
 * 401, and the officer was signed out of a session that was perfectly valid.
 * Opening the dashboard in a second tab was enough to do it. `withRefreshLock`
 * below extends the same one-refresh-at-a-time guarantee across documents.
 */
let refreshInFlight: Promise<string | null> | null = null;

/** Web Locks are per-origin, so this name is shared by every tab. */
const REFRESH_LOCK = "bulantanom:auth-refresh";

/** How long to wait for another tab before refreshing unserialised. */
const REFRESH_LOCK_TIMEOUT_MS = 5000;

/**
 * Serialises refreshes across every tab on this origin.
 *
 * Once the holder finishes, the waiter's request carries the cookie the
 * holder was just issued, so it rotates cleanly instead of presenting a
 * blacklisted token.
 *
 * Web Locks are unavailable in some older browsers and in non-browser
 * rendering contexts. There the call runs unserialised, exactly as it did
 * before, so the fallback can never be worse than the old behaviour.
 */
async function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks?.request) {
    return run();
  }

  // A tab whose refresh is wedged - a stalled network, a suspended
  // background tab - would otherwise hold this lock and leave every other
  // tab unable to refresh at all. Waiting is only ever an optimisation, so
  // give up on the wait rather than on the refresh.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_LOCK_TIMEOUT_MS);
  try {
    // lib.dom types the granted callback as returning T rather than a
    // promise, so a promise-returning callback makes the declared result
    // Promise<Promise<T>>. The runtime awaits the callback before releasing
    // the lock; awaiting here reconciles the type with that behaviour
    // instead of casting past it.
    return await navigator.locks.request(REFRESH_LOCK, { signal: controller.signal }, run);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Falls back to the pre-lock behaviour: at worst two tabs race, which
      // is what happened before this lock existed. Better than a session
      // that cannot refresh.
      return run();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const sessionExpiredListeners = new Set<() => void>();

/** Notifies the auth layer that re-authentication failed and the session is over. */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  setAccessToken(null);
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // One bad subscriber must not stop the others being told.
    }
  }
}

/**
 * Exchanges the refresh cookie for a new access token, or null if the session
 * is genuinely over (cookie missing, expired, or the account was suspended -
 * the backend re-checks account status on every refresh).
 *
 * Shared by `apiFetch`, the multipart upload path and authorized images so all
 * three recover identically.
 */
export async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      return await withRefreshLock(async () => {
        const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) return null;

        const data = (await response.json()) as { access?: unknown };
        const access = typeof data.access === "string" ? data.access : null;
        if (access) setAccessToken(access);
        return access;
      });
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * A 401 is only worth retrying when the caller actually presented a token.
 * Login and signup return 401 for genuinely bad credentials, and the refresh
 * endpoint itself must never recurse - none of those pass an access token.
 */
function isRetryableAuthFailure(path: string, accessToken?: string | null): boolean {
  return Boolean(accessToken) && !path.startsWith("/auth/refresh");
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
};

/**
 * Shared client for every call to the Django backend. Centralizes the base
 * URL, credentialed cookie handling (for the refresh cookie), JSON
 * (de)serialization, and error normalization so no component ever calls
 * `fetch()` against the API directly.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, accessToken } = options;

  const send = (token?: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response: Response;
  try {
    response = await send(accessToken);

    // The access token expired mid-session. Refresh once and replay, so the
    // user never sees an error for a session that is still valid.
    if (response.status === 401 && isRetryableAuthFailure(path, accessToken)) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        response = await send(refreshed);
      } else {
        notifySessionExpired();
      }
    }
  } catch {
    throw new ApiError("Unable to connect to BulanTanom. Please try again.", 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. an HTML error page) — never surface it directly.
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError("Something went wrong. Please try again later.", response.status);
    }
    const { message, fieldErrors } = extractError(data, "Something went wrong. Please try again.");
    throw new ApiError(message, response.status, fieldErrors);
  }

  return data as T;
}
