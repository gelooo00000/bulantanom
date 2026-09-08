"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";

/**
 * The single theme control for the whole app. Two states only — Light and
 * Dark — matching the two palettes defined in globals.css.
 *
 * Styled with theme tokens rather than fixed colours so the same component
 * works in the dashboard header, on the landing page over the hero
 * photograph, and on the auth screens.
 */
export function ThemeToggle({
  className,
  onPhoto = false,
}: {
  className?: string;
  /** Sitting on the hero/auth photograph, where white always reads. */
  onPhoto?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border transition-colors",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        onPhoto
          ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
