"use client";

import { Menu } from "@base-ui/react/menu";
import { EllipsisVertical } from "lucide-react";
import type { ElementType } from "react";

import { cn } from "@/lib/utils";

export type ActionItem = {
  label: string;
  icon?: ElementType;
  onSelect: () => void;
  /** Renders in the destructive tone and sits below a divider. */
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * The compact "⋮" action menu used on account rows.
 *
 * Callers pass only the actions that are valid for that row's current role
 * and status, so the menu never offers a contradictory move (approving an
 * already-approved account, suspending a pending one). The server validates
 * the transition again regardless — this is convenience, not authorization.
 */
export function ActionsMenu({
  items,
  label = "Account actions",
  disabled = false,
}: {
  items: ActionItem[];
  label?: string;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;

  const normal = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);

  function renderItem(item: ActionItem) {
    const Icon = item.icon;
    return (
      <Menu.Item
        key={item.label}
        disabled={item.disabled}
        onClick={item.onSelect}
        className={cn(
          "flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors outline-none select-none",
          "data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          item.destructive
            ? "text-destructive data-[highlighted]:bg-destructive/10"
            : "text-foreground",
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
        {item.label}
      </Menu.Item>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        aria-label={label}
        className="text-muted-foreground hover:text-foreground border-border hover:bg-accent aria-expanded:bg-accent flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <EllipsisVertical className="size-4" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="bg-popover text-popover-foreground border-border flex min-w-44 flex-col gap-0.5 rounded-xl border p-1.5 shadow-lg">
            {normal.map(renderItem)}
            {destructive.length > 0 && normal.length > 0 ? (
              <div className="bg-border my-1 h-px" />
            ) : null}
            {destructive.map(renderItem)}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
