import type { ReactNode } from "react";

import { RequireRole } from "@/components/auth/require-role";
import { FarmerShell } from "@/components/farmer/farmer-shell";

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="farmer">
      <FarmerShell>{children}</FarmerShell>
    </RequireRole>
  );
}
