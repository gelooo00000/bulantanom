import { Apple, Carrot, Leaf, Sprout } from "lucide-react";
import type { ElementType } from "react";

import { CROPS } from "@/lib/crops";
import { cn } from "@/lib/utils";

type Accent = { bg: string; fg: string; icon: ElementType };

/** Per-crop accents for the original catalog entries. */
const CROP_ACCENT: Record<string, Accent> = {
  papaya: { bg: "bg-amber-500/15", fg: "text-amber-300", icon: Sprout },
  tomato: { bg: "bg-red-500/15", fg: "text-red-300", icon: Leaf },
  eggplant: { bg: "bg-violet-500/15", fg: "text-violet-300", icon: Leaf },
  pepper: { bg: "bg-orange-500/15", fg: "text-orange-300", icon: Sprout },
};

/**
 * Fallback by crop category, so the expanded catalog still reads clearly
 * without needing a bespoke accent for all 30 crops.
 */
const CATEGORY_ACCENT: Record<string, Accent> = {
  fruit: { bg: "bg-amber-500/12", fg: "text-amber-300", icon: Apple },
  vegetable: { bg: "bg-primary/10", fg: "text-primary", icon: Carrot },
};

const DEFAULT_ACCENT: Accent = { bg: "bg-primary/10", fg: "text-primary", icon: Leaf };

const SIZE_CLASS = {
  sm: "size-9",
  default: "size-12",
  lg: "size-16",
} as const;

const ICON_SIZE_CLASS = {
  sm: "size-4",
  default: "size-5",
  lg: "size-7",
} as const;

type PlantThumbProps = {
  cropId: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

export function PlantThumb({ cropId, size = "default", className }: PlantThumbProps) {
  const category = CROPS.find((crop) => crop.id === cropId)?.category;
  const accent =
    CROP_ACCENT[cropId] ?? (category ? CATEGORY_ACCENT[category] : undefined) ?? DEFAULT_ACCENT;
  const Icon = accent.icon;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        accent.bg,
        accent.fg,
        SIZE_CLASS[size],
        className,
      )}
    >
      <Icon className={ICON_SIZE_CLASS[size]} />
    </span>
  );
}
