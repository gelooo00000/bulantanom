import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NextDuePlant } from "@/components/farmer/next-due-plant";
import type { BackendPlant } from "@/lib/api/plants-api";

let plants: BackendPlant[] | null = null;
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: plants, loading: false, error: null, refetch: vi.fn() }),
}));

function plant(id: number, name: string, canAssess: boolean): BackendPlant {
  return {
    id,
    display_name: name,
    assessment_eligibility: { can_assess: canAssess },
  } as unknown as BackendPlant;
}

describe("NextDuePlant", () => {
  it("links to the next due plant, never the one just assessed", () => {
    plants = [plant(1, "Sinta", true), plant(2, "Lakatan", false), plant(3, "Magallanes", true), plant(4, "Luya", true)];
    render(<NextDuePlant currentPlantId={1} />);

    const link = screen.getByRole("button", { name: /Assess next: Magallanes/ });
    expect(link).toHaveAttribute("href", "/farmer/plants/3/assessment");
    expect(screen.getByText("2 plants are still due for their weekly check.")).toBeInTheDocument();
  });

  it("says when every plant is done", () => {
    plants = [plant(1, "Sinta", true), plant(2, "Lakatan", false)];
    render(<NextDuePlant currentPlantId={1} />);

    expect(screen.getByText("All your plants are checked for this week.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing until the plants have loaded", () => {
    plants = null;
    const { container } = render(<NextDuePlant currentPlantId={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
