"use client";

import {
  CalendarDays,
  ArrowRight,
  ClipboardCheck,
  ListChecks,
  Search,
  Sprout,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { useState, type ElementType } from "react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import type { BackendAssessment } from "@/lib/api/risk-api";
import { cropVar } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

/** The risk level's colour, as a CSS variable, for edges, washes and dots. */
const LEVEL_COLOR: Record<string, string> = {
  LOW: "var(--risk-low)",
  MEDIUM: "var(--risk-medium)",
  HIGH: "var(--risk-high)",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "var(--risk-low)",
  medium: "var(--risk-medium)",
  high: "var(--risk-high)",
};

const tint = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/** Up to two initials for the farmer's avatar. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** A small labelled fact on the closed row: farmer, age, date, reasons. */
function Fact({
  icon: Icon,
  children,
}: {
  icon: ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="bg-muted/70 text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A titled list in its own tinted box (possible causes, recommended actions). */
function ListBox({
  icon: Icon,
  title,
  items,
  color,
}: {
  icon: ElementType;
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: tint(color, 30), backgroundColor: tint(color, 7) }}
    >
      <h3 className="font-heading flex items-center gap-2 text-sm font-semibold">
        <span
          className="flex size-6 items-center justify-center rounded-lg"
          style={{ color, backgroundColor: tint(color, 16) }}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              className="mt-2 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One flagged case as a scannable card; clicking it opens the full agronomic
 * reasoning in a pop-up, so the list keeps its shape. A triage list is read
 * by severity first, so the card carries only what ranks a case against its
 * neighbours.
 *
 * Evidence imagery is deliberately absent: the officer is reviewing why the
 * crop is at risk, not how its photo was evaluated.
 */
export function HighRiskCaseCard({
  assessment,
}: {
  assessment: BackendAssessment;
}) {
  const [open, setOpen] = useState(false);
  const risk = assessment.risk;
  const level = risk?.risk_level;
  const analyzed = risk?.status === "completed";
  const reasonCount = risk?.risk_factors.length ?? 0;
  const color = (level && LEVEL_COLOR[level]) || "var(--muted-foreground)";
  const style = {
    ...cropVar(assessment.crop_name),
    "--level": color,
  } as React.CSSProperties;

  /** The pop-up's header: name, risk, farmer, age, reading date and reasons. */
  const heading = (
    <>
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{
          backgroundColor: "color-mix(in oklab, var(--crop) 18%, transparent)",
        }}
      >
        {assessment.crop_emoji}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading truncate text-base leading-tight font-semibold">
            {assessment.plant_display_name}
          </span>
          {level ? (
            <RiskBadge level={level.toLowerCase() as BadgeLevel} size="sm" />
          ) : (
            <span className="font-heading text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
              No reading
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {assessment.farmer && (
            <Fact icon={User}>{assessment.farmer.full_name}</Fact>
          )}
          <Fact icon={Sprout}>Day {assessment.plant_age_days}</Fact>
          <Fact icon={CalendarDays}>
            {new Date(assessment.assessment_date).toLocaleDateString()}
          </Fact>
          {analyzed && reasonCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ color, backgroundColor: tint(color, 14) }}
            >
              <ListChecks className="size-3" aria-hidden="true" />
              {reasonCount} {reasonCount === 1 ? "reason" : "reasons"}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* The whole card opens the case in a pop-up, so the list keeps its shape. */}
      <Dialog.Trigger
        className={cn(
          "group/case bg-card relative isolate flex w-full flex-col overflow-hidden rounded-3xl border text-left outline-none",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out",
          "hover:-translate-y-1 hover:border-(--level)/50 hover:shadow-[0_22px_45px_-22px_var(--level)]",
          "focus-visible:border-(--level) focus-visible:ring-3 focus-visible:ring-(--level)/30",
        )}
        style={style}
      >
        {/* A cover in the crop's colour, warmed by the risk level. */}
        <span
          className="relative block h-28 w-full overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, color-mix(in oklab, var(--crop) 32%, transparent), ${tint(color, 22)} 70%, ${tint(color, 30)})`,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-50 [background-image:radial-gradient(color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom_left,black,transparent_75%)]"
          />
          <span
            aria-hidden="true"
            className="absolute -right-6 -bottom-10 text-[7.5rem] leading-none opacity-20 blur-[1px] transition-transform duration-500 select-none group-hover/case:scale-110 group-hover/case:-rotate-6"
          >
            {assessment.crop_emoji}
          </span>

          {/* The level, as a solid pill that pulses for high risk. */}
          <span
            className="font-heading absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: color, color: "var(--risk-foreground)" }}
          >
            {level === "HIGH" ? (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-current opacity-70 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
            ) : (
              <span className="size-2 rounded-full bg-current" />
            )}
            {level ? `${level === "HIGH" ? "High" : level === "MEDIUM" ? "Medium" : "Low"} risk` : "No reading"}
          </span>
        </span>

        {/* The crop's emoji in a disc that sits across the cover's edge. */}
        <span
          aria-hidden="true"
          className="bg-card absolute top-[4.25rem] left-5 flex size-[4.5rem] items-center justify-center rounded-2xl border text-4xl shadow-md transition-transform duration-300 group-hover/case:-translate-y-1 group-hover/case:rotate-3"
          style={{ boxShadow: "0 12px 24px -14px var(--crop)" }}
        >
          {assessment.crop_emoji}
        </span>

        <span className="flex flex-1 flex-col px-5 pt-10 pb-4">
          <span className="font-heading line-clamp-2 text-lg leading-tight font-semibold">
            {assessment.plant_display_name}
          </span>
          <span className="text-muted-foreground mt-0.5 truncate text-xs">{assessment.crop_name}</span>
        </span>

        <span className="border-border/70 mt-auto flex w-full items-center justify-between gap-3 border-t px-5 py-3">
          {assessment.farmer ? (
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="font-heading flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ color: "var(--primary)", backgroundColor: tint("var(--primary)", 14) }}
              >
                {initials(assessment.farmer.full_name)}
              </span>
              <span className="truncate text-sm font-medium">{assessment.farmer.full_name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">No farmer</span>
          )}
          <span
            className="font-heading inline-flex shrink-0 items-center gap-1 text-xs font-semibold"
            style={{ color }}
          >
            Review
            <ArrowRight
              className="size-3.5 transition-transform duration-300 group-hover/case:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border",
            "shadow-[0_30px_80px_-30px_var(--level)] transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
          style={style}
        >
          <div
            className="relative flex shrink-0 items-start gap-3.5 border-b py-4 pr-4 pl-6"
            style={{
              backgroundImage: `linear-gradient(110deg, color-mix(in oklab, var(--crop) 22%, transparent), ${tint(color, 14)} 45%, transparent 85%)`,
            }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: color }}
            />
            <Dialog.Title className="sr-only">
              {assessment.plant_display_name}:{" "}
              {level ? `${level.toLowerCase()} risk` : "no reading"}
            </Dialog.Title>
            {heading}
            <Dialog.Close
              aria-label="Close"
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            {!analyzed || !risk ? (
              <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
                <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground text-sm">
                  {risk?.failure_reason ??
                    "AI risk analysis was not available for this assessment."}
                </p>
              </div>
            ) : (
              <>
                {risk.summary && (
                  <p
                    className="rounded-xl border-l-4 py-2.5 pr-3 pl-3.5 text-sm leading-relaxed"
                    style={{
                      borderColor: color,
                      backgroundColor: tint(color, 8),
                    }}
                  >
                    {risk.summary}
                  </p>
                )}

                {(risk.reality_vs_expectation?.expected ||
                  risk.reality_vs_expectation?.observed) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-border bg-muted/40 rounded-xl border p-3.5">
                      <p className="text-risk-low text-[11px] font-semibold tracking-wide uppercase">
                        Expected for this age
                      </p>
                      <p className="mt-1 text-sm">
                        {risk.reality_vs_expectation.expected}
                      </p>
                    </div>
                    <div
                      className="rounded-xl border p-3.5"
                      style={{
                        borderColor: tint(color, 30),
                        backgroundColor: tint(color, 7),
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold tracking-wide uppercase"
                        style={{ color }}
                      >
                        Reported by Farmer
                      </p>
                      <p className="mt-1 text-sm">
                        {risk.reality_vs_expectation.observed}
                      </p>
                    </div>
                    {risk.reality_vs_expectation.assessment && (
                      <p className="text-muted-foreground text-sm sm:col-span-2">
                        {risk.reality_vs_expectation.assessment}
                      </p>
                    )}
                  </div>
                )}

                {risk.risk_factors.length > 0 && (
                  <div>
                    <h3 className="font-heading flex items-center gap-2 text-sm font-semibold">
                      <span
                        className="flex size-6 items-center justify-center rounded-lg"
                        style={{ color, backgroundColor: tint(color, 16) }}
                      >
                        <TriangleAlert
                          className="size-3.5"
                          aria-hidden="true"
                        />
                      </span>
                      Why this plant is flagged
                    </h3>
                    <ul className="mt-2 flex flex-col gap-2 text-sm">
                      {risk.risk_factors.map((factor) => {
                        const severity =
                          SEVERITY_COLOR[factor.severity] ??
                          "var(--muted-foreground)";
                        return (
                          <li
                            key={factor.factor}
                            className="border-border flex gap-2.5 rounded-xl border px-3 py-2.5"
                          >
                            <span
                              className="mt-1.5 size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: severity }}
                            />
                            <span>
                              <span
                                className="font-semibold"
                                style={{ color: severity }}
                              >
                                {factor.factor}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                — {factor.explanation}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <ListBox
                    icon={Search}
                    title="Possible causes"
                    items={risk.possible_causes}
                    color="var(--risk-medium)"
                  />
                  <ListBox
                    icon={ClipboardCheck}
                    title="Recommended actions"
                    items={risk.recommended_actions}
                    color="var(--risk-low)"
                  />
                </div>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
