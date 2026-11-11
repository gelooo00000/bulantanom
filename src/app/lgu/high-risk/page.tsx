"use client";

import { OctagonAlert, ShieldCheck, Stethoscope, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { HighRiskCaseCard } from "@/components/lgu/high-risk-case-card";
import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguHighRisk, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "HIGH" | "MEDIUM";

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/**
 * Plants whose latest reading is medium or high risk, highest first. A
 * triage banner up top counts the cases and narrows the list to one level;
 * below it the cases are grouped by level.
 */
export default function LguHighRiskPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguHighRisk);
  const [filter, setFilter] = useState<Filter>("ALL");
  const high = (data ?? []).filter((a) => a.risk?.risk_level === "HIGH");
  const medium = (data ?? []).filter((a) => a.risk?.risk_level === "MEDIUM");
  const total = data?.length ?? 0;

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
          <TriageBanner
            total={total}
            high={high.length}
            medium={medium.length}
            filter={filter}
            onFilter={setFilter}
          />

          <div className="flex flex-col gap-8">
            {filter !== "MEDIUM" && (
              <CaseGroup
                title="High risk"
                hint="Contact the farmer first"
                icon={OctagonAlert}
                color="var(--risk-high)"
                cases={high}
              />
            )}
            {filter !== "HIGH" && (
              <CaseGroup
                title="Medium risk"
                hint="Keep an eye on these"
                icon={TriangleAlert}
                color="var(--risk-medium)"
                cases={medium}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The page's headline: how many plants need a look, a bar splitting them by
 * level, and a segmented control that narrows the list.
 */
function TriageBanner({
  total,
  high,
  medium,
  filter,
  onFilter,
}: {
  total: number;
  high: number;
  medium: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}) {
  const accent = high > 0 ? "var(--risk-high)" : "var(--risk-medium)";
  const options: { value: Filter; label: string; count: number; color: string }[] = [
    { value: "ALL", label: "All cases", count: total, color: "var(--primary)" },
    { value: "HIGH", label: "High", count: high, color: "var(--risk-high)" },
    { value: "MEDIUM", label: "Medium", count: medium, color: "var(--risk-medium)" },
  ];

  return (
    <section
      className="bg-card relative isolate overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-7"
      style={{ borderColor: tint(accent, 25) }}
    >
      {/* Soft glows in the risk colours behind the content. */}
      <span
        aria-hidden="true"
        className="absolute -top-24 -right-16 -z-10 size-72 rounded-full blur-3xl"
        style={{ backgroundColor: tint("var(--risk-high)", 16) }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full blur-3xl"
        style={{ backgroundColor: tint("var(--risk-medium)", 14) }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(110deg,black,transparent_65%)]"
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm"
            style={{ color: accent, backgroundColor: tint(accent, 15), boxShadow: `0 10px 30px -12px ${accent}` }}
          >
            <Stethoscope className="size-7" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">Triage</p>
            <p className="font-heading mt-1 text-2xl leading-tight font-semibold sm:text-3xl">
              <span className="tabular-nums" style={{ color: accent }}>
                {total}
              </span>{" "}
              {total === 1 ? "plant needs" : "plants need"} a closer look
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {high > 0
                ? `${high} at high risk${medium > 0 ? `, ${medium} at medium` : ""}. Open a case to see why and what to do.`
                : `${medium} at medium risk. Open a case to see why and what to do.`}
            </p>
          </div>
        </div>

        <div
          className="bg-muted/60 inline-flex shrink-0 self-start rounded-2xl p-1 lg:self-auto"
          role="group"
          aria-label="Show cases"
        >
          {options.map((option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter(option.value)}
                className={cn(
                  "font-heading flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.value !== "ALL" && (
                  <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} />
                )}
                {option.label}
                <span
                  className="rounded-full px-1.5 py-px text-xs tabular-nums"
                  style={
                    active
                      ? { color: option.color, backgroundColor: tint(option.color, 15) }
                      : { backgroundColor: "var(--border)" }
                  }
                >
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The split between levels, as one bar. */}
      <div className="mt-6">
        <div className="bg-muted flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
          {high > 0 && (
            <span
              className="h-full transition-[width] duration-700"
              style={{
                width: `${(high / total) * 100}%`,
                backgroundImage: `linear-gradient(90deg, var(--risk-high), ${tint("var(--risk-high)", 75)})`,
              }}
            />
          )}
          {medium > 0 && (
            <span
              className="h-full transition-[width] duration-700"
              style={{
                width: `${(medium / total) * 100}%`,
                backgroundImage: `linear-gradient(90deg, var(--risk-medium), ${tint("var(--risk-medium)", 75)})`,
              }}
            />
          )}
        </div>
        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Legend color="var(--risk-high)" label="High risk" count={high} />
          <Legend color="var(--risk-medium)" label="Medium risk" count={medium} />
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      <span className="text-foreground font-semibold tabular-nums">{count}</span>
    </span>
  );
}

/** One level's cases under a small heading; three a line on wide screens. */
function CaseGroup({
  title,
  hint,
  icon: Icon,
  color,
  cases,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  color: string;
  cases: BackendAssessment[];
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 items-center justify-center rounded-xl"
          style={{ color, backgroundColor: tint(color, 15) }}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <span
          className="font-heading rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color, backgroundColor: tint(color, 14) }}
        >
          {cases.length}
        </span>
        <span className="text-muted-foreground hidden text-sm sm:inline">· {hint}</span>
        <span className="h-px flex-1" style={{ backgroundImage: `linear-gradient(90deg, ${tint(color, 35)}, transparent)` }} />
      </div>

      {cases.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
          No cases at this level.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((assessment) => (
            <HighRiskCaseCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      )}
    </section>
  );
}
