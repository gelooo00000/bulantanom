import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

const ROLES = [
  {
    emoji: "👩‍🌾",
    title: "I'm a farmer",
    description:
      "Add your plants, do the weekly check with a photo, and get risk readings, crop advice for your soil and your harvest dates.",
    cta: "Continue as Farmer",
    href: "/login?role=farmer",
    extra: { label: "New here? Create a free account", href: "/signup" },
  },
  {
    emoji: "🏛️",
    title: "I'm an LGU agricultural officer",
    description:
      "See every farmer's plants, risk trends and harvest windows across Layuan Farm, and download reports.",
    cta: "Continue as Officer",
    href: "/login?role=lgu",
    extra: null,
  },
];

export function RoleAccessSection() {
  return (
    <section id="get-started" className="scroll-mt-6 px-6 pt-16 md:px-12 md:pt-24 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase"
            style={{ color: "var(--landing-accent)" }}
          >
            Get started
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-normal tracking-[-0.03em] md:text-4xl">
            Built for everyone working at Layuan Farm
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {ROLES.map(({ emoji, title, description, cta, href, extra }, index) => (
            <Reveal key={title} delay={index * 150} className="h-full">
              <div
                className="flex h-full flex-col items-start gap-4 rounded-2xl border p-8 transition-shadow duration-300 hover:shadow-lg md:p-10"
                style={{
                  background: "var(--landing-surface)",
                  borderColor: "var(--landing-border)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: "var(--landing-bg)" }}
                >
                  {emoji}
                </span>
                <h3 className="text-foreground text-xl font-medium">{title}</h3>
                <p className="text-muted-foreground text-sm">{description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                  <Button nativeButton={false} render={<Link href={href} />}>
                    {cta}
                    <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                  </Button>
                  {extra && (
                    <Link
                      href={extra.href}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                      style={{ color: "var(--landing-accent)" }}
                    >
                      {extra.label}
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
