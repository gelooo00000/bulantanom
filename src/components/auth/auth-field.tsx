import type { ComponentProps, ElementType } from "react";

import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

/* Token-driven so the auth forms work on both palettes. Tall fields for
   thumbs on a phone.

   16px text everywhere: iOS Safari zooms the whole page in when a focused
   field's text is any smaller. */
export const AUTH_INPUT_CLASSES =
  "h-12 rounded-xl border-input bg-muted/40 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/25";

/** The main button of an auth screen: full width and as tall as the fields. */
export const AUTH_BUTTON_CLASSES = "h-12 w-full rounded-xl text-base font-semibold";

type AuthIconInputProps = ComponentProps<typeof Input> & { icon: ElementType };

export function AuthIconInput({ icon: Icon, className, ...props }: AuthIconInputProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <Input className={cn(AUTH_INPUT_CLASSES, "pl-11 pr-3", className)} {...props} />
    </div>
  );
}

type AuthPasswordFieldProps = ComponentProps<typeof PasswordInput> & { icon: ElementType };

export function AuthPasswordField({ icon: Icon, className, ...props }: AuthPasswordFieldProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <PasswordInput className={cn(AUTH_INPUT_CLASSES, "pl-11 pr-12", className)} {...props} />
    </div>
  );
}

/**
 * A 6-digit emailed code, shown as six boxes. Underneath it is one ordinary
 * input stretched over the boxes, so the phone's "From Mail" code suggestion,
 * pasting and the number keypad all work as with any field.
 */
export function AuthCodeInput({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
}) {
  const active = Math.min(value.length, 5);
  return (
    <div className="group relative">
      <div aria-hidden="true" className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "border-input bg-muted/40 text-foreground flex h-14 items-center justify-center rounded-xl border font-mono text-2xl font-semibold transition-colors",
              value[index] && "border-primary/60 bg-background",
              // The box the next digit goes into, while the field has focus.
              "data-[active]:group-focus-within:border-primary data-[active]:group-focus-within:ring-3 data-[active]:group-focus-within:ring-primary/25",
            )}
            data-active={index === active || undefined}
          >
            {value[index] ?? ""}
          </span>
        ))}
      </div>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
}
