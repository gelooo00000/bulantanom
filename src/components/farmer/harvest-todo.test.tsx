import { render, screen } from "@testing-library/react";
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

// Five plants starting within the week: more tasks than fit before "See more".
const plants = [1, 2, 3, 4, 5].map(
  (n) =>
    ({
      id: n,
      crop: { id: "corn", name: "Corn", emoji: "🌽", category: "vegetable", category_label: "Vegetable" },
      variant: null,
      label: "",
      display_name: `Corn ${n}`,
      planting_date: isoIn(-90),
      expected_harvest_start: isoIn(n + 1),
      expected_harvest_end: isoIn(n + 20),
      status: "GROWING",
      status_label: "Growing",
      age_days: 90,
      is_planned: false,
    }) as unknown as BackendPlant,
);

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({ data: plants, loading: false, error: null, refetch: vi.fn() }),
}));

describe("What to do now", () => {
  it("opens as a popup from the checklist icon beside the title", async () => {
    render(<HarvestPage />);
    // Nothing takes room on the page until the icon is used.
    expect(screen.queryByText(/Corn 1 can be harvested/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "What to do now (5)" }));
    const popup = await screen.findByRole("dialog");
    expect(popup.querySelectorAll("li")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /See 2 more/ }));
    expect(popup.querySelectorAll("li")).toHaveLength(5);
    expect(screen.getByText(/Corn 5 can be harvested/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /See less/ }));
    expect(popup.querySelectorAll("li")).toHaveLength(3);
  });
});
