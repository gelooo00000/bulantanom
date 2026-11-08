import type { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="liquid-glass auth-panel flex flex-col gap-4 rounded-2xl p-5 sm:gap-5 sm:rounded-3xl sm:p-6 md:p-8">
      {children}
    </div>
  );
}
