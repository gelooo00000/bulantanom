"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CircleHelp,
  Clock,
  Leaf,
  LoaderCircle,
  OctagonAlert,
  RotateCw,
  Sprout,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { LostPlantDialog } from "@/components/farmer/lost-plant-dialog";
import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { DonutChart } from "@/components/lgu/risk-pie";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SlidePager } from "@/components/shared/slide-pager";
import { Button } from "@/components/ui/button";
import { reportPlantLost, type BackendPlant, type LossAnswers } from "@/lib/api/plants-api";
import {
  fetchFarmerRisk,
  reanalyzeAssessment,
  type BackendAssessment,
} from "@/lib/api/risk-api";
import { useAuth } from "@/lib/auth/auth-context";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CARD_OUTLINE, CROP_OUTLINE, cropVar } from "@/lib/crop-colors";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Level = "LOW" | "MEDIUM" | "HIGH";
type Entry = { plant: BackendPlant; latest: BackendAssessment | null; previous?: Level | null };

/** A reading older than this is shown as out of date. */
const OLD_READING_DAYS = 14;
const LEVEL_RANK: Record<Level, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Whole days from an ISO date (YYYY-MM-DD) to today, in local time. */
function daysSince(iso: string): number {
  const then = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/** Card actions shared down the tree: report a loss, reload after a change. */
type CardActions = { onLost: (plant: BackendPlant) => void; onChanged: () => void };

/** Cards per page in each list; Previous / Next slide in the next page. */
const PAGE_SIZE = { reading: 4, early: 4, none: 6 } as const;

/**
 * The page groups plants the way the overview chart does. A "Too Early"
 * check is saved but has no level, so it has a group of its own rather than
 * looking unchecked; a failed check sits with the plants that have no
 * reading yet.
 */
type Group = "high" | "medium" | "low" | "early" | "none";

const GROUPS: { key: Group; label: MessageKey; color: string; icon: typeof Leaf }[] = [
  { key: "high", label: "riskBadge.high", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "medium", label: "riskBadge.medium", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "low", label: "riskBadge.low", color: "var(--risk-low)", icon: Leaf },
  { key: "early", label: "early.level", color: "var(--risk-early)", icon: Clock },
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
  if (level === "high" || level === "medium" || level === "low") return level;
  return level === "inconclusive" ? "early" : "none";
}

export default function RiskIndicatorPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRisk);
  const { t } = useLanguage();
  const { accessToken } = useAuth();
  // The plant whose loss is being reported, and the line said afterwards.
  const [losing, setLosing] = useState<BackendPlant | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitLoss(answers: LossAnswers) {
    if (!losing || !accessToken) throw new Error("Not signed in.");
    await reportPlantLost(accessToken, losing.id, answers);
    setNotice(t("lost.saved", { name: losing.display_name }));
    setLosing(null);
    requestNotificationRefresh();
    refetch();
  }
  const actions: CardActions = { onLost: setLosing, onChanged: refetch };

  // What can be assessed today first, then the soonest to open.
  const entries: Entry[] = (data?.plants ?? [])
    .map(({ plant, latest_assessment, previous_risk_level }) => ({
      plant,
      latest: latest_assessment,
      previous: previous_risk_level,
    }))
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

      {losing && (
        <LostPlantDialog plant={losing} onCancel={() => setLosing(null)} onSubmit={submitLoss} />
      )}
      {notice && (
        <p
          role="status"
          className="border-border bg-muted/60 rounded-xl border px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}

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
            actions={actions}
            title={t("riskPage.withReading")}
            pageSize={PAGE_SIZE.reading}
            entries={entries
              .filter((e) => !["early", "none"].includes(groupOf(e.latest)))
              .sort((a, b) => SEVERITY[groupOf(a.latest)] - SEVERITY[groupOf(b.latest)])}
          />
          <PlantGroup
            actions={actions}
            title={t("early.level")}
            pageSize={PAGE_SIZE.early}
            entries={entries.filter((e) => groupOf(e.latest) === "early")}
          />
          <PlantGroup
            actions={actions}
            title={t("riskPage.withoutReading")}
            pageSize={PAGE_SIZE.none}
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

/**
 * A titled run of plant cards with its count, a page at a time; nothing at
 * all when empty.
 */
function PlantGroup({
  title,
  entries,
  pageSize,
  actions,
}: {
  title: string;
  entries: Entry[];
  pageSize: number;
  actions: CardActions;
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {title}
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
          {entries.length}
        </span>
      </h2>
      {/* Previous / Next slide the next page in from the side asked for,
          the same pager as the Harvest page. */}
      <SlidePager
        items={entries}
        pageSize={pageSize}
        getKey={(entry) => entry.plant.id}
        listLabel={title}
        listClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        itemClassName="flex min-w-0 flex-col"
        // Room for a card's hover lift and outline inside the clipping frame.
        frameClassName="-m-1 p-1"
        renderItem={(entry) => <PlantRiskCard entry={entry} actions={actions} />}
      />
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
function PlantRiskCard({ entry, actions }: { entry: Entry; actions: CardActions }) {
  const { plant, latest, previous } = entry;
  const { t, dateLocale } = useLanguage();
  const level = levelOf(latest);
  const group = groupOf(latest);
  const color = COLOR[group];
  // A plant with a verdict wears its level's colour on the whole card, so
  // it can be picked out at a glance; one still waiting stays plain.
  const assessed = group !== "none";
  const eligibility = plant.assessment_eligibility;
  const failed = latest?.risk?.status === "failed";
  const atRisk = group === "high" || group === "medium";
  // The first two things to do, on the card itself rather than behind the arrow.
  const todo = atRisk ? (latest?.risk?.recommended_actions ?? []).slice(0, 2) : [];
  // Getting worse or better since the reading before.
  const current = latest?.risk?.risk_level;
  const trend =
    previous && current && current in LEVEL_RANK && current !== previous
      ? LEVEL_RANK[current as Level] > LEVEL_RANK[previous]
        ? "up"
        : "down"
      : null;
  // How late this week's check is, once it opened.
  const overdue =
    eligibility.can_assess && !eligibility.early_recheck && eligibility.next_assessment_date
      ? daysSince(eligibility.next_assessment_date)
      : 0;
  const old = !!latest && daysSince(latest.assessment_date) > OLD_READING_DAYS;

  return (
    // The level's border is set through a variable, not inline, so the
    // crop-coloured outline (as on My Plants and Harvest) can replace it
    // while the card is pointed at or tapped.
    <div
      tabIndex={0}
      className={cn(
        "bg-card group relative flex flex-1 flex-col overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
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
        <CropIcon entry={entry} />
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
        {failed ? (
          <span className="border-risk-high/40 text-risk-high inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            <TriangleAlert className="size-3" />
            {t("riskCard.failed")}
          </span>
        ) : level ? (
          <RiskBadge size="sm" level={level} />
        ) : (
          <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium">
            <CircleHelp className="size-3" />
            {t("riskCounts.noReading")}
          </span>
        )}
        {trend && previous && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              trend === "up" ? "text-risk-high" : "text-risk-low",
            )}
            style={{ backgroundColor: tint(trend === "up" ? "var(--risk-high)" : "var(--risk-low)") }}
          >
            {trend === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {t("riskCard.was", { level: t(`riskBadge.${previous.toLowerCase()}` as MessageKey) })}
          </span>
        )}
        {overdue > 0 ? (
          <span
            className="text-risk-high inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: tint("var(--risk-high)") }}
          >
            <CalendarClock className="size-3" />
            {overdue === 1 ? t("riskCard.overdueOne") : t("riskCard.overdue", { n: overdue })}
          </span>
        ) : (
          eligibility.can_assess &&
          !eligibility.early_recheck && (
            <span
              className="text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: tint("var(--primary)") }}
            >
              <CalendarClock className="size-3" />
              {t("riskPage.dueNow")}
            </span>
          )
        )}
        {old && (
          <span
            className="text-risk-medium inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: tint("var(--risk-medium)") }}
          >
            <Clock className="size-3" />
            {t("riskCard.old")}
          </span>
        )}
      </div>

      {todo.length > 0 && latest && (
        <div className="mt-3 rounded-xl border border-dashed p-3 text-xs" style={{ borderColor: tint(color, 50) }}>
          <p className="font-medium">{t("riskCard.whatToDo")}</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4">
            {todo.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <Link
            href={`/farmer/assessments/${latest.id}`}
            className="mt-2 inline-flex items-center gap-1 font-medium"
            style={{ color: "var(--landing-accent)" }}
          >
            {t("riskCard.seeAll")}
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}

      {failed && latest && <RetryCheck assessmentId={latest.id} onDone={actions.onChanged} />}

      {eligibility.early_recheck && (
        <p className="text-muted-foreground mt-3 text-xs">{t("riskCard.earlyWhy")}</p>
      )}

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

      {/* Instead of deleting a plant that died: kept, with its history. */}
      <button
        type="button"
        onClick={() => actions.onLost(plant)}
        className={cn(
          "mt-2 self-start text-xs underline-offset-2 hover:underline",
          atRisk ? "text-risk-high font-medium" : "text-muted-foreground",
        )}
      >
        {t("lost.open")}
      </button>
    </div>
  );
}

/** A check the AI could not finish, run again on the saved answers and photo. */
function RetryCheck({ assessmentId, onDone }: { assessmentId: number; onDone: () => void }) {
  const { t } = useLanguage();
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function retry() {
    if (!accessToken || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await reanalyzeAssessment(accessToken, assessmentId);
      onDone();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : t("harvestCard.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-1">
      <Button size="sm" variant="outline" className="h-8 self-start text-xs" onClick={retry} disabled={busy}>
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
        {busy ? t("riskCard.retrying") : t("riskCard.retry")}
      </Button>
      {problem && <p className="text-risk-high text-xs">{problem}</p>}
    </div>
  );
}

/**
 * This week's check for one plant: a button when it is due, otherwise when
 * the next one opens. Straight from the server's `assessment_eligibility`,
 * so it offers only what the API will accept.
 */
function WeeklyCheck({ plant }: { plant: BackendPlant }) {
  const { t } = useLanguage();
  const { can_assess, days_remaining, early_recheck } = plant.assessment_eligibility;

  if (can_assess) {
    return (
      <Button
        size="sm"
        className="h-7 px-2.5 text-xs"
        nativeButton={false}
        render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
      >
        {early_recheck ? t("riskCard.early") : t("riskPage.assessNow")}
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
