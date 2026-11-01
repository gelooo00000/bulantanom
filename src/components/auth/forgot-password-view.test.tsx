import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordView } from "@/components/auth/forgot-password-view";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const requestPasswordReset = vi.fn();
const resetPassword = vi.fn();
vi.mock("@/lib/api/auth-api", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));
vi.mock("@/components/shared/theme-toggle", () => ({ ThemeToggle: () => null }));

async function askForCode() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "juan@example.com" } });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
  });
}

async function submitReset(code: string, password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText(/reset code/i), { target: { value: code } });
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
    target: { value: confirm },
  });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/reset code/i).closest("form")!);
  });
}

beforeEach(() => {
  router.push.mockClear();
  requestPasswordReset.mockReset();
  resetPassword.mockReset();
  requestPasswordReset.mockResolvedValue({ detail: "Code sent.", resend_after: 60 });
  resetPassword.mockResolvedValue({ detail: "Changed." });
  render(<ForgotPasswordView />);
});

describe("ForgotPasswordView", () => {
  it("asks for a code, then a new password, and returns to sign in", async () => {
    await askForCode();
    expect(requestPasswordReset).toHaveBeenCalledWith("juan@example.com");

    await submitReset("123456", "BrandNew456!");
    expect(resetPassword).toHaveBeenCalledWith({
      email: "juan@example.com",
      code: "123456",
      password: "BrandNew456!",
      password_confirm: "BrandNew456!",
    });
    expect(router.push).toHaveBeenCalledWith("/login?reset=1");
  });

  it("keeps the code step open when the backend refuses the code", async () => {
    resetPassword.mockRejectedValue(new Error("That code is not correct."));
    await askForCode();
    await submitReset("123456", "BrandNew456!");
    expect(screen.getByRole("alert")).toHaveTextContent("That code is not correct.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("catches mismatched passwords before calling the backend", async () => {
    await askForCode();
    await submitReset("123456", "BrandNew456!", "Different456!");
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords don't match.");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("makes Resend wait for the cooldown", async () => {
    await askForCode();
    expect(screen.getByText(/resend in 60s/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resend code/i })).toBeNull();
  });
});
