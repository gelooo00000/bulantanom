import type { ComponentProps, ElementType } from "react";

import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

/* Token-driven so the auth form works on both palettes. `--input` and
   `--card` already carry the right value per theme, so this needs no
   dark:/light: variants. */
export const AUTH_INPUT_CLASSES =
  "border-input bg-card/70 text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/30";

type AuthIconInputProps = ComponentProps<typeof Input> & { icon: ElementType };

export function AuthIconInput({ icon: Icon, className, ...props }: AuthIconInputProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn(AUTH_INPUT_CLASSES, "pl-9 pr-3", className)} {...props} />
    </div>
  );
}

type AuthPasswordFieldProps = ComponentProps<typeof PasswordInput> & { icon: ElementType };

export function AuthPasswordField({ icon: Icon, className, ...props }: AuthPasswordFieldProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <PasswordInput className={cn(AUTH_INPUT_CLASSES, "pl-9", className)} {...props} />
    </div>
  );
}
