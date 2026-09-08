/**
 * In-memory-only access token storage. Deliberately isolated in its own
 * module so the storage strategy can change later (e.g. to an HttpOnly
 * cookie set by a Next.js route handler) without touching any call site —
 * every consumer only ever calls getAccessToken()/setAccessToken().
 *
 * The refresh token never reaches this layer at all — it lives in an
 * HttpOnly cookie set directly by the Django backend and is invisible to
 * JavaScript.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
