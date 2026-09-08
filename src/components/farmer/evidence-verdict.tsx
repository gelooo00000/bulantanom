import { CircleCheck, ImageOff, ScanEye, TriangleAlert } from "lucide-react";
import type { ElementType } from "react";

import { Button } from "@/components/ui/button";
import type { EvidenceValidation } from "@/lib/api/risk-api";
import { cn } from "@/lib/utils";

const STYLES: Record<
  string,
  { icon: ElementType; title: string; tone: string; border: string }
> = {
  match: {
    icon: CircleCheck,
    title: "Plant Evidence Verified",
    tone: "text-risk-low",
    border: "border-risk-low/30 bg-risk-low/5",
  },
  mismatch: {
    icon: TriangleAlert,
    title: "Evidence Doesn't Match",
    tone: "text-risk-medium",
    border: "border-risk-medium/30 bg-risk-medium/5",
  },
  no_plant: {
    icon: ImageOff,
    title: "Invalid Plant Evidence",
    tone: "text-risk-high",
    border: "border-risk-high/30 bg-risk-high/5",
  },
  unclear: {
    icon: ScanEye,
    title: "Photo Not Clear Enough",
    tone: "text-risk-medium",
    border: "border-risk-medium/30 bg-risk-medium/5",
  },
};

/**
 * The result of the pre-submission evidence check. Keeps the wording to one
 * short reason plus one action, so the AI step reads as a quick confirmation
 * rather than a wall of machine commentary.
 */
export function EvidenceVerdict({
  result,
  onReplace,
}: {
  result: EvidenceValidation;
  onReplace?: () => void;
}) {
  const style = STYLES[result.verdict] ?? STYLES.unclear;
  const Icon = style.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", style.border)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.tone)} />
      <div className="flex flex-col items-start gap-3">
        <div>
          <p className="text-sm font-medium">{style.title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{result.reason}</p>
          {!result.evidence_valid && (
            <p className="text-muted-foreground mt-1 text-sm">{result.message}</p>
          )}
        </div>
        {!result.evidence_valid && onReplace && (
          <Button type="button" size="sm" variant="outline" onClick={onReplace}>
            Replace Image
          </Button>
        )}
      </div>
    </div>
  );
}
