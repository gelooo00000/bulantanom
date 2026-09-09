import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportPreview } from "@/components/lgu/report-preview";
import type { ReportDocument } from "@/lib/api/reports-api";

function makeReport(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    slug: "soil-assessment",
    title: "Soil Assessment Report",
    category: "Agricultural Guidance",
    description: "Soil properties reported by farmers.",
    icon: "flask",
    supports: ["period", "farmer"],
    farm: { name: "Layuan Farm", location: "Bulan, Sorsogon" },
    period: {
      key: "all_time",
      label: "All Time",
      range: "All records to date",
      start: null,
      end: null,
    },
    generated_at: "2026-09-09T10:00:00Z",
    stats: [],
    tables: [],
    details: [],
    ...overrides,
  };
}

describe("ReportPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the report identity an officer needs on a printed page", () => {
    render(<ReportPreview report={makeReport()} />);

    expect(screen.getByText("Soil Assessment Report")).toBeInTheDocument();
    expect(screen.getByText("Agricultural Guidance")).toBeInTheDocument();
    expect(screen.getByText(/Layuan Farm/)).toBeInTheDocument();
    expect(screen.getByText(/All records to date/)).toBeInTheDocument();
    // The brand mark, so a printed report is attributable.
    expect(
      screen.getByAltText("Layuan Nature Integrated Farm"),
    ).toHaveAttribute("src", "/layuan.jpg");
  });

  /**
   * The bug this suite exists for.
   *
   * Detail headings are "<farmer> - <date>", which collides when one farmer
   * submits twice on the same day. Keyed on the heading, React rendered a
   * single card and an officer silently lost a record. Keying on the row id
   * fixes it, and this fails if anyone reverts that.
   */
  it("renders both records when one farmer submits twice on the same day", () => {
    const shared = "Frank Xavier Latonero - 2026-08-27";
    const report = makeReport({
      details: [
        {
          id: 11,
          heading: shared,
          analysed: true,
          unavailable: "",
          sections: [{ label: "Suitable Fruits", text: "Banana" }],
        },
        {
          id: 12,
          heading: shared,
          analysed: true,
          unavailable: "",
          sections: [{ label: "Suitable Fruits", text: "Cacao" }],
        },
      ],
    });

    // Asserting only that two cards appear proves nothing: React renders
    // duplicate-keyed siblings anyway and merely warns, so that assertion
    // passes with the bug present. The warning is the actual signal, so the
    // test fails on it directly.
    const errors: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        errors.push(args.map(String).join(" "));
      });

    render(<ReportPreview report={report} />);
    spy.mockRestore();

    expect(
      errors.filter((e) => /same key/i.test(e)),
      "duplicate React keys - a record can be dropped from the report",
    ).toHaveLength(0);

    expect(screen.getAllByText(shared)).toHaveLength(2);
    // Both payloads survive, not just both headings.
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cacao")).toBeInTheDocument();
  });

  it("says an AI reading is unavailable rather than inventing one", () => {
    const report = makeReport({
      details: [
        {
          id: 1,
          heading: "Angelo Gloriane - 2026-09-09",
          analysed: false,
          unavailable: "AI recommendation is temporarily unavailable.",
          sections: [{ label: "Suitable Fruits", text: "Banana" }],
        },
      ],
    });

    render(<ReportPreview report={report} />);

    expect(
      screen.getByText("AI recommendation is temporarily unavailable."),
    ).toBeInTheDocument();
    // The stored sections must not leak into an unanalysed record.
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("shows an empty-state line instead of a bare table when nothing matched", () => {
    const report = makeReport({
      tables: [
        {
          title: "Soil Assessments",
          columns: ["Farmer", "Date"],
          keys: ["farmer", "date"],
          rows: [],
        },
      ],
    });

    render(<ReportPreview report={report} />);

    expect(screen.getByText("No records for this period.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders every row and column of a table", () => {
    const report = makeReport({
      tables: [
        {
          title: "Soil Assessments",
          columns: ["Farmer", "Date", "Soil Type"],
          keys: ["farmer", "date", "soil_type"],
          rows: [
            { farmer: "Angelo Gloriane", date: "2026-09-09", soil_type: "Sandy" },
            { farmer: "Frank Xavier Latonero", date: "2026-08-27", soil_type: "Loamy" },
          ],
        },
      ],
    });

    render(<ReportPreview report={report} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    // Two data rows plus the header row.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Angelo Gloriane")).toBeInTheDocument();
    expect(within(table).getByText("Loamy")).toBeInTheDocument();
  });

  it("renders a missing cell as a dash rather than the word undefined", () => {
    const report = makeReport({
      tables: [
        {
          title: "Soil Assessments",
          columns: ["Farmer", "pH"],
          keys: ["farmer", "ph"],
          rows: [{ farmer: "Angelo Gloriane" }],
        },
      ],
    });

    render(<ReportPreview report={report} />);

    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it("keeps the printable sheet marked so the print stylesheet can find it", () => {
    const { container } = render(<ReportPreview report={makeReport()} />);
    // The print rules hang off this class; losing it silently breaks Print.
    expect(container.querySelector(".report-sheet")).not.toBeNull();
  });
});
