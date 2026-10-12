import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_LOADING_MS } from "@/components/auth/dashboard-loading-screen";
import { SignupView } from "@/components/auth/signup-view";
import type { AuthUser } from "@/lib/auth/types";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const signup = vi.fn();
const verifyEmail = vi.fn();
const resendCode = vi.fn();
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ currentUser: null, signup, verifyEmail, resendCode }),
}));

const CODE_SENT = {
  email: "maria@example.com",
  resendAfter: 60,
  message: "We sent a 6-digit code to maria@example.com.",
};

async function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: code } });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/verification code/i).closest("form")!);
  });
}
vi.mock("@/components/shared/theme-toggle", () => ({ ThemeToggle: () => null }));

const newFarmer: AuthUser = {
  id: "9",
  name: "Maria Santos",
  firstName: "Maria",
  email: "maria@example.com",
  role: "farmer",
  accountStatus: "PENDING",
};

async function createAccount(confirm = "secret123") {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Maria Santos" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "maria@example.com" } });
  fireEvent.change(document.getElementById("password")!, { target: { value: "secret123" } });
  fireEvent.change(document.getElementById("confirmPassword")!, { target: { value: confirm } });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  router.push.mockClear();
  router.replace.mockClear();
  signup.mockReset();
  verifyEmail.mockReset();
  resendCode.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creating a Farmer account", () => {
  it("asks for the emailed code before anything else", async () => {
    signup.mockResolvedValue(CODE_SENT);
    render(<SignupView />);
    await createAccount();

    expect(screen.getByText("Check your email.")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
    // The button waits for all six digits.
    expect(screen.getByRole("button", { name: /Verify and continue/ })).toBeDisabled();
  });

  it("keeps the farmer on the code step when the code is wrong", async () => {
    signup.mockResolvedValue(CODE_SENT);
    verifyEmail.mockRejectedValue(new Error("That code is not correct."));
    render(<SignupView />);
    await createAccount();
    await enterCode("123456");

    expect(verifyEmail).toHaveBeenCalledWith("maria@example.com", "123456");
    expect(screen.getByText("That code is not correct.")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
  });

  it("only offers a new code once the wait is over", async () => {
    signup.mockResolvedValue(CODE_SENT);
    resendCode.mockResolvedValue(60);
    render(<SignupView />);
    await createAccount();

    expect(screen.getByText("resend in 60s")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();
    for (let i = 0; i < 60; i++) act(() => vi.advanceTimersByTime(1000));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    });
    expect(resendCode).toHaveBeenCalledWith("maria@example.com");
    expect(screen.getByText("We sent a new code to maria@example.com.")).toBeInTheDocument();
  });

  it("shows the loading screen once the code is right, then opens the dashboard", async () => {
    signup.mockResolvedValue(CODE_SENT);
    verifyEmail.mockResolvedValue(newFarmer);
    render(<SignupView />);
    await createAccount();
    await enterCode("123456");

    expect(screen.getByText("Preparing your dashboard...")).toBeInTheDocument();
    // A new account is welcomed in, not welcomed back.
    expect(screen.getByText(/Welcome to BulanTanom, Maria\./)).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).toBeNull();

    act(() => vi.advanceTimersByTime(DASHBOARD_LOADING_MS - 1));
    expect(router.replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(router.replace).toHaveBeenCalledWith("/farmer/dashboard");
  });

  it("locks the whole screen while the account is being created", async () => {
    signup.mockReturnValue(new Promise(() => {}));
    render(<SignupView />);
    await createAccount();

    // The fields and the "Sign in" link all sit inside the inert page.
    expect(screen.getByText("Sign in").closest("[inert]")).not.toBeNull();
    expect(document.getElementById("password")!.closest("[inert]")).not.toBeNull();

    // A second submit before the first answers sends nothing more.
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
    });
    expect(signup).toHaveBeenCalledTimes(1);
  });

  it("unlocks the screen when sign-up fails", async () => {
    signup.mockRejectedValue(new Error("An account with this email already exists."));
    render(<SignupView />);
    await createAccount();

    expect(screen.getByText("Sign in").closest("[inert]")).toBeNull();
  });

  it("never shows the loading screen when sign-up fails", async () => {
    signup.mockRejectedValue(new Error("An account with this email already exists."));
    render(<SignupView />);
    await createAccount();

    expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
    act(() => vi.advanceTimersByTime(DASHBOARD_LOADING_MS * 2));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("never shows it when the form is rejected before sending", async () => {
    render(<SignupView />);
    await createAccount("different1");

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
    expect(screen.queryByText("Preparing your dashboard...")).toBeNull();
  });
});
