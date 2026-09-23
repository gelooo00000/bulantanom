import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssessmentLockCard } from "@/components/farmer/assessment-lock-card";
import { PlantCard } from "@/components/farmer/plant-card";
import { RiskResultCard } from "@/components/risk/risk-result-card";
import type { BackendPlant } from "@/lib/api/plants-api";
import type { BackendAssessment } from "@/lib/api/risk-api";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));

/**
 * A panel review found the AI rating plants on the day they were planted.
 * The first assessment now waits a week, and a plant too young to judge is
 * told so rather than given a risk level.
 */

const JUST_PLANTED = {
  id: 5,
  crop: { id: "corn", name: "Corn", emoji: "🌽" },
  variant: null,
  label: "",
  display_name: "Corn",
  planting_date: "2026-09-23",
  expected_harvest_start: "2026-12-23",
  expected_harvest_end: "2027-01-12",
  status: "GROWING",
  status_label: "Growing",
  age_days: 2,
  is_planned: false,
  assessment_eligibility: {
    can_assess: false,
    too_young: true,
    last_assessment_date: null,
    next_assessment_date: "2026-09-30",
    days_remaining: 5,
    interval_days: 7,
  },
} as unknown as BackendPlant;

function assessment(risk: Partial<BackendAssessment["risk"]>): BackendAssessment {
  return {
    id: 1,
    plant_id: 5,
    plant_display_name: "Corn",
    crop_emoji: "🌽",
    plant_age_days: 2,
    assessment_date: "2026-09-25",
    evidence_image_url: null,
    risk: {
      risk_level: "INCONCLUSIVE",
      risk_level_label: "Too early to tell",
      status: "completed",
      summary: "Only two days after planting.",
      reality_vs_expectation: {},
      visual_observations: [],
      risk_factors: [],
      possible_causes: [],
      recommended_actions: [],
      monitoring_advice: [],
      limitations: [],
      next_assessment_days: 7,
      image_analyzed: false,
      date_mismatch: false,
      ...risk,
    },
  } as unknown as BackendAssessment;
}

describe("a newly planted crop", () => {
  it("shows when its first check opens instead of offering one now", () => {
    render(<PlantCard plant={JUST_PLANTED} />);
    expect(screen.getByText("First check September 30, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Ready to assess")).toBeNull();
  });

  it("explains on the assessment page why it has to wait", () => {
    render(
      <AssessmentLockCard
        eligibility={JUST_PLANTED.assessment_eligibility}
        plantLabel="Corn"
        plantId={5}
        plantingDate={JUST_PLANTED.planting_date}
      />,
    );
    expect(screen.getByRole("heading", { name: "Just planted" })).toBeInTheDocument();
    expect(
      screen.getByText(/first assessment opens on September 30, 2026 — in 5 days/),
    ).toBeInTheDocument();
    expect(screen.getByText("First assessment")).toBeInTheDocument();
    expect(screen.queryByText(/already completed/)).toBeNull();
  });
});

describe("a reading the AI could not make", () => {
  it("says it is too early rather than showing a risk level", () => {
    render(<RiskResultCard assessment={assessment({})} />);
    expect(screen.getByText("Too Early")).toBeInTheDocument();
    expect(screen.getByText("Too early for a risk reading")).toBeInTheDocument();
    expect(screen.queryByText(/High Risk|Low Risk/)).toBeNull();
  });

  it("reports a photo that contradicts the planting date as a record to fix", () => {
    render(<RiskResultCard assessment={assessment({ date_mismatch: true })} />);
    expect(
      screen.getByText("This photo doesn't match the planting date"),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a danger to your crop/)).toBeInTheDocument();
    // The "too early" block would be a second, competing explanation.
    expect(screen.queryByText("Too early for a risk reading")).toBeNull();
  });

  it("still shows a real risk level when there is one", () => {
    render(
      <RiskResultCard
        assessment={assessment({ risk_level: "HIGH", risk_level_label: "High" })}
      />,
    );
    expect(screen.getByText("High Risk")).toBeInTheDocument();
    expect(screen.queryByText("Too early for a risk reading")).toBeNull();
  });
});
