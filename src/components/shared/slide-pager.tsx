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
  startAt = 0,
  counts,
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
  /**
   * Index of an item to open on: the pager starts on the page holding it.
   * Read once, so remount (a `key`) to jump to another.
   */
  startAt?: number;
  /**
   * Which items the "1–9 of 20" count includes. All of them unless given:
   * My Plants leaves out its "Add another plant" tile, which is not a plant.
   */
  counts?: (item: T) => boolean;
}) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [state, setState] = useState(() => ({
    page: Math.max(0, Math.floor(startAt / pageSize)),
    direction: 1,
  }));
  // Clamped, in case the list shrank while a later page was showing.
  const page = Math.min(state.page, pages - 1);
  const shown = items.slice(page * pageSize, page * pageSize + pageSize);

  // The count only covers items `counts` accepts; the range is the counted
  // items on this page, numbered among all counted items.
  const counted = (list: T[]) => (counts ? list.filter(counts).length : list.length);
  const total = counted(items);
  const before = counted(items.slice(0, page * pageSize));
  const onPage = counted(shown);

  const go = (direction: 1 | -1) => {
    setState({ page: Math.min(pages - 1, Math.max(0, page + direction)), direction });
    onPageChange?.();
  };

  const offset = reduceMotion ? 0 : 32;

  // The tallest page seen so far, so a short last page does not shrink the
  // card and jump everything below it. Forgotten when the number of items
  // changes (some deleted, or Select hiding a tile), so no empty gap is left
  // where removed cards used to be.
  const listRef = useRef<HTMLDivElement>(null);
  const [tallest, setTallest] = useState({ count: items.length, height: 0 });
  const minHeight = tallest.count === items.length ? tallest.height : 0;
  useLayoutEffect(() => {
    if (pages <= 1) return;
    const frame = listRef.current;
    if (!frame) return;
    // Measured without the old minimum, so a shorter list really is shorter.
    const previous = frame.style.minHeight;
    frame.style.minHeight = "";
    const height = frame.offsetHeight;
    frame.style.minHeight = previous;
    if (tallest.count !== items.length || height > tallest.height) {
      setTallest({ count: items.length, height });
    }
  }, [page, pages, items.length, tallest]);

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
            {/* Blank on a page holding only uncounted items (the Add tile). */}
            {onPage > 0 &&
              t("pager.range", { from: before + 1, to: before + onPage, total })}
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
