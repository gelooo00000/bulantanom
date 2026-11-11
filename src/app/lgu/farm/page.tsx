"use client";

import { LayuanFarmMap } from "@/components/layuan-farm-map/LayuanFarmMap";
import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { fetchLguFarmOverview } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { useTheme } from "@/lib/theme/theme-context";

export default function LguFarmOverviewPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguFarmOverview);
  const { theme } = useTheme();

  if (loading) return <LguLoading />;
  if (error) return <LguError message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Site map */}
      <section aria-labelledby="site-map-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="site-map-heading" className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Explore the farm
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              A 3D site map of every facility, field and water source. Drag to look around, zoom
              in, and hover or tap a pin to see what it is.
            </p>
          </div>
        </div>

        {/* Follows the app's Light / Dark toggle rather than the OS setting. */}
        <LayuanFarmMap theme={theme} />
      </section>

      <NotAvailableNotice metrics={data.unavailable_metrics} />
    </div>
  );
}
