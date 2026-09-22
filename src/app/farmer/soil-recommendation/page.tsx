"use client";

import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";
import { PageHeader } from "@/components/shared/page-header";
import { useLanguage } from "@/lib/i18n";

export default function SoilRecommendationPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        title={t("soilPage.title")}
        description={t("soilPage.description")}
      />
      <SoilRecommendationForm />
    </div>
  );
}
