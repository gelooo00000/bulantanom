import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SoilResultCard } from "@/components/farmer/soil-result-card";
import type { SoilRecommendation } from "@/lib/api/soil-api";

const crop = (id: string) => ({ id, name: id, emoji: "🌱", reason: `${id} suits it.` });

const result = {
  id: 1,
  suitable_fruits: [crop("Mango"), crop("Guava"), crop("Banana")],
  suitable_vegetables: [crop("Eggplant")],
  suitable_crops: [crop("Ginger"), crop("Taro"), crop("Corn")],
  fertilizer_recommendations: [
    { recommendation: "Mix compost in." },
    { recommendation: "Ask the LGU for a soil test." },
  ],
  soil_improvement_watering: [{ recommendation: "Let the soil dry out." }],
  important_warnings: [],
} as unknown as SoilRecommendation;

describe("SoilResultCard", () => {
  it("shows two crops per group, with one See more for all of them", async () => {
    render(<SoilResultCard result={result} />);
    expect(screen.queryByText("Banana")).toBeNull();
    expect(screen.queryByText("Corn")).toBeNull();

    const buttons = screen.getAllByRole("button", { name: /See more options/ });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Corn")).toBeInTheDocument();
  });

  it("shows the first fertilizer tip, with See more for the rest", async () => {
    render(<SoilResultCard result={result} />);
    expect(screen.getByText("Mix compost in.")).toBeInTheDocument();
    expect(screen.queryByText("Ask the LGU for a soil test.")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "See more (1)" }));
    expect(screen.getByText("Ask the LGU for a soil test.")).toBeInTheDocument();
  });
});
