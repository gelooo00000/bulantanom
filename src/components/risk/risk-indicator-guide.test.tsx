import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RiskIndicatorPage from "@/app/farmer/risk-indicator/page";

const plants = [
  {
    plant: {
      id: 1,
      crop: { id: "tomato", name: "Tomato", emoji: "🍅", category: "vegetable", category_label: "Vegetable" },
      display_name: "Plant 01",
      age_days: 20,
      assessment_eligibility: { can_assess: false, days_remaining: 3 },
    },
    latest_assessment: null,
  },
];

vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: { plants }, loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/components/lgu/risk-pie", () => ({ DonutChart: () => null }));
vi.mock("@/components/lgu/dashboard-charts", () => ({ HorizontalBars: () => null }));

describe("Risk Indicator guide", () => {
  beforeEach(() => window.localStorage.clear());

  it("has a risk section and a plant-died section", async () => {
    render(<RiskIndicatorPage />);
    expect(
      await screen.findByRole("heading", { name: "How to use the Risk Indicator" }),
    ).toBeInTheDocument();
    const risk = screen.getByRole("region", { name: "Risk indicator" });
    expect(within(risk).getByText("Check it every week")).toBeInTheDocument();
    const died = screen.getByRole("region", { name: "If a plant dies" });
    expect(within(died).getByText("Tap “Plant died?”")).toBeInTheDocument();
  });

  it("hides on request, remembers it, and comes back from “How to use”", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RiskIndicatorPage />);
    await user.click(await screen.findByRole("button", { name: "Hide" }));
    expect(screen.queryByText("How to use the Risk Indicator")).not.toBeInTheDocument();

    unmount();
    render(<RiskIndicatorPage />);
    await user.click(await screen.findByRole("button", { name: "How to use" }));
    expect(screen.getByText("How to use the Risk Indicator")).toBeInTheDocument();
  });
});
