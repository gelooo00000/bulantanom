import { ApiError, apiFetch, refreshSharedSession } from "@/lib/api/client";

export type BackendRole = "FARMER" | "LGU_OFFICER" | "ADMIN";
export type BackendAccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type BackendUser = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: BackendRole;
  account_status: BackendAccountStatus;
  date_joined: string;
};

type AuthResponse = { access: string; user: BackendUser };

export function signupFarmer(payload: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirm: string;
}): Promise<{ user: BackendUser; detail: string }> {
  return apiFetch("/auth/farmer/signup/", { method: "POST", body: payload });
}

export function loginFarmer(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/farmer/login/", { method: "POST", body: { email, password } });
}

export function loginLgu(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/lgu/login/", { method: "POST", body: { email, password } });
}

export function loginAdmin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/admin/login/", { method: "POST", body: { email, password } });
}

/** Cookie-based silent refresh — call on app boot to re-establish a session after a reload. */
export async function refreshSession(): Promise<AuthResponse> {
  const session = await refreshSharedSession();
  if (!session) throw new ApiError("No active session.", 401);
  return { access: session.access, user: session.user as BackendUser };
}

export function fetchCurrentUser(accessToken: string): Promise<BackendUser> {
  return apiFetch("/auth/me/", { accessToken });
}

export function logoutSession(): Promise<{ detail: string }> {
  return apiFetch("/auth/logout/", { method: "POST" });
}
