import { redirect } from "next/navigation";

// Monitoring was folded into Risk Indicator, which shows each plant's
// weekly check. Kept as a redirect so old links and bookmarks still land.
export default function MonitoringPage() {
  redirect("/farmer/risk-indicator");
}
