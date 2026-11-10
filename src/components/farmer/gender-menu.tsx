"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check, UserRound } from "lucide-react";
import { useState } from "react";

import type { Gender } from "@/lib/api/auth-api";
import { useAuth } from "@/lib/auth/auth-context";
import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: Exclude<Gender, "">[] = ["MALE", "FEMALE", "UNDISCLOSED"];

/**
 * The header menu where Farmers set or change their gender (optional). A
 * dot on the button invites anyone who has not answered yet.
 */
export function GenderMenu() {
  const { currentUser, setGender } = useAuth();
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const current = currentUser?.gender ?? "";

  async function choose(value: Exclude<Gender, "">) {
    setFailed(false);
    try {
      await setGender(value);
    } catch {
      setFailed(true);
    }
  }

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        aria-label={t("gender.open")}
        title={t("gender.open")}
        className={cn(
          "border-border text-muted-foreground hover:text-foreground hover:bg-accent relative flex size-8 items-center justify-center rounded-lg border transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        )}
      >
        <UserRound className="size-4" />
        {current === "" && (
          <span className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />
        )}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <MenuPrimitive.Popup className="bg-popover text-popover-foreground border-border w-56 rounded-lg border p-1 shadow-md">
            <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">{t("gender.label")}</p>
            {OPTIONS.map((value) => (
              <MenuPrimitive.Item
                key={value}
                closeOnClick
                onClick={() => void choose(value)}
                className="hover:bg-accent data-highlighted:bg-accent flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm outline-none"
              >
                {t(`gender.${value}` as MessageKey)}
                {current === value && <Check className="text-primary size-4" />}
              </MenuPrimitive.Item>
            ))}
            {failed && <p className="text-destructive px-2.5 pt-1 pb-1.5 text-xs">{t("gender.failed")}</p>}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
