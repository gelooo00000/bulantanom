import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LguHarvestPage from "@/app/lgu/harvest/page";
import type { LguPlant } from "@/lib/api/lgu-api";

let plants: LguPlant[] = [];
let outcomes: unknown = { total: 0 };
vi.mock("@/lib/api/use-authed-query", () => ({
  useLguQuery: () => ({ data: plants, loading: false, error: null, refetch: vi.fn() }),
  // The Harvest Outcomes section.
  useAuthedQuery: () => ({ data: outcomes, loading: false, error: null, refetch: vi.fn() }),
}));

// Today is fixed, so every harvest window below has a known stage.
const TODAY = "2026-09-24";

function plant(
  id: number,
  name: string,
  start: string,
  end: string,
  extra: Partial<LguPlant> = {},
): LguPlant {
  return {
    id,
    crop: { id: name.toLowerCase(), name, emoji: "🌱", category_label: "Fruit" },
    display_name: name,
    planting_date: "2026-06-01",
    expected_harvest_start: start,
    expected_harvest_end: end,
    status: "GROWING",
    status_label: "Growing",
    age_days: 115,
    farmer: { id: 1, full_name: "Juan Cruz", email: "juan@example.com" },
    latest_risk: null,
    assessment_eligibility: { can_assess: false, days_remaining: 3 },
    ...extra,
  };
}

function risk(level: "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE") {
  return { risk_level: level, assessment_id: 1, assessment_date: "2026-09-20", has_evidence: true };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${TODAY}T08:00:00`));
  plants = [
    plant(1, "Pineapple", "2026-09-20", "2026-10-20", { latest_risk: risk("LOW") }),
    plant(2, "Okra", "2026-09-28", "2026-10-15", {
      latest_risk: risk("HIGH"),
      assessment_eligibility: { can_assess: true, days_remaining: 0 },
    }),
    plant(3, "Banana", "2027-08-20", "2027-09-19", { latest_risk: risk("INCONCLUSIVE") }),
    plant(4, "Mango", "2026-08-01", "2026-09-01"),
    plant(5, "Corn", "2026-08-01", "2026-09-01", {
      status: "HARVESTED",
      status_label: "Harvested",
      latest_risk: risk("MEDIUM"),
    }),
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LGU Harvest & Monitoring", () => {
  it("has no summary tiles and no harvest-stage chart", () => {
    render(<LguHarvestPage />);
    expect(screen.queryByText("Weekly checks due")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Harvest stage")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Plants by harvest stage" })).not.toBeInTheDocument();
  });

  it("says harvest starts and ends, not window opens and closes", () => {
    render(<LguHarvestPage />);
    expect(screen.getAllByText("Harvest starts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harvest ends").length).toBeGreaterThan(0);
    expect(screen.queryByText(/window/i)).not.toBeInTheDocument();
    expect(screen.getByText("Harvest time passed", { exact: false })).toBeInTheDocument();
  });

  it("has no Monitoring risk chart, and lists every plant", () => {
    render(<LguHarvestPage />);
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Plants in the field by latest risk" })).not.toBeInTheDocument();
    expect(screen.getByText("Mango", { selector: "p *, p" })).toBeInTheDocument();
  });

  it("shows how harvested plants turned out", () => {
    const breakdown = (rows: [string, string, number][]) =>
      rows.map(([value, label, count]) => ({ value, label, count }));
    outcomes = {
      total: 4,
      healthy_rate: 75,
      advice_helped_rate: 100,
      on_time_rate: 50,
      monitored_rate: 100,
      reached_high_risk: 2,
      recovered_healthy: 1,
      quality: breakdown([["GOOD", "Good", 3], ["FAIR", "Fair", 1], ["POOR", "Poor", 0]]),
      final_health: breakdown([["HEALTHY", "Healthy", 3], ["MINOR_PROBLEMS", "Minor problems", 1], ["DAMAGED", "Badly damaged", 0]]),
      advice_helped: breakdown([["YES", "Yes", 4], ["A_LITTLE", "A little", 0], ["NO", "No", 0]]),
      timing: [],
      by_crop: [
        {
          crop: "Corn",
          emoji: "🌽",
          harvests: 4,
          healthy_rate: 75,
          good_quality_rate: 75,
          on_time_rate: 50,
          average_yield: [{ unit: "KG", unit_label: "kg", average: 12.5, reports: 4 }],
          average_days: 88,
        },
      ],
      recent: [],
    };
    render(<LguHarvestPage />);
    expect(screen.getByRole("heading", { name: "Harvest Outcomes" })).toBeInTheDocument();
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
    expect(screen.getByText("Healthy at harvest")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("12.5 kg")).toBeInTheDocument();
    outcomes = { total: 0 };
  });
});
