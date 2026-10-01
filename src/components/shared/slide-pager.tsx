"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A short list shown a page at a time, with previous / next buttons that
 * slide the next page in from the side it was asked for. Keeps a dashboard
 * card the same size however many plants a farm has.
 *
 * Remount it (a `key`) when the items are a different set — a new date, say
 * — so it starts again on the first page.
 */
export function SlidePager<T>({
  items,
  pageSize = 4,
  getKey,
  renderItem,
  listLabel,
  className,
  listClassName = "flex flex-col",
  itemClassName = "border-border/60 border-t first:border-t-0",
  frameClassName,
  onPageChange,
}: {
  items: T[];
  pageSize?: number;
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  /** Accessible name for the list. */
  listLabel?: string;
  className?: string;
  /** Layout of the list itself; a plain divided column unless overridden. */
  listClassName?: string;
  /** Classes for each row's `<li>`; the dividing rule unless overridden. */
  itemClassName?: string;
  /** Extra classes for the clipping frame, e.g. room for a row's focus ring. */
  frameClassName?: string;
  /** Called when the page changes, e.g. to clear a hover the old page held. */
  onPageChange?: () => void;
}) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [state, setState] = useState({ page: 0, direction: 1 });
  // Clamped, in case the list shrank while a later page was showing.
  const page = Math.min(state.page, pages - 1);
  const shown = items.slice(page * pageSize, page * pageSize + pageSize);

  const go = (direction: 1 | -1) => {
    setState({ page: Math.min(pages - 1, Math.max(0, page + direction)), direction });
    onPageChange?.();
  };

  const offset = reduceMotion ? 0 : 32;

  // The tallest page seen so far, so a short last page does not shrink the
  // card and jump everything below it.
  const listRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState(0);
  useLayoutEffect(() => {
    const height = listRef.current?.offsetHeight ?? 0;
    if (pages > 1 && height > minHeight) setMinHeight(height);
  }, [page, pages, minHeight]);

  return (
    <div className={className}>
      {/* "popLayout": the new page mounts at once while the old one slides
          out over it, so the list never waits on an animation to finish. */}
      <div
        ref={listRef}
        className={cn("relative overflow-hidden", frameClassName)}
        style={minHeight ? { minHeight } : undefined}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
          <motion.ul
            key={page}
            aria-label={listLabel}
            className={listClassName}
            custom={state.direction}
            initial={{ opacity: 0, x: state.direction * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -state.direction * offset }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
          >
            {shown.map((item) => (
              <li key={getKey(item)} className={itemClassName}>
                {renderItem(item)}
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>

      {pages > 1 && (
        <div className="border-border/60 mt-1 flex items-center justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {t("pager.range", {
              from: page * pageSize + 1,
              to: page * pageSize + shown.length,
              total: items.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <PagerButton
              label={t("pager.previous")}
              disabled={page === 0}
              onClick={() => go(-1)}
            >
              <ChevronLeft className="size-4" />
            </PagerButton>
            <PagerButton
              label={t("pager.next")}
              disabled={page === pages - 1}
              onClick={() => go(1)}
            >
              <ChevronRight className="size-4" />
            </PagerButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-border flex size-8 items-center justify-center rounded-lg border transition-colors",
        "hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
