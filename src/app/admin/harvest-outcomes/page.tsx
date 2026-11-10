"use client";

import { ClipboardCheck } from "lucide-react";

import { AdminHero } from "@/components/admin/admin-hero";
import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/auth/require-role";
import { HarvestOutcomes } from "@/components/shared/harvest-outcomes";
import { fetchAdminHarvestOutcomes } from "@/lib/api/lgu-api";

export default function AdminHarvestOutcomesPage() {
  return (
    <RequireRole role="admin">
      <AdminShell>
        <div className="flex flex-col gap-6">
          <AdminHero
            icon={ClipboardCheck}
            eyebrow="Admin console"
            title="Harvest Outcomes"
            description="How plants monitored with BulanTanom turned out, from the report each Farmer fills in when a plant is harvested or lost."
          />
          <HarvestOutcomes fetcher={fetchAdminHarvestOutcomes} showHeading={false} />
        </div>
      </AdminShell>
    </RequireRole>
  );
}
