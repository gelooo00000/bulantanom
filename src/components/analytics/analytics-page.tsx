"use client";

import type { ReactNode } from "react";

import { AdvisoryNote, Breadcrumbs, LiveDataNote } from "@/components/analytics/cards";
import { FilterBar } from "@/components/analytics/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { useAnalyticsFilters } from "@/lib/analytics/use-analytics-filters";
import type { AnalyticsFilters } from "@/lib/api/analytics-api";

/**
 * The frame every analytics page shares: breadcrumbs back to Agricultural
 * Analytics, the heading, the advisory note where results are advisory,
 * the global filter bar, and the live-data footer.
 */
export function AnalyticsPage({
  title,
  description,
  advisory = false,
  hideFilters = [],
  action,
  children,
}: {
  title: string;
  description: string;
  advisory?: boolean;
  hideFilters?: (keyof AnalyticsFilters)[];
  action?: ReactNode;
  children: (filters: AnalyticsFilters, setFilters: (p: Partial<AnalyticsFilters>) => void) => ReactNode;
}) {
  const { filters, setFilters, reset, carry } = useAnalyticsFilters();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={[{ label: "Agricultural Analytics", href: `/lgu/analytics${carry}` }, { label: title }]} />
        <PageHeader title={title} description={description} action={action} />
      </div>
      {advisory && <AdvisoryNote />}
      <FilterBar filters={filters} onChange={setFilters} onReset={reset} hide={hideFilters} />
      {children(filters, setFilters)}
      <LiveDataNote />
    </div>
  );
}
