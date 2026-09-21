import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NO_FILTERS, PlantDirectory, type PlantFilters } from "@/components/lgu/plant-directory";
import type { LguPlant } from "@/lib/api/lgu-api";
import {
  cropCounts,
  cropTypeCounts,
  harvestOutlook,
  harvestStatus,
  livePlants,
  matchesPlantSearch,
} from "@/lib/lgu-plant-stats";

const TODAY = new Date(2026, 8, 21); // September 21, 2026

const PINEAPPLE = { id: "pineapple", name: "Pineapple", emoji: "🍍", category_label: "Fruit" };
const EGGPLANT = {
  id: "eggplant",
  name: "Eggplant",
  emoji: "🍆",
  category_label: "Vegetables & Crops",
};

function plant(overrides: Partial<LguPlant>): LguPlant {
  return {
    id: 1,
    crop: PINEAPPLE,
    display_name: "Pineapple",
    planting_date: "2026-06-01",
    expected_harvest_start: "2026-10-10",
    expected_harvest_end: "2026-11-10",
    status: "GROWING",
    status_label: "Growing",
    age_days: 112,
    farmer: { id: 1, full_name: "Juan Cruz", email: "juan@example.com" },
    latest_risk: null,
    ...overrides,
  };
}

const PLANTS: LguPlant[] = [
  plant({ id: 1 }),
  plant({
    id: 2,
    display_name: "Back-lot pineapple",
    expected_harvest_start: "2026-09-15",
    expected_harvest_end: "2026-10-15",
    latest_risk: { risk_level: "HIGH", assessment_id: 9, assessment_date: "2026-09-20", has_evidence: true },
  }),
  plant({
    id: 3,
    crop: EGGPLANT,
    display_name: "Eggplant",
    expected_harvest_start: "2027-06-01",
    expected_harvest_end: "2027-06-20",
    farmer: { id: 2, full_name: "Maria Santos", email: "maria@example.com" },
    latest_risk: { risk_level: "LOW", assessment_id: 4, assessment_date: "2026-09-18", has_evidence: false },
  }),
  plant({ id: 4, status: "ARCHIVED" }),
];

describe("plant statistics", () => {
  it("leaves archived plants out of every figure", () => {
    expect(livePlants(PLANTS)).toHaveLength(3);
  });

  it("counts plants per crop type and per crop, largest first", () => {
    const live = livePlants(PLANTS);
    expect(cropTypeCounts(live)).toEqual([
      { label: "Fruit", count: 2 },
      { label: "Vegetables & Crops", count: 1 },
    ]);
    expect(cropCounts(live).map((c) => [c.name, c.count])).toEqual([
      ["Pineapple", 2],
      ["Eggplant", 1],
    ]);
  });

  it("puts an open harvest window in this month and a far one in 'later'", () => {
    const { buckets, later } = harvestOutlook(livePlants(PLANTS), TODAY, 6);
    // Plant 2's window opened Sep 15 -> due now (September).
    expect(buckets[0]).toMatchObject({ key: "2026-09", count: 1 });
    // Plant 1 opens Oct 10.
    expect(buckets[1]).toMatchObject({ key: "2026-10", count: 1 });
    // Eggplant opens June 2027, past the six-month range.
    expect(later).toBe(1);
  });

  it("does not count a harvested plant or a closed window as upcoming", () => {
    const { buckets, later } = harvestOutlook(
      [
        plant({ status: "HARVESTED" }),
        plant({ expected_harvest_start: "2026-07-01", expected_harvest_end: "2026-08-01" }),
      ],
      TODAY,
    );
    expect(buckets.reduce((sum, b) => sum + b.count, 0) + later).toBe(0);
  });

  it("describes harvest timing in plain words", () => {
    expect(harvestStatus(PLANTS[1], TODAY).label).toBe("Ready to harvest now");
    expect(harvestStatus(PLANTS[0], TODAY).label).toBe("Harvest in 19 days");
    expect(harvestStatus(plant({ expected_harvest_start: "2026-09-22" }), TODAY).label).toBe(
      "Harvest tomorrow",
    );
    expect(
      harvestStatus(plant({ expected_harvest_start: "2026-07-01", expected_harvest_end: "2026-08-01" }), TODAY)
        .label,
    ).toBe("Harvest window passed");
  });

  it("searches plant, crop and farmer, ignoring case and accents", () => {
    expect(matchesPlantSearch(PLANTS[2], "egg")).toBe(true);
    expect(matchesPlantSearch(PLANTS[2], "SANTOS")).toBe(true);
    expect(matchesPlantSearch(plant({ farmer: { id: 5, full_name: "José Peña", email: "j@x.ph" } }), "pena")).toBe(true);
    expect(matchesPlantSearch(PLANTS[0], "eggplant")).toBe(false);
  });
});

function rows() {
  return screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
}

describe("PlantDirectory", () => {
  const live = livePlants(PLANTS);

  // Holds the filters the way the Risk overview page does.
  function Harness({ initial, onChange }: { initial: PlantFilters; onChange: (f: PlantFilters) => void }) {
    const [filters, setFilters] = useState(initial);
    return (
      <PlantDirectory
        plants={live}
        filters={filters}
        onFiltersChange={(next) => {
          onChange(next);
          setFilters(next);
        }}
      />
    );
  }

  function renderList(initial: Partial<PlantFilters> = {}) {
    const onChange = vi.fn();
    render(<Harness initial={{ ...NO_FILTERS, ...initial }} onChange={onChange} />);
    return onChange;
  }

  it("finds plants by farmer name", async () => {
    const user = userEvent.setup();
    renderList();
    await user.type(screen.getByRole("searchbox"), "maria");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain("Eggplant");
  });

  it("filters by risk, with a count on each filter", async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.getByRole("button", { name: /High risk\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not assessed\s*1/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /High risk\s*1/ }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain("Back-lot pineapple");
  });

  it("links a high-risk plant to the high-risk cases", () => {
    renderList();
    const row = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("Back-lot"))!;
    expect(within(row).getByRole("link", { name: "High risk" })).toHaveAttribute(
      "href",
      "/lgu/high-risk",
    );
  });

  it("narrows to the crop picked on a chart, and can undo it", async () => {
    const user = userEvent.setup();
    const onChange = renderList({ cropId: "eggplant" });
    expect(rows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Stop filtering by Eggplant" }));
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS);
    expect(rows()).toHaveLength(3);
  });

  it("narrows to the farmer picked on a chart", async () => {
    const user = userEvent.setup();
    renderList({ farmerId: 2 });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain("Maria Santos");
    await user.click(screen.getByRole("button", { name: "Stop filtering by Maria Santos" }));
    expect(rows()).toHaveLength(3);
  });

  it("lists the highest risk first, then low, then plants not yet assessed", () => {
    renderList();
    expect(rows()[0]).toContain("Back-lot pineapple"); // high
    expect(rows()[1]).toContain("Eggplant"); // low
    expect(rows()[2]).toContain("Not assessed");
  });

  it("shows only the risk on each row, not the harvest timing", () => {
    renderList();
    for (const row of rows()) {
      expect(row).not.toMatch(/Harvest in|Ready to harvest|Harvest tomorrow/);
      expect(row).toMatch(/High risk|Medium risk|Low risk|Not assessed/);
    }
  });

  it("names the crop beside a plant the farmer renamed", () => {
    renderList();
    expect(screen.getByText(/· Pineapple/)).toBeInTheDocument();
  });
});
