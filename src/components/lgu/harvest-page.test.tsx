import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LguHarvestPage from "@/app/lgu/harvest/page";
import type { LguPlant } from "@/lib/api/lgu-api";

let plants: LguPlant[] = [];
vi.mock("@/lib/api/use-authed-query", () => ({
  useLguQuery: () => ({ data: plants, loading: false, error: null, refetch: vi.fn() }),
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

  it("keeps harvested plants in the Archive tab", () => {
    render(<LguHarvestPage />);
    expect(screen.queryByRole("region", { name: "Harvested" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Archive/ }));
    expect(screen.getByRole("region", { name: "Harvested" })).toBeInTheDocument();
    expect(screen.getByText("Corn", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Still growing" })).not.toBeInTheDocument();
  });

  it("shows six growing plants a page and slides to the next", () => {
    plants = Array.from({ length: 8 }, (_, i) => plant(10 + i, `Crop ${i + 1}`, "2027-08-20", "2027-09-19"));
    render(<LguHarvestPage />);
    const growing = screen.getByRole("region", { name: "Still growing" });
    expect(within(growing).getByText("1–6 of 8")).toBeInTheDocument();
    expect(within(growing).getByText("Crop 7").closest("[inert]")).not.toBeNull();
    fireEvent.click(within(growing).getByRole("button", { name: "Next page" }));
    expect(within(growing).getByText("7–8 of 8")).toBeInTheDocument();
    expect(within(growing).getByText("Crop 7").closest("[inert]")).toBeNull();
    expect(within(growing).getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("has no Harvest Outcomes section", () => {
    render(<LguHarvestPage />);
    expect(screen.queryByRole("heading", { name: "Harvest Outcomes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Healthy at harvest")).not.toBeInTheDocument();
  });
});
