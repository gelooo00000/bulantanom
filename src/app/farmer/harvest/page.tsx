"use client";

import { Popover } from "@base-ui/react/popover";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  LoaderCircle,
  Sprout,
  TriangleAlert,
  Wheat,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { HarvestPlantCard } from "@/components/farmer/harvest-plant-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HarvestCelebration } from "@/components/farmer/harvest-celebration";
import { SlidePager } from "@/components/shared/slide-pager";
import { Button } from "@/components/ui/button";
import {
  fetchPlants,
  harvestPlant,
  setPlantStatus,
  type BackendPlant,
  type HarvestAnswers,
} from "@/lib/api/plants-api";
import { HarvestReportDialog } from "@/components/farmer/harvest-report-dialog";
import { LostPlantCard } from "@/components/farmer/lost-plant-card";
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
 * "What to do now", in a popup so it takes no room on the page: it opens
 * from the checklist icon beside the title, by pointing at it or tapping
 * it, like the light-bulb tips. The red count on the icon says how many
 * tasks are waiting. A long list shows the first few and folds the rest
 * behind "See more"; tapping a task jumps to its plants.
 */
function TodoButton({ plants }: { plants: BackendPlant[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const items = todoItems(plants, t);
  const shown = expanded ? items : items.slice(0, TODO_LIMIT);
  const hidden = items.length - TODO_LIMIT;
  const next = plants
    .filter((p) => phaseOf(p) === "growing")
    .sort((a, b) => a.expected_harvest_start.localeCompare(b.expected_harvest_start))[0];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={
          items.length > 0
            ? `${t("harvestTodo.title")} (${items.length})`
            : t("harvestTodo.title")
        }
        className={cn(
          // Solid when something is waiting, so it is hard to miss.
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
            {/* A soft pulse behind the count; none under reduced motion. */}
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
            aria-labelledby="harvest-todo-title"
            className="bg-popover text-popover-foreground border-primary/40 flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-2xl border-2 px-4 py-4 shadow-xl"
          >
            <h2 id="harvest-todo-title" className="font-heading flex items-center gap-2 text-lg font-medium">
              <ClipboardList className="text-primary size-5" aria-hidden="true" />
              {t("harvestTodo.title")}
              {items.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                  {items.length}
                </span>
              )}
            </h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {next
                  ? t("harvestTodo.nothing", {
                      name: next.display_name,
                      time: humanDuration(daysUntil(next.expected_harvest_start), t),
                    })
                  : t("harvestTodo.nothingAtAll")}
              </p>
            ) : (
              <>
                <ol className="flex flex-col gap-2">
                  {shown.map((item, i) => {
                    const style = TODO_STYLE[item.kind];
                    const Icon = style.icon;
                    return (
                      <li key={item.text} className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <a
                          href={`#${SECTION_ID[style.section]}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                            style.row,
                          )}
                        >
                          <span className="bg-background/80 text-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                            {i + 1}
                          </span>
                          <Icon className={cn("mt-0.5 size-4 shrink-0", style.tone)} aria-hidden="true" />
                          <span className="text-sm leading-snug">{item.text}</span>
                        </a>
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

/** Harvested plants, most recently harvested first. */
function archiveOrder(plants: BackendPlant[]): BackendPlant[] {
  return [...plants].sort((a, b) => (b.harvested_at ?? "").localeCompare(a.harvested_at ?? ""));
}

export default function HarvestPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchPlants);
  const { accessToken } = useAuth();
  const { t } = useLanguage();
  // Saved status changes, laid over the fetched list so marking a plant
  // harvested moves it at once, without reloading the whole page.
  const [updated, setUpdated] = useState<Record<number, BackendPlant>>({});
  const [view, setView] = useState<"active" | "archive">("active");
  // The plant just moved, for the "Moved to the Archive · Undo" banner.
  const [moved, setMoved] = useState<{ plant: BackendPlant; to: "archive" | "active" } | null>(
    null,
  );
  // The plant just harvested, for the confetti-and-balloons moment.
  const [celebrating, setCelebrating] = useState<BackendPlant | null>(null);
  const closeCelebration = useCallback(() => setCelebrating(null), []);
  // The plant whose harvest report (final assessment) is being filled in.
  const [reporting, setReporting] = useState<BackendPlant | null>(null);

  const everyPlant = (data ?? []).map((plant) => updated[plant.id] ?? plant);
  // Lost plants have no harvest coming: they appear only in the Archive's Lost list.
  const plants = everyPlant.filter((plant) => plant.status !== "LOST");
  const lost = everyPlant
    .filter((plant) => plant.status === "LOST")
    .sort((a, b) => (b.loss_report?.lost_at ?? "").localeCompare(a.loss_report?.lost_at ?? ""));
  const sorted = [...plants].sort((a, b) =>
    a.expected_harvest_start.localeCompare(b.expected_harvest_start),
  );
  const byPhase = (phase: HarvestPhase) => sortByUrgency(sorted.filter((p) => phaseOf(p) === phase));
  const open = byPhase("open");
  const approaching = byPhase("approaching");
  const passed = byPhase("passed");
  const growing = byPhase("growing");
  const archived = archiveOrder(byPhase("harvested"));

  async function changeStatus(plant: BackendPlant, status: "GROWING" | "HARVESTED") {
    // Harvesting asks for the harvest report first; it is saved from there.
    if (status === "HARVESTED") {
      setReporting(plant);
      return;
    }
    if (!accessToken) throw new Error("Not signed in.");
    const saved = await setPlantStatus(accessToken, plant.id, status);
    setUpdated((current) => ({ ...current, [plant.id]: saved }));
    // A loss undone is just back in the lists; its banner's "Undo" would
    // open a harvest report, which is not what was undone.
    setMoved(plant.status === "LOST" ? null : { plant: saved, to: "active" });
    requestNotificationRefresh();
  }

  async function submitReport(answers: HarvestAnswers) {
    if (!reporting || !accessToken) throw new Error("Not signed in.");
    const saved = await harvestPlant(accessToken, reporting.id, answers);
    setUpdated((current) => ({ ...current, [saved.id]: saved }));
    setReporting(null);
    setMoved({ plant: saved, to: "archive" });
    setCelebrating(saved);
    requestNotificationRefresh();
  }

  async function undoMove() {
    if (!moved) return;
    const { plant, to } = moved;
    setMoved(null);
    if (to === "active") {
      // Harvesting again means a new harvest report.
      setReporting(plant);
      return;
    }
    try {
      await changeStatus(plant, "GROWING");
    } catch {
      // The card's own Restore button is still there to try again.
    }
  }

  function showView(next: "active" | "archive") {
    setView(next);
    setMoved(null);
    setCelebrating(null);
  }

  const archiveButton = (
    <Button
      variant={view === "archive" ? "default" : "outline"}
      onClick={() => showView(view === "archive" ? "active" : "archive")}
      aria-pressed={view === "archive"}
    >
      <Archive className="size-4" />
      {t("archive.button")}
      <span className="bg-muted text-foreground rounded-full px-1.5 text-xs tabular-nums">
        {archived.length + lost.length}
      </span>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {celebrating && <HarvestCelebration plant={celebrating} onClose={closeCelebration} />}
      {reporting && (
        <HarvestReportDialog
          plant={reporting}
          onCancel={() => setReporting(null)}
          onSubmit={submitReport}
        />
      )}
      <PageHeader
        title={view === "archive" ? t("archive.title") : t("harvestPage.title")}
        description={view === "archive" ? t("archive.description") : t("harvestPage.description")}
        titleAside={
          view === "active" && data && data.length > 0 ? <TodoButton plants={sorted} /> : undefined
        }
        action={data && data.length > 0 ? archiveButton : undefined}
      />

      {/* Says where a plant just went, with a one-tap undo. */}
      {moved && (
        <div
          role="status"
          className="border-risk-low/40 bg-risk-low/10 animate-in fade-in slide-in-from-top-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm"
        >
          <CircleCheck className="text-risk-low size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {moved.to === "archive"
              ? t("archive.moved", { name: moved.plant.display_name })
              : t("archive.restored", { name: moved.plant.display_name })}
          </span>
          <Button size="sm" variant="outline" onClick={undoMove}>
            <Undo2 className="size-3.5" />
            {t("archive.undo")}
          </Button>
          {moved.to === "archive" && view === "active" && (
            <Button size="sm" variant="ghost" onClick={() => showView("archive")}>
              {t("archive.view")}
            </Button>
          )}
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setMoved(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

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
      ) : sorted.length === 0 && lost.length === 0 ? (
        <EmptyState icon={Wheat} title={t("riskPage.emptyTitle")} description={t("harvestPage.emptyText")} />
      ) : view === "archive" ? (
        <>
          <Button variant="ghost" className="-ml-2 self-start" onClick={() => showView("active")}>
            <ArrowLeft className="size-4" />
            {t("archive.back")}
          </Button>
          {archived.length + lost.length === 0 ? (
            <EmptyState icon={Archive} title={t("archive.emptyTitle")} description={t("archive.emptyText")} />
          ) : (
            <>
              <Section
                phase="harvested"
                title={t("harvestPage.harvested")}
                plants={archived}
                onStatusChange={changeStatus}
              />
              {lost.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="text-lg">
                    {t("lost.section")}{" "}
                    <span className="text-muted-foreground font-sans text-sm font-normal">
                      ({lost.length})
                    </span>
                  </h2>
                  <ul aria-label={t("lost.section")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {lost.map((plant) => (
                      <li key={plant.id} className="min-w-0">
                        <LostPlantCard plant={plant} onRestore={() => changeStatus(plant, "GROWING")} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
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
          {/* Harvested plants live in the Archive (button above), not here. */}

          <p className="text-muted-foreground text-xs">{t("harvestPage.note")}</p>
        </>
      )}
    </div>
  );
}
