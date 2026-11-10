import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The banner at the top of each Admin page: a soft green wash with the
 * page's icon, title and one line on what it is for, plus an optional
 * action on the right and a row of headline numbers underneath.
 */
export function AdminHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: ElementType;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  /** Headline numbers, laid out under the title. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-primary/20 relative isolate overflow-hidden rounded-3xl border p-5 sm:p-7",
        "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),transparent_86%)_0%,var(--card)_55%,color-mix(in_oklch,var(--chart-series-1),transparent_90%)_100%)]",
        className,
      )}
    >
      {/* Two soft glows and a faint dot grid behind the content. */}
      <span
        aria-hidden="true"
        className="bg-primary/25 absolute -top-24 -right-16 -z-10 size-72 rounded-full blur-3xl"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-28 -left-20 -z-10 size-64 rounded-full blur-3xl"
        style={{ backgroundColor: "color-mix(in oklch, var(--chart-series-1), transparent 82%)" }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(color-mix(in_oklch,var(--primary),transparent_70%)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="from-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br to-[color-mix(in_oklch,var(--primary),black_25%)] shadow-[0_10px_24px_-10px_var(--primary)]">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-primary font-heading text-xs font-semibold tracking-[0.14em] uppercase">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

/** One headline number in the hero; a button when it leads somewhere. */
export function HeroStat({
  icon: Icon,
  label,
  value,
  color = "var(--primary)",
  hint,
  onClick,
  active,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  color?: string;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ color, backgroundColor: `color-mix(in oklch, ${color}, transparent 85%)` }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="font-heading text-2xl leading-none font-semibold tabular-nums">{value}</span>
        <span className="text-muted-foreground mt-1 truncate text-xs">{label}</span>
        {hint && <span className="text-muted-foreground/80 truncate text-[11px]">{hint}</span>}
      </span>
    </>
  );
  const shell = cn(
    "bg-card/80 border-border flex items-center gap-3 rounded-2xl border px-3.5 py-3 backdrop-blur-sm transition-all",
    onClick && "hover:border-primary/40 cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
    active && "border-primary/50 ring-primary/20 ring-2",
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={shell}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
