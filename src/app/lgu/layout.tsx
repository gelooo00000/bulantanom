import type { ReactNode } from "react";

import { RequireRole } from "@/components/auth/require-role";
import { LguShell } from "@/components/lgu/lgu-shell";

export default function LguLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="lgu">
      <LguShell>{children}</LguShell>
    </RequireRole>
  );
}
