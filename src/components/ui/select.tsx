import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Not modal: a modal select locks page scrolling while open, and the list
 * needs the page to move up when its field is low on the screen (see
 * `makeRoomBelow`). Clicking outside still closes it.
 */
function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
) {
  return <SelectPrimitive.Root modal={false} {...props} />;
}

/** Room the list wants below its field: its usual full height, 20rem. */
const ROOM_BELOW = 320;

/**
 * Scrolls the page just enough that the open list has room below its field.
 * The list never flips above it (that read as the menu jumping upwards), so
 * a field low on the screen is brought up to meet it instead.
 *
 * Runs after the click that opened it, never on pointer-down: moving the
 * page under a pressed button made the release land outside the field, and
 * the list closed again before it was seen.
 */
function makeRoomBelow(trigger: HTMLElement) {
  if (trigger.getAttribute("aria-expanded") !== "true") return; // not open
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  if (below >= ROOM_BELOW) return;
  // Never so far that the field itself leaves the top of the screen.
  const shift = Math.min(ROOM_BELOW - below, rect.top - 16);
  if (shift > 0) window.scrollBy({ top: shift, behavior: "smooth" });
}

function SelectTrigger({
  className,
  children,
  onClick,
  onKeyUp,
  ...props
}: SelectPrimitive.Trigger.Props) {
  // Shortly after, once Base UI has rendered the field as open - a single
  // animation frame was measured to be too soon.
  const afterOpening = (trigger: HTMLElement) =>
    window.setTimeout(() => makeRoomBelow(trigger), 60);
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      onClick={(event) => {
        afterOpening(event.currentTarget);
        onClick?.(event);
      }}
      onKeyUp={(event) => {
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
          afterOpening(event.currentTarget);
        }
        onKeyUp?.(event);
      }}
      className={cn(
        "border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 data-[placeholder]:text-muted-foreground flex h-8 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:ring-3",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground">
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectContent({
  className,
  children,
  style,
  maxHeight = "16rem",
  ...props
}: SelectPrimitive.Popup.Props & {
  /** The list's tallest; it is also never taller than the room below. */
  maxHeight?: string;
}) {
  return (
    <SelectPrimitive.Portal>
      {/* Always opens below the field, like any dropdown. Base UI's
          defaults slid the list up over the field (alignItemWithTrigger) or
          flipped it above when space ran short - either way the menu jumped
          upwards. Instead the trigger makes room (above) and the list is
          capped to the height available below. */}
      <SelectPrimitive.Positioner
        side="bottom"
        align="start"
        sideOffset={4}
        alignItemWithTrigger={false}
        collisionAvoidance={{ side: "none" }}
        className="z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "bg-popover text-popover-foreground border-border min-w-[var(--anchor-width)] overflow-auto rounded-lg border p-1 shadow-md",
            className,
          )}
          // Inline, not a utility class: the cap has to follow Base UI's
          // measured --available-height so the list stops at the screen edge.
          style={{ maxHeight: `min(${maxHeight}, var(--available-height))`, ...style }}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "data-[highlighted]:bg-muted flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("py-1", className)}
      {...props}
    />
  );
}

function SelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-group-label"
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium tracking-wide uppercase",
        className,
      )}
      {...props}
    />
  );
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectGroupLabel,
};
