"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check, Languages } from "lucide-react";

import { LANGUAGES, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The header menu that picks the Farmer screens' language. */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const current = LANGUAGES.find((option) => option.code === language) ?? LANGUAGES[0];

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        aria-label={t("language.change", { name: current.name })}
        title={t("language.label")}
        className={cn(
          "border-border text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        )}
      >
        <Languages className="size-4" />
        {current.short}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <MenuPrimitive.Popup className="bg-popover text-popover-foreground border-border w-60 rounded-lg border p-1 shadow-md">
            <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">
              {t("language.label")}
            </p>
            {LANGUAGES.map((option) => (
              <MenuPrimitive.Item
                key={option.code}
                closeOnClick
                onClick={() => setLanguage(option.code)}
                className="hover:bg-accent data-highlighted:bg-accent flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm outline-none"
              >
                <span lang={option.code}>{option.name}</span>
                {option.code === language && <Check className="text-primary size-4" />}
              </MenuPrimitive.Item>
            ))}
            <p className="text-muted-foreground border-border mt-1 border-t px-2.5 pt-2 pb-1.5 text-xs leading-snug">
              {t("language.note")}
            </p>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
