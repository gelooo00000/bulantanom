import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AddPlantPage from "@/app/farmer/plants/new/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
// Both of the page's queries (the crop catalog and the farmer's plants)
// come back loaded: the catalog is `catalog`, empty unless a test fills it,
// and the farmer has no plants yet.
const catalog = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: (query: { name: string }) => ({
    data: query.name === "fetchCrops" ? catalog.data : [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const PINEAPPLE = {
  id: "pineapple",
  name: "Pineapple",
  category: "FRUIT",
  category_display: "Fruit",
  description: "",
  growing_duration_days: 540,
  harvest_window_days: 30,
  search_terms: [],
  variants: [],
  planting_window: null,
};

function dayFromToday(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

afterEach(() => {
  catalog.data = [];
  window.history.replaceState(null, "", "/");
});

describe("Add a Plant", () => {
  it("offers a way back to My Plants", () => {
    render(<AddPlantPage />);
    expect(screen.getByRole("link", { name: /Back to My Plants/ })).toHaveAttribute(
      "href",
      "/farmer/plants",
    );
  });

  it("no longer asks for a label", () => {
    render(<AddPlantPage />);
    expect(screen.queryByLabelText(/Label/)).toBeNull();
    expect(screen.queryByPlaceholderText(/North Row/)).toBeNull();
    expect(screen.queryByText(/tell this planting apart/)).toBeNull();
  });

  it("still asks for the crop and the planting date", () => {
    render(<AddPlantPage />);
    expect(screen.getByText("Crop")).toBeInTheDocument();
    expect(screen.getByText("Planting date")).toBeInTheDocument();
  });

  it("starts on the crop and day carried in a suggestion link", () => {
    catalog.data = [PINEAPPLE];
    window.history.replaceState(null, "", `/?crop=pineapple&date=${dayFromToday(3)}`);
    render(<AddPlantPage />);
    // Continue unlocks only once both a crop and a date are set.
    expect(screen.getByRole("button", { name: /Continue/ })).toBeEnabled();
  });

  it("ignores a link's unknown crop and past date", () => {
    catalog.data = [PINEAPPLE];
    window.history.replaceState(null, "", `/?crop=durian&date=${dayFromToday(-3)}`);
    render(<AddPlantPage />);
    expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });
});
