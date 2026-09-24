import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";
import type { SoilRecommendation } from "@/lib/api/soil-api";

const fetchHistory = vi.fn();
const reanalyze = vi.fn();
const create = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/soil-api", () => ({
  createSoilRecommendation: (...args: unknown[]) => create(...args),
  fetchSoilRecommendations: (...args: unknown[]) => fetchHistory(...args),
  reanalyzeSoilRecommendation: (...args: unknown[]) => reanalyze(...args),
}));

const failed: SoilRecommendation = {
  id: 7,
  soil_temperature: "28.5",
  soil_moisture: "65.00",
  soil_conductivity: 850,
  soil_ph: "6.50",
  nitrogen: 120,
  phosphorus: 80,
  potassium: 150,
  soil_fertility: 600,
  has_sensor_readings: true,
  legacy_soil_type: "unknown",
  legacy_soil_texture: "unknown",
  legacy_drainage: "unknown",
  legacy_soil_moisture: "unknown",
  legacy_nitrogen: "unknown",
  legacy_phosphorus: "unknown",
  legacy_potassium: "unknown",
  legacy_organic_matter: "unknown",
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
  fetchHistory.mockReset().mockResolvedValue([failed]);
  reanalyze.mockReset();
  create.mockReset();
});

/** The page opens on the form; the saved result is behind "See Result". */
async function openSavedResult() {
  render(<SoilRecommendationForm />);
  await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
}

describe("SoilRecommendationForm retry", () => {
  /**
   * A Gemini outage used to leave the Farmer at a dead end: the only way to
   * get a recommendation was to type the whole assessment in again.
   */
  it("re-runs the analysis on the saved assessment", async () => {
    reanalyze.mockResolvedValue(analyzed);
    await openSavedResult();

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(reanalyze).toHaveBeenCalledWith("token", 7);
    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("keeps the button and says so when Gemini is still unavailable", async () => {
    reanalyze.mockResolvedValue(failed);
    await openSavedResult();

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/still unavailable/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("offers to analyze an assessment that was saved without analysis", async () => {
    fetchHistory.mockResolvedValue([{ ...failed, failure_reason: "" }]);
    await openSavedResult();

    // The blank form's submit button shares this label, so wait for the
    // result screen before looking for the retry button.
    await screen.findByText(/no ai recommendation was generated/i);
    expect(screen.getByRole("button", { name: /get recommendation/i })).toBeEnabled();
  });
});

/** Types a valid reading into all eight soil detector fields. */
async function fillReadings() {
  const values: Record<string, string> = {
    "soil-soil-temperature": "28.5",
    "soil-soil-moisture": "65",
    "soil-soil-conductivity": "850",
    "soil-soil-ph": "6.5",
    "soil-nitrogen": "120",
    "soil-phosphorus": "80",
    "soil-potassium": "150",
    "soil-soil-fertility": "600",
  };
  for (const [id, value] of Object.entries(values)) {
    await userEvent.type(document.getElementById(id) as HTMLElement, value);
  }
}

describe("SoilRecommendationForm result view", () => {
  it("opens on the form, with the saved result one click away", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    render(<SoilRecommendationForm />);

    expect(screen.getByText("Soil Detector Readings")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByText("Soil Detector Readings")).not.toBeInTheDocument();
  });

  it("offers no result button before anything was ever saved", async () => {
    fetchHistory.mockResolvedValue([]);
    render(<SoilRecommendationForm />);

    await waitFor(() => expect(fetchHistory).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "See Result" })).not.toBeInTheDocument();
  });

  it("goes straight to the result once the recommendation is saved", async () => {
    fetchHistory.mockResolvedValue([]);
    create.mockResolvedValue(analyzed);
    render(<SoilRecommendationForm />);

    await fillReadings();
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.getByText("Crop recommendation saved successfully.")).toBeInTheDocument();
  });

  it("returns to a blank form, and can show the result again", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    render(<SoilRecommendationForm />);

    await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
    await userEvent.click(screen.getByRole("button", { name: /back to soil information/i }));

    expect(screen.getByText("Soil Detector Readings")).toBeInTheDocument();
    expect(document.getElementById("soil-soil-ph")).toHaveValue(null);
    await userEvent.click(screen.getByRole("button", { name: "See Result" }));
    expect(await screen.findByText("Mango")).toBeInTheDocument();
  });
});

describe("SoilRecommendationForm past results", () => {
  const older: SoilRecommendation = {
    ...analyzed,
    id: 3,
    soil_ph: "5.40",
    suitable_fruits: [{ id: "pineapple", name: "Pineapple", emoji: "🍍", reason: "Likes acid soil." }],
    created_at: "2026-08-12T01:10:00Z",
    updated_at: "2026-08-12T01:10:00Z",
  };
  const newer: SoilRecommendation = { ...analyzed, id: 9, created_at: "2026-09-24T06:28:00Z" };

  it("opens the newest result and lists every saved one, newest first", async () => {
    fetchHistory.mockResolvedValue([newer, older]);
    await openSavedResult();

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    const options = Array.from(picker.options).map((option) => option.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatch(/September 24, 2026.*pH 6\.50 \(latest\)$/);
    expect(options[1]).toMatch(/August 12, 2026.*pH 5\.40$/);
  });

  it("shows an older result when it is picked, without another request", async () => {
    fetchHistory.mockResolvedValue([newer, older]);
    await openSavedResult();

    await userEvent.selectOptions(screen.getByLabelText("Result from"), "3");

    expect(await screen.findByText("Pineapple")).toBeInTheDocument();
    expect(screen.queryByText("Mango")).not.toBeInTheDocument();
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it("marks a result that was never analysed", async () => {
    fetchHistory.mockResolvedValue([newer, { ...older, ai_generated: false, failure_reason: "" }]);
    await openSavedResult();

    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    expect(picker.options[1].textContent).toMatch(/— not analyzed$/);
  });

  it("keeps the older results when a new one is added", async () => {
    fetchHistory.mockResolvedValue([older]);
    create.mockResolvedValue(newer);
    render(<SoilRecommendationForm />);
    await screen.findByRole("button", { name: "See Result" });

    await fillReadings();
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    expect(picker.value).toBe("9");
    expect(picker.options).toHaveLength(2);
    expect(picker.options[0].textContent).toMatch(/\(latest\)$/);
  });

  it("hides the picker when there is only one result", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    await openSavedResult();

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByLabelText("Result from")).not.toBeInTheDocument();
  });
});
