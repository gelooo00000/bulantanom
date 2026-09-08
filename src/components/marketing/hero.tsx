import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  Leaf,
  Radar,
  Sparkles,
  Wheat,
} from "lucide-react";

import { AnimatedHeading } from "@/components/motion/animated-heading";
import { FadeIn } from "@/components/motion/fade-in";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";

const FEATURE_PREVIEWS = [
  { icon: Leaf, title: "Plant Monitoring", description: "Track growth & condition" },
  { icon: Radar, title: "Risk Indicator", description: "Spot plant risks early" },
  { icon: FlaskConical, title: "Soil Intelligence", description: "AI crop suggestions" },
  { icon: Wheat, title: "Harvest Tracking", description: "Know when to harvest" },
];

export function Hero() {

  return (
    <section id="overview" className="relative h-screen w-full overflow-hidden">
      <Image
        src="/landing-bg.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Horizontal scrim: darker left (text area) fading to clear right (image
          breathes). Theme-aware — much lighter in Light Mode so the
          agricultural photograph stays visible, while keeping enough contrast
          under the white headline. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--hero-scrim-strong) 0%, var(--hero-scrim-mid) 35%, var(--hero-scrim-soft) 65%, var(--hero-scrim-faint) 100%)",
        }}
      />
      {/* Vertical scrim: grounds the top of the frame and blends the bottom
          edge into whichever canvas colour the next section uses. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--hero-scrim-top) 0%, transparent 24%, transparent 68%, var(--hero-scrim-bottom) 100%)",
        }}
      />

      {/* Sits over the photograph, so it uses the on-photo variant in both
          themes rather than the token-driven surface styling. */}
      <ThemeToggle
        onPhoto
        className="absolute top-6 right-6 z-20 md:top-8 md:right-12 lg:right-16"
      />

      <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-16 md:px-12 lg:px-16 lg:pb-24">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-2">
          <div className="liquid-glass max-w-2xl rounded-2xl p-6 md:p-8">
            <FadeIn duration={800} className="mb-4 inline-block">
              <span className="border-primary/30 bg-primary/15 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide text-[var(--glass-fg)] uppercase">
                <Sparkles className="size-3" />
                AI Farm Intelligence
              </span>
            </FadeIn>

            <AnimatedHeading
              text={"Smarter farming.\nHealthier crops."}
              className="text-4xl font-normal tracking-[-0.04em] text-[var(--glass-fg)] md:text-5xl lg:text-6xl xl:text-7xl"
            />

            <FadeIn delay={800} duration={1000} className="mt-6">
              <p className="max-w-md text-base text-[var(--glass-fg-muted)] md:text-lg">
                AI-powered crop monitoring, plant health assessment, soil
                recommendations, harvest tracking, and risk detection for
                better agricultural decisions at Layuan Farm.
              </p>
            </FadeIn>

            <FadeIn delay={1200} duration={1000} className="mt-8">
              <Button nativeButton={false} render={<Link href="#features" />}>
                Explore BulanTanom
                <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
              </Button>
            </FadeIn>
          </div>

          <FadeIn delay={1400} duration={1000} className="hidden lg:block">
            <div className="liquid-glass ml-auto w-full max-w-sm rounded-2xl p-6 text-[var(--glass-fg)]">
              <p className="flex items-center gap-1.5 text-xs tracking-wide text-[var(--glass-fg-subtle)] uppercase">
                <Leaf className="size-3" />
                Layuan Farm · AI Farm Intelligence
              </p>

              <p className="mt-4 text-sm font-medium">
                Every plant, assessed weekly.
              </p>
              <p className="mt-1.5 text-sm text-[var(--glass-fg-muted)]">
                Farmers record how each crop is doing. BulanTanom compares that
                against the crop&apos;s expected development and returns a low,
                medium or high risk reading — with the reasoning shown.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--glass-divider)] pt-4">
                {FEATURE_PREVIEWS.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-lg bg-[var(--glass-tile)] p-2.5">
                    <Icon className="size-4 text-[var(--glass-fg-muted)]" />
                    <p className="mt-1.5 text-xs font-medium">{title}</p>
                    <p className="text-[11px] text-[var(--glass-fg-faint)]">{description}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-[11px] text-[var(--glass-fg-faint)]">
                Layuan Farm · One Farm, One Intelligence
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
