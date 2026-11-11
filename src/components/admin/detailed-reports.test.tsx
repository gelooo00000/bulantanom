import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import AdminReportsPage from "@/app/admin/reports/page";
import type { ReportCatalog, ReportDocument } from "@/lib/api/reports-api";

vi.mock("@/components/auth/require-role", () => ({ RequireRole: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/admin/admin-shell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/api/use-authed-query", () => ({
  useAuthedQuery: () => ({
    data: { results: [{ id: 1, report: "summary", title: "Agricultural Summary", params: {}, format: "pdf", created_at: "2026-11-11T08:00:00Z", by: "Admin" }] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const catalog: ReportCatalog = {
  reports: [
    { slug: "summary", title: "Agricultural Summary", category: "Executive Overview", description: "", icon: "chart", supports: [], updated: null, latest: true },
    { slug: "risk", title: "Risk Assessment Report", category: "Technical Report", description: "", icon: "radar", supports: ["risk_level"], updated: null },
  ],
  filters: {
    farmers: [],
    crops: [],
    periods: [{ key: "all_time", label: "All Time" }],
    risk_levels: [{ key: "ALL", label: "All levels" }],
    areas: [],
    soil_types: [],
  },
};

const doc = (slug: string, title: string): ReportDocument => ({
  slug,
  title,
  category: "",
  description: "",
  icon: "chart",
  supports: [],
  farm: { name: "Layuan Farm", location: "Bulan, Sorsogon" },
  period: { key: "all_time", label: "All Time", range: "All records to date", start: null, end: null },
  generated_at: "2026-11-11T08:00:00Z",
  stats: [],
  tables: [],
});

const fetchReport = vi.fn((_token: string, slug: string) =>
  Promise.resolve(slug === "risk" ? doc("risk", "Risk Assessment Report") : doc("summary", "Agricultural Summary")),
);
vi.mock("@/lib/api/reports-api", () => ({
  fetchReportCatalog: () => Promise.resolve(catalog),
  fetchReport: (...args: [string, string]) => fetchReport(...args),
  downloadReport: vi.fn(),
  downloadReportPdf: vi.fn(),
  reportQueryString: () => "",
}));

describe("Detailed Reports", () => {
  it("is one toolbar (report chips, filters, actions once), the report, and folded history", async () => {
    render(<AdminReportsPage />);

    const summary = await screen.findByRole("button", { name: "Agricultural Summary" });
    expect(summary).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { name: "Agricultural Summary" })).toBeInTheDocument();

    // The actions appear once, not in a banner and again under the report.
    expect(screen.getAllByRole("button", { name: /Download PDF/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Print Report/ })).toHaveLength(1);
    // No headline stat boxes.
    expect(screen.queryByText("Reports available")).not.toBeInTheDocument();
    // History is folded away under its count.
    expect(screen.getAllByText("Report history")[0]!.closest("details")).not.toHaveAttribute("open");

    // A report's own filters appear when it is chosen.
    expect(screen.queryByLabelText("Risk Level")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Risk Assessment Report" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Risk Assessment Report" })).toBeInTheDocument());
    expect(screen.getByLabelText("Risk Level")).toBeInTheDocument();
  });
});
