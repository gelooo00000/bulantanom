import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";
import type { SoilRecommendation } from "@/lib/api/soil-api";

const fetchLatest = vi.fn();
const reanalyze = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/soil-api", () => ({
  createSoilRecommendation: vi.fn(),
  fetchLatestSoilRecommendation: (...args: unknown[]) => fetchLatest(...args),
  reanalyzeSoilRecommendation: (...args: unknown[]) => reanalyze(...args),
}));

const failed: SoilRecommendation = {
  id: 7,
  soil_type: "sandy_loam",
  soil_texture: "loose",
  drainage: "good",
  soil_moisture: "moderate",
  ph_level: "6.5",
  nitrogen: "medium",
  phosphorus: "medium",
  potassium: "medium",
  organic_matter: "medium",
  notes: "",
  suitable_fruits: [],
  suitable_vegetables: [],
  suitable_crops: [],
  fertilizer_recommendations: [],
  soil_improvement_watering: [],
  important_warnings: [],
  ai_generated: false,
  ai_available: true,
  failure_reason: "AI recommendation is temporarily unavailable.",
  created_at: "2026-09-14T15:59:27Z",
  updated_at: "2026-09-14T15:59:27Z",
};

const analyzed: SoilRecommendation = {
  ...failed,
  ai_generated: true,
  failure_reason: "",
  suitable_fruits: [{ id: "mango", name: "Mango", emoji: "🥭", reason: "Suits the soil." }],
  fertilizer_recommendations: [{ recommendation: "Add organic compost." }],
};

beforeEach(() => {
  fetchLatest.mockReset().mockResolvedValue(failed);
  reanalyze.mockReset();
  window.sessionStorage.clear();
});

describe("SoilRecommendationForm retry", () => {
  /**
   * A Gemini outage used to leave the Farmer at a dead end: the only way to
   * get a recommendation was to type the whole assessment in again.
   */
  it("re-runs the analysis on the saved assessment", async () => {
    reanalyze.mockResolvedValue(analyzed);
    render(<SoilRecommendationForm />);

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(reanalyze).toHaveBeenCalledWith("token", 7);
    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("keeps the button and says so when Gemini is still unavailable", async () => {
    reanalyze.mockResolvedValue(failed);
    render(<SoilRecommendationForm />);

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/still unavailable/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("offers to analyze an assessment that was saved without analysis", async () => {
    fetchLatest.mockResolvedValue({ ...failed, failure_reason: "" });
    render(<SoilRecommendationForm />);

    // The blank form's submit button shares this label, so wait for the
    // restored result screen before looking for the retry button.
    await screen.findByText(/no ai recommendation was generated/i);
    expect(screen.getByRole("button", { name: /get recommendation/i })).toBeEnabled();
  });
});
