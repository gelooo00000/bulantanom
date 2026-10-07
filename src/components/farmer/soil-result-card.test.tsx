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
  it("shows every crop, with no See more for them", () => {
    render(<SoilResultCard result={result} />);
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Corn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /See more options/ })).toBeNull();
  });

  it("keeps the soil advice and warnings behind See more", async () => {
    render(<SoilResultCard result={result} />);
    expect(screen.queryByText("Mix compost in.")).toBeNull();
    expect(screen.queryByText("Let the soil dry out.")).toBeNull();
    expect(screen.queryByText("Be careful")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(screen.getByText("Mix compost in.")).toBeInTheDocument();
    expect(screen.getByText("Ask the LGU for a soil test.")).toBeInTheDocument();
    expect(screen.getByText("Let the soil dry out.")).toBeInTheDocument();
    expect(screen.getByText("Be careful")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.queryByText("Mix compost in.")).toBeNull();
  });
});
