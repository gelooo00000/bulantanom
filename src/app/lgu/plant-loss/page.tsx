"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  BellRing,
  Bug,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudLightning,
  HeartCrack,
  Layers,
  OctagonAlert,
  Sprout,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { AuthedImage } from "@/components/shared/authed-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchLguPlantLosses, type PlantLoss, type PlantLosses } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cropVar } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "CALAMITY" | "NOT_SAVED" | "PEST_DISEASE" | "OTHER";

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/** Each group's colour: storms in blue, a lost High-risk plant in red. */
const COLOR = {
  calamity: "var(--risk-early)",
  notSaved: "var(--risk-high)",
  pestDisease: "var(--risk-medium)",
  other: "var(--muted-foreground)",
  all: "var(--primary)",
};

/** Each cause's colour in the breakdown bar: its group's colour, the second of a pair lighter. */
const CAUSE_COLOR: Record<string, string> = {
  FLOOD_TYPHOON: COLOR.calamity,
  DROUGHT_HEAT: tint(COLOR.calamity, 55),
  PEST: COLOR.pestDisease,
  DISEASE: tint(COLOR.pestDisease, 55),
  ANIMALS: COLOR.other,
  OTHER: tint(COLOR.other, 50),
};

const PAGE_SIZE = 8;

/** A loss's colour: a calamity first, then a High-risk plant not saved, then its cause. */
function lossColor(loss: PlantLoss): string {
  if (loss.calamity) return COLOR.calamity;
  if (loss.high_risk_not_saved) return COLOR.notSaved;
  return loss.cause_group === "pest_disease" ? COLOR.pestDisease : COLOR.other;
}

function matches(loss: PlantLoss, filter: Filter): boolean {
  switch (filter) {
    case "CALAMITY":
      return loss.calamity;
    case "NOT_SAVED":
      return loss.high_risk_not_saved;
    case "PEST_DISEASE":
      return loss.cause_group === "pest_disease";
    case "OTHER":
      return loss.cause_group === "other";
    default:
      return true;
  }
}

/**
 * Plants that died before harvest, from the report each Farmer files when
 * they mark a plant as died. Calamities and High-risk plants that were not
 * saved are counted apart, since those are what an officer acts on.
 */
export default function LguPlantLossPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguPlantLosses);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(0);

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Plant Loss" />

      {loading ? (
        <LguLoading label="Loading plant losses…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No plants lost"
          description="When a Farmer reports that a plant died — to a calamity, pests, disease or anything else — it appears here."
        />
      ) : (
        <>
          <LossBanner data={data} filter={filter} onFilter={choose} />
          <Breakdown data={data} />
          <LossList losses={data.losses.filter((loss) => matches(loss, filter))} page={page} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** The headline count and the filters, one per group, with their counts. */
function LossBanner({
  data,
  filter,
  onFilter,
}: {
  data: PlantLosses;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}) {
  const options: { value: Filter; label: string; count: number; color: string; icon: LucideIcon }[] = [
    { value: "ALL", label: "All losses", count: data.total, color: COLOR.all, icon: Layers },
    { value: "CALAMITY", label: "Calamity", count: data.calamity, color: COLOR.calamity, icon: CloudLightning },
    {
      value: "NOT_SAVED",
      label: "High risk, not saved",
      count: data.high_risk_not_saved,
      color: COLOR.notSaved,
      icon: OctagonAlert,
    },
    { value: "PEST_DISEASE", label: "Pests & disease", count: data.pest_disease, color: COLOR.pestDisease, icon: Bug },
    { value: "OTHER", label: "Other", count: data.other, color: COLOR.other, icon: HeartCrack },
  ];

  return (
    <section className="flex flex-col gap-3">
      <p className="font-heading text-lg leading-tight font-semibold sm:text-xl">
        <span className="tabular-nums" style={{ color: COLOR.notSaved }}>
          {data.total}
        </span>{" "}
        {data.total === 1 ? "plant lost" : "plants lost"} before harvest
      </p>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Show losses"
      >
        {options.map((option) => {
          const active = filter === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(option.value)}
              className={cn(
                "font-heading flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border-transparent",
              )}
              style={active ? { borderColor: tint(option.color, 45) } : undefined}
            >
              <Icon className="size-3.5" style={{ color: option.color }} aria-hidden="true" />
              {option.label}
              <span
                className="rounded-full px-1.5 text-xs tabular-nums"
                style={
                  active
                    ? { color: option.color, backgroundColor: tint(option.color, 15) }
                    : { backgroundColor: "var(--border)" }
                }
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * One compact card: what killed them as a single stacked bar (only causes
 * that took a plant are listed), then the last six months and the crops lost.
 */
function Breakdown({ data }: { data: PlantLosses }) {
  const causes = data.causes.filter((cause) => cause.count > 0).sort((a, b) => b.count - a.count);
  const most = Math.max(1, ...data.months.map((month) => month.count));

  return (
    <section className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm">
      <h2 className="font-heading text-sm font-semibold">What killed them</h2>

      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={causes.map((cause) => `${cause.label}: ${cause.count}`).join(", ")}
      >
        {causes.map((cause) => (
          <span
            key={cause.value}
            className="h-full transition-[width] duration-700"
            style={{ width: `${(cause.count / data.total) * 100}%`, backgroundColor: CAUSE_COLOR[cause.value] }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {causes.map((cause) => (
          <li key={cause.value} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: CAUSE_COLOR[cause.value] }}
            />
            {cause.label}
            {cause.calamity && (
              <span
                className="font-heading rounded-full px-1.5 text-[10px] font-semibold uppercase"
                style={{ color: COLOR.calamity, backgroundColor: tint(COLOR.calamity, 14) }}
              >
                Calamity
              </span>
            )}
            <span className="font-heading font-semibold tabular-nums">{cause.count}</span>
          </li>
        ))}
      </ul>

      <div className="border-border/70 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-1.5" role="list" aria-label="Plants lost per month">
          {data.months.map((month) => {
            const label = new Date(`${month.month}-01T00:00:00`).toLocaleDateString("en", { month: "short" });
            return (
              <div key={month.month} role="listitem" className="flex w-9 flex-col items-center gap-1">
                <span
                  className="w-full rounded-md transition-[height] duration-700"
                  style={{
                    height: `${Math.max(3, (month.count / most) * 22)}px`,
                    backgroundColor: month.count ? COLOR.notSaved : "var(--muted)",
                  }}
                  aria-label={`${label}: ${month.count}`}
                  title={`${label}: ${month.count}`}
                />
                <span className="text-muted-foreground text-[10px]">{label}</span>
              </div>
            );
          })}
        </div>

        {data.crops.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.crops.slice(0, 4).map((crop) => (
              <span key={crop.crop} className="bg-muted/60 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                <span aria-hidden="true">{crop.emoji}</span>
                {crop.crop}
                <span className="font-heading font-semibold tabular-nums">{crop.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** The losses themselves, newest first, eight a page, one compact row each. */
function LossList({
  losses,
  page,
  onPage,
}: {
  losses: PlantLoss[];
  page: number;
  onPage: (page: number) => void;
}) {
  if (losses.length === 0) {
    return (
      <p className="border-border text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
        No losses in this group.
      </p>
    );
  }
  const pages = Math.ceil(losses.length / PAGE_SIZE);
  const current = Math.min(page, pages - 1);
  const shown = losses.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3" aria-label="Lost plants">
      <ul className="bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border shadow-sm">
        {shown.map((loss) => (
          <li key={loss.id}>
            <LossRow loss={loss} />
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {current * PAGE_SIZE + 1}–{Math.min(losses.length, (current + 1) * PAGE_SIZE)} of {losses.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => onPage(current - 1)}
              className="border-border bg-card hover:bg-muted flex size-9 items-center justify-center rounded-full border shadow-sm disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={current === pages - 1}
              onClick={() => onPage(current + 1)}
              className="border-border bg-card hover:bg-muted flex size-9 items-center justify-center rounded-full border shadow-sm disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Tag({ color, icon: Icon, children }: { color: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span
      className="font-heading inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ color, backgroundColor: tint(color, 14) }}
    >
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

function LossTags({ loss }: { loss: PlantLoss }) {
  return (
    <>
      <Tag color={loss.calamity ? COLOR.calamity : lossColor(loss)} icon={loss.calamity ? CloudLightning : HeartCrack}>
        {loss.cause_label}
      </Tag>
      {loss.high_risk_not_saved && (
        <Tag color={COLOR.notSaved} icon={OctagonAlert}>
          High risk, not saved
        </Tag>
      )}
    </>
  );
}

/** A lost plant as one row: opens its full report in a pop-up. */
function LossRow({ loss }: { loss: PlantLoss }) {
  const color = lossColor(loss);
  const style = { ...cropVar(loss.crop_name), "--level": color } as React.CSSProperties;
  const lostOn = formatDisplayDate(loss.lost_at.slice(0, 10));

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          "relative flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors",
          "hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-(--level)/30 focus-visible:ring-inset",
        )}
        style={style}
      >
        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: color }} />
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xl grayscale-[60%]"
          style={{ backgroundColor: "color-mix(in oklab, var(--crop) 18%, transparent)" }}
        >
          {loss.crop_emoji}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="font-heading truncate text-sm font-semibold">{loss.plant_name}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums">{lostOn}</span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground truncate text-xs">
              {loss.crop_name} · {loss.farmer_name} · Day {loss.age_days}
            </span>
            <span className="flex flex-wrap gap-1">
              <LossTags loss={loss} />
            </span>
          </span>
        </span>

        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className="bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border shadow-[0_30px_80px_-30px_var(--level)] transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          style={style}
        >
          <div
            className="flex shrink-0 items-start gap-3.5 border-b px-6 py-4"
            style={{
              backgroundImage: `linear-gradient(110deg, color-mix(in oklab, var(--crop) 20%, transparent), ${tint(color, 14)} 50%, transparent 90%)`,
            }}
          >
            <span
              aria-hidden="true"
              className="bg-card flex size-12 shrink-0 items-center justify-center rounded-2xl border text-2xl grayscale-[60%]"
            >
              {loss.crop_emoji}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Dialog.Title className="font-heading truncate text-base leading-tight font-semibold">
                {loss.plant_name}
              </Dialog.Title>
              <div className="flex flex-wrap gap-1.5">
                <LossTags loss={loss} />
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Farmer" value={loss.farmer_name} />
              <Fact label="Crop" value={loss.crop_name} />
              <Fact label="What happened" value={loss.cause_label} />
              <Fact label="Planted" value={formatDisplayDate(loss.planting_date)} />
              <Fact label="Reported lost" value={lostOn} />
              <Fact label="Noticed" value={loss.noticed_label} />
              <Fact label="Age when lost" value={`${loss.age_days} days`} />
              <Fact label="Weekly checks" value={String(loss.assessments_count)} />
              <Fact
                label="Highest risk read"
                value={loss.highest_risk ? loss.highest_risk.charAt(0) + loss.highest_risk.slice(1).toLowerCase() : "None"}
              />
            </dl>

            <p
              className="flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm"
              style={{
                borderColor: tint(loss.warned_before ? COLOR.notSaved : COLOR.other, 30),
                backgroundColor: tint(loss.warned_before ? COLOR.notSaved : COLOR.other, 6),
              }}
            >
              {loss.warned_before ? (
                <BellRing className="text-risk-high mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ClipboardList className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {loss.high_risk_not_saved
                  ? `BulanTanom read this plant as High risk${loss.high_risk_count > 1 ? ` ${loss.high_risk_count} times` : ""} before it died.`
                  : loss.warned_before
                    ? `BulanTanom had warned about this plant (last reading ${loss.last_risk.toLowerCase()}) before it died.`
                    : loss.assessments_count
                      ? "BulanTanom had not warned about this plant before it died."
                      : "This plant had no weekly checks, so BulanTanom could not warn about it."}
              </span>
            </p>

            {loss.notes && (
              <blockquote className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
                “{loss.notes}”
              </blockquote>
            )}

            {loss.photo_url && (
              <AuthedImage
                src={loss.photo_url}
                alt={`Photo of the lost ${loss.plant_name}`}
                className="max-h-80 w-full rounded-2xl border object-cover"
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-3 py-2.5">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="font-heading mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
