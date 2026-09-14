import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequireRole } from "@/components/auth/require-role";
import type { AuthUser } from "@/lib/auth/types";

const replace = vi.fn();
let auth: { currentUser: AuthUser | null; loading: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => auth }));

const farmer: AuthUser = {
  id: "1",
  name: "Juan Dela Cruz",
  firstName: "Juan",
  email: "juan@example.com",
  role: "farmer",
  accountStatus: "APPROVED",
};

function guarded() {
  return (
    <RequireRole role="farmer">
      <p>Farmer dashboard</p>
    </RequireRole>
  );
}

beforeEach(() => {
  replace.mockClear();
});

describe("RequireRole", () => {
  /**
   * The refresh cookie is a session cookie, so a reopened browser has no
   * session. A restored dashboard tab must land on the public landing page,
   * not the login form and never back inside the account.
   */
  it("sends a visitor who arrives with no session to the landing page", () => {
    auth = { currentUser: null, loading: false };
    render(guarded());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("sends a user whose session ends mid-use to the login page", () => {
    auth = { currentUser: farmer, loading: false };
    const { rerender, getByText } = render(guarded());
    expect(getByText("Farmer dashboard")).toBeInTheDocument();

    auth = { currentUser: null, loading: false };
    rerender(guarded());
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("does not redirect while the session is still being restored", () => {
    auth = { currentUser: null, loading: true };
    render(guarded());
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-in user of another role to their own dashboard", () => {
    auth = { currentUser: { ...farmer, role: "lgu" }, loading: false };
    render(guarded());
    expect(replace).toHaveBeenCalledWith("/lgu/dashboard");
  });
});
