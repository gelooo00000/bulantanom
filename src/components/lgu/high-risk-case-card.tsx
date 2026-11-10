"use client";

import {
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ListChecks,
  Search,
  Sparkles,
  Sprout,
  TriangleAlert,
  User,
} from "lucide-react";
import { useId, useState, type ElementType } from "react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { Card } from "@/components/ui/card";
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

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/** A small labelled fact on the closed row: farmer, age, date, reasons. */
function Fact({ icon: Icon, children }: { icon: ElementType; children: React.ReactNode }) {
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
    <div className="rounded-xl border p-3.5" style={{ borderColor: tint(color, 30), backgroundColor: tint(color, 7) }}>
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
            <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One flagged case, collapsed to a scannable row until the officer opens it.
 * A triage list is read by severity first, so the closed row carries only what
 * ranks a case against its neighbours - the full agronomic reasoning is one
 * click away rather than stacked down the page.
 *
 * Evidence imagery is deliberately absent: the officer is reviewing why the
 * crop is at risk, not how its photo was evaluated.
 */
export function HighRiskCaseCard({ assessment }: { assessment: BackendAssessment }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const risk = assessment.risk;
  const level = risk?.risk_level;
  const analyzed = risk?.status === "completed";
  const reasonCount = risk?.risk_factors.length ?? 0;
  const color = (level && LEVEL_COLOR[level]) || "var(--muted-foreground)";

  return (
    <Card
      className={cn(
        "relative isolate gap-0 overflow-hidden py-0 transition-[border-color,box-shadow,transform] duration-200",
        // A light in the crop's colour, as on the farmer's cards.
        "hover:ring-3 hover:ring-(--crop)/30 focus-within:ring-3 focus-within:ring-(--crop)/30",
        open && "shadow-[0_18px_40px_-26px_var(--level)]",
      )}
      style={{ ...cropVar(assessment.crop_name), "--level": color } as React.CSSProperties}
    >
      {/* The risk level as a band down the left edge and a soft wash. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: `linear-gradient(100deg, ${tint(color, 9)}, transparent 55%)` }}
      />

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="hover:bg-muted/30 flex w-full items-center gap-3.5 py-3.5 pr-4 pl-5 text-left transition-colors"
      >
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--crop) 18%, transparent)" }}
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
            {assessment.farmer && <Fact icon={User}>{assessment.farmer.full_name}</Fact>}
            <Fact icon={Sprout}>Day {assessment.plant_age_days}</Fact>
            <Fact icon={CalendarDays}>{new Date(assessment.assessment_date).toLocaleDateString()}</Fact>
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

        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border transition-all",
            open ? "border-transparent text-white" : "border-border text-muted-foreground",
          )}
          style={open ? { backgroundColor: color } : undefined}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t px-5 pt-4 pb-5">
          {!analyzed || !risk ? (
            <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
              <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
              <p className="text-muted-foreground text-sm">
                {risk?.failure_reason ?? "AI risk analysis was not available for this assessment."}
              </p>
            </div>
          ) : (
            <>
              {risk.summary && (
                <p
                  className="rounded-xl border-l-4 py-2.5 pr-3 pl-3.5 text-sm leading-relaxed"
                  style={{ borderColor: color, backgroundColor: tint(color, 8) }}
                >
                  {risk.summary}
                </p>
              )}

              {(risk.reality_vs_expectation?.expected || risk.reality_vs_expectation?.observed) && (
                <div className="grid gap-3">
                  <div className="border-border bg-muted/40 rounded-xl border p-3.5">
                    <p className="text-risk-low text-[11px] font-semibold tracking-wide uppercase">
                      Expected for this age
                    </p>
                    <p className="mt-1 text-sm">{risk.reality_vs_expectation.expected}</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: tint(color, 30), backgroundColor: tint(color, 7) }}>
                    <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color }}>
                      Reported by Farmer
                    </p>
                    <p className="mt-1 text-sm">{risk.reality_vs_expectation.observed}</p>
                  </div>
                  {risk.reality_vs_expectation.assessment && (
                    <p className="text-muted-foreground text-sm">
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
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                    </span>
                    Why this plant is flagged
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {risk.risk_factors.map((factor) => {
                      const severity = SEVERITY_COLOR[factor.severity] ?? "var(--muted-foreground)";
                      return (
                        <li key={factor.factor} className="border-border flex gap-2.5 rounded-xl border px-3 py-2.5">
                          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: severity }} />
                          <span>
                            <span className="font-semibold" style={{ color: severity }}>
                              {factor.factor}
                            </span>
                            <span className="text-muted-foreground"> — {factor.explanation}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="grid gap-3">
                <ListBox icon={Search} title="Possible causes" items={risk.possible_causes} color="var(--risk-medium)" />
                <ListBox
                  icon={ClipboardCheck}
                  title="Recommended actions"
                  items={risk.recommended_actions}
                  color="var(--risk-low)"
                />
              </div>

              <p className="text-muted-foreground/70 border-border flex items-center gap-1.5 border-t pt-3 text-[11px]">
                <Sparkles className="size-3" />
                AI-generated guidance. Not a diagnosis, and not a replacement for an agricultural officer.
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
