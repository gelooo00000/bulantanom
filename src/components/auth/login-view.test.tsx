import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_LOADING_MS } from "@/components/auth/dashboard-loading-screen";
import { LoginView } from "@/components/auth/login-view";
import type { AuthUser } from "@/lib/auth/types";

const router = { push: vi.fn(), replace: vi.fn() };
let roleParam: string | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => ({ get: (key: string) => (key === "role" ? roleParam : null) }),
}));

const login = vi.fn();
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ currentUser: null, login }),
}));
vi.mock("@/components/shared/theme-toggle", () => ({ ThemeToggle: () => null }));

function user(role: AuthUser["role"]): AuthUser {
  return {
    id: "1",
    name: "Juan Dela Cruz",
    firstName: "Juan",
    email: "juan@example.com",
    role,
    accountStatus: "APPROVED",
  };
}

async function signIn() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "juan@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "secret123" } });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  router.push.mockClear();
  router.replace.mockClear();
  login.mockReset();
  roleParam = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signing in", () => {
  it.each([
    ["farmer", null, "/farmer/dashboard"],
    ["lgu", "lgu", "/lgu/dashboard"],
  ] as const)(
    "shows the loading screen for a %s, then opens the dashboard after 5 seconds",
    async (role, param, dashboard) => {
      roleParam = param;
      login.mockResolvedValue(user(role));
      render(<LoginView />);
      await signIn();

      expect(screen.getByText("Preparing your dashboard...")).toBeInTheDocument();
      expect(screen.getByText(/Welcome back, Juan\./)).toBeInTheDocument();

      // Not a moment early...
      act(() => vi.advanceTimersByTime(DASHBOARD_LOADING_MS - 1));
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();

      // ...and exactly on time, to that role's own dashboard.
      act(() => vi.advanceTimersByTime(1));
      expect(router.replace).toHaveBeenCalledWith(dashboard);
    },
  );

  it("locks the whole screen while the sign-in is in flight", async () => {
    login.mockReturnValue(new Promise(() => {}));
    render(<LoginView />);
    await signIn();

    // The role switch, links and fields all sit inside the inert page.
    const lgu = screen.getByRole("button", { name: /LGU Officer/, hidden: true });
    expect(lgu.closest("[inert]")).not.toBeNull();
    expect(screen.getByText(/Back to home/).closest("[inert]")).not.toBeNull();

    // A second submit before the first answers sends nothing more.
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
    });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("sends Admin straight to the dashboard with no loading screen", async () => {
    roleParam = "admin";
    login.mockResolvedValue(user("admin"));
    render(<LoginView />);
    await signIn();

    expect(router.push).toHaveBeenCalledWith("/admin");
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
  });

  it("never shows the loading screen when sign-in fails", async () => {
    login.mockRejectedValue(new Error("Invalid email or password."));
    render(<LoginView />);
    await signIn();

    expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
    act(() => vi.advanceTimersByTime(DASHBOARD_LOADING_MS * 2));
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
