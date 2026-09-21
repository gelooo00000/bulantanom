"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SoilResultCard } from "@/components/farmer/soil-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  createSoilRecommendation,
  fetchLatestSoilRecommendation,
  reanalyzeSoilRecommendation,
  type SoilRecommendationInput,
  type SoilRecommendation,
} from "@/lib/api/soil-api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import {
  SENSOR_FIELDS,
  SOIL_STRINGS as t,
  validateReading,
  type SensorField,
} from "@/lib/soil-options";

type Status = "idle" | "analyzing" | "done";
type SaveState = "idle" | "saving" | "saved";

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
  const id = `soil-${field.key.replace(/_/g, "-")}`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{field.label}</Label>
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
          {field.min} to {field.max} {field.unit}
        </p>
      )}
    </div>
  );
}

/**
 * Remembers that the Farmer deliberately started a new assessment, so a
 * reload does not restore the one they just stepped away from. Cleared as
 * soon as they submit, since the fresh result then *is* the latest.
 *
 * sessionStorage rather than state: it must survive a page reload, but it is
 * a transient intent, not a saved preference, so it should not outlive the
 * tab. Wrapped because storage access throws in some privacy modes.
 */
const NEW_ASSESSMENT_KEY = "bulantanom_soil_new_assessment";

function wantsNewAssessment(): boolean {
  try {
    return window.sessionStorage.getItem(NEW_ASSESSMENT_KEY) === "1";
  } catch {
    return false;
  }
}

function setWantsNewAssessment(wants: boolean) {
  try {
    if (wants) window.sessionStorage.setItem(NEW_ASSESSMENT_KEY, "1");
    else window.sessionStorage.removeItem(NEW_ASSESSMENT_KEY);
  } catch {
    // Storage unavailable — the in-memory reset still works for this view.
  }
}

export function SoilRecommendationForm() {
  const { accessToken } = useAuth();

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SoilRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  // Guards against a double-click firing two POSTs before React re-renders
  // the disabled button — state alone is not synchronous enough.
  const savingRef = useRef(false);

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
   * Restores the last saved result on load — a plain database read that
   * never triggers Gemini, so revisiting the page costs no quota.
   *
   * Skipped while the "start a new assessment" flag is set. Without that
   * check, clicking "Back to Soil Information" cleared the form but a reload
   * immediately fetched the previous assessment back, dragging the Farmer
   * into the old data they had just chosen to leave.
   */
  useEffect(() => {
    if (!accessToken) return;
    if (wantsNewAssessment()) return;

    let cancelled = false;
    (async () => {
      try {
        const latest = await fetchLatestSoilRecommendation(accessToken);
        if (cancelled || !latest) return;
        setResult(latest);
        setStatus("done");
        // Put the saved readings back in the inputs, so stepping back to
        // "Soil Information" shows what was submitted rather than a blank
        // form the Farmer would have to retype from the device.
        if (latest.has_sensor_readings) {
          setReadings(
            Object.fromEntries(
              SENSOR_FIELDS.map((field) => {
                const value = latest[field.key];
                return [field.key, value === null ? "" : String(value)];
              }),
            ),
          );
        }
        setNotes(latest.notes ?? "");
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
      const message = validateReading(field, readings[field.key] ?? "");
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
      // This submission is now the latest, so restoring it on reload is
      // exactly what the Farmer expects.
      setWantsNewAssessment(false);
      setResult(created);
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
      setResult(updated);
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

  /** Clears every field so the Farmer starts a genuinely new assessment. */
  function resetForNewAssessment() {
    setReadings({});
    setFieldErrors({});
    setNotes("");
    setResult(null);
    setError(null);
    setRetryError(null);
    setStatus("idle");
    setSaveState("idle");
    savingRef.current = false;
    // Survives a reload, so the blank form stays blank.
    setWantsNewAssessment(true);
  }

  /**
   * "Back to Soil Information" — confirms, then opens a blank form.
   *
   * Only rendered on the result screen, where the assessment is already in
   * MySQL (the POST commits the row before Gemini runs). So there is nothing
   * left to save: this acknowledges the save and hands back a clean form,
   * flagged so a reload does not drag the old assessment back.
   */
  function handleBack() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saved");
    window.setTimeout(resetForNewAssessment, 550);
  }

  /** Rendered on the result screen only. */
  function backButton() {
    return (
      <Button
        variant="outline"
        className="self-start"
        onClick={handleBack}
        disabled={saveState !== "idle"}
      >
        {saveState === "saved" ? (
          <>
            <Check className="text-risk-low size-4" />
            {t.saved}
          </>
        ) : (
          <>
            <ArrowLeft className="size-4 transition-transform duration-[250ms] group-hover/button:-translate-x-1" />
            {t.backToSoilInfo}
          </>
        )}
      </Button>
    );
  }

  if (status === "analyzing") {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-sm font-medium">{t.analyzing}</p>
        <p className="text-muted-foreground max-w-xs text-sm">{t.analyzingHint}</p>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="flex flex-col gap-5">
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

        {backButton()}
      </div>
    );
  }

  return (
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
  );
}
