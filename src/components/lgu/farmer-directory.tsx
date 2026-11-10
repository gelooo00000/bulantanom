"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarDays, CalendarRange, Search, Timer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ElementType } from "react";

import {
  INK,
  PALETTE,
  gradient,
  tint,
  type Swatch,
} from "@/components/admin/palette";
import { formatDisplayDate } from "@/components/ui/date-picker";

import type { BackendAccountStatus } from "@/lib/api/auth-api";
import type { LguFarmer } from "@/lib/api/lgu-api";
import { CROP_OUTLINE } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

/**
 * The LGU Officer's Farmer list: find a Farmer fast, and see who is using
 * BulanTanom right now. Newest registrations are listed first.
 *
 * Everything filters in the browser over one fetch of every Farmer, so
 * typing and switching status are instant and the status counts are always
 * right.
 */

type StatusFilter = "APPROVED" | "SUSPENDED" | "ALL";

const STATUS_LABEL: Record<BackendAccountStatus, string> = {
  // Farmers are approved on sign-up; PENDING only remains on older accounts.
  PENDING: "Inactive",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const STATUS_STYLE: Record<BackendAccountStatus, string> = {
  PENDING: "bg-muted text-muted-foreground border-border",
  APPROVED: "bg-risk-low/15 text-risk-low border-risk-low/30",
  REJECTED: "bg-risk-high/15 text-risk-high border-risk-high/30",
  SUSPENDED: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(farmer: LguFarmer, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(`${farmer.full_name} ${farmer.email}`).includes(q);
}

export function FarmerDirectory({ farmers }: { farmers: LguFarmer[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("APPROVED");
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search from anywhere on the page, as on most directories.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(
    () => ({
      APPROVED: farmers.filter((f) => f.account_status === "APPROVED").length,
      SUSPENDED: farmers.filter((f) => f.account_status === "SUSPENDED").length,
      ALL: farmers.length,
    }),
    [farmers],
  );

  const shown = useMemo(() => {
    const list = farmers.filter(
      (f) =>
        (status === "ALL" || f.account_status === status) &&
        matchesSearch(f, query),
    );
    // Newest registered first, so a Farmer who just signed up is on top.
    return list.sort((a, b) => b.date_joined.localeCompare(a.date_joined));
  }, [farmers, status, query]);

  const filtered = query.trim() !== "";

  function clearAll() {
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search by name or email"
            aria-label="Search farmers by name or email"
            className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border pr-16 pl-9 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="text-muted-foreground border-border pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 text-[11px] sm:block">
              /
            </kbd>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-2"
          role="group"
          aria-label="Filter by account status"
        >
          {(
            [
              ["APPROVED", "Approved"],
              ["SUSPENDED", "Suspended"],
              ["ALL", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                status === value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="text-muted-foreground ml-1.5 tabular-nums">
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-sm" role="status">
          {shown.length === 1 ? "1 farmer" : `${shown.length} farmers`} · newest
          first
          {filtered && (
            <>
              {" · "}
              <button
                type="button"
                onClick={clearAll}
                className="underline underline-offset-2"
              >
                Clear search
              </button>
            </>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {query.trim()
            ? `No farmers match "${query.trim()}".`
            : "No farmers in this view."}
          {filtered && (
            <button
              type="button"
              onClick={clearAll}
              className="text-foreground ml-1 underline underline-offset-2"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((farmer) => (
            <FarmerRow key={farmer.id} farmer={farmer} query={query} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FarmerRow({ farmer, query }: { farmer: LguFarmer; query: string }) {
  const initials =
    `${farmer.first_name.charAt(0)}${farmer.last_name.charAt(0)}`.toUpperCase() ||
    farmer.email.charAt(0).toUpperCase();

  return (
    // A card of its own that lights up on hover or tap, like the farmer's
    // plant cards; a farmer has no crop, so the light is the app's green.
    <li
      tabIndex={0}
      className={cn(
        "border-border bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-[border-color,box-shadow]",
        "[--crop:var(--primary)]",
        CROP_OUTLINE,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
      >
        {initials}
        {/* The light-green dot on the avatar: this Farmer is using
            BulanTanom right now. */}
        {farmer.is_online && (
          <span className="border-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-400" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-heading truncate font-medium">
            <Highlight text={farmer.full_name || farmer.email} query={query} />
          </span>
          {/* Approved is the normal state, so only the exceptions get a badge. */}
          {farmer.account_status !== "APPROVED" && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                STATUS_STYLE[farmer.account_status],
              )}
            >
              {STATUS_LABEL[farmer.account_status]}
            </span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-sm">
          <Highlight text={farmer.email} query={query} />
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:w-auto sm:justify-end">
        {/* "⏱️ Last active …" also opens the farmer's time on BulanTanom. */}
        <UsagePopover farmer={farmer}>
          <span aria-hidden="true" className="text-sm leading-none">
            ⏱️
          </span>
          {farmer.is_online ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Online now
            </span>
          ) : (
            <span className="text-muted-foreground">
              {lastActiveLabel(farmer.last_seen_at)}
            </span>
          )}
        </UsagePopover>
      </div>
    </li>
  );
}

/** "1 hr 5 min", "45 min", "0 min". */
export function formatUsage(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * "⏱️ Last active …" on a farmer's row, which opens how long they use BulanTanom:
 * today, the last 7 days and the last 30, when pointed at, tapped or focused.
 */
function UsagePopover({
  farmer,
  children,
}: {
  farmer: LguFarmer;
  children: React.ReactNode;
}) {
  const usage = farmer.usage;
  const rows: {
    label: string;
    minutes: number;
    icon: ElementType;
    swatch: Swatch;
    days: number;
  }[] = usage
    ? [
        {
          label: "Today",
          minutes: usage.today,
          icon: Timer,
          swatch: PALETTE.forest,
          days: 1,
        },
        {
          label: "Last 7 days",
          minutes: usage.week,
          icon: CalendarDays,
          swatch: PALETTE.gold,
          days: 7,
        },
        {
          label: "Last 30 days",
          minutes: usage.month,
          icon: CalendarRange,
          swatch: PALETTE.sky,
          days: 30,
        },
      ]
    : [];
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={`Time on BulanTanom: ${farmer.full_name || farmer.email}`}
        title="Time on BulanTanom"
        className="hover:bg-muted data-[popup-open]:bg-muted focus-visible:ring-ring/50 -mx-2 -my-1 flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors outline-none focus-visible:ring-3"
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup className="bg-popover text-popover-foreground w-72 overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_-24px_#065f46] transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div
              className="relative isolate overflow-hidden px-4 py-3 text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #0f766e 100%)",
              }}
            >
              <span
                aria-hidden="true"
                className="absolute -top-10 -right-8 -z-10 size-28 rounded-full opacity-40 blur-2xl"
                style={{ backgroundColor: PALETTE.gold[0] }}
              />
              <p className="font-heading text-[10px] font-semibold tracking-[0.16em] text-amber-300 uppercase">
                Time on BulanTanom
              </p>
              <Popover.Title className="font-heading truncate text-base font-semibold">
                {farmer.full_name || farmer.email}
              </Popover.Title>
            </div>
            {usage ? (
              <div className="flex flex-col gap-2 p-3">
                {rows.map(({ label, minutes, icon: Icon, swatch, days }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2"
                    style={{ backgroundColor: tint(swatch[1], 9) }}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundImage: gradient(swatch) }}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-[11px]">
                        {label}
                      </p>
                      <p className="font-heading font-semibold tabular-nums">
                        {formatUsage(minutes)}
                      </p>
                    </div>
                    {days > 1 && minutes > 0 && (
                      <span className="text-muted-foreground text-right text-[10px] leading-tight">
                        about
                        <br />
                        <span
                          className="font-semibold"
                          style={{ color: INK.forest }}
                        >
                          {formatUsage(Math.round(minutes / days))}
                        </span>
                        /day
                      </span>
                    )}
                  </div>
                ))}
                <p className="text-muted-foreground px-1 pt-1 text-[11px] leading-snug">
                  Counted while BulanTanom is open on screen, since{" "}
                  {formatDisplayDate(usage.since)}.{" "}
                  {farmer.is_online
                    ? "Online now."
                    : lastActiveLabel(farmer.last_seen_at) + "."}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                Usage time is not available yet.
              </p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** "Last active 14 days ago" — when the Farmer last had BulanTanom open. */
export function lastActiveLabel(
  lastSeenAt: string | null,
  now = new Date(),
): string {
  if (!lastSeenAt) return "Not signed in yet";
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lastSeenAt).getTime()) / 60_000),
  );
  if (minutes < 1) return "Last active just now";
  if (minutes < 60)
    return `Last active ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `Last active ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Last active 1 day ago" : `Last active ${days} days ago`;
}

/** Marks the searched text inside a name or email. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-primary/20 text-foreground rounded-sm">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}
