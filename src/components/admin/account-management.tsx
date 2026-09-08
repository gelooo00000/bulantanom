"use client";

import {
  Ban,
  CircleCheck,
  RotateCcw,
  Trash2,
  Clock,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  UserRoundPlus,
  Sprout,
  UserRoundX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { IconStatCard } from "@/components/shared/icon-stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { CreateOfficerDialog } from "@/components/admin/create-officer-dialog";
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
} from "@/lib/api/admin-api";
import type { BackendAccountStatus, BackendUser } from "@/lib/api/auth-api";
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

function StatusBadge({ status }: { status: BackendAccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * An action the Admin has chosen but not yet confirmed. Holding the target
 * account here (rather than an id) lets the dialog name exactly who is
 * affected, which is the point of the confirmation step.
 */
type PendingAction = {
  user: BackendUser;
  kind: "suspend" | "reactivate" | "reject" | "delete";
};

const ACTION_COPY: Record<
  PendingAction["kind"],
  { title: string; description: string; confirmLabel: string; destructive: boolean; success: string }
> = {
  suspend: {
    title: "Suspend account?",
    description:
      "This account will lose access immediately. Its records are kept and access can be restored later.",
    confirmLabel: "Suspend Account",
    destructive: true,
    success: "Account suspended.",
  },
  reactivate: {
    title: "Reactivate account?",
    description: "This account will be able to sign in again straight away.",
    confirmLabel: "Reactivate Account",
    destructive: false,
    success: "Account reactivated.",
  },
  reject: {
    title: "Reject registration?",
    description:
      "This registration will not be approved. The account can be reactivated later if this was a mistake.",
    confirmLabel: "Reject Registration",
    destructive: true,
    success: "Registration rejected.",
  },
  delete: {
    title: "Delete account?",
    description:
      "This permanently removes the account. Accounts that own plants, assessments or soil records cannot be deleted — suspend those instead.",
    confirmLabel: "Delete Account",
    destructive: true,
    success: "Account deleted.",
  },
};

export function AccountManagement() {
  const { accessToken, currentUser } = useAuth();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Client-side narrowing of an already-authorized list. The server decides
  // *which* accounts this Admin may see; these only decide what is shown.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BackendAccountStatus | "ALL">("ALL");
  const [tab, setTab] = useState<TabKey>("farmers");
  // A queued action waiting on its confirmation dialog. Nothing is sent to
  // the server until the Admin confirms.
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

  async function act(
    userId: number,
    action: (token: string, id: number) => Promise<BackendUser>,
  ) {
    if (!accessToken) return;
    setBusyId(userId);
    setError(null);
    try {
      await action(accessToken, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Runs the confirmed action against Django, then refetches. Nothing is
   * mutated locally — the server response (or a reload) is the only source
   * of the new state, so a failed request never leaves the table lying.
   */
  async function runPendingAction() {
    if (!accessToken || !pendingAction) return;
    const { user, kind } = pendingAction;
    const isOfficer = user.role === "LGU_OFFICER";

    setBusyId(user.id);
    setDialogError(null);
    try {
      if (kind === "delete") {
        await deleteAccount(accessToken, user.id);
      } else if (kind === "reject") {
        await rejectFarmer(accessToken, user.id);
      } else if (kind === "suspend") {
        await (isOfficer ? suspendOfficer : suspendFarmer)(accessToken, user.id);
      } else {
        await (isOfficer ? reactivateOfficer : approveFarmer)(accessToken, user.id);
      }
      await load();
      setPendingAction(null);
      setToast(ACTION_COPY[kind].success);
    } catch (err) {
      // Stay open with the reason — the row must not disappear on failure.
      setDialogError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  /** Only the moves that are legal for this row's role and current status. */
  function actionsFor(user: BackendUser): ActionItem[] {
    const items: ActionItem[] = [];
    const isSelf = String(user.id) === currentUser?.id;
    const isAdmin = user.role === "ADMIN";
    const busy = busyId === user.id;

    if (isAdmin) return items;

    if (user.account_status === "PENDING") {
      items.push({
        label: "Approve",
        icon: CircleCheck,
        disabled: busy,
        onSelect: () => act(user.id, approveFarmer),
      });
      items.push({
        label: "Reject",
        icon: UserRoundX,
        disabled: busy,
        onSelect: () => setPendingAction({ user, kind: "reject" }),
      });
    }

    if (user.account_status === "APPROVED") {
      items.push({
        label: "Suspend account",
        icon: Ban,
        disabled: busy,
        onSelect: () => setPendingAction({ user, kind: "suspend" }),
      });
    }

    if (user.account_status === "SUSPENDED" || user.account_status === "REJECTED") {
      items.push({
        label: "Reactivate account",
        icon: RotateCcw,
        disabled: busy,
        onSelect: () => setPendingAction({ user, kind: "reactivate" }),
      });
    }

    items.push({
      label: "Delete account",
      icon: Trash2,
      destructive: true,
      disabled: busy || isSelf,
      onSelect: () => setPendingAction({ user, kind: "delete" }),
    });

    return items;
  }


  const pending = users.filter((u) => u.role === "FARMER" && u.account_status === "PENDING");
  const allFarmers = users.filter((u) => u.role === "FARMER");
  const officers = users.filter((u) => u.role === "LGU_OFFICER");

  const query = search.trim().toLowerCase();
  /**
   * One set of controls narrows every tab. Previously only the Farmers list
   * could be searched, so finding an Officer or an Admin meant scrolling.
   */
  function narrow(list: BackendUser[]) {
    return list.filter((u) => {
      const matchesStatus = statusFilter === "ALL" || u.account_status === statusFilter;
      const matchesQuery =
        query === "" ||
        u.full_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  const copy = pendingAction ? ACTION_COPY[pendingAction.kind] : null;

  /**
   * Each account belongs to exactly one visible list at a time. The page used
   * to stack Pending, Farmers, Officers and All accounts, so a single pending
   * Farmer appeared three times over and the page grew with every account.
   */
  const TABS: {
    key: TabKey;
    label: string;
    total: number;
    rows: BackendUser[];
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
      total: allFarmers.length,
      rows: narrow(allFarmers),
      empty: {
        icon: Sprout,
        title: allFarmers.length === 0 ? "No farmers yet" : "No farmers match this filter",
        description:
          allFarmers.length === 0
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
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Dismiss
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

      {pendingAction && copy ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setPendingAction(null);
              setDialogError(null);
            }
          }}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirmLabel}
          destructive={copy.destructive}
          busy={busyId === pendingAction.user.id}
          error={dialogError}
          // Permanent removal asks for the word in full; reversible actions
          // do not, so the friction lands only where it belongs.
          confirmPhrase={pendingAction.kind === "delete" ? "DELETE" : undefined}
          onConfirm={runPendingAction}
          details={
            <>
              <p className="text-muted-foreground text-xs">
                {ROLE_LABEL[pendingAction.user.role]}
              </p>
              <p className="text-sm font-medium">{pendingAction.user.full_name}</p>
              <p className="text-muted-foreground text-sm">
                {pendingAction.user.email}
              </p>
            </>
          }
        />
      ) : null}

      <PageHeader
        title="Account Management"
        description="Approve Farmer registrations and review BulanTanom accounts."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IconStatCard
          icon={Clock}
          label="Pending approvals"
          value={pending.length}
          tone={pending.length > 0 ? "risk-medium" : "primary"}
        />
        <IconStatCard icon={Sprout} label="Farmers" value={allFarmers.length} />
        <IconStatCard icon={ShieldCheck} label="LGU Officers" value={officers.length} />
        <IconStatCard icon={Users} label="Total accounts" value={users.length} />
      </div>

      {/* Approvals are the one thing on this page genuinely waiting on the
          Admin, so they stay reachable from whichever tab is open. */}
      {pending.length > 0 && tab !== "pending" && (
        <button
          type="button"
          onClick={() => setTab("pending")}
          className="border-risk-medium/30 bg-risk-medium/10 hover:bg-risk-medium/15 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors"
        >
          <Clock className="text-risk-medium size-4 shrink-0" />
          <span className="flex-1">
            {pending.length} Farmer{pending.length === 1 ? "" : "s"} awaiting approval
          </span>
          <span className="text-risk-medium font-medium">Review</span>
        </button>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <TabsTab key={t.key} value={t.key}>
              {t.label}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  t.key === "pending" && t.total > 0
                    ? "text-risk-medium font-medium"
                    : "text-muted-foreground",
                )}
              >
                {t.total}
              </span>
            </TabsTab>
          ))}
        </TabsList>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search accounts"
            className="border-border bg-card focus-visible:ring-ring/50 min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none sm:max-w-64"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === value
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "ALL" ? "All" : STATUS_LABEL[value]}
                </button>
              ),
            )}
          </div>
        </div>

        {TABS.map((t) => (
          <TabsPanel key={t.key} value={t.key} className="flex flex-col gap-3">
            {t.rows.length === 0 ? (
              <EmptyState
                icon={t.empty.icon}
                title={t.empty.title}
                description={t.empty.description}
              />
            ) : (
              <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
                {t.rows.map((user) => (
                  <AccountRow
                    key={user.id}
                    user={user}
                    busy={busyId === user.id}
                    actions={actionsFor(user)}
                    showRole={t.key === "all"}
                    dateLabel={
                      t.key === "pending"
                        ? "Registered"
                        : t.key === "officers"
                          ? "Joined"
                          : undefined
                    }
                    onApprove={
                      t.key === "pending" ? () => act(user.id, approveFarmer) : undefined
                    }
                    onReject={
                      t.key === "pending" ? () => act(user.id, rejectFarmer) : undefined
                    }
                  />
                ))}
              </div>
            )}

            {/* The provisioning reference belongs with the Officers it
                describes, not stacked above the whole page. */}
            {t.key === "officers" && (
              <div className="border-border text-muted-foreground flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-xs">
                <p className="max-w-lg">
                  Officers have no public registration. They can also be provisioned,
                  deactivated, and have passwords reset in the Django Administration
                  panel.
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

type TabKey = "pending" | "farmers" | "officers" | "all";

/**
 * One row shape for every tab. The four lists used to be four near-identical
 * blocks of JSX, which is how they drifted apart in the first place.
 */
function AccountRow({
  user,
  busy,
  actions,
  showRole,
  dateLabel,
  onApprove,
  onReject,
}: {
  user: BackendUser;
  busy: boolean;
  actions: ActionItem[];
  showRole?: boolean;
  dateLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <div className="hover:bg-muted/30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.full_name}</p>
        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        {dateLabel && (
          <p className="text-muted-foreground/70 mt-0.5 text-xs">
            {dateLabel} {new Date(user.date_joined).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showRole && (
          <span className="text-muted-foreground text-xs">{ROLE_LABEL[user.role]}</span>
        )}
        <StatusBadge status={user.account_status} />
        {onApprove && onReject ? (
          <>
            <Button size="sm" disabled={busy} onClick={onApprove}>
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <CircleCheck className="size-3.5" />
              )}
              Approve
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onReject}>
              <UserRoundX className="size-3.5" />
              Reject
            </Button>
          </>
        ) : (
          <ActionsMenu
            items={actions}
            disabled={busy}
            label={`Actions for ${user.full_name}`}
          />
        )}
      </div>
    </div>
  );
}
