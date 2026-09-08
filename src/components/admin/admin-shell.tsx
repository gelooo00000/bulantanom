"use client";

import { Users } from "lucide-react";
import type { ReactNode } from "react";

import { RoleShell, type NavItem } from "@/components/shared/role-shell";

// Admin is deliberately scoped to system maintenance and account
// management for this milestone — no analytics, no agricultural workflows.
const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Account Management", href: "/admin", icon: Users },
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
