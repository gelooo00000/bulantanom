"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";

/**
 * "Enter the code we emailed you." Shown after a Farmer signs up, and when
 * a Farmer whose email was never verified signs in. The code works once;
 * typing it signs the Farmer in, which proves the address is real.
 */
export function VerifyEmailStep({
  email,
  resendAfter,
  onVerified,
  onBack,
  backLabel,
}: {
  email: string;
  /** Seconds before "Resend code" unlocks, as the backend said. */
  resendAfter: number;
  onVerified: (user: AuthUser) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const { verifyEmail, resendCode } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(resendAfter);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (verifying || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      onVerified(await verifyEmail(email, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resending || wait > 0) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      setWait(await resendCode(email));
      setCode("");
      setNotice(`We sent a new code to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  }

  return (
    <FadeIn duration={500}>
      <AuthCard>
        <div>
          <button
            type="button"
            onClick={onBack}
            className="-my-2 inline-flex items-center gap-1 py-2 text-sm transition-colors hover:text-foreground"
            style={{ color: "var(--landing-accent)" }}
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </button>
          <div className="mt-3 flex items-center gap-2.5 sm:mt-4">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-9"
              style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
            >
              <MailCheck className="size-4" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Check your email.
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
            We sent a 6-digit code to{" "}
            <strong className="font-medium text-foreground break-all">{email}</strong>. Enter it
            below to finish. The code works once and expires in 10 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code" className="text-foreground">
              Verification code
            </Label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              className="border-input bg-background/70 focus-visible:border-ring focus-visible:ring-ring/50 h-14 w-full rounded-xl border px-4 text-center font-mono text-2xl tracking-[0.5em] outline-none focus-visible:ring-3"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-risk-low text-sm" role="status">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={verifying || code.length !== 6}>
            {verifying ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                Verify and continue
                <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{" "}
          {wait > 0 ? (
            <span>resend in {wait}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-medium disabled:opacity-60"
              style={{ color: "var(--landing-accent)" }}
            >
              {resending ? "sending…" : "Resend code"}
            </button>
          )}
          .
        </p>
      </AuthCard>
    </FadeIn>
  );
}
