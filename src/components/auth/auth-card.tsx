import type { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="liquid-glass flex flex-col gap-5 rounded-2xl p-5 md:p-6">{children}</div>;
}
