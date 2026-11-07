import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HarvestCalendar } from "@/components/farmer/harvest-calendar";
import { HarvestPlantCard } from "@/components/farmer/harvest-plant-card";
import { phaseOf, timeline } from "@/lib/harvest";
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
    // Never "0 day".
    expect(humanDuration(0)).toBe("0 days");
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

/** Dates relative to the real today, since the card reads the clock. */
function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("the harvest card", () => {
  const ready = plant({
    crop: {
      id: "watermelon",
      name: "Watermelon",
      emoji: "🍉",
      category: "fruit",
      category_label: "Fruit",
      growing_duration_days: 90,
      harvest_window_days: 21,
    },
    variant: null,
    display_name: "Watermelon",
    planting_date: isoIn(-95),
    expected_harvest_start: isoIn(-5),
    expected_harvest_end: isoIn(16),
    age_days: 95,
  } as Partial<BackendPlant>);

  it("tells the farmer to harvest now, and how to tell it is ripe", () => {
    render(<HarvestPlantCard plant={ready} />);
    expect(screen.getByText(/Harvest now, until/)).toBeInTheDocument();
    expect(screen.getByText("Fully grown")).toBeInTheDocument();
    expect(screen.getByText(/creamy yellow/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View plant/ })).toHaveAttribute(
      "href",
      "/farmer/plants/1",
    );
  });

  it("marks a ready plant as harvested", async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    render(<HarvestPlantCard plant={ready} onStatusChange={onStatusChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));
    expect(onStatusChange).toHaveBeenCalledWith(ready, "HARVESTED");
  });

  it("offers no harvest button to a plant that is still growing", () => {
    const young = plant({ planting_date: isoIn(0), expected_harvest_start: isoIn(1460), expected_harvest_end: isoIn(1550) });
    render(<HarvestPlantCard plant={young} onStatusChange={vi.fn()} />);
    expect(phaseOf(young)).toBe("growing");
    expect(screen.queryByRole("button", { name: /Mark as harvested/ })).not.toBeInTheDocument();
    expect(screen.getByText(/0 days of about 4 years grown/)).toBeInTheDocument();
  });

  it("says what to do when the harvest time has passed, and can undo a harvest", async () => {
    const late = { ...ready, expected_harvest_start: isoIn(-30), expected_harvest_end: isoIn(-9) };
    const { unmount } = render(<HarvestPlantCard plant={late} onStatusChange={vi.fn()} />);
    expect(screen.getByText(/Harvest time ended on/)).toBeInTheDocument();
    expect(screen.getByText(/may be over-ripe/)).toBeInTheDocument();
    expect(screen.queryByText(/of about .* grown/)).not.toBeInTheDocument();
    unmount();

    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const done = { ...late, status: "HARVESTED" } as BackendPlant;
    render(<HarvestPlantCard plant={done} onStatusChange={onStatusChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Undo harvest/ }));
    expect(onStatusChange).toHaveBeenCalledWith(done, "GROWING");
  });

  it("keeps the harvest window visible on a tree crop's timeline", () => {
    const tree = plant({ planting_date: isoIn(0), expected_harvest_start: isoIn(1460), expected_harvest_end: isoIn(1550) });
    const { windowWidth, todayAt } = timeline(tree);
    expect(windowWidth).toBeGreaterThanOrEqual(8);
    expect(todayAt).toBe(0);
  });
});
