"use client";

import Link from "next/link";
import { ArrowRight, Camera, History, LoaderCircle, ScanEye, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import {
  EvidenceUpload,
  type EvidenceUploadHandle,
} from "@/components/farmer/evidence-upload";
import { EvidenceVerdict } from "@/components/farmer/evidence-verdict";
import { NextDuePlant } from "@/components/farmer/next-due-plant";
import { RiskInfoNote, RiskResultCard } from "@/components/risk/risk-result-card";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/components/ui/date-picker";
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
import {
  AssessmentApiError,
  submitAssessment,
  validateEvidence,
  type AssessmentEligibility,
  type BackendAssessment,
  type EvidenceValidation,
  type SuggestibleAnswer,
} from "@/lib/api/risk-api";
import type { AssessmentQuestion } from "@/lib/api/plants-api";
import { useAuth } from "@/lib/auth/auth-context";
import { useLanguage, type MessageKey, type Translate } from "@/lib/i18n";
import { requestNotificationRefresh } from "@/lib/notification-refresh";

type Option = { value: string; label: MessageKey };

// The values are what Django stores; only the labels are translated.
const GROWTH: Option[] = [
  { value: "faster_than_expected", label: "opt.growth.faster_than_expected" },
  { value: "as_expected", label: "opt.growth.as_expected" },
  { value: "slower_than_expected", label: "opt.growth.slower_than_expected" },
  { value: "stunted", label: "opt.growth.stunted" },
];
const HEALTH: Option[] = [
  { value: "healthy", label: "opt.health.healthy" },
  { value: "slightly_unhealthy", label: "opt.health.slightly_unhealthy" },
  { value: "unhealthy", label: "opt.health.unhealthy" },
];
const LEAF: Option[] = [
  { value: "healthy", label: "opt.leaf.healthy" },
  { value: "slight_yellowing", label: "opt.leaf.slight_yellowing" },
  { value: "yellowing", label: "opt.leaf.yellowing" },
  { value: "spots", label: "opt.leaf.spots" },
  { value: "wilting", label: "opt.leaf.wilting" },
  { value: "damaged", label: "opt.leaf.damaged" },
];
const FLOWERING: Option[] = [
  { value: "not_flowering", label: "opt.flowering.not_flowering" },
  { value: "starting", label: "opt.flowering.starting" },
  { value: "flowering", label: "opt.flowering.flowering" },
  { value: "finished", label: "opt.flowering.finished" },
];
const FRUITING: Option[] = [
  { value: "not_fruiting", label: "opt.fruiting.not_fruiting" },
  { value: "forming", label: "opt.fruiting.forming" },
  { value: "developing", label: "opt.fruiting.developing" },
  { value: "ripening", label: "opt.fruiting.ripening" },
];
const WATERING: Option[] = [
  { value: "daily", label: "opt.watering.daily" },
  { value: "every_other_day", label: "opt.watering.every_other_day" },
  { value: "twice_weekly", label: "opt.watering.twice_weekly" },
  { value: "weekly", label: "opt.watering.weekly" },
  { value: "rain_fed", label: "opt.watering.rain_fed" },
];
const SOIL: Option[] = [
  { value: "dry", label: "opt.soil.dry" },
  { value: "slightly_dry", label: "opt.soil.slightly_dry" },
  { value: "moist", label: "opt.soil.moist" },
  { value: "wet", label: "opt.soil.wet" },
  { value: "waterlogged", label: "opt.soil.waterlogged" },
];

function label(options: Option[], value: string | null, placeholder: string, t: Translate) {
  const option = options.find((o) => o.value === value);
  return option ? t(option.label) : placeholder;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Choice({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: Option[];
  placeholder: string;
}) {
  const { t } = useLanguage();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder}>
          {(v: string) => label(options, v, placeholder, t)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The choice questions the form can start already answered. */
type Prefilled =
  | SuggestibleAnswer
  | "growth_condition"
  | "watering_frequency"
  | "soil_moisture";
type AnswerSource = "photo" | "last";

const CARRIED: Prefilled[] = [
  "growth_condition",
  "health_condition",
  "leaf_condition",
  "flowering_status",
  "fruiting_status",
  "watering_frequency",
  "soil_moisture",
];

/** The last check's answers worth starting from: given, and still asked. */
function carriedAnswers(
  last: BackendAssessment | null,
  skipQuestions: AssessmentQuestion[],
): Partial<Record<Prefilled, string>> {
  if (!last) return {};
  const carried: Partial<Record<Prefilled, string>> = {};
  for (const field of CARRIED) {
    const value = last[field];
    if (value && !skipQuestions.includes(field as AssessmentQuestion)) carried[field] = value;
  }
  return carried;
}

/** A question's label, marked while its answer came from the photo or the last check. */
function AnswerLabel({
  htmlFor,
  source,
  children,
}: {
  htmlFor: string;
  source?: AnswerSource;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const Icon = source === "photo" ? Camera : History;
  return (
    <Label htmlFor={htmlFor} className="flex flex-wrap items-center gap-2">
      {children}
      {source && (
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
          <Icon className="size-3" />
          {t(source === "photo" ? "asmt.fromPhoto" : "asmt.fromLastCheck")}
        </span>
      )}
    </Label>
  );
}

/**
 * `checking` = verifying the photo shows the right crop;
 * `analyzing` = the risk evaluation, which only runs on verified evidence.
 */
type Status = "idle" | "checking" | "analyzing" | "done";

export function AssessmentForm({
  plantId,
  plantLabel,
  cropName,
  skipQuestions = [],
  lastAssessment = null,
  onLocked,
}: {
  plantId: number;
  plantLabel: string;
  cropName: string;
  /** Questions that don't fit this crop (e.g. leaves on a mushroom). */
  skipQuestions?: AssessmentQuestion[];
  /** This plant's previous assessment; its answers start the form. */
  lastAssessment?: BackendAssessment | null;
  /** Called when the server reports the weekly assessment is already done. */
  onLocked?: (eligibility: AssessmentEligibility) => void;
}) {
  const { accessToken } = useAuth();
  const { t, dateLocale } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BackendAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Where the photo contradicted the answers, one sentence per answer.
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [evidenceResult, setEvidenceResult] = useState<EvidenceValidation | null>(null);
  const uploadRef = useRef<EvidenceUploadHandle>(null);

  // Where the choice answers start: the last check's answers, so a plant that
  // has not changed needs no re-answering. Height and the written notes are
  // left empty; they are this week's to give.
  const [carried] = useState(() => carriedAnswers(lastAssessment, skipQuestions));

  const [height, setHeight] = useState("");
  const [growth, setGrowth] = useState<string | null>(carried.growth_condition ?? "as_expected");
  const [health, setHealth] = useState<string | null>(carried.health_condition ?? "healthy");
  const [leaf, setLeaf] = useState<string | null>(carried.leaf_condition ?? null);
  const [flowering, setFlowering] = useState<string | null>(carried.flowering_status ?? null);
  const [fruiting, setFruiting] = useState<string | null>(carried.fruiting_status ?? null);
  const [watering, setWatering] = useState<string | null>(carried.watering_frequency ?? "daily");
  const [soil, setSoil] = useState<string | null>(carried.soil_moisture ?? null);
  const [pest, setPest] = useState("");
  const [disease, setDisease] = useState("");
  const [environment, setEnvironment] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);

  // The photo comes first and is checked as soon as it is taken. An accepted
  // photo also suggests the answers it shows (health, leaves, flowering,
  // fruiting), which replace the last check's: the photo is newer. Neither
  // ever replaces an answer the Farmer chose themselves.
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [sources, setSources] = useState<Partial<Record<Prefilled, AnswerSource>>>(() =>
    Object.fromEntries(Object.keys(carried).map((field) => [field, "last"])),
  );
  const touched = useRef(new Set<Prefilled>());
  // Only the latest photo's check may update the form.
  const checkRun = useRef(0);

  const setters: Record<Prefilled, (value: string | null) => void> = {
    growth_condition: setGrowth,
    health_condition: setHealth,
    leaf_condition: setLeaf,
    flowering_status: setFlowering,
    fruiting_status: setFruiting,
    watering_frequency: setWatering,
    soil_moisture: setSoil,
  };
  const countFrom = (source: AnswerSource) =>
    Object.values(sources).filter((s) => s === source).length;
  const fromPhotoCount = countFrom("photo");
  const fromLastCount = countFrom("last");

  /** The Farmer's own answer: kept from now on, and no longer marked. */
  function answer(field: Prefilled, value: string | null) {
    touched.current.add(field);
    setSources((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setters[field](value);
  }

  // Evidence is mandatory: the risk reading is only meaningful when the photo
  // has been verified to show this crop.
  const asks = (question: AssessmentQuestion) => !skipQuestions.includes(question);
  const photoRefused = evidenceResult !== null && !evidenceResult.evidence_valid;
  const canSubmit = Boolean(
    growth &&
      health &&
      (leaf || !asks("leaf_condition")) &&
      watering &&
      evidence &&
      !checkingPhoto &&
      !photoRefused,
  );

  function changeEvidence(file: File | null) {
    setEvidence(file);
    // A new photo invalidates the previous verdict and its token.
    setEvidenceResult(null);
    setError(null);
    setConflicts([]);
    // The answers stay; they are just no longer this photo's suggestions.
    setSources((current) =>
      Object.fromEntries(Object.entries(current).filter(([, source]) => source !== "photo")),
    );
    const run = ++checkRun.current;
    if (file && accessToken) {
      void checkPhoto(file, run, accessToken);
    } else {
      setCheckingPhoto(false);
    }
  }

  async function checkPhoto(file: File, run: number, token: string) {
    setCheckingPhoto(true);
    try {
      const verification = await validateEvidence(token, plantId, file);
      if (run !== checkRun.current) return;
      setEvidenceResult(verification);
      if (verification.evidence_valid) applySuggestions(verification);
    } catch (err) {
      if (run !== checkRun.current) return;
      // The check runs again on submit, so the Farmer can carry on.
      setError(err instanceof Error ? err.message : t("asmt.verifyFailed"));
    } finally {
      if (run === checkRun.current) setCheckingPhoto(false);
    }
  }

  function applySuggestions(verification: EvidenceValidation) {
    const filled: Partial<Record<Prefilled, AnswerSource>> = {};
    for (const [field, value] of Object.entries(verification.suggested_answers ?? {})) {
      const key = field as SuggestibleAnswer;
      if (
        !value ||
        !(key in setters) ||
        skipQuestions.includes(key as AssessmentQuestion) ||
        touched.current.has(key)
      ) {
        continue;
      }
      setters[key](value);
      filled[key] = "photo";
    }
    setSources((current) => ({ ...current, ...filled }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !accessToken || !evidence) return;

    setError(null);
    setConflicts([]);

    // Step 1 — verify the photo actually shows this crop. Nothing is saved
    // and no risk evaluation runs until this passes. Usually already done
    // when the photo was taken; it runs here only if that check failed.
    let verification: EvidenceValidation;
    if (evidenceResult?.evidence_valid) {
      verification = evidenceResult;
    } else {
      setStatus("checking");
      try {
        verification = await validateEvidence(accessToken, plantId, evidence);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("asmt.verifyFailed"),
        );
        setStatus("idle");
        return;
      }

      setEvidenceResult(verification);
      if (!verification.evidence_valid) {
        // The photo stays selected so the Farmer can replace it deliberately.
        setStatus("idle");
        return;
      }
    }

    // Step 2 — risk evaluation, on verified evidence.
    setStatus("analyzing");
    try {
      const assessment = await submitAssessment(
        accessToken,
        plantId,
        {
          plant_height_cm: asks("plant_height_cm") ? height : "",
          growth_condition: growth!,
          health_condition: health!,
          leaf_condition: asks("leaf_condition") ? leaf! : "",
          flowering_status: asks("flowering_status") ? (flowering ?? "") : "",
          fruiting_status: asks("fruiting_status") ? (fruiting ?? "") : "",
          watering_frequency: watering!,
          soil_moisture: soil ?? "",
          pest_observation: pest,
          disease_observation: disease,
          environmental_observations: environment,
          notes,
        },
        evidence,
        verification.evidence_token,
      );
      // Django raised assessment-submitted, evidence and AI-evaluation
      // notifications during this request — surface them at once.
      requestNotificationRefresh();
      setResult(assessment);
      setStatus("done");
    } catch (err) {
      // The server is the authority on the weekly lock: if it says this plant
      // was already assessed, switch the page over to the locked state.
      if (err instanceof AssessmentApiError && err.status === 409) {
        const locked = err.payload.assessment_eligibility as
          | AssessmentEligibility
          | undefined;
        if (locked && onLocked) {
          onLocked(locked);
          return;
        }
      }
      // The photo contradicted the answers: nothing was saved, so the form
      // stays filled in for the Farmer to correct and resubmit.
      if (err instanceof AssessmentApiError && err.payload.answers_mismatch) {
        const listed = err.payload.answer_conflicts;
        setConflicts(Array.isArray(listed) ? listed.map(String) : []);
        setError(t("asmt.answersMismatch"));
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : t("asmt.wentWrong"));
      setStatus("idle");
    }
  }

  if (status === "checking") {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
        <ScanEye className="text-primary size-6 animate-pulse" />
        <p className="font-heading text-sm font-medium">{t("asmt.checking")}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {t("asmt.checkingText")}
        </p>
      </div>
    );
  }

  if (status === "analyzing") {
    return (
      <div className="flex flex-col gap-4">
        {evidenceResult && <EvidenceVerdict result={evidenceResult} />}
        <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="font-heading text-sm font-medium">{t("asmt.evaluating", { name: plantLabel })}</p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>{t("asmt.step1")}</li>
            <li>{t("asmt.step2")}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="flex flex-col gap-4">
        <RiskResultCard assessment={result} />
        <RiskInfoNote />
        <NextDuePlant currentPlantId={plantId} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/risk-indicator" />}
          >
            {t("asmt.backToRisk")}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/assessments" />}
          >
            {t("lock.past")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormSection
        title={t("asmt.evidence")}
        description={t("asmt.evidenceText", { crop: cropName.toLowerCase() })}
      >
        <EvidenceUpload ref={uploadRef} file={evidence} onChange={changeEvidence} />
        {checkingPhoto && (
          <div className="border-border flex items-start gap-3 rounded-xl border border-dashed px-4 py-3">
            <ScanEye className="text-primary mt-0.5 size-4 shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-medium">{t("asmt.photoChecking")}</p>
              <p className="text-muted-foreground text-sm">{t("asmt.photoCheckingText")}</p>
            </div>
          </div>
        )}
        {evidenceResult && (
          <EvidenceVerdict
            result={evidenceResult}
            onReplace={() => uploadRef.current?.openPicker()}
          />
        )}
        {fromPhotoCount > 0 && (
          <p className="bg-primary/5 border-primary/20 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
            <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
            {fromPhotoCount === 1
              ? t("asmt.prefilledOne")
              : t("asmt.prefilled", { n: fromPhotoCount })}
          </p>
        )}
      </FormSection>

      {fromLastCount > 0 && lastAssessment && (
        <p className="bg-muted/40 border-border flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <History className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          {t("asmt.lastCheckFilled", {
            date: formatDisplayDate(lastAssessment.assessment_date, dateLocale),
          })}
        </p>
      )}

      <FormSection title={t("asmt.growth")} description={t("asmt.growthText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {asks("plant_height_cm") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="height">{t("asmt.height")}</Label>
              <Input
                id="height"
                type="number"
                min={0}
                step={0.1}
                placeholder={t("asmt.heightExample")}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <AnswerLabel htmlFor="growth" source={sources.growth_condition}>
              {t("asmt.growthCompared")}
            </AnswerLabel>
            <Choice
              id="growth"
              value={growth}
              onChange={(v) => answer("growth_condition", v)}
              options={GROWTH}
              placeholder={t("asmt.select")}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.health")} description={t("asmt.healthText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <AnswerLabel htmlFor="health" source={sources.health_condition}>
              {t("asmt.overallHealth")}
            </AnswerLabel>
            <Choice id="health" value={health} onChange={(v) => answer("health_condition", v)} options={HEALTH} placeholder={t("asmt.select")} />
          </div>
          {asks("leaf_condition") && (
            <div className="flex flex-col gap-2">
              <AnswerLabel htmlFor="leaf" source={sources.leaf_condition}>
                {t("asmt.leaf")}
              </AnswerLabel>
              <Choice id="leaf" value={leaf} onChange={(v) => answer("leaf_condition", v)} options={LEAF} placeholder={t("asmt.select")} />
            </div>
          )}
        </div>
      </FormSection>

      {(asks("flowering_status") || asks("fruiting_status")) && (
        <FormSection title={t("asmt.flowerFruit")} description={t("asmt.blankIfNA")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {asks("flowering_status") && (
              <div className="flex flex-col gap-2">
                <AnswerLabel htmlFor="flowering" source={sources.flowering_status}>
                  {t("asmt.flowering")}
                </AnswerLabel>
                <Choice id="flowering" value={flowering} onChange={(v) => answer("flowering_status", v)} options={FLOWERING} placeholder={t("asmt.select")} />
              </div>
            )}
            {asks("fruiting_status") && (
              <div className="flex flex-col gap-2">
                <AnswerLabel htmlFor="fruiting" source={sources.fruiting_status}>
                  {t("asmt.fruiting")}
                </AnswerLabel>
                <Choice id="fruiting" value={fruiting} onChange={(v) => answer("fruiting_status", v)} options={FRUITING} placeholder={t("asmt.select")} />
              </div>
            )}
          </div>
        </FormSection>
      )}

      <FormSection title={t("asmt.waterSoil")} description={t("asmt.waterSoilText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <AnswerLabel htmlFor="watering" source={sources.watering_frequency}>
              {t("asmt.watering")}
            </AnswerLabel>
            <Choice id="watering" value={watering} onChange={(v) => answer("watering_frequency", v)} options={WATERING} placeholder={t("asmt.select")} />
          </div>
          <div className="flex flex-col gap-2">
            <AnswerLabel htmlFor="soil" source={sources.soil_moisture}>
              {t("asmt.soil")}
            </AnswerLabel>
            <Choice id="soil" value={soil} onChange={(v) => answer("soil_moisture", v)} options={SOIL} placeholder={t("asmt.select")} />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.symptoms")} description={t("asmt.symptomsText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pest">{t("asmt.pest")}</Label>
            <Textarea id="pest" placeholder={t("asmt.noneObserved")} value={pest} onChange={(e) => setPest(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disease">{t("asmt.disease")}</Label>
            <Textarea id="disease" placeholder={t("asmt.noneObserved")} value={disease} onChange={(e) => setDisease(e.target.value)} />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.observations")} description={t("asmt.observationsText")}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="environment">{t("asmt.environment")}</Label>
          <Textarea
            id="environment"
            placeholder={t("asmt.environmentExample")}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">{t("asmt.notes")}</Label>
          <Textarea
            id="notes"
            placeholder={t("asmt.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{t("asmt.anyLanguage")}</p>
        </div>
      </FormSection>

      {error && (
        <div className="text-destructive text-sm">
          <p>{error}</p>
          {conflicts.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit} className="self-start">
          {t("asmt.submit")}
          <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
        </Button>
        {(!evidence || photoRefused) && (
          <p className="text-muted-foreground text-sm">
            {t(evidence ? "asmt.needNewPhoto" : "asmt.needPhoto")}
          </p>
        )}
      </div>
    </form>
  );
}
