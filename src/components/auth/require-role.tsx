"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";
import type { Role } from "@/lib/auth/types";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    if (currentUser.role !== role) {
      router.replace(DASHBOARD_BY_ROLE[currentUser.role]);
    }
  }, [loading, currentUser, role, router]);

  if (loading || !currentUser || currentUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
