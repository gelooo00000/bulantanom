"use client";

import {
  BarChart3,
  MapPin,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  Users,
  Wheat,
} from "lucide-react";
import type { ReactNode } from "react";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";
import { useAuth } from "@/lib/auth/auth-context";

const ANALYTICS: NavItem = { label: "Agricultural Analytics", href: "/lgu/analytics", icon: BarChart3 };
const HARVEST: NavItem = { label: "Harvest & Monitoring", href: "/lgu/harvest", icon: Wheat };
const FARM: NavItem = { label: "Layuan Farm", href: "/lgu/farm", icon: MapPin };

const LGU_NAV_ITEMS: NavItem[] = [
  ANALYTICS,
  { label: "Farmers", href: "/lgu/farmers", icon: Users },
  { label: "Plants", href: "/lgu/plants", icon: Sprout },
  { label: "High-Risk Cases", href: "/lgu/high-risk", icon: TriangleAlert },
  HARVEST,
  FARM,
];

/**
 * An Admin opening the analytics module sees only its pages: the farmer,
 * risk and assessment pages stay with LGU Officers. A link leads back to
 * the Admin console.
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  ANALYTICS,
  HARVEST,
  FARM,
  { label: "Admin Console", href: "/admin", icon: ShieldCheck },
];

export function LguShell({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  return (
    <RoleShell
      roleLabel={isAdmin ? "Administrator" : "LGU Agricultural Officer"}
      navItems={isAdmin ? ADMIN_NAV_ITEMS : LGU_NAV_ITEMS}
      homeHref="/lgu/analytics"
      notificationScope={isAdmin ? "admin" : "lgu"}
    >
      {children}
    </RoleShell>
  );
}
