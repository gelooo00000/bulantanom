import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RiskOverview, tallyText } from "@/components/lgu/risk-overview";
import type { LguPlant } from "@/lib/api/lgu-api";
import { riskTally } from "@/lib/lgu-plant-stats";

const MARIA = { id: 1, full_name: "Maria Santos", email: "maria@example.com" };
const JUAN = { id: 2, full_name: "Juan Cruz", email: "juan@example.com" };
const ANA = { id: 3, full_name: "Ana Lim", email: "ana@example.com" };
const PINEAPPLE = { id: "pineapple", name: "Pineapple", emoji: "🍍", category_label: "Fruit" };
const CORN = { id: "corn", name: "Corn", emoji: "🌽", category_label: "Vegetables & Crops" };

let nextId = 1;
function plant(
  farmer: LguPlant["farmer"],
  crop: LguPlant["crop"],
  level: "HIGH" | "MEDIUM" | "LOW" | "INCONCLUSIVE" | null,
): LguPlant {
  const id = nextId++;
  return {
    id,
    crop,
    display_name: `${crop.name} ${id}`,
    planting_date: "2026-06-01",
    expected_harvest_start: "2026-10-10",
    expected_harvest_end: "2026-11-10",
    status: "GROWING",
    status_label: "Growing",
    age_days: 100,
    farmer,
    latest_risk: level
      ? { risk_level: level, assessment_id: id, assessment_date: "2026-09-18", has_evidence: false }
      : null,
  };
}

const PLANTS = [
  plant(MARIA, PINEAPPLE, "HIGH"),
  plant(MARIA, PINEAPPLE, "HIGH"),
  plant(MARIA, CORN, "LOW"),
  plant(JUAN, PINEAPPLE, "MEDIUM"),
  plant(JUAN, CORN, null),
  plant(ANA, CORN, "LOW"),
];

describe("risk statistics", () => {
  it("counts each plant once, by its latest reading", () => {
    expect(riskTally(PLANTS)).toEqual({ HIGH: 2, MEDIUM: 1, LOW: 2, NONE: 1 });
  });

  it("counts a too-early reading as no reading, not as a level of its own", () => {
    // Regression: "INCONCLUSIVE" fell outside every bucket, so counts came
    // out as NaN and badge lookups found nothing.
    const early = plant(ANA, CORN, "INCONCLUSIVE");
    expect(riskTally([...PLANTS, early])).toEqual({ HIGH: 2, MEDIUM: 1, LOW: 2, NONE: 2 });
  });

  it("writes only the non-zero levels asked for", () => {
    expect(tallyText({ HIGH: 2, MEDIUM: 0, LOW: 1, NONE: 0 }, ["HIGH", "MEDIUM"])).toBe("2 high");
    expect(tallyText({ HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 }, ["HIGH"])).toBe("No readings");
  });
});

describe("RiskOverview", () => {
  it("has no AI readings tab", () => {
    render(<RiskOverview plants={PLANTS} />);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI readings/)).not.toBeInTheDocument();
  });

  it("has no high-risk alert banner", () => {
    render(<RiskOverview plants={PLANTS} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/reading high risk/)).not.toBeInTheDocument();
  });

  it("no longer has a Risk by crop chart", () => {
    render(<RiskOverview plants={PLANTS} />);
    expect(screen.queryByText("Risk by crop")).not.toBeInTheDocument();
  });

  const level = (name: RegExp) => screen.getByRole("button", { name });

  it("shows the crops at a risk level while it is pointed at, and hides them after", async () => {
    const user = userEvent.setup();
    render(<RiskOverview plants={PLANTS} />);
    expect(screen.getByText(/Point at a risk level/)).toBeInTheDocument();

    // Low: Maria's corn and Ana's corn.
    await user.hover(level(/^Low risk: 2 plants/));
    expect(screen.getByText(/Low risk · 2 plants/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Corn: 2 plants/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Pineapple: /)).not.toBeInTheDocument();

    await user.unhover(level(/^Low risk: 2 plants/));
    expect(screen.queryByLabelText(/^Corn: 2 plants/)).not.toBeInTheDocument();
  });

  it("keeps the crop panel one fixed size, however long the list it reveals", async () => {
    // Regression: the panel used to grow with its list, so pointing at "Not
    // assessed" (the longest) resized the page under the pointer and set off
    // an open/close loop that shook the screen.
    const user = userEvent.setup();
    render(<RiskOverview plants={PLANTS} />);
    const panel = screen.getByTestId("risk-level-crops");
    expect(panel).toHaveClass("h-96");
    await user.hover(level(/^Not assessed: 1 plant/));
    expect(panel).toHaveClass("h-96");
    // The list pages five crops at a time instead of scrolling inside.
    expect(within(panel).getByRole("list").parentElement).not.toHaveClass("overflow-y-auto");
  });

  it("no longer lists every plant", () => {
    render(<RiskOverview plants={PLANTS} />);
    expect(screen.queryByRole("region", { name: "All plants" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("keeps a clicked level open, showing its crops as plain rows", async () => {
    const user = userEvent.setup();
    render(<RiskOverview plants={PLANTS} />);
    await user.click(level(/^High risk: 2 plants/));
    await user.unhover(level(/^High risk: 2 plants/));
    expect(level(/^High risk: 2 plants/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/^Pineapple: 2 plants/).tagName).not.toBe("BUTTON");
    expect(screen.queryByRole("button", { name: /^Show all/ })).not.toBeInTheDocument();
  });
});
