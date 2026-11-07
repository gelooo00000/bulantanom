"use client";

import {
  CalendarClock,
  CircleCheck,
  ClipboardList,
  LoaderCircle,
  Sprout,
  TriangleAlert,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { HarvestPlantCard } from "@/components/farmer/harvest-plant-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchPlants, setPlantStatus, type BackendPlant } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";
import { humanDuration } from "@/lib/duration";
import {
  APPROACHING_WINDOW_DAYS,
  daysUntil,
  phaseOf,
  sortByUrgency,
  type HarvestPhase,
} from "@/lib/harvest";
import { useLanguage, type Translate } from "@/lib/i18n";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { cn } from "@/lib/utils";

/** Cards shown per section before "Show all". */
const SECTION_PREVIEW = 6;
/** Lines in "What to do now" before "+n more below". */
const TODO_LIMIT = 4;

const SECTION_ID: Record<HarvestPhase, string> = {
  open: "harvest-ready",
  approaching: "harvest-soon",
  passed: "harvest-missed",
  growing: "harvest-growing",
  harvested: "harvest-done",
};

function OverviewTile({
  icon: Icon,
  label,
  count,
  tone,
  target,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: string;
  target: string;
}) {
  const body = (
    <>
      <Icon className={cn("size-5", count > 0 ? tone : "text-muted-foreground")} aria-hidden="true" />
      <p className={cn("font-heading text-3xl leading-none tabular-nums", count > 0 && tone)}>{count}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </>
  );
  const className =
    "border-border bg-card flex flex-col gap-2 rounded-xl border px-4 py-3.5 text-left transition-colors";
  // Jumps to its section when there is one to jump to.
  return count > 0 ? (
    <a href={`#${target}`} className={cn(className, "hover:bg-muted/60")}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Plain sentences, most urgent first: what the farmer should do today. */
function todoLines(plants: BackendPlant[], t: Translate): string[] {
  const lines: string[] = [];
  // Several missed plants of one kind read as one line, not a list of
  // near-identical reminders.
  const missedCount = new Map<string, number>();
  for (const plant of plants) {
    if (phaseOf(plant) === "passed") {
      missedCount.set(plant.display_name, (missedCount.get(plant.display_name) ?? 0) + 1);
    }
  }
  const missedSaid = new Set<string>();
  for (const plant of sortByUrgency(plants)) {
    const phase = phaseOf(plant);
    const name = plant.display_name;
    const toStart = daysUntil(plant.expected_harvest_start);
    const toEnd = daysUntil(plant.expected_harvest_end);
    if (phase === "open") {
      lines.push(
        toEnd === 0
          ? t("harvestTodo.lastDay", { name })
          : t("harvestTodo.harvest", { name, time: humanDuration(toEnd, t) }),
      );
    } else if (phase === "passed") {
      if (missedSaid.has(name)) continue;
      missedSaid.add(name);
      const n = missedCount.get(name) ?? 1;
      lines.push(
        n > 1
          ? t("harvestTodo.passedMany", { name, n })
          : t("harvestTodo.passed", { name, time: humanDuration(Math.abs(toEnd), t) }),
      );
    } else if (phase === "approaching") {
      lines.push(
        toStart === 1
          ? t("harvestTodo.tomorrow", { name })
          : t("harvestTodo.prepare", { name, time: humanDuration(toStart, t) }),
      );
    }
  }
  return lines;
}

function TodoBox({ plants }: { plants: BackendPlant[] }) {
  const { t } = useLanguage();
  const lines = todoLines(plants, t);
  const next = plants
    .filter((p) => phaseOf(p) === "growing")
    .sort((a, b) => a.expected_harvest_start.localeCompare(b.expected_harvest_start))[0];

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-xl border px-4 py-4 sm:px-5">
      <h2 className="font-heading flex items-center gap-2 text-base font-medium">
        <ClipboardList className="text-primary size-5" aria-hidden="true" />
        {t("harvestTodo.title")}
      </h2>
      {lines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {next
            ? t("harvestTodo.nothing", {
                name: next.display_name,
                time: humanDuration(daysUntil(next.expected_harvest_start), t),
              })
            : t("harvestTodo.nothingAtAll")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.slice(0, TODO_LIMIT).map((line, i) => (
            <li key={line} className="flex gap-2.5 text-sm">
              <span className="bg-primary/15 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
          {lines.length > TODO_LIMIT && (
            <li className="text-muted-foreground pl-7 text-xs">
              {t("harvestTodo.more", { n: lines.length - TODO_LIMIT })}
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

function Section({
  id,
  title,
  plants,
  onStatusChange,
}: {
  id: string;
  title: string;
  plants: BackendPlant[];
  onStatusChange: (plant: BackendPlant, status: "GROWING" | "HARVESTED") => Promise<void>;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  if (plants.length === 0) return null;
  const shown = expanded ? plants : plants.slice(0, SECTION_PREVIEW);

  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="text-lg">
        {title}{" "}
        <span className="text-muted-foreground font-sans text-sm font-normal">({plants.length})</span>
      </h2>
      {/* Side by side from tablet width up; one per row on a phone. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((plant) => (
          <HarvestPlantCard key={plant.id} plant={plant} onStatusChange={onStatusChange} />
        ))}
      </div>
      {plants.length > SECTION_PREVIEW && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("harvestPage.showFewer") : t("harvestPage.showAll", { n: plants.length })}
        </Button>
      )}
    </section>
  );
}

export default function HarvestPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchPlants);
  const { accessToken } = useAuth();
  const { t } = useLanguage();
  // Saved status changes, laid over the fetched list so marking a plant
  // harvested moves it at once, without reloading the whole page.
  const [updated, setUpdated] = useState<Record<number, BackendPlant>>({});

  const plants = (data ?? []).map((plant) => updated[plant.id] ?? plant);
  const sorted = [...plants].sort((a, b) =>
    a.expected_harvest_start.localeCompare(b.expected_harvest_start),
  );
  const byPhase = (phase: HarvestPhase) => sortByUrgency(sorted.filter((p) => phaseOf(p) === phase));
  const open = byPhase("open");
  const approaching = byPhase("approaching");
  const passed = byPhase("passed");
  const growing = byPhase("growing");
  const harvested = byPhase("harvested");

  async function changeStatus(plant: BackendPlant, status: "GROWING" | "HARVESTED") {
    if (!accessToken) throw new Error("Not signed in.");
    const saved = await setPlantStatus(accessToken, plant.id, status);
    setUpdated((current) => ({ ...current, [plant.id]: saved }));
    requestNotificationRefresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("harvestPage.title")} description={t("harvestPage.description")} />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("harvestPage.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="font-heading text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Wheat} title={t("riskPage.emptyTitle")} description={t("harvestPage.emptyText")} />
      ) : (
        <>
          {/* The four numbers a farmer asks first; each jumps to its list. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <OverviewTile
              icon={CircleCheck}
              label={t("harvestOverview.readyNow")}
              count={open.length}
              tone="text-risk-low"
              target={SECTION_ID.open}
            />
            <OverviewTile
              icon={CalendarClock}
              label={t("harvestOverview.thisWeek")}
              count={approaching.length}
              tone="text-risk-medium"
              target={SECTION_ID.approaching}
            />
            <OverviewTile
              icon={TriangleAlert}
              label={t("harvestOverview.missed")}
              count={passed.length}
              tone="text-risk-high"
              target={SECTION_ID.passed}
            />
            <OverviewTile
              icon={Sprout}
              label={t("harvestOverview.growing")}
              count={growing.length}
              tone="text-primary"
              target={SECTION_ID.growing}
            />
          </div>

          <TodoBox plants={sorted} />

          <Section id={SECTION_ID.open} title={t("harvestPage.ready")} plants={open} onStatusChange={changeStatus} />
          <Section
            id={SECTION_ID.approaching}
            title={t("harvestPage.approaching", { n: APPROACHING_WINDOW_DAYS })}
            plants={approaching}
            onStatusChange={changeStatus}
          />
          {/* Before "Still growing": a missed harvest needs a decision now. */}
          <Section id={SECTION_ID.passed} title={t("harvestPage.passed")} plants={passed} onStatusChange={changeStatus} />
          <Section id={SECTION_ID.growing} title={t("harvestPage.growing")} plants={growing} onStatusChange={changeStatus} />
          <Section
            id={SECTION_ID.harvested}
            title={t("harvestPage.harvested")}
            plants={harvested}
            onStatusChange={changeStatus}
          />

          <p className="text-muted-foreground text-xs">{t("harvestPage.note")}</p>
        </>
      )}
    </div>
  );
}
