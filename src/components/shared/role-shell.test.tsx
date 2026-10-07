import { fireEvent, render, screen, within } from "@testing-library/react";
import { ClipboardList, LayoutDashboard, Leaf, Sprout, Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";

const logout = vi.fn();
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ currentUser: { name: "Admin", email: "a@example.com" }, logout }),
}));
let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
// The header widgets fetch on their own; they are not what is under test.
vi.mock("@/components/shared/farm-weather", () => ({
  ENGLISH_WEATHER: {},
  FarmWeather: () => null,
}));
vi.mock("@/components/shared/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/shared/theme-toggle", () => ({ ThemeToggle: () => null }));

/** The phone bottom bar - the only <nav> outside the desktop sidebar. */
function bottomBar() {
  const navs = screen.getAllByRole("navigation");
  return navs[navs.length - 1];
}

describe("RoleShell on a phone", () => {
  it("gives a one-page role (Admin) a Log out button in the bottom bar", () => {
    const items: NavItem[] = [{ label: "Account Management", href: "/admin", icon: Users }];
    render(
      <RoleShell roleLabel="Administrator" navItems={items} homeHref="/admin">
        <p>page</p>
      </RoleShell>,
    );

    const button = within(bottomBar()).getByRole("button", { name: "Log out" });
    fireEvent.click(button);
    // Log out returns to the landing page, not the Farmer / LGU sign-in.
    expect(logout).toHaveBeenCalledWith("/");
  });

  it("keeps Log out in the More menu when a role has overflow pages", () => {
    const items: NavItem[] = [
      { label: "Dashboard", href: "/a", icon: LayoutDashboard },
      { label: "Plants", href: "/b", icon: Sprout },
      { label: "History", href: "/c", icon: ClipboardList },
      { label: "Harvest", href: "/d", icon: Leaf },
    ];
    render(
      <RoleShell roleLabel="Farmer" navItems={items} homeHref="/a">
        <p>page</p>
      </RoleShell>,
    );

    const bar = bottomBar();
    expect(within(bar).getByText("More")).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: "Log out" })).toBeNull();
  });
});

describe("RoleShell active item", () => {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/farmer/dashboard", icon: LayoutDashboard },
    { label: "My Plants", href: "/farmer/plants", icon: Sprout },
    { label: "Crops", href: "/farmer/soil", icon: Leaf },
    {
      label: "Risk Indicator",
      href: "/farmer/risk-indicator",
      icon: ClipboardList,
      claims: /^\/farmer\/plants\/[^/]+\/assessment\/?$/,
    },
  ];
  const sidebarLink = (name: string) =>
    within(screen.getAllByRole("navigation")[0]).getByRole("link", { name });
  const lit = (name: string) => sidebarLink(name).className.includes("bg-primary");

  it("lights the item whose address the page sits under", () => {
    pathname = "/farmer/plants/7";
    render(
      <RoleShell roleLabel="Farmer" navItems={items} homeHref="/farmer/dashboard">
        <p>page</p>
      </RoleShell>,
    );
    expect(lit("My Plants")).toBe(true);
    expect(lit("Risk Indicator")).toBe(false);
  });

  it("lets an item claim a page under another item's address", () => {
    pathname = "/farmer/plants/7/assessment";
    render(
      <RoleShell roleLabel="Farmer" navItems={items} homeHref="/farmer/dashboard">
        <p>page</p>
      </RoleShell>,
    );
    expect(lit("Risk Indicator")).toBe(true);
    expect(lit("My Plants")).toBe(false);
    // On a phone Risk Indicator is inside More, so More is lit instead.
    expect(within(bottomBar()).getByText("More").closest("button")?.className).toContain(
      "text-primary",
    );
  });
});
