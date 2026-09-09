"use client";

import {
  Activity,
  ChartColumn,
  ClipboardList,
  Download,
  FlaskConical,
  LoaderCircle,
  Printer,
  Radar,
  Sprout,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ElementType } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { ReportPreview } from "@/components/lgu/report-preview";
import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  downloadReportPdf,
  fetchReport,
  fetchReportCatalog,
  type ReportCatalog,
  type ReportDocument,
  type ReportPeriodKey,
  type ReportQuery,
  type ReportSummaryItem,
} from "@/lib/api/reports-api";
import { useAuth } from "@/lib/auth/auth-context";
import { REPORT_STRINGS as t } from "@/lib/report-strings";
import { cn } from "@/lib/utils";

const REPORT_ICONS: Record<string, ElementType> = {
  chart: ChartColumn,
  radar: Radar,
  flask: FlaskConical,
  sprout: Sprout,
  activity: Activity,
  users: Users,
};

/** Native select styled to match the filter chips used elsewhere in the app. */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-52">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-card focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

export default function LguReportsPage() {
  const { accessToken } = useAuth();

  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [report, setReport] = useState<ReportDocument | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [query, setQuery] = useState<ReportQuery>({
    period: "all_time",
    farmer: "all",
    crop: "all",
    riskLevel: "ALL",
    dateFrom: "",
    dateTo: "",
  });

  const loadCatalog = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await fetchReportCatalog(accessToken);
      setCatalog(data);
      setCatalogError(null);
      // Open the most recently active report so the page is never a dead end.
      setSelected((current) => current ?? data.reports[0]?.slug ?? null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Unable to load reports.");
    }
  }, [accessToken]);

  // The fetch runs inside an async IIFE so nothing sets state synchronously
  // in the effect body - the same shape used by admin/account-management.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadCatalog();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  const activeSpec: ReportSummaryItem | undefined = catalog?.reports.find(
    (r) => r.slug === selected,
  );

  // Refetches whenever the report or any filter changes: the filtering is done
  // by MySQL, never by narrowing an array that is already in the browser.
  useEffect(() => {
    if (!accessToken || !selected || !activeSpec) return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      setDownloadError(null);
      try {
        const data = await fetchReport(accessToken, selected, query, activeSpec.supports);
        if (cancelled) return;
        setReport(data);
        setReportError(null);
      } catch (err) {
        if (cancelled) return;
        setReport(null);
        setReportError(err instanceof Error ? err.message : "Unable to build this report.");
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, selected, query, activeSpec]);

  async function handleDownload() {
    if (!accessToken || !selected || !activeSpec) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReportPdf(accessToken, selected, query, activeSpec.supports);
    } catch {
      setDownloadError(t.pdfError);
    } finally {
      setDownloading(false);
    }
  }

  if (catalogError) {
    return <LguError message={catalogError} onRetry={loadCatalog} />;
  }
  if (!catalog) {
    return <LguLoading label={t.loadingCatalog} />;
  }

  const supports = activeSpec?.supports ?? [];
  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.print()}
        disabled={!report}
      >
        <Printer className="size-3.5" />
        {t.print}
      </Button>
      <Button size="sm" onClick={handleDownload} disabled={!report || downloading}>
        {downloading ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {downloading ? t.preparing : t.download}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="print-hide">
        <PageHeader
          title={t.pageTitle}
          description={t.pageDescription}
          action={actions}
        />
      </div>

      {/* Filters. Mobile order is filters -> list -> preview -> actions, which
          is the order the page already renders in. */}
      <Card className="print-hide gap-3 py-4">
        <CardContent className="flex flex-wrap items-end gap-3 px-4">
          <FilterSelect
            id="report-period"
            label={t.period}
            value={query.period}
            onChange={(v) => setQuery((q) => ({ ...q, period: v as ReportPeriodKey }))}
          >
            {catalog.filters.periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </FilterSelect>

          {query.period === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date-from" className="text-muted-foreground text-xs">
                  {t.dateFrom}
                </Label>
                <input
                  id="date-from"
                  type="date"
                  value={query.dateFrom}
                  onChange={(e) => setQuery((q) => ({ ...q, dateFrom: e.target.value }))}
                  className="border-border bg-card focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date-to" className="text-muted-foreground text-xs">
                  {t.dateTo}
                </Label>
                <input
                  id="date-to"
                  type="date"
                  value={query.dateTo}
                  onChange={(e) => setQuery((q) => ({ ...q, dateTo: e.target.value }))}
                  className="border-border bg-card focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
                />
              </div>
            </>
          )}

          {/* Only the filters this report actually honours are offered, so the
              UI never implies a narrowing the backend would ignore. */}
          {supports.includes("farmer") && (
            <FilterSelect
              id="report-farmer"
              label={t.farmer}
              value={query.farmer ?? "all"}
              onChange={(v) => setQuery((q) => ({ ...q, farmer: v }))}
            >
              <option value="all">{t.allFarmers}</option>
              {catalog.filters.farmers.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.name}
                </option>
              ))}
            </FilterSelect>
          )}

          {supports.includes("crop") && (
            <FilterSelect
              id="report-crop"
              label={t.crop}
              value={query.crop ?? "all"}
              onChange={(v) => setQuery((q) => ({ ...q, crop: v }))}
            >
              <option value="all">{t.allCrops}</option>
              {catalog.filters.crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          )}

          {supports.includes("risk_level") && (
            <FilterSelect
              id="report-risk"
              label={t.riskLevel}
              value={query.riskLevel ?? "ALL"}
              onChange={(v) => setQuery((q) => ({ ...q, riskLevel: v }))}
            >
              {catalog.filters.risk_levels.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </FilterSelect>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* LEFT: Available Reports */}
        <div className="print-hide flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t.availableReports}</h2>
          <div className="flex flex-col gap-2">
            {catalog.reports.map((item) => {
              const Icon = REPORT_ICONS[item.icon] ?? ClipboardList;
              const active = item.slug === selected;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setSelected(item.slug)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      active ? "border-primary/40 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{item.title}</span>
                      {item.latest && (
                        <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          {t.latest}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {item.category}
                      {" • "}
                      {item.updated
                        ? `${t.updated} ${new Date(item.updated).toLocaleDateString()}`
                        : t.noActivity}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Report preview */}
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="print-hide text-sm font-medium">{t.reportPreview}</h2>

          {downloadError && (
            <p className="text-destructive bg-destructive/10 print-hide rounded-lg px-3 py-2 text-sm">
              {downloadError}
            </p>
          )}

          {reportError ? (
            <LguError message={reportError} onRetry={() => setQuery((q) => ({ ...q }))} />
          ) : reportLoading ? (
            <LguLoading label={t.loadingReport} />
          ) : report ? (
            <FadeIn key={report.slug + report.period.key} duration={220}>
              <ReportPreview report={report} />
            </FadeIn>
          ) : (
            <EmptyState icon={ClipboardList} title={t.selectPrompt} />
          )}

          {/* Repeated below the report so the actions are reachable on mobile
              without scrolling back to the header. */}
          {report && <div className="print-hide flex justify-end pt-1">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
