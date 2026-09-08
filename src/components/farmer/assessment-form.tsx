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
import { requestNotificationRefresh } from "@/lib/notification-refresh";

type Option = { value: string; label: string };

const GROWTH: Option[] = [
  { value: "faster_than_expected", label: "Faster than expected" },
  { value: "as_expected", label: "About as expected" },
  { value: "slower_than_expected", label: "Slower than expected" },
  { value: "stunted", label: "Stunted / barely growing" },
];
const HEALTH: Option[] = [
  { value: "healthy", label: "Healthy" },
  { value: "slightly_unhealthy", label: "Slightly unhealthy" },
  { value: "unhealthy", label: "Unhealthy" },
];
const LEAF: Option[] = [
  { value: "healthy", label: "Healthy green leaves" },
  { value: "slight_yellowing", label: "Slight yellowing" },
  { value: "yellowing", label: "Noticeable yellowing" },
  { value: "spots", label: "Spots or lesions" },
  { value: "wilting", label: "Wilting or drooping" },
  { value: "damaged", label: "Visible damage / holes" },
];
const FLOWERING: Option[] = [
  { value: "not_flowering", label: "Not flowering" },
  { value: "starting", label: "Starting to flower" },
  { value: "flowering", label: "Flowering" },
  { value: "finished", label: "Flowering finished" },
];
const FRUITING: Option[] = [
  { value: "not_fruiting", label: "Not fruiting" },
  { value: "forming", label: "Fruit forming" },
  { value: "developing", label: "Fruit developing" },
  { value: "ripening", label: "Fruit ripening" },
];
const WATERING: Option[] = [
  { value: "daily", label: "Daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "twice_weekly", label: "Twice a week" },
  { value: "weekly", label: "Weekly" },
  { value: "rain_fed", label: "Rain-fed only" },
];
const SOIL: Option[] = [
  { value: "dry", label: "Dry" },
  { value: "slightly_dry", label: "Slightly dry" },
  { value: "moist", label: "Moist" },
  { value: "wet", label: "Wet" },
  { value: "waterlogged", label: "Waterlogged" },
];

function label(options: Option[], value: string | null, placeholder: string) {
  return options.find((o) => o.value === value)?.label ?? placeholder;
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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder}>
          {(v: string) => label(options, v, placeholder)}
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
          : "Plant evidence could not be verified right now. Please try again in a moment.",
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  if (status === "checking") {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
        <ScanEye className="text-primary size-6 animate-pulse" />
        <p className="text-sm font-medium">Checking plant evidence…</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          We&apos;re verifying that your photo matches the selected crop.
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
          <p className="text-sm font-medium">Evaluating {plantLabel}…</p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>Comparing actual condition with expected development</li>
            <li>Generating risk evaluation</li>
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
            Back to plant
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/risk-indicator" />}
          >
            Risk Indicator
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormSection title="Growth" description="How the plant has developed this week.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="height">Plant height (cm, optional)</Label>
            <Input
              id="height"
              type="number"
              min={0}
              step={0.1}
              placeholder="e.g. 45"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="growth">Growth compared with expected</Label>
            <Choice
              id="growth"
              value={growth}
              onChange={setGrowth}
              options={GROWTH}
              placeholder="Select"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Plant health" description="Overall condition and what the leaves look like.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="health">Overall health</Label>
            <Choice id="health" value={health} onChange={setHealth} options={HEALTH} placeholder="Select" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leaf">Leaf condition</Label>
            <Choice id="leaf" value={leaf} onChange={setLeaf} options={LEAF} placeholder="Select" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Flowering & fruiting" description="Leave blank if not applicable yet.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="flowering">Flowering status</Label>
            <Choice id="flowering" value={flowering} onChange={setFlowering} options={FLOWERING} placeholder="Select" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fruiting">Fruiting status</Label>
            <Choice id="fruiting" value={fruiting} onChange={setFruiting} options={FRUITING} placeholder="Select" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Water & soil" description="How the plant has been watered and how the soil feels.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="watering">Watering frequency</Label>
            <Choice id="watering" value={watering} onChange={setWatering} options={WATERING} placeholder="Select" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="soil">Soil moisture</Label>
            <Choice id="soil" value={soil} onChange={setSoil} options={SOIL} placeholder="Select" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Symptoms" description="Leave blank if you haven't noticed anything.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pest">Pest observations</Label>
            <Textarea id="pest" placeholder="None observed" value={pest} onChange={(e) => setPest(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disease">Disease-like symptoms</Label>
            <Textarea id="disease" placeholder="None observed" value={disease} onChange={(e) => setDisease(e.target.value)} />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Plant condition evidence"
        description={`A clear photo of your ${cropName.toLowerCase()} is required. We check that it matches the crop before evaluating risk.`}
      >
        <EvidenceUpload ref={uploadRef} file={evidence} onChange={changeEvidence} />
        {evidenceResult && (
          <EvidenceVerdict
            result={evidenceResult}
            onReplace={() => uploadRef.current?.openPicker()}
          />
        )}
      </FormSection>

      <FormSection title="Observations" description="Anything else worth noting.">
        <div className="flex flex-col gap-2">
          <Label htmlFor="environment">Environmental observations</Label>
          <Textarea
            id="environment"
            placeholder="e.g. Heavy rain the past few days"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">What have you noticed about your plant this week?</Label>
          <Textarea
            id="notes"
            placeholder="In your own words, describe anything that concerns you about this plant."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </FormSection>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit} className="self-start">
          Submit Assessment
          <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
        </Button>
        {!evidence && (
          <p className="text-muted-foreground text-sm">
            Add a plant photo to submit this assessment.
          </p>
        )}
      </div>
    </form>
  );
}
