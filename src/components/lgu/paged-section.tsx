"use client";

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/**
 * A titled group of cards, `perPage` at a time, as on Harvest & Monitoring
 * and Plant Loss. Pages sit side by side in one strip that slides when the
 * officer moves between them (or swipes, on a phone).
 */
export function PagedSection<T>({
  title,
  icon: Icon,
  hint,
  color,
  items,
  perPage,
  itemKey,
  renderItem,
}: {
  title: string;
  icon: LucideIcon;
  hint: string;
  color: string;
  items: T[];
  perPage: number;
  itemKey: (item: T) => React.Key;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const touchX = useRef<number | null>(null);
  if (items.length === 0) return null;
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  // The list can shrink under the current page after a refetch.
  const current = Math.min(page, pages.length - 1);
  const go = (to: number) => setPage(Math.max(0, Math.min(pages.length - 1, to)));
  const first = current * perPage + 1;
  const last = Math.min(items.length, first + perPage - 1);

  return (
    <section className="flex flex-col gap-3.5" aria-label={title}>
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{ color, backgroundColor: tint(color, 15) }}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <span
          className="font-heading rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color, backgroundColor: tint(color, 14) }}
        >
          {items.length}
        </span>
        <span className="text-muted-foreground hidden text-sm md:inline">· {hint}</span>
        <span
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(90deg, ${tint(color, 35)}, transparent)` }}
        />
      </div>
      {/* Room for the cards' hover lift and outline inside the clipped strip. */}
      <div
        className="-m-2 overflow-hidden p-2"
        onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const moved = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(moved) > 50) go(current + (moved < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex items-start transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(calc(-${current * 100}% - ${current} * 1rem))`, gap: "1rem" }}
        >
          {pages.map((group, index) => (
            <div
              key={index}
              className={cn(
                "grid w-full shrink-0 gap-4 transition-opacity duration-500 lg:grid-cols-2",
                index === current ? "opacity-100" : "opacity-0",
              )}
              inert={index !== current}
              aria-hidden={index !== current}
            >
              {group.map((item) => (
                <div key={itemKey(item)} className="contents">
                  {renderItem(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {first}–{last} of {items.length}
          </p>
          <div className="flex items-center gap-1.5">
            {pages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Page ${index + 1}`}
                aria-current={index === current ? "page" : undefined}
                onClick={() => go(index)}
                className="flex h-6 items-center"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all duration-300",
                    index === current ? "w-6" : "bg-border hover:bg-muted-foreground/40 w-2",
                  )}
                  style={index === current ? { backgroundColor: color } : undefined}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <PageButton label="Previous page" disabled={current === 0} onClick={() => go(current - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </PageButton>
            <PageButton
              label="Next page"
              disabled={current === pages.length - 1}
              onClick={() => go(current + 1)}
              color={color}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageButton>
          </div>
        </div>
      )}
    </section>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  color,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border bg-card hover:bg-muted flex size-9 items-center justify-center rounded-full border shadow-sm transition-all hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40"
      style={color && !disabled ? { color, borderColor: tint(color, 40) } : undefined}
    >
      {children}
    </button>
  );
}

/** The pill-shaped tab bar used above these sections. */
export function SegmentTabs<V extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  tabs: readonly { value: V; label: string; count: number; icon: LucideIcon; color?: string }[];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="bg-muted/60 inline-flex rounded-2xl p-1" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const active = value === tab.value;
          const TabIcon = tab.icon;
          const color = tab.color ?? "var(--primary)";
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "font-heading flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TabIcon className="size-4" style={tab.color ? { color } : undefined} aria-hidden="true" />
              {tab.label}
              <span
                className="rounded-full px-1.5 py-px text-xs tabular-nums"
                style={
                  active ? { color, backgroundColor: tint(color, 15) } : { backgroundColor: "var(--border)" }
                }
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
