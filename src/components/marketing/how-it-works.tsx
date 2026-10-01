import { Reveal } from "@/components/motion/reveal";

/** The whole weekly routine, in the three steps a farmer actually takes. */
const STEPS = [
  {
    emoji: "🌱",
    title: "Add your plant",
    text: "Pick the crop and variety and the day you planted. BulanTanom works out when it should be ready.",
  },
  {
    emoji: "📸",
    title: "Check it every week",
    text: "Answer a few quick questions and take one photo. The AI checks the photo really shows your crop.",
  },
  {
    emoji: "✅",
    title: "Know what to do",
    text: "Get a low, medium or high risk reading with the reasons, what to do next, and your harvest dates.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-6 px-6 pt-16 md:px-12 md:pt-24 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <ol aria-label="How it works" className="relative grid gap-4 md:grid-cols-3 md:gap-6">
          {/* The path joining the steps, behind the cards on wide screens. */}
          <div
            aria-hidden="true"
            className="absolute top-12 right-[16%] left-[16%] hidden h-px border-t-2 border-dashed md:block"
            style={{ borderColor: "var(--landing-border)" }}
          />
          {STEPS.map(({ emoji, title, text }, index) => (
            <li key={title}>
              <Reveal delay={index * 150} className="h-full">
                <div
                  className="relative flex h-full flex-col items-center rounded-2xl border p-6 text-center transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    background: "var(--landing-surface)",
                    borderColor: "var(--landing-border)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-16 items-center justify-center rounded-2xl text-3xl shadow-sm"
                    style={{ background: "var(--landing-bg)" }}
                  >
                    {emoji}
                  </span>
                  <span
                    className="mt-4 text-xs font-semibold tracking-wide"
                    style={{ color: "var(--landing-accent)" }}
                  >
                    STEP {index + 1}
                  </span>
                  <h3 className="text-foreground mt-1 text-lg font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
