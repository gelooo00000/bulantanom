"use client";

import { Popover } from "@base-ui/react/popover";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  Clock,
  HeartCrack,
  Leaf,
  Lightbulb,
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
import type { BadgeLevel } from "@/components/risk/risk-badge";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SlidePager } from "@/components/shared/slide-pager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reportPlantLost, type BackendPlant, type LossAnswers } from "@/lib/api/plants-api";
import {
  fetchFarmerRisk,
  reanalyzeAssessment,
  type BackendAssessment,
} from "@/lib/api/risk-api";
import { useAuth } from "@/lib/auth/auth-context";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CARD_OUTLINE, CROP_OUTLINE, cropTint, cropVar } from "@/lib/crop-colors";
import { useLanguage, type MessageKey, type Translate } from "@/lib/i18n";
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
/** GROUPS is already worst first, so its order is the sort key. */
const SEVERITY = Object.fromEntries(GROUPS.map((g, i) => [g.key, i])) as Record<Group, number>;


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
      <PageHeader
        title={t("riskPage.title")}
        description={t("riskPage.description")}
        titleAside={entries.length > 0 ? <RiskTodoButton entries={entries} /> : undefined}
      />

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
            icon={Activity}
            color="var(--risk-high)"
            pageSize={PAGE_SIZE.reading}
            entries={entries
              .filter((e) => !["early", "none"].includes(groupOf(e.latest)))
              .sort((a, b) => SEVERITY[groupOf(a.latest)] - SEVERITY[groupOf(b.latest)])}
          />
          <PlantGroup
            actions={actions}
            title={t("early.level")}
            icon={Clock}
            color="var(--risk-early)"
            pageSize={PAGE_SIZE.early}
            entries={entries.filter((e) => groupOf(e.latest) === "early")}
          />
          <PlantGroup
            actions={actions}
            title={t("riskPage.withoutReading")}
            icon={CircleHelp}
            color="var(--primary)"
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
  icon: GroupIcon,
  color,
}: {
  title: string;
  entries: Entry[];
  pageSize: number;
  actions: CardActions;
  icon: typeof Leaf;
  color: string;
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="font-heading flex items-center gap-2 text-lg sm:text-xl">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ color, backgroundColor: `color-mix(in oklch, ${color}, transparent 85%)` }}
        >
          <GroupIcon className="size-4" />
        </span>
        {title}
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-sans text-sm tabular-nums">
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

/** The first weekly check opens when a plant is this many days old. */
const FIRST_CHECK_AGE_DAYS = 7;

/** Days a due weekly check has been waiting (0 when not late, or an early re-check). */
function overdueDays(plant: BackendPlant): number {
  const e = plant.assessment_eligibility;
  if (!e.can_assess || e.early_recheck) return 0;
  if (e.next_assessment_date) return Math.max(0, daysSince(e.next_assessment_date));
  // Never checked: the first check was due a week after planting.
  if (!e.last_assessment_date) return Math.max(0, plant.age_days - FIRST_CHECK_AGE_DAYS);
  return 0;
}

type RiskTodoKind = "urgent" | "warn" | "due";
type RiskTodo = { kind: RiskTodoKind; text: string; href: string; rank: number };

const RISK_TODO_STYLE: Record<RiskTodoKind, { icon: typeof Leaf; tone: string; row: string }> = {
  urgent: {
    icon: OctagonAlert,
    tone: "text-risk-high",
    row: "border-risk-high/40 bg-risk-high/10 hover:bg-risk-high/15",
  },
  warn: {
    icon: TriangleAlert,
    tone: "text-risk-medium",
    row: "border-risk-medium/40 bg-risk-medium/10 hover:bg-risk-medium/15",
  },
  due: {
    icon: CalendarClock,
    tone: "text-risk-low",
    row: "border-risk-low/40 bg-risk-low/10 hover:bg-risk-low/15",
  },
};

/** At most this many tasks show before "See more". */
const RISK_TODO_LIMIT = 3;

/**
 * One task per plant, from its risk reading and weekly-check state - the
 * most urgent reason only - with the most urgent plants first.
 */
function riskTodos(entries: Entry[], t: Translate): RiskTodo[] {
  const items: RiskTodo[] = [];
  for (const { plant, latest } of entries) {
    const group = groupOf(latest);
    const e = plant.assessment_eligibility;
    const name = plant.display_name;
    const check = `/farmer/plants/${plant.id}/assessment`;
    const details = latest ? `/farmer/assessments/${latest.id}` : check;
    const overdue = overdueDays(plant);

    if (latest?.risk?.status === "failed") {
      items.push({ kind: "urgent", rank: 0, text: t("riskTodo.failed", { name }), href: details });
    } else if (group === "high" && e.can_assess) {
      items.push({ kind: "urgent", rank: 1, text: t("riskTodo.highCheck", { name }), href: check });
    } else if (overdue > 0) {
      items.push({
        kind: "urgent",
        rank: 2,
        text: t("riskTodo.overdue", { name, n: overdue }),
        href: check,
      });
    } else if (group === "high") {
      items.push({ kind: "urgent", rank: 3, text: t("riskTodo.highFollow", { name }), href: details });
    } else if (e.early_recheck) {
      items.push({ kind: "warn", rank: 4, text: t("riskTodo.early", { name }), href: check });
    } else if (group === "medium") {
      items.push({ kind: "warn", rank: 5, text: t("riskTodo.medium", { name }), href: details });
    } else if (e.can_assess) {
      items.push({ kind: "due", rank: 6, text: t("riskTodo.due", { name }), href: check });
    }
  }
  return items.sort((a, b) => a.rank - b.rank);
}

/**
 * "What to do now" beside the page title, as on the Harvest page: a list
 * icon with a pulsing count, opening on hover or tap. Each task is one plain
 * sentence from the risk readings and weekly checks; tapping it goes to the
 * check or the reading.
 */
function RiskTodoButton({ entries }: { entries: Entry[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const items = riskTodos(entries, t);
  const shown = expanded ? items : items.slice(0, RISK_TODO_LIMIT);
  const hidden = items.length - RISK_TODO_LIMIT;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={items.length > 0 ? `${t("riskTodo.title")} (${items.length})` : t("riskTodo.title")}
        className={cn(
          items.length > 0
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            : "bg-primary/10 text-primary hover:bg-primary/20",
          "relative flex size-11 shrink-0 items-center justify-center rounded-xl transition-all",
          "hover:scale-105 data-[popup-open]:scale-105",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        )}
      >
        <ClipboardList className="size-6" aria-hidden="true" />
        {items.length > 0 && (
          <span className="absolute -top-2 -right-2 flex size-[22px]">
            <span className="bg-risk-high absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" />
            <span className="bg-risk-high ring-background relative flex size-[22px] items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums ring-2">
              {items.length}
            </span>
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            aria-labelledby="risk-todo-title"
            className="bg-popover text-popover-foreground border-primary/40 flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-2xl border-2 px-4 py-4 shadow-xl"
          >
            <h2 id="risk-todo-title" className="font-heading flex items-center gap-2 text-lg font-medium">
              <ClipboardList className="text-primary size-5" aria-hidden="true" />
              {t("riskTodo.title")}
              {items.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                  {items.length}
                </span>
              )}
            </h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("riskTodo.nothing")}</p>
            ) : (
              <>
                <ol className="flex flex-col gap-2">
                  {shown.map((item, i) => {
                    const style = RISK_TODO_STYLE[item.kind];
                    const ItemIcon = style.icon;
                    return (
                      <li key={item.text} className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                            style.row,
                          )}
                        >
                          <span className="bg-background/80 text-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                            {i + 1}
                          </span>
                          <ItemIcon className={cn("mt-0.5 size-4 shrink-0", style.tone)} aria-hidden="true" />
                          <span className="text-sm leading-snug">{item.text}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
                {hidden > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-center"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? t("harvestTodo.seeLess") : t("harvestTodo.seeMore", { n: hidden })}
                    <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </Button>
                )}
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Per group: the pill, the headline colour and the card's accent, as on the Harvest cards. */
const GROUP_STYLE: Record<
  Group,
  { pill: string; text: string; headline: MessageKey; accent: string; tile: string }
> = {
  high: {
    pill: "bg-risk-high/15 text-risk-high border-risk-high/30",
    text: "text-risk-high",
    headline: "riskCard.headline.high",
    accent: "var(--risk-high)",
    tile: "ring-2 ring-risk-high/45",
  },
  medium: {
    pill: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
    text: "text-risk-medium",
    headline: "riskCard.headline.medium",
    accent: "var(--risk-medium)",
    tile: "ring-2 ring-risk-medium/45",
  },
  low: {
    pill: "bg-risk-low/15 text-risk-low border-risk-low/30",
    text: "text-risk-low",
    headline: "riskCard.headline.low",
    accent: "var(--risk-low)",
    tile: "ring-2 ring-risk-low/45",
  },
  early: {
    pill: "border-border text-muted-foreground",
    text: "text-foreground",
    headline: "riskCard.headline.earlyNext",
    accent: "var(--risk-early)",
    tile: "",
  },
  none: {
    pill: "border-dashed border-border text-muted-foreground",
    text: "text-muted-foreground",
    headline: "riskCard.headline.noneNext",
    accent: "var(--primary)",
    tile: "",
  },
};

/** An ISO date (YYYY-MM-DD) moved by whole days. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The weekly check as a timeline, the twin of the Harvest card's: the last
 * check (or planting) on the left, the next check on the right, and today
 * marked between them. Full and red once the check is overdue.
 */
function CheckTimeline({
  plant,
  latest,
  accent,
  overdue,
}: {
  plant: BackendPlant;
  latest: BackendAssessment | null;
  accent: string;
  overdue: number;
}) {
  const { t, dateLocale } = useLanguage();
  const e = plant.assessment_eligibility;
  const short = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale, { month: "short", day: "numeric" });

  const checked = latest?.assessment_date ?? e.last_assessment_date;
  const start = checked ?? plant.planting_date;
  const next = e.next_assessment_date ?? addDays(start, checked ? e.interval_days || 7 : 7);
  const span = Math.max(1, daysSince(start) - daysSince(next));
  const due = e.can_assess && !e.early_recheck;
  const todayAt = due ? 100 : Math.min(100, Math.max(0, (daysSince(start) / span) * 100));
  const daysLeft = Math.max(0, -daysSince(next));
  const fill = overdue > 0 ? "var(--risk-high)" : due ? "var(--primary)" : accent;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-foreground/75 flex items-baseline justify-between gap-2 text-[13px]">
        <span>{t("riskTimeline.title")}</span>
        <span
          className={cn(
            "font-heading text-sm tabular-nums",
            overdue > 0 ? "text-risk-high" : due ? "text-primary" : "text-foreground",
          )}
        >
          {due
            ? t("riskPage.dueNow")
            : daysLeft === 1
              ? t("riskPage.nextInOne")
              : t("riskPage.nextIn", { n: daysLeft })}
        </span>
      </div>

      <div className="relative mt-5 h-2.5 w-full rounded-full" aria-hidden="true">
        <div className="bg-muted absolute inset-0 rounded-full" />
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-85 transition-[width] duration-700"
          style={{
            width: `${todayAt}%`,
            background: `linear-gradient(90deg, color-mix(in oklch, ${fill}, transparent 55%), ${fill})`,
          }}
        />
        <div
          className="absolute -top-5 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${Math.min(96, Math.max(4, todayAt))}%` }}
        >
          <span className="text-foreground text-[10px] leading-none font-medium">
            {t("harvestCard.today")}
          </span>
          <span className="bg-foreground mt-0.5 h-5 w-0.5 rounded-full" />
        </div>
      </div>

      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[11px] leading-tight">
        <div>
          <p>{checked ? t("riskTimeline.lastCheck") : t("harvestCard.planted")}</p>
          <p className="text-foreground font-medium">{short(start)}</p>
        </div>
        <div className="text-right">
          <p>{checked ? t("riskTimeline.nextCheck") : t("riskTimeline.firstCheck")}</p>
          <p className={cn("font-medium", overdue > 0 ? "text-risk-high" : "text-foreground")}>
            {short(next)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * One plant, laid out like a Harvest card: the crop and name, its level as a
 * pill, one plain sentence, the weekly-check timeline, what to do, and the
 * actions along the bottom. The full explanation and photo stay behind the
 * arrow.
 */
function PlantRiskCard({ entry, actions }: { entry: Entry; actions: CardActions }) {
  const { plant, latest, previous } = entry;
  const { t } = useLanguage();
  const level = levelOf(latest);
  const group = groupOf(latest);
  const style = GROUP_STYLE[group];
  const Icon = GROUPS.find((g) => g.key === group)!.icon;
  const failed = latest?.risk?.status === "failed";
  const atRisk = group === "high" || group === "medium";
  // Just the first thing to do; the arrow opens the rest.
  const todo = atRisk ? (latest?.risk?.recommended_actions ?? []).slice(0, 1) : [];
  const current = latest?.risk?.risk_level;
  const trend =
    previous && current && current in LEVEL_RANK && current !== previous
      ? LEVEL_RANK[current as Level] > LEVEL_RANK[previous]
        ? "up"
        : "down"
      : null;
  const overdue = overdueDays(plant);
  const old = !!latest && daysSince(latest.assessment_date) > OLD_READING_DAYS;
  const accent = failed ? "var(--risk-high)" : style.accent;
  const hasPill = failed || (level && level !== "inconclusive");

  return (
    <Card
      id={`risk-plant-${plant.id}`}
      style={cropVar(plant.crop.name)}
      className={cn(
        "relative isolate h-full min-w-0 scroll-mt-24 gap-2 overflow-hidden py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        CROP_OUTLINE,
      )}
      data-group={group}
    >
      {/* A soft wash of the level's colour across the top of the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, color-mix(in oklch, ${accent}, transparent ${
            atRisk || failed ? 78 : 88
          }%), transparent 70%)`,
        }}
      />
      <CardContent className="flex h-full flex-col gap-3.5 px-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="relative shrink-0">
              <span
                aria-hidden="true"
                className={cn(
                  "ring-offset-card flex size-11 items-center justify-center rounded-xl text-2xl leading-none ring-offset-2",
                  !failed && style.tile,
                  failed && "ring-risk-high/45 ring-2",
                )}
                style={{ backgroundColor: cropTint(plant.crop.name) }}
              >
                {plant.crop.emoji}
              </span>
              {(atRisk || failed) && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-3">
                  {(group === "high" || failed) && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                  <span
                    className="ring-card relative size-3 rounded-full ring-2"
                    style={{ backgroundColor: accent }}
                  />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="font-heading line-clamp-2 text-[17px] leading-snug break-words">
                {plant.display_name}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {/* The crop, unless the name already is the crop (no variety). */}
                {plant.display_name !== plant.crop.name && `${plant.crop.name} · `}
                {t("row.day", { n: plant.age_days })}
              </p>
            </div>
          </div>
          <div className="flex max-w-[55%] shrink-0 items-start gap-1.5">
            {/* Only a real level (or a failed check) gets a pill: "Too early"
                and "No reading" cards sit under a section that already says so. */}
            {hasPill && (
              <span
                className={cn(
                  "font-heading flex items-center gap-1 rounded-2xl border px-2.5 py-0.5 text-center text-xs font-medium tracking-wide",
                  failed ? "bg-risk-high/15 text-risk-high border-risk-high/30" : style.pill,
                )}
              >
                {failed ? (
                  <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Icon className="size-3 shrink-0" aria-hidden="true" />
                )}
                {failed ? t("riskCard.failed") : t(`riskBadge.${level}` as MessageKey)}
              </span>
            )}
            {latest && (
              <Link
                href={`/farmer/assessments/${latest.id}`}
                aria-label={`${t("riskPage.details")}: ${plant.display_name}`}
                title={t("riskPage.details")}
                className="text-muted-foreground hover:text-foreground hover:bg-muted -m-0.5 rounded-lg p-1 transition-colors"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        {/* The answer first, in one plain sentence; then what changed. */}
        <div className="flex flex-col gap-1">
          <p
            className={cn(
              "font-heading flex items-center gap-1.5 text-[15px] font-medium",
              failed ? "text-risk-high" : style.text,
            )}
          >
            {failed ? (
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Icon className="size-4 shrink-0" aria-hidden="true" />
            )}
            {t(
              failed
                ? "riskCard.headline.failed"
                : group === "early" && overdue > 0
                  ? "riskCard.headline.earlyDue"
                  : style.headline,
            )}
          </p>
          {trend && previous && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                trend === "up" ? "text-risk-high" : "text-risk-low",
              )}
            >
              {trend === "up" ? (
                <TrendingUp className="size-3.5 shrink-0" />
              ) : (
                <TrendingDown className="size-3.5 shrink-0" />
              )}
              {t("riskCard.was", { level: t(`riskBadge.${previous.toLowerCase()}` as MessageKey) })}
            </p>
          )}
          {overdue > 0 && (
            <p className="text-risk-high flex items-center gap-1.5 text-xs font-medium">
              <CalendarClock className="size-3.5 shrink-0" />
              {overdue === 1 ? t("riskCard.overdueOne") : t("riskCard.overdue", { n: overdue })}
            </p>
          )}
          {/* "Overdue" already says to check it; "old reading" only otherwise. */}
          {old && overdue === 0 && (
            <p className="text-risk-medium flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5 shrink-0" />
              {t("riskCard.old")}
            </p>
          )}
        </div>

        {!failed && <CheckTimeline plant={plant} latest={latest} accent={accent} overdue={overdue} />}

        {todo.length > 0 && (
          <div
            className={cn(
              "flex gap-2.5 rounded-xl border border-l-4 p-3 text-sm",
              group === "high"
                ? "border-risk-high/30 border-l-risk-high bg-risk-high/5"
                : "border-risk-medium/30 border-l-risk-medium bg-risk-medium/5",
            )}
          >
            <Lightbulb
              className={cn(
                "mt-0.5 size-4 shrink-0",
                group === "high" ? "text-risk-high" : "text-risk-medium",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-medium">{t("riskCard.whatToDo")}</p>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[13px]">{todo[0]}</p>
            </div>
          </div>
        )}

        {failed && latest && <RetryCheck assessmentId={latest.id} onDone={actions.onChanged} />}

        <div className="border-border mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <WeeklyCheck plant={plant} showNext={failed} />
          {/* Instead of deleting a plant that died: kept, with its history.
              Shaped like Assess now, in red; a deeper red when pointed at. */}
          <Button
            type="button"
            size="sm"
            onClick={() => actions.onLost(plant)}
            // The default button paints a green gradient; this one is red,
            // turning a deeper red when pointed at.
            className="border-risk-high focus-visible:ring-risk-high/40 ml-auto h-7 bg-[linear-gradient(135deg,var(--risk-high)_0%,color-mix(in_oklch,var(--risk-high),black_30%)_140%)] px-2.5 text-xs text-white shadow-[0_6px_18px_-6px_color-mix(in_oklch,var(--risk-high),transparent_40%)] hover:shadow-[0_10px_24px_-6px_color-mix(in_oklch,var(--risk-high),transparent_25%)] hover:brightness-90"
          >
            <HeartCrack className="size-3.5" />
            {t("lost.open")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
 * the next one opens (only where no timeline already says so). Straight from the server's `assessment_eligibility`,
 * so it offers only what the API will accept.
 */
function WeeklyCheck({ plant, showNext }: { plant: BackendPlant; showNext: boolean }) {
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
  if (!showNext) return null;
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <CalendarClock className="size-3.5" />
      {days_remaining === 1 ? t("riskPage.nextInOne") : t("riskPage.nextIn", { n: days_remaining })}
    </span>
  );
}
