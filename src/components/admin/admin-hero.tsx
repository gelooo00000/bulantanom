import type { CSSProperties, ElementType, ReactNode } from "react";

import { PALETTE, gradient, type Swatch } from "@/components/admin/palette";
import { cn } from "@/lib/utils";

/**
 * The banner at the top of each Admin page: a deep forest-green panel with a
 * gold glow, the page's icon, title and one line on what it is for, an
 * optional action on the right and a row of headline numbers underneath.
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
        "relative isolate overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_24px_60px_-28px_#065f46] sm:p-7",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #0f766e 100%)" }}
    >
      {/* A gold glow, a sky glow and a faint dot grid behind the content. */}
      <span
        aria-hidden="true"
        className="absolute -top-28 -right-20 -z-10 size-80 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: PALETTE.gold[0] }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-32 -left-24 -z-10 size-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: PALETTE.sky[0] }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-amber-950 shadow-[0_10px_26px_-10px_#f59e0b]"
            style={{ backgroundImage: gradient(PALETTE.gold) }}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {eyebrow && (
              <p className="font-heading text-xs font-semibold tracking-[0.16em] text-amber-300 uppercase">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-emerald-50/80">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

/**
 * One headline number in the hero: a frosted-glass tile with a coloured
 * icon chip, a button when it leads somewhere.
 */
export function HeroStat({
  icon: Icon,
  label,
  value,
  swatch = PALETTE.forest,
  hint,
  onClick,
  active,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  swatch?: Swatch;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const tile = cn(
    "group/stat relative isolate flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left backdrop-blur-md transition-all duration-200",
    active ? "border-white/60 bg-white/20" : "border-white/15 bg-white/10",
    onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15",
  );
  const style = { "--stat": swatch[0] } as CSSProperties;
  const content = (
    <>
      {/* A thin coloured line along the bottom, brighter when chosen. */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity", active ? "opacity-100" : "opacity-50")}
        style={{ backgroundImage: gradient(swatch, 90) }}
      />
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_var(--stat)]"
        style={{ backgroundImage: gradient(swatch) }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-2xl leading-none font-semibold tabular-nums">{value}</span>
        <span className="mt-1 truncate text-xs text-white/80">{label}</span>
        {hint && <span className="truncate text-[11px] text-white/60">{hint}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={tile} style={style}>
      {content}
    </button>
  ) : (
    <div className={tile} style={style}>
      {content}
    </div>
  );
}
