"use client";

import { ArrowDown, ArrowUp, ChevronDown, Search, TriangleAlert, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { LguSoilRecommendation } from "@/lib/api/lgu-api";
import {
  PH_BANDS,
  latestPerFarmer,
  matchesFarmer,
  needsAttention,
  phBand,
  phValue,
  previousPh,
  recommendedCrops,
  type PhBand,
} from "@/lib/lgu-soil-stats";
import { cn } from "@/lib/utils";

/**
 * The body of the LGU Crop Recommendation Records page: a one-line summary,
 * then every soil record — each Farmer's latest by default — searchable and
 * filterable to the ones that need a follow-up.
 */

const BAND_CHIP: Record<PhBand, string> = {
  TOO_ACIDIC: "bg-risk-high/15 text-risk-high border-risk-high/30",
  SLIGHTLY_ACIDIC: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  IDEAL: "bg-risk-low/15 text-risk-low border-risk-low/30",
  ALKALINE: "bg-[var(--chart-series-1)]/15 text-[var(--chart-series-1)] border-[var(--chart-series-1)]/30",
  NONE: "border-border text-muted-foreground",
};

type Status = "ALL" | "ATTENTION" | "NOT_ANALYZED";

export function SoilRecords({ records }: { records: LguSoilRecommendation[] }) {
  const latest = useMemo(() => latestPerFarmer(records), [records]);
  const notAnalysed = latest.filter((r) => !r.ai_generated).length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground -mt-2 text-sm">
        {records.length} record{records.length === 1 ? "" : "s"} from {latest.length} farmer
        {latest.length === 1 ? "" : "s"}
        {notAnalysed > 0 && (
          <span className="text-risk-medium">
            {" "}
            · {notAnalysed} farmer{notAnalysed === 1 ? "'s" : "s'"} latest soil check has no AI
            advice yet
          </span>
        )}
      </p>

      <section aria-label="Soil records" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Soil records</h2>
        <RecordList records={records} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- list */

export function RecordList({ records }: { records: LguSoilRecommendation[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("ALL");
  const [history, setHistory] = useState(false);

  const base = useMemo(
    () => (history ? records : latestPerFarmer(records)).filter((r) => matchesFarmer(r, query)),
    [records, history, query],
  );
  const counts = {
    ALL: base.length,
    ATTENTION: base.filter(needsAttention).length,
    NOT_ANALYZED: base.filter((r) => !r.ai_generated).length,
  };
  const shown = base
    .filter(
      (r) =>
        status === "ALL" ||
        (status === "ATTENTION" && needsAttention(r)) ||
        (status === "NOT_ANALYZED" && !r.ai_generated),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Search by farmer name or email"
          aria-label="Search soil records by farmer"
          className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border pr-9 pl-9 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter records">
          {(
            [
              ["ALL", "All"],
              ["ATTENTION", "Needs attention"],
              ["NOT_ANALYZED", "Not analysed"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                status === value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {text}
              <span className="text-muted-foreground ml-1.5 tabular-nums">{counts[value]}</span>
            </button>
          ))}
        </div>

        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={history}
            onChange={(e) => setHistory(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Show every submission
        </label>
      </div>

      <p className="text-muted-foreground text-sm" role="status">
        {shown.length === 1 ? "1 record" : `${shown.length} records`}
        {history ? " · newest first" : " · each farmer's latest"}
      </p>

      {shown.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {query.trim() ? `No farmers match "${query.trim()}".` : "No records in this view."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((record) => (
            <li key={record.id}>
              <RecordCard record={record} previous={previousPh(record, records)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- record */

/** One reported soil property, hidden entirely when the Farmer said "Unknown". */
function SoilFact({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  if (value === null || value === "" || value === "Unknown") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">
        {value}
        {unit ? <span className="text-muted-foreground ml-1 text-xs">{unit}</span> : null}
      </span>
    </div>
  );
}

function CropList({ title, crops }: { title: string; crops: LguSoilRecommendation["suitable_fruits"] }) {
  if (crops.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {crops.map((crop) => (
          <span key={crop.id} title={crop.reason} className="border-border bg-card/60 rounded-lg border px-2 py-1 text-sm">
            <span aria-hidden>{crop.emoji}</span> {crop.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function AdviceList({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: { recommendation: string }[];
  warning?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{title}</span>
      <ul className={cn("flex flex-col gap-1 text-sm", warning ? "text-risk-medium" : "text-muted-foreground")}>
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            {warning ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> : <span aria-hidden>•</span>}
            <span>{item.recommendation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecordCard({
  record,
  previous,
}: {
  record: LguSoilRecommendation;
  /** The same Farmer's previous pH, to show how the soil has moved. */
  previous: number | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ph = phValue(record);
  const band = phBand(ph);
  const bandLabel = PH_BANDS.find((b) => b.key === band)!.label;
  const crops = recommendedCrops(record);
  const warnings = record.important_warnings.length;
  const submitted = new Date(record.created_at).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="hover:bg-muted/40 flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors"
      >
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-medium">{record.farmer_name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {submitted}
            {record.has_sensor_readings &&
              record.nitrogen !== null &&
              ` · N ${record.nitrogen} · P ${record.phosphorus ?? "—"} · K ${record.potassium ?? "—"}`}
            {!record.has_sensor_readings &&
              record.legacy_soil_type_label &&
              ` · ${record.legacy_soil_type_label}`}
          </p>
        </div>

        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", BAND_CHIP[band])}>
          {ph === null ? "No pH" : `pH ${ph.toFixed(1)} · ${bandLabel}`}
        </span>

        {record.ai_generated ? (
          <span className="flex shrink-0 items-center gap-1 text-sm" title={crops.map((c) => c.name).join(", ")}>
            <span aria-hidden="true">
              {crops
                .slice(0, 4)
                .map((c) => c.emoji)
                .join(" ")}
            </span>
            <span className="text-muted-foreground text-xs">
              {crops.length} crop{crops.length === 1 ? "" : "s"}
            </span>
          </span>
        ) : (
          <span className="bg-risk-medium/15 text-risk-medium border-risk-medium/30 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium">
            Not analysed
          </span>
        )}

        {warnings > 0 && (
          <span className="text-risk-medium flex shrink-0 items-center gap-1 text-xs font-medium">
            <TriangleAlert className="size-3.5" />
            {warnings} warning{warnings === 1 ? "" : "s"}
          </span>
        )}

        <ChevronDown
          className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <CardContent id={panelId} className="flex flex-col gap-4 border-t px-4 pt-4 pb-5">
          <p className="text-muted-foreground truncate text-sm">{record.farmer_email}</p>

          {ph !== null && previous !== null && <PhChange from={previous} to={ph} />}

          {/* What the Farmer actually reported. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {record.has_sensor_readings ? (
              <>
                <SoilFact label="Temperature" value={record.soil_temperature} unit="°C" />
                <SoilFact label="Moisture" value={record.soil_moisture} unit="%" />
                <SoilFact label="Conductivity" value={record.soil_conductivity} unit="µS/cm" />
                <SoilFact label="pH" value={record.soil_ph} />
                <SoilFact label="Nitrogen" value={record.nitrogen} unit="mg/kg" />
                <SoilFact label="Phosphorus" value={record.phosphorus} unit="mg/kg" />
                <SoilFact label="Potassium" value={record.potassium} unit="mg/kg" />
                <SoilFact label="Fertility" value={record.soil_fertility} unit="mg/kg" />
              </>
            ) : (
              /* Recorded before the detector. */
              <>
                <SoilFact label="Soil type" value={record.legacy_soil_type_label} />
                <SoilFact label="Texture" value={record.legacy_soil_texture_label} />
                <SoilFact label="Drainage" value={record.legacy_drainage_label} />
                <SoilFact label="Moisture" value={record.legacy_soil_moisture_label} />
                <SoilFact label="pH" value={record.soil_ph} />
                <SoilFact label="Nitrogen" value={record.legacy_nitrogen_label} />
                <SoilFact label="Phosphorus" value={record.legacy_phosphorus_label} />
                <SoilFact label="Potassium" value={record.legacy_potassium_label} />
              </>
            )}
          </div>

          {record.notes ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Farmer&apos;s observations</span>
              <p className="text-sm">{record.notes}</p>
            </div>
          ) : null}

          {/* The AI result, exactly as the Farmer saw it. */}
          {record.ai_generated ? (
            <div className="border-border flex flex-col gap-3 border-t pt-3">
              <CropList title="Suitable fruits" crops={record.suitable_fruits} />
              <CropList title="Suitable vegetables" crops={record.suitable_vegetables} />
              <CropList title="Suitable crops" crops={record.suitable_crops} />
              <AdviceList title="Fertilizer" items={record.fertilizer_recommendations} />
              <AdviceList title="Soil improvement & watering" items={record.soil_improvement_watering} />
              <AdviceList title="Warnings" items={record.important_warnings} warning />
            </div>
          ) : (
            <p className="text-muted-foreground border-border border-t pt-3 text-sm">
              The soil information was saved, but the AI recommendation could not be generated at
              the time of submission. The farmer can re-run it from their Crop Recommendation page.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** "pH 5.2 → 5.8, towards the ideal range" — how this soil moved since last time. */
export function PhChange({ from, to }: { from: number; to: number }) {
  const delta = Math.round((to - from) * 10) / 10;
  const distance = (ph: number) => (ph < 6 ? 6 - ph : ph > 7 ? ph - 7 : 0);
  const better = distance(to) < distance(from);
  const worse = distance(to) > distance(from);
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Since the previous reading:</span>
      <span className="font-medium tabular-nums">
        pH {from.toFixed(1)} → {to.toFixed(1)}
      </span>
      {delta !== 0 && (
        <span className="text-muted-foreground flex items-center gap-0.5 tabular-nums">
          {delta > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
          {Math.abs(delta).toFixed(1)}
        </span>
      )}
      <span className={cn("text-xs font-medium", better ? "text-risk-low" : worse ? "text-risk-medium" : "text-muted-foreground")}>
        {delta === 0 ? "unchanged" : better ? "towards the ideal range" : worse ? "away from the ideal range" : "still in the ideal range"}
      </span>
    </p>
  );
}

