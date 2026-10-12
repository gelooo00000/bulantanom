"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useLanguage, type MessageKey } from "@/lib/i18n";
import type { Disease, Pest } from "@/lib/symptoms";
import { cn } from "@/lib/utils";

export type ChoiceOption = { value: string; label: MessageKey; picture?: ReactNode };

/**
 * One question's answers as large buttons, all visible at once: one tap to
 * answer, instead of opening a dropdown and reading a list. A radio group
 * for screen readers and keyboards. Every question asked this way is
 * required, so tapping the chosen answer again keeps it.
 */
export function ChoiceButtons({
  labelledBy,
  value,
  onChange,
  options,
  columns = 2,
}: {
  labelledBy: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ChoiceOption[];
  /** Per row from small screens up; phones always get two. */
  columns?: 2 | 3;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn("grid grid-cols-2 gap-2", columns === 3 && "sm:grid-cols-3")}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none",
              "focus-visible:ring-ring/50 focus-visible:ring-3",
              chosen
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border hover:border-primary/40 text-muted-foreground",
            )}
          >
            {option.picture && <span className="shrink-0">{option.picture}</span>}
            <span className="flex-1">{t(option.label)}</span>
            {chosen && <Check className="text-primary size-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export type LeafLook = "healthy" | "slight_yellowing" | "yellowing" | "spots" | "wilting" | "damaged";

const GREEN = "#3f9b4f";
const YELLOW = "#d8b632";
const BROWN = "#7a4b25";
const LEAF = "M16 3C8 9 7 20 16 29C25 20 24 9 16 3Z";

/**
 * A small drawing of a leaf as the farmer would see it, so the answer can be
 * picked by look rather than by reading the words. Same colours in light and
 * dark: they are the leaf's, not the theme's.
 */
export function LeafPicture({ look }: { look: LeafLook }) {
  const id = useId();
  const yellowShare = look === "slight_yellowing" ? "45%" : "85%";
  const fill =
    look === "slight_yellowing" || look === "yellowing" ? `url(#${id}-fade)` : look === "wilting" ? "#7f9a55" : GREEN;

  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset={yellowShare} stopColor={YELLOW} />
          <stop offset={yellowShare} stopColor={GREEN} />
        </linearGradient>
        <mask id={`${id}-holes`}>
          <rect width="32" height="32" fill="white" />
          <circle cx="13" cy="13" r="2.4" fill="black" />
          <circle cx="19" cy="19" r="1.8" fill="black" />
          <circle cx="22.5" cy="11" r="3" fill="black" />
        </mask>
      </defs>
      <g
        transform={look === "wilting" ? "rotate(150 16 16)" : undefined}
        mask={look === "damaged" ? `url(#${id}-holes)` : undefined}
      >
        <path d={LEAF} fill={fill} />
        <path d="M16 5V27" stroke="rgba(0,0,0,0.25)" strokeWidth="1" fill="none" />
      </g>
      {look === "spots" && (
        <g fill={BROWN}>
          <circle cx="12.5" cy="12" r="1.8" />
          <circle cx="19.5" cy="15" r="1.5" />
          <circle cx="14" cy="20" r="1.6" />
          <circle cx="18.5" cy="9" r="1" />
        </g>
      )}
    </svg>
  );
}

/**
 * Tick boxes for the pests or disease signs this crop commonly gets. Nothing
 * ticked means none seen; anything not listed goes in the form's one notes
 * box.
 */
export function SymptomChecklist<T extends Pest | Disease>({
  labelledBy,
  kind,
  items,
  ticked,
  onToggle,
}: {
  labelledBy: string;
  kind: "pest" | "disease";
  items: readonly T[];
  ticked: ReadonlySet<T>;
  onToggle: (item: T) => void;
}) {
  const { t } = useLanguage();
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const on = ticked.has(item);
        return (
          <button
            key={item}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(item)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none",
              "focus-visible:ring-ring/50 focus-visible:ring-3",
              on
                ? "border-risk-medium bg-risk-medium/10 text-foreground font-medium"
                : "border-border hover:border-primary/40 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border",
                on ? "border-risk-medium bg-risk-medium text-white" : "border-border",
              )}
            >
              {on && <Check className="size-3.5" />}
            </span>
            {t(`sym.${kind}.${item}` as MessageKey)}
          </button>
        );
      })}
    </div>
  );
}
