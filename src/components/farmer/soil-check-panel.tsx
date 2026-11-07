"use client";

import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";

import type { SoilCheck, SoilCheckFinding } from "@/lib/api/soil-api";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The soil warning signs: one traffic-light row per reading, plus the overall
 * verdict. The grading is done by Django's fixed rules (plants/soil_check.py),
 * not by the AI, so it shows even when the AI recommendation failed.
 */

const LEVEL_ORDER = { critical: 0, caution: 1, good: 2 } as const;

const LEVEL_STYLE = {
  good: { icon: CircleCheck, text: "text-risk-low", ring: "border-risk-low/40 bg-risk-low/10" },
  caution: {
    icon: TriangleAlert,
    text: "text-risk-medium",
    ring: "border-risk-medium/40 bg-risk-medium/10",
  },
  critical: {
    icon: OctagonAlert,
    text: "text-risk-high",
    ring: "border-risk-high/40 bg-risk-high/10",
  },
} as const;

const STATUS_LEVEL = {
  favorable: "good",
  needs_care: "caution",
  unsuitable: "critical",
} as const;

function FindingRow({ finding }: { finding: SoilCheckFinding }) {
  const { t } = useLanguage();
  const style = LEVEL_STYLE[finding.level];
  const Icon = style.icon;
  const value = finding.value === null ? "" : String(finding.value);
  return (
    <li className="flex gap-2.5 text-sm" data-level={finding.level}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.text)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium">{t(`sensor.${finding.field}` as MessageKey)}</span>
          {value ? <span className="text-muted-foreground">{value}</span> : null}
          <span className={cn("text-xs font-medium", style.text)}>
            {t(`soilCheck.level.${finding.level}` as MessageKey)}
          </span>
        </p>
        <p className="text-muted-foreground">
          {value
            ? t(`soilCheck.${finding.code}` as MessageKey, { value })
            : // Older assessments have no number; drop the "(value)" part.
              t(`soilCheck.${finding.code}` as MessageKey, { value: "" }).replace(
                /\s*\([^)]*\)/,
                "",
              )}
        </p>
      </div>
    </li>
  );
}

export function SoilCheckPanel({ check }: { check: SoilCheck | undefined }) {
  const { t } = useLanguage();
  if (!check || check.findings.length === 0) return null;

  const style = LEVEL_STYLE[STATUS_LEVEL[check.status]];
  const Icon = style.icon;
  const findings = [...check.findings].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  );

  return (
    <section
      aria-label={t("soilCheck.title")}
      data-status={check.status}
      className={cn("flex flex-col gap-3 rounded-lg border px-4 py-4", style.ring)}
    >
      <div className="flex gap-2.5">
        <Icon className={cn("mt-0.5 size-5 shrink-0", style.text)} aria-hidden />
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-sm font-medium">{t("soilCheck.title")}</h3>
          <p className="text-sm">{t(`soilCheck.${check.status}` as MessageKey)}</p>
        </div>
      </div>
      <ul className="border-border flex flex-col gap-2.5 border-t pt-3">
        {findings.map((finding) => (
          <FindingRow key={finding.field} finding={finding} />
        ))}
      </ul>
    </section>
  );
}
