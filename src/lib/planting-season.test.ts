import { describe, expect, it } from "vitest";

import type { PlantingWindow } from "@/lib/api/plants-api";
import { adviseForMonth, monthFromIsoDate } from "@/lib/planting-season";

/**
 * These mirror `plants/test_variants_and_season.py` on the Django side. The
 * membership rule is the only piece of the season logic that lives in the
 * browser, so it is the only piece that needs pinning here — the wording is
 * asserted against the payload, never against a string baked into the UI.
 */

const EGGPLANT: PlantingWindow = {
  preferred_months: [2, 3, 4, 5],
  caution_months: [6, 7, 8, 1],
  preferred_label: "February-May",
  reason: "Transplanted into the drier window.",
  risk: "Saturated beds drive bacterial wilt.",
  caution_note: "Raised beds with drainage furrows.",
};

describe("adviseForMonth", () => {
  it("calls a preferred month good and gives the crop's reason", () => {
    const advice = adviseForMonth(EGGPLANT, 3);
    expect(advice?.status).toBe("good");
    expect(advice?.month_name).toBe("March");
    expect(advice?.detail).toBe(EGGPLANT.reason);
  });

  it("warns on a month outside the window and says what goes wrong", () => {
    const advice = adviseForMonth(EGGPLANT, 10);
    expect(advice?.status).toBe("poor");
    expect(advice?.detail).toBe(EGGPLANT.risk);
  });

  it("flags a caution month with the mitigation before the risk", () => {
    const advice = adviseForMonth(EGGPLANT, 7);
    expect(advice?.status).toBe("caution");
    expect(advice?.detail).toBe(`${EGGPLANT.caution_note} ${EGGPLANT.risk}`);
  });

  it("stays silent when the crop has no window on record", () => {
    expect(adviseForMonth(null, 5)).toBeNull();
    expect(
      adviseForMonth({ ...EGGPLANT, preferred_months: [], caution_months: [] }, 5),
    ).toBeNull();
  });

  it("rejects months outside 1-12 rather than guessing", () => {
    expect(adviseForMonth(EGGPLANT, 0)).toBeNull();
    expect(adviseForMonth(EGGPLANT, 13)).toBeNull();
  });
});

describe("monthFromIsoDate", () => {
  it("reads the month from the ISO string", () => {
    expect(monthFromIsoDate("2026-03-01")).toBe(3);
    expect(monthFromIsoDate("2026-12-31")).toBe(12);
  });

  it("falls back to the current month while the field is empty", () => {
    const thisMonth = new Date().getMonth() + 1;
    expect(monthFromIsoDate("")).toBe(thisMonth);
    expect(monthFromIsoDate(null)).toBe(thisMonth);
  });

  it("does not shift the month for dates at the edges of a month", () => {
    // Parsing via `new Date("2026-03-01")` would land on 28 February in any
    // timezone behind UTC, which is exactly the bug this avoids.
    expect(monthFromIsoDate("2026-03-01")).toBe(3);
    expect(monthFromIsoDate("2026-01-01")).toBe(1);
  });
});
