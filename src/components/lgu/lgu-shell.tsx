"use client";

import { ClipboardList, FileText, FlaskConical, LayoutDashboard, MapPin, Radar, Sprout, TriangleAlert, Users, Wheat } from "lucide-react";
import type { ReactNode } from "react";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";

const LGU_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/lgu/dashboard", icon: LayoutDashboard },
  { label: "Farmers", href: "/lgu/farmers", icon: Users },
  { label: "Plants", href: "/lgu/plants", icon: Sprout },
  { label: "Risk Overview", href: "/lgu/risks", icon: Radar },
  { label: "High-Risk Cases", href: "/lgu/high-risk", icon: TriangleAlert },
  { label: "Assessment History", href: "/lgu/assessments", icon: ClipboardList },
  { label: "Harvest & Monitoring", href: "/lgu/harvest", icon: Wheat },
  { label: "Soil Recommendations", href: "/lgu/soil-recommendations", icon: FlaskConical },
  { label: "Detailed Reports", href: "/lgu/reports", icon: FileText },
  { label: "Layuan Farm", href: "/lgu/farm", icon: MapPin },
];

export function LguShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="LGU Agricultural Officer"
      navItems={LGU_NAV_ITEMS}
      homeHref="/lgu/dashboard"
      notificationScope="lgu"
    >
      {children}
    </RoleShell>
  );
}
