import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeroCta } from "@/components/marketing/hero-cta";

const auth = vi.hoisted(() => ({ currentUser: null as { role: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => auth }));

describe("HeroCta", () => {
  it("starts a Farmer sign-up when nobody is signed in", () => {
    auth.currentUser = null;
    render(<HeroCta />);
    expect(screen.getByRole("link", { name: /Get started now/ })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("says it goes to the dashboard when someone is already signed in", () => {
    auth.currentUser = { role: "lgu" };
    render(<HeroCta />);
    expect(screen.getByRole("link", { name: /Go to my dashboard/ })).toHaveAttribute(
      "href",
      "/lgu/dashboard",
    );
    expect(screen.queryByText("Get started now")).toBeNull();
  });
});
