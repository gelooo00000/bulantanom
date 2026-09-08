"use client";

import { AccountManagement } from "@/components/admin/account-management";
import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/auth/require-role";

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <AdminShell>
        <AccountManagement />
      </AdminShell>
    </RequireRole>
  );
}
