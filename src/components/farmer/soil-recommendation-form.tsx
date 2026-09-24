"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { SoilResultCard } from "@/components/farmer/soil-result-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  createSoilRecommendation,
  fetchSoilRecommendations,
  reanalyzeSoilRecommendation,
  type SoilRecommendationInput,
  type SoilRecommendation,
} from "@/lib/api/soil-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { useLanguage } from "@/lib/i18n";
import {
  SENSOR_FIELDS,
  sensorLabel,
  useSoilStrings,
  validateReading,
  type SensorField,
} from "@/lib/soil-options";

type Status = "idle" | "analyzing" | "done";

/**
 * One labelled numeric reading with its unit.
 *
 * Extracted because the form has eight of them and they differ only by the
 * spec they are handed. The unit sits inside the field rather than beside
 * the label, so it stays attached to the number when the grid wraps to one
 * column on a phone.
 */
function SoilNumberField({
  field,
  value,
  error,
  onChange,
}: {
  field: SensorField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();
  const id = `soil-${field.key.replace(/_/g, "-")}`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{sensorLabel(field, t)}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("pr-16", error && "border-destructive")}
        />
        {/* Not a <label>: it names the unit, not the control, and a second
            label would compete with the real one for the field's name. */}
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
        >
          {field.unit}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("sensor.range", { min: field.min, max: field.max, unit: field.unit })}
        </p>
      )}
    </div>
  );
}

export function SoilRecommendationForm() {
  const { accessToken } = useAuth();
  const t = useSoilStrings();
  const { t: translate, dateLocale } = useLanguage();

  const [status, setStatus] = useState<Status>("idle");
  // Every saved assessment, newest first. A new one is added, never swapped
  // in: older results stay reachable from "Result from".
  const [history, setHistory] = useState<SoilRecommendation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const result = history.find((item) => item.id === selectedId) ?? history[0] ?? null;
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  /** Adds or replaces one saved assessment, keeping newest first. */
  function remember(item: SoilRecommendation) {
    setHistory((prev) =>
      [item, ...prev.filter((other) => other.id !== item.id)].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    );
  }

  // Soil inputs. Everything defaults to "unknown" so a Farmer can submit
  // without being forced to supply measurements they do not have.
  // Held as the typed text, not as numbers: a half-typed "6." is a valid
  // thing to have in the box and coercing on every keystroke would fight
  // the farmer's cursor.
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  function setReading(key: string, value: string) {
    setReadings((prev) => ({ ...prev, [key]: value }));
    // Clear the complaint as soon as they start fixing it.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /**
   * Loads every saved result on arrival — a plain database read that never
   * triggers Gemini, so revisiting the page or browsing old results costs no
   * quota.
   *
   * The page still opens on a blank form: a farmer arriving here usually has
   * new readings to enter. The saved results wait behind "See Result".
   */
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    (async () => {
      try {
        const saved = await fetchSoilRecommendations(accessToken);
        if (cancelled) return;
        setHistory(saved);
      } catch {
        // A failed restore is not worth surfacing — the Farmer can simply
        // fill in the form as normal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || status === "analyzing") return;

    // Check every reading before the request. Django validates these again -
    // this pass exists so an out-of-range number is caught beside the field
    // that caused it, rather than after a round trip.
    const errors: Record<string, string> = {};
    for (const field of SENSOR_FIELDS) {
      const message = validateReading(field, readings[field.key] ?? "", translate);
      if (message) errors[field.key] = message;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setStatus("analyzing");
    setError(null);

    try {
      const created = await createSoilRecommendation(currentInput(), accessToken);
      // Django raised "Soil recommendation ready" — reflect it immediately.
      requestNotificationRefresh();
      // Straight to the result: the row is already saved, and the result is
      // what the farmer submitted for.
      remember(created);
      setSelectedId(created.id);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof ApiError
          ? err.message
          : `${t.aiUnavailable} ${t.savedNotice}`,
      );
    }
  }

  /**
   * Re-runs Gemini on the assessment already saved. The stored soil
   * information is reused, so a Gemini outage never costs the Farmer their
   * typing - they only have to press the button again.
   */
  async function handleRetry() {
    if (!accessToken || !result || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const updated = await reanalyzeSoilRecommendation(accessToken, result.id);
      requestNotificationRefresh();
      remember(updated);
      if (!updated.ai_generated) setRetryError(t.stillUnavailable);
    } catch (err) {
      setRetryError(err instanceof ApiError ? err.message : t.stillUnavailable);
    } finally {
      setRetrying(false);
    }
  }

  /**
   * The readings as the API expects them: numbers.
   *
   * Only called once validation has passed, so every field is present and
   * parses - Number() here cannot produce a NaN.
   */
  function currentInput(): SoilRecommendationInput {
    const numeric = Object.fromEntries(
      SENSOR_FIELDS.map((field) => [field.key, Number(readings[field.key])]),
    ) as Omit<SoilRecommendationInput, "notes">;
    return { ...numeric, notes };
  }

  /**
   * "Back to Soil Information" — a blank form for the next assessment.
   *
   * The result is already in MySQL (the POST commits the row before Gemini
   * runs), so there is nothing to save here. It stays loaded, so "See
   * Result" can bring it straight back.
   */
  function showForm() {
    setReadings({});
    setFieldErrors({});
    setNotes("");
    setError(null);
    setRetryError(null);
    setStatus("idle");
  }

  /** "See Result" always opens the newest; older ones are a pick away. */
  function showResult() {
    setError(null);
    setRetryError(null);
    setSelectedId(history[0]?.id ?? null);
    setStatus("done");
  }

  function pickResult(id: number) {
    setRetryError(null);
    setSelectedId(id);
  }

  /** "September 24, 2026 · 2:28 PM · pH 5.40 (latest)" */
  function historyLabel(item: SoilRecommendation, index: number): string {
    const when = new Date(item.created_at).toLocaleString(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const parts = [when];
    if (item.soil_ph !== null) parts.push(`pH ${item.soil_ph}`);
    let label = parts.join(" · ");
    if (!item.ai_generated) label += ` — ${t.notAnalyzedTag}`;
    if (index === 0) label += ` (${t.latestTag})`;
    return label;
  }

  let headerAction: ReactNode = null;
  if (status === "idle" && history.length > 0) {
    headerAction = (
      <Button variant="outline" onClick={showResult}>
        {t.seeResult}
        <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
      </Button>
    );
  } else if (status === "done") {
    headerAction = (
      <Button variant="outline" onClick={showForm}>
        <ArrowLeft className="size-4 transition-transform duration-[250ms] group-hover/button:-translate-x-1" />
        {t.backToSoilInfo}
      </Button>
    );
  }

  const header = (
    <PageHeader
      title={translate("soilPage.title")}
      description={translate("soilPage.description")}
      action={headerAction}
    />
  );

  if (status === "analyzing") {
    return (
      <>
        {header}
        <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-sm font-medium">{t.analyzing}</p>
          <p className="text-muted-foreground max-w-xs text-sm">{t.analyzingHint}</p>
        </div>
      </>
    );
  }

  if (status === "done" && result) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-5">
          {/* Past results. Picking one is a lookup in what is already loaded,
              so it costs no request and no Gemini quota. */}
          {history.length > 1 && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <Label htmlFor="soil-history">{t.resultFrom}</Label>
              <select
                id="soil-history"
                value={result.id}
                onChange={(e) => pickResult(Number(e.target.value))}
                className="border-border bg-background min-w-0 rounded-md border px-2 py-1.5 text-sm outline-none sm:max-w-md sm:flex-1"
              >
                {history.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {historyLabel(item, index)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/*
            Saved without an AI result. `failure_reason` is set only when Gemini
            was actually called and failed, so a save-only row must not be
            reported as an outage the Farmer never hit.
          */}
          {!result.ai_generated ? (
            <div className="border-border flex gap-3 rounded-lg border border-dashed px-4 py-4">
              <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t.assessmentSaved}</p>
                <p className="text-muted-foreground text-sm">
                  {result.failure_reason
                    ? `${t.aiUnavailable} ${t.retryHint}`
                    : t.notAnalyzed}
                </p>
                {retryError ? (
                  <p className="text-risk-high text-sm">{retryError}</p>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 self-start"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      {t.retrying}
                    </>
                  ) : (
                    <>
                      <RotateCw className="size-3.5" />
                      {result.failure_reason ? t.tryAgain : t.submit}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <SoilResultCard result={result} />
          )}

          {error ? <p className="text-risk-high text-sm">{error}</p> : null}

          {/* The POST already committed this row, so say so plainly. */}
          <p className="text-risk-low flex items-center gap-1.5 text-sm">
            <Check className="size-4" />
            {t.saveSuccess}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-medium">{t.sensorSectionTitle}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t.sensorSectionHint}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SENSOR_FIELDS.map((field) => (
            <SoilNumberField
              key={field.key}
              field={field}
              value={readings[field.key] ?? ""}
              error={fieldErrors[field.key]}
              onChange={(value) => setReading(field.key, value)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">
            {t.additionalInfo}{" "}
            <span className="text-muted-foreground font-normal">({t.optional})</span>
          </Label>
          <Textarea
            id="notes"
            placeholder={t.additionalInfoHint}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error ? <p className="text-risk-high text-sm">{error}</p> : null}

        <Button type="submit" size="lg" className="self-start">
          {t.submit}
          <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
        </Button>
      </form>
    </>
  );
}
