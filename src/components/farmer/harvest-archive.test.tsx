import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import HarvestPage from "@/app/farmer/harvest/page";
import type { BackendPlant } from "@/lib/api/plants-api";

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

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: [watermelon], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/api/plants-api", () => ({
  fetchPlants: vi.fn(),
  setPlantStatus: (...args: unknown[]) => setPlantStatus(...args),
}));

describe("the harvest archive", () => {
  it("moves a plant to the Archive when it is marked harvested, with undo", async () => {
    setPlantStatus.mockImplementation(async (_token, _id, status) => ({
      ...watermelon,
      status,
      harvested_at: status === "HARVESTED" ? `${isoIn(0)}T08:00:00Z` : null,
    }));
    render(<HarvestPage />);
    expect(screen.getByRole("button", { name: /Archive\s*0/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));

    // Gone from the main lists, announced, and counted in the Archive.
    expect(await screen.findByText(/Sugar Baby was harvested and moved to the Archive/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark as harvested/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archive\s*1/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View archive" }));
    const archive = screen.getByRole("list", { name: "Harvested" });
    expect(within(archive).getByText(/Harvested on/)).toBeInTheDocument();
    expect(within(archive).getByRole("button", { name: "Restore" })).toBeInTheDocument();

    // Back to the Harvest page, where it no longer appears.
    await userEvent.click(screen.getByRole("button", { name: /Back to Harvest/ }));
    expect(screen.getByText("Still growing")).toBeInTheDocument();
    expect(screen.queryByText("Sugar Baby")).not.toBeInTheDocument();
  });

  it("undoes a harvest from the banner", async () => {
    setPlantStatus.mockImplementation(async (_token, _id, status) => ({
      ...watermelon,
      status,
      harvested_at: status === "HARVESTED" ? `${isoIn(0)}T08:00:00Z` : null,
    }));
    render(<HarvestPage />);
    await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(setPlantStatus).toHaveBeenLastCalledWith("token", 7, "GROWING");
    expect(await screen.findByRole("button", { name: /Mark as harvested/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archive\s*0/ })).toBeInTheDocument();
  });

  it("celebrates a harvest with the crop in the middle, and not on undo", async () => {
    setPlantStatus.mockImplementation(async (_token, _id, status) => ({
      ...watermelon,
      status,
      harvested_at: status === "HARVESTED" ? `${isoIn(0)}T08:00:00Z` : null,
    }));
    render(<HarvestPage />);
    await userEvent.click(screen.getByRole("button", { name: /Mark as harvested/ }));

    const party = await screen.findByRole("dialog", { name: "Successfully harvested!" });
    // In the middle, and raining down.
    expect(within(party).getAllByText("🍉").length).toBeGreaterThan(1);
    expect(within(party).getByText(/Sugar Baby is done/)).toBeInTheDocument();

    await userEvent.click(within(party).getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Restore it, then undo the restore: back in the Archive, no second party.
    await userEvent.click(screen.getByRole("button", { name: "View archive" }));
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(setPlantStatus).toHaveBeenLastCalledWith("token", 7, "HARVESTED");
    expect(await screen.findByRole("button", { name: /Archive\s*1/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
