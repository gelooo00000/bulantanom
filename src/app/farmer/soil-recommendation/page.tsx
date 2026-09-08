import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";
import { PageHeader } from "@/components/shared/page-header";

export default function SoilRecommendationPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        title="Soil Recommendation"
        description="Enter your soil properties to get suitable crop suggestions for Layuan Farm."
      />
      <SoilRecommendationForm />
    </div>
  );
}
