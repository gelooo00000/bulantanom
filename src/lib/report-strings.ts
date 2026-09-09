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
    "Access comprehensive agricultural data across farmers, plants, risk readings and soil assessments at Layuan Farm.",

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
  preparing: "Preparing…",

  summary: "Summary",
  soilDetails: "Soil Recommendation Details",
  noRecords: "No records for this period.",
  noneRecorded: "None recorded",
  farm: "Farm",
  generated: "Generated",
  footerNote:
    "Compiled from BulanTanom records. AI guidance is stored from the original assessment and is not a substitute for an agricultural officer's judgement.",

  loadingCatalog: "Loading reports…",
  loadingReport: "Building report…",
  selectPrompt: "Select a report to view its details.",
  pdfError: "Unable to generate the PDF. Please try again.",
} as const;
