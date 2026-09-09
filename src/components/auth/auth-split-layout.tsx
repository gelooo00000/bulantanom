import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

function BrandMark() {
  return (
    <Link href="/" className="relative z-10 flex items-center gap-2 font-medium tracking-tight">
      <Logo className="size-9" px={36} />
      BulanTanom
    </Link>
  );
}

function PanelBackground({ strong = false }: { strong?: boolean }) {
  return (
    <>
      <Image
        src="/landing-bg.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover object-center"
      />
      {/* Horizontal scrim: darker toward the text (left), photo breathes on the right */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: strong
            ? "linear-gradient(90deg, oklch(0.08 0.02 155 / 0.9) 0%, oklch(0.08 0.02 155 / 0.75) 45%, oklch(0.08 0.02 155 / 0.5) 100%)"
            : "linear-gradient(90deg, oklch(0.08 0.02 155 / 0.82) 0%, oklch(0.08 0.02 155 / 0.55) 35%, oklch(0.08 0.02 155 / 0.15) 65%, oklch(0.08 0.02 155 / 0.05) 100%)",
        }}
      />
      {/* Vertical scrim: grounds the brand mark at top and the tagline at bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: strong
            ? "linear-gradient(180deg, oklch(0.08 0.02 155 / 0.65) 0%, oklch(0.08 0.02 155 / 0.35) 40%, oklch(0.08 0.02 155 / 0.7) 100%)"
            : "linear-gradient(180deg, oklch(0.08 0.02 155 / 0.55) 0%, transparent 30%, transparent 65%, oklch(0.08 0.02 155 / 0.6) 100%)",
        }}
      />
      {/* Vignette: subtle edge darkening so the panel frames its content */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, oklch(0.05 0.02 155 / 0.55) 100%)",
        }}
      />
      {/* Subtle green atmospheric glow */}
      <div
        aria-hidden="true"
        className="absolute -bottom-10 -left-10 size-72 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, oklch(0.75 0.18 140 / 0.5) 0%, transparent 70%)",
        }}
      />
    </>
  );
}

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop: full visual panel with the real Layuan Farm photo */}
      <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <PanelBackground />

        <BrandMark />

        <div className="relative z-10">
          <p className="text-3xl leading-tight font-medium tracking-tight">
            One farm.
            <br />
            Smarter decisions.
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/70">
            AI-powered plant risk monitoring built for Layuan Farm.
          </p>
        </div>
      </div>

      {/* Tablet/mobile: compact visual banner instead of hiding the identity entirely */}
      <div className="relative flex h-40 shrink-0 flex-col justify-between overflow-hidden p-6 text-white lg:hidden">
        <PanelBackground strong />
        <BrandMark />
        <p className="relative z-10 text-lg leading-tight font-medium tracking-tight">
          Smarter farming. Healthier crops.
        </p>
      </div>

      <div
        className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:w-[54%] lg:py-10"
        style={{ background: "var(--landing-bg)" }}
      >
        <ThemeToggle className="absolute top-5 right-5" />
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
