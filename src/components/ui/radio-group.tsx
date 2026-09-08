import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  ...props
}: RadioPrimitive.Root.Props & { children?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <RadioPrimitive.Root
        data-slot="radio-group-item"
        className={cn(
          "border-border flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          "data-[checked]:border-primary",
          className,
        )}
        {...props}
      >
        <RadioPrimitive.Indicator className="bg-primary size-2 rounded-full data-[unchecked]:hidden" />
      </RadioPrimitive.Root>
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
