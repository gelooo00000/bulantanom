"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  BellRing,
  Bug,
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
import { PagedSection, SegmentTabs } from "@/components/lgu/paged-section";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { AuthedImage } from "@/components/shared/authed-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchLguPlantLosses, type PlantLoss, type PlantLosses } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CROP_OUTLINE, cropVar } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

type Group = "CALAMITY" | "NOT_SAVED" | "PEST_DISEASE" | "OTHER";
type Filter = "ALL" | Group;

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

/** Each group's section, as on Harvest & Monitoring: a title, an icon, a colour and a hint. */
const GROUPS: Record<Group, { title: string; tab: string; icon: LucideIcon; color: string; hint: string }> = {
  CALAMITY: {
    title: "Lost to a calamity",
    tab: "Calamity",
    icon: CloudLightning,
    color: COLOR.calamity,
    hint: "Flood, typhoon, drought or heat",
  },
  NOT_SAVED: {
    title: "High risk, not saved",
    tab: "High risk, not saved",
    icon: OctagonAlert,
    color: COLOR.notSaved,
    hint: "Read as High risk, and died anyway",
  },
  PEST_DISEASE: {
    title: "Pests & disease",
    tab: "Pests & disease",
    icon: Bug,
    color: COLOR.pestDisease,
    hint: "Check the farmer's other plants",
  },
  OTHER: { title: "Other causes", tab: "Other", icon: HeartCrack, color: COLOR.other, hint: "Animals and the rest" },
};

const ORDER: Group[] = ["CALAMITY", "NOT_SAVED", "PEST_DISEASE", "OTHER"];
const PER_PAGE = 4;

/** The one section a loss sits in: a calamity first, then a High-risk plant not saved, then its cause. */
function groupOf(loss: PlantLoss): Group {
  if (loss.calamity) return "CALAMITY";
  if (loss.high_risk_not_saved) return "NOT_SAVED";
  return loss.cause_group === "pest_disease" ? "PEST_DISEASE" : "OTHER";
}

/** Whether a loss belongs under a tab; a loss can count under two. */
function matches(loss: PlantLoss, filter: Group): boolean {
  switch (filter) {
    case "CALAMITY":
      return loss.calamity;
    case "NOT_SAVED":
      return loss.high_risk_not_saved;
    case "PEST_DISEASE":
      return loss.cause_group === "pest_disease";
    default:
      return loss.cause_group === "other";
  }
}

/**
 * Plants that died before harvest, from the report each Farmer files when
 * they mark a plant as died, laid out like Harvest & Monitoring: tabs, then
 * a section per group with sliding pages of cards.
 */
export default function LguPlantLossPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguPlantLosses);
  const [filter, setFilter] = useState<Filter>("ALL");

  const count: Record<Filter, number> = data
    ? {
        ALL: data.total,
        CALAMITY: data.calamity,
        NOT_SAVED: data.high_risk_not_saved,
        PEST_DISEASE: data.pest_disease,
        OTHER: data.other,
      }
    : { ALL: 0, CALAMITY: 0, NOT_SAVED: 0, PEST_DISEASE: 0, OTHER: 0 };

  return (
    <div className="flex flex-col gap-6">
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
          <SegmentTabs
            label="Losses to show"
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "ALL", label: "All losses", count: count.ALL, icon: Layers },
              ...ORDER.map((group) => ({
                value: group,
                label: GROUPS[group].tab,
                count: count[group],
                icon: GROUPS[group].icon,
                color: GROUPS[group].color,
              })),
            ]}
          />

          <Breakdown data={data} />

          {filter === "ALL" ? (
            <div className="flex flex-col gap-8">
              {ORDER.map((group) => (
                <LossSection
                  key={group}
                  group={group}
                  losses={data.losses.filter((loss) => groupOf(loss) === group)}
                />
              ))}
            </div>
          ) : count[filter] === 0 ? (
            <EmptyState
              icon={GROUPS[filter].icon}
              title="No losses here"
              description="No lost plant falls under this group."
            />
          ) : (
            <LossSection
              key={filter}
              group={filter}
              losses={data.losses.filter((loss) => matches(loss, filter))}
            />
          )}
        </>
      )}
    </div>
  );
}

function LossSection({ group, losses }: { group: Group; losses: PlantLoss[] }) {
  const look = GROUPS[group];
  return (
    <PagedSection
      title={look.title}
      icon={look.icon}
      hint={look.hint}
      color={look.color}
      items={losses}
      perPage={PER_PAGE}
      itemKey={(loss) => loss.id}
      renderItem={(loss) => <LossCard loss={loss} />}
    />
  );
}

/**
 * One compact card: the headline count, what killed them as a single
 * stacked bar (only causes that took a plant), the last six months and the
 * crops lost.
 */
function Breakdown({ data }: { data: PlantLosses }) {
  const causes = data.causes.filter((cause) => cause.count > 0).sort((a, b) => b.count - a.count);
  const most = Math.max(1, ...data.months.map((month) => month.count));

  return (
    <section className="bg-card flex flex-col gap-3 rounded-3xl border p-5 shadow-sm">
      <p className="font-heading text-lg leading-tight font-semibold">
        <span className="tabular-nums" style={{ color: COLOR.notSaved }}>
          {data.total}
        </span>{" "}
        {data.total === 1 ? "plant lost" : "plants lost"} before harvest
      </p>

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

/** Up to two initials for the farmer's avatar. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

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
  const look = GROUPS[groupOf(loss)];
  return (
    <>
      <Tag color={loss.calamity ? COLOR.calamity : look.color} icon={loss.calamity ? CloudLightning : HeartCrack}>
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

/**
 * The plant's life as one track, like the season track on Harvest &
 * Monitoring: from planting to the day it was lost, in its group's colour,
 * ending in a broken heart.
 */
function LifeTrack({ loss, color }: { loss: PlantLoss; color: string }) {
  const lostOn = formatDisplayDate(loss.lost_at.slice(0, 10));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative mx-2.5 h-7" aria-hidden="true">
        <div className="bg-muted absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${tint("var(--primary)", 45)}, ${color})` }}
          />
        </div>
        <span
          className="bg-card absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: "var(--primary)" }}
        />
        <span
          className="border-card absolute top-1/2 left-full flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] shadow"
          style={{ backgroundColor: color, color: "var(--risk-foreground)" }}
        >
          <HeartCrack className="size-3" />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Planted</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium">{formatDisplayDate(loss.planting_date)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Lived</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium tabular-nums">{loss.age_days} days</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Lost</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium">{lostOn}</p>
        </div>
      </div>
    </div>
  );
}

/** A lost plant, in the same card as Harvest & Monitoring: opens its full report in a pop-up. */
function LossCard({ loss }: { loss: PlantLoss }) {
  const color = GROUPS[groupOf(loss)].color;
  const style = { ...cropVar(loss.crop_name), "--level": color } as React.CSSProperties;
  const lostOn = formatDisplayDate(loss.lost_at.slice(0, 10));
  const highest = loss.highest_risk ? (loss.highest_risk.toLowerCase() as BadgeLevel) : null;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          "bg-card text-card-foreground relative isolate flex w-full flex-col overflow-hidden rounded-3xl border text-left shadow-sm",
          "transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5",
          CROP_OUTLINE,
        )}
        style={style}
      >
        {/* A wash in the crop's colour behind the header, the crop faded in the corner. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-28"
          style={{
            backgroundImage: "linear-gradient(160deg, color-mix(in oklab, var(--crop) 20%, transparent), transparent 85%)",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-3 -right-2 -z-10 text-8xl leading-none opacity-[0.12] grayscale select-none"
        >
          {loss.crop_emoji}
        </span>

        <span className="flex w-full flex-col gap-4 p-5">
          <span className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="bg-card flex size-14 shrink-0 items-center justify-center rounded-2xl border text-3xl grayscale-[50%]"
              style={{ boxShadow: "0 10px 22px -14px var(--crop)" }}
            >
              {loss.crop_emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-heading block truncate text-lg leading-tight font-semibold">{loss.plant_name}</span>
              <span className="mt-1.5 flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="font-heading flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                  style={{ color: "var(--primary)", backgroundColor: tint("var(--primary)", 14) }}
                >
                  {initials(loss.farmer_name)}
                </span>
                <span className="text-muted-foreground truncate text-sm">{loss.farmer_name}</span>
              </span>
            </span>
            <span
              className="font-heading shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{ color, backgroundColor: tint(color, 15), borderColor: tint(color, 30) }}
            >
              Lost {lostOn}
            </span>
          </span>

          <LifeTrack loss={loss} color={color} />

          <span className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-3.5 text-xs">
            {highest && <RiskBadge size="sm" level={highest} />}
            <span className="text-muted-foreground">
              {loss.assessments_count === 1 ? "1 weekly check" : `${loss.assessments_count} weekly checks`}
            </span>
            <span className="ml-auto flex flex-wrap justify-end gap-1.5">
              <LossTags loss={loss} />
            </span>
          </span>
        </span>
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
