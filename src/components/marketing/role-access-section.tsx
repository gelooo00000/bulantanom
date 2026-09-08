import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Sprout } from "lucide-react";
import type { ElementType } from "react";

import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

const ROLES: {
  icon: ElementType;
  title: string;
  description: string;
  cta: string;
  href: string;
}[] = [
  {
    icon: Sprout,
    title: "Farmer",
    description:
      "Monitor plants, submit assessments, and get AI-backed risk indicators and soil recommendations for your crops.",
    cta: "Continue as Farmer",
    href: "/login?role=farmer",
  },
  {
    icon: ShieldCheck,
    title: "LGU Agricultural Officer",
    description:
      "Review farmer plant data, soil recommendation records, and risk trends across Layuan Farm.",
    cta: "Continue as Officer",
    href: "/login?role=lgu",
  },
];

export function RoleAccessSection() {
  return (
    <section className="px-6 pt-16 pb-24 md:px-12 md:pt-20 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <FadeIn duration={600} className="flex items-center justify-center gap-3">
          <Leaf className="size-3.5" style={{ color: "var(--landing-accent)" }} />
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Built for everyone working at Layuan Farm
          </p>
          <Leaf className="size-3.5 -scale-x-100" style={{ color: "var(--landing-accent)" }} />
        </FadeIn>

        <div
          className="mt-8 grid grid-cols-1 divide-y overflow-hidden rounded-2xl border lg:grid-cols-2 lg:divide-x lg:divide-y-0"
          style={{
            background: "var(--landing-surface)",
            borderColor: "var(--landing-border)",
          }}
        >
          {ROLES.map(({ icon: Icon, title, description, cta, href }, index) => (
            <FadeIn key={title} delay={index * 150} duration={700}>
              <div
                className="flex h-full flex-col items-start gap-4 p-8 md:p-10"
                style={{ borderColor: "var(--landing-border)" }}
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full border"
                  style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="text-foreground text-xl font-medium">{title}</h3>
                <p className="text-muted-foreground text-sm">{description}</p>
                <Button
                  className="mt-2"
                  nativeButton={false}
                  render={<Link href={href} />}
                >
                  {cta}
                  <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
