import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HarvestOutcomes } from "@/components/shared/harvest-outcomes";
import type { HarvestOutcomes as Outcomes, LossOutcomeReport } from "@/lib/api/lgu-api";

let data: Outcomes | null = null;
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data, loading: false, error: null, refetch: vi.fn() }),
}));

const loss = (id: number): LossOutcomeReport => ({
  id,
  cause: "CALAMITY",
  cause_label: "Calamity",
  noticed: "TODAY",
  noticed_label: "Today",
  photo_url: null,
  notes: "",
  lost_at: "2026-11-11T08:00:00+08:00",
  age_days: 30,
  assessments_count: 0,
  last_risk: "",
  highest_risk: "",
  high_risk_count: 0,
  warned_before: false,
  farmer_name: "Angelo",
  plant_name: `Lost plant ${id}`,
  crop_name: "Calamansi",
  crop_emoji: "🍊",
});

const outcomes: Outcomes = {
  total: 0,
  healthy_rate: null,
  advice_helped_rate: null,
  on_time_rate: null,
  monitored_rate: null,
  reached_high_risk: 0,
  recovered_healthy: 0,
  quality: [],
  final_health: [],
  advice_helped: [],
  timing: [],
  by_crop: [],
  recent: [],
  lost_total: 6,
  survival_rate: 0,
  warned_before_loss: 0,
  warned_before_loss_rate: 0,
  causes: [
    { value: "CALAMITY", label: "Calamity", count: 2 },
    { value: "DISEASE", label: "Plant disease", count: 1 },
    { value: "HUMAN_ERROR", label: "Human error", count: 1 },
    { value: "EXTREME_TEMP", label: "Extreme temperature", count: 1 },
    { value: "WATER", label: "Lack of water", count: 1 },
    { value: "PEST", label: "Pest infestation", count: 0 },
  ],
  recent_losses: [1, 2, 3, 4, 5, 6].map(loss),
};

describe("Admin Lost plants", () => {
  it("shows four lost plants and four causes at a time, the rest on the next page", () => {
    data = outcomes;
    render(<HarvestOutcomes fetcher={vi.fn()} showHeading={false} compact />);

    const plants = screen.getByRole("list", { name: "Lost plants" });
    expect(within(plants).getAllByRole("listitem")).toHaveLength(4);
    expect(within(plants).getByText("Lost plant 1")).toBeInTheDocument();
    expect(within(plants).queryByText("Lost plant 5")).not.toBeInTheDocument();

    const causes = screen.getByRole("list", { name: "Causes of loss" });
    expect(within(causes).getAllByRole("listitem")).toHaveLength(4);
    expect(within(causes).queryByText("Lack of water")).not.toBeInTheDocument();

    const nextButtons = screen.getAllByRole("button", { name: /next/i });
    expect(nextButtons).toHaveLength(2);
    fireEvent.click(nextButtons[1]!);
    expect(screen.getByText("Lost plant 5")).toBeInTheDocument();
    expect(screen.getByText("Lost plant 6")).toBeInTheDocument();
  });
});
