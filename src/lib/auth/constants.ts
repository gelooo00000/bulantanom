import type { Role } from "@/lib/auth/types";

export const DASHBOARD_BY_ROLE: Record<Role, string> = {
  farmer: "/farmer/dashboard",
  lgu: "/lgu/analytics",
  admin: "/admin",
};
