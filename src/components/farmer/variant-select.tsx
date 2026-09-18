"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CropVariant } from "@/lib/api/plants-api";

/**
 * Variety picker, shown only for crops that have varieties on file.
 *
 * Choosing one is optional, and "Not specified" is a real choice rather than
 * an empty state: a farmer who knows they planted corn but not which corn
 * should be able to say so, and get the crop's own harvest window.
 */

const UNSPECIFIED = "__unspecified__";

type VariantSelectProps = {
  id?: string;
  variants: CropVariant[];
  value: string | null;
  onValueChange: (value: string | null) => void;
};

export function VariantSelect({
  id,
  variants,
  value,
  onValueChange,
}: VariantSelectProps) {
  const selected = variants.find((variant) => variant.id === value);

  return (
    <Select
      value={value ?? UNSPECIFIED}
      onValueChange={(next) =>
        onValueChange(next === UNSPECIFIED ? null : (next as string))
      }
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Not specified">
          {() => selected?.name ?? "Not specified"}
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="max-h-80 w-[var(--anchor-width)] min-w-64">
        <SelectItem value={UNSPECIFIED}>
          <span className="text-muted-foreground">Not specified</span>
        </SelectItem>
        {variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id}>
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>{variant.name}</span>
              <span className="text-muted-foreground text-xs">
                about {variant.growing_duration_days} days to harvest
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
