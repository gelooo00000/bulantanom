"use client";

import Image from "next/image";
import { MapPin, Sprout } from "lucide-react";

import { LayuanFarmMap } from "@/components/layuan-farm-map/LayuanFarmMap";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/theme-context";

/**
 * Layuan Farm for Farmers: the same photo banner and 3D site map the LGU
 * sees, in the farmer's language. It shows the place only, nobody's
 * records, so it needs no data from the server.
 */
export default function FarmerFarmPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
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
              {t("farm.badge")}
            </p>
            <h1 className="font-heading mt-3 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
              Layuan Farm
            </h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="size-4 shrink-0" />
              Layuan Nature Integrated Farm, Bulan, Sorsogon
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/80">{t("farm.intro")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="site-map-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="site-map-heading" className="font-heading text-xl font-medium tracking-tight">
            {t("farm.explore")}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("farm.exploreText")}</p>
        </div>

        {/* Follows the app's Light / Dark toggle rather than the OS setting. */}
        <LayuanFarmMap theme={theme} />
      </section>
    </div>
  );
}
