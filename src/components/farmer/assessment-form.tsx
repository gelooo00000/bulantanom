"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  History,
  RotateCcw,
  LoaderCircle,
  ScanEye,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  EvidenceUpload,
  type EvidenceUploadHandle,
} from "@/components/farmer/evidence-upload";
import {
  ChoiceButtons,
  LeafPicture,
  SymptomChecklist,
  type ChoiceOption,
} from "@/components/farmer/assessment-choices";
import { EvidenceVerdict } from "@/components/farmer/evidence-verdict";
import { FarmWeekWeather } from "@/components/farmer/farm-week-weather";
import { NextDuePlant } from "@/components/farmer/next-due-plant";
import { RiskInfoNote, RiskResultCard } from "@/components/risk/risk-result-card";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { clearDraft, readDraft, saveDraft } from "@/lib/assessment-draft";
import { useLanguage } from "@/lib/i18n";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { symptomsFor, toObservationText, type Disease, type Pest } from "@/lib/symptoms";

// The values are what Django stores; only the labels are translated.
const GROWTH: ChoiceOption[] = [
  { value: "faster_than_expected", label: "opt.growth.faster_than_expected" },
  { value: "as_expected", label: "opt.growth.as_expected" },
  { value: "slower_than_expected", label: "opt.growth.slower_than_expected" },
  { value: "stunted", label: "opt.growth.stunted" },
];
const HEALTH: ChoiceOption[] = [
  { value: "healthy", label: "opt.health.healthy", picture: <span className="bg-risk-low block size-2.5 rounded-full" /> },
  {
    value: "slightly_unhealthy",
    label: "opt.health.slightly_unhealthy",
    picture: <span className="bg-risk-medium block size-2.5 rounded-full" />,
  },
  { value: "unhealthy", label: "opt.health.unhealthy", picture: <span className="bg-risk-high block size-2.5 rounded-full" /> },
];
const LEAF: ChoiceOption[] = [
  { value: "healthy", label: "opt.leaf.healthy", picture: <LeafPicture look="healthy" /> },
  { value: "slight_yellowing", label: "opt.leaf.slight_yellowing", picture: <LeafPicture look="slight_yellowing" /> },
  { value: "yellowing", label: "opt.leaf.yellowing", picture: <LeafPicture look="yellowing" /> },
  { value: "spots", label: "opt.leaf.spots", picture: <LeafPicture look="spots" /> },
  { value: "wilting", label: "opt.leaf.wilting", picture: <LeafPicture look="wilting" /> },
  { value: "damaged", label: "opt.leaf.damaged", picture: <LeafPicture look="damaged" /> },
];
const FLOWERING: ChoiceOption[] = [
  { value: "not_flowering", label: "opt.flowering.not_flowering" },
  { value: "starting", label: "opt.flowering.starting" },
  { value: "flowering", label: "opt.flowering.flowering" },
  { value: "finished", label: "opt.flowering.finished" },
];
const FRUITING: ChoiceOption[] = [
  { value: "not_fruiting", label: "opt.fruiting.not_fruiting" },
  { value: "forming", label: "opt.fruiting.forming" },
  { value: "developing", label: "opt.fruiting.developing" },
  { value: "ripening", label: "opt.fruiting.ripening" },
];
const WATERING: ChoiceOption[] = [
  { value: "daily", label: "opt.watering.daily" },
  { value: "every_other_day", label: "opt.watering.every_other_day" },
  { value: "twice_weekly", label: "opt.watering.twice_weekly" },
  { value: "weekly", label: "opt.watering.weekly" },
  { value: "rain_fed", label: "opt.watering.rain_fed" },
];
const SOIL: ChoiceOption[] = [
  { value: "dry", label: "opt.soil.dry" },
  { value: "slightly_dry", label: "opt.soil.slightly_dry" },
  { value: "moist", label: "opt.soil.moist" },
  { value: "wet", label: "opt.soil.wet" },
  { value: "waterlogged", label: "opt.soil.waterlogged" },
];

function FormSection({
  id,
  title,
  description,
  children,
}: {
  /** Lets the "still needed" list scroll here. */
  id?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
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

/** A draft's answers that still fit this form: known questions this crop is asked. */
function draftAnswers(
  draft: { answers: Record<string, string> } | null,
  skipQuestions: AssessmentQuestion[],
): Partial<Record<Prefilled, string>> {
  if (!draft) return {};
  return Object.fromEntries(
    Object.entries(draft.answers).filter(
      ([field]) =>
        (CARRIED as string[]).includes(field) &&
        !skipQuestions.includes(field as AssessmentQuestion),
    ),
  );
}

/** A question's label, marked while its answer came from the photo or the last check. */
function AnswerLabel({
  id,
  source,
  missing = false,
  children,
}: {
  /** Named by the question's buttons through aria-labelledby. */
  id: string;
  source?: AnswerSource;
  /** A required question still unanswered: marked so it is easy to find. */
  missing?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const Icon = source === "photo" ? Camera : History;
  return (
    <Label id={id} className="flex scroll-mt-24 flex-wrap items-center gap-2">
      {children}
      {missing && (
        <span className="text-risk-medium text-xs font-medium">{t("asmt.required")}</span>
      )}
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

type AssessmentFormProps = {
  plantId: number;
  plantLabel: string;
  /** Picks the pests and disease signs offered as tick boxes. */
  cropId: string;
  /** Questions that don't fit this crop (e.g. leaves on a mushroom). */
  skipQuestions?: AssessmentQuestion[];
  /** This plant's previous assessment; its answers start the form. */
  lastAssessment?: BackendAssessment | null;
  /** Called when the server reports the weekly assessment is already done. */
  onLocked?: (eligibility: AssessmentEligibility) => void;
};

export function AssessmentForm(props: AssessmentFormProps) {
  // "Start over" drops the saved draft and remounts the form from scratch.
  const [round, setRound] = useState(0);
  return (
    <AssessmentFormBody
      key={round}
      {...props}
      onStartOver={() => {
        clearDraft(props.plantId);
        setRound((n) => n + 1);
      }}
    />
  );
}

function AssessmentFormBody({
  plantId,
  plantLabel,
  cropId,
  skipQuestions = [],
  lastAssessment = null,
  onLocked,
  onStartOver,
}: AssessmentFormProps & { onStartOver: () => void }) {
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
  // Today's unsent answers for this plant, if the farmer left mid-way. They
  // are the farmer's own, so they win over the last check and the photo.
  const [draft] = useState(() => readDraft(plantId));
  const [own] = useState(() => draftAnswers(draft, skipQuestions));
  // Otherwise a question starts unanswered: a ready-made "Healthy" or
  // "Daily" could be submitted without a thought, and looks like the AI's.
  const start = (field: Prefilled): string | null =>
    field in own ? own[field] || null : (carried[field] ?? null);

  const [height, setHeight] = useState(draft?.height ?? "");
  const [growth, setGrowth] = useState<string | null>(start("growth_condition"));
  const [health, setHealth] = useState<string | null>(start("health_condition"));
  const [leaf, setLeaf] = useState<string | null>(start("leaf_condition"));
  const [flowering, setFlowering] = useState<string | null>(start("flowering_status"));
  const [fruiting, setFruiting] = useState<string | null>(start("fruiting_status"));
  const [watering, setWatering] = useState<string | null>(start("watering_frequency"));
  const [soil, setSoil] = useState<string | null>(start("soil_moisture"));
  const symptoms = symptomsFor(cropId);
  const [pests, setPests] = useState<ReadonlySet<Pest>>(
    () => new Set(symptoms.pests.filter((item) => draft?.pests.includes(item))),
  );
  const [diseases, setDiseases] = useState<ReadonlySet<Disease>>(
    () => new Set(symptoms.diseases.filter((item) => draft?.diseases.includes(item))),
  );
  const [notes, setNotes] = useState(draft?.notes ?? "");
  // Symptoms, height and notes sit behind "Add more details": closed, unless
  // a draft brought something back in there.
  const [showDetails, setShowDetails] = useState(
    Boolean(draft?.height || draft?.notes || draft?.pests.length || draft?.diseases.length),
  );
  const [evidence, setEvidence] = useState<File | null>(null);

  // The photo comes first and is checked as soon as it is taken. An accepted
  // photo also suggests the answers it shows (health, leaves, flowering,
  // fruiting), which replace the last check's: the photo is newer. Neither
  // ever replaces an answer the Farmer chose themselves.
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [sources, setSources] = useState<Partial<Record<Prefilled, AnswerSource>>>(() =>
    Object.fromEntries(
      Object.keys(carried)
        .filter((field) => !(field in own))
        .map((field) => [field, "last"]),
    ),
  );
  const touched = useRef(new Set<Prefilled>(Object.keys(own) as Prefilled[]));
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

  // Saved on every change. Reads `touched` here, in an effect: each answer
  // the farmer gives also changes one of the values below, so this runs.
  useEffect(() => {
    if (status === "analyzing" || status === "done") return;
    const values: Record<Prefilled, string | null> = {
      growth_condition: growth,
      health_condition: health,
      leaf_condition: leaf,
      flowering_status: flowering,
      fruiting_status: fruiting,
      watering_frequency: watering,
      soil_moisture: soil,
    };
    saveDraft(plantId, {
      answers: Object.fromEntries(
        [...touched.current].map((field) => [field, values[field] ?? ""]),
      ),
      height,
      notes,
      pests: [...pests],
      diseases: [...diseases],
    });
  }, [plantId, status, growth, health, leaf, flowering, fruiting, watering, soil, height, notes, pests, diseases]);

  // Evidence is mandatory: the risk reading is only meaningful when the photo
  // has been verified to show this crop.
  const asks = (question: AssessmentQuestion) => !skipQuestions.includes(question);
  const leafMissing = asks("leaf_condition") && !leaf;
  // "Not flowering" / "Not fruiting" are answers too, so these are required
  // for every crop they are asked of.
  const floweringMissing = asks("flowering_status") && !flowering;
  const fruitingMissing = asks("fruiting_status") && !fruiting;
  const photoRefused = evidenceResult !== null && !evidenceResult.evidence_valid;
  // What still stands between the farmer and Submit, in form order, each
  // with where to scroll to.
  const stillNeeded: { label: string; target: string }[] = [];
  if (!evidence || photoRefused) stillNeeded.push({ label: t("asmt.photoItem"), target: "asmt-photo" });
  if (!growth) stillNeeded.push({ label: t("asmt.growthCompared"), target: "growth-label" });
  if (!health) stillNeeded.push({ label: t("asmt.overallHealth"), target: "health-label" });
  if (leafMissing) stillNeeded.push({ label: t("asmt.leaf"), target: "leaf-label" });
  if (floweringMissing) stillNeeded.push({ label: t("asmt.flowering"), target: "flowering-label" });
  if (fruitingMissing) stillNeeded.push({ label: t("asmt.fruiting"), target: "fruiting-label" });
  if (!watering) stillNeeded.push({ label: t("asmt.watering"), target: "watering-label" });
  if (!soil) stillNeeded.push({ label: t("asmt.soil"), target: "soil-label" });
  const canSubmit = stillNeeded.length === 0 && !checkingPhoto;

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

  function toggle<T>(set: (update: (current: ReadonlySet<T>) => ReadonlySet<T>) => void, item: T) {
    set((current) => {
      const next = new Set(current);
      if (!next.delete(item)) next.add(item);
      return next;
    });
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
          soil_moisture: soil!,
          // In list order, so the same ticks always read the same way.
          pest_observation: toObservationText(
            symptoms.pests.filter((item) => pests.has(item)),
          ),
          disease_observation: toObservationText(
            symptoms.diseases.filter((item) => diseases.has(item)),
          ),
          // The weather is measured at the farm and attached by the server;
          // anything else the farmer noticed goes in the one notes box.
          environmental_observations: "",
          notes,
        },
        evidence,
        verification.evidence_token,
      );
      // Django raised assessment-submitted, evidence and AI-evaluation
      // notifications during this request — surface them at once.
      requestNotificationRefresh();
      clearDraft(plantId);
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
      {draft && (
        <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm">
          <p className="flex-1">{t("asmt.draftBack")}</p>
          <Button type="button" variant="outline" size="sm" onClick={onStartOver}>
            <RotateCcw className="size-3.5" />
            {t("asmt.startOver")}
          </Button>
        </div>
      )}

      {/* The photo comes first, with no heading: the upload box says what to do. */}
      <div id="asmt-photo" className="flex scroll-mt-24 flex-col gap-4">
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
      </div>

      {fromLastCount > 0 && lastAssessment && (
        <p className="bg-muted/40 border-border flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <History className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          {t("asmt.lastCheckFilled", {
            date: formatDisplayDate(lastAssessment.assessment_date, dateLocale),
          })}
        </p>
      )}

      <FormSection title={t("asmt.growth")} description={t("asmt.growthText")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <AnswerLabel id="growth-label" source={sources.growth_condition} missing={!growth}>
              {t("asmt.growthCompared")}
            </AnswerLabel>
            <ChoiceButtons
              labelledBy="growth-label"
              value={growth}
              onChange={(v) => answer("growth_condition", v)}
              options={GROWTH}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.health")} description={t("asmt.healthText")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <AnswerLabel id="health-label" source={sources.health_condition} missing={!health}>
              {t("asmt.overallHealth")}
            </AnswerLabel>
            <ChoiceButtons
              labelledBy="health-label"
              value={health}
              onChange={(v) => answer("health_condition", v)}
              options={HEALTH}
              columns={3}
            />
          </div>
          {asks("leaf_condition") && (
            <div className="flex flex-col gap-2">
              <AnswerLabel id="leaf-label" source={sources.leaf_condition} missing={leafMissing}>
                {t("asmt.leaf")}
              </AnswerLabel>
              <ChoiceButtons
                labelledBy="leaf-label"
                value={leaf}
                onChange={(v) => answer("leaf_condition", v)}
                options={LEAF}
                columns={3}
              />
            </div>
          )}
        </div>
      </FormSection>

      {(asks("flowering_status") || asks("fruiting_status")) && (
        <FormSection title={t("asmt.flowerFruit")} description={t("asmt.noneYet")}>
          <div className="flex flex-col gap-4">
            {asks("flowering_status") && (
              <div className="flex flex-col gap-2">
                <AnswerLabel
                  id="flowering-label"
                  source={sources.flowering_status}
                  missing={floweringMissing}
                >
                  {t("asmt.flowering")}
                </AnswerLabel>
                <ChoiceButtons
                  labelledBy="flowering-label"
                  value={flowering}
                  onChange={(v) => answer("flowering_status", v)}
                  options={FLOWERING}
                />
              </div>
            )}
            {asks("fruiting_status") && (
              <div className="flex flex-col gap-2">
                <AnswerLabel
                  id="fruiting-label"
                  source={sources.fruiting_status}
                  missing={fruitingMissing}
                >
                  {t("asmt.fruiting")}
                </AnswerLabel>
                <ChoiceButtons
                  labelledBy="fruiting-label"
                  value={fruiting}
                  onChange={(v) => answer("fruiting_status", v)}
                  options={FRUITING}
                />
              </div>
            )}
          </div>
        </FormSection>
      )}

      <FormSection title={t("asmt.waterSoil")} description={t("asmt.waterSoilText")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <AnswerLabel id="watering-label" source={sources.watering_frequency} missing={!watering}>
              {t("asmt.watering")}
            </AnswerLabel>
            <ChoiceButtons
              labelledBy="watering-label"
              value={watering}
              onChange={(v) => answer("watering_frequency", v)}
              options={WATERING}
              columns={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <AnswerLabel id="soil-label" source={sources.soil_moisture} missing={!soil}>
              {t("asmt.soil")}
            </AnswerLabel>
            <ChoiceButtons
              labelledBy="soil-label"
              value={soil}
              onChange={(v) => answer("soil_moisture", v)}
              options={SOIL}
              columns={3}
            />
          </div>
          <FarmWeekWeather />
        </div>
      </FormSection>

      {/* Optional extras, out of the way: most weeks need none of them.
          Nothing in here is required. */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          aria-expanded={showDetails}
          aria-controls="more-details"
          onClick={() => setShowDetails((open) => !open)}
          className="text-primary flex items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {t(showDetails ? "asmt.hideDetails" : "asmt.moreDetails")}
        </button>
        {!showDetails && (
          <p className="text-muted-foreground -mt-3 text-sm">{t("asmt.moreDetailsHint")}</p>
        )}
        <div id="more-details" hidden={!showDetails} className="flex flex-col gap-5">
          <FormSection title={t("asmt.symptoms")} description={t("sym.tickAll")}>
            <div className="flex flex-col gap-2">
              <Label id="pest-label">{t("sym.pestTitle")}</Label>
              <SymptomChecklist
                labelledBy="pest-label"
                kind="pest"
                items={symptoms.pests}
                ticked={pests}
                onToggle={(item) => toggle(setPests, item)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label id="disease-label">{t("sym.diseaseTitle")}</Label>
              <SymptomChecklist
                labelledBy="disease-label"
                kind="disease"
                items={symptoms.diseases}
                ticked={diseases}
                onToggle={(item) => toggle(setDiseases, item)}
              />
            </div>
          </FormSection>
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
            <Label htmlFor="notes">{t("asmt.notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("asmt.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{t("asmt.anyLanguage")}</p>
          </div>
        </div>
      </div>

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
        {checkingPhoto ? (
          <p className="text-muted-foreground text-sm">{t("asmt.waitPhotoCheck")}</p>
        ) : (
          stillNeeded.length > 0 && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>{t(photoRefused ? "asmt.needNewPhoto" : "asmt.stillNeeded")}</span>
              {stillNeeded.map((item) => (
                <button
                  key={item.target}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(item.target)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="border-risk-medium/40 text-risk-medium hover:bg-risk-medium/10 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </form>
  );
}
