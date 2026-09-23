import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HarvestCalendar } from "@/components/farmer/harvest-calendar";
import { humanDuration } from "@/lib/duration";
import type { BackendPlant } from "@/lib/api/plants-api";

/**
 * A Cardinal avocado is 1460 days from harvest. The page used to say so in
 * those words — "1460 days to go", "Day 0 of 1460" — which is the system's
 * bookkeeping, not an answer a farmer can use.
 */

const TODAY = new Date(2026, 8, 23); // 23 September 2026

function plant(overrides: Partial<BackendPlant>): BackendPlant {
  return {
    id: 1,
    crop: {
      id: "avocado",
      name: "Avocado",
      emoji: "🥑",
      category: "fruit",
      category_label: "Fruit",
      growing_duration_days: 1460,
      harvest_window_days: 90,
    },
    variant: { id: "avocado-cardinal", name: "Cardinal" },
    label: "",
    display_name: "Cardinal",
    planting_date: "2026-09-23",
    expected_harvest_start: "2030-09-22",
    expected_harvest_end: "2030-12-21",
    status: "GROWING",
    status_label: "Growing",
    age_days: 0,
    is_planned: false,
    assessment_eligibility: { can_assess: true, days_remaining: 0, interval_days: 7 },
    ...overrides,
  } as unknown as BackendPlant;
}

describe("how long things take", () => {
  it("says years for tree crops instead of counting days", () => {
    expect(humanDuration(1460)).toBe("about 4 years");
    expect(humanDuration(1825)).toBe("about 5 years");
    expect(humanDuration(365)).toBe("about 1 year");
  });

  it("keeps the scale each crop is judged on", () => {
    expect(humanDuration(90)).toBe("about 3 months");
    expect(humanDuration(21)).toBe("about 3 weeks");
    expect(humanDuration(6)).toBe("6 days");
    expect(humanDuration(1)).toBe("1 day");
  });

  it("does not report four years and a few weeks as four years one month", () => {
    expect(humanDuration(1500)).toBe("about 4 years");
  });
});

describe("the harvest calendar", () => {
  const corn = plant({
    id: 2,
    crop: {
      id: "corn",
      name: "Corn",
      emoji: "🌽",
      category: "vegetable",
      category_label: "Vegetable",
      growing_duration_days: 90,
      harvest_window_days: 14,
    },
    variant: null,
    display_name: "Corn",
    expected_harvest_start: "2026-12-10",
    expected_harvest_end: "2026-12-24",
  } as Partial<BackendPlant>);

  it("counts a harvest into its month, and one years away as later", () => {
    render(<HarvestCalendar plants={[plant({}), corn]} today={TODAY} />);
    expect(screen.getByText(/1 plant ready in the next 12 months/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 more plant is further away than 12 months/),
    ).toBeInTheDocument();
  });

  it("names the plants ready in a month when that month is pointed at", async () => {
    const user = userEvent.setup();
    render(<HarvestCalendar plants={[plant({}), corn]} today={TODAY} />);
    expect(screen.getByText(/Point at a month/)).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: /December 2026/ }));
    expect(screen.getByText(/Ready in December 2026 · 1 plant/)).toBeInTheDocument();
    expect(screen.getByText("Corn")).toBeInTheDocument();
  });
});
