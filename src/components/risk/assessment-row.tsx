"use client";

import Link from "next/link";
import { CalendarDays, ImageOff, ImageIcon, User } from "lucide-react";
import { useState } from "react";

import { RiskBadge } from "@/components/risk/risk-badge";
import { AuthedImage } from "@/components/shared/authed-image";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendAssessment } from "@/lib/api/risk-api";

/**
 * Compact summary of one assessment. Used by both Farmer history and the
 * LGU read-only views — the LGU variant shows the owning Farmer, which is
 * present only on LGU endpoints.
 */
export function AssessmentRow({
  assessment,
  href,
  showFarmer = false,
}: {
  assessment: BackendAssessment;
  href?: string;
  showFarmer?: boolean;
}) {
  const risk = assessment.risk;
  const level = risk?.risk_level;
  // Evidence photos are full-resolution uploads, so one is fetched only when
  // it is actually asked for - never for every row in a long history list.
  const [showEvidence, setShowEvidence] = useState(false);

  const body = (
    <Card className="hover:border-primary/40 gap-2 py-4 transition-colors">
      <CardContent className="flex flex-col gap-2 px-5">
        <div className="flex flex-wrap items-center gap-2">
          {level ? (
            <RiskBadge
              level={level.toLowerCase() as "low" | "medium" | "high"}
              size="sm"
            />
          ) : (
            <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
              No reading
            </span>
          )}
          <span className="text-sm font-medium">
            {assessment.crop_emoji} {assessment.plant_display_name}
          </span>
          <span className="text-muted-foreground text-xs">
            day {assessment.plant_age_days}
          </span>
        </div>

        <p className="text-muted-foreground line-clamp-2 text-sm">
          {risk?.status === "completed" && risk.summary
            ? risk.summary
            : (risk?.failure_reason ??
              "AI risk analysis was not available for this assessment.")}
        </p>

        <div className="text-muted-foreground/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3" />
            {new Date(assessment.assessment_date).toLocaleDateString()}
          </span>
          {assessment.evidence_image_url ? (
            <button
              type="button"
              aria-expanded={showEvidence}
              onClick={(event) => {
                // On Farmer screens the whole card is a Link; without this the
                // click would navigate away instead of revealing the photo.
                event.preventDefault();
                event.stopPropagation();
                setShowEvidence((open) => !open);
              }}
              className="hover:text-foreground flex items-center gap-1.5 underline-offset-2 hover:underline"
            >
              <ImageIcon className="size-3" />
              {showEvidence ? "Hide photo" : "View photo"}
            </button>
          ) : (
            <span className="flex items-center gap-1.5">
              <ImageOff className="size-3" />
              No photo
            </span>
          )}
          {showFarmer && assessment.farmer && (
            <span className="flex items-center gap-1.5">
              <User className="size-3" />
              {assessment.farmer.full_name}
            </span>
          )}
        </div>

        {showEvidence && assessment.evidence_image_url && (
          <div className="border-border overflow-hidden rounded-lg border">
            <AuthedImage
              src={assessment.evidence_image_url}
              alt={`Plant condition evidence for ${assessment.plant_display_name}`}
              className="bg-muted max-h-72 w-full object-contain"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="rounded-xl focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}
