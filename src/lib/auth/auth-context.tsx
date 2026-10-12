"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  loginAdmin,
  loginFarmer,
  loginLgu,
  logoutSession,
  isVerificationPending,
  refreshSession,
  resendFarmerCode,
  signupFarmer,
  verifyFarmerEmail,
  type BackendRole,
  type BackendUser,
} from "@/lib/api/auth-api";
import { ApiError, onSessionExpired } from "@/lib/api/client";
import {
  answerPresence,
  clearTabSignedIn,
  hasSignedInTab,
  isTabSignedIn,
  markTabSignedIn,
} from "@/lib/auth/tab-session";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-storage";
import type { AuthUser, Role } from "@/lib/auth/types";

/**
 * Thrown by `login` for a Farmer whose email was never verified: the
 * password was right, a code has been emailed, and the page should ask for
 * it instead of signing in.
 */
export class EmailNotVerifiedError extends Error {
  email: string;
  resendAfter: number;

  constructor(message: string, email: string, resendAfter: number) {
    super(message);
    this.name = "EmailNotVerifiedError";
    this.email = email;
    this.resendAfter = resendAfter;
  }
}

/** A sign-up waiting for its emailed code. */
export type PendingVerification = { email: string; resendAfter: number; message: string };

type AuthContextValue = {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string, role: Role) => Promise<AuthUser>;
  /** Creates the account and emails a code; nobody is signed in yet. */
  signup: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<PendingVerification>;
  /** Types the emailed code back, which signs the Farmer in. */
  verifyEmail: (email: string, code: string) => Promise<AuthUser>;
  /** Emails a new code; resolves to the seconds until another may be asked. */
  resendCode: (email: string) => Promise<number>;
  /**
   * Signs out. `redirectTo` is where the page goes afterwards; without it a
   * protected page falls back to /login, as it does when a session expires.
   */
  logout: (redirectTo?: string) => void;
  /** Where the last deliberate logout asked to go, if it named a page. */
  signedOutTo: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const BACKEND_ROLE_TO_ROLE: Record<BackendRole, Role> = {
  FARMER: "farmer",
  LGU_OFFICER: "lgu",
  ADMIN: "admin",
};

function mapBackendUser(user: BackendUser): AuthUser {
  return {
    id: String(user.id),
    name: user.full_name || `${user.first_name} ${user.last_name}`.trim(),
    firstName: user.first_name,
    email: user.email,
    role: BACKEND_ROLE_TO_ROLE[user.role],
    accountStatus: user.account_status,
  };
}

function messageFrom(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

const LOGIN_BY_ROLE: Record<Role, (email: string, password: string) => ReturnType<typeof loginFarmer>> = {
  farmer: loginFarmer,
  lgu: loginLgu,
  admin: loginAdmin,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenVersion, setTokenVersion] = useState(0);
  const [signedOutTo, setSignedOutTo] = useState<string | null>(null);

  useEffect(() => {
    // The access token lives only in memory, so a full page reload loses it.
    // On boot, try a cookie-based silent refresh (the HttpOnly refresh
    // cookie, invisible to JS, survives reloads) to re-establish the session
    // before rendering any protected route. If the account was suspended or
    // rejected mid-session, the backend refuses here and the user is signed out.
    let cancelled = false;
    (async () => {
      try {
        // The cookie outlives the tab, so only restore it in a tab that held
        // the session (a reload) or while another BulanTanom tab is signed in.
        // Once every tab has closed, the session is over - see tab-session.
        if (!(await hasSignedInTab())) {
          if (cancelled) return;
          setAccessToken(null);
          setCurrentUser(null);
          return;
        }

        const { access, user } = await refreshSession();
        if (cancelled) return;
        markTabSignedIn();
        setAccessToken(access);
        setCurrentUser(mapBackendUser(user));
        setTokenVersion((v) => v + 1);
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setCurrentUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Re-authentication failed, so the session really is over - the refresh
    // cookie expired, or the account was suspended mid-session and the backend
    // refused to renew it. Clearing local state lets RequireRole redirect to
    // /login rather than stranding the user on a page that can no longer load
    // anything.
    return onSessionExpired(() => {
      clearTabSignedIn();
      setCurrentUser(null);
      setTokenVersion((v) => v + 1);
    });
  }, []);

  // Lets a newly opened tab join this session instead of starting signed out.
  useEffect(() => answerPresence(isTabSignedIn), []);

  function startSession(access: string, user: BackendUser): AuthUser {
    setAccessToken(access);
    const mapped = mapBackendUser(user);
    markTabSignedIn();
    setSignedOutTo(null);
    setCurrentUser(mapped);
    setTokenVersion((v) => v + 1);
    return mapped;
  }

  async function login(email: string, password: string, role: Role): Promise<AuthUser> {
    try {
      const { access, user } = await LOGIN_BY_ROLE[role](email, password);
      return startSession(access, user);
    } catch (err) {
      if (err instanceof ApiError && isVerificationPending(err.body)) {
        throw new EmailNotVerifiedError(err.message, err.body.email, err.body.resend_after);
      }
      throw new Error(messageFrom(err));
    }
  }

  async function verifyEmail(email: string, code: string): Promise<AuthUser> {
    try {
      const { access, user } = await verifyFarmerEmail(email, code);
      return startSession(access, user);
    } catch (err) {
      throw new Error(messageFrom(err));
    }
  }

  async function resendCode(email: string): Promise<number> {
    try {
      return (await resendFarmerCode(email)).resend_after;
    } catch (err) {
      // Asked too soon: the body still says how long to wait.
      if (err instanceof ApiError && err.status === 429) {
        const wait = (err.body as { resend_after?: unknown } | undefined)?.resend_after;
        if (typeof wait === "number") return wait;
      }
      throw new Error(messageFrom(err));
    }
  }

  async function signup(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<PendingVerification> {
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const lastName = rest.join(" ");
    try {
      // No session yet: the account works once the emailed code comes back
      // through `verifyEmail`.
      const pending = await signupFarmer({
        first_name: firstName || input.name,
        // A single name has no last name; it is sent empty, never repeated.
        last_name: lastName,
        email: input.email,
        password: input.password,
        password_confirm: input.password,
      });
      return {
        email: pending.email,
        resendAfter: pending.resend_after,
        message: pending.detail,
      };
    } catch (err) {
      throw new Error(messageFrom(err));
    }
  }

  function logout(redirectTo?: string) {
    // Clear local state immediately so the UI reacts (RequireRole redirects
    // to `redirectTo`, or /login) without waiting on the network; the
    // server-side blacklist call fires in the background best-effort.
    setSignedOutTo(redirectTo ?? null);
    clearTabSignedIn();
    setAccessToken(null);
    setCurrentUser(null);
    setTokenVersion((v) => v + 1);
    void logoutSession().catch(() => {});
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        loading,
        // tokenVersion is read so this value changes identity when the token
        // rotates, letting consumers re-fetch with the new credentials.
        accessToken: tokenVersion >= 0 ? getAccessToken() : null,
        login,
        signup,
        verifyEmail,
        resendCode,
        logout,
        signedOutTo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
