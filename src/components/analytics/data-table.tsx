"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  /** Cell content; defaults to the row's value at `key`. */
  render?: (row: T) => ReactNode;
  /** Value used for sorting and searching; defaults to the row's value at `key`. */
  value?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
};

/**
 * A read-only table with sorting, an optional search box and paging. Wide
 * tables scroll inside their own frame, so the page never scrolls sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 15,
  searchable = false,
  searchLabel = "Search",
  emptyText = "No data yet",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  pageSize?: number;
  searchable?: boolean;
  searchLabel?: string;
  emptyText?: string;
  caption?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const valueOf = (col: Column<T>, row: T) =>
    col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as string | number | null);

  const shown = useMemo(() => {
    let list = rows;
    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) => columns.some((c) => String(valueOf(c, r) ?? "").toLowerCase().includes(needle)));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        list = [...list].sort((a, b) => {
          const x = valueOf(col, a);
          const y = valueOf(col, b);
          if (x == null) return 1;
          if (y == null) return -1;
          return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
        });
      }
    }
    return list;
    // valueOf only reads columns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, query, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <label className="relative max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="border-border bg-background focus-visible:ring-ring/50 h-9 w-full rounded-lg border pr-3 pl-8 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          />
        </label>
      )}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-muted/60">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                    className={cn("px-3 py-2 text-xs font-medium whitespace-nowrap", c.align === "right" ? "text-right" : "text-left")}
                  >
                    <button
                      type="button"
                      className="hover:text-foreground inline-flex items-center gap-1"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                    >
                      {c.header}
                      {active && (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-muted-foreground px-3 py-8 text-center text-sm">
                  {query ? `Nothing matches “${query}”.` : emptyText}
                </td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr key={rowKey(row)} className="border-border/70 hover:bg-muted/30 border-t">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2 align-top text-xs", c.align === "right" && "text-right tabular-nums", c.className)}>
                      {c.render ? c.render(row) : String(valueOf(c, row) ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {shown.length > pageSize && (
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <span>
            {current * pageSize + 1}–{Math.min(shown.length, (current + 1) * pageSize)} of {shown.length}
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
