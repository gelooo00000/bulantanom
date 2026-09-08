import { Activity, FlaskConical, Radar, Sprout, Wheat } from "lucide-react";
import type { ElementType } from "react";

const FEATURES: { icon: ElementType; title: string; description: string }[] = [
  {
    icon: Sprout,
    title: "Plant Monitoring",
    description: "Track growth, health, and conditions in real time.",
  },
  {
    icon: Radar,
    title: "Risk Indicator",
    description: "Understand low, medium, and high plant risks.",
  },
  {
    icon: FlaskConical,
    title: "Soil Recommendation",
    description: "Enter soil properties and get best crop suggestions.",
  },
  {
    icon: Wheat,
    title: "Harvest Tracking",
    description: "Know when your crops are ready to harvest.",
  },
  {
    icon: Activity,
    title: "Smart Monitoring",
    description: "Review assessments and track progress.",
  },
];

export function FeatureStrip() {
  return (
    <section id="features" className="px-6 pb-6 md:px-12 lg:px-16">
      <div
        className="mx-auto max-w-6xl rounded-2xl border px-6 py-6"
        style={{
          background: "var(--landing-surface)",
          borderColor: "var(--landing-border)",
        }}
      >
        <div className="flex items-center gap-6 overflow-x-auto sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible lg:gap-8">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex min-w-[13rem] shrink-0 items-start gap-3 sm:min-w-0 sm:shrink"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                {/* Token-driven: this strip sits on the page canvas, not on
                    the hero photograph, so it must follow the theme. */}
                <p className="text-foreground text-sm font-medium sm:text-xs lg:text-sm">
                  {title}
                </p>
                <p className="text-muted-foreground text-xs sm:text-[11px] lg:text-xs">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
