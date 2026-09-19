"use client";

import Link from "next/link";
import { Droplets, FlaskConical } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SoilPhScale } from "@/components/farmer/soil-ph-scale";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { FarmEnvironment } from "@/lib/api/dashboard-api";

/**
 * The farm's latest soil readings, with a trend once there is more than one.
 *
 * WHAT THIS PANEL DOES NOT SHOW, AND WHY
 * --------------------------------------
 * Temperature and humidity. BulanTanom has no weather feed and no sensors;
 * the only environmental readings that exist are the ones a farmer types on
 * the soil form. Rather than draw two empty gauges that look like broken
 * instruments, the panel names what is not measured — the server sends that
 * list in `not_collected`, so this stays true if sensors are added later.
 *
 * pH is optional on the form, so it is frequently null. Null is rendered as
 * "not recorded", never as 0, which would plot as extreme acidity.
 */

const NOT_COLLECTED_LABEL: Record<string, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
};

type EnvironmentPanelProps = {
  environment: FarmEnvironment;
};

export function EnvironmentPanel({ environment }: EnvironmentPanelProps) {
  const { latest, history, not_collected: notCollected } = environment;

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Soil conditions</h2>
          <Link
            href="/farmer/soil-recommendation"
            className="shrink-0 text-xs underline underline-offset-2"
            style={{ color: "var(--landing-accent)" }}
          >
            {latest ? "Update" : "Add reading"}
          </Link>
        </div>

        {!latest ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No soil reading recorded yet. Add one and its moisture and pH will
            show here.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Recorded {formatDisplayDate(latest.recorded_on)}
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="border-border/60 rounded-lg border px-3 py-2">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Droplets className="size-3.5" aria-hidden="true" />
                  Soil moisture
                </dt>
                <dd className="mt-1 text-lg font-medium">
                  {latest.soil_moisture_label ?? (
                    <span className="text-muted-foreground text-sm font-normal">
                      Not recorded
                    </span>
                  )}
                </dd>
              </div>

              <div className="border-border/60 rounded-lg border px-3 py-2">
                <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <FlaskConical className="size-3.5" aria-hidden="true" />
                  Soil pH
                </dt>
                <dd className="mt-1 text-lg font-medium tabular-nums">
                  {latest.ph_level ?? (
                    <span className="text-muted-foreground text-sm font-normal">
                      Not recorded
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="text-muted-foreground mt-2 text-xs">
              {latest.soil_type_label} · {latest.drainage_label} drainage
            </p>

            {/* The scale replaces a dot-per-reading time plot. Readings are
                months apart and often only two, so time carried no signal —
                and with both on one day the axis read "Sep 14 … Sep 14".
                Where the reading sits against the ideal band is the thing
                the farmer needs. */}
            {latest.ph_level !== null && (
              <SoilPhScale
                ph={latest.ph_level}
                recordedOn={latest.recorded_on}
                history={history}
              />
            )}
          </>
        )}

        {notCollected.length > 0 && (
          <p className="text-muted-foreground/70 border-border/60 mt-3 border-t pt-2 text-[11px]">
            {notCollected
              .map((k) => NOT_COLLECTED_LABEL[k] ?? k)
              .join(" and ")}{" "}
            {notCollected.length === 1 ? "is" : "are"} not measured at Layuan
            Farm — BulanTanom has no weather feed or sensors, so nothing is
            shown rather than a guess.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
