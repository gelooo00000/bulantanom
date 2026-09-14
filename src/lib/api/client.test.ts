import { afterEach, describe, expect, it, vi } from "vitest";

import { refreshSession } from "@/lib/api/auth-api";
import { ApiError, refreshAccessToken } from "@/lib/api/client";

const user = { id: 1, email: "officer@example.com", role: "LGU_OFFICER" };

function stubRefresh(response: { ok: boolean; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refresh token rotation", () => {
  /**
   * Every refresh rotates the cookie and blacklists the old one, and the
   * backend clears the cookie when the stale one comes back. React Strict
   * Mode runs the boot effect twice, so two refreshes on one page load used
   * to sign the user out on every reload.
   */
  it("sends a single refresh for concurrent boot refreshes", async () => {
    const fetchMock = stubRefresh({ ok: true, body: { access: "new-access", user } });

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ access: "new-access", user });
    expect(second).toEqual(first);
  });

  it("shares the boot refresh with a 401 retry already in flight", async () => {
    const fetchMock = stubRefresh({ ok: true, body: { access: "new-access", user } });

    const [session, access] = await Promise.all([refreshSession(), refreshAccessToken()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.access).toBe("new-access");
    expect(access).toBe("new-access");
  });

  it("rejects the boot refresh when there is no session", async () => {
    stubRefresh({ ok: false, body: { detail: "No active session." } });

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);
  });
});
