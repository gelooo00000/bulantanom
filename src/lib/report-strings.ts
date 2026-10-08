/**
 * UI strings for the LGU Detailed Reports screen.
 *
 * Collected in one object rather than scattered through the JSX, mirroring
 * SOIL_STRINGS in `soil-options.ts`. The project has no i18n framework today
 * (no next-intl, no i18next, and `SoilRecommendation.language` was dropped in
 * plants migration 0006), so these are English. Keeping them together means a
 * future locale layer has one file to wrap instead of a dozen components.
 */

export const REPORT_STRINGS = {
  brand: "BulanTanom",
  pageTitle: "Detailed Reports",
  pageDescription:
    "Generate reports on crop recommendations, harvests, risk and farmers, and export them as PDF or CSV.",

  filters: "Filters",
  period: "Period",
  farmer: "Farmer",
  crop: "Crop",
  riskLevel: "Risk Level",
  dateFrom: "From",
  dateTo: "To",
  allFarmers: "All Farmers",
  allCrops: "All Crops",

  availableReports: "Available Reports",
  reportPreview: "Report Preview",
  latest: "Latest",
  updated: "Updated",
  noActivity: "No records yet",

  print: "Print Report",
  download: "Download PDF",
  downloadCsv: "Export CSV",
  csvError: "Unable to generate the CSV. Please try again.",
  area: "Area",
  soilType: "Soil type",
  allSoilTypes: "All soil types",
  history: "Report history",
  historyHint:
    "Every PDF and CSV export, with the parameters it used. Downloading one again rebuilds it from the current records.",
  historyEmpty: "No reports exported yet.",
  loadingHistory: "Loading report history…",
  preparing: "Preparing…",

  summary: "Summary",
  noRecords: "No records for this period.",
  farm: "Farm",
  generated: "Generated",
  footerNote:
    "Compiled from BulanTanom records. AI guidance is as stored at assessment time and does not replace an agricultural officer's judgement.",
  preparedBy: "Prepared by:",
  preparedByRole: "LGU Agricultural Officer",
  notedBy: "Noted by:",
  notedByRole: "Municipal Agriculturist",

  loadingCatalog: "Loading reports…",
  loadingReport: "Building report…",
  selectPrompt: "Select a report to view its details.",
  pdfError: "Unable to generate the PDF. Please try again.",
} as const;
