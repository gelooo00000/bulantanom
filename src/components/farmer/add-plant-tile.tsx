import Link from "next/link";
import { Plus } from "lucide-react";

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
  return (
    <Link
      href="/farmer/plants/new"
      className={cn(
        "group border-border hover:border-primary/60 hover:bg-accent/30 flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition-colors",
        className,
      )}
    >
      <span className="border-primary/40 text-primary group-hover:bg-primary/10 flex size-10 items-center justify-center rounded-full border transition-colors">
        <Plus className="size-5" />
      </span>
      <span className="mt-1 text-sm font-medium">Add another plant</span>
      <span className="text-muted-foreground max-w-[22ch] text-xs">
        See what&apos;s recommended to plant now
      </span>
    </Link>
  );
}
