"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { sensorLabel, type SensorField } from "@/lib/soil-options";
import { cn } from "@/lib/utils";

/**
 * One labelled numeric reading with its unit.
 *
 * Shared by the typed form and the Arduino sensor's readings page, which
 * have the same seven and differ only by the spec they are handed. The unit
 * sits inside the field rather than beside the label, so it stays attached to
 * the number when the grid wraps to one column on a phone.
 */
export function SoilNumberField({
  field,
  value,
  error,
  onChange,
  readOnly = false,
}: {
  field: SensorField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  /** Filled in by the Arduino sensor: shown, but not typed over. */
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const id = `soil-${field.key.replace(/_/g, "-")}`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{sensorLabel(field, t)}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "pr-16",
            readOnly && "bg-muted/50 cursor-default focus-visible:ring-0",
            error && "border-destructive",
          )}
        />
        {/* Not a <label>: it names the unit, not the control, and a second
            label would compete with the real one for the field's name. */}
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
        >
          {field.unit}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("sensor.range", { min: field.min, max: field.max, unit: field.unit })}
        </p>
      )}
    </div>
  );
}
