import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssessmentTrendChart } from "@/components/farmer/assessment-trend-chart";
import { CropSuggestionsCard } from "@/components/farmer/crop-suggestions-card";
import { FarmAlerts } from "@/components/farmer/farm-alerts";
import { HarvestSchedule } from "@/components/farmer/harvest-schedule";
import type { BackendPlant } from "@/lib/api/plants-api";
import type {
  AssessmentTrend,
  CropSuggestions,
  UpcomingHarvest,
} from "@/lib/api/dashboard-api";

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

const NO_SUGGESTIONS: CropSuggestions = {
  has_any: false,
  recorded_on: null,
  crops: [],
};

const SUGGESTED: CropSuggestions = {
  has_any: true,
  recorded_on: "2026-09-19",
  crops: [
    {
      id: "pineapple",
      name: "Pineapple",
      emoji: "🍍",
      reason: "Suited to the acidic soil pH you recorded.",
      planting_months: [2, 3, 4, 5, 6, 7, 8],
      caution_months: [9, 1],
    },
    {
      id: "eggplant",
      name: "Eggplant",
      emoji: "🍆",
      reason: "Tolerates the moisture measured.",
      planting_months: [2, 3, 4, 5],
      caution_months: [6, 7, 8, 1],
    },
  ],
};

describe("CropSuggestionsCard", () => {
  // "Today" is fixed so the card's default date is deterministic. Without
  // it the answer changes with the month the suite happens to run in, and
  // every assertion below would have to be written as a maybe.
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderOn(iso: string, suggestions = SUGGESTED) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${iso}T08:00:00`));
    return render(<CropSuggestionsCard suggestions={suggestions} />);
  }

  it("lists the crops worth planting on the date shown", () => {
    // March: both crops are in their planting window.
    renderOn("2026-03-15");
    expect(screen.getByRole("link", { name: /Pineapple/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eggplant/ })).toBeInTheDocument();
  });

  it("drops crops that are out of season for that date", () => {
    // October sits in Bulan's rainfall and typhoon peak.
    renderOn("2026-10-15");
    expect(screen.queryByRole("link", { name: /Pineapple/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Eggplant/ })).not.toBeInTheDocument();
  });

  it("says so plainly when nothing is in season, rather than sitting empty", () => {
    renderOn("2026-10-15");
    expect(
      screen.getByText(/None of your soil's crops are in season in October/),
    ).toBeInTheDocument();
  });

  it("offers a calendar in place of the old link", () => {
    renderOn("2026-03-15");
    const picker = screen.getByRole("button", { name: /Mar 15/ });
    expect(picker).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("carries the crop and the chosen date into Add Plant", () => {
    renderOn("2026-03-15");
    expect(screen.getByRole("link", { name: /Pineapple/ })).toHaveAttribute(
      "href",
      "/farmer/plants/new?crop=pineapple&date=2026-03-15",
    );
  });

  it("says why each crop suits the soil", () => {
    renderOn("2026-03-15");
    expect(
      screen.getByText("Suited to the acidic soil pH you recorded."),
    ).toBeInTheDocument();
  });

  it("dates the soil reading the advice came from", () => {
    renderOn("2026-03-15");
    expect(screen.getByText(/September 19, 2026/)).toBeInTheDocument();
  });

  it("announces the list when the date changes", () => {
    renderOn("2026-03-15");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("invites a first reading when there is nothing to suggest", () => {
    render(<CropSuggestionsCard suggestions={NO_SUGGESTIONS} />);
    expect(
      screen.getByText(/Enter your soil detector readings/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get recommendation" }),
    ).toBeInTheDocument();
  });

  it("shows no calendar before there is anything to filter", () => {
    render(<CropSuggestionsCard suggestions={NO_SUGGESTIONS} />);
    expect(screen.queryByRole("button", { name: /Pick a date/ })).not.toBeInTheDocument();
  });

  it("does not present AI advice as a substitute for an agriculturist", () => {
    renderOn("2026-03-15");
    expect(screen.getByText(/LGU agriculturist/)).toBeInTheDocument();
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

  function renderWithPlants(
    iso: string,
    plants: BackendPlant[],
    suggestions = SUGGESTED,
  ) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(`${iso}T08:00:00`));
    return render(
      <CropSuggestionsCard suggestions={suggestions} plants={plants} />,
    );
  }

  it("shows the plants that were planted on the picked date", () => {
    renderWithPlants("2026-09-19", [
      plantedOn(7, "Pineapple", "2026-09-19"),
      plantedOn(8, "Okra", "2026-09-18"),
    ]);
    expect(screen.getByText(/Planted on September 19, 2026/)).toBeInTheDocument();
    // Pineapple is also in season in September, so it can appear twice; the
    // planted one is the one that opens the farmer's own plant.
    const planted = screen.getByRole("region", { name: "Planted on this date" });
    expect(within(planted).getByRole("link", { name: /Pineapple/ })).toHaveAttribute(
      "href",
      "/farmer/plants/7",
    );
    expect(screen.queryByRole("link", { name: /Okra/ })).not.toBeInTheDocument();
  });

  it("leaves archived plants out of what was planted", () => {
    renderWithPlants("2026-09-19", [
      plantedOn(7, "Pineapple", "2026-09-19", "ARCHIVED"),
    ]);
    expect(screen.queryByText(/Planted on/)).not.toBeInTheDocument();
  });

  it("offers the calendar for planted days even before a soil reading", () => {
    renderWithPlants(
      "2026-09-19",
      [plantedOn(7, "Pineapple", "2026-09-19")],
      NO_SUGGESTIONS,
    );
    expect(screen.getByRole("button", { name: /Sep 19/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pineapple/ })).toBeInTheDocument();
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
