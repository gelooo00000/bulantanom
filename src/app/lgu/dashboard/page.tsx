"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleHelp,
  Leaf,
  OctagonAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { HorizontalBars, WeeklyColumns, type BarRow } from "@/components/lgu/dashboard-charts";
import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { RiskPie } from "@/components/lgu/risk-pie";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { fetchLguDashboard } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * The LGU Officer's dashboard: the whole farm at a glance.
 *
 * Read top to bottom it answers, in order: is anything urgent (the high-risk
 * banner), how healthy are the plants and are Farmers keeping up their
 * weekly checks (the first pair of charts), then what is growing and who is
 * registered (the second pair). Every chart links to the page that holds
 * the detail behind it.
 *
 * Every figure is read from MySQL by `/api/lgu/dashboard/`.
 */

// Past this many crops the tail folds into one "Other" bar, so the chart
// stays scannable instead of growing a row per rarely-planted crop.
const CROP_ROWS = 6;

export default function LguDashboardPage() {
  const { currentUser } = useAuth();
  const { data, loading, error, refetch } = useLguQuery(fetchLguDashboard);

  if (loading) return <LguLoading label="Loading dashboard data…" />;
  if (error) return <LguError message={error} onRetry={refetch} />;
  if (!data) return null;

  const { farmers, farm } = data;
  // Counted by Django over the latest reading per plant, so a plant that has
  // since recovered is not still reported as high risk.
  const highRisk = data.risk?.HIGH ?? 0;

  const riskRows: BarRow[] = data.risk
    ? [
        { key: "HIGH", label: "High risk", value: data.risk.HIGH, color: "var(--risk-high)", icon: OctagonAlert },
        { key: "MEDIUM", label: "Medium risk", value: data.risk.MEDIUM, color: "var(--risk-medium)", icon: TriangleAlert },
        { key: "LOW", label: "Low risk", value: data.risk.LOW, color: "var(--risk-low)", icon: Leaf },
        { key: "none", label: "No reading yet", value: data.risk.unassessed, color: "var(--muted-foreground)", icon: CircleHelp },
      ]
    : [];

  const crops = data.crops ?? [];
  const cropRows: BarRow[] = crops.slice(0, CROP_ROWS).map((crop) => ({
    key: crop.name,
    label: crop.name,
    emoji: crop.emoji,
    value: crop.count,
    color: "var(--primary)",
  }));
  const otherCrops = crops.slice(CROP_ROWS);
  if (otherCrops.length > 0) {
    cropRows.push({
      key: "other",
      label: `Other (${otherCrops.length} crop${otherCrops.length === 1 ? "" : "s"})`,
      value: otherCrops.reduce((sum, crop) => sum + crop.count, 0),
      color: "var(--muted-foreground)",
    });
  }

  // Pending is the only account state that needs someone to act.
  const farmerRows: BarRow[] = [
    { key: "approved", label: "Approved", value: farmers.active, color: "var(--primary)" },
    { key: "pending", label: "Pending approval", value: farmers.pending, color: "var(--risk-medium)" },
    { key: "rejected", label: "Rejected", value: farmers.rejected, color: "var(--muted-foreground)" },
    { key: "suspended", label: "Suspended", value: farmers.suspended, color: "var(--muted-foreground)" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Good day, ${currentUser?.firstName ?? "Officer"}.`}
        description={`Agricultural activity overview for ${farm.name}.`}
      />

      {/* Only rendered when the database actually reports a high reading.
          A banner that is always present would be ignored within a week, so
          its absence has to mean something. */}
      {highRisk > 0 && (
        <div
          role="alert"
          className="border-risk-high/40 bg-risk-high/10 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-risk-high mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-risk-high text-sm font-medium">
                {highRisk} plant{highRisk === 1 ? "" : "s"} reading high risk
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {highRisk === 1 ? "This plant" : "These plants"} had a high-risk
                result on {highRisk === 1 ? "its" : "their"} most recent weekly
                assessment. Review the AI reasoning and evidence photo before
                contacting the farmer.
              </p>
            </div>
          </div>
          <Link
            href="/lgu/high-risk"
            className="border-risk-high/40 text-risk-high hover:bg-risk-high/15 inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors sm:self-auto"
          >
            Review cases
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Plant risk"
          description="Latest AI reading per plant across approved Farmers."
          href="/lgu/risks"
          linkLabel="Risk overview"
        >
          {riskRows.length > 0 ? (
            // The pie gives the share at a glance; the bars beside it name
            // each level and its count, so the colours are never the only cue.
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
              <RiskPie rows={riskRows} />
              <HorizontalBars rows={riskRows} unit="plant" label="Plants by risk level" />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              The database did not return risk figures for this farm.
            </p>
          )}
        </ChartCard>

        <ChartCard
          title="Weekly assessments"
          description="Are Farmers keeping up their weekly plant checks?"
          href="/lgu/assessments"
          linkLabel="History"
        >
          <WeeklyColumns weeks={data.assessment_trend ?? []} />
        </ChartCard>

        <ChartCard
          title="Crops planted"
          description="Plants per crop at Layuan, most planted first."
          href="/lgu/plants"
          linkLabel="All plants"
        >
          {cropRows.length > 0 ? (
            <HorizontalBars rows={cropRows} unit="plant" label="Plants per crop" />
          ) : (
            <p className="text-muted-foreground text-sm">No plants recorded yet.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Farmer accounts"
          description={`${farmers.total} registration${farmers.total === 1 ? "" : "s"} · ${data.lgu_officers} LGU officer${data.lgu_officers === 1 ? "" : "s"}.`}
          href="/lgu/farmers"
          linkLabel="Farmer records"
        >
          <HorizontalBars rows={farmerRows} unit="farmer" label="Farmer accounts by status" />
        </ChartCard>

      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5" />
        Every figure is read live from the BulanTanom database. Nothing here is estimated.
      </div>

      {/* Renders nothing while every metric is backed by a query. Kept so a
          future unbacked figure still shows an honest "not available" state
          rather than a plausible-looking 0. */}
      <NotAvailableNotice metrics={data.unavailable_metrics} />
    </div>
  );
}

function ChartCard({
  title,
  description,
  href,
  linkLabel,
  children,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex h-full flex-col px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{title}</h2>
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-xs"
            style={{ color: "var(--landing-accent)" }}
          >
            {linkLabel}
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <p className="text-muted-foreground mt-0.5 mb-4 text-xs">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
