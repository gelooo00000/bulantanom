"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";
import type { Role } from "@/lib/auth/types";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  // Whether this page ever had a signed-in user. A session that expires while
  // in use goes to /login so the user can sign straight back in; arriving with
  // no session at all - a reopened browser restoring a dashboard tab - goes to
  // the landing page instead.
  const hadSession = useRef(false);

  useEffect(() => {
    if (currentUser) hadSession.current = true;
    if (loading) return;
    if (!currentUser) {
      router.replace(hadSession.current ? "/login" : "/");
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
