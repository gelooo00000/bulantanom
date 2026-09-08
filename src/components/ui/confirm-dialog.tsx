"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation dialog for actions that change or remove an account.
 *
 * Built on the same Base UI primitive the notification bell already uses, so
 * focus trapping, escape-to-close and portalling behave like the rest of the
 * app — `window.confirm` would not be themeable and cannot carry the typed
 * confirmation below.
 *
 * When `confirmPhrase` is set the confirm button stays disabled until the
 * phrase is typed exactly, case included. That is deliberate friction for
 * permanent deletion, not decoration.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  confirmPhrase,
  destructive = false,
  busy = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: ReactNode;
  confirmLabel: string;
  confirmPhrase?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  // Callers mount this only while a confirmation is pending, so closing
  // unmounts it and the typed phrase resets on its own — no effect needed,
  // and reopening can never start already-confirmed.
  const [typed, setTyped] = useState("");

  const phraseSatisfied = !confirmPhrase || typed === confirmPhrase;
  const canConfirm = phraseSatisfied && !busy;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground border-border fixed top-1/2 left-1/2 z-50",
            "flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "flex-col gap-4 rounded-xl border p-5 shadow-lg",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="text-base font-medium">{title}</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              {description}
            </Dialog.Description>
          </div>

          {details ? (
            <div className="border-border bg-card/60 flex flex-col gap-0.5 rounded-lg border px-3 py-2.5">
              {details}
            </div>
          ) : null}

          {confirmPhrase ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-phrase" className="text-sm">
                Type <span className="font-medium">{confirmPhrase}</span> to confirm
              </label>
              <input
                id="confirm-phrase"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="border-border bg-background focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              />
            </div>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
