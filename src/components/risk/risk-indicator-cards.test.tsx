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
    // Only the first step on the card; the arrow opens the rest.
    expect(screen.queryByText("Spray neem oil.")).not.toBeInTheDocument();
    // The arrow opens the full reading; no second "See what to do" link.
    expect(screen.queryByText("See what to do")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back Row/ })).toHaveAttribute("href", "/farmer/assessments/9");
    expect(screen.getByText("High risk – act now")).toBeInTheDocument();
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
    // "Overdue" already says to check it again.
    expect(screen.queryByText("Old reading – check again")).not.toBeInTheDocument();
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

  it("makes Plant died? a clear button", () => {
    plants = [{ plant: plant(6, "Any Row", {}), latest_assessment: null }];
    render(<RiskIndicatorPage />);
    expect(screen.getByRole("button", { name: "Plant died?" })).toBeInTheDocument();
  });
});

describe("What to do now", () => {
  it("lists one task per plant from the risk readings, most urgent first", async () => {
    plants = [
      {
        plant: plant(10, "Due Row", {
          can_assess: true,
          days_remaining: 0,
          last_assessment_date: isoDaysAgo(7),
          next_assessment_date: isoDaysAgo(0),
        }),
        latest_assessment: null,
      },
      {
        plant: plant(11, "Sick Row", { can_assess: false, days_remaining: 2 }),
        latest_assessment: {
          id: 21,
          assessment_date: isoDaysAgo(2),
          risk: { status: "completed", risk_level: "HIGH", recommended_actions: [] },
        },
      },
      {
        plant: plant(12, "Late Row", {
          can_assess: true,
          days_remaining: 0,
          next_assessment_date: isoDaysAgo(5),
        }),
        latest_assessment: {
          id: 22,
          assessment_date: isoDaysAgo(12),
          risk: { status: "completed", risk_level: "LOW", recommended_actions: [] },
        },
      },
      {
        plant: plant(13, "Fine Row", { can_assess: false, days_remaining: 4 }),
        latest_assessment: {
          id: 23,
          assessment_date: isoDaysAgo(3),
          risk: { status: "completed", risk_level: "LOW", recommended_actions: [] },
        },
      },
    ];
    render(<RiskIndicatorPage />);
    const trigger = screen.getByRole("button", { name: "What to do now (3)" });
    await userEvent.click(trigger);
    const popup = await screen.findByRole("dialog");
    const tasks = within(popup).getAllByRole("listitem").map((li) => li.textContent);
    expect(tasks[0]).toMatch(/Late Row: the weekly check is 5 days late/);
    expect(tasks[1]).toMatch(/Sick Row is at High risk/);
    expect(tasks[2]).toMatch(/weekly check for Due Row is due/);
    expect(within(popup).getByRole("link", { name: /Late Row/ })).toHaveAttribute(
      "href",
      "/farmer/plants/12/assessment",
    );
  });

  it("counts a never-checked plant as late from a week after planting", () => {
    plants = [
      {
        plant: {
          ...plant(14, "Never Row", { can_assess: true, days_remaining: 0, next_assessment_date: null, last_assessment_date: null }),
          age_days: 34,
        },
        latest_assessment: null,
      },
    ];
    render(<RiskIndicatorPage />);
    expect(screen.getByText("Overdue 27 days")).toBeInTheDocument();
  });

  it("marks an old reading when the check is not yet late", () => {
    plants = [
      {
        plant: plant(15, "Quiet Row", { can_assess: false, days_remaining: 2 }),
        latest_assessment: {
          id: 30,
          assessment_date: isoDaysAgo(20),
          risk: { status: "completed", risk_level: "LOW", recommended_actions: [] },
        },
      },
    ];
    render(<RiskIndicatorPage />);
    expect(screen.getByText("Old reading – check again")).toBeInTheDocument();
  });
});
