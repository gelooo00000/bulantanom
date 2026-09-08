"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  FlaskConical,
  Radar,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  Users,
  Wheat,
} from "lucide-react";

import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { RiskCountsRow } from "@/components/risk/risk-counts";
import { EmptyState } from "@/components/shared/empty-state";
import { IconStatCard } from "@/components/shared/icon-stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchLguDashboard, fetchLguSoilRecommendations } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";

export default function LguDashboardPage() {
  const { currentUser } = useAuth();
  const { data, loading, error, refetch } = useLguQuery(fetchLguDashboard);
  // Latest Farmer soil assessments, straight from MySQL — never hardcoded.
  const { data: soilRecords } = useLguQuery((token) =>
    fetchLguSoilRecommendations(token),
  );

  if (loading) return <LguLoading label="Loading dashboard data…" />;
  if (error) return <LguError message={error} onRetry={refetch} />;
  if (!data) return null;

  const { farmers, farm } = data;
  const hasFarmers = farmers.total > 0;
  // Counted by Django over the latest reading per plant, so a plant that has
  // since recovered is not still reported as high risk.
  const highRisk = data.risk?.HIGH ?? 0;

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IconStatCard icon={Users} label="Active Farmers" value={farmers.active} />
        <IconStatCard
          icon={Clock}
          label="Pending approval"
          value={farmers.pending}
          tone={farmers.pending > 0 ? "risk-medium" : "primary"}
        />
        <IconStatCard icon={Sprout} label="Registered Plants" value={data.plants?.total ?? 0} />
        <IconStatCard icon={ShieldCheck} label="LGU Officers" value={data.lgu_officers} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Registered Farmers</h2>
          {hasFarmers && (
            <Link
              href="/lgu/farmers"
              className="flex items-center gap-1 text-sm"
              style={{ color: "var(--landing-accent)" }}
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        <div className="mt-3">
          {farmers.active === 0 ? (
            <EmptyState
              icon={Sprout}
              title="No approved Farmers yet"
              description={
                farmers.pending > 0
                  ? `${farmers.pending} registration${farmers.pending > 1 ? "s are" : " is"} waiting for administrator approval.`
                  : "Approved Farmer accounts will appear here once they register and an administrator approves them."
              }
              action={
                <Button nativeButton={false} render={<Link href="/lgu/farmers" />}>
                  Open Farmer records
                  <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                </Button>
              }
            />
          ) : (
            /* Approved and Pending already appear in the stat row above, so
               this is a one-line breakdown rather than a second set of large
               numbers repeating them. */
            <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm">
              <span>
                <span className="text-foreground font-medium tabular-nums">{farmers.active}</span>{" "}
                approved
              </span>
              <span>
                <span className="text-risk-medium font-medium tabular-nums">{farmers.pending}</span>{" "}
                pending
              </span>
              <span>
                <span className="text-foreground font-medium tabular-nums">{farmers.rejected}</span>{" "}
                rejected
              </span>
              <span className="sm:ml-auto">
                <span className="text-foreground font-medium tabular-nums">{farmers.total}</span>{" "}
                total registrations
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Plant risk</h2>
          <Link
            href="/lgu/risks"
            className="flex items-center gap-1 text-sm"
            style={{ color: "var(--landing-accent)" }}
          >
            Risk overview
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Latest AI reading per plant across approved Farmers
          {data.assessments !== null && (
            <> · {data.assessments} assessment{data.assessments === 1 ? "" : "s"} submitted</>
          )}
          .
        </p>
        <div className="mt-3">
          {data.risk ? (
            <RiskCountsRow counts={data.risk} />
          ) : (
            <EmptyState
              icon={Radar}
              title="Risk readings not available"
              description="The database did not return risk figures for this farm."
            />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Soil recommendations</h2>
          <Link
            href="/lgu/soil-recommendations"
            className="flex items-center gap-1 text-sm"
            style={{ color: "var(--landing-accent)" }}
          >
            View records
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Soil assessments submitted by approved Farmers, read live from the database.
        </p>
        <div className="mt-3">
          {data.soil_recommendations && data.soil_recommendations.total > 0 ? (
            <Card className="gap-3 py-5">
              <CardContent className="grid grid-cols-3 gap-4 px-5">
                <div>
                  <p className="text-2xl font-medium tabular-nums">
                    {data.soil_recommendations.total}
                  </p>
                  <p className="text-muted-foreground text-xs">Total submissions</p>
                </div>
                <div>
                  <p className="text-risk-low text-2xl font-medium tabular-nums">
                    {data.soil_recommendations.generated}
                  </p>
                  <p className="text-muted-foreground text-xs">AI analyzed</p>
                </div>
                <div>
                  <p className="text-risk-medium text-2xl font-medium tabular-nums">
                    {data.soil_recommendations.pending_analysis}
                  </p>
                  <p className="text-muted-foreground text-xs">Not analyzed</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="No soil recommendations yet"
              description="Records appear here once approved Farmers submit their soil information."
            />
          )}
        </div>

        {/* A dashboard preview of the most recent submissions. The full soil
            record - pH, drainage, moisture and the recommended crops - lives
            on /lgu/soil-recommendations rather than being reproduced here. */}
        {soilRecords && soilRecords.length > 0 && (
          <div className="border-border divide-border mt-3 divide-y overflow-hidden rounded-xl border">
            {soilRecords.slice(0, 3).map((record) => {
              const cropCount =
                record.suitable_fruits.length +
                record.suitable_vegetables.length +
                record.suitable_crops.length;
              return (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{record.farmer_name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {record.soil_type_label} · pH {record.ph_level ?? "unknown"} ·{" "}
                      {record.drainage_label}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {record.ai_generated ? (
                      <span className="text-risk-low">
                        {cropCount} crop{cropCount === 1 ? "" : "s"} recommended
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not analyzed</span>
                    )}
                    <span className="text-muted-foreground">
                      {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Agricultural monitoring</h2>
          <Link
            href="/lgu/harvest"
            className="flex items-center gap-1 text-sm"
            style={{ color: "var(--landing-accent)" }}
          >
            Harvest & Monitoring
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Harvest windows are calculated from each plant&apos;s recorded planting
          date and its crop&apos;s growing period, read live from the database.
          Actual picked yield is not recorded, so nothing here reports it.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <IconStatCard
            icon={Wheat}
            label="Harvests open or due within 7 days"
            value={data.harvest ?? 0}
          />
          <IconStatCard
            icon={Sprout}
            label="Plants still growing"
            value={data.plants?.growing ?? 0}
          />
        </div>
        {/* Renders nothing while every metric is backed by a query. Kept so a
            future unbacked figure still shows an honest "not available"
            state rather than a plausible-looking 0. */}
        <div className="mt-3">
          <NotAvailableNotice metrics={data.unavailable_metrics} />
        </div>
      </div>
    </div>
  );
}
