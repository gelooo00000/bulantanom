import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InSeasonCrops } from "@/components/farmer/in-season-crops";
import type { BackendCrop } from "@/lib/api/plants-api";

/**
 * The lean months are the interesting case. Bulan's September-January is the
 * rainfall and typhoon peak at once, so a shortlist that only ever showed
 * "good" crops would be an empty box for a third of the year. These pin that
 * an empty September explains itself instead.
 */

function crop(
  id: string,
  name: string,
  preferred: number[],
  caution: number[] = [],
): BackendCrop {
  return {
    id,
    name,
    category: "vegetable",
    category_label: "Vegetables & Crops",
    emoji: "🌱",
    growing_duration_days: 100,
    harvest_window_days: 30,
    description: "",
    search_terms: [],
    variants: [],
    planting_window: {
      preferred_months: preferred,
      caution_months: caution,
      preferred_label: "test",
      reason: "reason",
      risk: "risk",
      caution_note: "note",
    },
  } as BackendCrop;
}

// Five dry-window crops so March clears the "healthy month" threshold, plus
// a year-round one and a crop workable-but-not-ideal in September.
const CROPS: BackendCrop[] = [
  crop("eggplant", "Eggplant", [2, 3, 4, 5], [6, 7, 8]),
  crop("tomato", "Tomato", [2, 3, 4, 5], [6, 7, 8]),
  crop("corn", "Corn", [2, 3, 4, 5], [6, 7, 8]),
  crop("pepper", "Pepper", [2, 3, 4, 5], [6, 7, 8]),
  crop("radish", "Radish", [2, 3, 4, 5], [6, 7, 8]),
  crop("mushroom", "Mushroom", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  crop("pineapple", "Pineapple", [2, 3, 4, 5, 6, 7, 8], [9, 1]),
];

describe("InSeasonCrops", () => {
  it("lists what is in season and names the month", () => {
    render(
      <InSeasonCrops crops={CROPS} month={3} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Good to plant in March")).toBeInTheDocument();
    expect(screen.getByText(/7 crops in season/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eggplant/ })).toBeInTheDocument();
  });

  it("selects a crop when one is tapped", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <InSeasonCrops crops={CROPS} month={3} selectedCropId={null} onSelect={onSelect} />,
    );

    await user.click(screen.getByRole("button", { name: /Eggplant/ }));
    expect(onSelect).toHaveBeenCalledWith("eggplant");
  });

  it("marks the currently selected crop", () => {
    render(
      <InSeasonCrops
        crops={CROPS}
        month={3}
        selectedCropId="tomato"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Tomato/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains a lean month rather than showing a bare short list", () => {
    render(
      <InSeasonCrops crops={CROPS} month={9} selectedCropId={null} onSelect={vi.fn()} />,
    );
    // Only the year-round crop is genuinely in season in September.
    expect(screen.getByText(/1 crop in season/)).toBeInTheDocument();
    expect(
      screen.getByText(/wettest and most typhoon-exposed stretch/),
    ).toBeInTheDocument();
  });

  it("points at the next month worth waiting for", () => {
    render(
      <InSeasonCrops crops={CROPS} month={9} selectedCropId={null} onSelect={vi.fn()} />,
    );
    // Searching forward from September wraps past December into February.
    expect(screen.getByText("February")).toBeInTheDocument();
  });

  it("offers the workable-with-care crops when the month is lean", () => {
    render(
      <InSeasonCrops crops={CROPS} month={9} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Workable with care this month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pineapple/ })).toBeInTheDocument();
  });

  it("does not pad a healthy month with the caution list", () => {
    render(
      <InSeasonCrops crops={CROPS} month={3} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText("Workable with care this month")).not.toBeInTheDocument();
  });

  it("collapses a long list so it cannot swamp the form", async () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      crop(`c${i}`, `Crop ${i}`, [3]),
    );
    const user = userEvent.setup();
    render(
      <InSeasonCrops crops={many} month={3} selectedCropId={null} onSelect={vi.fn()} />,
    );

    // Eight shown, the rest behind a toggle.
    expect(screen.getAllByRole("button", { name: /Crop \d/ })).toHaveLength(8);
    const toggle = screen.getByRole("button", { name: "Show all 14 crops in season" });

    await user.click(toggle);
    expect(screen.getAllByRole("button", { name: /Crop \d/ })).toHaveLength(14);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
  });

  it("does not offer a toggle for a list that already fits", () => {
    render(
      <InSeasonCrops crops={CROPS} month={9} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument();
  });

  it("never claims to know the weather", () => {
    render(
      <InSeasonCrops crops={CROPS} month={3} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/not a live weather forecast/)).toBeInTheDocument();
  });

  it("renders nothing before the catalog has loaded", () => {
    const { container } = render(
      <InSeasonCrops crops={[]} month={3} selectedCropId={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
