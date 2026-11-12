"use client";

import {
  BellRing,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  HeartCrack,
  HeartPulse,
  ImageIcon,
  LayoutGrid,
  Lightbulb,
  PieChart,
  ShieldCheck,
  Sprout,
  Timer,
  User,
  Wheat,
} from "lucide-react";
import { useEffect, useState, type ElementType, type ReactNode } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { AuthedImage } from "@/components/shared/authed-image";
import { EmptyState } from "@/components/shared/empty-state";
import { SlidePager } from "@/components/shared/slide-pager";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type {
  HarvestOutcomeReport,
  HarvestOutcomes as Outcomes,
  LossOutcomeReport,
} from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import {
  INK,
  PALETTE,
  gradient,
  tint,
  type Swatch,
} from "@/components/admin/palette";
import { cn } from "@/lib/utils";

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value}%`;

/** Good, middling and bad answers, as text colour. */
const TONE: Record<string, string> = {
  GOOD: "text-risk-low",
  HEALTHY: "text-risk-low",
  YES: "text-risk-low",
  FAIR: "text-risk-medium",
  MINOR_PROBLEMS: "text-risk-medium",
  A_LITTLE: "text-risk-medium",
  POOR: "text-risk-high",
  DAMAGED: "text-risk-high",
  NO: "text-risk-high",
};

/** The same answers as a soft chip. */
const CHIP: Record<string, string> = {
  GOOD: "bg-risk-low/12 text-risk-low border-risk-low/25",
  HEALTHY: "bg-risk-low/12 text-risk-low border-risk-low/25",
  YES: "bg-risk-low/12 text-risk-low border-risk-low/25",
  FAIR: "bg-risk-medium/12 text-risk-medium border-risk-medium/25",
  MINOR_PROBLEMS: "bg-risk-medium/12 text-risk-medium border-risk-medium/25",
  A_LITTLE: "bg-risk-medium/12 text-risk-medium border-risk-medium/25",
  POOR: "bg-risk-high/12 text-risk-high border-risk-high/25",
  DAMAGED: "bg-risk-high/12 text-risk-high border-risk-high/25",
  NO: "bg-risk-high/12 text-risk-high border-risk-high/25",
};

const SURFACE =
  "border-border bg-card rounded-2xl border shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-white/10";

/**
 * A card's colour, as on the Admin console: a soft wash from its top
 * corner and, on the dark theme, a glow in that colour underneath.
 */
const GLOW = "dark:shadow-[0_16px_40px_-24px_var(--panel)]";
function panelStyle(swatch: Swatch): React.CSSProperties {
  return {
    "--panel": swatch[1],
    backgroundImage: `radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, ${swatch[0]} 15%, transparent), transparent 60%)`,
  } as React.CSSProperties;
}

/** A gradient tile holding an icon, in a card's colour. */
function IconTile({
  icon: Icon,
  swatch,
  size = "md",
}: {
  icon: ElementType;
  swatch: Swatch;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_var(--tile)]",
        size === "sm" ? "size-7 rounded-lg" : "size-10",
      )}
      style={
        {
          "--tile": swatch[1],
          backgroundImage: gradient(swatch),
        } as React.CSSProperties
      }
    >
      <Icon
        className={size === "sm" ? "size-3.5" : "size-5"}
        aria-hidden="true"
      />
    </span>
  );
}

/**
 * "Harvest Outcomes": how plants monitored with BulanTanom turned out, from
 * the Farmers' harvest reports. Shared by the LGU Harvest page and the Admin
 * page; each passes its own role's fetcher. A page with its own banner hides
 * the heading.
 */
export function HarvestOutcomes({
  fetcher,
  showHeading = true,
  compact = false,
}: {
  fetcher: (accessToken: string) => Promise<Outcomes>;
  showHeading?: boolean;
  /**
   * The Admin page's shorter version: no section bar, no Overview rates,
   * no "warned about" count and no By crop table.
   */
  compact?: boolean;
}) {
  const { data, loading, error, refetch } = useAuthedQuery(fetcher);

  return (
    <section className="flex flex-col gap-5" aria-labelledby="harvest-outcomes">
      <div className={cn(!showHeading && "sr-only")}>
        <h2
          id="harvest-outcomes"
          className="font-heading flex items-center gap-2 text-lg sm:text-xl"
        >
          <span className="bg-risk-low/15 text-risk-low flex size-8 items-center justify-center rounded-lg">
            <ClipboardCheck className="size-4" aria-hidden="true" />
          </span>
          Harvest Outcomes
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          How plants monitored with BulanTanom turned out, from the report each
          Farmer fills in when a plant is harvested or lost.
        </p>
      </div>

      {loading ? (
        <LguLoading label="Loading harvest outcomes…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.total + (data.lost_total ?? 0) === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No harvest reports yet"
          description="Outcomes appear here once Farmers mark plants harvested and fill in the harvest report."
        />
      ) : (
        <OutcomeBody data={data} compact={compact} />
      )}
    </section>
  );
}

type SectionKey = "overview" | "breakdown" | "crops" | "losses" | "reports";
type SectionDef = {
  key: SectionKey;
  label: string;
  icon: ElementType;
  count?: number;
};

const sectionId = (key: SectionKey) => `outcomes-${key}`;

function OutcomeBody({ data, compact }: { data: Outcomes; compact: boolean }) {
  const lost = data.lost_total ?? 0;
  const sections: SectionDef[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "breakdown", label: "Quality & health", icon: PieChart },
    {
      key: "crops",
      label: "By crop",
      icon: Sprout,
      count: data.by_crop.length,
    },
    ...(lost > 0
      ? [
          {
            key: "losses" as const,
            label: "Lost plants",
            icon: HeartCrack,
            count: lost,
          },
        ]
      : []),
    {
      key: "reports",
      label: "Latest reports",
      icon: ClipboardList,
      count: data.recent.length,
    },
  ];

  return (
    <>
      {!compact && <SectionNav sections={sections} />}

      {compact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FlatStat
            icon={Sprout}
            swatch={PALETTE.forest}
            label="Survival rate (harvested vs lost)"
            value={pct(data.survival_rate)}
          />
          <FlatStat
            icon={Wheat}
            swatch={PALETTE.rose}
            label="Plants lost"
            value={lost}
          />
        </div>
      ) : (
        <Section
          id="overview"
          title="Overview"
          icon={LayoutGrid}
          note={`From ${data.total} harvest report${data.total === 1 ? "" : "s"}. ${pct(data.monitored_rate)} of these plants had at least one weekly assessment.`}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RingStat
              icon={HeartPulse}
              color="var(--risk-low)"
              label="Healthy at harvest"
              percent={data.healthy_rate}
            />
            <RingStat
              icon={ShieldCheck}
              color="var(--risk-medium)"
              label="Recovered from High risk"
              percent={
                data.reached_high_risk
                  ? (100 * data.recovered_healthy) / data.reached_high_risk
                  : null
              }
              value={`${data.recovered_healthy} of ${data.reached_high_risk}`}
            />
            <RingStat
              icon={Timer}
              color="var(--chart-series-1)"
              label="Harvested on time"
              percent={data.on_time_rate}
            />
            <RingStat
              icon={Lightbulb}
              color="var(--primary)"
              label="Farmers say the advice helped"
              percent={data.advice_helped_rate}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FlatStat
              icon={Sprout}
              swatch={PALETTE.forest}
              label="Survival rate (harvested vs lost)"
              value={pct(data.survival_rate)}
            />
            <FlatStat
              icon={Wheat}
              swatch={PALETTE.rose}
              label="Plants lost"
              value={lost}
            />
            <FlatStat
              icon={BellRing}
              swatch={PALETTE.gold}
              label="Lost plants BulanTanom had warned about"
              value={`${data.warned_before_loss ?? 0} of ${lost}`}
            />
          </div>
        </Section>
      )}

      <Section
        id="breakdown"
        title="Quality & health"
        icon={PieChart}
        swatch={PALETTE.gold}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <BreakdownCard
            title="Quality"
            icon={Wheat}
            swatch={PALETTE.gold}
            rows={data.quality}
            total={data.total}
          />
          <BreakdownCard
            title="Health at harvest"
            icon={HeartPulse}
            swatch={PALETTE.forest}
            rows={data.final_health}
            total={data.total}
          />
          <BreakdownCard
            title="Did the advice help?"
            icon={Lightbulb}
            swatch={PALETTE.sky}
            rows={data.advice_helped}
            total={data.total}
          />
        </div>
      </Section>

      {!compact && (
        <Section id="crops" title="By crop" icon={Sprout}>
          <div className={cn(SURFACE, "overflow-x-auto")}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-muted-foreground bg-muted/40 border-b text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Crop</th>
                  <th className="px-2 py-2.5 font-medium">Harvests</th>
                  <th className="px-2 py-2.5 font-medium">Healthy</th>
                  <th className="px-2 py-2.5 font-medium">Good quality</th>
                  <th className="px-2 py-2.5 font-medium">On time</th>
                  <th className="px-2 py-2.5 font-medium">Avg. days</th>
                  <th className="px-4 py-2.5 font-medium">Avg. yield</th>
                </tr>
              </thead>
              <tbody>
                {data.by_crop.map((crop) => (
                  <tr
                    key={crop.crop}
                    className="hover:bg-muted/30 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5 font-medium">
                        <span
                          aria-hidden="true"
                          className="bg-muted flex size-8 items-center justify-center rounded-lg text-base"
                        >
                          {crop.emoji}
                        </span>
                        {crop.crop}
                      </span>
                    </td>
                    <td className="font-heading px-2 py-3 tabular-nums">
                      {crop.harvests}
                    </td>
                    <td className="px-2 py-3">
                      <MiniBar
                        value={crop.healthy_rate}
                        color="var(--risk-low)"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <MiniBar
                        value={crop.good_quality_rate}
                        color="var(--primary)"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <MiniBar
                        value={crop.on_time_rate}
                        color="var(--chart-series-1)"
                      />
                    </td>
                    <td className="px-2 py-3 tabular-nums">
                      {crop.average_days}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {crop.average_yield.length ? (
                        crop.average_yield
                          .map((y) => `${y.average} ${y.unit_label}`)
                          .join(" · ")
                      ) : (
                        <span className="text-muted-foreground">Not given</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {lost > 0 && (
        <Section
          id="losses"
          title="Lost plants"
          icon={HeartCrack}
          swatch={PALETTE.rose}
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <BreakdownCard
              title="Causes of loss"
              icon={HeartCrack}
              swatch={PALETTE.rose}
              rows={(data.causes ?? []).filter((c) => c.count > 0)}
              total={lost}
              neutral
              pageSize={LOSS_PAGE_SIZE}
            />
            {/* Four lost plants at a time; the rest slide in from the next page. */}
            <SlidePager
              className="lg:col-span-2"
              items={data.recent_losses ?? []}
              pageSize={LOSS_PAGE_SIZE}
              getKey={(loss) => loss.id}
              renderItem={(loss) => <LossCard loss={loss} />}
              listLabel="Lost plants"
              listClassName="grid gap-3 sm:grid-cols-2"
              itemClassName=""
            />
          </div>
        </Section>
      )}

      <Section
        id="reports"
        title="Latest harvest reports"
        icon={ClipboardList}
        swatch={PALETTE.sky}
      >
        {data.recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No harvest reports yet.
          </p>
        ) : (
          // Four reports at a time; the rest slide in from the next page.
          <SlidePager
            items={data.recent}
            pageSize={REPORT_PAGE_SIZE}
            getKey={(report) => report.id}
            renderItem={(report) => <ReportCard report={report} />}
            listLabel="Harvest reports"
            listClassName="grid gap-3 lg:grid-cols-2"
            itemClassName=""
          />
        )}
      </Section>
    </>
  );
}

/**
 * Chips that jump to each part of the outcomes, sticking under the page
 * header while scrolling; the part in view is highlighted.
 */
function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [current, setCurrent] = useState<SectionKey>("overview");
  const keys = sections.map((s) => s.key).join(",");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible)
          setCurrent(visible.target.id.replace("outcomes-", "") as SectionKey);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    for (const key of keys.split(",") as SectionKey[]) {
      const el = document.getElementById(sectionId(key));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [keys]);

  return (
    <nav
      aria-label="Harvest Outcomes sections"
      className="bg-background/85 border-border sticky top-[3.25rem] z-[5] -mx-1 rounded-2xl border px-1.5 py-1.5 shadow-sm backdrop-blur-md"
    >
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {sections.map(({ key, label, icon: Icon, count }) => {
          const active = current === key;
          return (
            <li key={key} className="shrink-0">
              <a
                href={`#${sectionId(key)}`}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrent(key);
                  document
                    .getElementById(sectionId(key))
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "font-heading flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_var(--primary)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[0.6875rem] tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-muted",
                    )}
                  >
                    {count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Section({
  id,
  title,
  icon,
  swatch = PALETTE.forest,
  note,
  children,
}: {
  id: SectionKey;
  title: string;
  icon: ElementType;
  swatch?: Swatch;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionId(id)}
      aria-label={title}
      className="flex scroll-mt-32 flex-col gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading flex items-center gap-2.5 text-base font-semibold">
          <IconTile icon={icon} swatch={swatch} size="sm" />
          {title}
        </h3>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A headline rate with a ring gauge filled to it. */
function RingStat({
  icon: Icon,
  color,
  label,
  percent,
  value,
}: {
  icon: ElementType;
  color: string;
  label: string;
  percent: number | null | undefined;
  /** Shown instead of the percentage, e.g. "1 of 2". */
  value?: string;
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled =
    percent === null || percent === undefined
      ? 0
      : Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn(
        SURFACE,
        "relative flex flex-col gap-3 overflow-hidden p-4",
      )}
      style={{
        backgroundImage: `linear-gradient(160deg, color-mix(in oklch, ${color}, transparent 90%), transparent 60%)`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex size-9 items-center justify-center rounded-xl"
          style={{
            color,
            backgroundColor: `color-mix(in oklch, ${color}, transparent 85%)`,
          }}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <svg
          viewBox="0 0 64 64"
          className="size-16 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - filled / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
      </div>
      <div>
        <p
          className="font-heading text-2xl font-semibold tabular-nums"
          style={{ color }}
        >
          {value ?? pct(percent)}
        </p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

function FlatStat({
  icon,
  swatch,
  label,
  value,
}: {
  icon: ElementType;
  swatch: Swatch;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className={cn(SURFACE, GLOW, "flex items-center gap-3 p-4")}
      style={panelStyle(swatch)}
    >
      <IconTile icon={icon} swatch={swatch} />
      <div className="min-w-0">
        <p className="font-heading text-xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

/** A percentage with a short bar, for the crop table. */
function MiniBar({ value, color }: { value: number | null; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{ width: `${value ?? 0}%`, backgroundColor: color }}
        />
      </span>
      <span className="tabular-nums">{pct(value)}</span>
    </span>
  );
}

/** How many causes, and how many lost plants, the Lost plants section shows at a time. */
const LOSS_PAGE_SIZE = 4;
/** How many harvest reports the Latest harvest reports section shows at a time. */
const REPORT_PAGE_SIZE = 4;

function BreakdownCard({
  title,
  icon,
  swatch = PALETTE.forest,
  rows,
  total,
  neutral = false,
  pageSize,
}: {
  title: string;
  icon: ElementType;
  swatch?: Swatch;
  rows: Outcomes["quality"];
  total: number;
  /** One colour for every row, for answers that are not good or bad. */
  neutral?: boolean;
  /** Show this many rows at a time, the rest a slide away. */
  pageSize?: number;
}) {
  const renderRow = (row: Outcomes["quality"][number]) => {
    const share = total ? Math.round((100 * row.count) / total) : 0;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className={cn("font-medium", neutral ? "" : TONE[row.value])}>{row.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {row.count}
            <span className="ml-1 opacity-70">· {share}%</span>
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full bg-current transition-[width] duration-500",
              neutral ? "text-primary" : TONE[row.value],
            )}
            style={{ width: `${share}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(SURFACE, GLOW, "flex flex-col gap-3 p-4")}
      style={panelStyle(swatch)}
    >
      <p className="font-heading flex items-center gap-2.5 text-sm font-semibold">
        <IconTile icon={icon} swatch={swatch} size="sm" />
        {title}
      </p>
      {pageSize && rows.length > pageSize ? (
        <SlidePager
          items={rows}
          pageSize={pageSize}
          getKey={(row) => row.value}
          renderItem={renderRow}
          listLabel={title}
          listClassName="flex flex-col gap-3"
          itemClassName=""
        />
      ) : (
        rows.map((row) => <div key={row.value}>{renderRow(row)}</div>)
      )}
    </div>
  );
}

function Chip({ value, children }: { value: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
        CHIP[value] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {children}
    </span>
  );
}

function PhotoToggle({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) {
  const [show, setShow] = useState(false);
  return show ? (
    <AuthedImage
      src={src}
      alt={alt}
      className="bg-muted max-h-64 w-full rounded-xl object-contain"
    />
  ) : (
    <button
      type="button"
      onClick={() => setShow(true)}
      className="text-primary hover:bg-primary/10 flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-medium transition-colors"
    >
      <ImageIcon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function ReportCard({ report }: { report: HarvestOutcomeReport }) {
  const amount =
    report.yield_amount !== null
      ? `${Number(report.yield_amount)} ${report.yield_unit_label}`
      : "Amount not given";
  return (
    <article
      className={cn(
        SURFACE,
        GLOW,
        "relative isolate flex flex-col gap-3 overflow-hidden p-4 pt-5 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_var(--panel)]",
      )}
      style={panelStyle(PALETTE.forest)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundImage: gradient(PALETTE.forest, 90) }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: tint(INK.forest, 14) }}
          >
            {report.crop_emoji}
          </span>
          <div className="min-w-0">
            <p className="font-heading truncate font-medium">
              {report.plant_name}
            </p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              <span className="flex items-center gap-1">
                <User className="size-3" aria-hidden="true" />
                {report.farmer_name}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" aria-hidden="true" />
                {formatDisplayDate(report.harvested_on)}
              </span>
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem]">
          {report.timing_label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip value={report.quality}>{report.quality_label} quality</Chip>
        <Chip value={report.final_health}>{report.final_health_label}</Chip>
        <Chip value={report.advice_helped}>
          Advice helped: {report.advice_helped_label}
        </Chip>
      </div>

      <div
        className="grid grid-cols-2 gap-2 rounded-xl p-2.5 text-xs"
        style={{ backgroundColor: tint(INK.sky, 9) }}
      >
        <p>
          <span className="text-muted-foreground block">Yield</span>
          <span className="font-medium">{amount}</span>
        </p>
        <p>
          <span className="text-muted-foreground block">Monitoring</span>
          <span className="font-medium">
            {report.assessments_count} check
            {report.assessments_count === 1 ? "" : "s"} ·{" "}
            {report.highest_risk
              ? `peak ${report.highest_risk.toLowerCase()}`
              : "no reading"}
          </span>
        </p>
      </div>

      {report.recovered_from_high && (
        <p className="text-risk-low flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Recovered from High risk
        </p>
      )}
      {report.notes && (
        <p className="text-muted-foreground border-primary/30 line-clamp-3 border-l-2 pl-2.5 text-xs italic">
          “{report.notes}”
        </p>
      )}
      {report.photo_url && (
        <PhotoToggle
          src={report.photo_url}
          alt={`Harvest of ${report.plant_name}`}
          label="View harvest photo"
        />
      )}
    </article>
  );
}

function LossCard({ loss }: { loss: LossOutcomeReport }) {
  return (
    <article
      className={cn(
        SURFACE,
        GLOW,
        "border-risk-high/20 relative isolate flex flex-col gap-2.5 overflow-hidden p-4 pt-5 text-sm",
      )}
      style={panelStyle(PALETTE.rose)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundImage: gradient(PALETTE.rose, 90) }}
      />
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-risk-high/10 flex size-11 shrink-0 items-center justify-center rounded-xl text-xl grayscale"
        >
          {loss.crop_emoji}
        </span>
        <div className="min-w-0">
          <p className="font-heading truncate font-medium">{loss.plant_name}</p>
          <p className="text-muted-foreground text-xs">
            {loss.farmer_name} · lost{" "}
            {formatDisplayDate(loss.lost_at.slice(0, 10))} · day {loss.age_days}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="bg-risk-high/12 text-risk-high border-risk-high/25 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">
          {loss.cause_label}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem]">
          Noticed {loss.noticed_label.toLowerCase()}
        </span>
      </div>
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs",
          loss.warned_before
            ? "text-risk-medium font-medium"
            : "text-muted-foreground",
        )}
      >
        <BellRing className="size-3.5" aria-hidden="true" />
        {loss.warned_before
          ? `Warned beforehand (last reading ${loss.last_risk.toLowerCase()})`
          : loss.assessments_count
            ? "No warning before the loss"
            : "Never assessed"}
      </p>
      {loss.notes && (
        <p className="text-muted-foreground border-risk-high/30 line-clamp-3 border-l-2 pl-2.5 text-xs italic">
          “{loss.notes}”
        </p>
      )}
      {loss.photo_url && (
        <PhotoToggle
          src={loss.photo_url}
          alt={`Lost plant ${loss.plant_name}`}
          label="View photo"
        />
      )}
    </article>
  );
}
