"use client";

import { Activity, ClipboardList, FlaskConical, LayoutDashboard, Radar, Sprout, Wheat } from "lucide-react";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { RoleShell, type NavItem } from "@/components/shared/role-shell";
import { usePresenceHeartbeat } from "@/lib/auth/use-presence-heartbeat";
import { useLanguage } from "@/lib/i18n";

export function FarmerShell({ children }: { children: ReactNode }) {
  // Lets the LGU see this Farmer as online while any Farmer page is open.
  usePresenceHeartbeat();
  const { t } = useLanguage();

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"), href: "/farmer/dashboard", icon: LayoutDashboard },
    { label: t("nav.plants"), href: "/farmer/plants", icon: Sprout },
    { label: t("nav.cropRecommendation"), href: "/farmer/soil-recommendation", icon: FlaskConical },
    { label: t("nav.risk"), href: "/farmer/risk-indicator", icon: Radar },
    { label: t("nav.harvest"), href: "/farmer/harvest", icon: Wheat },
    { label: t("nav.monitoring"), href: "/farmer/monitoring", icon: Activity },
    { label: t("nav.history"), href: "/farmer/assessments", icon: ClipboardList },
  ];

  return (
    <RoleShell
      roleLabel={t("shell.role")}
      navItems={navItems}
      homeHref="/farmer/dashboard"
      notificationScope="farmer"
      headerActions={<LanguageSwitcher />}
      copy={{
        logOut: t("shell.logOut"),
        more: t("shell.more"),
        farm: t("shell.farm"),
        weather: {
          clear: t("weather.clear"),
          mostly_clear: t("weather.mostly_clear"),
          partly_cloudy: t("weather.partly_cloudy"),
          cloudy: t("weather.cloudy"),
          fog: t("weather.fog"),
          drizzle: t("weather.drizzle"),
          light_rain: t("weather.light_rain"),
          rain: t("weather.rain"),
          heavy_rain: t("weather.heavy_rain"),
          thunderstorm: t("weather.thunderstorm"),
        },
      }}
    >
      {children}
    </RoleShell>
  );
}
