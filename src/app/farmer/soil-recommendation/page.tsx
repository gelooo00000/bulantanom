"use client";

import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";

export default function SoilRecommendationPage() {
  // The form renders the page header, since its "See Result" / "Back"
  // button depends on which view the form is showing.
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <SoilRecommendationForm />
    </div>
  );
}
