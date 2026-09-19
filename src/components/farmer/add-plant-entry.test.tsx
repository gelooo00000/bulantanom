import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddPlantButton } from "@/components/farmer/add-plant-button";
import { AddPlantTile } from "@/components/farmer/add-plant-tile";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

/**
 * The Base UI menu popup does not open under jsdom, so what is pinned here
 * is the part that has to be right regardless of the popup: two separately
 * labelled controls rather than one ambiguous one, and a main action that
 * goes straight to the add flow without the farmer opening a menu first.
 */

describe("AddPlantButton", () => {
  it("exposes the two halves as separately named controls", () => {
    render(<AddPlantButton />);
    expect(screen.getByRole("button", { name: "Add Plant" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More ways to add plants" }),
    ).toBeInTheDocument();
  });

  it("starts the add flow from the main half, no menu needed", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    push.mockClear();

    render(<AddPlantButton />);
    await user.click(screen.getByRole("button", { name: "Add Plant" }));

    expect(push).toHaveBeenCalledWith("/farmer/plants/new");
  });

  it("keeps the two halves as real buttons, never nested", () => {
    // A button inside a button is invalid HTML and announces as one control.
    const { container } = render(<AddPlantButton />);
    expect(container.querySelector("button button")).toBeNull();
    expect(container.querySelector("a button")).toBeNull();
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
