"use client";

import { AccountManagement } from "@/components/admin/account-management";
import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/auth/require-role";
import { HarvestOutcomes } from "@/components/shared/harvest-outcomes";
import { fetchAdminHarvestOutcomes } from "@/lib/api/lgu-api";

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <AdminShell>
        <div className="flex flex-col gap-10">
          <AccountManagement />
          <HarvestOutcomes fetcher={fetchAdminHarvestOutcomes} />
        </div>
      </AdminShell>
    </RequireRole>
  );
}
