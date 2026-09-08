import Link from "next/link";
import { ArrowRight, CalendarCheck, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { AssessmentEligibility } from "@/lib/api/risk-api";

function daysLabel(days: number) {
  if (days <= 0) return "today";
  return days === 1 ? "in 1 day" : `in ${days} days`;
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
            <h2 className="font-medium">Weekly Assessment Completed</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              You have already completed this week&apos;s assessment for {plantLabel}.
              Your next assessment will be available {daysLabel(eligibility.days_remaining)}.
            </p>
          </div>
        </div>

        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <span className="flex items-center gap-2 text-sm">
            <CalendarCheck
              className="size-4"
              style={{ color: "var(--landing-accent)" }}
            />
            Next assessment
          </span>
          <span className="text-sm font-medium tabular-nums">
            {eligibility.next_assessment_date
              ? formatDisplayDate(eligibility.next_assessment_date)
              : "Available now"}
          </span>
        </div>

        {eligibility.last_assessment_date && (
          <p className="text-muted-foreground/70 text-xs">
            Last assessed {formatDisplayDate(eligibility.last_assessment_date)} · one
            assessment per {eligibility.interval_days} days.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/farmer/plants/${plantId}`} />}>
            Back to plant
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/assessments" />}
          >
            View past assessments
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
