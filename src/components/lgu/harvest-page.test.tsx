import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function bars(name: string) {
  return within(screen.getByRole("list", { name }));
}

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

  it("charts risk for plants still in the field, counting too-early as no reading", () => {
    render(<LguHarvestPage />);
    // The harvested Corn is left out; the too-early Banana joins Mango as no reading.
    expect(
      screen.getByRole("img", {
        name: "Plants in the field by latest risk: High risk 1, Medium risk 0, Low risk 1, No reading yet 2.",
      }),
    ).toBeInTheDocument();
  });

  it("lists only the picked risk level, and shows everything again on request", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LguHarvestPage />);

    await user.click(bars("Plants in the field by latest risk").getByRole("button", { name: /High risk/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing High risk · 1 plant");
    expect(screen.getByText("Weekly check due")).toBeInTheDocument();
    expect(screen.queryByText("Mango", { selector: "p *, p" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Mango", { selector: "p *, p" })).toBeInTheDocument();
  });

  it("clears the filter on a second click of the same level", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LguHarvestPage />);

    const none = bars("Plants in the field by latest risk").getByRole("button", { name: /No reading yet/ });
    await user.click(none);
    expect(screen.getByRole("status")).toHaveTextContent("Showing No reading yet · 2 plants");
    await user.click(none);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
