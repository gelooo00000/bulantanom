"use client";

import {
  Ban,
  CalendarDays,
  CircleCheck,
  ArrowDownUp,
  Clock,
  ExternalLink,
  Mars,
  Venus,
  LoaderCircle,
  PieChart,
  Radio,
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

import { AdminHero, HeroStat } from "@/components/admin/admin-hero";
import { INK, PALETTE, gradient, tint, type Swatch } from "@/components/admin/palette";
import { CreateOfficerDialog } from "@/components/admin/create-officer-dialog";
import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { lastActiveLabel } from "@/components/lgu/farmer-directory";
import { DonutChart } from "@/components/lgu/risk-pie";
import { EmptyState } from "@/components/shared/empty-state";
import { ActionsMenu, type ActionItem } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  approveFarmer,
  deleteAccount,
  listUsers,
  reactivateOfficer,
  setAccountGender,
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
  FARMER: INK.forest,
  LGU_OFFICER: INK.gold,
  ADMIN: INK.violet,
} as const;

const ROLE_ICON = {
  FARMER: Sprout,
  LGU_OFFICER: ShieldCheck,
  ADMIN: Users,
} as const;


/**
 * Card and avatar colours by gender: blue for male, pink for female, and
 * the BulanTanom green for anyone who has not said or prefers not to.
 */
const GENDER_STYLE = {
  MALE: { from: PALETTE.sky[0], to: PALETTE.sky[1], ink: INK.sky, label: "Male" },
  FEMALE: { from: PALETTE.pink[0], to: PALETTE.pink[1], ink: INK.pink, label: "Female" },
  NONE: { from: PALETTE.forest[0], to: PALETTE.forest[1], ink: INK.forest, label: null },
} as const;

function genderStyle(user: AdminUser) {
  return user.gender === "MALE" || user.gender === "FEMALE" ? GENDER_STYLE[user.gender] : GENDER_STYLE.NONE;
}

function avatarGradient(user: AdminUser) {
  const { from, to } = genderStyle(user);
  return `linear-gradient(135deg, ${from}, ${to})`;
}

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

  async function changeGender(user: AdminUser, gender: "MALE" | "FEMALE") {
    if (!accessToken) return;
    try {
      await setAccountGender(accessToken, user.id, gender);
      await load();
      setToast(`${user.full_name || user.email} is now shown as ${gender === "MALE" ? "male" : "female"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the gender.");
    }
  }

  /** Only the moves that are legal for this account's role and current status. */
  function actionsFor(user: AdminUser): ActionItem[] {
    const items: ActionItem[] = [];
    const isSelf = String(user.id) === currentUser?.id;

    if (user.role === "ADMIN") return items;

    // Gender only colours the card, so it is set straight away, no dialog.
    if (user.gender !== "MALE") {
      items.push({ label: "Set as male", icon: Mars, onSelect: () => void changeGender(user, "MALE") });
    }
    if (user.gender !== "FEMALE") {
      items.push({ label: "Set as female", icon: Venus, onSelect: () => void changeGender(user, "FEMALE") });
    }

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
  const suspended = users.filter((u) => u.account_status === "SUSPENDED").length;

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
    icon: typeof Users;
    swatch: Swatch;
    ink: string;
    empty: { icon: typeof Users; title: string; description?: string };
  }[] = [
    {
      key: "farmers",
      label: "Farmers",
      icon: Sprout,
      swatch: PALETTE.forest,
      ink: INK.forest,
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
      icon: ShieldCheck,
      swatch: PALETTE.gold,
      ink: INK.gold,
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
      icon: Users,
      swatch: PALETTE.violet,
      ink: INK.violet,
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

      <AdminHero
        icon={Users}
        eyebrow="Admin console"
        title="Account Management"
        description="Manage access and see who is using BulanTanom."
        action={
          <Button
            onClick={() => setCreatingOfficer(true)}
            className="h-10 border-amber-200/60 px-4 text-amber-950 shadow-[0_10px_26px_-10px_#f59e0b] hover:brightness-105"
            style={{ backgroundImage: gradient(PALETTE.gold) }}
          >
            <UserRoundPlus className="size-4" />
            Create LGU Officer
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroStat
            icon={Users}
            label="All accounts"
            value={users.length}
            swatch={PALETTE.violet}
            onClick={() => setTab("all")}
            active={tab === "all"}
          />
          <HeroStat
            icon={Sprout}
            label="Farmers"
            value={farmers.length}
            swatch={PALETTE.forest}
            onClick={() => setTab("farmers")}
            active={tab === "farmers"}
          />
          <HeroStat
            icon={ShieldCheck}
            label="LGU Officers"
            value={officers.length}
            swatch={PALETTE.gold}
            onClick={() => setTab("officers")}
            active={tab === "officers"}
          />
          <HeroStat
            icon={Ban}
            label="Suspended"
            value={suspended}
            swatch={PALETTE.rose}
            hint={suspended === 0 ? "Everyone has access" : "Lost access"}
          />
        </div>
      </AdminHero>

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

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="gap-4">
        {/* Tabs, search and sort in one frosted bar that stays in view. */}
        <div className="border-border bg-card/85 dark:border-white/10 sticky top-[3.25rem] z-[5] flex flex-col gap-2.5 rounded-3xl border p-2.5 shadow-[0_10px_30px_-18px_rgb(6_95_70/0.45)] backdrop-blur-md xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="h-auto max-w-full gap-1.5 overflow-x-auto rounded-2xl bg-transparent p-0 [scrollbar-width:none]">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              const active = tab === t.key;
              return (
                <TabsTab
                  key={t.key}
                  value={t.key}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3.5 py-2 transition-all",
                    active
                      ? "border-transparent text-white shadow-[0_10px_22px_-10px_var(--tab)] data-[active]:text-white"
                      : "border-border bg-background hover:text-foreground hover:border-[var(--tab)] dark:border-white/10 dark:bg-white/5",
                  )}
                  style={
                    {
                      "--tab": t.ink,
                      ...(active ? { backgroundImage: gradient(t.swatch) } : {}),
                    } as React.CSSProperties
                  }
                >
                  <TabIcon className="size-4" style={active ? undefined : { color: t.ink }} />
                  {t.label}
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
                      active && "bg-white/25 text-white",
                    )}
                    style={active ? undefined : { backgroundColor: tint(t.ink, 14), color: t.ink }}
                  >
                    {t.total}
                  </span>
                </TabsTab>
              );
            })}
          </TabsList>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1 xl:w-72 xl:flex-none">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
                style={{ color: INK.forest }}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                placeholder="Search name or email"
                aria-label="Search accounts"
                className="border-border bg-background h-10 w-full rounded-2xl border pr-9 pl-10 text-sm transition-shadow focus-visible:border-emerald-500/60 focus-visible:shadow-[0_0_0_4px_rgb(16_185_129/0.15)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <ArrowDownUp
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                style={{ color: INK.gold }}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort accounts"
                className="border-border bg-background h-10 cursor-pointer rounded-2xl border pr-3 pl-9 text-sm focus-visible:shadow-[0_0_0_4px_rgb(245_158_11/0.18)] focus-visible:outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="active">Recently active</option>
              </select>
            </div>
          </div>
        </div>

        {TABS.map((t) => (
          <TabsPanel key={t.key} value={t.key} className="flex flex-col gap-3">
            {t.rows.length === 0 ? (
              <EmptyState icon={t.empty.icon} title={t.empty.title} description={t.empty.description} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
  icon: Icon,
  color,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  /** Two colours for the icon tile and the panel's wash. */
  color: Swatch;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border-border bg-card relative isolate flex flex-col gap-4 overflow-hidden rounded-3xl border p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-white/10 dark:shadow-[0_16px_40px_-24px_var(--panel)]"
      style={{
        "--panel": color[1],
        backgroundImage: `radial-gradient(120% 70% at 100% 0%, color-mix(in oklab, ${color[0]} 16%, transparent), transparent 60%)`,
      } as React.CSSProperties}
    >
      <header className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_var(--panel)]"
          style={
            {
              "--panel": color[1],
              backgroundImage: gradient(color),
            } as React.CSSProperties
          }
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-base font-medium">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
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
    <Panel icon={PieChart} color={PALETTE.gold} title="Accounts by role" description="Select a role to see its accounts.">
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
    <Panel icon={Radio} color={PALETTE.forest} title="Online now" description="Signed in and active in the last few minutes.">
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
                    backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, white), ${color})`,
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
  size?: "sm" | "md" | "lg";
  title?: string;
  showOnline?: boolean;
}) {
  const initials =
    `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      title={title}
      className={cn(
        "ring-card relative flex shrink-0 items-center justify-center rounded-full font-heading font-semibold text-white ring-2 shadow-[0_6px_14px_-6px_rgb(0_0_0/0.35)]",
        size === "sm" ? "size-8 text-[11px]" : size === "lg" ? "size-16 text-lg ring-4" : "size-12 text-sm",
      )}
      style={{ backgroundImage: avatarGradient(user) }}
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
  const gender = genderStyle(user);
  const swatch = [gender.from, gender.to] as const;
  const joined = new Date(user.date_joined).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const lastActive = lastActiveLabel(user.last_seen_at).replace(/^Last active /, "");

  return (
    <li
      className={cn(
        "border-border bg-card group relative isolate flex flex-col overflow-hidden rounded-3xl border shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-300",
        "hover:-translate-y-1 hover:border-[var(--accent-to)] hover:shadow-[0_22px_40px_-22px_var(--accent-to)]",
        // On the dark theme the card lifts off the page with a faint wash of
        // the person's colour and a lighter edge.
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent-ink)_9%,var(--card))_0%,var(--card)_70%)] dark:shadow-[0_12px_32px_-20px_var(--accent-to)]",
        badge && "saturate-[0.65]",
      )}
      style={{ "--accent-to": gender.to, "--accent-ink": gender.ink } as React.CSSProperties}
    >
      {/* A coloured banner with a soft pattern; the avatar sits across its edge. */}
      <div className="relative h-20 overflow-hidden" style={{ backgroundImage: gradient(swatch) }}>
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.7)_1px,transparent_1px)] [background-size:14px_14px]"
        />
        <span
          aria-hidden="true"
          className="absolute -top-10 -right-8 size-32 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-125"
        />
        <RoleIcon aria-hidden="true" className="absolute right-14 -bottom-3 size-16 text-white/15" />
        {actions.length > 0 && (
          <div className="absolute top-2.5 right-2.5 [&_button]:border-white/30 [&_button]:bg-white/20 [&_button]:text-white [&_button]:backdrop-blur-sm [&_button:hover]:bg-white/35 [&_button:hover]:text-white">
            <ActionsMenu items={actions} label={`Actions for ${user.full_name}`} />
          </div>
        )}
        {badge && (
          <span className="absolute top-3 left-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="-mt-8 flex items-end gap-3">
          <Avatar user={user} showOnline size="lg" />
          {user.is_online && (
            <span className="mb-1 flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Online now
            </span>
          )}
        </div>

        <div className="mt-2.5 min-w-0">
          <p className="font-heading truncate text-[17px] leading-tight font-semibold">
            {user.full_name || user.email}
          </p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: tint(color, 14), color }}
          >
            <RoleIcon className="size-3" />
            {ROLE_LABEL[user.role]}
          </span>
          {gender.label && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: tint(gender.ink, 14), color: gender.ink }}
            >
              {user.gender === "MALE" ? <Mars className="size-3" /> : <Venus className="size-3" />}
              {gender.label}
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: tint(gender.ink, 9) }}>
            <dt className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <CalendarDays className="size-3" style={{ color: gender.ink }} />
              Joined
            </dt>
            <dd className="font-heading mt-0.5 font-semibold">{joined}</dd>
          </div>
          <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: tint(INK.gold, 9) }}>
            <dt className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Clock className="size-3" style={{ color: INK.gold }} />
              Last active
            </dt>
            <dd className="font-heading mt-0.5 font-semibold first-letter:uppercase">
              {user.is_online ? "Right now" : lastActive}
            </dd>
          </div>
        </dl>
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
