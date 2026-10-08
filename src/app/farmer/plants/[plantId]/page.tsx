import { redirect } from "next/navigation";

// The plant page was removed: My Plants cards show what a farmer needs.
// Kept as a redirect so old links and notifications still land.
export default function PlantDetailPage() {
  redirect("/farmer/plants");
}
