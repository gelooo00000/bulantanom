"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { ClipboardCheck, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EvidenceUpload } from "@/components/farmer/evidence-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdviceHelped,
  BackendPlant,
  HarvestAnswers,
  HarvestHealth,
  HarvestQuality,
  YieldUnit,
} from "@/lib/api/plants-api";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const QUALITY: HarvestQuality[] = ["GOOD", "FAIR", "POOR"];
const HEALTH: HarvestHealth[] = ["HEALTHY", "MINOR_PROBLEMS", "DAMAGED"];
const ADVICE: AdviceHelped[] = ["YES", "A_LITTLE", "NO"];
const UNITS: YieldUnit[] = ["KG", "PIECES", "SACKS"];

/** Good answers green, middling amber, bad red - read at a glance. */
const TONE = ["border-risk-low bg-risk-low/15", "border-risk-medium bg-risk-medium/15", "border-risk-high bg-risk-high/15"];

/**
 * The harvest report (final assessment), asked when a Farmer marks a plant
 * harvested. Three taps are required - quality, health and whether the
 * advice helped; the amount, a photo and a note are optional. The system adds
 * the growing time and the risk history itself.
 */
export function HarvestReportDialog({
  plant,
  onCancel,
  onSubmit,
}: {
  plant: BackendPlant;
  onCancel: () => void;
  /** Saves the report; rejects with a message to show if it could not. */
  onSubmit: (answers: HarvestAnswers) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [quality, setQuality] = useState<HarvestQuality | null>(null);
  const [health, setHealth] = useState<HarvestHealth | null>(null);
  const [advice, setAdvice] = useState<AdviceHelped | null>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<YieldUnit>("KG");
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!quality || !health || !advice) {
      setError(t("report.missing"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        quality,
        final_health: health,
        advice_helped: advice,
        yield_amount: amount.trim() || undefined,
        yield_unit: amount.trim() ? unit : undefined,
        notes,
        photo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("harvestCard.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !saving && onCancel()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground border-border fixed top-1/2 left-1/2 z-50",
            "flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2",
            "-translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border p-5 shadow-lg",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl"
            >
              {plant.crop.emoji}
            </span>
            <div className="min-w-0">
              <Dialog.Title className="font-heading flex items-center gap-1.5 text-lg">
                <ClipboardCheck className="text-risk-low size-4.5 shrink-0" aria-hidden="true" />
                {t("report.title")}
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
                {t("report.intro", { name: plant.display_name })}
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Choice
              legend={t("report.quality")}
              required={t("report.required")}
              options={QUALITY}
              value={quality}
              onChange={setQuality}
              label={(value) => t(`report.quality.${value}` as MessageKey)}
            />
            <Choice
              legend={t("report.health")}
              required={t("report.required")}
              options={HEALTH}
              value={health}
              onChange={setHealth}
              label={(value) => t(`report.health.${value}` as MessageKey)}
            />
            <Choice
              legend={t("report.advice")}
              required={t("report.required")}
              options={ADVICE}
              value={advice}
              onChange={setAdvice}
              label={(value) => t(`report.advice.${value}` as MessageKey)}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="harvest-amount" className="flex items-center gap-2">
                {t("report.amount")}
                <span className="text-muted-foreground text-xs font-normal">{t("report.optional")}</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="harvest-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder={t("report.amountPlaceholder")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 flex-1 text-base"
                />
                <div role="group" aria-label={t("report.unit")} className="bg-muted flex rounded-lg p-1">
                  {UNITS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={unit === option}
                      onClick={() => setUnit(option)}
                      className={cn(
                        "rounded-md px-2.5 text-sm transition-colors",
                        unit === option
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`report.unit.${option}` as MessageKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                {t("report.photo")}
                <span className="text-muted-foreground text-xs font-normal">{t("report.optional")}</span>
              </p>
              <EvidenceUpload file={photo} onChange={setPhoto} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="harvest-notes" className="flex items-center gap-2">
                {t("report.notes")}
                <span className="text-muted-foreground text-xs font-normal">{t("report.optional")}</span>
              </Label>
              <Textarea
                id="harvest-notes"
                maxLength={1000}
                placeholder={t("report.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>

            {error && (
              <p className="text-risk-high text-sm" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="h-10">
                {t("report.cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="h-10">
                {saving ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {t("report.saving")}
                  </>
                ) : (
                  t("report.submit")
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * One required question answered by tapping a big button. Three options are
 * coloured good / middling / bad; `neutral` keeps them all one colour.
 *
 * With `hint`, each option gets a 💡 beside it: pointing at it or tapping it
 * shows what the option covers, without choosing it.
 */
export function Choice<T extends string>({
  legend,
  required,
  options,
  value,
  onChange,
  label,
  hint,
  hintLabel,
  neutral = false,
}: {
  legend: string;
  required: string;
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
  label: (value: T) => string;
  /** What an option covers, shown from its 💡. */
  hint?: (value: T) => string;
  /** The 💡 button's accessible name, e.g. "What does Calamity mean?". */
  hintLabel?: (value: T) => string;
  neutral?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        {legend}
        <span className="text-risk-high text-xs font-normal">{required}</span>
      </legend>
      {/* With hints, every box is one height (auto-rows-fr) so the rows line up. */}
      <div
        className={cn(
          "grid gap-2",
          options.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3",
          hint && "auto-rows-fr",
        )}
      >
        {options.map((option, index) => {
          const button = (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className={cn(
                "border-border min-h-11 w-full rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                hint && "flex h-full items-center pr-9 pl-3 text-left leading-tight",
                value === option
                  ? neutral
                    ? "border-primary bg-primary/10"
                    : TONE[index]
                  : "hover:bg-muted",
              )}
            >
              {label(option)}
            </button>
          );
          if (!hint) return button;
          return (
            <div key={option} className="relative h-full">
              {button}
              <Popover.Root>
                <Popover.Trigger
                  openOnHover
                  delay={100}
                  aria-label={hintLabel ? hintLabel(option) : label(option)}
                  className={cn(
                    "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-base",
                    "hover:bg-muted data-[popup-open]:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                  )}
                >
                  <span aria-hidden="true">💡</span>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner side="top" sideOffset={6} className="z-[60]">
                    <Popover.Popup className="bg-popover text-popover-foreground border-border max-w-56 rounded-xl border px-3 py-2 text-xs leading-snug shadow-lg">
                      <span className="font-heading block font-medium">{label(option)}</span>
                      <span className="text-muted-foreground">{hint(option)}</span>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
