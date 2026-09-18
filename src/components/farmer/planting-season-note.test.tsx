import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlantingSeasonNote } from "@/components/farmer/planting-season-note";
import type { PlantingAdvice } from "@/lib/api/plants-api";

const BASE: PlantingAdvice = {
  status: "good",
  month: 3,
  month_name: "March",
  headline: "March is a good month to plant this at Layuan Farm.",
  detail: "Transplanted into the drier February-May window.",
  preferred_months: [2, 3, 4, 5],
  preferred_label: "February-May",
  caution_months: [6, 7, 8, 1],
};

describe("PlantingSeasonNote", () => {
  it("renders the headline and detail it is given", () => {
    render(<PlantingSeasonNote advice={BASE} />);
    expect(screen.getByText(BASE.headline)).toBeInTheDocument();
    expect(screen.getByText(BASE.detail)).toBeInTheDocument();
  });

  it("renders nothing when the crop has no window on record", () => {
    const { container } = render(<PlantingSeasonNote advice={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the usual window when the chosen month is not in it", () => {
    render(
      <PlantingSeasonNote
        advice={{
          ...BASE,
          status: "poor",
          month: 10,
          month_name: "October",
          headline: "October is outside the recommended planting window.",
          detail: "Saturated beds drive bacterial wilt.",
        }}
      />,
    );
    expect(screen.getByText("February-May")).toBeInTheDocument();
  });

  it("does not repeat the window when the month is already in season", () => {
    render(<PlantingSeasonNote advice={BASE} />);
    expect(screen.queryByText("February-May")).not.toBeInTheDocument();
  });

  it("announces itself politely so a date change is not disruptive", () => {
    render(<PlantingSeasonNote advice={BASE} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("does not rely on colour alone to convey the verdict", () => {
    render(<PlantingSeasonNote advice={{ ...BASE, status: "poor" }} />);
    expect(screen.getByText(/Not the season for this crop/)).toBeInTheDocument();
  });
});
