"use client";

import { Activity, ClipboardList, FlaskConical, LayoutDashboard, Radar, Sprout, Wheat } from "lucide-react";
import type { ReactNode } from "react";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";
import { usePresenceHeartbeat } from "@/lib/auth/use-presence-heartbeat";

const FARMER_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/farmer/dashboard", icon: LayoutDashboard },
  { label: "My Plants", href: "/farmer/plants", icon: Sprout },
  { label: "Crop Recommendation", href: "/farmer/soil-recommendation", icon: FlaskConical },
  { label: "Risk Indicator", href: "/farmer/risk-indicator", icon: Radar },
  { label: "Harvest", href: "/farmer/harvest", icon: Wheat },
  { label: "Monitoring", href: "/farmer/monitoring", icon: Activity },
  { label: "Assessment History", href: "/farmer/assessments", icon: ClipboardList },
];

export function FarmerShell({ children }: { children: ReactNode }) {
  // Lets the LGU see this Farmer as online while any Farmer page is open.
  usePresenceHeartbeat();

  return (
    <RoleShell
      roleLabel="Farmer"
      navItems={FARMER_NAV_ITEMS}
      homeHref="/farmer/dashboard"
      notificationScope="farmer"
    >
      {children}
    </RoleShell>
  );
}
