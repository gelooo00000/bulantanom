"use client";

import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  DatabaseZap,
  Info,
  LoaderCircle,
  Minus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Trend } from "@/lib/api/analytics-api";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Page furniture: breadcrumbs, the advisory note and the live-data footer.
 * ------------------------------------------------------------------------- */

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-foreground font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AdvisoryNote() {
  return (
    <p className="border-primary/25 bg-primary/5 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs">
      <Info className="text-primary mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium">Advisory:</span> Results are advisory and based on
        user-provided inputs, not final decisions.
      </span>
    </p>
  );
}

export function LiveDataNote() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      Every figure is read live from the BulanTanom database. Nothing here is estimated.
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * StatCard: a KPI with its live value and the change against the previous
 * period of the same length.
 * ------------------------------------------------------------------------- */

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: ElementType;
  trend?: Trend;
  hint?: string;
  loading?: boolean;
}) {
  const delta = trend ? trend.current - trend.previous : 0;
  const TrendIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <div className="border-border bg-card relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border p-4">
      <span aria-hidden="true" className="bg-primary/70 absolute inset-x-0 top-0 h-0.5" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground line-clamp-2 text-xs leading-snug font-medium">{label}</p>
        <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <span className="bg-muted h-7 w-16 animate-pulse rounded-md" aria-label="Loading" />
      ) : (
        <p
          className={cn(
            "font-heading truncate leading-none font-medium tabular-nums",
            typeof value === "number" ? "text-2xl" : "text-base leading-tight",
          )}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </p>
      )}
      {trend && !loading ? (
        <p
          className={cn(
            "flex items-center gap-1 text-[11px]",
            delta > 0 ? "text-risk-low" : delta < 0 ? "text-risk-high" : "text-muted-foreground",
          )}
          title={`${shortDate(trend.period.from)}–${shortDate(trend.period.to)}: ${trend.current}; ${shortDate(trend.previous_period.from)}–${shortDate(trend.previous_period.to)}: ${trend.previous}`}
        >
          <TrendIcon className="size-3" aria-hidden="true" />
          <span>
            {delta > 0 ? "+" : ""}
            {delta} <span className="text-muted-foreground">vs previous period</span>
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground truncate text-[11px]">{hint ?? " "}</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ChartCard: a titled card with an optional link, a note when an active
 * filter does not apply to it, and its own loading / empty / error states.
 * ------------------------------------------------------------------------- */

export function ChartCard({
  title,
  description,
  href,
  linkLabel,
  ignored = [],
  className,
  action,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  /** Active filters this card does not honour. */
  ignored?: string[];
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn("border-border bg-card flex min-w-0 flex-col rounded-2xl border p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">{title}</h2>
        {href && linkLabel ? (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-xs" style={{ color: "var(--landing-accent)" }}>
            {linkLabel}
            <ArrowRight className="size-3" />
          </Link>
        ) : (
          action
        )}
      </div>
      {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      {ignored.length > 0 && (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[11px]">
          <Info className="size-3 shrink-0" aria-hidden="true" />
          The {joinNames(ignored)} filter{ignored.length > 1 ? "s do" : " does"} not apply to this card.
        </p>
      )}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function joinNames(names: string[]) {
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Loading, error and empty handling for one card's query. */
export function CardState<T>({
  query,
  isEmpty,
  emptyText = "No data yet",
  emptyHint,
  children,
  minHeight = 160,
}: {
  query: { data: T | null; loading: boolean; error: string | null; refetch: () => void };
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  emptyHint?: string;
  children: (data: T) => ReactNode;
  minHeight?: number;
}) {
  if (query.loading && !query.data) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-xs" style={{ minHeight }}>
        <LoaderCircle className="text-primary size-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" style={{ minHeight }}>
        <TriangleAlert className="text-risk-high size-5" aria-hidden="true" />
        <p className="text-muted-foreground max-w-xs text-xs">{query.error}</p>
        <Button size="sm" variant="outline" onClick={query.refetch}>
          Try again
        </Button>
      </div>
    );
  }
  if (!query.data) return null;
  if (isEmpty?.(query.data)) {
    return (
      <div
        className="border-border text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 text-center"
        style={{ minHeight }}
      >
        <DatabaseZap className="size-4" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">{emptyText}</p>
        {emptyHint && <p className="max-w-xs text-xs">{emptyHint}</p>}
      </div>
    );
  }
  return <div className={cn("flex flex-1 flex-col", query.loading && "opacity-60 transition-opacity")}>{children(query.data)}</div>;
}
