"use client";

import { OctagonAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { HighRiskCaseCard } from "@/components/lgu/high-risk-case-card";
import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguHighRisk } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CARD_OUTLINE } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "HIGH" | "MEDIUM";

/**
 * Plants whose latest reading is medium or high risk, highest first. The
 * three tiles at the top count the cases and narrow the list to one level.
 */
export default function LguHighRiskPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguHighRisk);
  const [filter, setFilter] = useState<Filter>("ALL");
  const highCount = data?.filter((a) => a.risk?.risk_level === "HIGH").length ?? 0;
  const mediumCount = data?.filter((a) => a.risk?.risk_level === "MEDIUM").length ?? 0;
  const shown = (data ?? []).filter((a) => filter === "ALL" || a.risk?.risk_level === filter);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="High-Risk Cases"
        description="Plants whose latest AI reading is medium or high risk, highest first."
      />

      {loading ? (
        <LguLoading label="Loading high-risk cases…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No medium or high-risk plants"
          description="Every plant with a recent assessment is currently reading low risk. Cases appear here as soon as one is flagged."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="Show cases">
            <FilterTile
              icon={ShieldCheck}
              label={data.length === 1 ? "Case needing attention" : "Cases needing attention"}
              value={data.length}
              color="var(--primary)"
              active={filter === "ALL"}
              onClick={() => setFilter("ALL")}
            />
            <FilterTile
              icon={OctagonAlert}
              label="High risk"
              value={highCount}
              color="var(--risk-high)"
              active={filter === "HIGH"}
              onClick={() => setFilter(filter === "HIGH" ? "ALL" : "HIGH")}
            />
            <FilterTile
              icon={TriangleAlert}
              label="Medium risk"
              value={mediumCount}
              color="var(--risk-medium)"
              active={filter === "MEDIUM"}
              onClick={() => setFilter(filter === "MEDIUM" ? "ALL" : "MEDIUM")}
            />
          </div>

          {/* Three cases a line on wide screens, two on medium; each opens in a pop-up. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.length === 0 ? (
              <p className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm sm:col-span-2 lg:col-span-3">
                No cases at this level.
              </p>
            ) : (
              shown.map((assessment) => <HighRiskCaseCard key={assessment.id} assessment={assessment} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** A count that also filters the list; pressed when its level is shown. */
function FilterTile({
  icon: Icon,
  label,
  value,
  color,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "bg-card relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5 text-left transition-all sm:p-4",
        "hover:-translate-y-0.5 hover:shadow-md",
        CARD_OUTLINE,
        active ? "shadow-sm" : "border-border",
      )}
      style={
        active
          ? {
              borderColor: color,
              backgroundImage: `linear-gradient(120deg, color-mix(in oklab, ${color} 12%, transparent), transparent 70%)`,
            }
          : undefined
      }
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ color, backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)` }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="font-heading block text-2xl leading-none font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-muted-foreground mt-1 block truncate text-xs">{label}</span>
      </span>
    </button>
  );
}
