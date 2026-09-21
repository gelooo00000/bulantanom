"use client";

import { ClipboardCheck, OctagonAlert, Sprout, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { lastActiveLabel } from "@/components/lgu/farmer-directory";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { FarmerRisk } from "@/lib/lgu-plant-stats";
import { cn } from "@/lib/utils";

/**
 * Who to visit, as cards an Officer can plan a round from. Each card says
 * why the visit matters (the risk counts and the crops at risk), whether the
 * Farmer is using BulanTanom right now, and how long since they last checked
 * their plants. Every Farmer works on-site at Layuan, so the card is for
 * reading, with no buttons: the visit itself is the next step.
 */

// The most urgent visits; the rest are one tap away.
const SHOWN_AT_FIRST = 5;

// A weekly check is expected; two missed weeks is worth mentioning.
const STALE_CHECK_DAYS = 14;

export type Presence = { is_online: boolean; last_seen_at: string | null };

export function FarmersToVisit({
  farmers,
  presence,
  today = new Date(),
}: {
  farmers: FarmerRisk[];
  /** Online status by Farmer id, from the Farmers list. Optional. */
  presence?: Map<number, Presence>;
  /** Injected by tests; the page always uses the real date. */
  today?: Date;
}) {
  const [showAll, setShowAll] = useState(false);

  if (farmers.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        <ClipboardCheck className="text-risk-low size-6" />
        No farmer has a high- or medium-risk plant right now.
      </div>
    );
  }

  const urgent = farmers.filter((f) => f.tally.HIGH > 0).length;
  const watch = farmers.length - urgent;
  const shown = showAll ? farmers : farmers.slice(0, SHOWN_AT_FIRST);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" role="status">
        <span className="font-medium">
          {farmers.length} farmer{farmers.length === 1 ? "" : "s"} to visit
        </span>
        {urgent > 0 && (
          <span className="text-risk-high"> · {urgent} urgent</span>
        )}
        {watch > 0 && <span className="text-risk-medium"> · {watch} to watch</span>}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((farmer, index) => (
          <FarmerCard
            key={farmer.id}
            farmer={farmer}
            rank={index + 1}
            presence={presence?.get(farmer.id)}
            today={today}
          />
        ))}
      </ul>

      {farmers.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-muted-foreground hover:text-foreground self-start text-sm underline underline-offset-2"
        >
          {showAll ? "Show only the most urgent" : `Show all ${farmers.length} farmers`}
        </button>
      )}
    </div>
  );
}

function FarmerCard({
  farmer,
  rank,
  presence,
  today,
}: {
  farmer: FarmerRisk;
  rank: number;
  presence?: Presence;
  today: Date;
}) {
  const urgent = farmer.tally.HIGH > 0;
  const check = lastCheckText(farmer.lastChecked, today);

  return (
    <li
      aria-label={`${rank}. ${farmer.name}`}
      className={cn(
        "bg-card border-border flex flex-col gap-3 rounded-xl border border-l-4 p-4",
        urgent ? "border-l-risk-high" : "border-l-risk-medium",
      )}
    >
      {/* Who, and how urgent. */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
            urgent ? "bg-risk-high/10 text-risk-high" : "bg-risk-medium/10 text-risk-medium",
          )}
        >
          {initials(farmer.name)}
          {presence?.is_online && (
            <span className="border-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-400" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{farmer.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {presence?.is_online ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Online now</span>
            ) : presence ? (
              lastActiveLabel(presence.last_seen_at, today)
            ) : (
              farmer.email
            )}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            urgent
              ? "bg-risk-high/15 text-risk-high border-risk-high/30"
              : "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
          )}
        >
          {urgent ? "Visit first" : "Check soon"}
        </span>
      </div>

      {/* Why: the counts, and the crops behind them. */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {farmer.tally.HIGH > 0 && (
          <span className="bg-risk-high/15 text-risk-high flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium">
            <OctagonAlert className="size-3.5" />
            {farmer.tally.HIGH} high
          </span>
        )}
        {farmer.tally.MEDIUM > 0 && (
          <span className="bg-risk-medium/15 text-risk-medium flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium">
            <TriangleAlert className="size-3.5" />
            {farmer.tally.MEDIUM} medium
          </span>
        )}
        <span className="text-muted-foreground flex items-center gap-1">
          <Sprout className="size-3.5" />
          of {farmer.total} plant{farmer.total === 1 ? "" : "s"}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        <span className="text-foreground">At risk: </span>
        {farmer.cropsAtRisk.map((crop, i) => (
          <span key={crop.id}>
            {i > 0 && ", "}
            <span aria-hidden="true">{crop.emoji} </span>
            {crop.name}
          </span>
        ))}
      </p>

      <p className={cn("text-xs", check.stale ? "text-risk-medium font-medium" : "text-muted-foreground")}>
        {check.text}
      </p>
    </li>
  );
}

/** "Last check 3 days ago (Sep 18)", flagged once two weeks have passed. */
export function lastCheckText(
  lastChecked: string | null,
  today = new Date(),
): { text: string; stale: boolean } {
  if (!lastChecked) return { text: "No plant checks yet", stale: true };
  const [y, m, d] = lastChecked.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);
  const when =
    days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return {
    text: `Last plant check ${when} (${formatDisplayDate(lastChecked)})`,
    stale: days >= STALE_CHECK_DAYS,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
