import Image from "next/image";
import Link from "next/link";
import { Leaf, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";

/** The light leaf green used for accents that sit directly on the photo. */
const LEAF = "text-[#8be883]";

/**
 * The frame around the sign-in and sign-up screens. It continues the landing
 * page rather than starting a new look: the same farm photograph fills the
 * screen, the same top bar sits over it, and the form floats on the right as
 * a glass panel (see `.auth-panel` in globals.css).
 *
 * Text placed straight on the photograph is white in both themes; only the
 * panel and what is inside it follow the theme.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Fixed, so a long form (sign-up) scrolls over a still photograph. */}
      <div aria-hidden="true" className="fixed inset-0">
        <Image
          src="/landing-hero.jpg"
          quality={90}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--hero-scrim-strong) 0%, var(--hero-scrim-mid) 35%, var(--hero-scrim-soft) 65%, var(--hero-scrim-faint) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, var(--hero-scrim-top) 0%, transparent 24%, transparent 62%, var(--hero-scrim-bottom) 100%)",
          }}
        />
        {/* On a phone the photo is cropped to its bright middle. */}
        <div className="absolute inset-0 bg-black/35 lg:hidden" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-[110rem] items-start justify-between gap-3 sm:items-center px-4 pt-5 md:px-12 md:pt-8 lg:pr-10 lg:pl-24">
        {/* The farm line sits beside the name when there is room and drops
            under it on a narrow screen, rather than disappearing. */}
        <div className="flex flex-col text-white sm:flex-row sm:items-center sm:gap-3">
          <Link href="/" className="font-heading py-1 text-lg sm:py-2 md:text-xl">
            BulanTanom
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-white/80 sm:border-l sm:border-white/30 sm:pl-3 sm:text-sm">
            <MapPin className={`size-3.5 shrink-0 ${LEAF}`} />
            Layuan Nature Integrated Farm · Bulan, Sorsogon
          </p>
        </div>
        <ThemeToggle
          onPhoto
          className="size-10 rounded-full border-2 border-white/45 bg-black/25 backdrop-blur-md hover:bg-black/40"
        />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[110rem] flex-1 content-center items-center gap-5 px-4 py-5 sm:gap-8 sm:py-8 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16 lg:py-10 lg:pr-16 lg:pl-24 xl:pr-28">
        {/* The pitch, carried over from the landing page. Beside the form on a
            wide screen; above it, and smaller, on a narrow one. */}
        <div className="mx-auto w-full max-w-sm text-white sm:max-w-md lg:mx-0 lg:max-w-none">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-950/70 px-3.5 py-1.5 text-xs font-medium tracking-wide backdrop-blur-sm sm:text-sm">
            <Leaf className={`size-3.5 fill-current ${LEAF}`} />
            Smarter farming. A greener Bulan.
          </span>
          <p className="font-heading mt-3 text-3xl leading-[1.1] tracking-[0.01em] sm:mt-4 sm:text-5xl lg:mt-7 xl:text-6xl 2xl:text-7xl">
            One farm.
            <span className={`block ${LEAF}`}>Smarter decisions.</span>
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90 sm:mt-3 sm:text-base lg:mt-6 lg:text-lg">
            AI-powered plant risk monitoring built for Layuan Farm.
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm sm:max-w-md lg:mx-0">{children}</div>
      </main>
    </div>
  );
}
