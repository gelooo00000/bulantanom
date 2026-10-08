"use client";

import { ClipboardList, FlaskConical, History, Sprout, UserX, type LucideIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { useFiltered } from "@/components/analytics/analytics-dashboard";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { CardState, ChartCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { fetchAudit, type AnalyticsFilters, type AuditIssueRow } from "@/lib/api/analytics-api";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<string, LucideIcon> = {
  soil: FlaskConical,
  assessments: ClipboardList,
  unassessed: Sprout,
  farmers: UserX,
};

function AuditView({ filters }: { filters: AnalyticsFilters }) {
  const query = useFiltered(fetchAudit, filters);
  // Opens on the first kind of record that actually has something missing.
  const [group, setGroup] = useState<string | null>(null);

  return (
    <>
      <ChartCard title="Missing or incomplete inputs" description="Records that lack something an analysis depends on. Read-only: follow up with the farmer.">
        <CardState query={query}>
          {(d) => {
            const current =
              d.incomplete.find((g) => g.key === group) ?? d.incomplete.find((g) => g.count > 0) ?? d.incomplete[0];
            return (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label="Kinds of incomplete record">
                  {d.incomplete.map((g) => {
                    const Icon = GROUP_ICONS[g.key] ?? ClipboardList;
                    return (
                      <button
                        key={g.key}
                        type="button"
                        aria-pressed={current.key === g.key}
                        onClick={() => setGroup(g.key)}
                        className={cn(
                          "border-border flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          current.key === g.key ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", g.count ? "bg-risk-medium/15 text-risk-medium" : "bg-risk-low/15 text-risk-low")}>
                          <Icon className="size-4" />
                        </span>
                        <span>
                          <span className="font-heading block text-lg leading-none font-medium tabular-nums">{g.count}</span>
                          <span className="text-muted-foreground text-xs">{g.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <DataTable<AuditIssueRow>
                  key={current.key}
                  caption={current.label}
                  rows={current.rows}
                  rowKey={(r) => r.id}
                  searchable
                  searchLabel={`Search ${current.label.toLowerCase()}`}
                  emptyText="Nothing incomplete here."
                  columns={[
                    { key: "farmer", header: "Farmer" },
                    ...(current.rows.some((r) => r.plant) ? [{ key: "plant", header: "Plant" }] : []),
                    { key: "date", header: "Date" },
                    {
                      key: "issues",
                      header: "What is missing",
                      value: (r: AuditIssueRow) => r.issues.join("; "),
                      render: (r: AuditIssueRow) => (
                        <ul className="flex flex-col gap-0.5">
                          {r.issues.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]}
                />
              </div>
            );
          }}
        </CardState>
      </ChartCard>

      <ChartCard title="Recent activity" description="The latest registrations, plantings, harvests, weekly checks, soil records and report exports, newest first.">
        <CardState query={query} isEmpty={(d) => d.activity.length === 0}>
          {(d) => (
            <ol className="flex flex-col">
              {d.activity.map((e, i) => (
                <li key={`${e.at}-${i}`} className="border-border/70 flex items-start gap-3 border-b py-2.5 text-sm last:border-0">
                  <History className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{e.text}</span>
                  <time className="text-muted-foreground shrink-0 text-xs" dateTime={e.at}>
                    {new Date(e.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </CardState>
      </ChartCard>
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AnalyticsPage
        title="Audit Analytics"
        description="Records with missing or incomplete inputs, and recent activity. Read-only."
        hideFilters={["soilType"]}
      >
        {(filters) => <AuditView filters={filters} />}
      </AnalyticsPage>
    </Suspense>
  );
}
