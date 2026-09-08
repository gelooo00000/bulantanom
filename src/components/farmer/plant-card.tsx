import Link from "next/link";
import { ArrowRight, CircleCheck, ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";

/** Card for a real, database-backed plant owned by the authenticated Farmer. */
export function PlantCard({ plant }: { plant: BackendPlant }) {
  return (
    <Link href={`/farmer/plants/${plant.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-primary/10 h-full gap-4 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <CardContent className="flex flex-col gap-3 px-5">
          <div className="min-w-0">
            <p className="truncate font-medium">
              <span aria-hidden="true">{plant.crop.emoji}</span> {plant.display_name}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {plant.crop.name} · {plant.status_label}
            </p>
          </div>
          <div className="text-muted-foreground flex flex-col gap-1 text-xs">
            <span>Planted {formatDisplayDate(plant.planting_date)}</span>
            <span className="flex items-center gap-1">
              Expected harvest {formatDisplayDate(plant.expected_harvest_start)}
              <ArrowRight className="size-3" />
            </span>
            <span>{plant.age_days} days old</span>
          </div>

          {/* The weekly assessment is the Farmer's recurring job, and the lock
              state was already on every plant - it just was not shown, so the
              only way to find an assessable plant was to open each one. */}
          {plant.assessment_eligibility.can_assess ? (
            <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
              <ClipboardList className="size-3.5 shrink-0" />
              Ready to assess
            </span>
          ) : plant.assessment_eligibility.next_assessment_date ? (
            <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <CircleCheck className="size-3.5 shrink-0" />
              Assessed · next{" "}
              {formatDisplayDate(plant.assessment_eligibility.next_assessment_date)}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
