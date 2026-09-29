"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CropVariant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";

/**
 * Variety picker, shown only for crops that have varieties on file.
 *
 * Required when shown: varieties of one crop can be months apart at harvest,
 * so the plant is not added until one is chosen. It starts empty, showing
 * "Choose a variety", rather than on a stand-in choice.
 */

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
  const { t } = useLanguage();

  return (
    <Select value={value} onValueChange={(next) => onValueChange((next as string) ?? null)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("variant.choose")}>
          {() =>
            selected?.name ?? (
              <span className="text-muted-foreground">{t("variant.choose")}</span>
            )
          }
        </SelectValue>
      </SelectTrigger>

      <SelectContent maxHeight="20rem" className="w-[var(--anchor-width)] min-w-64">
        {variants.map((variant) => (
          <SelectItem key={variant.id} value={variant.id}>
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>{variant.name}</span>
              <span className="text-muted-foreground text-xs">
                {t("variant.days", { n: variant.growing_duration_days })}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
