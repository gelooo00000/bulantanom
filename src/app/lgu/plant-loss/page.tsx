"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  BellRing,
  Bug,
  ClipboardList,
  CloudLightning,
  Droplets,
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
import { formatDisplayDate, formatShortDate } from "@/components/ui/date-picker";
import { fetchLguPlantLosses, type PlantLoss } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CROP_OUTLINE, cropVar } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

type Group = "CALAMITY" | "NOT_SAVED" | "PEST_DISEASE" | "CONDITIONS" | "OTHER";
type Filter = "ALL" | Group;

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/**
 * Each group's colour: the cause groups share Agricultural Analytics'
 * validated --loss-* colours; a lost High-risk plant is the risk red.
 */
const COLOR = {
  calamity: "var(--loss-calamity)",
  notSaved: "var(--risk-high)",
  pestDisease: "var(--loss-pest)",
  conditions: "var(--loss-conditions)",
  other: "var(--loss-other)",
  all: "var(--primary)",
};

/** Each group's section, as on Harvest & Monitoring: a title, an icon and a colour. */
const GROUPS: Record<Group, { title: string; tab: string; icon: LucideIcon; color: string }> = {
  CALAMITY: {
    title: "Lost to a calamity",
    tab: "Calamity",
    icon: CloudLightning,
    color: COLOR.calamity,
  },
  NOT_SAVED: {
    title: "High risk, not saved",
    tab: "High risk, not saved",
    icon: OctagonAlert,
    color: COLOR.notSaved,
  },
  PEST_DISEASE: {
    title: "Pests & disease",
    tab: "Pests & disease",
    icon: Bug,
    color: COLOR.pestDisease,
  },
  CONDITIONS: {
    title: "Growing conditions",
    tab: "Growing conditions",
    icon: Droplets,
    color: COLOR.conditions,
  },
  OTHER: {
    title: "Farming practice & other",
    tab: "Practice & other",
    icon: HeartCrack,
    color: COLOR.other,
  },
};

const ORDER: Group[] = ["CALAMITY", "NOT_SAVED", "PEST_DISEASE", "CONDITIONS", "OTHER"];
const PER_PAGE = 4;

/** The one section a loss sits in: a calamity first, then a High-risk plant not saved, then its cause. */
function groupOf(loss: PlantLoss): Group {
  if (loss.calamity) return "CALAMITY";
  if (loss.high_risk_not_saved) return "NOT_SAVED";
  if (loss.cause_group === "pest_disease") return "PEST_DISEASE";
  return loss.cause_group === "conditions" ? "CONDITIONS" : "OTHER";
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
    case "CONDITIONS":
      return loss.cause_group === "conditions";
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
        CONDITIONS: data.conditions,
        OTHER: data.other,
      }
    : { ALL: 0, CALAMITY: 0, NOT_SAVED: 0, PEST_DISEASE: 0, CONDITIONS: 0, OTHER: 0 };

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
          description="When a Farmer reports that a plant died — to a calamity, pests, disease, poor growing conditions, human error or anything else — it appears here."
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
      color={look.color}
      items={losses}
      perPage={PER_PAGE}
      gridClassName="sm:grid-cols-2 xl:grid-cols-4"
      itemKey={(loss) => loss.id}
      renderItem={(loss) => <LossCard loss={loss} />}
    />
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
 * The plant's life as one thin track, like the season track on Harvest &
 * Monitoring: from planting to the day it was lost, ending in a broken heart.
 */
function LifeTrack({ loss, color }: { loss: PlantLoss; color: string }) {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="relative mx-2 block h-4" aria-hidden="true">
        <span
          className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ backgroundImage: `linear-gradient(90deg, ${tint("var(--primary)", 45)}, ${color})` }}
        />
        <span
          className="bg-card absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: "var(--primary)" }}
        />
        <span
          className="border-card absolute top-1/2 left-full flex size-4.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-sm"
          style={{ backgroundColor: color, color: "var(--risk-foreground)" }}
        >
          <HeartCrack className="size-2.5" />
        </span>
      </span>
      <span className="text-muted-foreground flex items-center justify-between gap-2 text-[11px] tabular-nums">
        <span>{formatShortDate(loss.planting_date)}</span>
        <span className="text-foreground font-heading font-medium">{loss.age_days} days</span>
        <span>{formatShortDate(loss.lost_at.slice(0, 10))}</span>
      </span>
    </span>
  );
}

/** A lost plant as a small card: opens its full report in a pop-up. */
function LossCard({ loss }: { loss: PlantLoss }) {
  const color = GROUPS[groupOf(loss)].color;
  const style = { ...cropVar(loss.crop_name), "--level": color } as React.CSSProperties;
  const lostOn = formatDisplayDate(loss.lost_at.slice(0, 10));
  const highest = loss.highest_risk ? (loss.highest_risk.toLowerCase() as BadgeLevel) : null;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          "bg-card text-card-foreground relative isolate flex w-full flex-col gap-3 overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm",
          "transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5",
          CROP_OUTLINE,
        )}
        style={style}
      >
        {/* A wash in the crop's colour behind the header. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-16"
          style={{
            backgroundImage: "linear-gradient(160deg, color-mix(in oklab, var(--crop) 18%, transparent), transparent 85%)",
          }}
        />

        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-card flex size-10 shrink-0 items-center justify-center rounded-xl border text-xl grayscale-[50%]"
          >
            {loss.crop_emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-heading block truncate text-sm leading-tight font-semibold">{loss.plant_name}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="font-heading flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold"
                style={{ color: "var(--primary)", backgroundColor: tint("var(--primary)", 14) }}
              >
                {initials(loss.farmer_name)}
              </span>
              <span className="text-muted-foreground truncate text-xs">{loss.farmer_name}</span>
            </span>
          </span>
        </span>

        <LifeTrack loss={loss} color={color} />

        <span className="flex flex-wrap items-center gap-1.5">
          <LossTags loss={loss} />
          {highest && <RiskBadge size="sm" level={highest} />}
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
                <Tag color={COLOR.notSaved} icon={HeartCrack}>
                  Total crop loss
                </Tag>
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
