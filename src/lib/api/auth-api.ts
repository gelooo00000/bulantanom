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

/**
 * A Farmer account waiting for the 6-digit code emailed to it. Returned by
 * sign-up, and in the body of a 403 from a Farmer login whose email was
 * never verified.
 */
export type VerificationPending = {
  detail: string;
  code: "email_not_verified";
  email: string;
  /** Seconds until "Resend code" may be used. */
  resend_after: number;
};

export function isVerificationPending(body: unknown): body is VerificationPending {
  return (
    !!body &&
    typeof body === "object" &&
    (body as Record<string, unknown>).code === "email_not_verified" &&
    typeof (body as Record<string, unknown>).email === "string"
  );
}

/**
 * Creates the Farmer account and emails it a one-time code. Nobody is
 * signed in yet: that happens in `verifyFarmerEmail` once the code is typed
 * back, which proves the email address is real.
 */
export function signupFarmer(payload: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirm: string;
}): Promise<VerificationPending> {
  return apiFetch("/auth/farmer/signup/", { method: "POST", body: payload });
}

/** Checks the emailed code; signs the Farmer in exactly as a login does. */
export function verifyFarmerEmail(email: string, code: string): Promise<AuthResponse> {
  return apiFetch("/auth/farmer/verify/", { method: "POST", body: { email, code } });
}

export function resendFarmerCode(
  email: string,
): Promise<{ detail: string; resend_after: number }> {
  return apiFetch("/auth/farmer/resend-code/", { method: "POST", body: { email } });
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

/** Tells Django this user still has BulanTanom open (for the LGU's online dot). */
export function sendHeartbeat(accessToken: string): Promise<void> {
  return apiFetch("/auth/heartbeat/", { method: "POST", accessToken });
}
