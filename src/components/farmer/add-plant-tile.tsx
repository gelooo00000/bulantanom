"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The dashed tile that closes the plant grid.
 *
 * Sits in the flow of the cards rather than only in the header, because the
 * moment a farmer decides to add another plant is usually the moment they
 * have just finished looking at the ones they have. Dashed and unfilled so
 * it reads as a slot to fill, not as a sixth plant.
 *
 * A link, not a button: it goes to a page, so middle-click and "open in new
 * tab" behave the way they look like they should.
 */
export function AddPlantTile({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    // Laid out like a plant card (chip on the left, text beside it) and no
    // taller than one: a tall tile stretched the plant card next to it,
    // leaving an empty block under its three lines.
    <Link
      href="/farmer/plants/new"
      className={cn(
        "group border-border hover:border-primary/60 hover:bg-accent/30 flex items-center gap-3 rounded-xl border border-dashed px-4 py-4 transition-colors",
        className,
      )}
    >
      <span className="border-primary/40 text-primary group-hover:bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors">
        <Plus className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-heading text-base leading-tight">{t("addTile.title")}</span>
        <span className="text-muted-foreground text-xs">{t("addTile.hint")}</span>
      </span>
    </Link>
  );
}
