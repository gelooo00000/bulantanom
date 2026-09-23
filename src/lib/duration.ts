import { englishT, type Translate } from "@/lib/i18n";

/**
 * A length of time a farmer can read at a glance.
 *
 * Tree crops are stored in days like everything else — a Cardinal avocado is
 * 1460 — and "1460 days to go" is a number nobody converts in their head.
 * Anything past a few weeks is said in weeks, months or years instead.
 *
 * Deliberately approximate: the underlying figure is a typical growing
 * duration, not a promise, so "about 4 years" is the honest precision.
 */
export function humanDuration(days: number, t: Translate = englishT): string {
  const whole = Math.max(0, Math.round(days));
  if (whole <= 1) return t("duration.day", { n: whole });
  if (whole < 14) return t("duration.days", { n: whole });

  if (whole < 60) {
    const weeks = Math.round(whole / 7);
    return weeks === 1 ? t("duration.week") : t("duration.weeks", { n: weeks });
  }

  if (whole < 365) {
    const months = Math.round(whole / 30);
    return months === 1 ? t("duration.month") : t("duration.months", { n: months });
  }

  const years = Math.floor(whole / 365);
  const months = Math.round((whole % 365) / 30);
  // 11 leftover months is next year's January, not "4 years 11 months".
  if (months >= 11) return t("duration.years", { n: years + 1 });
  // A month or less over is noise against a figure measured in years.
  if (months <= 1) {
    return years === 1 ? t("duration.year") : t("duration.years", { n: years });
  }
  return t("duration.yearsMonths", { years, months });
}
