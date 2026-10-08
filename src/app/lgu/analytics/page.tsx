import { Suspense } from "react";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export default function AgriculturalAnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsDashboard />
    </Suspense>
  );
}
