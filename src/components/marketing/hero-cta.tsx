"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, Leaf } from "lucide-react";

import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * The hero's main button. Signed out it opens the shared Farmer / LGU
 * Officer sign-in (Farmers can register from there); signed in it says
 * where it goes instead, since sign-in would only bounce them to their
 * dashboard.
 */
export function HeroCta() {
  const { currentUser } = useAuth();
  const href = currentUser ? DASHBOARD_BY_ROLE[currentUser.role] : "/login";
  return (
    <Link
      href={href}
      className="group inline-flex h-12 items-center gap-2.5 rounded-full border border-[#8be883]/70 bg-[linear-gradient(180deg,#3fae52_0%,#2a8a3c_100%)] font-heading px-6 text-lg tracking-wide text-white shadow-[0_12px_32px_-10px_rgba(80,200,100,0.7)] transition-all duration-200 outline-none hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-3 focus-visible:ring-white/70 active:translate-y-0"
    >
      {currentUser ? (
        <LayoutDashboard className="size-4" />
      ) : (
        <Leaf className="size-4 fill-current" />
      )}
      {currentUser ? "Go to my dashboard" : "Get started now"}
      <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover:translate-x-1" />
    </Link>
  );
}
