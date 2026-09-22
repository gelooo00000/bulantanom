import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssessmentTrendChart } from "@/components/farmer/assessment-trend-chart";
import { CropSuggestionsCard } from "@/components/farmer/crop-suggestions-card";
import { FarmAlerts } from "@/components/farmer/farm-alerts";
import { HarvestSchedule } from "@/components/farmer/harvest-schedule";
import type { BackendPlant } from "@/lib/api/plants-api";
import type { AssessmentTrend, UpcomingHarvest } from "@/lib/api/dashboard-api";

/**
 * These pin the dashboard's central promise: it shows what the farm actually
 * recorded, and says so plainly when the farm recorded nothing. A missing
 * reading rendered as a zero would read as a real measurement, which is the
 * one failure mode that would make the page worse than having no page.
 */

function trend(counts: number[]): AssessmentTrend {
  return {
    days: counts.map((count, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      count,
    })),
    total: counts.reduce((a, b) => a + b, 0),
    range_days: counts.length,
    busiest_count: Math.max(...counts, 0),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssessmentTrendChart", () => {
  it("reports the total over the window", () => {
    render(<AssessmentTrendChart trend={trend([1, 2, 1])} />);
    expect(screen.getByText("4 assessments in the last 3 days.")).toBeInTheDocument();
  });

  it("says plainly when there was no activity", () => {
    render(<AssessmentTrendChart trend={trend([0, 0, 0])} />);
    expect(screen.getByText("No assessments in the last 3 days.")).toBeInTheDocument();
  });

  it("describes the line for a screen reader", () => {
    render(<AssessmentTrendChart trend={trend([1, 2, 1])} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "4 assessments over the last 3 days, busiest day 2.",
    );
  });

  it("lists only the days with activity in the table", async () => {
    const user = userEvent.setup();
    render(<AssessmentTrendChart trend={trend([1, 0, 2])} />);

    await user.click(screen.getByRole("button", { name: "Show numbers" }));

    const rows = screen.getAllByRole("row");
    // Header plus the two days that had assessments — not thirty zero rows.
    expect(rows).toHaveLength(3);
  });

  it("renders nothing when the server sent no days", () => {
    const { container } = render(
      <AssessmentTrendChart
        trend={{ days: [], total: 0, range_days: 0, busiest_count: 0 }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CropSuggestionsCard", () => {
  // "Today" is fixed so the card's default date is deterministic.
  afterEach(() => {
    vi.useRealTimers();
  });

  // Only the fields the card reads; the rest of a plant is irrelevant here.
  function plantedOn(
    id: number,
    name: string,
    date: string,
    status: BackendPlant["status"] = "GROWING",
  ): BackendPlant {
    return {
      id,
      display_name: name,
      planting_date: date,
      status,
      status_label: "Growing",
      crop: { emoji: "🍍" },
    } as BackendPlant;
  }

  const PLANTS = [
    plantedOn(7, "Pineapple", "2026-09-19"),
    plantedOn(8, "Banana", "2026-09-19"),
    plantedOn(9, "Okra", "2026-09-18"),
  ];

  function renderOn(iso: string, plants: BackendPlant[] = PLANTS) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${iso}T08:00:00`));
    return render(<CropSuggestionsCard plants={plants} />);
  }

  it("shows only the plants planted on the picked date", () => {
    renderOn("2026-09-19");
    expect(screen.getByText("Planted on September 19, 2026 · 2 plants")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Planted on this date" });
    expect(within(list).getByRole("link", { name: /Pineapple/ })).toHaveAttribute(
      "href",
      "/farmer/plants/7",
    );
    expect(within(list).getByRole("link", { name: /Banana/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Okra/ })).not.toBeInTheDocument();
  });

  it("no longer lists crops to plant — only what was planted", () => {
    renderOn("2026-09-19");
    expect(screen.queryByText(/Suited to plant in/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LGU agriculturist/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says plainly when nothing was planted that day", () => {
    renderOn("2026-09-20");
    expect(screen.getByText("Nothing was planted on September 20, 2026.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("calls a future day's plants planned, not planted", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn("2026-09-19", [
      plantedOn(7, "Pineapple", "2026-09-19"),
      { ...plantedOn(8, "Corn", "2026-09-25"), is_planned: true },
    ]);
    await user.click(screen.getByRole("button", { name: /Sep 19/ }));
    await user.click(screen.getByRole("button", { name: "25" }));
    expect(screen.getByText("Planned for September 25, 2026 · 1 plant")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("says nothing is planned for an empty future day", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn("2026-09-19");
    await user.click(screen.getByRole("button", { name: /Sep 19/ }));
    await user.click(screen.getByRole("button", { name: "28" }));
    expect(screen.getByText("Nothing is planned for September 28, 2026.")).toBeInTheDocument();
  });

  it("leaves archived plants out", () => {
    renderOn("2026-09-19", [plantedOn(7, "Pineapple", "2026-09-19", "ARCHIVED")]);
    expect(screen.queryByRole("link", { name: /Pineapple/ })).not.toBeInTheDocument();
  });

  it("offers the calendar, opening on today", () => {
    renderOn("2026-09-19");
    const picker = screen.getByRole("button", { name: /Sep 19/ });
    expect(picker).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens the calendar from the right edge, so it stays inside the card", async () => {
    // Regression: opening from the trigger's left edge pushed the calendar
    // past the card and off the screen, and the page shifted sideways.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn("2026-09-19");
    await user.click(screen.getByRole("button", { name: /Sep 19/ }));
    const calendar = screen.getByRole("dialog", { name: "Choose planting date" });
    expect(calendar).toHaveClass("right-0");
    expect(calendar).not.toHaveClass("left-0");
  });

  it("invites a first plant when there are none, with no calendar", () => {
    renderOn("2026-09-19", []);
    expect(screen.getByText(/Plants you add will appear here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a plant" })).toHaveAttribute(
      "href",
      "/farmer/plants/new",
    );
    expect(screen.queryByRole("button", { name: /Sep 19/ })).not.toBeInTheDocument();
  });
});

const HARVEST: UpcomingHarvest = {
  plant_id: 1,
  name: "Watermelon",
  crop_name: "Watermelon",
  emoji: "🍉",
  expected_harvest_start: "2026-12-13",
  days_away: 90,
  in_window: false,
};

describe("HarvestSchedule", () => {
  it("lists upcoming harvests with their dates", () => {
    render(<HarvestSchedule harvests={[HARVEST]} />);
    expect(screen.getByText("Watermelon")).toBeInTheDocument();
    expect(screen.getByText("December 13, 2026")).toBeInTheDocument();
  });

  it("flags a plant already inside its window", () => {
    render(
      <HarvestSchedule
        harvests={[{ ...HARVEST, in_window: true, days_away: -2 }]}
      />,
    );
    expect(screen.getByText("Ready now")).toBeInTheDocument();
  });

  it("scales the wording from days to months to years", () => {
    render(
      <HarvestSchedule
        harvests={[
          { ...HARVEST, plant_id: 1, days_away: 5 },
          { ...HARVEST, plant_id: 2, days_away: 90 },
          { ...HARVEST, plant_id: 3, days_away: 1400 },
        ]}
      />,
    );
    expect(screen.getByText("in 5 days")).toBeInTheDocument();
    expect(screen.getByText("in 3 months")).toBeInTheDocument();
    expect(screen.getByText("in 4 years")).toBeInTheDocument();
  });

  it("says so when nothing is scheduled", () => {
    render(<HarvestSchedule harvests={[]} />);
    expect(screen.getByText(/No harvests scheduled/)).toBeInTheDocument();
  });
});

describe("FarmAlerts", () => {
  it("confirms an all-clear rather than hiding the section", () => {
    render(<FarmAlerts alerts={[]} hasPlants />);
    expect(
      screen.getByText("Nothing needs your attention right now."),
    ).toBeInTheDocument();
  });

  it("stays out of the way entirely on a farm with no plants", () => {
    const { container } = render(<FarmAlerts alerts={[]} hasPlants={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each alert with its action and link", () => {
    render(
      <FarmAlerts
        hasPlants
        alerts={[
          {
            severity: "high",
            message: "2 plants read high risk on their last assessment.",
            href: "/farmer/risk-indicator",
            action: "Review",
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /2 plants read high risk/ });
    expect(link).toHaveAttribute("href", "/farmer/risk-indicator");
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
