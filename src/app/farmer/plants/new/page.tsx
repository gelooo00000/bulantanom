"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Info,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { CropSelect } from "@/components/farmer/crop-select";
import { FadeIn } from "@/components/motion/fade-in";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker, formatDisplayDate } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  createPlant,
  fetchCropIntelligence,
  fetchCrops,
  type CropIntelligenceResponse,
} from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";
import { requestNotificationRefresh } from "@/lib/notification-refresh";

function todayIso() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function AddPlantPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const { data: crops, loading: cropsLoading, error: cropsError, refetch } =
    useAuthedQuery(fetchCrops);

  const [cropId, setCropId] = useState<string | null>(null);
  const [plantingDate, setPlantingDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [intel, setIntel] = useState<CropIntelligenceResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCrop = crops?.find((crop) => crop.id === cropId) ?? null;

  async function handleContinue(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!cropId) return setFormError("Please select a valid crop.");
    if (!plantingDate) return setFormError("Please select a valid planting date.");
    if (plantingDate > todayIso()) {
      return setFormError("Planting date cannot be in the future.");
    }
    if (!accessToken) return;

    setAnalyzing(true);
    try {
      // The harvest window in this response is calculated by Django from the
      // crop table. Gemini only explains it — see the backend service.
      setIntel(await fetchCropIntelligence(accessToken, cropId, plantingDate));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to load crop information.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!accessToken || !cropId) return;
    setSaving(true);
    setFormError(null);
    try {
      const plant = await createPlant(accessToken, {
        crop_id: cropId,
        planting_date: plantingDate,
      });
      // Django raised "Plant added" — show it on the bell straight away.
      requestNotificationRefresh();
      router.push(`/farmer/plants/${plant.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to add this plant.");
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------- analyzing
  if (analyzing) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <PageHeader title="Add a Plant" description="Preparing crop intelligence…" />
        <Card className="py-10">
          <CardContent className="flex flex-col items-center gap-4 px-6 text-center">
            <LoaderCircle className="text-primary size-7 animate-spin" />
            <p className="font-medium">
              Analyzing {selectedCrop?.emoji} {selectedCrop?.name}…
            </p>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li>Preparing crop information</li>
              <li>Calculating harvest window</li>
              <li>Generating growing guidance</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------- crop intelligence
  if (intel) {
    const window = intel.harvest_window;
    const ai = intel.intelligence;

    return (
      <FadeIn duration={400}>
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <button
            type="button"
            onClick={() => setIntel(null)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start text-sm"
          >
            <ArrowLeft className="size-3.5" />
            Back to crop selection
          </button>

          <PageHeader
            title={`${intel.crop.emoji} ${intel.crop.name}`}
            description="Review the crop information before adding this plant."
          />

          {window && (
            <Card className="gap-4 py-5">
              <CardContent className="px-5">
                <p
                  className="flex items-center gap-1.5 text-xs font-medium tracking-[0.15em] uppercase"
                  style={{ color: "var(--landing-accent)" }}
                >
                  <CalendarDays className="size-3.5" />
                  Expected harvest window
                </p>
                <p className="mt-2 text-lg font-medium">
                  {formatDisplayDate(window.expected_harvest_start)} —{" "}
                  {formatDisplayDate(window.expected_harvest_end)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Planted {formatDisplayDate(window.planting_date)} · typical growing period{" "}
                  {window.growing_duration_days} days
                </p>
                <p className="text-muted-foreground/70 mt-2 flex items-start gap-1.5 text-xs">
                  <Info className="mt-0.5 size-3 shrink-0" />
                  Calculated from BulanTanom&apos;s crop records — an estimate, not a
                  guaranteed harvest date.
                </p>
              </CardContent>
            </Card>
          )}

          {ai ? (
            <Card className="gap-4 py-5">
              <CardContent className="flex flex-col gap-5 px-5">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: "var(--landing-accent)",
                      color: "var(--landing-accent)",
                    }}
                  >
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-medium">Crop Intelligence</h2>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {ai.crop_overview}
                    </p>
                  </div>
                </div>

                {ai.growing_notes.length > 0 && (
                  <Section title="Growing characteristics" items={ai.growing_notes} />
                )}
                {ai.care_guidance.length > 0 && (
                  <Section title="Care guidance" items={ai.care_guidance} />
                )}
                {ai.harvest_guidance && (
                  <div>
                    <h3 className="text-sm font-medium">Harvest guidance</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {ai.harvest_guidance}
                    </p>
                  </div>
                )}
                {ai.important_factors.length > 0 && (
                  <Section
                    title="Factors that can affect timing"
                    items={ai.important_factors}
                  />
                )}

                <p className="text-muted-foreground/60 border-border border-t pt-3 text-[11px]">
                  AI-generated guidance for reference only. It does not diagnose plant
                  disease or replace an agricultural officer.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
              <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Crop intelligence is unavailable</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {intel.unavailable_reason ??
                    "Crop intelligence is temporarily unavailable."}{" "}
                  Your plant can still be added.
                </p>
              </div>
            </div>
          )}

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Adding plant…
              </>
            ) : (
              <>
                Add Plant
                <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
              </>
            )}
          </Button>
        </div>
      </FadeIn>
    );
  }

  // ------------------------------------------------------------- select form
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader
        title="Add a Plant"
        description="Choose a crop and its planting date to start tracking it at Layuan Farm."
      />

      {cropsLoading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading crops…</p>
        </div>
      ) : cropsError ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
          <p className="text-muted-foreground text-sm">{cropsError}</p>
          <Button onClick={refetch}>Try again</Button>
        </div>
      ) : (
        <form onSubmit={handleContinue} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="crop">Crop</Label>
            <CropSelect
              id="crop"
              crops={crops ?? []}
              value={cropId}
              onValueChange={(next) => {
                setCropId(next);
                setFormError(null);
              }}
            />
          </div>

          {selectedCrop && (
            <Card className="py-4">
              <CardContent className="px-4 text-sm">
                <p className="font-medium">
                  {selectedCrop.emoji} {selectedCrop.name}
                </p>
                <p className="text-muted-foreground mt-1">{selectedCrop.description}</p>
                <p className="text-muted-foreground mt-2">
                  Typical growing period: {selectedCrop.growing_duration_days} days ·
                  harvest window {selectedCrop.harvest_window_days} days
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="plantingDate">Planting date</Label>
            <DatePicker
              id="plantingDate"
              value={plantingDate}
              onChange={(next) => {
                setPlantingDate(next);
                setFormError(null);
              }}
              max={todayIso()}
              placeholder="Select the planting date"
            />
            <p className="text-muted-foreground text-xs">
              A plant record represents a crop already in the ground, so future dates
              aren&apos;t accepted.
            </p>
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button type="submit" disabled={!cropId || !plantingDate} className="self-start">
            Continue
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
        </form>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
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
