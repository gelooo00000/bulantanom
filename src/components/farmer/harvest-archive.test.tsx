import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import HarvestPage from "@/app/farmer/harvest/page";
import { canRestoreHarvest, type BackendPlant } from "@/lib/api/plants-api";

function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A watermelon in its harvest window: the one with "Mark as harvested".
const watermelon = {
  id: 7,
  crop: { id: "watermelon", name: "Watermelon", emoji: "🍉", category: "fruit", category_label: "Fruit" },
  variant: null,
  label: "",
  display_name: "Sugar Baby",
  planting_date: isoIn(-95),
  expected_harvest_start: isoIn(-5),
  expected_harvest_end: isoIn(16),
  status: "GROWING",
  status_label: "Growing",
  harvested_at: null,
  age_days: 95,
  is_planned: false,
} as unknown as BackendPlant;

const setPlantStatus = vi.fn();
const harvestPlant = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: [watermelon], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/api/plants-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/plants-api")>()),
  fetchPlants: vi.fn(),
  setPlantStatus: (...args: unknown[]) => setPlantStatus(...args),
  harvestPlant: (...args: unknown[]) => harvestPlant(...args),
}));

const report = {
  id: 1,
  quality: "GOOD",
  quality_label: "Good",
  final_health: "HEALTHY",
  final_health_label: "Healthy",
  advice_helped: "YES",
  advice_helped_label: "Yes",
  yield_amount: "12.00",
  yield_unit: "KG",
  yield_unit_label: "kg",
  photo_url: null,
  notes: "",
  harvested_on: isoIn(0),
  days_to_harvest: 95,
  expected_days: 90,
  timing: "ON_TIME",
  timing_label: "On time",
  assessments_count: 4,
  highest_risk: "HIGH",
  high_risk_count: 1,
  recovered_from_high: true,
  created_at: `${isoIn(0)}T08:00:00Z`,
};

function mockServer() {
  harvestPlant.mockResolvedValue({
    ...watermelon,
    status: "HARVESTED",
    harvested_at: new Date().toISOString(),
    harvest_report: report,
  });
  setPlantStatus.mockResolvedValue({ ...watermelon, harvest_report: null });
}

/** Opens the harvest report, answers the three required questions and saves. */
async function harvestWithReport() {
  await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));
  const form = await screen.findByRole("dialog", { name: "Harvest report" });
  await userEvent.click(within(form).getByRole("button", { name: "Good" }));
  await userEvent.click(within(form).getByRole("button", { name: "Healthy" }));
  await userEvent.click(within(form).getByRole("button", { name: "Yes" }));
  await userEvent.type(within(form).getByLabelText(/How much did you harvest/), "12");
  await userEvent.click(within(form).getByRole("button", { name: "Save and mark harvested" }));
}

describe("the harvest report", () => {
  it("asks the three required questions before anything is saved", async () => {
    mockServer();
    render(<HarvestPage />);
    await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));
    const form = await screen.findByRole("dialog", { name: "Harvest report" });
    await userEvent.click(within(form).getByRole("button", { name: "Save and mark harvested" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Please answer the three required questions.");
    expect(harvestPlant).not.toHaveBeenCalled();

    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark as harvested/ })).toBeInTheDocument();
  });

  it("saves the report, celebrates, and moves the plant to the Archive", async () => {
    mockServer();
    render(<HarvestPage />);
    await harvestWithReport();

    expect(harvestPlant).toHaveBeenCalledWith(
      "token",
      7,
      expect.objectContaining({
        quality: "GOOD",
        final_health: "HEALTHY",
        advice_helped: "YES",
        yield_amount: "12",
        yield_unit: "KG",
      }),
    );
    const party = await screen.findByRole("dialog", { name: "Successfully harvested!" });
    await userEvent.click(within(party).getByRole("button", { name: "Continue" }));

    expect(screen.getByText(/Sugar Baby was harvested and moved to the Archive/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View archive" }));
    const archive = screen.getByRole("list", { name: "Harvested" });
    expect(within(archive).getByText("12 kg")).toBeInTheDocument();
    expect(within(archive).getByText("Recovered from High risk")).toBeInTheDocument();
    // Moving to the Archive is final: no Restore, no Undo.
    expect(within(archive).queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});

describe("restoring an archived harvest", () => {
  it("is not offered more than 24 hours after a reported harvest", () => {
    const old = {
      ...watermelon,
      status: "HARVESTED",
      harvested_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      harvest_report: report,
    } as unknown as BackendPlant;
    expect(canRestoreHarvest(old)).toBe(false);
    expect(canRestoreHarvest({ ...old, harvested_at: new Date().toISOString() })).toBe(true);
    // Harvested before reports existed: unchanged.
    expect(canRestoreHarvest({ ...old, harvest_report: null })).toBe(true);
  });
});
