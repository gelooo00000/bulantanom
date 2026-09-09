"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { ReportDocument, ReportStat } from "@/lib/api/reports-api";
import { REPORT_STRINGS as t } from "@/lib/report-strings";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
};

function StatTile({ stat }: { stat: ReportStat }) {
  return (
    <div className="border-border rounded-lg border px-3 py-2.5">
      <p
        className={cn(
          "text-xl font-medium tabular-nums",
          stat.tone ? TONE_CLASS[stat.tone] : undefined,
        )}
      >
        {stat.value}
      </p>
      <p className="text-muted-foreground text-xs">{stat.label}</p>
    </div>
  );
}

/**
 * The printable body of a report.
 *
 * Marked `report-sheet` so the print stylesheet can keep this and drop the
 * dashboard chrome around it. Wide tables scroll on screen and are printed
 * landscape by the same stylesheet, rather than being squeezed to fit.
 */
export function ReportPreview({ report }: { report: ReportDocument }) {
  const generated = new Date(report.generated_at);

  return (
    <Card className="report-sheet gap-0 py-0">
      <CardContent className="flex flex-col gap-5 px-5 py-5">
        {/* Masthead - the branding a printed government report needs. */}
        <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="flex items-start gap-3">
            <span className="relative block size-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
              <Image
                src="/layuan.jpg"
                alt="Layuan Nature Integrated Farm"
                fill
                sizes="40px"
                className="object-contain p-0.5"
              />
            </span>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                {t.brand}
              </p>
              <h2 className="text-lg font-medium tracking-tight">{report.title}</h2>
              <p className="text-muted-foreground text-xs">{report.category}</p>
            </div>
          </div>
          <div className="text-muted-foreground text-xs sm:text-right">
            <p>
              <span className="font-medium">{t.farm}:</span> {report.farm.name}
            </p>
            <p>{report.farm.location}</p>
            <p className="mt-1">
              <span className="font-medium">{t.period}:</span> {report.period.label}
            </p>
            <p>{report.period.range}</p>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">{report.description}</p>

        {report.stats.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t.summary}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {report.stats.map((s) => (
                <StatTile key={s.label} stat={s} />
              ))}
            </div>
          </div>
        )}

        {report.tables.map((table) => (
          <div key={table.title}>
            <h3 className="text-sm font-medium">{table.title}</h3>
            {table.rows.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">{t.noRecords}</p>
            ) : (
              // Wide tables must scroll in their own frame; the page body
              // itself never scrolls sideways.
              <div className="border-border mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-max border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      {table.columns.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="border-border border-b px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, i) => (
                      <tr key={i} className="border-border/60 border-b last:border-0">
                        {table.keys.map((k) => (
                          <td key={k} className="px-3 py-2 align-top text-xs">
                            {String(row[k] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {report.details.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t.soilDetails}</h3>
            <div className="mt-2 flex flex-col gap-3">
              {report.details.map((d) => (
                <div key={d.id} className="border-border rounded-lg border px-4 py-3">
                  <p className="text-sm font-medium">{d.heading}</p>
                  {!d.analysed ? (
                    <p className="text-muted-foreground mt-1 text-sm">{d.unavailable}</p>
                  ) : (
                    <dl className="mt-2 flex flex-col gap-1.5">
                      {d.sections.map((s) => (
                        <div key={s.label} className="text-sm">
                          <dt className="text-muted-foreground text-xs">{s.label}</dt>
                          <dd>{s.text || t.noneRecorded}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-border text-muted-foreground/70 flex flex-wrap items-center gap-1.5 border-t pt-3 text-[11px]">
          <Sparkles className="size-3 shrink-0" />
          <span>
            {t.footerNote} {t.generated} {generated.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
