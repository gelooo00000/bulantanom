import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HorizontalBars, WeeklyColumns } from "@/components/lgu/dashboard-charts";
import { RiskPie } from "@/components/lgu/risk-pie";

const RISK = [
  { key: "HIGH", label: "High risk", value: 2, color: "red" },
  { key: "MEDIUM", label: "Medium risk", value: 1, color: "orange" },
  { key: "LOW", label: "Low risk", value: 5, color: "green" },
  { key: "none", label: "No reading yet", value: 0, color: "gray" },
];

describe("HorizontalBars", () => {
  it("names every row with its count and share, so colour is never the only cue", () => {
    render(<HorizontalBars rows={RISK} unit="plant" label="Plants by risk" />);
    expect(
      screen.getByRole("listitem", { name: "High risk: 2 plants, 25%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Medium risk: 1 plant, 13%" }),
    ).toBeInTheDocument();
  });

  it("draws a zero as an empty bar, not a sliver", () => {
    render(<HorizontalBars rows={RISK} unit="plant" label="Plants by risk" />);
    const row = screen.getByRole("listitem", { name: /No reading yet/ });
    const bar = row.querySelector("[style*='width']") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("scales bars to the largest value", () => {
    render(<HorizontalBars rows={RISK} unit="plant" label="Plants by risk" />);
    const low = screen.getByRole("listitem", { name: /Low risk/ });
    const bar = low.querySelector("[style*='width']") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("survives an all-zero chart without dividing by zero", () => {
    render(
      <HorizontalBars
        rows={RISK.map((row) => ({ ...row, value: 0 }))}
        unit="plant"
        label="Plants by risk"
      />,
    );
    expect(
      screen.getByRole("listitem", { name: "High risk: 0 plants, 0%" }),
    ).toBeInTheDocument();
  });
});

const WEEKS = [
  { week_start: "2026-08-31", count: 0 },
  { week_start: "2026-09-07", count: 4 },
  { week_start: "2026-09-14", count: 2 },
  { week_start: "2026-09-21", count: 3 },
];

describe("WeeklyColumns", () => {
  it("sums the window and calls out this week", () => {
    render(<WeeklyColumns weeks={WEEKS} />);
    expect(
      screen.getByText("9 assessments in the last 4 weeks · 3 this week."),
    ).toBeInTheDocument();
  });

  it("says plainly when nobody assessed anything", () => {
    render(<WeeklyColumns weeks={WEEKS.map((w) => ({ ...w, count: 0 }))} />);
    expect(screen.getByText("No assessments in the last 4 weeks.")).toBeInTheDocument();
  });

  it("offers every week, including the empty one, as a table", async () => {
    const user = userEvent.setup();
    render(<WeeklyColumns weeks={WEEKS} />);
    await user.click(screen.getByRole("button", { name: "Show numbers" }));
    // Header plus all four weeks — the quiet week is not dropped.
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });
});

describe("RiskPie", () => {
  it("says there is nothing to chart instead of drawing an empty ring", () => {
    render(<RiskPie rows={RISK.map((row) => ({ ...row, value: 0 }))} />);
    expect(screen.getByText("No plants to chart yet.")).toBeInTheDocument();
  });

  it("describes every slice by name and count for a screen reader", () => {
    render(<RiskPie rows={RISK} />);
    expect(
      screen.getByRole("img", {
        name: "Plant risk share: High risk 2, Medium risk 1, Low risk 5, No reading yet 0.",
      }),
    ).toBeInTheDocument();
  });
});
