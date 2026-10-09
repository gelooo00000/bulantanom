"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";

import type { ReportDocument, ReportStat, ReportTable } from "@/lib/api/reports-api";
import { REPORT_STRINGS as t } from "@/lib/report-strings";
import { CARD_OUTLINE } from "@/lib/crop-colors";
import { cn } from "@/lib/utils";

const TONE_TEXT: Record<string, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
};

const TONE_STRIP: Record<string, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-medium",
  high: "bg-risk-high",
};

/** "High", "Medium risk", "Low" -> its tone; anything else has none. */
function toneOf(value: unknown): string | undefined {
  const first = String(value ?? "").split(" ")[0].toLowerCase();
  return first in TONE_TEXT ? first : undefined;
}

function StatTile({ stat }: { stat: ReportStat }) {
  return (
    <div className={cn("border-border bg-card relative overflow-hidden rounded-xl border px-3 pt-3.5 pb-2.5", CARD_OUTLINE)}>
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          stat.tone ? TONE_STRIP[stat.tone] : "bg-primary",
        )}
      />
      <p
        className={cn(
          "font-heading text-2xl leading-tight font-medium tabular-nums",
          stat.tone ? TONE_TEXT[stat.tone] : undefined,
        )}
      >
        {stat.value}
      </p>
      <p className="text-muted-foreground text-xs">{stat.label}</p>
    </div>
  );
}

function ReportTableView({ table }: { table: ReportTable }) {
  // Relative widths keep dates and levels narrow and give the room to text.
  const total = table.widths?.reduce((a, b) => a + b, 0);

  return (
    <section>
      <h3 className="font-heading text-sm font-medium">{table.title}</h3>
      {table.rows.length === 0 ? (
        <p className="border-border text-muted-foreground mt-2 rounded-xl border border-dashed px-3 py-4 text-center text-sm">
          {t.noRecords}
        </p>
      ) : (
        // Wide tables scroll in their own frame; the page body itself never
        // scrolls sideways.
        <div className="border-border mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            {total ? (
              <colgroup>
                {table.widths!.map((w, i) => (
                  <col key={i} style={{ width: `${(w / total) * 100}%` }} />
                ))}
              </colgroup>
            ) : null}
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {table.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-border/70 even:bg-muted/40 border-t">
                  {table.keys.map((k) => {
                    const text = String(row[k] ?? "-");
                    const tone = k === table.tone_key ? toneOf(text) : undefined;
                    return (
                      <td
                        key={k}
                        className={cn(
                          "px-3 py-2 align-top text-xs",
                          // Dates never break mid-value.
                          /^\d{4}-\d{2}-\d{2}$/.test(text) && "whitespace-nowrap",
                          tone && cn("font-semibold", TONE_TEXT[tone]),
                        )}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * The printable body of a report.
 *
 * Marked `report-sheet` so the print stylesheet can keep this and drop the
 * dashboard chrome around it. It carries only what belongs on paper: the
 * masthead, the summary figures, the tables and a signature block.
 */
export function ReportPreview({ report }: { report: ReportDocument }) {
  const generated = new Date(report.generated_at);

  return (
    <article className={cn("report-sheet border-border bg-card relative overflow-hidden rounded-2xl border", CARD_OUTLINE)}>
      <span aria-hidden="true" className="bg-primary absolute inset-x-0 top-0 h-1" />

      <div className="flex flex-col gap-6 px-5 pt-6 pb-5 sm:px-7">
        {/* Masthead - the branding a printed government report needs. A div,
            not <header>: the print stylesheet removes every <header> as
            dashboard chrome. */}
        <div className="border-primary/70 flex flex-wrap items-start justify-between gap-4 border-b-2 pb-4">
          <div className="flex items-start gap-3">
            <span className="relative block size-12 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
              <Image
                src="/layuan.jpg"
                alt="Layuan Nature Integrated Farm"
                fill
                sizes="48px"
                className="object-contain p-0.5"
              />
            </span>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                {t.brand}
              </p>
              <h2 className="font-heading text-primary text-xl leading-tight font-medium tracking-tight">
                {report.title}
              </h2>
              <p className="text-muted-foreground text-xs">{report.category}</p>
            </div>
          </div>
          <div className="text-muted-foreground text-xs leading-relaxed sm:text-right">
            <p className="text-foreground font-medium">{report.farm.name}</p>
            <p>{report.farm.location}</p>
            <p className="mt-1">
              <span className="text-foreground font-medium">{t.period}:</span> {report.period.label}
            </p>
            <p>{report.period.range}</p>
          </div>
        </div>

        <p className="text-muted-foreground -mt-2 text-sm">{report.description}</p>

        {report.stats.length > 0 && (
          <section>
            <h3 className="font-heading text-sm font-medium">{t.summary}</h3>
            <div
              className={cn(
                "report-stats mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3",
                report.stats.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
              )}
            >
              {report.stats.map((s) => (
                <StatTile key={s.label} stat={s} />
              ))}
            </div>
          </section>
        )}

        {report.tables.map((table) => (
          <ReportTableView key={table.title} table={table} />
        ))}

        {/* Signature block: a printed report is signed and filed. */}
        <section className="report-signatures grid grid-cols-2 gap-8 pt-4 text-xs sm:gap-16">
          <div>
            <p className="text-muted-foreground">{t.preparedBy}</p>
            <p className="border-foreground/70 mt-8 border-b pb-1 font-semibold">
              {report.prepared_by || " "}
            </p>
            <p className="text-muted-foreground mt-1">{t.preparedByRole}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.notedBy}</p>
            <p className="border-foreground/70 mt-8 border-b pb-1">&nbsp;</p>
            <p className="text-muted-foreground mt-1">{t.notedByRole}</p>
          </div>
        </section>

        <footer className="border-border text-muted-foreground/80 flex items-start gap-1.5 border-t border-dashed pt-3 text-[11px]">
          <Sparkles className="mt-px size-3 shrink-0" />
          <span>
            {t.generated} {generated.toLocaleString()}. {t.footerNote}
          </span>
        </footer>
      </div>
    </article>
  );
}
