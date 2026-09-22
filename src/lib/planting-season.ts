import type {
  PlantingAdvice,
  PlantingAdviceStatus,
  PlantingWindow,
} from "@/lib/api/plants-api";
import { englishT, type MessageKey, type Translate } from "@/lib/i18n";

/**
 * Turns a crop's planting window into a verdict for one month.
 *
 * This mirrors `plants/crop_calendar.evaluate` in Django, and deliberately
 * mirrors only the membership test — which list is the month in. Every line
 * of agronomic wording still comes from the server payload, so there is one
 * place to correct the advice and it is not here.
 *
 * The reason it exists at all: the farmer changes the planting date in the
 * form, and re-fetching the crop catalog on every keystroke to re-derive a
 * list membership would be silly. Django stays authoritative for the text,
 * and for the verdict stored against a saved plant (`plant.planting_advice`).
 */

export function monthName(month: number, t: Translate = englishT): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return "";
  return t(`month.${month - 1}` as MessageKey);
}

export function adviseForMonth(
  window: PlantingWindow | null | undefined,
  month: number,
  t: Translate = englishT,
): PlantingAdvice | null {
  if (!window || month < 1 || month > 12) return null;

  const preferred = window.preferred_months ?? [];
  const caution = window.caution_months ?? [];
  if (preferred.length === 0 && caution.length === 0) return null;

  const name = monthName(month, t);
  let status: PlantingAdviceStatus;
  let headline: string;
  let detail: string;

  if (preferred.includes(month)) {
    status = "good";
    headline = t("season.goodHeadline", { month: name });
    detail = window.reason;
  } else if (caution.includes(month)) {
    status = "caution";
    headline = t("season.cautionHeadline", { month: name });
    detail = [window.caution_note, window.risk].filter(Boolean).join(" ");
  } else {
    status = "poor";
    headline = t("season.poorHeadline", { month: name });
    detail = window.risk;
  }

  return {
    status,
    month,
    month_name: name,
    headline,
    detail: detail.trim(),
    preferred_months: preferred,
    preferred_label: window.preferred_label,
    caution_months: caution,
  };
}

/**
 * The month to advise on: the date the farmer has chosen, falling back to
 * today while the field is still empty. Parsed off the ISO string rather
 * than through `new Date()`, which would shift the month across a timezone
 * boundary for dates near the first or last of the month.
 */
export function monthFromIsoDate(isoDate: string | null | undefined): number {
  if (isoDate) {
    const parsed = Number(isoDate.slice(5, 7));
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  }
  return new Date().getMonth() + 1;
}
