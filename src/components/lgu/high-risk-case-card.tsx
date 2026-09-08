"use client";

import { ChevronDown, Sparkles, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { RiskBadge } from "@/components/risk/risk-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendAssessment } from "@/lib/api/risk-api";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<string, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
};

const ACCENT_CLASS: Record<string, string> = {
  LOW: "border-l-risk-low",
  MEDIUM: "border-l-risk-medium",
  HIGH: "border-l-risk-high",
};

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="text-muted-foreground mt-1.5 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="bg-muted-foreground/50 mt-2 size-1 shrink-0 rounded-full" />
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

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0 transition-colors",
        level && "border-l-4",
        level ? ACCENT_CLASS[level] : undefined,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {level ? (
              <RiskBadge level={level.toLowerCase() as "low" | "medium" | "high"} size="sm" />
            ) : (
              <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                No reading
              </span>
            )}
            <span className="truncate text-sm font-medium">
              {assessment.crop_emoji} {assessment.plant_display_name}
            </span>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {assessment.farmer && <span className="truncate">{assessment.farmer.full_name}</span>}
            <span aria-hidden>·</span>
            <span>day {assessment.plant_age_days}</span>
            <span aria-hidden>·</span>
            <span>{new Date(assessment.assessment_date).toLocaleDateString()}</span>
            {analyzed && reasonCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {reasonCount} {reasonCount === 1 ? "reason" : "reasons"}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <CardContent id={panelId} className="flex flex-col gap-4 border-t px-4 pt-4 pb-5">
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
              {risk.summary && <p className="text-sm leading-relaxed">{risk.summary}</p>}

              {(risk.reality_vs_expectation?.expected ||
                risk.reality_vs_expectation?.observed) && (
                <div className="border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                      Expected for this age
                    </p>
                    <p className="mt-1 text-sm">{risk.reality_vs_expectation.expected}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                      Reported by Farmer
                    </p>
                    <p className="mt-1 text-sm">{risk.reality_vs_expectation.observed}</p>
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
                  <h3 className="text-sm font-medium">Why this plant is flagged</h3>
                  <ul className="mt-1.5 space-y-2 text-sm">
                    {risk.risk_factors.map((factor) => (
                      <li key={factor.factor}>
                        <span
                          className={cn(
                            "font-medium",
                            SEVERITY_CLASS[factor.severity] ?? "text-foreground",
                          )}
                        >
                          {factor.factor}
                        </span>
                        <span className="text-muted-foreground"> — {factor.explanation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Section title="Possible causes" items={risk.possible_causes} />
              <Section title="Recommended actions" items={risk.recommended_actions} />

              <p className="text-muted-foreground/60 border-border flex items-center gap-1.5 border-t pt-3 text-[11px]">
                <Sparkles className="size-3" />
                AI-generated guidance. Not a diagnosis, and not a replacement for an
                agricultural officer.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
