"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The page's "Add Plant" action: one button that starts the guided flow.
 *
 * It used to be a split button whose menu listed three more ways in —
 * duplicate a plant, add several at once, import a CSV — none of which were
 * built, so every one was a greyed "Coming soon". With only one real way to
 * add a plant, the menu is gone and the button just does that.
 */
export function AddPlantButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => router.push("/farmer/plants/new")}
      className={cn(
        buttonVariants({ variant: "default" }),
        // h-11 is 44px: this is the page's primary action and reaches
        // phones, where the app's default 32px button is under the minimum
        // comfortable touch target.
        "h-11 px-4 text-[15px]",
        className,
      )}
    >
      <Plus className="size-4" />
      {t("addPlant.button")}
    </button>
  );
}
