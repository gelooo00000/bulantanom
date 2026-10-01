import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportPreview } from "@/components/lgu/report-preview";
import type { ReportDocument } from "@/lib/api/reports-api";

function makeReport(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    slug: "plant-crop",
    title: "Plant & Crop Report",
    category: "Performance Report",
    description: "Every registered plant with planting date, age, status and harvest window.",
    icon: "sprout",
    supports: ["period", "farmer", "crop"],
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
    ...overrides,
  };
}

describe("ReportPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the report identity an officer needs on a printed page", () => {
    render(<ReportPreview report={makeReport()} />);

    expect(screen.getByText("Plant & Crop Report")).toBeInTheDocument();
    expect(screen.getByText("Performance Report")).toBeInTheDocument();
    expect(screen.getByText(/Layuan Farm/)).toBeInTheDocument();
    expect(screen.getByText(/All records to date/)).toBeInTheDocument();
    // The brand mark, so a printed report is attributable.
    expect(
      screen.getByAltText("Layuan Nature Integrated Farm"),
    ).toHaveAttribute("src", "/layuan.jpg");
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
