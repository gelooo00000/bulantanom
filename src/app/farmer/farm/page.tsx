"use client";

import { LayuanFarmMap } from "@/components/layuan-farm-map/LayuanFarmMap";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/theme-context";

/**
 * Layuan Farm for Farmers: the same 3D site map the LGU sees, in the
 * farmer's language. It shows the place only, nobody's
 * records, so it needs no data from the server.
 */
export default function FarmerFarmPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="site-map-heading" className="flex flex-col gap-4">
        <div>
          <h1 id="site-map-heading" className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {t("farm.explore")}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("farm.exploreText")}</p>
        </div>

        {/* Follows the app's Light / Dark toggle rather than the OS setting. */}
        <LayuanFarmMap theme={theme} />
      </section>
    </div>
  );
}
