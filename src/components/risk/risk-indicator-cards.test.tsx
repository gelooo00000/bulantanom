import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RiskIndicatorPage from "@/app/farmer/risk-indicator/page";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plant(id: number, name: string, eligibility: Record<string, unknown>) {
  return {
    id,
    crop: { id: "tomato", name: "Tomato", emoji: "🍅", category: "vegetable", category_label: "Vegetable" },
    display_name: name,
    age_days: 40,
    assessment_eligibility: { can_assess: false, days_remaining: 3, ...eligibility },
  };
}

let plants: unknown[] = [];
const refetch = vi.fn();
const reportPlantLost = vi.fn();
const reanalyzeAssessment = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: { plants }, loading: false, error: null, refetch }),
}));
vi.mock("@/components/lgu/risk-pie", () => ({ DonutChart: () => null }));
vi.mock("@/components/lgu/dashboard-charts", () => ({ HorizontalBars: () => null }));
vi.mock("@/lib/api/plants-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/plants-api")>()),
  reportPlantLost: (...args: unknown[]) => reportPlantLost(...args),
}));
vi.mock("@/lib/api/risk-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/risk-api")>()),
  reanalyzeAssessment: (...args: unknown[]) => reanalyzeAssessment(...args),
}));

beforeEach(() => {
  refetch.mockReset();
  reportPlantLost.mockReset();
  reanalyzeAssessment.mockReset();
});

describe("a risky plant's card", () => {
  it("says what to do, how it changed, and offers an early re-check", () => {
    plants = [
      {
        plant: plant(1, "Back Row", {
          can_assess: true,
          early_recheck: true,
          days_remaining: 0,
          next_assessment_date: isoDaysAgo(-3),
        }),
        latest_assessment: {
          id: 9,
          assessment_date: isoDaysAgo(4),
          risk: {
            status: "completed",
            risk_level: "HIGH",
            recommended_actions: ["Remove the yellow leaves.", "Spray neem oil.", "Water less."],
          },
        },
        previous_risk_level: "LOW",
      },
    ];
    render(<RiskIndicatorPage />);
    expect(screen.getByText("What to do")).toBeInTheDocument();
    expect(screen.getByText("Remove the yellow leaves.")).toBeInTheDocument();
    expect(screen.getByText("Spray neem oil.")).toBeInTheDocument();
    expect(screen.queryByText("Water less.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See what to do/ })).toHaveAttribute(
      "href",
      "/farmer/assessments/9",
    );
    expect(screen.getByText("Was Low Risk")).toBeInTheDocument();
    expect(screen.getByText("Check again early")).toBeInTheDocument();
  });

  it("marks an overdue check and an old reading", () => {
    plants = [
      {
        plant: plant(2, "Old One", {
          can_assess: true,
          days_remaining: 0,
          next_assessment_date: isoDaysAgo(9),
        }),
        latest_assessment: {
          id: 3,
          assessment_date: isoDaysAgo(16),
          risk: { status: "completed", risk_level: "LOW", recommended_actions: [] },
        },
        previous_risk_level: null,
      },
    ];
    render(<RiskIndicatorPage />);
    expect(screen.getByText("Overdue 9 days")).toBeInTheDocument();
    expect(screen.getByText("Old reading – check again")).toBeInTheDocument();
    expect(screen.queryByText("What to do")).not.toBeInTheDocument();
  });

  it("offers to retry a check that failed", async () => {
    reanalyzeAssessment.mockResolvedValue({});
    plants = [
      {
        plant: plant(3, "Failed One", {}),
        latest_assessment: {
          id: 5,
          assessment_date: isoDaysAgo(1),
          risk: { status: "failed", risk_level: null, recommended_actions: [] },
        },
      },
    ];
    render(<RiskIndicatorPage />);
    expect(screen.getByText("Check failed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reanalyzeAssessment).toHaveBeenCalledWith("token", 5);
    expect(refetch).toHaveBeenCalled();
  });

  it("reports a plant that died instead of deleting it", async () => {
    reportPlantLost.mockResolvedValue({});
    plants = [{ plant: plant(4, "Typhoon Row", {}), latest_assessment: null }];
    render(<RiskIndicatorPage />);
    await userEvent.click(screen.getByRole("button", { name: "Plant died?" }));
    const form = await screen.findByRole("dialog", { name: "Report a lost plant" });

    await userEvent.click(within(form).getByRole("button", { name: "Report lost plant" }));
    expect(within(form).getByRole("alert")).toHaveTextContent(/what happened and when/);
    expect(reportPlantLost).not.toHaveBeenCalled();

    await userEvent.click(within(form).getByRole("button", { name: "Flood or typhoon" }));
    await userEvent.click(within(form).getByRole("button", { name: "Today" }));
    await userEvent.click(within(form).getByRole("button", { name: "Report lost plant" }));
    expect(reportPlantLost).toHaveBeenCalledWith(
      "token",
      4,
      expect.objectContaining({ cause: "FLOOD_TYPHOON", noticed: "TODAY" }),
    );
    expect(await screen.findByText(/Typhoon Row was recorded as lost/)).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });
});
