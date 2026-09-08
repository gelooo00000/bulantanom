"use client";

import {
  CalendarDays,
  Eye,
  Info,
  LoaderCircle,
  RotateCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { RiskBadge } from "@/components/risk/risk-badge";
import { AuthedImage } from "@/components/shared/authed-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reanalyzeAssessment, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<string, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
};

function toLevel(level: string): "low" | "medium" | "high" {
  return level.toLowerCase() as "low" | "medium" | "high";
}

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
 * Full AI risk evaluation for one assessment. Renders the "failed" state
 * honestly rather than inventing a level when Gemini was unavailable.
 */
export function RiskResultCard({
  assessment: initial,
}: {
  assessment: BackendAssessment;
}) {
  const { accessToken } = useAuth();
  const [assessment, setAssessment] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const risk = assessment.risk;

  async function retryAnalysis() {
    if (!accessToken) return;
    setRetrying(true);
    setRetryError(null);
    try {
      setAssessment(await reanalyzeAssessment(accessToken, assessment.id));
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : "Analysis is still unavailable.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card className="gap-5 py-5">
      <CardContent className="flex flex-col gap-5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {risk?.risk_level ? (
              <RiskBadge level={toLevel(risk.risk_level)} />
            ) : (
              <span className="text-muted-foreground bg-muted rounded-full px-3 py-1 text-sm font-medium">
                No risk reading
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {assessment.crop_emoji} {assessment.plant_display_name} · day{" "}
              {assessment.plant_age_days}
            </span>
          </div>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5" />
            {new Date(assessment.assessment_date).toLocaleDateString()}
          </span>
        </div>

        {assessment.evidence_image_url && (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--landing-border)" }}
          >
            <p className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] tracking-wide uppercase">
              Plant evidence
            </p>
            {/* Served by an authorized endpoint, not a public media path, so
                the token has to travel with the request - see AuthedImage. */}
            <AuthedImage
              src={assessment.evidence_image_url}
              alt={`Plant condition evidence for ${assessment.plant_display_name}`}
              className="max-h-80 w-full bg-muted object-contain"
            />
          </div>
        )}

        {!risk || risk.status !== "completed" ? (
          <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
            <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col items-start gap-3">
              <div>
                <p className="text-sm font-medium">AI risk analysis unavailable</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {risk?.failure_reason ??
                    "AI risk analysis is temporarily unavailable."}{" "}
                  Your assessment and photo were saved — you can run the analysis again
                  without re-entering anything.
                </p>
                {retryError && (
                  <p className="text-destructive mt-1 text-sm">{retryError}</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={retryAnalysis} disabled={retrying}>
                {retrying ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <RotateCw className="size-3.5" />
                    Retry analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{risk.summary}</p>

            {(risk.reality_vs_expectation?.expected ||
              risk.reality_vs_expectation?.observed) && (
              <div className="border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    Expected
                  </p>
                  <p className="mt-1 text-sm">{risk.reality_vs_expectation.expected}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    Observed
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

            {risk.visual_observations.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <Eye className="size-3.5" />
                  Visual observations
                </h3>
                <ul className="text-muted-foreground mt-1.5 space-y-1.5 text-sm">
                  {risk.visual_observations.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="bg-muted-foreground/50 mt-2 size-1 shrink-0 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {risk.risk_factors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Risk factors</h3>
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
            <Section title="Monitoring advice" items={risk.monitoring_advice} />
            <Section title="Limitations" items={risk.limitations} />

            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              {risk.next_assessment_days && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarDays className="size-3.5" />
                  Reassess in about {risk.next_assessment_days} days
                </p>
              )}
              <p className="text-muted-foreground/60 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="size-3" />
                AI-generated guidance{risk.image_analyzed ? " including photo analysis" : ""}.
                Not a diagnosis, and not a replacement for an agricultural officer.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskInfoNote() {
  return (
    <p className="text-muted-foreground/70 flex items-start gap-1.5 text-xs">
      <Info className="mt-0.5 size-3 shrink-0" />
      Risk readings compare your report against the crop&apos;s expected development for
      its current age. They are estimates, not guarantees.
    </p>
  );
}
