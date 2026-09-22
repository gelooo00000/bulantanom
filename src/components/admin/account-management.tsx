"use client";

import {
  Ban,
  CircleCheck,
  Clock,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sprout,
  Trash2,
  TriangleAlert,
  UserRoundPlus,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CreateOfficerDialog } from "@/components/admin/create-officer-dialog";
import { lastActiveLabel } from "@/components/lgu/farmer-directory";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionsMenu, type ActionItem } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  approveFarmer,
  deleteAccount,
  listUsers,
  reactivateOfficer,
  rejectFarmer,
  suspendFarmer,
  suspendOfficer,
  type AdminUser,
} from "@/lib/api/admin-api";
import type { BackendAccountStatus } from "@/lib/api/auth-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BackendAccountStatus, string> = {
  PENDING: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  APPROVED: "bg-risk-low/15 text-risk-low border-risk-low/30",
  REJECTED: "bg-risk-high/15 text-risk-high border-risk-high/30",
  SUSPENDED: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

const STATUS_LABEL: Record<BackendAccountStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const ROLE_LABEL = {
  FARMER: "Farmer",
  LGU_OFFICER: "LGU Officer",
  ADMIN: "Admin",
} as const;

/**
 * Django Admin sits on the API host, not the Next.js host. Derived from the
 * configured API base so it follows the backend in every environment.
 */
const DJANGO_ADMIN_LGU_URL = `${(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/api\/?$/, "")}/admin/accounts/lguofficer/`;

type TabKey = "pending" | "farmers" | "officers" | "all";
type SortKey = "newest" | "name" | "active";

/** Plants, assessments and soil checks — everything a deletion would take. */
export function recordCount(user: AdminUser): number {
  return user.plant_count + user.assessment_count + user.soil_record_count;
}

/** "6 plants · 12 assessments · 3 soil checks", only the parts that exist. */
export function recordsText(user: AdminUser): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(user.plant_count, "plant", "plants");
  add(user.assessment_count, "assessment", "assessments");
  add(user.soil_record_count, "soil check", "soil checks");
  return parts.length > 0 ? parts.join(" · ") : "No farm records";
}

/**
 * An action the Admin has chosen but not yet confirmed. Holding the target
 * account (rather than an id) lets the dialog name exactly who is affected,
 * which is the point of the confirmation step. Nothing is sent to the server
 * until the Admin confirms.
 */
export type PendingAction =
  | { kind: "suspend" | "reactivate" | "reject" | "delete"; user: AdminUser }
  | { kind: "approve-all"; users: AdminUser[] };

export function AccountManagement() {
  const { accessToken, currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  // Client-side narrowing of an already-authorized list. The server decides
  // *which* accounts this Admin may see; these only decide what is shown.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BackendAccountStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [tab, setTab] = useState<TabKey>("farmers");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creatingOfficer, setCreatingOfficer] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setUsers(await listUsers(accessToken));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // Fetch runs inside an async IIFE so no setState happens synchronously
    // in the effect body; `cancelled` guards against a late resolve after
    // unmount.
    let cancelled = false;
    (async () => {
      if (!accessToken) return;
      try {
        const data = await listUsers(accessToken);
        if (cancelled) return;
        setUsers(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load accounts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function approve(user: AdminUser) {
    if (!accessToken) return;
    setBusyId(user.id);
    setError(null);
    try {
      await approveFarmer(accessToken, user.id);
      await load();
      setToast(`${user.full_name} approved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Runs the confirmed action against Django, then refetches. Nothing is
   * mutated locally — the server response (or a reload) is the only source
   * of the new state, so a failed request never leaves the list lying.
   */
  async function runPendingAction() {
    if (!accessToken || !pendingAction) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      if (pendingAction.kind === "approve-all") {
        const results = await Promise.allSettled(
          pendingAction.users.map((u) => approveFarmer(accessToken, u.id)),
        );
        const failed = pendingAction.users.filter((_, i) => results[i].status === "rejected");
        await load();
        if (failed.length > 0) {
          setPendingAction({ kind: "approve-all", users: failed });
          setDialogError(
            `${failed.length} could not be approved (${failed.map((u) => u.full_name).join(", ")}). Try again.`,
          );
          return;
        }
        setPendingAction(null);
        setToast(
          `${pendingAction.users.length} registration${pendingAction.users.length === 1 ? "" : "s"} approved.`,
        );
        return;
      }

      const { user, kind } = pendingAction;
      const isOfficer = user.role === "LGU_OFFICER";
      if (kind === "delete") {
        await deleteAccount(accessToken, user.id, { includeRecords: recordCount(user) > 0 });
      } else if (kind === "reject") {
        await rejectFarmer(accessToken, user.id);
      } else if (kind === "suspend") {
        await (isOfficer ? suspendOfficer : suspendFarmer)(accessToken, user.id);
      } else {
        await (isOfficer ? reactivateOfficer : approveFarmer)(accessToken, user.id);
      }
      await load();
      setPendingAction(null);
      setToast(
        {
          delete: `${user.full_name}'s account was deleted.`,
          reject: `${user.full_name}'s registration was rejected.`,
          suspend: `${user.full_name}'s account was suspended.`,
          reactivate: `${user.full_name}'s account was reactivated.`,
        }[kind],
      );
    } catch (err) {
      // Stay open with the reason — the row must not disappear on failure.
      setDialogError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setDialogBusy(false);
    }
  }

  /** Only the moves that are legal for this row's role and current status. */
  function actionsFor(user: AdminUser): ActionItem[] {
    const items: ActionItem[] = [];
    const isSelf = String(user.id) === currentUser?.id;
    const busy = busyId === user.id;

    if (user.role === "ADMIN") return items;

    if (user.account_status === "PENDING") {
      items.push({ label: "Approve", icon: CircleCheck, disabled: busy, onSelect: () => approve(user) });
      items.push({
        label: "Reject",
        icon: UserRoundX,
        disabled: busy,
        onSelect: () => setPendingAction({ kind: "reject", user }),
      });
    }
    if (user.account_status === "APPROVED") {
      items.push({
        label: "Suspend account",
        icon: Ban,
        disabled: busy,
        onSelect: () => setPendingAction({ kind: "suspend", user }),
      });
    }
    if (user.account_status === "SUSPENDED" || user.account_status === "REJECTED") {
      items.push({
        label: "Reactivate account",
        icon: RotateCcw,
        disabled: busy,
        onSelect: () => setPendingAction({ kind: "reactivate", user }),
      });
    }
    items.push({
      label: "Delete account",
      icon: Trash2,
      destructive: true,
      disabled: busy || isSelf,
      onSelect: () => setPendingAction({ kind: "delete", user }),
    });
    return items;
  }

  const pending = users.filter((u) => u.role === "FARMER" && u.account_status === "PENDING");
  const farmers = users.filter((u) => u.role === "FARMER");
  const officers = users.filter((u) => u.role === "LGU_OFFICER");
  const onlineNow = users.filter((u) => u.is_online).length;

  const query = search.trim().toLowerCase();
  /** One set of controls narrows and orders every tab. */
  function narrow(list: AdminUser[]) {
    return list
      .filter((u) => {
        const matchesStatus = statusFilter === "ALL" || u.account_status === statusFilter;
        const matchesQuery =
          query === "" ||
          u.full_name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        if (sort === "name") return a.full_name.localeCompare(b.full_name);
        if (sort === "active") {
          // Online first, then most recently active, then never signed in.
          return (
            Number(b.is_online) - Number(a.is_online) ||
            (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "")
          );
        }
        return b.date_joined.localeCompare(a.date_joined);
      });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  const TABS: {
    key: TabKey;
    label: string;
    total: number;
    rows: AdminUser[];
    empty: { icon: typeof Users; title: string; description?: string };
  }[] = [
    {
      key: "pending",
      label: "Pending",
      total: pending.length,
      rows: narrow(pending),
      empty: {
        icon: CircleCheck,
        title: "No pending registrations",
        description: "New Farmer sign-ups will appear here for review.",
      },
    },
    {
      key: "farmers",
      label: "Farmers",
      total: farmers.length,
      rows: narrow(farmers),
      empty: {
        icon: Sprout,
        title: farmers.length === 0 ? "No farmers yet" : "No farmers match this filter",
        description:
          farmers.length === 0
            ? "Farmer accounts appear here once people register."
            : "Try a different status or clear the search.",
      },
    },
    {
      key: "officers",
      label: "LGU Officers",
      total: officers.length,
      rows: narrow(officers),
      empty: {
        icon: ShieldCheck,
        title: "No LGU Officers yet",
        description:
          "Officers cannot register themselves. Create one to give an agricultural officer access.",
      },
    },
    {
      key: "all",
      label: "All accounts",
      total: users.length,
      rows: narrow(users),
      empty: { icon: Users, title: "No accounts yet" },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {toast ? (
        <div
          role="status"
          className="border-risk-low/30 bg-risk-low/10 text-risk-low flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm"
        >
          <span className="flex items-center gap-2">
            <CircleCheck className="size-4 shrink-0" />
            {toast}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <CreateOfficerDialog
        open={creatingOfficer}
        onOpenChange={setCreatingOfficer}
        onCreated={async (name) => {
          await load();
          setToast(`LGU Officer account created for ${name}.`);
        }}
      />

      {pendingAction ? (
        <ActionConfirm
          action={pendingAction}
          busy={dialogBusy}
          error={dialogError}
          onCancel={() => {
            setPendingAction(null);
            setDialogError(null);
          }}
          onConfirm={runPendingAction}
          onSuspendInstead={(user) => {
            setDialogError(null);
            setPendingAction({ kind: "suspend", user });
          }}
        />
      ) : null}

      <PageHeader
        title="Account Management"
        description="Approve registrations, manage access, and see who is using BulanTanom."
        action={
          <Button size="sm" onClick={() => setCreatingOfficer(true)}>
            <UserRoundPlus className="size-3.5" />
            Create LGU Officer
          </Button>
        }
      />

      {error && (
        <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm">{error}</p>
      )}

      {/* A compact overview: the counts an Admin checks, in one line. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Overview
          icon={Clock}
          label="Pending approval"
          value={pending.length}
          tone={pending.length > 0 ? "text-risk-medium" : undefined}
          onClick={pending.length > 0 ? () => setTab("pending") : undefined}
        />
        <Overview icon={Sprout} label="Farmers" value={farmers.length} onClick={() => setTab("farmers")} />
        <Overview icon={ShieldCheck} label="LGU Officers" value={officers.length} onClick={() => setTab("officers")} />
        <Overview icon={Users} label="Online now" value={onlineNow} tone={onlineNow > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined} />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <TabsTab key={t.key} value={t.key}>
              {t.label}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  t.key === "pending" && t.total > 0 ? "text-risk-medium font-medium" : "text-muted-foreground",
                )}
              >
                {t.total}
              </span>
            </TabsTab>
          ))}
        </TabsList>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              placeholder="Search name or email"
              aria-label="Search accounts"
              className="border-border bg-card focus-visible:ring-ring/50 h-9 w-full rounded-lg border pr-3 pl-9 text-sm focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort accounts"
            className="border-border bg-card h-9 rounded-lg border px-3 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="active">Recently active</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(["ALL", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                statusFilter === value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "ALL" ? "All statuses" : STATUS_LABEL[value]}
            </button>
          ))}
        </div>

        {TABS.map((t) => (
          <TabsPanel key={t.key} value={t.key} className="flex flex-col gap-3">
            {t.key === "pending" && t.rows.length > 1 && (
              <div className="border-risk-medium/30 bg-risk-medium/10 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm">
                <span>
                  {t.rows.length} registrations waiting for review.
                </span>
                <Button size="sm" onClick={() => setPendingAction({ kind: "approve-all", users: t.rows })}>
                  <CircleCheck className="size-3.5" />
                  Approve all ({t.rows.length})
                </Button>
              </div>
            )}

            {t.rows.length === 0 ? (
              <EmptyState icon={t.empty.icon} title={t.empty.title} description={t.empty.description} />
            ) : (
              <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
                {t.rows.map((user) => (
                  <AccountRow
                    key={user.id}
                    user={user}
                    busy={busyId === user.id}
                    actions={actionsFor(user)}
                    showRole={t.key === "all"}
                    onApprove={t.key === "pending" ? () => approve(user) : undefined}
                    onReject={
                      t.key === "pending" ? () => setPendingAction({ kind: "reject", user }) : undefined
                    }
                  />
                ))}
              </ul>
            )}

            {/* The provisioning reference belongs with the Officers it
                describes, not stacked above the whole page. */}
            {t.key === "officers" && (
              <div className="border-border text-muted-foreground flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-xs">
                <p className="max-w-lg">
                  Officers have no public registration. They can also be provisioned, deactivated,
                  and have passwords reset in the Django Administration panel.
                </p>
                <a
                  href={DJANGO_ADMIN_LGU_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-foreground flex shrink-0 items-center gap-1.5 underline-offset-2 hover:underline"
                >
                  Open Django Admin
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  );
}

function Overview({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <Icon className={cn("size-4 shrink-0", tone ?? "text-muted-foreground")} />
      <span className="min-w-0">
        <span className={cn("block text-lg leading-tight font-medium tabular-nums", tone)}>{value}</span>
        <span className="text-muted-foreground block truncate text-xs">{label}</span>
      </span>
    </>
  );
  const className = "border-border bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, "hover:bg-accent/40 transition-colors")}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * One account: who, whether they are on BulanTanom now, their role and
 * status, and — for a Farmer — the records they own, which is what a
 * deletion would take with it.
 */
function AccountRow({
  user,
  busy,
  actions,
  showRole,
  onApprove,
  onReject,
}: {
  user: AdminUser;
  busy: boolean;
  actions: ActionItem[];
  showRole?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const initials =
    `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();
  const joined = new Date(user.date_joined).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="hover:bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors">
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
      >
        {initials}
        {user.is_online && (
          <span className="border-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-400" />
        )}
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{user.full_name || user.email}</span>
          {showRole && (
            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]">
              {ROLE_LABEL[user.role]}
            </span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        <p className="text-muted-foreground/80 mt-0.5 flex flex-wrap gap-x-3 text-xs">
          <span>Joined {joined}</span>
          <span className={cn(user.is_online && "font-medium text-emerald-600 dark:text-emerald-400")}>
            {user.is_online ? "Online now" : lastActiveLabel(user.last_seen_at)}
          </span>
          {user.role === "FARMER" && <span>{recordsText(user)}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            STATUS_STYLE[user.account_status],
          )}
        >
          {STATUS_LABEL[user.account_status]}
        </span>
        {onApprove && onReject ? (
          <>
            <Button size="sm" disabled={busy} onClick={onApprove}>
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <CircleCheck className="size-3.5" />}
              Approve
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onReject}>
              <UserRoundX className="size-3.5" />
              Reject
            </Button>
          </>
        ) : (
          <ActionsMenu items={actions} disabled={busy} label={`Actions for ${user.full_name}`} />
        )}
      </div>
    </li>
  );
}

/**
 * The "are you sure?" for every action. Deleting is where it matters most:
 * the dialog says exactly what goes with the account, and the Admin has to
 * type the account's email — or DELETE, for one with no records — before
 * the button unlocks.
 */
export function ActionConfirm({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
  onSuspendInstead,
}: {
  action: PendingAction;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onSuspendInstead: (user: AdminUser) => void;
}) {
  const common = {
    open: true,
    onOpenChange: (open: boolean) => {
      if (!open && !busy) onCancel();
    },
    busy,
    error,
    onConfirm,
  };

  if (action.kind === "approve-all") {
    return (
      <ConfirmDialog
        {...common}
        title={`Approve ${action.users.length} registration${action.users.length === 1 ? "" : "s"}?`}
        description="Each farmer will be able to sign in and start tracking plants, and will be emailed that they were approved."
        confirmLabel={busy ? "Approving…" : `Yes, approve ${action.users.length}`}
        details={
          <ul className="max-h-40 overflow-y-auto text-sm">
            {action.users.map((u) => (
              <li key={u.id} className="truncate py-0.5">
                {u.full_name} <span className="text-muted-foreground">· {u.email}</span>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  const { user, kind } = action;
  const who = (
    <>
      <p className="text-muted-foreground text-xs">{ROLE_LABEL[user.role]}</p>
      <p className="text-sm font-medium">{user.full_name}</p>
      <p className="text-muted-foreground text-sm">{user.email}</p>
    </>
  );

  if (kind === "delete") {
    const records = recordCount(user);
    return (
      <ConfirmDialog
        {...common}
        destructive
        title={`Delete ${user.full_name}'s account?`}
        description={`${
          records > 0
            ? "This permanently deletes the account AND everything it owns. It cannot be undone."
            : "This permanently deletes the account. It cannot be undone."
        } ${user.email} will be emailed that the account was deleted.`}
        // An account with farm records asks for its own email, so the
        // Admin has to look at exactly whose history they are erasing.
        confirmPhrase={records > 0 ? user.email : "DELETE"}
        confirmLabel={busy ? "Deleting…" : "Yes, delete permanently"}
        details={
          <>
            {who}
            {records > 0 && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mt-2 flex gap-2 rounded-lg border p-2.5 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Also deleted, for good:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {user.plant_count > 0 && (
                      <li>
                        {user.plant_count} plant{user.plant_count === 1 ? "" : "s"}
                      </li>
                    )}
                    {user.assessment_count > 0 && (
                      <li>
                        {user.assessment_count} weekly assessment{user.assessment_count === 1 ? "" : "s"},
                        with their AI risk readings and evidence photos
                      </li>
                    )}
                    {user.soil_record_count > 0 && (
                      <li>
                        {user.soil_record_count} soil check{user.soil_record_count === 1 ? "" : "s"} and
                        crop recommendations
                      </li>
                    )}
                  </ul>
                  {user.account_status === "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => onSuspendInstead(user)}
                      disabled={busy}
                      className="text-foreground mt-2 text-xs font-medium underline underline-offset-2"
                    >
                      Suspend instead — blocks access but keeps the records
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        }
      />
    );
  }

  const copy = {
    suspend: {
      title: `Suspend ${user.full_name}'s account?`,
      description: "They lose access immediately. Their records are kept, and access can be restored later.",
      confirmLabel: "Suspend account",
      destructive: true,
    },
    reactivate: {
      title: `Reactivate ${user.full_name}'s account?`,
      description: "They will be able to sign in again straight away.",
      confirmLabel: "Reactivate account",
      destructive: false,
    },
    reject: {
      title: `Reject ${user.full_name}'s registration?`,
      description:
        "This registration will not be approved. It can be reactivated later if this was a mistake.",
      confirmLabel: "Reject registration",
      destructive: true,
    },
  }[kind];

  return (
    <ConfirmDialog
      {...common}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive={copy.destructive}
      details={who}
    />
  );
}
