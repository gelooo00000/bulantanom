import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssessmentTrendChart } from "@/components/farmer/assessment-trend-chart";
import { EnvironmentPanel } from "@/components/farmer/environment-panel";
import { FarmAlerts } from "@/components/farmer/farm-alerts";
import { HarvestSchedule } from "@/components/farmer/harvest-schedule";
import type {
  AssessmentTrend,
  FarmEnvironment,
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

const NO_READINGS: FarmEnvironment = {
  has_any: false,
  latest: null,
  history: [],
  not_collected: ["temperature", "humidity"],
};

describe("EnvironmentPanel", () => {
  it("says what the farm does not measure instead of drawing empty gauges", () => {
    render(<EnvironmentPanel environment={NO_READINGS} />);
    expect(
      screen.getByText(/Temperature and Humidity are not measured at Layuan Farm/),
    ).toBeInTheDocument();
  });

  it("invites a first reading when none exists", () => {
    render(<EnvironmentPanel environment={NO_READINGS} />);
    expect(screen.getByText(/No soil reading recorded yet/)).toBeInTheDocument();
  });

  it("shows the latest moisture and pH", () => {
    render(
      <EnvironmentPanel
        environment={{
          has_any: true,
          latest: {
            recorded_on: "2026-09-10",
            soil_moisture: "moist",
            soil_moisture_label: "Moist",
            ph_level: 6.4,
            soil_type_label: "Loamy",
            drainage_label: "Good",
          },
          history: [],
          not_collected: ["temperature", "humidity"],
        }}
      />,
    );
    expect(screen.getByText("Moist")).toBeInTheDocument();
    expect(screen.getByText("6.4")).toBeInTheDocument();
  });

  it("renders an unknown pH as not recorded, never as zero", () => {
    render(
      <EnvironmentPanel
        environment={{
          has_any: true,
          latest: {
            recorded_on: "2026-09-10",
            soil_moisture: null,
            soil_moisture_label: null,
            ph_level: null,
            soil_type_label: "Loamy",
            drainage_label: "Good",
          },
          history: [],
          not_collected: [],
        }}
      />,
    );
    expect(screen.getAllByText("Not recorded")).toHaveLength(2);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders two readings taken on the same day without a key collision", () => {
    // Dates do not identify a reading — the farmer can record twice in one
    // day — so the scale keys its marks on the row id.
    //
    // The console spy is the part that actually catches a regression here:
    // React renders both elements even with duplicate keys and only warns,
    // so asserting on the rendered output alone passes either way. The
    // warning is the defect.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <EnvironmentPanel
        environment={{
          has_any: true,
          latest: {
            recorded_on: "2026-09-14",
            soil_moisture: "moist",
            soil_moisture_label: "Moist",
            ph_level: 8.9,
            soil_type_label: "Clay Loam",
            drainage_label: "Moderate",
          },
          history: [
            { id: 1, date: "2026-09-14", ph: 8.4, moisture: "moist", moisture_rank: 4 },
            { id: 2, date: "2026-09-14", ph: 8.9, moisture: "moist", moisture_rank: 4 },
          ],
          not_collected: [],
        }}
      />,
    );

    // The reading is interpreted, not just plotted.
    expect(screen.getByText(/· Strongly alkaline/)).toBeInTheDocument();

    const duplicateKeyWarning = consoleError.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("same key")),
    );
    expect(duplicateKeyWarning).toBe(false);
  });

  it("shows the pH scale whenever a pH was recorded, even for one reading", () => {
    // The old dot plot needed two readings to draw anything, so a farmer
    // with a single reading saw no pH context at all. A scale needs one.
    render(
      <EnvironmentPanel
        environment={{
          has_any: true,
          latest: {
            recorded_on: "2026-09-10",
            soil_moisture: "moist",
            soil_moisture_label: "Moist",
            ph_level: 6.4,
            soil_type_label: "Loamy",
            drainage_label: "Good",
          },
          history: [
            { id: 1, date: "2026-09-10", ph: 6.4, moisture: "moist", moisture_rank: 4 },
          ],
          not_collected: [],
        }}
      />,
    );
    expect(screen.getByText(/· Ideal for most crops/)).toBeInTheDocument();
    expect(screen.getByText(/Green band is pH 6–7/)).toBeInTheDocument();
  });

  it("shows no pH scale when the farmer did not record a pH", () => {
    render(
      <EnvironmentPanel
        environment={{
          has_any: true,
          latest: {
            recorded_on: "2026-09-10",
            soil_moisture: "moist",
            soil_moisture_label: "Moist",
            ph_level: null,
            soil_type_label: "Loamy",
            drainage_label: "Good",
          },
          history: [],
          not_collected: [],
        }}
      />,
    );
    expect(screen.queryByText(/Green band/)).not.toBeInTheDocument();
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
