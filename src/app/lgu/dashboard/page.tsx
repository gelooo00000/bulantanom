import { redirect } from "next/navigation";

/** The LGU dashboard is now Agricultural Analytics; old links still work. */
export default function LguDashboardRedirect() {
  redirect("/lgu/analytics");
}
