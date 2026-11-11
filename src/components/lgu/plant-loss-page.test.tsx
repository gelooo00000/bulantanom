import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LguPlantLossPage from "@/app/lgu/plant-loss/page";
import type { PlantLoss, PlantLosses } from "@/lib/api/lgu-api";

let data: PlantLosses | null = null;
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data, loading: false, error: null, refetch: vi.fn() }),
}));

function loss(id: number, name: string, extra: Partial<PlantLoss>): PlantLoss {
  return {
    id,
    cause: "PEST",
    cause_label: "Pests",
    noticed: "TODAY",
    noticed_label: "Today",
    photo_url: null,
    notes: "",
    lost_at: "2026-11-05T08:00:00+08:00",
    age_days: 40,
    assessments_count: 2,
    last_risk: "LOW",
    highest_risk: "LOW",
    high_risk_count: 0,
    warned_before: false,
    farmer_name: "Juan Cruz",
    plant_name: name,
    crop_name: "Tomato",
    crop_emoji: "🍅",
    plant_id: id,
    farmer_id: 1,
    planting_date: "2026-09-26",
    cause_group: "pest_disease",
    calamity: false,
    high_risk_not_saved: false,
    ...extra,
  };
}

const losses = [
  loss(1, "Typhoon Tomato", {
    cause: "FLOOD_TYPHOON",
    cause_label: "Flood or typhoon",
    cause_group: "calamity",
    calamity: true,
  }),
  loss(2, "Rotted Tomato", {
    cause: "DISEASE",
    cause_label: "Disease",
    highest_risk: "HIGH",
    last_risk: "HIGH",
    high_risk_count: 2,
    warned_before: true,
    high_risk_not_saved: true,
  }),
  loss(3, "Bitten Tomato", { cause: "ANIMALS", cause_label: "Animals", cause_group: "other" }),
];

const full: PlantLosses = {
  total: 3,
  calamity: 1,
  high_risk_not_saved: 1,
  pest_disease: 1,
  other: 1,
  warned_before: 1,
  warned_before_rate: 33,
  harvested: 1,
  survival_rate: 25,
  causes: [
    { value: "PEST", label: "Pests", count: 0, calamity: false },
    { value: "DISEASE", label: "Disease", count: 1, calamity: false },
    { value: "FLOOD_TYPHOON", label: "Flood or typhoon", count: 1, calamity: true },
    { value: "DROUGHT_HEAT", label: "Drought or too hot", count: 0, calamity: true },
    { value: "ANIMALS", label: "Animals", count: 1, calamity: false },
    { value: "OTHER", label: "Other / not sure", count: 0, calamity: false },
  ],
  crops: [{ crop: "Tomato", emoji: "🍅", count: 3 }],
  months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month) => ({
    month,
    count: month === "2026-11" ? 3 : 0,
  })),
  losses,
};

describe("LGU Plant Loss", () => {
  it("says so when no plant has been lost", () => {
    data = { ...full, total: 0, losses: [] };
    render(<LguPlantLossPage />);
    expect(screen.getByText("No plants lost")).toBeInTheDocument();
  });

  it("counts the losses and lists every lost plant", () => {
    data = full;
    render(<LguPlantLossPage />);
    expect(screen.getByRole("tab", { name: /All losses\s*3/ })).toBeInTheDocument();
    expect(screen.getByText("Typhoon Tomato")).toBeInTheDocument();
    expect(screen.getByText("Rotted Tomato")).toBeInTheDocument();
    expect(screen.getByText("Bitten Tomato")).toBeInTheDocument();
  });

  it("puts each loss in its group's section, as on Harvest & Monitoring", () => {
    data = full;
    render(<LguPlantLossPage />);
    expect(within(screen.getByRole("region", { name: "Lost to a calamity" })).getByText("Typhoon Tomato")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "High risk, not saved" })).getByText("Rotted Tomato")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Other causes" })).getByText("Bitten Tomato")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pests & disease" })).not.toBeInTheDocument();
  });

  it("narrows to calamities, and to High-risk plants that were not saved", () => {
    data = full;
    render(<LguPlantLossPage />);
    fireEvent.click(screen.getByRole("tab", { name: /^Calamity/ }));
    expect(screen.getByText("Typhoon Tomato")).toBeInTheDocument();
    expect(screen.queryByText("Rotted Tomato")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /High risk, not saved/ }));
    expect(screen.getByText("Rotted Tomato")).toBeInTheDocument();
    expect(screen.queryByText("Typhoon Tomato")).not.toBeInTheDocument();
  });
});
