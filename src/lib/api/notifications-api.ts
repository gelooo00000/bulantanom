import { apiFetch } from "@/lib/api/client";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationType =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_APPROVED"
  | "PLANT_ADDED"
  | "PLANT_UPDATED"
  | "ASSESSMENT_SUBMITTED"
  | "ASSESSMENT_COMPLETED"
  | "ASSESSMENT_LOCKED"
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_ACCEPTED"
  | "EVIDENCE_REJECTED"
  | "AI_EVALUATION_COMPLETED"
  | "RISK_LOW"
  | "RISK_MEDIUM"
  | "RISK_HIGH"
  | "SOIL_RECOMMENDATION_READY"
  | "SOIL_ASSESSMENT_SAVED"
  | "ACCOUNT_REJECTED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DELETED"
  | "SOIL_WARNING"
  | "RISK_CHANGED"
  | "HARVEST_APPROACHING"
  | "HARVEST_READY"
  | "SYSTEM";

export type BackendNotification = {
  id: number;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  related_type: string;
  related_id: number | null;
  metadata: Record<string, unknown>;
  /** Where to navigate on click, built server-side from the recipient's role. */
  route: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: BackendNotification[];
};

/**
 * Notifications are mounted under both role prefixes and always resolve to
 * the authenticated user's own rows — the prefix follows the section the
 * user is in, it does not select whose notifications are returned.
 */
export type NotificationScope = "farmer" | "lgu" | "admin";

export function fetchNotifications(
  accessToken: string,
  scope: NotificationScope,
  {
    page = 1,
    pageSize = 20,
    unreadOnly = false,
  }: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
): Promise<NotificationPage> {
  // Django filters unread server-side (`?unread=true`), so the badge and the
  // list always agree and the client never filters a partial page itself.
  const unread = unreadOnly ? "&unread=true" : "";
  return apiFetch(
    `/${scope}/notifications/?page=${page}&page_size=${pageSize}${unread}`,
    { accessToken },
  );
}

export function fetchUnreadCount(
  accessToken: string,
  scope: NotificationScope,
): Promise<{ unread: number }> {
  return apiFetch(`/${scope}/notifications/unread-count/`, { accessToken });
}

export function markNotificationRead(
  accessToken: string,
  scope: NotificationScope,
  id: number,
): Promise<BackendNotification> {
  return apiFetch(`/${scope}/notifications/${id}/read/`, {
    method: "POST",
    accessToken,
  });
}

export function markAllNotificationsRead(
  accessToken: string,
  scope: NotificationScope,
): Promise<{ updated: number; unread: number }> {
  return apiFetch(`/${scope}/notifications/read-all/`, {
    method: "POST",
    accessToken,
  });
}
