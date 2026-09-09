import { describe, expect, it } from "vitest";

import { reportQueryString, type ReportQuery } from "@/lib/api/reports-api";

function query(overrides: Partial<ReportQuery> = {}): ReportQuery {
  return {
    period: "all_time",
    farmer: "all",
    crop: "all",
    riskLevel: "ALL",
    dateFrom: "",
    dateTo: "",
    ...overrides,
  };
}

function params(q: ReportQuery, supports: string[]) {
  return new URLSearchParams(reportQueryString(q, supports));
}

describe("reportQueryString", () => {
  it("always sends the period", () => {
    expect(params(query({ period: "this_week" }), []).get("period")).toBe("this_week");
  });

  /**
   * Each report declares which filters it honours. Sending one it does not
   * would make the UI claim a narrowing the backend silently ignores, so the
   * report would show unfiltered figures under a filtered heading.
   */
  it("omits filters the report does not support", () => {
    const p = params(
      query({ farmer: "7", crop: "tomato", riskLevel: "HIGH" }),
      ["period"],
    );
    expect(p.has("farmer")).toBe(false);
    expect(p.has("crop")).toBe(false);
    expect(p.has("risk_level")).toBe(false);
  });

  it("sends filters the report does support", () => {
    const p = params(
      query({ farmer: "7", crop: "tomato", riskLevel: "HIGH" }),
      ["period", "farmer", "crop", "risk_level"],
    );
    expect(p.get("farmer")).toBe("7");
    expect(p.get("crop")).toBe("tomato");
    expect(p.get("risk_level")).toBe("HIGH");
  });

  it("treats the 'all' sentinels as no filter at all", () => {
    const p = params(query(), ["period", "farmer", "crop", "risk_level"]);
    expect(p.has("farmer")).toBe(false);
    expect(p.has("crop")).toBe(false);
    // "ALL" is the UI's placeholder, not a risk level the backend accepts.
    expect(p.has("risk_level")).toBe(false);
  });

  it("sends custom dates only for a custom period", () => {
    const dates = { dateFrom: "2026-01-01", dateTo: "2026-03-31" };

    const custom = params(query({ period: "custom", ...dates }), ["period"]);
    expect(custom.get("date_from")).toBe("2026-01-01");
    expect(custom.get("date_to")).toBe("2026-03-31");

    // Dates left over in state from a previous selection must not leak into
    // a named period and silently narrow it.
    const named = params(query({ period: "this_year", ...dates }), ["period"]);
    expect(named.has("date_from")).toBe(false);
    expect(named.has("date_to")).toBe(false);
  });

  it("allows a one-sided custom range", () => {
    const p = params(query({ period: "custom", dateFrom: "2026-01-01" }), ["period"]);
    expect(p.get("date_from")).toBe("2026-01-01");
    expect(p.has("date_to")).toBe(false);
  });

  it("escapes values rather than concatenating them into the query", () => {
    const p = params(query({ farmer: "a&b=c" }), ["period", "farmer"]);
    expect(p.get("farmer")).toBe("a&b=c");
  });
});
