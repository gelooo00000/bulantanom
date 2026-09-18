"use client";

import Link from "next/link";
import { Droplets, FlaskConical } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate, formatShortDate } from "@/components/ui/date-picker";
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

const PH_MIN = 3.5;
const PH_MAX = 9;

type EnvironmentPanelProps = {
  environment: FarmEnvironment;
};

export function EnvironmentPanel({ environment }: EnvironmentPanelProps) {
  const { latest, history, not_collected: notCollected } = environment;

  const phHistory = history.filter((h) => h.ph !== null);
  const showPhTrend = phHistory.length >= 2;

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

            {showPhTrend && (
              <div className="border-border/60 mt-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  pH across your last {phHistory.length} readings
                </p>
                {/* A dot per reading on a fixed pH scale. Deliberately not a
                    line: soil readings are taken weeks or months apart and a
                    connecting line would imply a continuous drift nobody
                    measured. */}
                <div
                  className="mt-2 flex h-10 items-end gap-1"
                  role="img"
                  aria-label={phHistory
                    .map((h) => `${formatShortDate(h.date)}: pH ${h.ph}`)
                    .join(", ")}
                >
                  {phHistory.map((h) => {
                    const clamped = Math.min(Math.max(h.ph!, PH_MIN), PH_MAX);
                    const pct = ((clamped - PH_MIN) / (PH_MAX - PH_MIN)) * 100;
                    return (
                      <div
                        key={h.id}
                        className="relative flex-1"
                        style={{ height: "100%" }}
                        title={`${formatShortDate(h.date)}: pH ${h.ph}`}
                      >
                        <span
                          className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full"
                          style={{
                            bottom: `${pct}%`,
                            background: "var(--landing-accent)",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
                  <span>{formatShortDate(phHistory[0].date)}</span>
                  <span>pH {PH_MIN}–{PH_MAX} scale</span>
                  <span>
                    {formatShortDate(phHistory[phHistory.length - 1].date)}
                  </span>
                </div>
              </div>
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
