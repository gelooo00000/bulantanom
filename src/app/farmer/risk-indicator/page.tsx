"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CircleHelp,
  Leaf,
  LoaderCircle,
  OctagonAlert,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { DonutChart } from "@/components/lgu/risk-pie";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { BackendPlant } from "@/lib/api/plants-api";
import { fetchFarmerRisk, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CARD_OUTLINE, CROP_OUTLINE, cropVar } from "@/lib/crop-colors";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Entry = { plant: BackendPlant; latest: BackendAssessment | null };

/**
 * The page groups plants the way the overview chart does. A "Too Early" or
 * failed check is not a Low / Medium / High verdict, so it sits with the
 * plants that have no reading yet.
 */
type Group = "high" | "medium" | "low" | "none";

const GROUPS: { key: Group; label: MessageKey; color: string; icon: typeof Leaf }[] = [
  { key: "high", label: "riskBadge.high", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "medium", label: "riskBadge.medium", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "low", label: "riskBadge.low", color: "var(--risk-low)", icon: Leaf },
  { key: "none", label: "riskCounts.noReading", color: "var(--muted-foreground)", icon: CircleHelp },
];
const COLOR = Object.fromEntries(GROUPS.map((g) => [g.key, g.color])) as Record<Group, string>;
/** GROUPS is already worst first, so its order is the sort key. */
const SEVERITY = Object.fromEntries(GROUPS.map((g, i) => [g.key, i])) as Record<Group, number>;

/** A colour at low strength, for icon and chip backgrounds (as on the Admin cards). */
const tint = (color: string, percent = 12) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

function levelOf(latest: BackendAssessment | null): BadgeLevel | undefined {
  return latest?.risk?.risk_level?.toLowerCase() as BadgeLevel | undefined;
}

function groupOf(latest: BackendAssessment | null): Group {
  const level = levelOf(latest);
  return level === "high" || level === "medium" || level === "low" ? level : "none";
}

export default function RiskIndicatorPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRisk);
  const { t } = useLanguage();

  // What can be assessed today first, then the soonest to open.
  const entries: Entry[] = (data?.plants ?? [])
    .map(({ plant, latest_assessment }) => ({ plant, latest: latest_assessment }))
    .sort((a, b) => {
      const ea = a.plant.assessment_eligibility;
      const eb = b.plant.assessment_eligibility;
      return (
        Number(eb.can_assess) - Number(ea.can_assess) ||
        ea.days_remaining - eb.days_remaining ||
        a.plant.display_name.localeCompare(b.plant.display_name)
      );
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("riskPage.title")} description={t("riskPage.description")} />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("riskPage.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="font-heading text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title={t("riskPage.emptyTitle")}
          description={t("riskPage.emptyText")}
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
              {t("suited.addPlant")}
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <>
          <RiskBreakdown entries={entries} />

          {/* Plants with a verdict first, worst first, so a reading is never
              buried under a long run of plants still waiting for one. */}
          <PlantGroup
            title={t("riskPage.withReading")}
            entries={entries
              .filter((e) => groupOf(e.latest) !== "none")
              .sort((a, b) => SEVERITY[groupOf(a.latest)] - SEVERITY[groupOf(b.latest)])}
          />
          <PlantGroup
            title={t("riskPage.withoutReading")}
            entries={entries.filter((e) => groupOf(e.latest) === "none")}
          />

          <RiskInfoNote />
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-border bg-card flex flex-col gap-4 rounded-2xl border p-5", CARD_OUTLINE)}>
      <header>
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** Plants by their latest level: the donut for the share, labelled bars for the counts. */
function RiskBreakdown({ entries }: { entries: Entry[] }) {
  const { t } = useLanguage();
  const rows: BarRow[] = GROUPS.map((g) => ({
    key: g.key,
    label: t(g.label),
    value: entries.filter((e) => groupOf(e.latest) === g.key).length,
    color: g.color,
    icon: g.icon,
  }));
  const unit = { unit: t("riskPage.plant"), unitPlural: t("riskPage.plants") };

  return (
    <Panel title={t("riskPage.byLevel")} description={t("riskPage.byLevelText")}>
      <div className="grid items-center gap-5 sm:grid-cols-[200px_1fr]">
        <DonutChart rows={rows} {...unit} name={t("riskPage.byLevel")} />
        <HorizontalBars rows={rows} {...unit} label={t("riskPage.byLevel")} />
      </div>
    </Panel>
  );
}

/** A titled run of plant cards with its count; nothing at all when empty. */
function PlantGroup({ title, entries }: { title: string; entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {title}
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
          {entries.length}
        </span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <PlantRiskCard key={entry.plant.id} {...entry} />
        ))}
      </ul>
    </section>
  );
}

/** The crop's emoji in a round chip tinted with the plant's level, like the Admin avatars. */
function CropIcon({ entry }: { entry: Entry }) {
  const color = COLOR[groupOf(entry.latest)];
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full text-xl"
      style={{ backgroundColor: tint(color, 16) }}
    >
      {entry.plant.crop.emoji}
    </span>
  );
}

/**
 * One plant: its latest level, when it was last checked, and this week's
 * check. The explanation and photo stay in Assessment History, behind the
 * arrow.
 */
function PlantRiskCard({ plant, latest }: Entry) {
  const { t, dateLocale } = useLanguage();
  const level = levelOf(latest);
  const group = groupOf(latest);
  const color = COLOR[group];
  // A plant with a verdict wears its level's colour on the whole card, so
  // it can be picked out at a glance; one still waiting stays plain.
  const assessed = group !== "none";

  return (
    // The level's border is set through a variable, not inline, so the
    // crop-coloured outline (as on My Plants and Harvest) can replace it
    // while the card is pointed at or tapped.
    <li
      tabIndex={0}
      className={cn(
        "bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        assessed && "border-(--level)",
        CROP_OUTLINE,
      )}
      style={{
        ...cropVar(plant.crop.name),
        ...(assessed && {
          "--level": tint(color, 45),
          backgroundImage: `linear-gradient(${tint(color, 8)}, ${tint(color, 8)})`,
        }),
      } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 ${assessed ? "h-1.5" : "h-1 opacity-40"}`}
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start gap-3">
        <CropIcon entry={{ plant, latest }} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-heading truncate text-base leading-tight font-medium">
            {plant.display_name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {/* The crop, unless the name already is the crop (no variety). */}
            {plant.display_name !== plant.crop.name && `${plant.crop.name} · `}
            {t("row.day", { n: plant.age_days })}
          </p>
        </div>
        {latest && (
          <Link
            href={`/farmer/assessments/${latest.id}`}
            aria-label={`${t("riskPage.details")}: ${plant.display_name}`}
            title={t("riskPage.details")}
            className="text-muted-foreground hover:text-foreground hover:bg-muted -m-1 rounded-lg p-1.5 transition-colors"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {level ? (
          <RiskBadge size="sm" level={level} />
        ) : (
          <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium">
            <CircleHelp className="size-3" />
            {t("riskCounts.noReading")}
          </span>
        )}
        {plant.assessment_eligibility.can_assess && (
          <span
            className="text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: tint("var(--primary)") }}
          >
            <CalendarClock className="size-3" />
            {t("riskPage.dueNow")}
          </span>
        )}
      </div>

      <div className="border-border text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-dashed pt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <CalendarCheck className="size-3.5" />
          {latest
            ? t("riskPage.checked", {
                date: new Date(`${latest.assessment_date}T00:00:00`).toLocaleDateString(dateLocale, {
                  month: "short",
                  day: "numeric",
                }),
              })
            : t("riskPage.notChecked")}
        </span>
        <WeeklyCheck plant={plant} />
      </div>
    </li>
  );
}

/**
 * This week's check for one plant: a button when it is due, otherwise when
 * the next one opens. Straight from the server's `assessment_eligibility`,
 * so it offers only what the API will accept.
 */
function WeeklyCheck({ plant }: { plant: BackendPlant }) {
  const { t } = useLanguage();
  const { can_assess, days_remaining } = plant.assessment_eligibility;

  if (can_assess) {
    return (
      <Button
        size="sm"
        className="h-7 px-2.5 text-xs"
        nativeButton={false}
        render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
      >
        {t("riskPage.assessNow")}
        <ArrowRight className="size-3.5" />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <CalendarClock className="size-3.5" />
      {days_remaining === 1 ? t("riskPage.nextInOne") : t("riskPage.nextIn", { n: days_remaining })}
    </span>
  );
}
