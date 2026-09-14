import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  answerPresence,
  clearTabSignedIn,
  hasSignedInTab,
  isTabSignedIn,
  markTabSignedIn,
} from "@/lib/auth/tab-session";

let stopAnswering: (() => void) | null = null;

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  stopAnswering?.();
  stopAnswering = null;
});

describe("tab session", () => {
  it("restores in a tab that was already signed in, such as after a reload", async () => {
    markTabSignedIn();
    await expect(hasSignedInTab(50)).resolves.toBe(true);
  });

  /**
   * The refresh cookie lives until the browser quits, so without this a
   * brand-new tab opened after closing every BulanTanom tab slipped straight
   * back into the previous account.
   */
  it("does not restore once every BulanTanom tab was closed", async () => {
    await expect(hasSignedInTab(50)).resolves.toBe(false);
  });

  it("joins the session of another open, signed-in tab", async () => {
    stopAnswering = answerPresence(() => true);
    await expect(hasSignedInTab(1000)).resolves.toBe(true);
  });

  it("is not vouched for by open tabs that are signed out", async () => {
    stopAnswering = answerPresence(() => false);
    await expect(hasSignedInTab(100)).resolves.toBe(false);
  });

  it("forgets the tab on sign-out", () => {
    markTabSignedIn();
    clearTabSignedIn();
    expect(isTabSignedIn()).toBe(false);
  });
});
