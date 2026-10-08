import type { ReactNode } from "react";

import { RequireRole } from "@/components/auth/require-role";
import { LguShell } from "@/components/lgu/lgu-shell";

/**
 * LGU Officers, and Admins opening the Agricultural Analytics module (the
 * shell shows an Admin only that module's pages; the API enforces it).
 */
export default function LguLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role={["lgu", "admin"]}>
      <LguShell>{children}</LguShell>
    </RequireRole>
  );
}
