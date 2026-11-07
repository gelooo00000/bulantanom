import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RiskIndicatorPage from "@/app/farmer/risk-indicator/page";

function plant(id: number) {
  return {
    id,
    crop: { id: "tomato", name: "Tomato", emoji: "🍅", category: "vegetable", category_label: "Vegetable" },
    display_name: `Plant ${String(id).padStart(2, "0")}`,
    age_days: 20,
    assessment_eligibility: { can_assess: false, days_remaining: 3 },
  };
}

function assessment(id: number, level: string) {
  return { id, assessment_date: "2026-11-01", risk: { risk_level: level } };
}

// 5 with a reading, 5 too early, 8 with none.
const plants = [
  ...[1, 2, 3, 4, 5].map((id) => ({ plant: plant(id), latest_assessment: assessment(id, "HIGH") })),
  ...[6, 7, 8, 9, 10].map((id) => ({ plant: plant(id), latest_assessment: assessment(id, "INCONCLUSIVE") })),
  ...[11, 12, 13, 14, 15, 16, 17, 18].map((id) => ({ plant: plant(id), latest_assessment: null })),
];

vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: { plants }, loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/components/lgu/risk-pie", () => ({ DonutChart: () => null }));
vi.mock("@/components/lgu/dashboard-charts", () => ({ HorizontalBars: () => null }));

describe("the risk indicator lists", () => {
  it("shows 4, 4 and 6 cards a page, with Next for the rest", async () => {
    render(<RiskIndicatorPage />);
    const cards = (name: string) => within(screen.getByRole("list", { name })).getAllByRole("listitem");

    expect(cards("With a risk reading")).toHaveLength(4);
    expect(cards("Too early to tell")).toHaveLength(4);
    expect(cards("No risk level yet")).toHaveLength(6);

    const section = screen.getByRole("region", { name: "No risk level yet" });
    await userEvent.click(within(section).getByRole("button", { name: /Next/ }));
    expect(await within(section).findByText("Plant 18")).toBeInTheDocument();
  });
});
