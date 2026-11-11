"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, Sprout } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EvidenceUpload } from "@/components/farmer/evidence-upload";
import { Choice } from "@/components/farmer/harvest-report-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BackendPlant, LossAnswers, LossCause, LossNoticed } from "@/lib/api/plants-api";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Plants die from far more than calamities, so every common cause is offered. */
const CAUSES: LossCause[] = [
  "CALAMITY",
  "PEST",
  "DISEASE",
  "NUTRIENTS",
  "POOR_SOIL",
  "WATER",
  "HUMAN_ERROR",
  "EXTREME_TEMP",
  "OTHER",
];
const NOTICED: LossNoticed[] = ["TODAY", "THIS_WEEK", "EARLIER"];

/**
 * "Report a lost plant": what happened and when (required), with an
 * optional photo and note. The plant is kept, not deleted, so its history
 * and any earlier warning stay on record for the LGU.
 */
export function LostPlantDialog({
  plant,
  onCancel,
  onSubmit,
}: {
  plant: BackendPlant;
  onCancel: () => void;
  /** Saves the report; rejects with a message to show if it could not. */
  onSubmit: (answers: LossAnswers) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [cause, setCause] = useState<LossCause | null>(null);
  const [noticed, setNoticed] = useState<LossNoticed | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!cause || !noticed) {
      setError(t("lost.missing"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ cause, noticed, notes, photo });
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
              className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl grayscale"
            >
              {plant.crop.emoji}
            </span>
            <div className="min-w-0">
              <Dialog.Title className="font-heading flex items-center gap-1.5 text-lg">
                <Sprout className="text-muted-foreground size-4.5 shrink-0" aria-hidden="true" />
                {t("lost.title")}
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-0.5 text-sm">
                {t("lost.intro", { name: plant.display_name })} {t("lost.total")}
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Choice
              legend={t("lost.cause")}
              required={t("report.required")}
              options={CAUSES}
              value={cause}
              onChange={setCause}
              label={(value) => t(`lost.cause.${value}` as MessageKey)}
              hint={(value) => t(`lost.cause.${value}.hint` as MessageKey)}
              hintLabel={(value) => t("lost.hintAbout", { name: t(`lost.cause.${value}` as MessageKey) })}
              neutral
            />
            <Choice
              legend={t("lost.noticed")}
              required={t("report.required")}
              options={NOTICED}
              value={noticed}
              onChange={setNoticed}
              label={(value) => t(`lost.noticed.${value}` as MessageKey)}
              neutral
            />

            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                {t("lost.photo")}
                <span className="text-muted-foreground text-xs font-normal">{t("report.optional")}</span>
              </p>
              <EvidenceUpload file={photo} onChange={setPhoto} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="loss-notes" className="flex items-center gap-2">
                {t("report.notes")}
                <span className="text-muted-foreground text-xs font-normal">{t("report.optional")}</span>
              </Label>
              <Textarea
                id="loss-notes"
                maxLength={1000}
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
              <Button type="submit" variant="destructive" disabled={saving} className="h-10">
                {saving ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    {t("report.saving")}
                  </>
                ) : (
                  t("lost.submit")
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
