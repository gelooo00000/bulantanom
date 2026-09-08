import type { BackendAccountStatus, BackendRole, BackendUser } from "@/lib/api/auth-api";
import { apiFetch } from "@/lib/api/client";

export type RegistrationNotification = {
  id: number;
  created_at: string;
  user: BackendUser;
};

/** Account figures for the Admin overview, counted in MySQL. */
export type AdminDashboard = {
  farmers: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  lgu_officers: number;
  admins: number;
  unread_notifications: number;
};

export function fetchAdminDashboard(accessToken: string): Promise<AdminDashboard> {
  return apiFetch("/admin/dashboard/", { accessToken });
}

export function listUsers(
  accessToken: string,
  filters: { role?: BackendRole; status?: BackendAccountStatus } = {},
): Promise<BackendUser[]> {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return apiFetch(`/admin/users/${query ? `?${query}` : ""}`, { accessToken });
}

export function listPendingRegistrations(
  accessToken: string,
): Promise<RegistrationNotification[]> {
  return apiFetch("/admin/registrations/", { accessToken });
}

export function approveFarmer(accessToken: string, userId: number): Promise<BackendUser> {
  return apiFetch(`/admin/farmers/${userId}/approve/`, { method: "PATCH", accessToken });
}

export function rejectFarmer(accessToken: string, userId: number): Promise<BackendUser> {
  return apiFetch(`/admin/farmers/${userId}/reject/`, { method: "PATCH", accessToken });
}

export function suspendFarmer(accessToken: string, userId: number): Promise<BackendUser> {
  return apiFetch(`/admin/farmers/${userId}/suspend/`, { method: "PATCH", accessToken });
}

/** LGU Officer status transitions — the mirror of the Farmer actions above. */
export function suspendOfficer(accessToken: string, userId: number): Promise<BackendUser> {
  return apiFetch(`/admin/officers/${userId}/suspend/`, { method: "PATCH", accessToken });
}

export function reactivateOfficer(
  accessToken: string,
  userId: number,
): Promise<BackendUser> {
  return apiFetch(`/admin/officers/${userId}/reactivate/`, {
    method: "PATCH",
    accessToken,
  });
}

/**
 * Permanently removes an account.
 *
 * The server refuses (409) when the account owns plants, assessments or soil
 * records, because those cascade — the Admin is told to suspend instead. It
 * also refuses to delete the caller's own account or any Admin.
 */
export function deleteAccount(
  accessToken: string,
  userId: number,
): Promise<{ detail: string }> {
  return apiFetch(`/admin/accounts/${userId}/`, { method: "DELETE", accessToken });
}

/**
 * Creates an LGU Officer. There is no public registration path for this
 * role — the endpoint is IsAdmin-guarded and sets role and account status
 * server-side, so nothing here is decided by the browser.
 *
 * The password is write-only on the serializer and is never echoed back.
 */
export function createLguOfficer(
  accessToken: string,
  payload: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  },
): Promise<BackendUser> {
  return apiFetch("/admin/lgu-officers/", {
    method: "POST",
    body: payload,
    accessToken,
  });
}
