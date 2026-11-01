"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, Lock, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, resetPassword } from "@/lib/api/auth-api";

/**
 * A Farmer who forgot their password: ask for a code by email, then type it
 * with a new password. LGU Officers and Admins are not offered this; an Admin
 * resets their passwords.
 */
export function ForgotPasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  // Null until a code has been asked for.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await requestPasswordReset(email);
      setWait(response.resend_after);
      setNotice(response.detail);
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!sentTo || resending || wait > 0) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestPasswordReset(sentTo);
      setWait(response.resend_after);
      setCode("");
      setNotice(response.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    if (!sentTo || submitting) return;
    setError(null);
    setNotice(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({
        email: sentTo,
        code,
        password,
        password_confirm: confirmPassword,
      });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout busy={submitting}>
      <FadeIn duration={500}>
        <AuthCard>
          <div>
            <Link
              href="/login"
              className="-my-2 inline-block py-2 text-sm transition-colors hover:text-foreground"
              style={{ color: "var(--landing-accent)" }}
            >
              ← Back to sign in
            </Link>
            <div className="mt-3 flex items-center gap-2.5 sm:mt-4">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-9"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <KeyRound className="size-4" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {sentTo ? "Choose a new password." : "Forgot your password?"}
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
              {sentTo
                ? "Enter the 6-digit code from your email. The code works once and expires in 10 minutes."
                : "Enter your Farmer account's email and we'll send you a 6-digit code."}
            </p>
          </div>

          {sentTo ? (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code" className="text-foreground">
                  Reset code
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-foreground">
                  New password
                </Label>
                <AuthPasswordField
                  icon={Lock}
                  id="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword" className="text-foreground">
                  Confirm new password
                </Label>
                <AuthPasswordField
                  icon={Lock}
                  id="confirmPassword"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

              <Button type="submit" disabled={submitting || code.length !== 6}>
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Change password
                    <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                  </>
                )}
              </Button>

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
            </form>
          ) : (
            <form onSubmit={handleRequest} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <AuthIconInput
                  icon={Mail}
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send code
                    <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}
        </AuthCard>
      </FadeIn>
    </AuthSplitLayout>
  );
}
