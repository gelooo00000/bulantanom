import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CardState, StatCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { ignoredFilters } from "@/lib/analytics/use-analytics-filters";
import { analyticsQuery, EMPTY_FILTERS } from "@/lib/api/analytics-api";
import { Users } from "lucide-react";

describe("analytics filters", () => {
  it("sends only the filters that are set", () => {
    expect(analyticsQuery(EMPTY_FILTERS)).toBe("");
    expect(analyticsQuery({ ...EMPTY_FILTERS, season: "wet", crop: "corn", dateFrom: "2026-01-01" })).toBe(
      "?date_from=2026-01-01&season=wet&crop=corn",
    );
  });

  it("names the active filters a card does not honour", () => {
    const f = { ...EMPTY_FILTERS, season: "dry" as const, soilType: "clay", farmer: "3" };
    expect(ignoredFilters(f, ["date", "season", "crop", "farmer"])).toEqual(["soil type"]);
    expect(ignoredFilters(EMPTY_FILTERS, [])).toEqual([]);
  });
});

describe("StatCard", () => {
  it("shows the value and the change against the previous period", () => {
    render(
      <StatCard
        label="Total farmers"
        icon={Users}
        value={12}
        trend={{ current: 5, previous: 2, period: { from: "2026-09-09", to: "2026-10-08" }, previous_period: { from: "2026-08-10", to: "2026-09-08" } }}
      />,
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/\+3/)).toBeInTheDocument();
    expect(screen.getByText(/vs previous period/)).toBeInTheDocument();
  });
});

describe("CardState", () => {
  const base = { data: null, loading: false, error: null, refetch: vi.fn() };

  it("shows loading, error with retry, empty and data states", async () => {
    const { rerender } = render(<CardState query={{ ...base, loading: true }}>{() => "data"}</CardState>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    const refetch = vi.fn();
    rerender(<CardState query={{ ...base, error: "Server unavailable", refetch }}>{() => "data"}</CardState>);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();

    rerender(<CardState query={{ ...base, data: [] as number[] }} isEmpty={(d) => d.length === 0}>{() => "data"}</CardState>);
    expect(screen.getByText("No data yet")).toBeInTheDocument();

    rerender(<CardState query={{ ...base, data: [1] }} isEmpty={(d) => d.length === 0}>{(d) => `rows: ${d.length}`}</CardState>);
    expect(screen.getByText("rows: 1")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, name: `Farmer ${String(i + 1).padStart(2, "0")}`, ph: 5 + (i % 4) }));
  const columns = [
    { key: "name", header: "Farmer" },
    { key: "ph", header: "pH", align: "right" as const },
  ];

  it("pages, sorts and searches", async () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={10} searchable searchLabel="Search" />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("11–20 of 23")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Farmer" }));
    await userEvent.click(screen.getByRole("button", { name: "Farmer" }));
    expect(screen.getByRole("columnheader", { name: /Farmer/ })).toHaveAttribute("aria-sort", "descending");

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "Farmer 07");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("says when there is nothing to show", () => {
    render(<DataTable rows={[]} columns={columns} rowKey={(r: { id: number }) => r.id} emptyText="No data yet" />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
