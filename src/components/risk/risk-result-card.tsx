"use client";

import {
  CalendarDays,
  CalendarX,
  ChevronDown,
  ClipboardCheck,
  Sprout,
  Info,
  LoaderCircle,
  RotateCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { AuthedImage } from "@/components/shared/authed-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reanalyzeAssessment, type BackendAssessment } from "@/lib/api/risk-api";
import { useAuth } from "@/lib/auth/auth-context";
import { useFarmerLanguage } from "@/lib/i18n";
import { CARD_OUTLINE } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

function toLevel(level: string): BadgeLevel {
  return level.toLowerCase() as BadgeLevel;
}

function Section({ title, items }: { title: string; items: string[] }) {
  // `title` arrives translated; the items are the AI's own words.
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-heading text-base">{title}</h3>
      <ul className="text-muted-foreground mt-1.5 space-y-1.5 text-[15px] leading-snug">
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
  readOnly = false,
}: {
  assessment: BackendAssessment;
  /** For LGU Officers: no "run again", which only the Farmer can do. */
  readOnly?: boolean;
}) {
  const { accessToken } = useAuth();
  const { t, language, dateLocale } = useFarmerLanguage();
  const [assessment, setAssessment] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  // The details (photo, expected vs observed, what was seen, risk factors,
  // possible causes, monitoring) stay folded until asked for.
  const [more, setMore] = useState(false);
  const risk = assessment.risk;
  const completed = !!risk && risk.status === "completed";

  async function retryAnalysis() {
    if (!accessToken) return;
    setRetrying(true);
    setRetryError(null);
    try {
      setAssessment(await reanalyzeAssessment(accessToken, assessment.id));
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : t("result.stillUnavailable"),
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card className={`gap-5 py-5 ${CARD_OUTLINE}`}>
      <CardContent className="flex flex-col gap-5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {risk?.risk_level ? (
              <RiskBadge level={toLevel(risk.risk_level)} />
            ) : (
              <span className="font-heading text-muted-foreground bg-muted rounded-full px-3 py-1 text-sm font-medium">
                {t("result.noReading")}
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {assessment.crop_emoji} {assessment.plant_display_name} ·{" "}
              {t("row.day", { n: assessment.plant_age_days })}
            </span>
          </div>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5" />
            {new Date(assessment.assessment_date).toLocaleDateString(dateLocale)}
          </span>
        </div>

        {/* On a finished reading the photo moves under "See more". */}
        {assessment.evidence_image_url && !completed && (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--landing-border)" }}
          >
            <p className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] tracking-wide uppercase">
              {t("result.evidence")}
            </p>
            {/* Served by an authorized endpoint, not a public media path, so
                the token has to travel with the request - see AuthedImage. */}
            <AuthedImage
              src={assessment.evidence_image_url}
              alt={t("row.photoAlt", { name: assessment.plant_display_name })}
              className="max-h-80 w-full bg-muted object-contain"
            />
          </div>
        )}

        {/* The photo and the recorded date disagree — a record to correct,
            never reported as danger to the crop. */}
        {risk?.date_mismatch && (
          <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
            <CalendarX className="text-risk-medium mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-heading text-sm font-medium">{t("mismatch.title")}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t("mismatch.text")}</p>
            </div>
          </div>
        )}

        {!risk || risk.status !== "completed" ? (
          <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
            <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col items-start gap-3">
              <div>
                <p className="font-heading text-sm font-medium">{t("result.unavailableTitle")}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {risk?.failure_reason ?? t("result.unavailableDefault")}
                  {!readOnly && <> {t("result.saved")}</>}
                </p>
                {retryError && (
                  <p className="text-destructive mt-1 text-sm">{retryError}</p>
                )}
              </div>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={retryAnalysis} disabled={retrying}>
                  {retrying ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      {t("result.analyzing")}
                    </>
                  ) : (
                    <>
                      <RotateCw className="size-3.5" />
                      {t("result.retry")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* No level to show: say plainly that it is too soon, rather
                than leaving the card looking unfinished. */}
            {risk.risk_level === "INCONCLUSIVE" && !risk.date_mismatch && (
              <div className="border-border bg-muted/40 rounded-xl border p-4">
                <p className="font-heading text-sm font-medium">{t("early.resultTitle")}</p>
                <p className="text-muted-foreground mt-1 text-sm">{t("early.resultText")}</p>
              </div>
            )}

            <p className="text-foreground text-[15px] leading-relaxed">{risk.summary}</p>

            {/* What to do comes first; it is what the farmer acts on. */}
            {risk.recommended_actions.length > 0 && (
              <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
                <h3 className="font-heading flex items-center gap-1.5 text-base">
                  <ClipboardCheck className="text-primary size-4" />
                  {t("result.whatToDo")}
                </h3>
                <ol className="mt-2 space-y-2 text-[15px] leading-snug">
                  {risk.recommended_actions.map((item, i) => (
                    <li key={item} className="flex gap-2">
                      <span className="bg-primary/15 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {hasFertilizerAdvice(risk.fertilizer) ? (
              <FertilizerAdvice fertilizer={risk.fertilizer} />
            ) : (
              // Made before fertilizer advice existed: offer to update it
              // once, with the same answers and photo.
              !readOnly && (
                <div className="border-risk-low/30 bg-risk-low/5 flex flex-col items-start gap-2 rounded-xl border p-4">
                  <h3 className="font-heading flex items-center gap-1.5 text-base">
                    <Sprout className="text-risk-low size-4" />
                    {t("result.fertilizer")}
                  </h3>
                  <p className="text-muted-foreground text-sm">{t("result.fertMissing")}</p>
                  {retryError && <p className="text-destructive text-sm">{retryError}</p>}
                  <Button size="sm" variant="outline" onClick={retryAnalysis} disabled={retrying}>
                    {retrying ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin" />
                        {t("result.updating")}
                      </>
                    ) : (
                      <>
                        <RotateCw className="size-3.5" />
                        {t("result.update")}
                      </>
                    )}
                  </Button>
                </div>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              className="self-center"
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
            >
              {more ? t("result.seeLess") : t("result.seeMore")}
              <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
            </Button>

            {more && (
              <div className="animate-in fade-in slide-in-from-top-1 flex flex-col gap-5 duration-200">
                {assessment.evidence_image_url && (
                  <div
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: "var(--landing-border)" }}
                  >
                    <p className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] tracking-wide uppercase">
                      {t("result.evidence")}
                    </p>
                    <AuthedImage
                      src={assessment.evidence_image_url}
                      alt={t("row.photoAlt", { name: assessment.plant_display_name })}
                      className="max-h-80 w-full bg-muted object-contain"
                    />
                  </div>
                )}

                <Section title={t("result.causes")} items={risk.possible_causes} />
                <Section title={t("result.monitoring")} items={risk.monitoring_advice} />
              </div>
            )}

            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              {risk.next_assessment_days && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarDays className="size-3.5" />
                  {t("result.reassess", { n: risk.next_assessment_days })}
                </p>
              )}
              <p className="text-muted-foreground/60 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="size-3" />
                {t(risk.image_analyzed ? "result.aiNotePhoto" : "result.aiNote")}
                {/* Only for findings written before results followed the app
                    language, which are English whatever the screen says. */}
                {(risk.language ?? "en") !== language && ` ${t("result.aiText")}`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Fertilizer = NonNullable<NonNullable<BackendAssessment["risk"]>["fertilizer"]>;

/** Readings made before fertilizer advice existed have none at all. */
function hasFertilizerAdvice(fertilizer?: Fertilizer): boolean {
  return !!fertilizer && (!!fertilizer.advice || (fertilizer.products ?? []).length > 0);
}

/**
 * The fertilizer advice: products only from the Philippine list, named and
 * described by the system, with how much, how, and where to buy them.
 */
function FertilizerAdvice({ fertilizer }: { fertilizer?: Fertilizer }) {
  const { t } = useFarmerLanguage();
  const products = fertilizer?.products ?? [];
  if (!fertilizer || (!fertilizer.advice && products.length === 0)) return null;
  return (
    <div className="border-risk-low/30 bg-risk-low/5 rounded-xl border p-4">
      <h3 className="font-heading flex items-center gap-1.5 text-base">
        <Sprout className="text-risk-low size-4" />
        {t("result.fertilizer")}
      </h3>
      {fertilizer.advice && (
        <p className="text-muted-foreground mt-1.5 text-sm">{fertilizer.advice}</p>
      )}
      {products.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.id} className="bg-background/70 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {product.name}{" "}
                <span className="text-muted-foreground font-normal">({product.grade})</span>
              </p>
              {product.why && <p className="text-muted-foreground mt-0.5">{product.why}</p>}
              <dl className="mt-2 grid gap-1 text-[13px]">
                <div className="flex gap-1.5">
                  <dt className="font-medium">{t("result.fertAmount")}:</dt>
                  <dd className="text-muted-foreground">{product.amount}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium">{t("result.fertHow")}:</dt>
                  <dd className="text-muted-foreground">{product.how}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium">{t("result.fertBrands")}:</dt>
                  <dd className="text-muted-foreground">{product.brands}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {products.length > 0 && fertilizer.where_to_buy && (
        <p className="mt-3 text-[13px]">
          <span className="font-medium">{t("result.fertWhere")}:</span>{" "}
          <span className="text-muted-foreground">{fertilizer.where_to_buy}</span>
        </p>
      )}
      {products.length > 0 && (
        <p className="text-muted-foreground/70 mt-2 text-[11px]">{t("result.fertLabel")}</p>
      )}
    </div>
  );
}

export function RiskInfoNote() {
  const { t } = useFarmerLanguage();
  return (
    <p className="text-muted-foreground/70 flex items-start gap-1.5 text-xs">
      <Info className="mt-0.5 size-3 shrink-0" />
      {t("result.infoNote")}
    </p>
  );
}
