"use client";

import { Camera, ImageUp, LoaderCircle, TriangleAlert, X } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { shrinkPhoto } from "@/lib/shrink-photo";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png"];

export type EvidenceUploadHandle = { openPicker: () => void };

type EvidenceUploadProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Lets a parent reopen the file picker, e.g. from a "Replace Image" action. */
  ref?: Ref<EvidenceUploadHandle>;
};

/**
 * Plant condition evidence picker. The native file inputs are kept offscreen
 * and driven by styled buttons so the control matches the BulanTanom design
 * system rather than looking like a raw browser file field.
 *
 * "Take photo" opens the phone's back camera straight away (`capture`); the
 * gallery stays one tap away for a photo taken a moment earlier. On a
 * computer both open the file picker. Every photo is shrunk in the browser
 * first (shrinkPhoto), so a large phone photo fits the 5MB limit and uploads
 * fast, and the type and size checks below run on the shrunk file.
 *
 * Client-side checks here are for fast feedback only — the Django serializer
 * re-validates size and decodes the file with Pillow, so a crafted upload
 * cannot get through by bypassing this.
 */
export function EvidenceUpload({ file, onChange, ref }: EvidenceUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  // Replacing a turned-down photo means taking a new one, so the camera.
  useImperativeHandle(ref, () => ({ openPicker: () => cameraRef.current?.click() }), []);

  // Derived from the file rather than held in state, so no setState runs
  // inside an effect; the effect exists only to release the object URL.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function handleSelect(input: HTMLInputElement) {
    const picked = input.files?.[0];
    // Cleared so picking the same file again still fires a change.
    input.value = "";
    setError(null);
    if (!picked) return;

    setPreparing(true);
    const selected = await shrinkPhoto(picked);
    setPreparing(false);

    if (!ALLOWED.includes(selected.type)) {
      setError(t("upload.onlyJpegPng"));
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(t("upload.tooLarge"));
      return;
    }
    onChange(selected);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Any image: shrinkPhoto turns what the browser can read into a
          JPEG, and the checks above refuse what it cannot. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("upload.takePhoto")}
        onChange={(event) => handleSelect(event.currentTarget)}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("upload.label")}
        onChange={(event) => handleSelect(event.currentTarget)}
      />

      {preparing ? (
        <div className="border-border text-muted-foreground flex items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          {t("upload.preparing")}
        </div>
      ) : preview && file ? (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--landing-border)" }}
        >
          <p className="text-muted-foreground border-border border-b px-4 py-2 text-xs tracking-wide uppercase">
            {t("upload.photo")}
          </p>
          {/* Local object URL preview — next/image is not used because the
              blob URL has no known dimensions and is never remote. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("upload.alt")}
            className="max-h-72 w-full bg-muted object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-muted-foreground truncate text-sm">{file.name}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="size-3.5" />
                {t("upload.replace")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange(null)}
              >
                <X className="size-3.5" />
                {t("upload.remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center">
          <span className="font-heading text-sm font-medium">{t("upload.title")}</span>
          <span className="text-muted-foreground max-w-xs text-sm">{t("upload.hint")}</span>
          <Button type="button" size="lg" className="mt-1" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            {t("upload.takePhoto")}
          </Button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            <ImageUp className="size-4" />
            {t("upload.fromGallery")}
          </button>
          <span className="text-muted-foreground/70 text-xs">{t("upload.limits")}</span>
        </div>
      )}

      {error && (
        <p className="text-destructive flex items-center gap-1.5 text-sm">
          <TriangleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
