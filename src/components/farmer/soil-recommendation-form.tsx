"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SoilResultCard } from "@/components/farmer/soil-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  createSoilRecommendation,
  fetchLatestSoilRecommendation,
  type SoilRecommendationInput,
  type SoilRecommendation,
} from "@/lib/api/soil-api";
import { useAuth } from "@/lib/auth/auth-context";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import {
  DRAINAGE_OPTIONS,
  NUTRIENT_OPTIONS,
  SOIL_MOISTURE_OPTIONS,
  SOIL_STRINGS as t,
  SOIL_TEXTURE_OPTIONS,
  SOIL_TYPE_OPTIONS,
  type SoilOption,
} from "@/lib/soil-options";

type Status = "idle" | "analyzing" | "done";
type SaveState = "idle" | "saving" | "saved";

/**
 * One labelled Select. Extracted because the form has eight of them and the
 * Base UI trigger/value/content structure is verbose enough that repeating
 * it inline would bury the actual field list.
 */
function SoilSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: SoilOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {/* Base UI can emit null on clear; "unknown" is the safe fallback. */}
      <Select value={value} onValueChange={(next) => onChange(next ?? "unknown")}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select">
            {(selected: string) =>
              options.find((o) => o.value === selected)?.label ?? "Select"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  // Guards against a double-click firing two POSTs before React re-renders
  // the disabled button — state alone is not synchronous enough.
  const savingRef = useRef(false);

  // Soil inputs. Everything defaults to "unknown" so a Farmer can submit
  // without being forced to supply measurements they do not have.
  const [soilType, setSoilType] = useState("unknown");
  const [soilTexture, setSoilTexture] = useState("unknown");
  const [drainage, setDrainage] = useState("unknown");
  const [soilMoisture, setSoilMoisture] = useState("unknown");
  const [phLevel, setPhLevel] = useState("");
  const [nitrogen, setNitrogen] = useState("unknown");
  const [phosphorus, setPhosphorus] = useState("unknown");
  const [potassium, setPotassium] = useState("unknown");
  const [organicMatter, setOrganicMatter] = useState("unknown");
  const [notes, setNotes] = useState("");

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

  /** The soil inputs as the API expects them. */
  function currentInput(): SoilRecommendationInput {
    return {
      soil_type: soilType,
      soil_texture: soilTexture,
      drainage,
      soil_moisture: soilMoisture,
      ph_level: phLevel.trim() === "" ? null : Number(phLevel),
      nitrogen,
      phosphorus,
      potassium,
      organic_matter: organicMatter,
      notes,
    };
  }

  /** Clears every field so the Farmer starts a genuinely new assessment. */
  function resetForNewAssessment() {
    setSoilType("unknown");
    setSoilTexture("unknown");
    setDrainage("unknown");
    setSoilMoisture("unknown");
    setPhLevel("");
    setNitrogen("unknown");
    setPhosphorus("unknown");
    setPotassium("unknown");
    setOrganicMatter("unknown");
    setNotes("");
    setResult(null);
    setError(null);
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
                {result.failure_reason ? t.aiUnavailable : t.notAnalyzed}
              </p>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SoilSelect
          id="soil-type"
          label={t.soilType}
          options={SOIL_TYPE_OPTIONS}
          value={soilType}
          onChange={setSoilType}
        />
        <SoilSelect
          id="soil-texture"
          label={t.soilTexture}
          options={SOIL_TEXTURE_OPTIONS}
          value={soilTexture}
          onChange={setSoilTexture}
        />
        <SoilSelect
          id="drainage"
          label={t.drainage}
          options={DRAINAGE_OPTIONS}
          value={drainage}
          onChange={setDrainage}
        />
        <SoilSelect
          id="soil-moisture"
          label={t.soilMoisture}
          options={SOIL_MOISTURE_OPTIONS}
          value={soilMoisture}
          onChange={setSoilMoisture}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="ph-level">
            {t.phLevel}{" "}
            <span className="text-muted-foreground font-normal">({t.optional})</span>
          </Label>
          <Input
            id="ph-level"
            type="number"
            min={0}
            max={14}
            step={0.1}
            placeholder="e.g. 6.5"
            value={phLevel}
            onChange={(e) => setPhLevel(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{t.phHint}</p>
        </div>

        <SoilSelect
          id="organic-matter"
          label={t.organicMatter}
          options={NUTRIENT_OPTIONS}
          value={organicMatter}
          onChange={setOrganicMatter}
        />
        <SoilSelect
          id="nitrogen"
          label={t.nitrogen}
          options={NUTRIENT_OPTIONS}
          value={nitrogen}
          onChange={setNitrogen}
        />
        <SoilSelect
          id="phosphorus"
          label={t.phosphorus}
          options={NUTRIENT_OPTIONS}
          value={phosphorus}
          onChange={setPhosphorus}
        />
        <SoilSelect
          id="potassium"
          label={t.potassium}
          options={NUTRIENT_OPTIONS}
          value={potassium}
          onChange={setPotassium}
        />
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
