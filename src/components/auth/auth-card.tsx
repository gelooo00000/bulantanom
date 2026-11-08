import type { ReactNode } from "react";

/**
 * The content of one auth screen. The sheet in AuthSplitLayout is already the
 * surface, so this only spaces its parts; it draws no panel of its own.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
