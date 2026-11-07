"use client";

import {
  CalendarClock,
  ChevronDown,
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
import { SlidePager } from "@/components/shared/slide-pager";
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

/**
 * Cards per page in each section; the rest slide in with Next. The urgent
 * lists stay short so they fit on one screen; the long ones show more.
 */
const PAGE_SIZE: Record<HarvestPhase, number> = {
  open: 4,
  approaching: 4,
  passed: 4,
  growing: 6,
  harvested: 6,
};
/** Tasks in "What to do now" before "See more". */
const TODO_LIMIT = 3;

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

type TodoKind = "harvest" | "missed" | "prepare";
type Todo = { kind: TodoKind; text: string };

const TODO_STYLE: Record<TodoKind, { icon: LucideIcon; tone: string; row: string; section: HarvestPhase }> = {
  harvest: {
    icon: CircleCheck,
    tone: "text-risk-low",
    row: "border-risk-low/40 bg-risk-low/10 hover:bg-risk-low/15",
    section: "open",
  },
  missed: {
    icon: TriangleAlert,
    tone: "text-risk-high",
    row: "border-risk-high/40 bg-risk-high/10 hover:bg-risk-high/15",
    section: "passed",
  },
  prepare: {
    icon: CalendarClock,
    tone: "text-risk-medium",
    row: "border-risk-medium/40 bg-risk-medium/10 hover:bg-risk-medium/15",
    section: "approaching",
  },
};

/** Plain sentences, most urgent first: what the farmer should do today. */
function todoItems(plants: BackendPlant[], t: Translate): Todo[] {
  const items: Todo[] = [];
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
      items.push({
        kind: "harvest",
        text:
          toEnd === 0
            ? t("harvestTodo.lastDay", { name })
            : t("harvestTodo.harvest", { name, time: humanDuration(toEnd, t) }),
      });
    } else if (phase === "passed") {
      if (missedSaid.has(name)) continue;
      missedSaid.add(name);
      const n = missedCount.get(name) ?? 1;
      items.push({
        kind: "missed",
        text:
          n > 1
            ? t("harvestTodo.passedMany", { name, n })
            : t("harvestTodo.passed", { name, time: humanDuration(Math.abs(toEnd), t) }),
      });
    } else if (phase === "approaching") {
      items.push({
        kind: "prepare",
        text:
          toStart === 1
            ? t("harvestTodo.tomorrow", { name })
            : t("harvestTodo.prepare", { name, time: humanDuration(toStart, t) }),
      });
    }
  }
  return items;
}

/**
 * The most important part of the page, so it is the most prominent: large
 * text, each task coloured by urgency, and a tap on a task jumps to its
 * plants. A long list shows the first few and folds the rest behind
 * "See more".
 */
function TodoBox({ plants }: { plants: BackendPlant[] }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const items = todoItems(plants, t);
  const shown = expanded ? items : items.slice(0, TODO_LIMIT);
  const hidden = items.length - TODO_LIMIT;
  const next = plants
    .filter((p) => phaseOf(p) === "growing")
    .sort((a, b) => a.expected_harvest_start.localeCompare(b.expected_harvest_start))[0];

  return (
    <section
      aria-labelledby="harvest-todo-title"
      className="border-primary/40 bg-card flex flex-col gap-4 rounded-2xl border-2 px-4 py-5 shadow-sm sm:px-6"
    >
      <h2 id="harvest-todo-title" className="font-heading flex items-center gap-2.5 text-xl font-medium sm:text-2xl">
        <span className="bg-primary/15 text-primary flex size-9 items-center justify-center rounded-xl">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        {t("harvestTodo.title")}
        {items.length > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-sm tabular-nums">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-base">
          {next
            ? t("harvestTodo.nothing", {
                name: next.display_name,
                time: humanDuration(daysUntil(next.expected_harvest_start), t),
              })
            : t("harvestTodo.nothingAtAll")}
        </p>
      ) : (
        <>
          <ol className="flex flex-col gap-2.5">
            {shown.map((item, i) => {
              const style = TODO_STYLE[item.kind];
              const Icon = style.icon;
              return (
                <li key={item.text} className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <a
                    href={`#${SECTION_ID[style.section]}`}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                      style.row,
                    )}
                  >
                    <span className="bg-background/80 text-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <Icon className={cn("mt-0.5 size-5 shrink-0", style.tone)} aria-hidden="true" />
                    <span className="text-base leading-snug">{item.text}</span>
                  </a>
                </li>
              );
            })}
          </ol>
          {hidden > 0 && (
            <Button
              variant="outline"
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
    </section>
  );
}

function Section({
  phase,
  title,
  plants,
  onStatusChange,
}: {
  phase: HarvestPhase;
  title: string;
  plants: BackendPlant[];
  onStatusChange: (plant: BackendPlant, status: "GROWING" | "HARVESTED") => Promise<void>;
}) {
  if (plants.length === 0) return null;
  return (
    <section id={SECTION_ID[phase]} className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="text-lg">
        {title}{" "}
        <span className="text-muted-foreground font-sans text-sm font-normal">({plants.length})</span>
      </h2>
      {/* A page at a time; Previous / Next slide the next page in from the
          side asked for, the same pager as the dashboard lists. Side by side
          from tablet width up, one per row on a phone. */}
      <SlidePager
        items={plants}
        pageSize={PAGE_SIZE[phase]}
        getKey={(plant) => plant.id}
        listLabel={title}
        listClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        itemClassName="min-w-0"
        // Room for a card's hover outline inside the clipping frame.
        frameClassName="-m-1 p-1"
        renderItem={(plant) => <HarvestPlantCard plant={plant} onStatusChange={onStatusChange} />}
      />
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

          <Section phase="open" title={t("harvestPage.ready")} plants={open} onStatusChange={changeStatus} />
          <Section
            phase="approaching"
            title={t("harvestPage.approaching", { n: APPROACHING_WINDOW_DAYS })}
            plants={approaching}
            onStatusChange={changeStatus}
          />
          {/* Before "Still growing": a missed harvest needs a decision now. */}
          <Section phase="passed" title={t("harvestPage.passed")} plants={passed} onStatusChange={changeStatus} />
          <Section phase="growing" title={t("harvestPage.growing")} plants={growing} onStatusChange={changeStatus} />
          <Section
            phase="harvested"
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
