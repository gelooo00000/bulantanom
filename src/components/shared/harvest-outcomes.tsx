"use client";

import {
  BellRing,
  ClipboardCheck,
  HeartPulse,
  Lightbulb,
  ShieldCheck,
  Sprout,
  Timer,
  Wheat,
} from "lucide-react";
import { useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { AuthedImage } from "@/components/shared/authed-image";
import { EmptyState } from "@/components/shared/empty-state";
import { IconStatCard } from "@/components/shared/icon-stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type {
  HarvestOutcomeReport,
  HarvestOutcomes as Outcomes,
  LossOutcomeReport,
} from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

const TONE: Record<string, string> = {
  GOOD: "text-risk-low",
  HEALTHY: "text-risk-low",
  YES: "text-risk-low",
  FAIR: "text-risk-medium",
  MINOR_PROBLEMS: "text-risk-medium",
  A_LITTLE: "text-risk-medium",
  POOR: "text-risk-high",
  DAMAGED: "text-risk-high",
  NO: "text-risk-high",
};

/**
 * "Harvest Outcomes": how plants monitored with BulanTanom turned out, from
 * the Farmers' harvest reports. Shared by the LGU Harvest page and the Admin
 * page; each passes its own role's fetcher.
 */
export function HarvestOutcomes({
  fetcher,
}: {
  fetcher: (accessToken: string) => Promise<Outcomes>;
}) {
  const { data, loading, error, refetch } = useAuthedQuery(fetcher);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="harvest-outcomes">
      <div>
        <h2 id="harvest-outcomes" className="font-heading flex items-center gap-2 text-lg">
          <ClipboardCheck className="text-risk-low size-5" aria-hidden="true" />
          Harvest Outcomes
        </h2>
        <p className="text-muted-foreground text-sm">
          How plants monitored with BulanTanom turned out, from the report each Farmer fills in
          when a plant is harvested or lost.
        </p>
      </div>

      {loading ? (
        <LguLoading label="Loading harvest outcomes…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.total + (data.lost_total ?? 0) === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No harvest reports yet"
          description="Outcomes appear here once Farmers mark plants harvested and fill in the harvest report."
        />
      ) : (
        <OutcomeBody data={data} />
      )}
    </section>
  );
}

function OutcomeBody({ data }: { data: Outcomes }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IconStatCard icon={HeartPulse} tone="risk-low" label="Healthy at harvest" value={pct(data.healthy_rate)} />
        <IconStatCard
          icon={ShieldCheck}
          tone="risk-medium"
          label="Recovered from High risk"
          value={`${data.recovered_healthy} of ${data.reached_high_risk}`}
        />
        <IconStatCard icon={Timer} label="Harvested on time" value={pct(data.on_time_rate)} />
        <IconStatCard icon={Lightbulb} label="Farmers say the advice helped" value={pct(data.advice_helped_rate)} />
      </div>
      <p className="text-muted-foreground -mt-1 text-xs">
        From {data.total} harvest report{data.total === 1 ? "" : "s"}. {pct(data.monitored_rate)} of these
        plants had at least one weekly assessment.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <IconStatCard icon={Sprout} label="Survival rate (harvested vs lost)" value={pct(data.survival_rate)} />
        <IconStatCard icon={Wheat} tone="risk-high" label="Plants lost" value={data.lost_total} />
        <IconStatCard
          icon={BellRing}
          tone="risk-medium"
          label="Lost plants BulanTanom had warned about"
          value={`${data.warned_before_loss} of ${data.lost_total}`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <BreakdownCard title="Quality" rows={data.quality} total={data.total} />
        <BreakdownCard title="Health at harvest" rows={data.final_health} total={data.total} />
        <BreakdownCard title="Did the advice help?" rows={data.advice_helped} total={data.total} />
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="text-muted-foreground px-4 pt-4 pb-2 text-left text-xs font-medium tracking-wide uppercase">
              By crop
            </caption>
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2 font-medium">Crop</th>
                <th className="px-2 py-2 font-medium">Harvests</th>
                <th className="px-2 py-2 font-medium">Healthy</th>
                <th className="px-2 py-2 font-medium">Good quality</th>
                <th className="px-2 py-2 font-medium">On time</th>
                <th className="px-2 py-2 font-medium">Avg. days</th>
                <th className="px-4 py-2 font-medium">Avg. yield</th>
              </tr>
            </thead>
            <tbody>
              {data.by_crop.map((crop) => (
                <tr key={crop.crop} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    <span aria-hidden="true">{crop.emoji}</span> {crop.crop}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">{crop.harvests}</td>
                  <td className="px-2 py-2.5 tabular-nums">{pct(crop.healthy_rate)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{pct(crop.good_quality_rate)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{pct(crop.on_time_rate)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{crop.average_days}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {crop.average_yield.length
                      ? crop.average_yield.map((y) => `${y.average} ${y.unit_label}`).join(" · ")
                      : "Not given"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data.lost_total > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <BreakdownCard
            title="Causes of loss"
            rows={data.causes.filter((c) => c.count > 0)}
            total={data.lost_total}
            neutral
          />
          <div className="flex flex-col gap-2 md:col-span-2">
            <h3 className="text-sm font-medium">Latest lost plants</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.recent_losses.map((loss) => (
                <LossCard key={loss.id} loss={loss} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Latest harvest reports</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.recent.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
  neutral = false,
}: {
  title: string;
  rows: Outcomes["quality"];
  total: number;
  /** One colour for every row, for answers that are not good or bad. */
  neutral?: boolean;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-2 px-4">
        <p className="text-sm font-medium">{title}</p>
        {rows.map((row) => (
          <div key={row.value} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className={neutral ? "" : TONE[row.value]}>{row.label}</span>
              <span className="text-muted-foreground tabular-nums">{row.count}</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full bg-current", neutral ? "text-primary" : TONE[row.value])}
                style={{ width: `${total ? (100 * row.count) / total : 0}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ReportCard({ report }: { report: HarvestOutcomeReport }) {
  const [showPhoto, setShowPhoto] = useState(false);
  const amount =
    report.yield_amount !== null ? `${Number(report.yield_amount)} ${report.yield_unit_label}` : "Amount not given";
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-2 px-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              <span aria-hidden="true">{report.crop_emoji}</span> {report.plant_name}
            </p>
            <p className="text-muted-foreground text-xs">
              {report.farmer_name} · harvested {formatDisplayDate(report.harvested_on)} · {amount}
            </p>
          </div>
          <span className="text-muted-foreground shrink-0 text-xs">{report.timing_label}</span>
        </div>
        <p className="text-xs">
          <span className={TONE[report.quality]}>{report.quality_label} quality</span> ·{" "}
          <span className={TONE[report.final_health]}>{report.final_health_label}</span> · Advice helped:{" "}
          <span className={TONE[report.advice_helped]}>{report.advice_helped_label}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {report.assessments_count} weekly assessment{report.assessments_count === 1 ? "" : "s"} ·{" "}
          {report.highest_risk ? `highest risk ${report.highest_risk.toLowerCase()}` : "no risk reading"}
          {report.recovered_from_high ? " · recovered from High risk" : ""}
        </p>
        {report.notes && <p className="text-muted-foreground line-clamp-3 text-xs italic">“{report.notes}”</p>}
        {report.photo_url &&
          (showPhoto ? (
            <AuthedImage
              src={report.photo_url}
              alt={`Harvest of ${report.plant_name}`}
              className="bg-muted max-h-64 w-full rounded-lg object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowPhoto(true)}
              className="self-start text-xs font-medium"
              style={{ color: "var(--landing-accent)" }}
            >
              View harvest photo
            </button>
          ))}
      </CardContent>
    </Card>
  );
}

function LossCard({ loss }: { loss: LossOutcomeReport }) {
  const [showPhoto, setShowPhoto] = useState(false);
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-1.5 px-4 text-sm">
        <p className="font-medium">
          <span aria-hidden="true" className="grayscale">
            {loss.crop_emoji}
          </span>{" "}
          {loss.plant_name}
        </p>
        <p className="text-muted-foreground text-xs">
          {loss.farmer_name} · lost {formatDisplayDate(loss.lost_at.slice(0, 10))} · day {loss.age_days}
        </p>
        <p className="text-xs">
          <span className="font-medium">{loss.cause_label}</span> · noticed {loss.noticed_label.toLowerCase()}
        </p>
        <p className={cn("text-xs", loss.warned_before ? "text-risk-medium" : "text-muted-foreground")}>
          {loss.warned_before
            ? `Warned beforehand (last reading ${loss.last_risk.toLowerCase()})`
            : loss.assessments_count
              ? "No warning before the loss"
              : "Never assessed"}
        </p>
        {loss.notes && <p className="text-muted-foreground line-clamp-3 text-xs italic">“{loss.notes}”</p>}
        {loss.photo_url &&
          (showPhoto ? (
            <AuthedImage
              src={loss.photo_url}
              alt={`Lost plant ${loss.plant_name}`}
              className="bg-muted max-h-64 w-full rounded-lg object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowPhoto(true)}
              className="self-start text-xs font-medium"
              style={{ color: "var(--landing-accent)" }}
            >
              View photo
            </button>
          ))}
      </CardContent>
    </Card>
  );
}
