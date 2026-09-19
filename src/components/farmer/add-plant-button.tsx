"use client";

import { Menu } from "@base-ui/react/menu";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Copy,
  FileText,
  Layers,
  Plus,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The "Add Plant" split button: the main part starts the usual flow, the
 * chevron opens the less common ways in.
 *
 * Split rather than a plain button because the four entry points are not
 * equal — adding one plant is what almost every visit is for, so it stays a
 * single click and the rest move behind a deliberate second one.
 *
 * The two halves are separate buttons inside one group, not a button with a
 * nested button (invalid HTML, and a screen reader announces it as one
 * confusing control). Each gets its own accessible name.
 */

type Entry = {
  icon: LucideIcon;
  label: string;
  description: string;
  /** Keyboard hint shown on the right, e.g. the N shortcut. */
  hint?: string;
  onSelect?: () => void;
  /** Flows that do not exist yet render greyed with "Coming soon". */
  comingSoon?: boolean;
};

export function AddPlantButton({ className }: { className?: string }) {
  const router = useRouter();

  function startAddPlant() {
    router.push("/farmer/plants/new");
  }

  const entries: Entry[] = [
    {
      icon: Sprout,
      label: "Add a plant",
      description: "Guided, 3 quick steps",
      hint: "N",
      onSelect: startAddPlant,
    },
    {
      icon: Copy,
      label: "Duplicate existing plant",
      description: "Copy crop, plot and settings",
      comingSoon: true,
    },
    {
      icon: Layers,
      label: "Add several at once",
      description: "Plant a whole field in one go",
      comingSoon: true,
    },
    {
      icon: FileText,
      label: "Import from CSV",
      description: "Bring in an existing farm record",
      comingSoon: true,
    },
  ];

  return (
    <div className={cn("flex", className)}>
      {/* Main action. Square inner corners so the two halves read as one
          control rather than two buttons that happen to touch. */}
      <button
        type="button"
        onClick={startAddPlant}
        className={cn(
          buttonVariants({ variant: "default" }),
          // h-11 is 44px: this is the page's primary action and reaches
          // phones, where the app's default 32px button is under the
          // minimum comfortable touch target.
          "h-11 rounded-r-none border-r-0 pr-3 pl-4 text-[15px]",
        )}
      >
        <Plus className="size-4" />
        Add Plant
      </button>

      <Menu.Root>
        <Menu.Trigger
          aria-label="More ways to add plants"
          className={cn(
            buttonVariants({ variant: "default" }),
            // Square 44px, so the chevron half is as tappable as the main one.
            "h-11 min-w-11 rounded-l-none px-2.5",
            // A hairline between the halves, so the split is visible without
            // a full border that would look like a gap.
            "before:bg-primary-foreground/25 relative before:absolute before:top-2 before:bottom-2 before:left-0 before:w-px before:content-['']",
          )}
        >
          <ChevronDown className="size-4" />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end" className="z-50">
            <Menu.Popup className="bg-popover text-popover-foreground border-border flex w-72 flex-col gap-0.5 rounded-xl border p-1.5 shadow-lg">
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Menu.Item
                    key={entry.label}
                    disabled={entry.comingSoon}
                    onClick={entry.onSelect}
                    className={cn(
                      "flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none select-none",
                      "data-[highlighted]:bg-accent",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
                    )}
                  >
                    <span className="border-border bg-card flex size-8 shrink-0 items-center justify-center rounded-lg border">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {entry.label}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {entry.comingSoon ? "Coming soon" : entry.description}
                      </span>
                    </span>
                    {entry.hint && (
                      <kbd className="border-border text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[11px]">
                        {entry.hint}
                      </kbd>
                    )}
                  </Menu.Item>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
