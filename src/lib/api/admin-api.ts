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

/**
 * An account as the Admin list returns it: the safe profile, the records a
 * deletion would destroy, and whether the person is using BulanTanom now.
 */
export type AdminUser = BackendUser & {
  plant_count: number;
  assessment_count: number;
  soil_record_count: number;
  is_online: boolean;
  last_seen_at: string | null;
};

export function listUsers(
  accessToken: string,
  filters: { role?: BackendRole; status?: BackendAccountStatus } = {},
): Promise<AdminUser[]> {
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
 * An account that owns plants, assessments or soil records is refused (409)
 * unless `includeRecords` is set — which the Admin screen does only after a
 * confirmation listing what will be lost, since those records are deleted
 * with it. The server never deletes the caller's own account or any Admin.
 */
export function deleteAccount(
  accessToken: string,
  userId: number,
  { includeRecords = false }: { includeRecords?: boolean } = {},
): Promise<{ detail: string }> {
  const query = includeRecords ? "?include_records=true" : "";
  return apiFetch(`/admin/accounts/${userId}/${query}`, { method: "DELETE", accessToken });
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
