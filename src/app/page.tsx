import { FeatureStrip } from "@/components/marketing/feature-strip";
import { Hero } from "@/components/marketing/hero";
import { RoleAccessSection } from "@/components/marketing/role-access-section";

export default function Home() {
  return (
    // The landing-* theme class is applied to <html> by the theme provider,
    // so this only needs to paint the canvas the sections sit on.
    <div className="flex flex-1 flex-col" style={{ background: "var(--landing-bg)" }}>
      <Hero />
      <FeatureStrip />
      <RoleAccessSection />
    </div>
  );
}
