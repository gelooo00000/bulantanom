"use client";

import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import {
  Bell,
  CalendarCheck,
  CircleCheck,
  ClipboardList,
  FlaskConical,
  ImageOff,
  ImageIcon,
  Leaf,
  LoaderCircle,
  OctagonAlert,
  Sparkles,
  Sprout,
  TrendingUp,
  TriangleAlert,
  UserRoundPlus,
  UserRoundX,
  Volume2,
  VolumeX,
  Wheat,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ElementType,
} from "react";

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type BackendNotification,
  type NotificationScope,
  type NotificationType,
} from "@/lib/api/notifications-api";
import { useAuth } from "@/lib/auth/auth-context";
import { subscribeToNotificationRefresh } from "@/lib/notification-refresh";
import {
  getSoundPreference,
  getSoundPreferenceServerSnapshot,
  playNotificationSound,
  setNotificationSoundEnabled,
  subscribeToSoundPreference,
  unlockNotificationSound,
} from "@/lib/notification-sound";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<NotificationType, ElementType>> = {
  ACCOUNT_CREATED: UserRoundPlus,
  ACCOUNT_APPROVED: CircleCheck,
  ACCOUNT_REJECTED: OctagonAlert,
  ACCOUNT_SUSPENDED: OctagonAlert,
  ACCOUNT_DELETED: UserRoundX,
  PLANT_ADDED: Sprout,
  PLANT_UPDATED: Sprout,
  ASSESSMENT_SUBMITTED: ClipboardList,
  ASSESSMENT_COMPLETED: ClipboardList,
  ASSESSMENT_LOCKED: CalendarCheck,
  EVIDENCE_UPLOADED: ImageIcon,
  EVIDENCE_ACCEPTED: ImageIcon,
  EVIDENCE_REJECTED: ImageOff,
  AI_EVALUATION_COMPLETED: Sparkles,
  RISK_LOW: Leaf,
  RISK_MEDIUM: TriangleAlert,
  RISK_HIGH: OctagonAlert,
  SOIL_RECOMMENDATION_READY: FlaskConical,
  SOIL_ASSESSMENT_SAVED: FlaskConical,
  SOIL_WARNING: TriangleAlert,
  RISK_CHANGED: TrendingUp,
  HARVEST_APPROACHING: Wheat,
  HARVEST_READY: Wheat,
};

const SEVERITY_TONE: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-risk-low",
  warning: "text-risk-medium",
  critical: "text-risk-high",
};

/** Relative time from the stored timestamp — no invented dates. */
function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: BackendNotification;
  onOpen: (n: BackendNotification) => void;
}) {
  const Icon = ICONS[notification.notification_type] ?? Bell;
  const tone = SEVERITY_TONE[notification.severity] ?? SEVERITY_TONE.info;
  const critical = notification.severity === "critical";

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "hover:bg-muted/60 flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0",
        "border-border",
        !notification.is_read && "bg-primary/5",
        critical && !notification.is_read && "bg-risk-high/5",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm", notification.is_read ? "font-normal" : "font-medium")}>
            {notification.title}
          </span>
          {!notification.is_read && (
            <span
              aria-label="Unread"
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                critical ? "bg-risk-high" : "bg-primary",
              )}
            />
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-sm">
          {notification.message}
        </span>
        <span className="text-muted-foreground/60 mt-1 block text-xs">
          {timeAgo(notification.created_at)}
        </span>
      </span>
    </button>
  );
}

/**
 * The header bell. Everything shown here — the list, the unread badge, the
 * timestamps — comes from Django; nothing is counted or invented client-side.
 */
/**
 * How often a visible tab re-checks the unread count. Long enough to be
 * negligible load for a single farm, short enough that a Farmer notices an
 * Officer's action without refreshing. Actions in this tab do not wait for
 * it — they publish on the refresh bus and update instantly.
 */
const POLL_INTERVAL_MS = 60_000;

export function NotificationBell({ scope }: { scope: NotificationScope }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [items, setItems] = useState<BackendNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Server-side filter: Django returns only unread rows when this is on, so
  // the list never disagrees with the badge because of pagination.
  const [unreadOnly, setUnreadOnly] = useState(false);

  const soundEnabled = useSyncExternalStore(
    subscribeToSoundPreference,
    getSoundPreference,
    getSoundPreferenceServerSnapshot,
  );

  /*
   * Chime when the unread count *rises*.
   *
   * Watching the count in one place rather than at each `setUnread` call site
   * means every path that can produce a notification — the 60s poll, the
   * refresh bus after an action, a tab regaining focus — is covered by this
   * single effect, and the ones that lower the count (opening a notification,
   * marking all read) can never trigger it.
   */
  const previousUnread = useRef<number | null>(null);
  // `unread` starts at 0 before anything has been fetched, so the first
  // server response would otherwise look like a jump from 0 and chime on
  // every page navigation. Sound is armed only once a real count is known.
  const soundArmed = useRef(false);

  useEffect(() => {
    if (!soundArmed.current) return;
    const previous = previousUnread.current;
    previousUnread.current = unread;
    if (previous !== null && unread > previous) void playNotificationSound();
  }, [unread]);

  /*
   * Browsers only let an AudioContext start while the page has user
   * activation, and a notification arrives on a timer rather than on a click.
   * So audio is prepared on the first interaction after load — by which point
   * the user has signed in — and stays ready for the rest of the session.
   */
  useEffect(() => {
    const prepare = () => unlockNotificationSound();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const event of events) {
      window.addEventListener(event, prepare, { passive: true });
    }
    return () => {
      for (const event of events) window.removeEventListener(event, prepare);
    };
  }, []);

  // One paginated request serves both the list and the badge, so opening the
  // bell never pulls the whole history.
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const page = await fetchNotifications(accessToken, scope, {
        pageSize: 20,
        unreadOnly,
      });
      setItems(page.results);
      // Counted by Django over every row, not just this page.
      const { unread: count } = await fetchUnreadCount(accessToken, scope);
      setUnread(count);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, scope, unreadOnly]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await fetchNotifications(accessToken, scope, { pageSize: 20 });
        if (cancelled) return;
        setItems(page.results);
        const initialUnread = page.results.filter((n) => !n.is_read).length;
        // Baseline first, then arm — so notifications that were already
        // waiting when this mounted are shown silently, and only ones that
        // arrive from here on make a sound.
        previousUnread.current = initialUnread;
        soundArmed.current = true;
        setUnread(initialUnread);
      } catch {
        // A failed badge fetch is silent; the error surfaces when opened.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, scope]);

  // An action just produced a notification — reload at once so the badge is
  // correct immediately, rather than waiting for the Farmer to open the bell.
  useEffect(() => subscribeToNotificationRefresh(() => void load()), [load]);

  /**
   * Catches notifications this tab did not cause — an Officer approving an
   * account, an AI evaluation finishing, a harvest reminder.
   *
   * Polls only the unread *count*, which is a single integer, rather than
   * refetching the list; the list is loaded when the bell is opened. The
   * interval is paused whenever the tab is hidden and a fetch runs the moment
   * it becomes visible again, so a backgrounded tab costs nothing and a
   * returning Farmer sees the true count immediately instead of waiting out
   * the interval.
   */
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { unread: count } = await fetchUnreadCount(accessToken, scope);
        if (!cancelled) setUnread(count);
      } catch {
        // Transient failures are silent; the next tick or opening the bell
        // reconciles the badge.
      }
    };

    const start = () => {
      if (timer === undefined) timer = setInterval(sync, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync();
        start();
      } else {
        stop();
      }
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
    };
  }, [accessToken, scope]);

  async function handleOpen(notification: BackendNotification) {
    setOpen(false);
    if (!notification.is_read && accessToken) {
      setItems((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
      setUnread((n) => Math.max(0, n - 1));
      try {
        await markNotificationRead(accessToken, scope, notification.id);
      } catch {
        // The optimistic update is reconciled on the next load.
      }
    }
    if (notification.route) router.push(notification.route);
  }

  async function handleMarkAll() {
    if (!accessToken) return;
    setItems((current) => current.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead(accessToken, scope);
    } catch {
      await load();
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <Popover.Trigger
        className="text-muted-foreground hover:text-foreground border-border hover:bg-accent relative flex size-8 items-center justify-center rounded-lg border transition-colors"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup
            className={cn(
              "bg-popover text-popover-foreground border-border flex flex-col rounded-xl border shadow-lg",
              // Never wider than the viewport, never taller than the screen.
              "max-h-[min(28rem,80vh)] w-[min(24rem,calc(100vw-1.5rem))]",
            )}
          >
            <div className="border-border flex flex-col gap-2 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Notifications</span>
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAll}
                      className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setNotificationSoundEnabled(next);
                      // Play once on enabling, so the choice is audible and
                      // the click also satisfies the browser's autoplay gate.
                      if (next) void playNotificationSound();
                    }}
                    aria-pressed={soundEnabled}
                    aria-label={
                      soundEnabled
                        ? "Mute notification sound"
                        : "Unmute notification sound"
                    }
                    title={
                      soundEnabled
                        ? "Notification sound on"
                        : "Notification sound off"
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {soundEnabled ? (
                      <Volume2 className="size-3.5" />
                    ) : (
                      <VolumeX className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {([false, true] as const).map((only) => (
                  <button
                    key={String(only)}
                    type="button"
                    onClick={() => setUnreadOnly(only)}
                    className={cn(
                      "rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors",
                      unreadOnly === only
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {only ? `Unread${unread > 0 ? ` (${unread})` : ""}` : "All"}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderCircle className="text-primary size-5 animate-spin" />
                </div>
              ) : error ? (
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">{error}</p>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Bell className="text-muted-foreground/50 size-5" />
                  <p className="text-sm font-medium">
                    {unreadOnly ? "No unread notifications" : "No notifications yet"}
                  </p>
                  <p className="text-muted-foreground max-w-[15rem] text-sm">
                    {unreadOnly
                      ? "Everything here has been read."
                      : scope === "admin"
                        ? "Farmer registrations and account changes will appear here."
                        : scope === "lgu"
                          ? "Farmer registrations, assessments and risk changes will appear here."
                        : "Activity on your plants and assessments will appear here."}
                  </p>
                </div>
              ) : (
                items.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={handleOpen}
                  />
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
