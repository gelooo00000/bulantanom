"use client";

import Link from "next/link";
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
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { CropSelect } from "@/components/farmer/crop-select";
import { InSeasonCrops } from "@/components/farmer/in-season-crops";
import { PlantingSeasonNote } from "@/components/farmer/planting-season-note";
import { VariantSelect } from "@/components/farmer/variant-select";
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
  fetchPlants,
  type CropIntelligenceResponse,
} from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";
import { requestNotificationRefresh } from "@/lib/notification-refresh";
import { useLanguage } from "@/lib/i18n";
import { adviseForMonth, monthFromIsoDate } from "@/lib/planting-season";

function todayIso() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// The address never changes while this page is open.
function subscribeToNothing() {
  return () => {};
}

export default function AddPlantPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t, language, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);

  const { data: crops, loading: cropsLoading, error: cropsError, refetch } =
    useAuthedQuery(fetchCrops);

  // The farmer's existing plants, read only to spot an accidental repeat.
  const { data: existingPlants } = useAuthedQuery(fetchPlants);

  // `undefined` until the farmer picks, so the link's values apply until then.
  const [pickedCropId, setCropId] = useState<string | null | undefined>(undefined);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [pickedDate, setPlantingDate] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [intel, setIntel] = useState<CropIntelligenceResponse | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Preselects the crop when arriving from a suggestion chip
   * (`/farmer/plants/new?crop=pineapple`), and the day when a date is carried
   * in the link. Without this the dashboard's "tap one to add it" landed the
   * farmer on a blank form.
   *
   * Read from `window.location` rather than `useSearchParams`, which would
   * oblige this page to sit inside a Suspense boundary for no other reason.
   * Derived during render instead of copied into state by an effect, so
   * there is no extra render, and the farmer's own pick always wins.
   */
  const search = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search,
    () => "",
  );
  const link = new URLSearchParams(search);
  const requestedCrop = link.get("crop");
  // Waits for the catalog so an id that is not a real crop is ignored
  // instead of selecting nothing and looking broken.
  const linkedCrop =
    requestedCrop && crops?.some((crop) => crop.id === requestedCrop)
      ? requestedCrop
      : null;
  // Past dates are dropped: the calendar starts at today, and the form
  // would reject one anyway.
  const requestedDate = link.get("date");
  const linkedDate =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= todayIso()
      ? requestedDate
      : "";

  const cropId = pickedCropId === undefined ? linkedCrop : pickedCropId;
  const plantingDate = pickedDate ?? linkedDate;

  const selectedCrop = crops?.find((crop) => crop.id === cropId) ?? null;
  const selectedVariant =
    selectedCrop?.variants.find((variant) => variant.id === variantId) ?? null;

  const activeMonth = monthFromIsoDate(plantingDate);
  const seasonAdvice = adviseForMonth(selectedCrop?.planting_window, activeMonth, t);

  // Same crop, same variety, same day. Almost always a double submit or a
  // forgotten earlier entry — but not always, since two beds can genuinely
  // go in together, so this warns and never blocks.
  const duplicate =
    cropId && plantingDate
      ? (existingPlants ?? []).find(
          (plant) =>
            plant.crop.id === cropId &&
            (plant.variant?.id ?? null) === variantId &&
            plant.planting_date === plantingDate,
        )
      : undefined;

  async function handleContinue(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!cropId) return setFormError(t("add.errorCrop"));
    if (!plantingDate) return setFormError(t("add.errorDate"));
    if (plantingDate < todayIso()) {
      return setFormError(t("add.errorPast"));
    }
    if (!accessToken) return;

    setAnalyzing(true);
    try {
      // The harvest window in this response is calculated by Django from the
      // crop table. Gemini only explains it — see the backend service.
      // The variety travels with the request, so the window shown here is
      // the one the saved plant will actually get.
      setIntel(
        await fetchCropIntelligence(accessToken, cropId, plantingDate, variantId),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("add.errorIntel"));
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
        variant_id: variantId,
      });
      // Django raised "Plant added" — show it on the bell straight away.
      requestNotificationRefresh();
      router.push(`/farmer/plants/${plant.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("add.errorSave"));
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------- analyzing
  if (analyzing) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <PageHeader title={t("add.title")} description={t("add.preparing")} />
        {/* Announced, because this replaces the whole page: without it a
            screen reader user is told nothing changed and nothing finished. */}
        <Card className="py-10" role="status" aria-live="polite">
          <CardContent className="flex flex-col items-center gap-4 px-6 text-center">
            <LoaderCircle className="text-primary size-7 animate-spin" />
            <p className="font-medium">
              {t("add.analyzing", { crop: `${selectedCrop?.emoji ?? ""} ${selectedCrop?.name ?? ""}` })}
            </p>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li>{t("add.step1")}</li>
              <li>{t("add.step2")}</li>
              <li>{t("add.step3")}</li>
            </ul>
            {/* The guidance is a nicety; the plant record is the point. The
                first farmer to pick any crop waits on a live Gemini call
                behind a 60-second timeout, so there has to be a way past it
                rather than a spinner with no exit. */}
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? t("add.adding") : t("add.skipWait")}
              </Button>
              <p className="text-muted-foreground/70 text-xs">
                {t("add.laterGuidance")}
              </p>
            </div>
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
            {t("add.backToSelect")}
          </button>

          <PageHeader
            title={`${intel.crop.emoji} ${intel.variant?.name ?? intel.crop.name}`}
            description={
              intel.variant
                ? t("add.reviewVariant", { crop: intel.crop.name })
                : t("add.review")
            }
          />

          {window && (
            <Card className="gap-4 py-5">
              <CardContent className="px-5">
                <p
                  className="flex items-center gap-1.5 text-xs font-medium tracking-[0.15em] uppercase"
                  style={{ color: "var(--landing-accent)" }}
                >
                  <CalendarDays className="size-3.5" />
                  {t("add.window")}
                </p>
                <p className="mt-2 text-lg font-medium">
                  {date(window.expected_harvest_start)} —{" "}
                  {date(window.expected_harvest_end)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("add.windowPlanted", {
                    date: date(window.planting_date),
                    n: window.growing_duration_days,
                  })}
                </p>
                <p className="text-muted-foreground/70 mt-2 flex items-start gap-1.5 text-xs">
                  <Info className="mt-0.5 size-3 shrink-0" />
                  {t("add.windowNote")}
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
                    <h2 className="font-medium">{t("add.intel")}</h2>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {ai.crop_overview}
                    </p>
                  </div>
                </div>

                {ai.growing_notes.length > 0 && (
                  <Section title={t("add.growing")} items={ai.growing_notes} />
                )}
                {ai.care_guidance.length > 0 && (
                  <Section title={t("add.care")} items={ai.care_guidance} />
                )}
                {ai.harvest_guidance && (
                  <div>
                    <h3 className="text-sm font-medium">{t("add.harvestGuidance")}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {ai.harvest_guidance}
                    </p>
                  </div>
                )}
                {ai.important_factors.length > 0 && (
                  <Section
                    title={t("add.factors")}
                    items={ai.important_factors}
                  />
                )}

                <p className="text-muted-foreground/60 border-border border-t pt-3 text-[11px]">
                  {t("add.aiNote")}
                  {language !== "en" && ` ${t("result.aiText")}`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-3 rounded-xl border p-4">
              <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("add.intelUnavailable")}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {intel.unavailable_reason ?? t("add.intelUnavailableDefault")}{" "}
                  {t("add.canStillAdd")}
                </p>
              </div>
            </div>
          )}

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {t("add.adding")}
              </>
            ) : (
              <>
                {t("addPlant.button")}
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
      {/* A link, not router.back(): it returns to My Plants even when the
          farmer arrived here from the dashboard or a bookmark. */}
      <Link
        href="/farmer/plants"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start text-sm"
      >
        <ArrowLeft className="size-3.5" />
        {t("add.back")}
      </Link>

      <PageHeader
        title={t("add.title")}
        description={t("add.description")}
      />

      {cropsLoading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("add.loadingCrops")}</p>
        </div>
      ) : cropsError ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{cropsError}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : (
        <form onSubmit={handleContinue} className="flex flex-col gap-5">
          {/* Answers "what can I plant now" before the farmer has to guess a
              crop and read the warning under it. Follows the planting date
              once one is chosen, so back-dating a planting shows what was in
              season then rather than today. */}
          <InSeasonCrops
            crops={crops ?? []}
            month={activeMonth}
            selectedCropId={cropId}
            onSelect={(next) => {
              setCropId(next);
              setVariantId(null);
              setFormError(null);
            }}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="crop">{t("add.crop")}</Label>
            <CropSelect
              id="crop"
              crops={crops ?? []}
              value={cropId}
              onValueChange={(next) => {
                setCropId(next);
                // Varieties belong to one crop, so the old choice cannot
                // survive a crop change - Django would reject it anyway.
                setVariantId(null);
                setFormError(null);
              }}
            />
          </div>

          {selectedCrop && selectedCrop.variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="variant">{t("add.variety")}</Label>
              <VariantSelect
                id="variant"
                variants={selectedCrop.variants}
                value={variantId}
                onValueChange={(next) => {
                  setVariantId(next);
                  setFormError(null);
                }}
              />
              <p className="text-muted-foreground text-xs">
                {t("add.varietyHint")}
              </p>
            </div>
          )}

          {selectedCrop && (
            <Card className="py-4">
              <CardContent className="flex flex-col gap-2 px-4 text-sm">
                <div>
                  <p className="font-medium">
                    {selectedCrop.emoji} {selectedCrop.name}
                    {selectedVariant && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {selectedVariant.name}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {selectedVariant?.description || selectedCrop.description}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    {t("add.typical", {
                      growing:
                        selectedVariant?.growing_duration_days ??
                        selectedCrop.growing_duration_days,
                      window:
                        selectedVariant?.harvest_window_days ??
                        selectedCrop.harvest_window_days,
                    })}
                  </p>
                </div>

                {/* Whether this month suits this crop here, and why. */}
                <PlantingSeasonNote advice={seasonAdvice} />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="plantingDate">{t("add.plantingDate")}</Label>
            <DatePicker
              id="plantingDate"
              value={plantingDate}
              onChange={(next) => {
                setPlantingDate(next);
                setFormError(null);
              }}
              placeholder={t("add.selectDate")}
            />
            <p className="text-muted-foreground text-xs">
              {t("add.dateHint")}
            </p>
          </div>

          {/* Warns, never blocks: two beds can genuinely go in on one day. */}
          {duplicate && (
            <div className="border-risk-medium/30 bg-risk-medium/5 flex items-start gap-2.5 rounded-xl border px-3 py-2.5">
              <TriangleAlert className="text-risk-medium mt-0.5 size-4 shrink-0" />
              <p className="text-sm">
                {t("add.duplicate", { name: duplicate.display_name })}
              </p>
            </div>
          )}

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button type="submit" disabled={!cropId || !plantingDate} className="self-start">
            {t("common.continue")}
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
