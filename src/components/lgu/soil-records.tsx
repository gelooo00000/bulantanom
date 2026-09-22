"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Droplets,
  FlaskConical,
  Search,
  Sprout,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ElementType } from "react";
import { useId, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { LguSoilRecommendation } from "@/lib/api/lgu-api";
import {
  PH_BANDS,
  PLAUSIBLE_SOIL_TEMP_C,
  latestPerFarmer,
  matchesFarmer,
  phBand,
  phValue,
  previousPh,
  recommendedCrops,
  temperatureNeedsCheck,
  type PhBand,
} from "@/lib/lgu-soil-stats";
import { cn } from "@/lib/utils";

/**
 * The body of the LGU Crop Recommendation Records page: a one-line summary,
 * then each Farmer's latest soil check, split into the ones the AI analysed
 * and the ones it could not.
 */

const BAND_CHIP: Record<PhBand, string> = {
  TOO_ACIDIC: "bg-risk-high/15 text-risk-high border-risk-high/30",
  SLIGHTLY_ACIDIC: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  IDEAL: "bg-risk-low/15 text-risk-low border-risk-low/30",
  ALKALINE: "bg-[var(--chart-series-1)]/15 text-[var(--chart-series-1)] border-[var(--chart-series-1)]/30",
  NONE: "border-border text-muted-foreground",
};

const BAND_TEXT: Record<PhBand, string> = {
  TOO_ACIDIC: "text-risk-high",
  SLIGHTLY_ACIDIC: "text-risk-medium",
  IDEAL: "text-risk-low",
  ALKALINE: "text-[var(--chart-series-1)]",
  NONE: "text-muted-foreground",
};

type Status = "ANALYZED" | "NOT_ANALYZED";

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

/**
 * Each Farmer's latest soil check, in two tabs: the ones the AI analysed
 * (the advice the Farmer received) and the ones it could not, which are the
 * Farmers still waiting for advice.
 */
export function RecordList({ records }: { records: LguSoilRecommendation[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("ANALYZED");

  const latest = useMemo(
    () => latestPerFarmer(records).filter((r) => matchesFarmer(r, query)),
    [records, query],
  );
  const counts: Record<Status, number> = {
    ANALYZED: latest.filter((r) => r.ai_generated).length,
    NOT_ANALYZED: latest.filter((r) => !r.ai_generated).length,
  };
  const shown = latest
    .filter((r) => (status === "ANALYZED" ? r.ai_generated : !r.ai_generated))
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

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter records">
        {(
          [
            ["ANALYZED", "Analysed"],
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

      <p className="text-muted-foreground text-sm" role="status">
        {shown.length === 1 ? "1 farmer" : `${shown.length} farmers`} · latest soil check
        {status === "NOT_ANALYZED" &&
          shown.length > 0 &&
          " · these farmers are still waiting for AI advice"}
      </p>

      {shown.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {query.trim()
            ? `No farmers match "${query.trim()}".`
            : status === "ANALYZED"
              ? "No analysed soil checks yet."
              : "Every farmer's latest soil check has AI advice."}
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
  const tempCheck = temperatureNeedsCheck(record.soil_temperature);
  const submitted = new Date(record.created_at);

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
            {submitted.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
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

        {tempCheck && (
          <span className="text-risk-high flex shrink-0 items-center gap-1 text-xs font-medium">
            <CircleAlert className="size-3.5" />
            Check reading
          </span>
        )}

        <ChevronDown
          className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <CardContent id={panelId} className="flex flex-col gap-5 border-t px-4 pt-4 pb-5">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>{record.farmer_email}</span>
            <span>
              Checked{" "}
              {submitted.toLocaleString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* A reading the soil at Layuan cannot give: the advice built on it
              should not be passed on until the reading is checked. */}
          {tempCheck && (
            <div
              role="note"
              className="border-risk-high/40 bg-risk-high/10 flex gap-3 rounded-lg border p-3 text-sm"
            >
              <CircleAlert className="text-risk-high mt-0.5 size-4 shrink-0" />
              <p>
                <span className="text-risk-high font-medium">Check this reading with the farmer.</span>{" "}
                A soil temperature of {Number(record.soil_temperature)}°C is not possible at Layuan
                (expected {PLAUSIBLE_SOIL_TEMP_C.min}–{PLAUSIBLE_SOIL_TEMP_C.max}°C), so it is likely a
                detector or typing error. Advice based on it, such as frost protection, may not apply.
              </p>
            </div>
          )}

          {/* The AI's warnings come first: they are what needs acting on. */}
          {record.ai_generated && warnings > 0 && (
            <Section icon={TriangleAlert} title={`Warnings (${warnings})`} tone="warn">
              <ul className="flex flex-col gap-1.5">
                {record.important_warnings.map((item, i) => (
                  <li key={i} className="text-sm">
                    {item.recommendation}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section icon={FlaskConical} title="Soil readings">
            {ph !== null && previous !== null && <PhChange from={previous} to={ph} />}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {record.has_sensor_readings ? (
                <>
                  <Reading
                    label="pH"
                    value={ph === null ? null : ph.toFixed(1)}
                    note={ph === null ? undefined : bandLabel}
                    noteClass={BAND_TEXT[band]}
                  />
                  <Reading
                    label="Temperature"
                    value={record.soil_temperature}
                    unit="°C"
                    note={tempCheck ? "Check reading" : undefined}
                    noteClass="text-risk-high"
                  />
                  <Reading label="Moisture" value={record.soil_moisture} unit="%" />
                  <Reading label="Conductivity" value={record.soil_conductivity} unit="µS/cm" />
                  <Reading label="Nitrogen (N)" value={record.nitrogen} unit="mg/kg" />
                  <Reading label="Phosphorus (P)" value={record.phosphorus} unit="mg/kg" />
                  <Reading label="Potassium (K)" value={record.potassium} unit="mg/kg" />
                  <Reading label="Fertility" value={record.soil_fertility} unit="mg/kg" />
                </>
              ) : (
                /* Recorded before the detector. */
                <>
                  <Reading
                    label="pH"
                    value={ph === null ? null : ph.toFixed(1)}
                    note={ph === null ? undefined : bandLabel}
                    noteClass={BAND_TEXT[band]}
                  />
                  <Reading label="Soil type" value={record.legacy_soil_type_label} />
                  <Reading label="Texture" value={record.legacy_soil_texture_label} />
                  <Reading label="Drainage" value={record.legacy_drainage_label} />
                  <Reading label="Moisture" value={record.legacy_soil_moisture_label} />
                  <Reading label="Nitrogen" value={record.legacy_nitrogen_label} />
                  <Reading label="Phosphorus" value={record.legacy_phosphorus_label} />
                  <Reading label="Potassium" value={record.legacy_potassium_label} />
                </>
              )}
            </div>
          </Section>

          {record.notes ? (
            <Section icon={Sprout} title="Farmer's observations">
              <p className="text-sm">{record.notes}</p>
            </Section>
          ) : null}

          {record.ai_generated ? (
            <>
              {crops.length > 0 && (
                <Section icon={Sprout} title={`Recommended crops (${crops.length})`}>
                  <ul className="flex flex-col gap-2">
                    <CropRows kind="Fruit" crops={record.suitable_fruits} />
                    <CropRows kind="Vegetable" crops={record.suitable_vegetables} />
                    <CropRows kind="Crop" crops={record.suitable_crops} />
                  </ul>
                </Section>
              )}
              <AdviceSection icon={FlaskConical} title="Fertilizer" items={record.fertilizer_recommendations} />
              <AdviceSection icon={Droplets} title="Soil improvement & watering" items={record.soil_improvement_watering} />
            </>
          ) : (
            <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-sm">
              The soil information was saved, but the AI recommendation could not be generated at
              the time of submission. The farmer can re-run it from their Crop Recommendation page.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: ElementType;
  title: string;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(tone === "warn" && "border-risk-medium/40 bg-risk-medium/10 rounded-lg border p-3")}
    >
      <h3
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-xs font-medium",
          tone === "warn" ? "text-risk-medium" : "text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One soil reading as a tile, with a short verdict where there is a sound basis. */
function Reading({
  label,
  value,
  unit,
  note,
  noteClass,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  note?: string;
  noteClass?: string;
}) {
  if (value === null || value === "" || value === "Unknown") return null;
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium tabular-nums">
        {value}
        {unit ? <span className="text-muted-foreground ml-1 text-xs font-normal">{unit}</span> : null}
      </p>
      {note && <p className={cn("text-xs font-medium", noteClass)}>{note}</p>}
    </div>
  );
}

/** Each crop with the AI's reason beside it, so the Officer can explain it. */
function CropRows({ kind, crops }: { kind: string; crops: LguSoilRecommendation["suitable_fruits"] }) {
  return (
    <>
      {crops.map((crop) => (
        <li key={crop.id} className="flex gap-2.5">
          <span aria-hidden="true" className="text-lg leading-6">
            {crop.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">{crop.name}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">{kind}</span>
            </p>
            {crop.reason && <p className="text-muted-foreground text-xs">{crop.reason}</p>}
          </div>
        </li>
      ))}
    </>
  );
}

function AdviceSection({
  icon,
  title,
  items,
}: {
  icon: ElementType;
  title: string;
  items: { recommendation: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <Section icon={icon} title={title}>
      <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item.recommendation}</li>
        ))}
      </ul>
    </Section>
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
