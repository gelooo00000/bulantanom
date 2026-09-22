import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyPlantsPage from "@/app/farmer/plants/page";
import type { BackendPlant } from "@/lib/api/plants-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));

const refetch = vi.fn();
let plants: BackendPlant[] = [];
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: plants, loading: false, error: null, refetch }),
}));

const deletePlant = vi.fn();
vi.mock("@/lib/api/plants-api", async (original) => ({
  ...(await original<typeof import("@/lib/api/plants-api")>()),
  deletePlant: (...args: unknown[]) => deletePlant(...args),
}));

function plant(id: number, name: string): BackendPlant {
  return {
    id,
    crop: { id: name.toLowerCase(), name, emoji: "🌱" },
    variant: null,
    label: "",
    display_name: name,
    planting_date: "2026-09-01",
    expected_harvest_start: "2026-12-01",
    expected_harvest_end: "2026-12-20",
    status: "GROWING",
    status_label: "Growing",
    age_days: 21,
    assessment_eligibility: { can_assess: true, next_assessment_date: null },
  } as unknown as BackendPlant;
}

beforeEach(() => {
  plants = [plant(1, "Banana"), plant(2, "Avocado"), plant(3, "Pineapple")];
  deletePlant.mockReset();
  refetch.mockReset();
});

async function startSelecting() {
  const user = userEvent.setup();
  render(<MyPlantsPage />);
  await user.click(screen.getByRole("button", { name: "Select" }));
  return user;
}

describe("My Plants", () => {
  it("no longer offers duplicate, add several, or CSV import", () => {
    render(<MyPlantsPage />);
    expect(screen.queryByText(/Duplicate existing plant|Add several at once|Import from CSV/)).toBeNull();
    expect(screen.getByRole("button", { name: "Add Plant" })).toBeInTheDocument();
  });

  it("opens plants normally until Select is pressed", () => {
    render(<MyPlantsPage />);
    expect(screen.getByRole("link", { name: /Banana/ })).toHaveAttribute("href", "/farmer/plants/1");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("turns each card into a checkbox in selection mode", async () => {
    const user = await startSelecting();
    const banana = screen.getByRole("checkbox", { name: "Select Banana" });
    expect(banana).toHaveAttribute("aria-checked", "false");
    await user.click(banana);
    expect(banana).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("toolbar", { name: "Selected plants" })).toHaveTextContent("1 selected");
    // No card opens its plant while selecting.
    expect(screen.queryByRole("link", { name: /Banana/ })).toBeNull();
  });

  it("selects and clears everything at once", async () => {
    const user = await startSelecting();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("toolbar")).toHaveTextContent("3 selected");
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("toolbar")).toHaveTextContent("Tap plants to select them");
  });

  it("keeps Delete disabled until something is selected", async () => {
    await startSelecting();
    expect(screen.getByRole("button", { name: /^Delete/ })).toBeDisabled();
  });

  it("asks 'are you sure' and lists what will be deleted — and deletes nothing on Cancel", async () => {
    const user = await startSelecting();
    await user.click(screen.getByRole("checkbox", { name: "Select Banana" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Avocado" }));
    await user.click(screen.getByRole("button", { name: "Delete (2)" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete 2 plants?");
    expect(dialog).toHaveTextContent(/permanently deletes .* It can't be undone/);
    expect(dialog).toHaveTextContent("Banana");
    expect(dialog).toHaveTextContent("Avocado");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deletePlant).not.toHaveBeenCalled();
  });

  it("deletes the selected plants once confirmed, and says so", async () => {
    deletePlant.mockResolvedValue(undefined);
    const user = await startSelecting();
    await user.click(screen.getByRole("checkbox", { name: "Select Banana" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Pineapple" }));
    await user.click(screen.getByRole("button", { name: "Delete (2)" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete 2 plants" }));

    expect(deletePlant).toHaveBeenCalledWith("token", 1);
    expect(deletePlant).toHaveBeenCalledWith("token", 3);
    expect(deletePlant).not.toHaveBeenCalledWith("token", 2);
    expect(await screen.findByText("2 plants deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it("says which plants failed, and keeps them selected to try again", async () => {
    deletePlant.mockImplementation((_token: string, id: number) =>
      id === 3 ? Promise.reject(new Error("offline")) : Promise.resolve(),
    );
    const user = await startSelecting();
    await user.click(screen.getByRole("checkbox", { name: "Select Banana" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Pineapple" }));
    await user.click(screen.getByRole("button", { name: "Delete (2)" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete 2 plants" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/1 of 2 could not be deleted \(Pineapple\)/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Delete 1 plant?");
  });

  it("leaves selection mode with Cancel", async () => {
    const user = await startSelecting();
    await user.click(screen.getByRole("checkbox", { name: "Select Banana" }));
    await user.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.getByRole("link", { name: /Banana/ })).toBeInTheDocument();
  });
});
