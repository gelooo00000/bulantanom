"use client";

import { Biohazard, Bug, CircleHelp, CloudRain, PawPrint, Sun, type LucideIcon } from "lucide-react";

import { CardState, ChartCard } from "@/components/analytics/cards";
import { ColumnChart, HorizontalBars } from "@/components/lgu/dashboard-charts";
import { fetchLguPlantLosses, type PlantLosses } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";

type Group = "calamity" | "pest_disease" | "other";

/**
 * The three loss groups, in a fixed order with their own validated colours
 * (--loss-* in globals.css). Each cause takes its group's colour, and every
 * bar is labelled with its name and an icon, so colour is never the only cue.
 */
const GROUPS: { value: Group; label: string; color: string }[] = [
  { value: "calamity", label: "Calamity", color: "var(--loss-calamity)" },
  { value: "pest_disease", label: "Pests & disease", color: "var(--loss-pest)" },
  { value: "other", label: "Other", color: "var(--loss-other)" },
];
const COLOR: Record<Group, string> = Object.fromEntries(GROUPS.map((g) => [g.value, g.color])) as Record<
  Group,
  string
>;

const CAUSE: Record<string, { group: Group; icon: LucideIcon }> = {
  FLOOD_TYPHOON: { group: "calamity", icon: CloudRain },
  DROUGHT_HEAT: { group: "calamity", icon: Sun },
  PEST: { group: "pest_disease", icon: Bug },
  DISEASE: { group: "pest_disease", icon: Biohazard },
  ANIMALS: { group: "other", icon: PawPrint },
  OTHER: { group: "other", icon: CircleHelp },
};

const monthName = (month: string, style: "short" | "long") =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en", { month: style, ...(style === "long" && { year: "numeric" }) });

/** Plants that died before harvest, on Agricultural Analytics. */
export function PlantLossCard({ className }: { className?: string }) {
  const query = useAuthedQuery(fetchLguPlantLosses);
  const { currentUser } = useAuth();
  // The Plant Loss page is an Officer's page; an Admin sees the card only.
  const officer = currentUser?.role !== "admin";

  return (
    <ChartCard
      title="Plant losses"
      description="Plants that died before harvest, and what killed them."
      href={officer ? "/lgu/plant-loss" : undefined}
      linkLabel="Plant Loss"
      className={className}
    >
      <CardState
        query={query}
        isEmpty={(d) => d.total === 0}
        emptyText="No plants lost"
        emptyHint="When a Farmer reports that a plant died, it is counted here."
      >
        {(d) => <PlantLossChart data={d} />}
      </CardState>
    </ChartCard>
  );
}

export function PlantLossChart({ data }: { data: PlantLosses }) {
  const groupCount: Record<Group, number> = {
    calamity: data.calamity,
    pest_disease: data.pest_disease,
    other: data.other,
  };

  const causes = data.causes
    .filter((cause) => cause.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((cause) => ({
      key: cause.value,
      label: cause.label,
      value: cause.count,
      color: COLOR[CAUSE[cause.value]?.group ?? "other"],
      icon: CAUSE[cause.value]?.icon ?? CircleHelp,
    }));

  // Each month's losses split by group, from the losses themselves.
  const perMonth = new Map<string, Record<Group, number>>();
  for (const loss of data.losses) {
    const month = loss.lost_at.slice(0, 7);
    const row = perMonth.get(month) ?? { calamity: 0, pest_disease: 0, other: 0 };
    row[loss.cause_group as Group] += 1;
    perMonth.set(month, row);
  }
  const months = data.months;
  const inRange = months.reduce((sum, m) => sum + m.count, 0);
  const peak = months.reduce((best, m, i) => (m.count > months[best]!.count ? i : best), 0);

  const tiles = [
    { label: "Lost before harvest", value: String(data.total) },
    { label: "To a calamity", value: String(data.calamity) },
    { label: "High risk, not saved", value: String(data.high_risk_not_saved) },
    {
      label: "Harvest survival",
      value: data.survival_rate === null ? "—" : `${data.survival_rate}%`,
      hint: `${data.harvested} harvested`,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-muted/40 rounded-xl px-3 py-2.5">
            <dt className="text-muted-foreground text-[11px]">{tile.label}</dt>
            <dd className="font-heading mt-0.5 flex items-baseline gap-1.5">
              <span className="text-xl leading-none font-medium tabular-nums">{tile.value}</span>
              {tile.hint && <span className="text-muted-foreground text-[11px]">{tile.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {/* One legend for both charts: the colours are the same groups in each. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Loss groups">
        {GROUPS.map((group) => (
          <li key={group.value} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: group.color }} />
            {group.label}
            <span className="font-heading font-medium tabular-nums">{groupCount[group.value]}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-xs font-medium">What killed them</h3>
          <HorizontalBars rows={causes} unit="plant" label="Plants lost per cause" />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-xs font-medium">Lost per month</h3>
          <ColumnChart
            columns={months.map((m) => {
              const split = perMonth.get(m.month);
              return {
                key: m.month,
                axisLabel: monthName(m.month, "short"),
                title: monthName(m.month, "long"),
                tableLabel: monthName(m.month, "long"),
                count: m.count,
                segments: GROUPS.map((group) => ({
                  key: group.value,
                  color: group.color,
                  count: split?.[group.value] ?? 0,
                })),
              };
            })}
            unit="plant"
            summary={
              inRange === 0
                ? `No plants lost in the last ${months.length} months.`
                : `${inRange} plant${inRange === 1 ? "" : "s"} lost in the last ${months.length} months.`
            }
            name={`Plants lost per month, last ${months.length} months, ${inRange} in total.`}
            tableHeading="Month"
            tableTitle="Plants lost per month"
            labelIndex={months[peak]?.count ? peak : undefined}
          />
        </div>
      </div>
    </div>
  );
}
