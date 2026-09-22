"use client";

import { ImageUp, Sprout, TriangleAlert, X } from "lucide-react";
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
 * Plant condition evidence picker. The native file input is kept offscreen
 * and driven by styled buttons so the control matches the BulanTanom design
 * system rather than looking like a raw browser file field.
 *
 * Client-side checks here are for fast feedback only — the Django serializer
 * re-validates size and decodes the file with Pillow, so a crafted upload
 * cannot get through by bypassing this.
 */
export function EvidenceUpload({ file, onChange, ref }: EvidenceUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), []);

  // Derived from the file rather than held in state, so no setState runs
  // inside an effect; the effect exists only to release the object URL.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function handleSelect(selected: File | undefined) {
    setError(null);
    if (!selected) return;

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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label={t("upload.label")}
        onChange={(event) => handleSelect(event.target.files?.[0])}
      />

      {preview && file ? (
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
                onClick={() => inputRef.current?.click()}
              >
                {t("upload.replace")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onChange(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="size-3.5" />
                {t("upload.remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-border hover:border-primary/50 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors"
        >
          <span
            className="flex size-12 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
          >
            <Sprout className="size-6" />
          </span>
          <span className="text-sm font-medium">{t("upload.title")}</span>
          <span className="text-muted-foreground max-w-xs text-sm">
            {t("upload.hint")}
          </span>
          <span className="border-primary/40 text-primary mt-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium">
            <ImageUp className="size-4" />
            {t("upload.choose")}
          </span>
          <span className="text-muted-foreground/70 text-xs">{t("upload.limits")}</span>
        </button>
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
