"use client";

import { CalendarRange, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fetchFilterOptions, type AnalyticsFilters, type FilterOptions } from "@/lib/api/analytics-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

const field =
  "border-border bg-background focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-lg border px-2.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

function Field({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * The global filter bar. Every card, chart, table and the map on an
 * analytics page reads these, through the page address.
 */
export function FilterBar({
  filters,
  onChange,
  onReset,
  hide = [],
}: {
  filters: AnalyticsFilters;
  onChange: (patch: Partial<AnalyticsFilters>) => void;
  onReset: () => void;
  /** Filters that make no sense on this page. */
  hide?: (keyof AnalyticsFilters)[];
}) {
  const options = useAuthedQuery<FilterOptions>(fetchFilterOptions);
  const o = options.data;
  const active = Object.entries(filters).filter(([k, v]) => v && !hide.includes(k as keyof AnalyticsFilters)).length;
  const show = (k: keyof AnalyticsFilters) => !hide.includes(k);

  return (
    <section aria-label="Filters" className="border-border bg-card rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-heading flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="text-primary size-4" aria-hidden="true" />
          Filters
          {active > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {active} active
            </span>
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={onReset} disabled={active === 0}>
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {show("dateFrom") && (
          <Field id="f-from" label="From">
            <input id="f-from" type="date" className={field} value={filters.dateFrom} max={filters.dateTo || undefined}
              onChange={(e) => onChange({ dateFrom: e.target.value })} />
          </Field>
        )}
        {show("dateTo") && (
          <Field id="f-to" label="To">
            <input id="f-to" type="date" className={field} value={filters.dateTo} min={filters.dateFrom || undefined}
              onChange={(e) => onChange({ dateTo: e.target.value })} />
          </Field>
        )}
        {show("season") && (
          <Field id="f-season" label="Season">
            <select id="f-season" className={field} value={filters.season}
              onChange={(e) => onChange({ season: e.target.value as AnalyticsFilters["season"] })}>
              <option value="">All seasons</option>
              {(o?.seasons ?? [{ key: "wet", label: "Wet season (Jun-Nov)" }, { key: "dry", label: "Dry season (Dec-May)" }]).map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
        )}
        {show("soilType") && (
          <Field id="f-soil" label="Soil type">
            <select id="f-soil" className={field} value={filters.soilType} disabled={!o}
              onChange={(e) => onChange({ soilType: e.target.value })}>
              <option value="">All soil types</option>
              {o?.soil_types.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
        )}
        {show("crop") && (
          <Field id="f-crop" label="Crop">
            <select id="f-crop" className={field} value={filters.crop} disabled={!o}
              onChange={(e) => onChange({ crop: e.target.value })}>
              <option value="">All crops</option>
              {o?.crops.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ""}{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        {show("farmer") && (
          <Field id="f-farmer" label="Farmer">
            <select id="f-farmer" className={field} value={filters.farmer} disabled={!o}
              onChange={(e) => onChange({ farmer: e.target.value })}>
              <option value="">All farmers</option>
              {o?.farmers.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {(filters.dateFrom || filters.dateTo) && (
        <p className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-[11px]">
          <CalendarRange className="size-3" aria-hidden="true" />
          Trends compare this range with the same number of days before it.
        </p>
      )}
      {options.error && <p className="text-risk-high mt-2 text-xs">Filter choices could not load: {options.error}</p>}
    </section>
  );
}
