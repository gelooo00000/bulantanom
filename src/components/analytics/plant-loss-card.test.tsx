import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlantLossCard } from "@/components/analytics/plant-loss-card";
import type { PlantLoss, PlantLosses } from "@/lib/api/lgu-api";

let data: PlantLosses | null = null;
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data, loading: false, error: null, refetch: vi.fn() }),
}));
let role = "lgu";
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ currentUser: { role } }) }));

const loss = (id: number, cause: string, group: string): PlantLoss =>
  ({ id, cause, cause_group: group, lost_at: "2026-11-05T08:00:00+08:00" }) as PlantLoss;

const full: PlantLosses = {
  total: 3,
  calamity: 2,
  high_risk_not_saved: 1,
  pest_disease: 1,
  conditions: 0,
  other: 0,
  warned_before: 1,
  warned_before_rate: 33,
  harvested: 9,
  survival_rate: 75,
  causes: [
    { value: "CALAMITY", label: "Calamity", count: 2, calamity: true, group: "calamity" },
    { value: "PEST", label: "Pest infestation", count: 1, calamity: false, group: "pest_disease" },
    { value: "DISEASE", label: "Plant disease", count: 0, calamity: false, group: "pest_disease" },
    { value: "NUTRIENTS", label: "Lack of nutrients", count: 0, calamity: false, group: "conditions" },
    { value: "POOR_SOIL", label: "Poor soil condition", count: 0, calamity: false, group: "conditions" },
    { value: "WATER", label: "Lack of water", count: 0, calamity: false, group: "conditions" },
    { value: "HUMAN_ERROR", label: "Human error", count: 0, calamity: false, group: "other" },
    { value: "EXTREME_TEMP", label: "Extreme temperature", count: 0, calamity: false, group: "conditions" },
    { value: "OTHER", label: "Other / not sure", count: 0, calamity: false, group: "other" },
  ],
  crops: [],
  months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month) => ({
    month,
    count: month === "2026-11" ? 3 : 0,
  })),
  losses: [loss(1, "CALAMITY", "calamity"), loss(2, "CALAMITY", "calamity"), loss(3, "PEST", "pest_disease")],
};

describe("Plant losses on Agricultural Analytics", () => {
  it("says so when no plant has been lost", () => {
    data = { ...full, total: 0, losses: [] };
    render(<PlantLossCard />);
    expect(screen.getByText("No plants lost")).toBeInTheDocument();
  });

  it("shows the totals, only the causes that took a plant, and the months", () => {
    data = full;
    render(<PlantLossCard />);
    expect(screen.getByText("Lost before harvest")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByLabelText(/Calamity: 2 plants, 67%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pest infestation: 1 plant, 33%/)).toBeInTheDocument();
    expect(screen.queryByText("Lack of water")).not.toBeInTheDocument();
    expect(screen.getByText("3 plants lost in the last 6 months.")).toBeInTheDocument();
  });

  it("links Officers to the Plant Loss page, not Admins", () => {
    data = full;
    role = "lgu";
    const { unmount } = render(<PlantLossCard />);
    expect(screen.getByRole("link", { name: /Plant Loss/ })).toHaveAttribute("href", "/lgu/plant-loss");
    unmount();
    role = "admin";
    render(<PlantLossCard />);
    expect(screen.queryByRole("link", { name: /Plant Loss/ })).not.toBeInTheDocument();
  });
});
