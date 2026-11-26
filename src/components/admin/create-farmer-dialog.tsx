"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CircleAlert, LoaderCircle, Mail, MailCheck, Sprout, User, UserRoundPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { GENDERS, IconField, Section, type OfficerGender } from "@/components/admin/create-officer-dialog";
import { INK, PALETTE, gradient, tint } from "@/components/admin/palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFarmer } from "@/lib/api/admin-api";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { NAME_MAX, cleanText, nameProblem } from "@/lib/text-validation";
import { cn } from "@/lib/utils";

/**
 * Admin-only creation of a Farmer account. Farmers no longer sign
 * themselves up: the Admin gives the name and email, and the Farmer is
 * emailed a link to choose their own password. No password is asked here.
 */
export function CreateFarmerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string, email: string) => void;
}) {
  const { accessToken } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<OfficerGender | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(firstName.trim() && email.trim()) && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canSubmit) return;

    const nameError =
      nameProblem(firstName, "First name") ??
      (lastName.trim() ? nameProblem(lastName, "Last name") : null);
    if (nameError) {
      setError(nameError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const farmer = await createFarmer(accessToken, {
        first_name: cleanText(firstName),
        last_name: cleanText(lastName),
        email: email.trim(),
        ...(gender ? { gender } : {}),
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setGender(null);
      onCreated(farmer.full_name || farmer.email, farmer.email);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create this account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-emerald-950/50 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 border border-white/10",
            "flex max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "flex-col overflow-hidden rounded-[1.75rem] shadow-[0_30px_80px_-30px_#065f46]",
            "transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div
            className="relative isolate shrink-0 overflow-hidden px-5 pt-5 pb-6 text-white"
            style={{ backgroundImage: "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #0f766e 100%)" }}
          >
            <span
              aria-hidden="true"
              className="absolute -top-16 -right-10 -z-10 size-48 rounded-full opacity-40 blur-3xl"
              style={{ backgroundColor: PALETTE.forest[0] }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:16px_16px]"
            />
            <Sprout aria-hidden="true" className="absolute right-12 -bottom-5 -z-10 size-24 text-white/10" />

            <div className="flex items-start gap-3.5">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_-10px_#10b981]"
                style={{ backgroundImage: gradient(PALETTE.forest) }}
              >
                <UserRoundPlus className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[0.6875rem] font-semibold tracking-[0.16em] text-emerald-300 uppercase">
                  New account
                </p>
                <Dialog.Title className="text-xl font-semibold tracking-tight">Create Farmer</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-emerald-50/80">
                  The farmer sets their own password from the email.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                disabled={submitting}
                className="rounded-xl border border-white/20 bg-white/10 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
              <Section icon={User} title="Farmer details" ink={INK.forest}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="farmer-first">First name</Label>
                    <IconField icon={User}>
                      <Input
                        id="farmer-first"
                        required
                        maxLength={NAME_MAX}
                        placeholder="Juan"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </IconField>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="farmer-last">
                      Last name <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <IconField icon={User}>
                      <Input
                        id="farmer-last"
                        maxLength={NAME_MAX}
                        placeholder="Dela Cruz"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </IconField>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="farmer-email">Email</Label>
                  <IconField icon={Mail}>
                    <Input
                      id="farmer-email"
                      type="email"
                      autoComplete="off"
                      required
                      placeholder="farmer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </IconField>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium" id="farmer-gender-label">
                    Gender <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <div role="radiogroup" aria-labelledby="farmer-gender-label" className="grid grid-cols-3 gap-2">
                    {GENDERS.map(({ value, label, icon: GIcon, ink }) => {
                      const chosen = gender === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={chosen}
                          onClick={() => setGender(chosen ? null : value)}
                          className={cn(
                            "font-heading flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-all",
                            chosen ? "shadow-sm" : "border-border text-muted-foreground hover:text-foreground",
                          )}
                          style={chosen ? { borderColor: ink, color: ink, backgroundColor: tint(ink, 12) } : undefined}
                        >
                          {GIcon && <GIcon className="size-3.5" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              <p
                className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-xs leading-relaxed"
                style={{ backgroundColor: tint(INK.sky, 10) }}
              >
                <MailCheck className="mt-0.5 size-4 shrink-0" style={{ color: INK.sky }} />
                <span>
                  We email the farmer a &ldquo;Set my password&rdquo; link. Once they choose a
                  password, they sign in with this email and that password. The link expires in
                  7 days; you can send a new one from their card.
                </span>
              </p>

              {error ? (
                <p
                  className="flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm"
                  style={{ color: INK.rose, backgroundColor: tint(INK.rose, 10) }}
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              ) : null}
            </div>

            <div className="border-border bg-muted/30 flex shrink-0 justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-10 rounded-xl px-4 text-white shadow-[0_10px_26px_-10px_#10b981] hover:brightness-105 disabled:opacity-50"
                style={{ backgroundImage: gradient(PALETTE.forest) }}
              >
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <UserRoundPlus className="size-4" />}
                Create Farmer
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
