import Link from "next/link";

import { Logo } from "@/components/shared/logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t px-6 py-8 md:mt-24 md:px-12 lg:px-16" style={{ borderColor: "var(--landing-border)" }}>
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo className="size-7" px={28} />
          <span>
            <span className="text-foreground font-medium">BulanTanom</span> · Layuan Nature
            Integrated Farm, Bulan, Sorsogon
          </span>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Sign up
          </Link>
        </nav>
      </div>
      <p className="text-muted-foreground/70 mx-auto mt-4 max-w-6xl text-center text-xs sm:text-left">
        AI guidance is an estimate, not a diagnosis — it does not replace your agricultural
        officer. <span aria-hidden="true">🌱</span>
      </p>
    </footer>
  );
}
