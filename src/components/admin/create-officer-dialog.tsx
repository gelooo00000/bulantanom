"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  MailCheck,
  Mars,
  ShieldCheck,
  User,
  UserRoundPlus,
  Venus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { INK, PALETTE, gradient, tint } from "@/components/admin/palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createLguOfficer } from "@/lib/api/admin-api";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { NAME_MAX, cleanText, nameProblem } from "@/lib/text-validation";
import { cn } from "@/lib/utils";

type OfficerGender = "MALE" | "FEMALE" | "UNDISCLOSED";

const GENDERS: { value: OfficerGender; label: string; icon?: LucideIcon; ink: string }[] = [
  { value: "MALE", label: "Male", icon: Mars, ink: INK.sky },
  { value: "FEMALE", label: "Female", icon: Venus, ink: INK.pink },
  { value: "UNDISCLOSED", label: "Prefer not to say", ink: INK.forest },
];

/**
 * A rough, friendly read of how strong the password is, so the Admin sees
 * it before sending. Django still has the final say on what it accepts.
 */
function passwordStrength(password: string) {
  if (!password) return { score: 0, label: "", ink: INK.rose };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: "Too weak", ink: INK.rose },
    { label: "Weak", ink: INK.rose },
    { label: "Fair", ink: INK.gold },
    { label: "Good", ink: INK.forest },
    { label: "Strong", ink: INK.forest },
  ];
  return { score, ...levels[score] };
}

/** An input with an icon inside it, in the dialog's rounded style. */
function IconField({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="relative [&_input]:h-10 [&_input]:rounded-xl [&_input]:pl-9">
      <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
      {children}
    </div>
  );
}

function Section({ icon: Icon, title, ink, children }: { icon: LucideIcon; title: string; ink: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-heading mb-3 flex items-center gap-2 text-sm font-semibold">
        <span
          className="flex size-6 items-center justify-center rounded-lg"
          style={{ color: ink, backgroundColor: tint(ink, 14) }}
        >
          <Icon className="size-3.5" />
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

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
  const [gender, setGender] = useState<OfficerGender | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const matches = confirm.length > 0 && password === confirm;
  const strength = passwordStrength(password);
  const canSubmit =
    Boolean(firstName.trim() && lastName.trim() && email.trim() && password) &&
    !mismatch &&
    !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canSubmit) return;

    const nameError =
      nameProblem(firstName, "First name") ?? nameProblem(lastName, "Last name");
    if (nameError) {
      setError(nameError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const officer = await createLguOfficer(accessToken, {
        first_name: cleanText(firstName),
        last_name: cleanText(lastName),
        email: email.trim(),
        ...(gender ? { gender } : {}),
        password,
      });
      // Nothing is kept in state after success — least of all the password.
      setFirstName("");
      setLastName("");
      setEmail("");
      setGender(null);
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
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-emerald-950/50 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 border border-white/10",
            "flex max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "flex-col overflow-hidden rounded-[1.75rem] shadow-[0_30px_80px_-30px_#065f46]",
            "transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          {/* The header: the same forest-green and gold as the page banner. */}
          <div
            className="relative isolate shrink-0 overflow-hidden px-5 pt-5 pb-6 text-white"
            style={{ backgroundImage: "linear-gradient(135deg, #064e3b 0%, #065f46 45%, #0f766e 100%)" }}
          >
            <span
              aria-hidden="true"
              className="absolute -top-16 -right-10 -z-10 size-48 rounded-full opacity-40 blur-3xl"
              style={{ backgroundColor: PALETTE.gold[0] }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:16px_16px]"
            />
            <ShieldCheck aria-hidden="true" className="absolute right-12 -bottom-5 -z-10 size-24 text-white/10" />

            <div className="flex items-start gap-3.5">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-amber-950 shadow-[0_10px_24px_-10px_#f59e0b]"
                style={{ backgroundImage: gradient(PALETTE.gold) }}
              >
                <UserRoundPlus className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[11px] font-semibold tracking-[0.16em] text-amber-300 uppercase">
                  New account
                </p>
                <Dialog.Title className="text-xl font-semibold tracking-tight">Create LGU Officer</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-emerald-50/80">
                  Officers cannot register themselves.
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

          {/* A form for someone else's account: autofill would drop the
              signed-in Admin's own saved email and password in here. */}
          <form onSubmit={handleSubmit} autoComplete="off" className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
              <Section icon={User} title="Officer details" ink={INK.forest}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="officer-first">First name</Label>
                    <IconField icon={User}>
                      <Input
                        id="officer-first"
                        required
                        maxLength={NAME_MAX}
                        placeholder="Juan"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </IconField>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="officer-last">Last name</Label>
                    <IconField icon={User}>
                      <Input
                        id="officer-last"
                        required
                        maxLength={NAME_MAX}
                        placeholder="Dela Cruz"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </IconField>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="officer-email">Email</Label>
                  <IconField icon={Mail}>
                    <Input
                      id="officer-email"
                      type="email"
                      autoComplete="off"
                      required
                      placeholder="officer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </IconField>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium" id="officer-gender-label">
                    Gender <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <div role="radiogroup" aria-labelledby="officer-gender-label" className="grid grid-cols-3 gap-2">
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

              <Section icon={KeyRound} title="Sign-in password" ink={INK.gold}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="officer-password">Password</Label>
                  <IconField icon={Lock}>
                    <PasswordInput
                      id="officer-password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </IconField>
                  {password && (
                    <div className="flex items-center gap-2" aria-live="polite">
                      <div className="grid flex-1 grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <span
                            key={step}
                            className="bg-muted h-1.5 rounded-full transition-colors"
                            style={step <= strength.score ? { backgroundColor: strength.ink } : undefined}
                          />
                        ))}
                      </div>
                      <span className="font-heading w-16 text-right text-xs font-semibold" style={{ color: strength.ink }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="officer-confirm">Confirm password</Label>
                  <IconField icon={Lock}>
                    <PasswordInput
                      id="officer-confirm"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </IconField>
                  {mismatch ? (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: INK.rose }}>
                      <CircleAlert className="size-4" />
                      Passwords do not match.
                    </p>
                  ) : matches ? (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: INK.forest }}>
                      <CircleCheck className="size-4" />
                      Passwords match.
                    </p>
                  ) : null}
                </div>
              </Section>

              <p
                className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-xs leading-relaxed"
                style={{ backgroundColor: tint(INK.sky, 10) }}
              >
                <MailCheck className="mt-0.5 size-4 shrink-0" style={{ color: INK.sky }} />
                <span>
                  The officer is emailed that their account is ready. Share the password with them
                  privately; they sign in with this email and password.
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
                className="h-10 rounded-xl border-amber-200/60 px-4 text-amber-950 shadow-[0_10px_26px_-10px_#f59e0b] hover:brightness-105 disabled:opacity-50"
                style={{ backgroundImage: gradient(PALETTE.gold) }}
              >
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <UserRoundPlus className="size-4" />}
                Create LGU Officer
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
