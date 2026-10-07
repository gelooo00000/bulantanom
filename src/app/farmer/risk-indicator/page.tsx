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
  Search,
  SearchX,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { DonutChart } from "@/components/lgu/risk-pie";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { BackendPlant } from "@/lib/api/plants-api";
import { fetchFarmerRisk, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Entry = { plant: BackendPlant; latest: BackendAssessment | null };

/**
 * The page groups plants the way the overview chart does. A "Too Early" or
 * failed check is not a Low / Medium / High verdict, so it sits with the
 * plants that have no reading yet.
 */
type Group = "high" | "medium" | "low" | "none";
type TabKey = Group | "all";
type SortKey = "due" | "risk" | "name";

const GROUPS: { key: Group; label: MessageKey; color: string; icon: typeof Leaf }[] = [
  { key: "high", label: "riskBadge.high", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "medium", label: "riskBadge.medium", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "low", label: "riskBadge.low", color: "var(--risk-low)", icon: Leaf },
  { key: "none", label: "riskCounts.noReading", color: "var(--muted-foreground)", icon: CircleHelp },
];
const COLOR = Object.fromEntries(GROUPS.map((g) => [g.key, g.color])) as Record<Group, string>;
const RANK: Record<Group, number> = { high: 0, medium: 1, low: 2, none: 3 };

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
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("due");

  const entries: Entry[] = (data?.plants ?? []).map(({ plant, latest_assessment }) => ({
    plant,
    latest: latest_assessment,
  }));

  function narrow(group: TabKey) {
    const query = search.trim().toLowerCase();
    return entries
      .filter((e) => group === "all" || groupOf(e.latest) === group)
      .filter(
        (e) =>
          !query ||
          e.plant.display_name.toLowerCase().includes(query) ||
          e.plant.crop.name.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const byName = a.plant.display_name.localeCompare(b.plant.display_name);
        if (sort === "name") return byName;
        if (sort === "risk") return RANK[groupOf(a.latest)] - RANK[groupOf(b.latest)] || byName;
        // Due first: what can be assessed today, then the soonest to open.
        const ea = a.plant.assessment_eligibility;
        const eb = b.plant.assessment_eligibility;
        return (
          Number(eb.can_assess) - Number(ea.can_assess) ||
          ea.days_remaining - eb.days_remaining ||
          byName
        );
      });
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: t("riskPage.all") },
    ...GROUPS.map((g) => ({ key: g.key as TabKey, label: t(g.label) })),
  ];
  const countIn = (key: TabKey) =>
    key === "all" ? entries.length : entries.filter((e) => groupOf(e.latest) === key).length;

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
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <RiskBreakdown entries={entries} onSelect={(key) => setTab(key as TabKey)} />
            <WeeklyChecks entries={entries} />
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <TabsList className="max-w-full overflow-x-auto">
                {tabs.map((item) => (
                  <TabsTab key={item.key} value={item.key}>
                    {item.label}
                    <span className="text-muted-foreground ml-1.5 text-xs">{countIn(item.key)}</span>
                  </TabsTab>
                ))}
              </TabsList>

              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                    placeholder={t("riskPage.search")}
                    aria-label={t("riskPage.search")}
                    className="border-border bg-card focus-visible:ring-ring/50 h-9 w-full rounded-lg border pr-3 pl-9 text-sm focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label={t("riskPage.sort")}
                  className="border-border bg-card h-9 rounded-lg border px-3 text-sm"
                >
                  <option value="due">{t("riskPage.sortDue")}</option>
                  <option value="risk">{t("riskPage.sortRisk")}</option>
                  <option value="name">{t("riskPage.sortName")}</option>
                </select>
              </div>
            </div>

            {tabs.map((item) => {
              const rows = narrow(item.key);
              return (
                <TabsPanel key={item.key} value={item.key} className="flex flex-col gap-3">
                  {rows.length === 0 ? (
                    <EmptyState
                      icon={SearchX}
                      title={t("riskPage.noMatchTitle")}
                      description={t("riskPage.noMatchText")}
                    />
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {rows.map((entry) => (
                        <PlantRiskCard key={entry.plant.id} {...entry} />
                      ))}
                    </ul>
                  )}
                </TabsPanel>
              );
            })}
          </Tabs>

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
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <header>
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** Plants by their latest level: the donut for the share, labelled bars for the counts. */
function RiskBreakdown({
  entries,
  onSelect,
}: {
  entries: Entry[];
  onSelect: (key: string) => void;
}) {
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
        <DonutChart rows={rows} {...unit} name={t("riskPage.byLevel")} onSelectKey={onSelect} />
        <HorizontalBars rows={rows} {...unit} label={t("riskPage.byLevel")} onSelect={onSelect} />
      </div>
    </Panel>
  );
}

/** What can be assessed today, against the week as a whole, with the plants that are due. */
function WeeklyChecks({ entries }: { entries: Entry[] }) {
  const { t } = useLanguage();
  const total = entries.length;
  const due = entries.filter((e) => e.plant.assessment_eligibility.can_assess);
  // Waiting for next week after a check, versus newly planted / planned and
  // not open for a first check yet.
  const done = entries.filter(
    (e) =>
      !e.plant.assessment_eligibility.can_assess &&
      !e.plant.assessment_eligibility.too_young &&
      !e.plant.assessment_eligibility.planned,
  ).length;
  const notOpen = total - due.length - done;

  const rows = [
    { label: t("riskPage.dueNow"), count: due.length, color: "var(--primary)" },
    { label: t("riskPage.doneThisWeek"), count: done, color: "var(--risk-low)" },
    { label: t("riskPage.notOpen"), count: notOpen, color: "var(--muted-foreground)" },
  ];

  return (
    <Panel title={t("riskPage.thisWeek")} description={t("riskPage.thisWeekText")}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          {due.length > 0 && (
            <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          )}
          <span
            className={cn(
              "relative inline-flex size-3 rounded-full",
              due.length > 0 ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        </span>
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-4xl leading-none font-medium tabular-nums">
            {due.length}
          </span>
          <span className="text-muted-foreground text-sm">{t("riskPage.dueOf", { total })}</span>
        </p>
      </div>

      <ul className="flex flex-col gap-3" aria-label={t("riskPage.thisWeek")}>
        {rows.map(({ label, count, color }) => (
          <li key={label}>
            <div className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <span className="font-heading tabular-nums">
                {count}
                <span className="text-muted-foreground ml-1 text-xs font-normal">/ {total}</span>
              </span>
            </div>
            <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, backgroundColor: color }}
              />
            </div>
          </li>
        ))}
      </ul>

      {due.length > 0 ? (
        <div className="mt-auto flex items-center gap-2">
          <div className="flex -space-x-2">
            {due.slice(0, 6).map((e) => (
              <CropIcon key={e.plant.id} entry={e} size="sm" />
            ))}
          </div>
          {due.length > 6 && (
            <span className="text-muted-foreground text-xs">
              {t("riskPage.more", { n: due.length - 6 })}
            </span>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mt-auto text-xs">{t("riskPage.nothingDue")}</p>
      )}
    </Panel>
  );
}

/** The crop's emoji in a round chip tinted with the plant's level, like the Admin avatars. */
function CropIcon({
  entry,
  size = "md",
  showDue,
}: {
  entry: Entry;
  size?: "sm" | "md";
  showDue?: boolean;
}) {
  const color = COLOR[groupOf(entry.latest)];
  return (
    <span
      aria-hidden="true"
      title={entry.plant.display_name}
      className={cn(
        "ring-card relative flex shrink-0 items-center justify-center rounded-full ring-2",
        size === "sm" ? "size-8 text-sm" : "size-12 text-xl",
      )}
      style={{ backgroundColor: tint(color, 16) }}
    >
      {entry.plant.crop.emoji}
      {showDue && entry.plant.assessment_eligibility.can_assess && (
        <span className="border-card bg-primary absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2" />
      )}
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
  const color = COLOR[groupOf(latest)];

  return (
    <li className="border-border bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />

      <div className="flex items-start gap-3">
        <CropIcon entry={{ plant, latest }} showDue />
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
