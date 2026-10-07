"use client";

import {
  Ban,
  CalendarDays,
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
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CreateOfficerDialog } from "@/components/admin/create-officer-dialog";
import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { lastActiveLabel } from "@/components/lgu/farmer-directory";
import { DonutChart } from "@/components/lgu/risk-pie";
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
  suspendFarmer,
  suspendOfficer,
  type AdminUser,
} from "@/lib/api/admin-api";
import type { BackendAccountStatus } from "@/lib/api/auth-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * Farmers are approved the moment they register, so an approved account is
 * the norm and carries no badge. Only an account that has lost access is
 * marked. PENDING survives only on accounts made before auto-approval.
 */
const STATUS_BADGE: Partial<Record<BackendAccountStatus, { label: string; className: string }>> = {
  PENDING: { label: "Inactive", className: "bg-muted text-muted-foreground border-border" },
  REJECTED: { label: "Inactive", className: "bg-muted text-muted-foreground border-border" },
  SUSPENDED: { label: "Suspended", className: "bg-risk-high/10 text-risk-high border-risk-high/30" },
};

const ROLE_LABEL = {
  FARMER: "Farmer",
  LGU_OFFICER: "LGU Officer",
  ADMIN: "Admin",
} as const;

/** One colour per role, shared by the charts and the account cards. */
const ROLE_COLOR = {
  FARMER: "var(--primary)",
  LGU_OFFICER: "var(--chart-series-1)",
  ADMIN: "var(--muted-foreground)",
} as const;

const ROLE_ICON = {
  FARMER: Sprout,
  LGU_OFFICER: ShieldCheck,
  ADMIN: Users,
} as const;

/** A role colour at low strength, for avatar and chip backgrounds. */
const tint = (color: string, percent = 12) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/**
 * Django Admin sits on the API host, not the Next.js host. Derived from the
 * configured API base so it follows the backend in every environment.
 */
const DJANGO_ADMIN_LGU_URL = `${(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/api\/?$/, "")}/admin/accounts/lguofficer/`;

type TabKey = "farmers" | "officers" | "all";
type SortKey = "newest" | "name" | "active";

/** Plants, assessments and soil checks — everything a deletion would take. */
export function recordCount(user: AdminUser): number {
  return user.plant_count + user.assessment_count + user.soil_record_count;
}

/**
 * An action the Admin has chosen but not yet confirmed. Holding the target
 * account (rather than an id) lets the dialog name exactly who is affected,
 * which is the point of the confirmation step. Nothing is sent to the server
 * until the Admin confirms.
 */
export type PendingAction = { kind: "suspend" | "reactivate" | "delete"; user: AdminUser };

export function AccountManagement() {
  const { accessToken, currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  // Client-side narrowing of an already-authorized list. The server decides
  // *which* accounts this Admin may see; these only decide what is shown.
  const [search, setSearch] = useState("");
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
      const { user, kind } = pendingAction;
      const isOfficer = user.role === "LGU_OFFICER";
      if (kind === "delete") {
        await deleteAccount(accessToken, user.id, { includeRecords: recordCount(user) > 0 });
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
          suspend: `${user.full_name}'s account was suspended.`,
          reactivate: `${user.full_name}'s account was reactivated.`,
        }[kind],
      );
    } catch (err) {
      // Stay open with the reason — the card must not disappear on failure.
      setDialogError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setDialogBusy(false);
    }
  }

  /** Only the moves that are legal for this account's role and current status. */
  function actionsFor(user: AdminUser): ActionItem[] {
    const items: ActionItem[] = [];
    const isSelf = String(user.id) === currentUser?.id;

    if (user.role === "ADMIN") return items;

    if (user.account_status === "APPROVED") {
      items.push({
        label: "Suspend account",
        icon: Ban,
        onSelect: () => setPendingAction({ kind: "suspend", user }),
      });
    } else {
      items.push({
        label: "Reactivate account",
        icon: RotateCcw,
        onSelect: () => setPendingAction({ kind: "reactivate", user }),
      });
    }
    items.push({
      label: "Delete account",
      icon: Trash2,
      destructive: true,
      disabled: isSelf,
      onSelect: () => setPendingAction({ kind: "delete", user }),
    });
    return items;
  }

  const farmers = users.filter((u) => u.role === "FARMER");
  const officers = users.filter((u) => u.role === "LGU_OFFICER");

  const query = search.trim().toLowerCase();
  /** One set of controls narrows and orders every tab. */
  function narrow(list: AdminUser[]) {
    return list
      .filter(
        (u) =>
          query === "" ||
          u.full_name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
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
      key: "farmers",
      label: "Farmers",
      total: farmers.length,
      rows: narrow(farmers),
      empty: {
        icon: Sprout,
        title: farmers.length === 0 ? "No farmers yet" : "No farmers match this search",
        description:
          farmers.length === 0
            ? "Farmer accounts appear here once people register."
            : "Try a different name or clear the search.",
      },
    },
    {
      key: "officers",
      label: "LGU Officers",
      total: officers.length,
      rows: narrow(officers),
      empty: {
        icon: ShieldCheck,
        title: officers.length === 0 ? "No LGU Officers yet" : "No officers match this search",
        description:
          officers.length === 0
            ? "Officers cannot register themselves. Create one to give an agricultural officer access."
            : "Try a different name or clear the search.",
      },
    },
    {
      key: "all",
      label: "All accounts",
      total: users.length,
      rows: narrow(users),
      empty: { icon: Users, title: users.length === 0 ? "No accounts yet" : "No accounts match this search" },
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
        description="Manage access and see who is using BulanTanom."
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

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <RoleBreakdown
          farmers={farmers.length}
          officers={officers.length}
          onSelect={(key) => setTab(key as TabKey)}
        />
        <OnlineNow farmers={farmers} officers={officers} />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <TabsList className="max-w-full overflow-x-auto">
            {TABS.map((t) => (
              <TabsTab key={t.key} value={t.key}>
                {t.label}
                <span className="text-muted-foreground ml-1.5 text-xs">{t.total}</span>
              </TabsTab>
            ))}
          </TabsList>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
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
        </div>

        {TABS.map((t) => (
          <TabsPanel key={t.key} value={t.key} className="flex flex-col gap-3">
            {t.rows.length === 0 ? (
              <EmptyState icon={t.empty.icon} title={t.empty.title} description={t.empty.description} />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {t.rows.map((user) => (
                  <AccountCard key={user.id} user={user} actions={actionsFor(user)} />
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

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <header>
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** Farmers against LGU Officers: the donut for the share, labelled bars for the counts. */
function RoleBreakdown({
  farmers,
  officers,
  onSelect,
}: {
  farmers: number;
  officers: number;
  onSelect: (key: string) => void;
}) {
  const rows: BarRow[] = [
    { key: "farmers", label: "Farmers", value: farmers, color: ROLE_COLOR.FARMER, icon: Sprout },
    { key: "officers", label: "LGU Officers", value: officers, color: ROLE_COLOR.LGU_OFFICER, icon: ShieldCheck },
  ];
  return (
    <Panel title="Accounts by role" description="Select a role to see its accounts.">
      <div className="grid items-center gap-5 sm:grid-cols-[200px_1fr]">
        <DonutChart rows={rows} unit="account" name="Accounts by role" onSelectKey={onSelect} />
        <HorizontalBars rows={rows} unit="account" label="Accounts by role" onSelect={onSelect} />
      </div>
    </Panel>
  );
}

/** Who is signed in right now, overall and per role, with their faces. */
function OnlineNow({ farmers, officers }: { farmers: AdminUser[]; officers: AdminUser[] }) {
  const online = [...farmers, ...officers].filter((u) => u.is_online);
  const total = farmers.length + officers.length;
  const roles = [
    { label: "Farmers", list: farmers, color: ROLE_COLOR.FARMER },
    { label: "LGU Officers", list: officers, color: ROLE_COLOR.LGU_OFFICER },
  ];

  return (
    <Panel title="Online now" description="Signed in and active in the last few minutes.">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          {online.length > 0 && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={cn(
              "relative inline-flex size-3 rounded-full",
              online.length > 0 ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
        </span>
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-4xl leading-none font-medium tabular-nums">{online.length}</span>
          <span className="text-muted-foreground text-sm">of {total} online</span>
        </p>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Online by role">
        {roles.map(({ label, list, color }) => {
          const count = list.filter((u) => u.is_online).length;
          return (
            <li key={label}>
              <div className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="font-heading tabular-nums">
                  {count}
                  <span className="text-muted-foreground ml-1 text-xs font-normal">/ {list.length}</span>
                </span>
              </div>
              <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${list.length > 0 ? (count / list.length) * 100 : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {online.length > 0 ? (
        <div className="mt-auto flex items-center gap-2">
          <div className="flex -space-x-2">
            {online.slice(0, 6).map((u) => (
              <Avatar key={u.id} user={u} size="sm" title={u.full_name} />
            ))}
          </div>
          {online.length > 6 && (
            <span className="text-muted-foreground text-xs">+{online.length - 6} more</span>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mt-auto text-xs">Nobody is signed in right now.</p>
      )}
    </Panel>
  );
}

function Avatar({
  user,
  size = "md",
  title,
  showOnline,
}: {
  user: AdminUser;
  size?: "sm" | "md";
  title?: string;
  showOnline?: boolean;
}) {
  const color = ROLE_COLOR[user.role];
  const initials =
    `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      title={title}
      className={cn(
        "ring-card relative flex shrink-0 items-center justify-center rounded-full font-heading font-medium ring-2",
        size === "sm" ? "size-8 text-[11px]" : "size-12 text-sm",
      )}
      style={{ backgroundColor: tint(color, 16), color }}
    >
      {initials}
      {showOnline && user.is_online && (
        <span className="border-card absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 bg-emerald-500" />
      )}
    </span>
  );
}

/**
 * One account: who, their role, whether they are on BulanTanom now, and —
 * only when they have lost access — their status.
 */
function AccountCard({ user, actions }: { user: AdminUser; actions: ActionItem[] }) {
  const color = ROLE_COLOR[user.role];
  const RoleIcon = ROLE_ICON[user.role];
  const badge = STATUS_BADGE[user.account_status];
  const joined = new Date(user.date_joined).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li
      className={cn(
        "border-border bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        badge && "opacity-80",
      )}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />

      <div className="flex items-start gap-3">
        <Avatar user={user} showOnline />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-heading truncate text-base leading-tight font-medium">
            {user.full_name || user.email}
          </p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
        {actions.length > 0 && (
          <ActionsMenu items={actions} label={`Actions for ${user.full_name}`} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: tint(color), color }}
        >
          <RoleIcon className="size-3" />
          {ROLE_LABEL[user.role]}
        </span>
        {badge && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", badge.className)}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="border-border text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed pt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          Joined {joined}
        </span>
        {user.is_online ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Online now
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {lastActiveLabel(user.last_seen_at).replace(/^Last active /, "Active ")}
          </span>
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

  const { user, kind } = action;
  const who = (
    <>
      <p className="text-muted-foreground text-xs">{ROLE_LABEL[user.role]}</p>
      <p className="font-heading text-sm font-medium">{user.full_name}</p>
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
