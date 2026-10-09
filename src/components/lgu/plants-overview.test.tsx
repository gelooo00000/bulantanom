import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CropsPlanted, HarvestOutlook, PlantsOverview } from "@/components/lgu/plants-overview";
import type { LguPlant } from "@/lib/api/lgu-api";

const FRUIT = "Fruit";
const VEG = "Vegetables & Crops";

function plant(id: number, crop: string, emoji: string, type: string): LguPlant {
  return {
    id,
    crop: { id: crop.toLowerCase(), name: crop, emoji, category_label: type },
    display_name: crop,
    planting_date: "2026-06-01",
    expected_harvest_start: "2026-10-10",
    expected_harvest_end: "2026-11-10",
    status: "GROWING",
    status_label: "Growing",
    age_days: 100,
    farmer: { id: 1, full_name: "Juan Cruz", email: "juan@example.com" },
    latest_risk: null,
  };
}

const PLANTS = [
  plant(1, "Pineapple", "🍍", FRUIT),
  plant(2, "Pineapple", "🍍", FRUIT),
  plant(3, "Banana", "🍌", FRUIT),
  plant(4, "Eggplant", "🍆", VEG),
];

function renderCard() {
  render(<CropsPlanted plants={PLANTS} />);
}

const fruitRow = () => screen.getByRole("button", { name: /^Fruit: 3 plants/ });

describe("CropsPlanted", () => {
  it("shows only the crop types until one is pointed at", () => {
    renderCard();
    expect(fruitRow()).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Pineapple/)).not.toBeInTheDocument();
    expect(screen.getByText(/Point at Fruit or Vegetables & Crops/)).toBeInTheDocument();
  });

  it("reveals a type's crops while it is pointed at, and hides them after", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.hover(fruitRow());
    expect(screen.getByLabelText(/^Pineapple: 2 plants/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Banana: 1 plant/)).toBeInTheDocument();
    // Only that type's crops — no vegetables mixed in.
    expect(screen.queryByLabelText(/^Eggplant/)).not.toBeInTheDocument();

    await user.unhover(fruitRow());
    expect(screen.queryByLabelText(/^Pineapple/)).not.toBeInTheDocument();
  });

  it("keeps a clicked type open so its crops can be reached, and closes on a second click", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(fruitRow());
    await user.unhover(fruitRow());
    expect(screen.getByLabelText(/^Pineapple/)).toBeInTheDocument();
    expect(fruitRow()).toHaveAttribute("aria-pressed", "true");

    await user.click(fruitRow());
    await user.unhover(fruitRow());
    expect(screen.queryByLabelText(/^Pineapple/)).not.toBeInTheDocument();
  });
});

describe("HarvestOutlook", () => {
  const TODAY = new Date(2026, 8, 21); // September 21, 2026

  function due(id: number, crop: string, emoji: string, start: string, end: string): LguPlant {
    return {
      ...plant(id, crop, emoji, FRUIT),
      expected_harvest_start: start,
      expected_harvest_end: end,
    };
  }

  const DUE = [
    due(1, "Pineapple", "🍍", "2026-10-05", "2026-11-05"),
    due(2, "Pineapple", "🍍", "2026-10-20", "2026-11-20"),
    due(3, "Banana", "🍌", "2026-10-12", "2026-10-30"),
    due(4, "Mango", "🥭", "2026-12-01", "2026-12-30"),
  ];

  function renderOutlook() {
    render(<HarvestOutlook plants={DUE} today={TODAY} />);
  }

  const month = (name: RegExp) => screen.getByRole("button", { name });

  it("shows the crops due in a month while it is pointed at, and hides them after", async () => {
    const user = userEvent.setup();
    renderOutlook();
    expect(screen.getByText(/Point at a month/)).toBeInTheDocument();

    await user.hover(month(/^October 2026: 3 plants/));
    expect(screen.getByText(/Due in October 2026 · 3 plants/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Pineapple: 2 plants/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Banana: 1 plant/)).toBeInTheDocument();
    // December's mango is not due in October.
    expect(screen.queryByLabelText(/^Mango/)).not.toBeInTheDocument();

    await user.unhover(month(/^October 2026/));
    expect(screen.queryByLabelText(/^Pineapple/)).not.toBeInTheDocument();
  });

  it("keeps a clicked month open, showing its crops", async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(month(/^December 2026: 1 plant/));
    await user.unhover(month(/^December 2026/));
    expect(month(/^December 2026/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/^Mango: 1 plant/).tagName).not.toBe("BUTTON");
  });

  it("says so for a month with nothing due", async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.hover(month(/^November 2026: 0 plants/));
    expect(screen.getByText("Nothing is due for harvest this month.")).toBeInTheDocument();
  });
});

describe("PlantsOverview", () => {
  it("has no plant list", () => {
    render(<PlantsOverview plants={PLANTS} />);
    expect(screen.queryByRole("region", { name: "All plants" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
