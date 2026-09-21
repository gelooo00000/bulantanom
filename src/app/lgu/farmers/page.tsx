"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";

import { FarmerDirectory } from "@/components/lgu/farmer-directory";
import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguFarmers } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";

// How often the list quietly refreshes, so the online dots follow Farmers
// signing in and out without the Officer reloading the page.
const REFRESH_MS = 30_000;

export default function LguFarmersPage() {
  // Bumped on a timer. Passing it as a dependency refetches in place — unlike
  // `refetch()`, it does not put the page back into its loading state.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Every Farmer in one request: search and status filtering then happen in
  // the browser, so they are instant and the status counts stay exact.
  const { data, loading, error, refetch } = useLguQuery(
    (token) => fetchLguFarmers(token, "ALL"),
    [tick],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Farmers"
        description="Find a farmer, see who is online, and who needs a visit."
      />

      {loading && !data ? (
        <LguLoading label="Loading Farmer records…" />
      ) : error && !data ? (
        // A failed background refresh keeps the list already on screen;
        // only a first load with nothing to show becomes an error.
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Farmer accounts yet"
          description="Farmer accounts appear here once they register."
        />
      ) : (
        <FarmerDirectory farmers={data} />
      )}
    </div>
  );
}
