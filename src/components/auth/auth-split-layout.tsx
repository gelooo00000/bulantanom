import Image from "next/image";
import Link from "next/link";
import { Leaf, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";

/** The light leaf green used for accents that sit directly on the photo. */
const LEAF = "text-[#8be883]";

/**
 * The frame around the sign-in, sign-up, code and password screens, shared by
 * Farmer, LGU Officer and Admin.
 *
 * Phone: the farm photograph is a short band at the top with the name, and
 * the form sits on a solid sheet that rises over it from the bottom, like an
 * app - the first field is on screen without scrolling. Computer: the photo
 * fills the left half and the form has the right half to itself.
 *
 * Text on the photograph is white in both themes; the sheet follows the theme.
 *
 * `busy` locks the whole screen while a request is in flight: everything is
 * made `inert` (no clicks, taps, focus or Enter) so the farmer cannot switch
 * role, follow a link or submit twice mid-sign-in.
 */
export function AuthSplitLayout({
  children,
  busy = false,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <>
      <div
        className="brand-type bg-background relative flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        inert={busy}
        aria-busy={busy}
      >
        {/* The photograph: a band on a phone, the left half on a computer. */}
        <section className="relative h-[30dvh] min-h-52 shrink-0 overflow-hidden text-white lg:sticky lg:top-0 lg:h-dvh">
          <Image
            src="/landing-hero.jpg"
            quality={90}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(4 20 10 / 0.55) 0%, rgb(4 20 10 / 0.1) 38%, rgb(4 20 10 / 0.35) 70%, rgb(4 20 10 / 0.8) 100%)",
            }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between px-5 pt-5 pb-10 md:px-10 lg:px-14 lg:pt-10 lg:pb-14">
            <header className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <Link href="/" className="font-heading text-xl md:text-2xl">
                  BulanTanom
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/85 md:text-sm">
                  <MapPin className={`size-3.5 shrink-0 ${LEAF}`} />
                  Layuan Nature Integrated Farm · Bulan, Sorsogon
                </p>
              </div>
              <ThemeToggle
                onPhoto
                className="size-10 shrink-0 rounded-full border-2 border-white/45 bg-black/25 backdrop-blur-md hover:bg-black/40"
              />
            </header>

            <div>
              <span className="hidden items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-950/70 px-3.5 py-1.5 text-sm font-medium tracking-wide backdrop-blur-sm lg:inline-flex">
                <Leaf className={`size-3.5 fill-current ${LEAF}`} />
                Smarter farming. A greener Bulan.
              </span>
              <p className="font-heading text-2xl leading-[1.1] tracking-[0.01em] sm:text-3xl lg:mt-6 lg:text-5xl xl:text-6xl">
                One farm. <span className={`lg:block ${LEAF}`}>Smarter decisions.</span>
              </p>
              <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-white/90 lg:block">
                AI-powered plant risk monitoring built for Layuan Farm.
              </p>
            </div>
          </div>
        </section>

        {/* The sheet: rises over the photo on a phone, the right half on a computer. */}
        <main className="bg-background relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-3 pb-10 shadow-[0_-10px_30px_rgb(0_0_0/0.18)] sm:px-8 lg:mt-0 lg:justify-center lg:rounded-none lg:px-12 lg:py-12 lg:shadow-none">
          <div aria-hidden="true" className="bg-muted-foreground/25 mx-auto mb-5 h-1.5 w-11 rounded-full lg:hidden" />
          <div className="mx-auto w-full max-w-md">{children}</div>
        </main>
      </div>
      {/* Inert elements show the default cursor; this says "wait" instead. */}
      {busy && <div aria-hidden="true" className="fixed inset-0 z-50 cursor-progress" />}
    </>
  );
}
