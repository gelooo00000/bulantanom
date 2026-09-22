import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddPlantButton } from "@/components/farmer/add-plant-button";
import { AddPlantTile } from "@/components/farmer/add-plant-tile";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("AddPlantButton", () => {
  it("is a single Add Plant button, with no menu of other ways in", () => {
    render(<AddPlantButton />);
    expect(screen.getByRole("button", { name: "Add Plant" })).toBeInTheDocument();
    // Duplicate, add several and CSV import were never built; they are gone.
    expect(screen.queryByRole("button", { name: "More ways to add plants" })).toBeNull();
    expect(screen.queryByText(/Duplicate existing plant|Add several at once|Import from CSV/)).toBeNull();
  });

  it("starts the add flow", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    push.mockClear();

    render(<AddPlantButton />);
    await user.click(screen.getByRole("button", { name: "Add Plant" }));

    expect(push).toHaveBeenCalledWith("/farmer/plants/new");
  });
});

describe("AddPlantTile", () => {
  it("links to the add flow", () => {
    render(<AddPlantTile />);
    expect(screen.getByRole("link", { name: /Add another plant/ })).toHaveAttribute(
      "href",
      "/farmer/plants/new",
    );
  });

  it("says what the farmer gets for tapping it", () => {
    render(<AddPlantTile />);
    expect(
      screen.getByText(/See what's recommended to plant now/),
    ).toBeInTheDocument();
  });
});
