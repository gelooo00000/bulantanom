import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf, MapPin, ShieldUser, UserRound } from "lucide-react";

import { AnimatedHeading } from "@/components/motion/animated-heading";
import { FadeIn } from "@/components/motion/fade-in";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/** The light leaf green used for accents that sit directly on the photo. */
const LEAF = "text-[#8be883]";

/** The glass pill shared by the controls in the top bar. */
const TOP_BAR_PILL =
  "border-2 border-white/45 bg-black/25 text-white backdrop-blur-md transition-colors outline-none hover:bg-black/40 focus-visible:ring-3 focus-visible:ring-white/60";

/**
 * The whole landing page: one full-screen farm photograph with the pitch set
 * straight on it. The text is white in both themes because it sits on the
 * photograph, not on a themed surface; the theme only changes how heavy the
 * scrims are.
 */
export function Hero() {
  return (
    <section id="overview" className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      <Image
        src="/landing-hero.jpg"
        quality={90}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Horizontal scrim: darker on the left, under the text, fading to clear
          on the right so the farm and the sunrise stay untouched. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--hero-scrim-strong) 0%, var(--hero-scrim-mid) 35%, var(--hero-scrim-soft) 65%, var(--hero-scrim-faint) 100%)",
        }}
      />
      {/* Vertical scrim: grounds the top bar and the bottom edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--hero-scrim-top) 0%, transparent 24%, transparent 62%, var(--hero-scrim-bottom) 100%)",
        }}
      />
      {/* On a phone the photo is cropped to its bright middle, so the text
          needs an even wash behind it as well. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/35 md:hidden" />

      {/* Top bar over the photograph: who this is, and the ways in. */}
      <header className="relative z-20 mx-auto flex w-full max-w-[110rem] flex-wrap items-center justify-between gap-x-6 px-4 pt-5 md:px-12 md:pt-8 lg:pr-10 lg:pl-24">
        {/* The name and where this is for, in place of a logo. Three
            arrangements, so the pair always reads as one block opposite the
            sign-in controls: side by side on a wide screen; stacked on a
            medium one; and on a narrow one, where it would crowd the
            controls, the farm line runs full width underneath (the wrapper
            is `contents` there so the line can take its own row). */}
        <div className="contents text-white md:flex md:flex-col lg:flex-row lg:items-center lg:gap-3">
          <Link
            href="/"
            className="py-2 text-base leading-tight font-semibold tracking-tight md:py-1.5 md:text-lg lg:py-2"
          >
            BulanTanom
          </Link>
          <p className="order-last mt-2 flex basis-full items-center gap-1.5 text-xs text-white/80 md:order-none md:mt-0 md:basis-auto lg:border-l lg:border-white/30 lg:pl-3 lg:text-sm">
            <MapPin className={`size-3.5 shrink-0 ${LEAF}`} />
            Layuan Nature Integrated Farm · Bulan, Sorsogon
          </p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <Link
            href="/login"
            className={`flex h-10 items-center gap-2.5 rounded-full px-3 text-sm font-medium whitespace-nowrap sm:px-4 md:px-5 ${TOP_BAR_PILL}`}
          >
            Sign In
            <UserRound className="hidden size-4 fill-current sm:block" />
          </Link>
          <Link
            href="/login?role=admin"
            aria-label="Admin sign in"
            className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap md:px-5 ${TOP_BAR_PILL}`}
          >
            <ShieldUser className="size-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
          <ThemeToggle onPhoto className={`size-10 rounded-full ${TOP_BAR_PILL}`} />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[110rem] flex-1 flex-col justify-center px-4 py-12 md:px-12 lg:px-24">
        <FadeIn duration={800} className="mb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-950/70 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white backdrop-blur-sm sm:text-sm">
            <Leaf className={`size-3.5 fill-current ${LEAF}`} />
            Smarter farming. A greener Bulan.
          </span>
        </FadeIn>

        <AnimatedHeading
          text={"Grow with confidence.\nHarvest on time."}
          lineClassNames={["text-white", LEAF]}
          className="text-3xl leading-[1.12] font-bold tracking-[-0.025em] sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl"
        />

        <FadeIn delay={800} duration={1000} className="mt-7">
          <p className="max-w-lg text-base leading-relaxed text-white/90 md:text-lg 2xl:max-w-xl 2xl:text-xl">
            Record your plants and get weekly crop assessments to help you make{" "}
            <strong className="font-semibold text-white">better decisions</strong>, improve your
            harvest, and build a more productive farm.
          </p>
        </FadeIn>

        <FadeIn delay={1100} duration={1000} className="mt-10">
          <Link
            href="/signup"
            className="group inline-flex h-12 items-center gap-2.5 rounded-full border border-[#8be883]/70 bg-[linear-gradient(180deg,#3fae52_0%,#2a8a3c_100%)] px-6 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(80,200,100,0.7)] transition-all duration-200 outline-none hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-3 focus-visible:ring-white/70 active:translate-y-0"
          >
            <Leaf className="size-4 fill-current" />
            Get started now
            <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover:translate-x-1" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
