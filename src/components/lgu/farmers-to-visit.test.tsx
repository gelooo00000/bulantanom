import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FarmersToVisit, lastCheckText, type Presence } from "@/components/lgu/farmers-to-visit";
import type { LguPlant } from "@/lib/api/lgu-api";
import { farmersToVisit } from "@/lib/lgu-plant-stats";

const TODAY = new Date(2026, 8, 22); // September 22, 2026

const MARIA = { id: 1, full_name: "Maria Santos", email: "maria@example.com" };
const JUAN = { id: 2, full_name: "Juan Cruz", email: "juan@example.com" };
const ANA = { id: 3, full_name: "Ana Lim", email: "ana@example.com" };
const PINEAPPLE = { id: "pineapple", name: "Pineapple", emoji: "🍍", category_label: "Fruit" };
const BANANA = { id: "banana", name: "Banana", emoji: "🍌", category_label: "Fruit" };
const CORN = { id: "corn", name: "Corn", emoji: "🌽", category_label: "Vegetables & Crops" };

let nextId = 1;
function plant(
  farmer: LguPlant["farmer"],
  crop: LguPlant["crop"],
  level: "HIGH" | "MEDIUM" | "LOW" | null,
  checked = "2026-09-20",
): LguPlant {
  const id = nextId++;
  return {
    id,
    crop,
    display_name: crop.name,
    planting_date: "2026-06-01",
    expected_harvest_start: "2026-10-10",
    expected_harvest_end: "2026-11-10",
    status: "GROWING",
    status_label: "Growing",
    age_days: 100,
    farmer,
    latest_risk: level
      ? { risk_level: level, assessment_id: id, assessment_date: checked, has_evidence: false }
      : null,
  };
}

const PLANTS = [
  plant(MARIA, PINEAPPLE, "HIGH", "2026-09-19"),
  plant(MARIA, BANANA, "MEDIUM", "2026-09-21"),
  plant(MARIA, PINEAPPLE, "MEDIUM", "2026-09-10"),
  plant(MARIA, CORN, "LOW"),
  plant(JUAN, CORN, "MEDIUM", "2026-09-01"),
  plant(ANA, CORN, "LOW"),
];

describe("farmersToVisit details", () => {
  const [maria, juan] = farmersToVisit(PLANTS);

  it("lists each crop at risk once, high before medium", () => {
    // Pineapple has a high and a medium plant: listed once, as high.
    expect(maria.cropsAtRisk.map((c) => [c.name, c.level])).toEqual([
      ["Pineapple", "HIGH"],
      ["Banana", "MEDIUM"],
    ]);
  });

  it("takes the most recent check across the farmer's plants", () => {
    expect(maria.lastChecked).toBe("2026-09-21");
    expect(juan.lastChecked).toBe("2026-09-01");
  });

  it("carries the email, shown when online status is unavailable", () => {
    expect(maria.email).toBe("maria@example.com");
  });
});

describe("FarmersToVisit", () => {
  function renderCards(presence?: Map<number, Presence>) {
    render(
      <FarmersToVisit farmers={farmersToVisit(PLANTS)} presence={presence} today={TODAY} />,
    );
  }

  const card = (name: RegExp) => screen.getByRole("listitem", { name });

  it("sums up who to visit and how urgently", () => {
    renderCards();
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 farmers to visit · 1 urgent · 1 to watch",
    );
  });

  it("marks high-risk farmers to visit first and medium-only ones to check soon", () => {
    renderCards();
    expect(within(card(/Maria Santos/)).getByText("Visit first")).toBeInTheDocument();
    expect(within(card(/Juan Cruz/)).getByText("Check soon")).toBeInTheDocument();
    // Ana's plants all read low, so she is not on the list.
    expect(screen.queryByRole("listitem", { name: /Ana Lim/ })).not.toBeInTheDocument();
  });

  it("says why: the counts and the crops at risk", () => {
    renderCards();
    const maria = card(/Maria Santos/);
    expect(within(maria).getByText("1 high")).toBeInTheDocument();
    expect(within(maria).getByText("2 medium")).toBeInTheDocument();
    expect(maria).toHaveTextContent("At risk: 🍍 Pineapple, 🍌 Banana");
  });

  it("flags a farmer who has not checked their plants in two weeks", () => {
    renderCards();
    expect(within(card(/Juan Cruz/)).getByText(/Last plant check 21 days ago/)).toHaveClass(
      "text-risk-medium",
    );
    expect(within(card(/Maria Santos/)).getByText(/Last plant check yesterday/)).not.toHaveClass(
      "text-risk-medium",
    );
  });

  it("shows who is online right now", () => {
    renderCards(
      new Map([
        [1, { is_online: true, last_seen_at: "2026-09-22T08:00:00" }],
        [2, { is_online: false, last_seen_at: null }],
      ]),
    );
    expect(within(card(/Maria Santos/)).getByText("Online now")).toBeInTheDocument();
    expect(within(card(/Juan Cruz/)).getByText("Not signed in yet")).toBeInTheDocument();
  });

  it("has no buttons or links — every farmer is on-site at Layuan", () => {
    renderCards();
    const cards = screen.getByRole("list");
    expect(within(cards).queryAllByRole("button")).toHaveLength(0);
    expect(within(cards).queryAllByRole("link")).toHaveLength(0);
  });

  it("describes a plant check in plain words", () => {
    expect(lastCheckText(null, TODAY)).toEqual({ text: "No plant checks yet", stale: true });
    expect(lastCheckText("2026-09-22", TODAY).text).toMatch(/^Last plant check today/);
  });
});
