import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssessmentLockCard } from "@/components/farmer/assessment-lock-card";
import { PlantCard } from "@/components/farmer/plant-card";
import type { BackendPlant } from "@/lib/api/plants-api";

function plant(overrides: Partial<BackendPlant>): BackendPlant {
  return {
    id: 5,
    crop: { id: "corn", name: "Corn", emoji: "🌽" },
    variant: null,
    label: "",
    display_name: "Corn",
    planting_date: "2026-10-05",
    expected_harvest_start: "2027-01-05",
    expected_harvest_end: "2027-01-25",
    status: "GROWING",
    status_label: "Growing",
    age_days: 0,
    is_planned: true,
    assessment_eligibility: {
      can_assess: false,
      planned: true,
      last_assessment_date: null,
      next_assessment_date: "2026-10-05",
      days_remaining: 13,
      interval_days: 7,
    },
    ...overrides,
  } as unknown as BackendPlant;
}

describe("a planned plant", () => {
  it("reads as planned on its card, not growing or ready to assess", () => {
    render(<PlantCard plant={plant({})} />);
    expect(screen.getByText("Planned")).toBeInTheDocument(); // subtitle, not "Growing"
    expect(screen.getByText("Planting on October 5, 2026")).toBeInTheDocument();
    expect(screen.getByText(/Planned · assess from October 5, 2026/)).toBeInTheDocument();
    expect(screen.queryByText("Ready to assess")).toBeNull();
    expect(screen.queryByText(/days old|Planted today/)).toBeNull();
  });

  it("explains on the assessment page that it is not in the ground yet", () => {
    render(
      <AssessmentLockCard
        eligibility={plant({}).assessment_eligibility}
        plantLabel="Corn"
        plantId={5}
      />,
    );
    expect(screen.getByRole("heading", { name: "Not planted yet" })).toBeInTheDocument();
    expect(screen.getByText(/Corn is planned for October 5, 2026/)).toBeInTheDocument();
    expect(screen.getByText("First assessment")).toBeInTheDocument();
    expect(screen.queryByText(/already completed/)).toBeNull();
  });
});

describe("a plant already in the ground", () => {
  it("keeps its usual age and status", () => {
    render(
      <PlantCard
        plant={plant({
          is_planned: false,
          planting_date: "2026-09-01",
          age_days: 21,
          assessment_eligibility: {
            can_assess: true,
            last_assessment_date: null,
            next_assessment_date: null,
            days_remaining: 0,
            interval_days: 7,
          },
        })}
      />,
    );
    expect(screen.getByText("Growing")).toBeInTheDocument();
    expect(screen.getByText("21 days old")).toBeInTheDocument();
    expect(screen.getByText("Ready to assess")).toBeInTheDocument();
  });
});
