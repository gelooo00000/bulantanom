"use client";

import { Clock, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BackendAccountStatus } from "@/lib/api/auth-api";
import type { LguFarmer } from "@/lib/api/lgu-api";
import { cn } from "@/lib/utils";

/**
 * The LGU Officer's Farmer list: find a Farmer fast, and see who is using
 * BulanTanom right now. Newest registrations are listed first.
 *
 * Everything filters in the browser over one fetch of every Farmer, so
 * typing and switching status are instant and the status counts are always
 * right.
 */

type StatusFilter = "APPROVED" | "PENDING" | "ALL";

const STATUS_LABEL: Record<BackendAccountStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const STATUS_STYLE: Record<BackendAccountStatus, string> = {
  PENDING: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
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
      PENDING: farmers.filter((f) => f.account_status === "PENDING").length,
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
        <div className="flex gap-2" role="group" aria-label="Filter by account status">
          {(
            [
              ["APPROVED", "Approved"],
              ["PENDING", "Pending"],
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
              <span className="text-muted-foreground ml-1.5 tabular-nums">{counts[value]}</span>
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-sm" role="status">
          {shown.length === 1 ? "1 farmer" : `${shown.length} farmers`} · newest first
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
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
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
          <span className="truncate font-medium">
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
        {farmer.is_online ? (
          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Online now
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-3.5" />
            {lastActiveLabel(farmer.last_seen_at)}
          </span>
        )}
      </div>
    </li>
  );
}

/** "Last active 14 days ago" — when the Farmer last had BulanTanom open. */
export function lastActiveLabel(lastSeenAt: string | null, now = new Date()): string {
  if (!lastSeenAt) return "Not signed in yet";
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lastSeenAt).getTime()) / 60_000),
  );
  if (minutes < 1) return "Last active just now";
  if (minutes < 60) return `Last active ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active ${hours} hour${hours === 1 ? "" : "s"} ago`;
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
