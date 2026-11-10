import type { ElementType, ReactNode } from "react";

import { PALETTE, gradient } from "@/components/admin/palette";
import { cn } from "@/lib/utils";

/** The banner across the top of a sign-in or sign-up card. */
export type AuthCardHeader = {
  icon: ElementType;
  /** Small gold line above the title. */
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** A link or control above the title, e.g. "← Back to home". */
  top?: ReactNode;
};

/**
 * The glass panel that holds an auth form. With a `header` it opens with
 * the forest-green and gold banner used across the Admin console, and the
 * form sits below it; without one it is the plain panel.
 */
export function AuthCard({ children, header }: { children: ReactNode; header?: AuthCardHeader }) {
  if (!header) {
    return (
      <div className="liquid-glass auth-panel flex flex-col gap-4 rounded-2xl p-5 sm:gap-5 sm:rounded-3xl sm:p-6 md:p-8">
        {children}
      </div>
    );
  }
  const Icon = header.icon;
  return (
    <div className="liquid-glass auth-panel flex flex-col overflow-hidden rounded-[1.75rem] p-0 shadow-[0_30px_80px_-30px_#065f46]">
      <div
        className="relative isolate overflow-hidden px-5 pt-4 pb-5 text-white sm:px-6 sm:pt-5 sm:pb-6 md:px-8"
        style={{ backgroundImage: "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #0f766e 100%)" }}
      >
        <span
          aria-hidden="true"
          className="absolute -top-16 -right-10 -z-10 size-48 rounded-full opacity-40 blur-3xl"
          style={{ backgroundColor: PALETTE.gold[0] }}
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-20 -left-16 -z-10 size-40 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: PALETTE.sky[0] }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:16px_16px]"
        />
        <Icon aria-hidden="true" className="absolute right-6 -bottom-5 -z-10 size-24 text-white/10" />

        {header.top && <div className="mb-3">{header.top}</div>}
        <div className="flex items-start gap-3.5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-amber-950 shadow-[0_10px_24px_-10px_#f59e0b] sm:size-12"
            style={{ backgroundImage: gradient(PALETTE.gold) }}
          >
            <Icon className="size-5 sm:size-6" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[11px] font-semibold tracking-[0.16em] text-amber-300 uppercase">
              {header.eyebrow}
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{header.title}</h1>
            {header.description && (
              <p className="mt-1 text-sm leading-relaxed text-emerald-50/85">{header.description}</p>
            )}
          </div>
        </div>
      </div>
      <div className={cn("flex flex-col gap-4 p-5 sm:gap-5 sm:p-6 md:p-8")}>{children}</div>
    </div>
  );
}

/** The gold main button of an auth form (pair with AUTH_BUTTON_CLASSES). */
export const AUTH_GOLD_BUTTON = {
  className:
    "border-amber-200/60 text-amber-950 shadow-[0_10px_26px_-10px_#f59e0b] hover:brightness-105 disabled:opacity-60",
  style: { backgroundImage: gradient(PALETTE.gold) },
} as const;
