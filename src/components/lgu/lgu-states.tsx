"use client";

import { DatabaseZap, LoaderCircle, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { UnavailableMetric } from "@/lib/api/lgu-api";

export function LguLoading({ label = "Loading farm data…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <LoaderCircle className="text-primary size-6 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

export function LguError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
      <span className="bg-risk-high/15 text-risk-high flex size-10 items-center justify-center rounded-full">
        <TriangleAlert className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">Unable to load farm data.</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
      </div>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

/**
 * Rendered where a metric would go when the underlying Django model does
 * not exist yet. Deliberately never shows a number — showing "0" here
 * would imply the database was queried and came back empty.
 */
export function MetricNotAvailable({ metric }: { metric: UnavailableMetric }) {
  return (
    <EmptyState
      icon={DatabaseZap}
      title={`${metric.label} not available yet`}
      description={`${metric.reason} This screen will populate from MySQL once that milestone lands.`}
    />
  );
}

export function NotAvailableNotice({ metrics }: { metrics: UnavailableMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="border-border bg-card/50 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <DatabaseZap className="text-muted-foreground size-4" />
        Not yet connected to the database
      </p>
      <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
        {metrics.map((m) => (
          <li key={m.key}>
            <span className="text-foreground/80 font-medium">{m.label}</span> — {m.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
