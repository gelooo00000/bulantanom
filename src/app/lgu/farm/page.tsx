"use client";

import Image from "next/image";
import { Building2, Droplets, MapPin, Sprout, Users, Wheat, type LucideIcon } from "lucide-react";

import { KEY, PINS } from "@/components/layuan-farm-map/farmMapCore";
import { LayuanFarmMap } from "@/components/layuan-farm-map/LayuanFarmMap";
import { LguError, LguLoading, NotAvailableNotice } from "@/components/lgu/lgu-states";
import { fetchLguFarmOverview } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { useTheme } from "@/lib/theme/theme-context";

/** A figure on the photo header: frosted so it reads over any part of the image. */
function HeroStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 text-white backdrop-blur-md">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-xl leading-none font-medium tabular-nums">{value}</p>
        <p className="mt-1 truncate text-[11px] text-white/75">{label}</p>
      </div>
    </div>
  );
}

/** A plain fact about the site, drawn from the same data as the map. */
function SiteFact({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </span>
      <p className="text-sm">
        <span className="font-heading text-base font-medium tabular-nums">{value}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </p>
    </div>
  );
}

const FACILITIES_BUILT = KEY.filter((k) => !k.future).length;
const FACILITIES_PLANNED = KEY.filter((k) => k.future).length;
const WATER_SOURCES = PINS.filter((p) => p.kind === "water").length;

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
        <div className="flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9">
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

          <div className="grid grid-cols-2 gap-2.5 sm:max-w-2xl sm:grid-cols-4">
            <HeroStat icon={Users} label="Active farmers" value={data.farmers.active} />
            <HeroStat icon={Users} label="Registrations" value={data.farmers.total} />
            {data.plants ? (
              <>
                <HeroStat icon={Sprout} label="Plants growing" value={data.plants.growing} />
                <HeroStat icon={Wheat} label="Ready to harvest" value={data.plants.ready_for_harvest} />
              </>
            ) : null}
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
              in, or choose a facility below to fly to it.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <SiteFact icon={Building2} value={FACILITIES_BUILT} label="facilities in use" />
          <SiteFact icon={Sprout} value={FACILITIES_PLANNED} label="planned for development" />
          <SiteFact icon={Droplets} value={WATER_SOURCES} label="water sources on site" />
        </div>

        {/* Follows the app's Light / Dark toggle rather than the OS setting. */}
        <LayuanFarmMap theme={theme} />
      </section>

      <NotAvailableNotice metrics={data.unavailable_metrics} />
    </div>
  );
}
