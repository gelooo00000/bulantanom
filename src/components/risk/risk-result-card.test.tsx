import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RiskResultCard } from "@/components/risk/risk-result-card";
import type { BackendAssessment } from "@/lib/api/risk-api";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/components/shared/authed-image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- a stand-in for the authorized image
  AuthedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function reading(fertilizer: unknown): BackendAssessment {
  return {
    id: 1,
    assessment_date: "2026-11-09",
    plant_display_name: "Leaf Lettuce",
    crop_emoji: "🥬",
    plant_age_days: 34,
    evidence_image_url: "https://api.example/photo",
    risk: {
      status: "completed",
      risk_level: "MEDIUM",
      summary: "Your lettuce is pale and growing slowly.",
      reality_vs_expectation: {
        expected: "A crisp green rosette.",
        observed: "Pale, small leaves.",
        assessment: "Behind for its age.",
      },
      visual_observations: ["Pale outer leaves"],
      risk_factors: [{ factor: "Pale leaves", severity: "medium", explanation: "You reported yellowing." }],
      possible_causes: ["Nitrogen shortage"],
      recommended_actions: ["Feed lightly with nitrogen.", "Water at the base."],
      monitoring_advice: ["Watch the new leaves."],
      limitations: ["Top view only."],
      next_assessment_days: 7,
      image_analyzed: true,
      fertilizer,
    },
  } as unknown as BackendAssessment;
}

describe("the risk reading", () => {
  it("shows the summary and what to do, with the details behind See more", async () => {
    render(<RiskResultCard assessment={reading(undefined)} />);
    expect(screen.getByText("Your lettuce is pale and growing slowly.")).toBeInTheDocument();
    expect(screen.getByText("What to do")).toBeInTheDocument();
    expect(screen.getByText("Feed lightly with nitrogen.")).toBeInTheDocument();
    // Folded until asked for; limitations and the repeated sentence are gone.
    expect(screen.queryByText("Pale outer leaves")).not.toBeInTheDocument();
    expect(screen.queryByAltText(/Leaf Lettuce/)).not.toBeInTheDocument();
    expect(screen.queryByText("Top view only.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "See more" }));
    // Only what matters: the photo, possible causes and what to watch.
    expect(screen.getByText("Nitrogen shortage")).toBeInTheDocument();
    expect(screen.getByText("Watch the new leaves.")).toBeInTheDocument();
    expect(screen.queryByText("Pale outer leaves")).not.toBeInTheDocument();
    expect(screen.queryByText("A crisp green rosette.")).not.toBeInTheDocument();
    expect(screen.queryByText("Pale leaves")).not.toBeInTheDocument();
    expect(screen.getByAltText(/Leaf Lettuce/)).toBeInTheDocument();
    expect(screen.queryByText("Top view only.")).not.toBeInTheDocument();
    expect(screen.queryByText("Behind for its age.")).not.toBeInTheDocument();
  });

  it("recommends a Philippine fertilizer with amount, how and where to buy", () => {
    render(
      <RiskResultCard
        assessment={reading({
          advice: "A light nitrogen feed will green up the leaves.",
          products: [
            {
              id: "urea-46-0-0",
              name: "Urea",
              grade: "46-0-0",
              kind: "inorganic",
              brands: "Atlas Urea, Planters Urea, Yara",
              how: "side-dress away from the stem and water in",
              amount: "1 teaspoon per plant",
              why: "The leaves are pale.",
            },
          ],
          where_to_buy: "Agri-supply (agrivet) stores, the Municipal Agriculture Office / DA",
        })}
      />,
    );
    expect(screen.getByText("Fertilizer")).toBeInTheDocument();
    expect(screen.getByText("Urea")).toBeInTheDocument();
    expect(screen.getByText("(46-0-0)")).toBeInTheDocument();
    expect(screen.getByText("1 teaspoon per plant")).toBeInTheDocument();
    expect(screen.getByText("Atlas Urea, Planters Urea, Yara")).toBeInTheDocument();
    expect(screen.getByText(/Agri-supply/)).toBeInTheDocument();
  });

  it("says plainly when not to fertilize", () => {
    render(
      <RiskResultCard
        assessment={reading({ advice: "Do not add fertilizer now.", products: [] })}
      />,
    );
    expect(screen.getByText("Do not add fertilizer now.")).toBeInTheDocument();
    expect(screen.queryByText("Where to buy:")).not.toBeInTheDocument();
  });

  it("offers to update a reading made before fertilizer advice existed", () => {
    render(<RiskResultCard assessment={reading(undefined)} />);
    expect(screen.getByText(/made before fertilizer advice was added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update reading" })).toBeInTheDocument();
  });
});
