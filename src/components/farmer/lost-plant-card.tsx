"use client";

import { TriangleAlert } from "lucide-react";

import { CropTile, FarmCard } from "@/components/farmer/farm-card";
import { CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage, type MessageKey } from "@/lib/i18n";

/** A plant reported dead, in the Archive's Lost list. Final: it cannot be restored. */
export function LostPlantCard({ plant }: { plant: BackendPlant }) {
  const { t, dateLocale } = useLanguage();
  const report = plant.loss_report;

  return (
    <FarmCard cropName={plant.crop.name} accent="var(--risk-high)" className="opacity-85">
      <CardContent className="flex h-full flex-col gap-3 px-4 sm:px-5">
        <div className="flex items-start gap-3">
          <CropTile
            cropName={plant.crop.name}
            emoji={plant.crop.emoji}
            accent="var(--risk-high)"
            ring
            className="grayscale"
          />
          <div className="min-w-0">
            <p className="font-heading line-clamp-2 text-[17px] leading-snug break-words">
              {plant.display_name}
            </p>
            {report && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {t("lost.on", {
                  date: formatDisplayDate(report.lost_at.slice(0, 10), dateLocale),
                })}
              </p>
            )}
          </div>
        </div>

        {report && (
          <div className="flex flex-col gap-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">{t("lost.cause")} </span>
              <span className="font-medium">{t(`lost.cause.${report.cause}` as MessageKey)}</span>
            </p>
            {report.warned_before && (
              <p className="text-risk-medium flex items-center gap-1.5 text-xs font-medium">
                <TriangleAlert className="size-3.5 shrink-0" />
                {t("lost.warned")}
              </p>
            )}
            {report.notes && <p className="text-muted-foreground line-clamp-2 text-xs">{report.notes}</p>}
          </div>
        )}

      </CardContent>
    </FarmCard>
  );
}
