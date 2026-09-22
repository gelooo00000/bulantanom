"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, ScanEye } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import {
  EvidenceUpload,
  type EvidenceUploadHandle,
} from "@/components/farmer/evidence-upload";
import { EvidenceVerdict } from "@/components/farmer/evidence-verdict";
import { RiskInfoNote, RiskResultCard } from "@/components/risk/risk-result-card";
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
import {
  AssessmentApiError,
  submitAssessment,
  validateEvidence,
  type AssessmentEligibility,
  type BackendAssessment,
  type EvidenceValidation,
} from "@/lib/api/risk-api";
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

/**
 * `checking` = verifying the photo shows the right crop;
 * `analyzing` = the risk evaluation, which only runs on verified evidence.
 */
type Status = "idle" | "checking" | "analyzing" | "done";

export function AssessmentForm({
  plantId,
  plantLabel,
  cropName,
  onLocked,
}: {
  plantId: number;
  plantLabel: string;
  cropName: string;
  /** Called when the server reports the weekly assessment is already done. */
  onLocked?: (eligibility: AssessmentEligibility) => void;
}) {
  const { accessToken } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BackendAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<EvidenceValidation | null>(null);
  const uploadRef = useRef<EvidenceUploadHandle>(null);

  const [height, setHeight] = useState("");
  const [growth, setGrowth] = useState<string | null>("as_expected");
  const [health, setHealth] = useState<string | null>("healthy");
  const [leaf, setLeaf] = useState<string | null>(null);
  const [flowering, setFlowering] = useState<string | null>(null);
  const [fruiting, setFruiting] = useState<string | null>(null);
  const [watering, setWatering] = useState<string | null>("daily");
  const [soil, setSoil] = useState<string | null>(null);
  const [pest, setPest] = useState("");
  const [disease, setDisease] = useState("");
  const [environment, setEnvironment] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);

  // Evidence is mandatory: the risk reading is only meaningful when the photo
  // has been verified to show this crop.
  const canSubmit = Boolean(growth && health && leaf && watering && evidence);

  function changeEvidence(file: File | null) {
    setEvidence(file);
    // A new photo invalidates the previous verdict and its token.
    setEvidenceResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !accessToken || !evidence) return;

    setError(null);
    setEvidenceResult(null);

    // Step 1 — verify the photo actually shows this crop. Nothing is saved
    // and no risk evaluation runs until this passes.
    setStatus("checking");
    let verification: EvidenceValidation;
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

    // Step 2 — risk evaluation, on verified evidence.
    setStatus("analyzing");
    try {
      const assessment = await submitAssessment(
        accessToken,
        plantId,
        {
          plant_height_cm: height,
          growth_condition: growth!,
          health_condition: health!,
          leaf_condition: leaf!,
          flowering_status: flowering ?? "",
          fruiting_status: fruiting ?? "",
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
      setError(err instanceof Error ? err.message : t("asmt.wentWrong"));
      setStatus("idle");
    }
  }

  if (status === "checking") {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
        <ScanEye className="text-primary size-6 animate-pulse" />
        <p className="text-sm font-medium">{t("asmt.checking")}</p>
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
          <p className="text-sm font-medium">{t("asmt.evaluating", { name: plantLabel })}</p>
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
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/farmer/plants/${plantId}`} />}>
            {t("lock.backToPlant")}
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/risk-indicator" />}
          >
            {t("nav.risk")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormSection title={t("asmt.growth")} description={t("asmt.growthText")}>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="growth">{t("asmt.growthCompared")}</Label>
            <Choice
              id="growth"
              value={growth}
              onChange={setGrowth}
              options={GROWTH}
              placeholder={t("asmt.select")}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.health")} description={t("asmt.healthText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="health">{t("asmt.overallHealth")}</Label>
            <Choice id="health" value={health} onChange={setHealth} options={HEALTH} placeholder={t("asmt.select")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leaf">{t("asmt.leaf")}</Label>
            <Choice id="leaf" value={leaf} onChange={setLeaf} options={LEAF} placeholder={t("asmt.select")} />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.flowerFruit")} description={t("asmt.blankIfNA")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="flowering">{t("asmt.flowering")}</Label>
            <Choice id="flowering" value={flowering} onChange={setFlowering} options={FLOWERING} placeholder={t("asmt.select")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fruiting">{t("asmt.fruiting")}</Label>
            <Choice id="fruiting" value={fruiting} onChange={setFruiting} options={FRUITING} placeholder={t("asmt.select")} />
          </div>
        </div>
      </FormSection>

      <FormSection title={t("asmt.waterSoil")} description={t("asmt.waterSoilText")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="watering">{t("asmt.watering")}</Label>
            <Choice id="watering" value={watering} onChange={setWatering} options={WATERING} placeholder={t("asmt.select")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="soil">{t("asmt.soil")}</Label>
            <Choice id="soil" value={soil} onChange={setSoil} options={SOIL} placeholder={t("asmt.select")} />
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

      <FormSection
        title={t("asmt.evidence")}
        description={t("asmt.evidenceText", { crop: cropName.toLowerCase() })}
      >
        <EvidenceUpload ref={uploadRef} file={evidence} onChange={changeEvidence} />
        {evidenceResult && (
          <EvidenceVerdict
            result={evidenceResult}
            onReplace={() => uploadRef.current?.openPicker()}
          />
        )}
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

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit} className="self-start">
          {t("asmt.submit")}
          <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
        </Button>
        {!evidence && (
          <p className="text-muted-foreground text-sm">
            {t("asmt.needPhoto")}
          </p>
        )}
      </div>
    </form>
  );
}
