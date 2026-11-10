import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_LOADING_MS } from "@/components/auth/dashboard-loading-screen";
import { LoginView } from "@/components/auth/login-view";
import { EmailNotVerifiedError, NewDeviceError } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";

const router = { push: vi.fn(), replace: vi.fn() };
let roleParam: string | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => ({ get: (key: string) => (key === "role" ? roleParam : null) }),
}));

const login = vi.fn();
const verifyEmail = vi.fn();
const verifyLogin = vi.fn();
const resendLoginCode = vi.fn();
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    currentUser: null,
    login,
    verifyEmail,
    resendCode: vi.fn(),
    verifyLogin,
    resendLoginCode,
  }),
  EmailNotVerifiedError: class extends Error {
    constructor(
      message: string,
      public email: string,
      public resendAfter: number,
    ) {
      super(message);
    }
  },
  NewDeviceError: class extends Error {
    constructor(
      message: string,
      public email: string,
      public challenge: string,
      public resendAfter: number,
    ) {
      super(message);
    }
  },
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
  verifyEmail.mockReset();
  verifyLogin.mockReset();
  resendLoginCode.mockReset();
  roleParam = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signing in", () => {
  it.each([
    ["farmer", null, "/farmer/dashboard"],
    ["lgu", "lgu", "/lgu/analytics"],
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

  it("asks a Farmer who never verified their email for the code", async () => {
    login.mockRejectedValue(
      new EmailNotVerifiedError("Please verify your email first.", "juan@example.com", 60),
    );
    verifyEmail.mockResolvedValue(user("farmer"));
    render(<LoginView />);
    await signIn();

    expect(screen.getByText("Check your email.")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/verification code/i).closest("form")!);
    });
    expect(verifyEmail).toHaveBeenCalledWith("juan@example.com", "123456");
    expect(screen.getByText("Preparing your dashboard...")).toBeInTheDocument();
  });
});

describe("signing in on a new device", () => {
  it("asks for the emailed code, then signs in", async () => {
    login.mockRejectedValue(
      new NewDeviceError("New device.", "juan@example.com", "signed-challenge", 60),
    );
    verifyLogin.mockResolvedValue(user("farmer"));
    render(<LoginView />);
    await signIn();

    expect(screen.getByText("Is this you?")).toBeInTheDocument();
    expect(screen.getByText(/will not ask again for 30 days/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "654321" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/verification code/i).closest("form")!);
    });
    expect(verifyLogin).toHaveBeenCalledWith("juan@example.com", "signed-challenge", "654321");
    expect(screen.getByText("Preparing your dashboard...")).toBeInTheDocument();
  });

  it("sends Admin straight to the dashboard after the code", async () => {
    roleParam = "admin";
    login.mockRejectedValue(new NewDeviceError("New device.", "a@example.com", "c", 60));
    verifyLogin.mockResolvedValue(user("admin"));
    render(<LoginView />);
    await signIn();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "111111" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/verification code/i).closest("form")!);
    });
    expect(router.push).toHaveBeenCalledWith("/admin");
  });

  it("goes back to an empty password field", async () => {
    login.mockRejectedValue(new NewDeviceError("New device.", "juan@example.com", "c", 60));
    render(<LoginView />);
    await signIn();

    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
  });
});

describe("LoginView password managers", () => {
  it("lets the phone save and fill the email and password", () => {
    render(<LoginView />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByLabelText(/email/i).closest("form")).not.toHaveAttribute("autocomplete");
  });
});

describe("LoginView forgot password", () => {
  it("offers a reset to Farmers only", () => {
    render(<LoginView />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );

    fireEvent.click(screen.getByRole("button", { name: /lgu officer/i }));
    expect(screen.queryByRole("link", { name: /forgot password/i })).toBeNull();
  });
});

describe("signed out by another device", () => {
  it("says why, once", async () => {
    sessionStorage.setItem("bt-signed-out-reason", "signed_in_elsewhere");
    const { unmount } = render(<LoginView />);
    await act(async () => {});
    expect(screen.getByText(/signed in on another device/)).toBeInTheDocument();
    unmount();

    render(<LoginView />);
    await act(async () => {});
    expect(screen.queryByText(/signed in on another device/)).toBeNull();
  });
});
