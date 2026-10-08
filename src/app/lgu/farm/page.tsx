"use client";

import Image from "next/image";
import { MapPin, Sprout } from "lucide-react";

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
      {/* Photo header */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-black/5">
        <Image
          src="/landing-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1100px, 100vw"
          className="-z-10 object-cover object-[70%_60%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-[oklch(0.18_0.05_155/0.92)] via-[oklch(0.2_0.05_155/0.7)] to-[oklch(0.2_0.05_155/0.15)]"
        />
        <div className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="max-w-xl text-white">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-sm">
              <Sprout className="size-3.5" />
              BulanTanom pilot site
            </p>
            <h1 className="font-heading mt-3 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
              {data.farm.name}
            </h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="size-4 shrink-0" />
              {data.farm.location}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Farmers here track their crops and submit weekly assessments that BulanTanom reads
              for plant risk, while agricultural officers follow the activity and step in on
              high-risk cases.
            </p>
          </div>
        </div>
      </section>

      {/* Site map */}
      <section aria-labelledby="site-map-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="site-map-heading" className="font-heading text-xl font-medium tracking-tight">
              Explore the farm
            </h2>
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
