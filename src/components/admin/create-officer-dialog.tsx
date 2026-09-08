"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createLguOfficer } from "@/lib/api/admin-api";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * Admin-only creation of an LGU Officer.
 *
 * LGU Officers have no public registration, so this dialog is the only way
 * an account comes into existence outside Django Admin. It deliberately does
 * not offer a role or status control: both are set server-side, and offering
 * them here would imply the browser gets a say.
 *
 * Password confirmation is checked locally purely to catch typos early —
 * Django still validates strength and email uniqueness, and its errors are
 * surfaced verbatim.
 */
export function CreateOfficerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const { accessToken } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    Boolean(firstName.trim() && lastName.trim() && email.trim() && password) &&
    !mismatch &&
    !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const officer = await createLguOfficer(accessToken, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
      });
      // Nothing is kept in state after success — least of all the password.
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      onCreated(officer.full_name || officer.email);
      onOpenChange(false);
    } catch (err) {
      // Django owns the rules (duplicate email, password strength); show
      // exactly what it said rather than a generic message.
      setError(
        err instanceof ApiError ? err.message : "Unable to create this account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground border-border fixed top-1/2 left-1/2 z-50",
            "flex max-h-[calc(100vh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2",
            "-translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border p-5 shadow-lg",
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
              style={{
                borderColor: "var(--landing-accent)",
                color: "var(--landing-accent)",
              }}
            >
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <Dialog.Title className="text-base font-medium">
                Create LGU Officer
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                Officers cannot register themselves.
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="officer-first">First name</Label>
                <Input
                  id="officer-first"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="officer-last">Last name</Label>
                <Input
                  id="officer-last"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="officer-email">Email</Label>
              <Input
                id="officer-email"
                type="email"
                required
                placeholder="officer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="officer-password">Password</Label>
              <PasswordInput
                id="officer-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="officer-confirm">Confirm password</Label>
              <PasswordInput
                id="officer-confirm"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch ? (
                <p className="text-destructive text-sm">Passwords do not match.</p>
              ) : null}
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Create LGU Officer
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
