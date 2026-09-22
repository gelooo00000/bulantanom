"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { AssessmentEligibility } from "@/lib/api/risk-api";
import { useLanguage, type Translate } from "@/lib/i18n";

function daysLabel(days: number, t: Translate) {
  if (days <= 0) return t("lock.today");
  return days === 1 ? t("lock.inOne") : t("lock.inDays", { n: days });
}

/**
 * Shown when a plant's weekly assessment is already done. Every figure comes
 * from the backend's `assessment_eligibility` — nothing is derived from the
 * browser clock, so changing the system date does not change what is shown
 * (or, more importantly, what the server will accept).
 */
export function AssessmentLockCard({
  eligibility,
  plantLabel,
  plantId,
}: {
  eligibility: AssessmentEligibility;
  plantLabel: string;
  plantId: number;
}) {
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex flex-col gap-4 px-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: "var(--landing-accent)",
              color: "var(--landing-accent)",
            }}
          >
            <Sprout className="size-5" />
          </span>
          <div>
            {eligibility.planned ? (
              // A planned planting: not assessed yet, and not assessable
              // until the day it goes in the ground.
              <>
                <h2 className="font-medium">{t("lock.notPlanted")}</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("lock.plannedText", {
                    name: plantLabel,
                    date: eligibility.next_assessment_date
                      ? date(eligibility.next_assessment_date)
                      : t("lock.laterDate"),
                    when: daysLabel(eligibility.days_remaining, t),
                  })}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-medium">{t("lock.doneTitle")}</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("lock.doneText", {
                    name: plantLabel,
                    when: daysLabel(eligibility.days_remaining, t),
                  })}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm">
            <CalendarCheck
              className="size-4"
              style={{ color: "var(--landing-accent)" }}
            />
            {eligibility.planned ? t("lock.first") : t("lock.next")}
          </span>
          <span className="text-sm font-medium tabular-nums">
            {eligibility.next_assessment_date
              ? date(eligibility.next_assessment_date)
              : t("lock.availableNow")}
          </span>
        </div>

        {eligibility.last_assessment_date && (
          <p className="text-muted-foreground/70 text-xs">
            {t("lock.last", {
              date: date(eligibility.last_assessment_date),
              n: eligibility.interval_days,
            })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/farmer/plants/${plantId}`} />}>
            {t("lock.backToPlant")}
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/assessments" />}
          >
            {t("lock.past")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
