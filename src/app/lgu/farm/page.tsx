"use client";

import { Leaf, Sprout, Users } from "lucide-react";

import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { IconStatCard } from "@/components/shared/icon-stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { fetchLguFarmOverview } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";

export default function LguFarmOverviewPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguFarmOverview);

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

      <NotAvailableNotice metrics={data.unavailable_metrics} />
    </div>
  );
}
