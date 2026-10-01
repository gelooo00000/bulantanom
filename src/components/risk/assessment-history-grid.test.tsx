import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssessmentHistoryGrid } from "@/components/risk/assessment-history-grid";
import { RiskResultCard } from "@/components/risk/risk-result-card";
import type { BackendAssessment } from "@/lib/api/risk-api";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));

function assessment(
  id: number,
  name: string,
  level: string | null,
  farmer = "Angelo Gloriane",
): BackendAssessment {
  return {
    id,
    plant_id: id,
    plant_display_name: name,
    crop_emoji: "🌽",
    plant_age_days: 30,
    assessment_date: "2026-09-25",
    evidence_image_url: null,
    farmer: { id: 7, full_name: farmer, email: "angelo@example.com" },
    risk: level
      ? {
          risk_level: level,
          status: "completed",
          summary: `${level} case`,
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
        }
      : { status: "failed", risk_level: null, failure_reason: "Gemini was unavailable." },
  } as unknown as BackendAssessment;
}

const RECORDS = [
  assessment(1, "Corn", "HIGH"),
  assessment(2, "Guava", "LOW", "Frank Xavier Latonero"),
];

describe("AssessmentHistoryGrid", () => {
  it("links each tile to the page it is given", () => {
    render(
      <AssessmentHistoryGrid assessments={RECORDS} hrefFor={(a) => `/lgu/assessments/${a.id}`} />,
    );
    expect(screen.getByText("Corn").closest("a")).toHaveAttribute("href", "/lgu/assessments/1");
    expect(screen.getByText("Guava").closest("a")).toHaveAttribute("href", "/lgu/assessments/2");
  });

  it("names the Farmer on each tile only when asked to", () => {
    const { rerender } = render(
      <AssessmentHistoryGrid assessments={RECORDS} hrefFor={() => "#"} />,
    );
    expect(screen.queryByText("Angelo Gloriane")).toBeNull();

    rerender(<AssessmentHistoryGrid assessments={RECORDS} hrefFor={() => "#"} showFarmer />);
    expect(screen.getByText("Angelo Gloriane")).toBeInTheDocument();
    expect(screen.getByText("Frank Xavier Latonero")).toBeInTheDocument();
  });

  it("filters by risk level", () => {
    render(<AssessmentHistoryGrid assessments={RECORDS} hrefFor={() => "#"} />);
    fireEvent.click(screen.getByRole("button", { name: "High risk" }));
    expect(screen.getByText("Corn")).toBeInTheDocument();
    expect(screen.queryByText("Guava")).toBeNull();
    expect(screen.getByText("1 of 2 assessments")).toBeInTheDocument();
  });
});

describe("RiskResultCard for an LGU Officer", () => {
  it("does not offer to re-run a failed analysis", () => {
    render(<RiskResultCard assessment={assessment(3, "Papaya", null)} readOnly />);
    expect(screen.getByText("AI risk analysis unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry analysis/ })).toBeNull();
  });

  it("still offers it to the Farmer", () => {
    render(<RiskResultCard assessment={assessment(3, "Papaya", null)} />);
    expect(screen.getByRole("button", { name: /Retry analysis/ })).toBeInTheDocument();
  });
});
