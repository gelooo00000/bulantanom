import { Reveal } from "@/components/motion/reveal";

/** Everything the app does for a farmer, each with the crop-side emoji. */
const FEATURES = [
  {
    emoji: "🌿",
    title: "Plant monitoring",
    text: "Every plant's age, growth and weekly checks in one place.",
  },
  {
    emoji: "🚦",
    title: "Risk indicator",
    text: "Low, medium or high — with what the AI saw and why.",
  },
  {
    emoji: "🧪",
    title: "Soil & crop advice",
    text: "Enter your soil readings and see which crops suit it, and how to feed it.",
  },
  {
    emoji: "🗓️",
    title: "Harvest calendar",
    text: "Know the weeks each crop will be ready, months ahead.",
  },
  {
    emoji: "🌦️",
    title: "Season-aware",
    text: "Warns when a crop is out of season for Bulan's rains and typhoons.",
  },
  {
    emoji: "🗣️",
    title: "Your language",
    text: "Read everything — AI advice too — in English, Filipino or Bikol.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-6 px-6 pt-16 md:px-12 md:pt-24 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase"
            style={{ color: "var(--landing-accent)" }}
          >
            What you get
          </p>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ emoji, title, text }, index) => (
            <Reveal key={title} delay={(index % 3) * 100} className="h-full">
              <div
                className="group flex h-full items-start gap-4 rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  background: "var(--landing-surface)",
                  borderColor: "var(--landing-border)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                  style={{ background: "var(--landing-bg)" }}
                >
                  {emoji}
                </span>
                <div>
                  <h3 className="text-foreground font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
