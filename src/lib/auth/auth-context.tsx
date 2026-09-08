"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  loginAdmin,
  loginFarmer,
  loginLgu,
  logoutSession,
  refreshSession,
  signupFarmer,
  type BackendRole,
  type BackendUser,
} from "@/lib/api/auth-api";
import { ApiError, onSessionExpired } from "@/lib/api/client";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-storage";
import type { AuthUser, Role } from "@/lib/auth/types";

type AuthContextValue = {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string, role: Role) => Promise<AuthUser>;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    // The access token lives only in memory, so a full page reload loses it.
    // On boot, try a cookie-based silent refresh (the HttpOnly refresh
    // cookie, invisible to JS, survives reloads) to re-establish the session
    // before rendering any protected route. If the account was suspended or
    // rejected mid-session, the backend refuses here and the user is signed out.
    let cancelled = false;
    (async () => {
      try {
        const { access, user } = await refreshSession();
        if (cancelled) return;
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
      setCurrentUser(null);
      setTokenVersion((v) => v + 1);
    });
  }, []);

  async function login(email: string, password: string, role: Role): Promise<AuthUser> {
    try {
      const { access, user } = await LOGIN_BY_ROLE[role](email, password);
      setAccessToken(access);
      const mapped = mapBackendUser(user);
      setCurrentUser(mapped);
      setTokenVersion((v) => v + 1);
      return mapped;
    } catch (err) {
      throw new Error(messageFrom(err));
    }
  }

  async function signup(input: { name: string; email: string; password: string }): Promise<void> {
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const lastName = rest.join(" ");
    try {
      // Registration deliberately does NOT sign the user in — the account is
      // created PENDING and needs Admin approval before it can authenticate.
      await signupFarmer({
        first_name: firstName || input.name,
        last_name: lastName || firstName || input.name,
        email: input.email,
        password: input.password,
        password_confirm: input.password,
      });
    } catch (err) {
      throw new Error(messageFrom(err));
    }
  }

  function logout() {
    // Clear local state immediately so the UI reacts (RequireRole redirects
    // to /login) without waiting on the network; the server-side blacklist
    // call fires in the background best-effort.
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
        logout,
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
