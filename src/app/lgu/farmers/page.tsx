"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendAccountStatus } from "@/lib/api/auth-api";
import { fetchLguFarmers } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BackendAccountStatus, string> = {
  PENDING: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  APPROVED: "bg-risk-low/15 text-risk-low border-risk-low/30",
  REJECTED: "bg-risk-high/15 text-risk-high border-risk-high/30",
  SUSPENDED: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

const STATUS_LABEL: Record<BackendAccountStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const FILTERS: { label: string; value: BackendAccountStatus | "ALL" }[] = [
  { label: "Approved", value: "APPROVED" },
  { label: "Pending", value: "PENDING" },
  { label: "All", value: "ALL" },
];

export default function LguFarmersPage() {
  const [filter, setFilter] = useState<BackendAccountStatus | "ALL">("APPROVED");
  const { data, loading, error, refetch } = useLguQuery((token) =>
    fetchLguFarmers(token, filter),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Farmers"
        description="Farmer accounts registered at Layuan Farm, read live from the database."
      />

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value);
              refetch();
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LguLoading label="Loading Farmer records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            filter === "APPROVED"
              ? "No approved Farmers yet"
              : filter === "PENDING"
                ? "No pending registrations"
                : "No Farmer accounts yet"
          }
          description="Farmer accounts appear here once they register and an administrator approves them."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {data.length} {data.length === 1 ? "record" : "records"}
          </p>
          {data.map((farmer) => (
            <Card key={farmer.id} className="gap-2 py-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
                <div className="min-w-0">
                  <p className="font-medium">{farmer.full_name}</p>
                  <p className="text-muted-foreground truncate text-sm">{farmer.email}</p>
                  <p className="text-muted-foreground/70 mt-0.5 text-xs">
                    Registered {new Date(farmer.date_joined).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLE[farmer.account_status],
                  )}
                >
                  {STATUS_LABEL[farmer.account_status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
