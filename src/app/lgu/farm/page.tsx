"use client";

import { Leaf, Sprout, Users } from "lucide-react";

import { LayuanFarmMap } from "@/components/layuan-farm-map/LayuanFarmMap";
import { FarmMap } from "@/components/lgu/farm-map";
import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { IconStatCard } from "@/components/shared/icon-stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
      <PageHeader title={`${data.farm.name} Overview`} description={data.farm.location} />

      <Card className="gap-3 py-5">
        <CardContent className="flex items-start gap-3 px-5">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Leaf className="size-4" />
          </span>
          <p className="text-muted-foreground text-sm">
            Layuan Nature Integrated Farm is the pilot site for BulanTanom&apos;s AI-powered
            plant risk monitoring. Farmers here track crops, submit weekly assessments, and
            receive AI-generated risk readings, while agricultural officers monitor activity
            and intervene on high-risk cases.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <IconStatCard icon={Users} label="Active Farmers" value={data.farmers.active} />
        <IconStatCard icon={Sprout} label="Total registrations" value={data.farmers.total} />
      </div>

      <section
        aria-labelledby="site-map-heading"
        className="border-border bg-card relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-4 sm:p-5"
      >
        <span aria-hidden="true" className="bg-primary absolute inset-x-0 top-0 h-1" />
        <div>
          <h2 id="site-map-heading" className="font-heading text-base font-medium">
            Site map
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Where each facility, field and water source sits on the farm. Pick a pin or a row in
            the key to learn more.
          </p>
        </div>
        {/* Follows the app's Light / Dark toggle rather than the OS setting. */}
        <LayuanFarmMap theme={theme} />
      </section>

      <section aria-labelledby="farm-map-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="farm-map-heading" className="font-heading text-sm font-medium">
            Satellite view
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Satellite photography over the real terrain around {data.farm.name}.
          </p>
        </div>
        <FarmMap
          name={data.farm.name}
          latitude={data.farm.latitude}
          longitude={data.farm.longitude}
        />
      </section>

      <NotAvailableNotice metrics={data.unavailable_metrics} />
    </div>
  );
}
