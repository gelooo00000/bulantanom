"use client";

import { ClipboardCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";

// Admin looks after accounts and sees how monitored plants turned out.
// Analytics, farmer, risk and assessment pages stay with LGU Officers.
const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Account Management", href: "/admin", icon: Users },
  { label: "Harvest Outcomes", href: "/admin/harvest-outcomes", icon: ClipboardCheck },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RoleShell
      roleLabel="Administrator"
      navItems={ADMIN_NAV_ITEMS}
      homeHref="/admin"
      notificationScope="admin"
    >
      {children}
    </RoleShell>
  );
}
