"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchPlants } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useLanguage } from "@/lib/i18n";

/**
 * After a result: straight on to the next plant whose weekly check is due,
 * so a Farmer with several due plants is not sent back to the Risk Indicator
 * between each one. Due means the server's `can_assess`, read fresh here
 * (the plant just assessed has already dropped out of it).
 *
 * Shows nothing while loading or if the list cannot load; the result's own
 * "Back to Risk Indicator" button still works.
 */
export function NextDuePlant({ currentPlantId }: { currentPlantId: number }) {
  const { t } = useLanguage();
  const { data: plants } = useAuthedQuery((token) => fetchPlants(token), []);
  if (!plants) return null;

  const due = plants.filter(
    (plant) => plant.id !== currentPlantId && plant.assessment_eligibility.can_assess,
  );

  if (due.length === 0) {
    return (
      <p className="text-risk-low flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4" />
        {t("asmt.allChecked")}
      </p>
    );
  }

  const [next] = due;
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="lg"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/farmer/plants/${next.id}/assessment`} />}
      >
        {t("asmt.nextPlant", { name: next.display_name })}
        <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
      </Button>
      <p className="text-muted-foreground text-sm">
        {due.length === 1 ? t("asmt.stillDueOne") : t("asmt.stillDue", { n: due.length })}
      </p>
    </div>
  );
}
