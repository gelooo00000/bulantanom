"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, KeyRound, LoaderCircle, Lock, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { INK, tint } from "@/components/admin/palette";
import { AUTH_GOLD_BUTTON, AuthCard } from "@/components/auth/auth-card";
import { AUTH_BUTTON_CLASSES, AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkFarmerInvite, setFarmerPassword } from "@/lib/api/auth-api";
import { cn } from "@/lib/utils";

type LinkState =
  | { kind: "checking" }
  | { kind: "ok"; email: string; firstName: string }
  | { kind: "bad"; message: string };

/**
 * Opened from the "Set your password" email an Admin's new Farmer account
 * sends. The Farmer chooses a password here; it is saved to their account
 * and they go on to sign in with their email and that password.
 */
export function SetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [link, setLink] = useState<LinkState>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid || !token) {
        setLink({ kind: "bad", message: "This link is incomplete. Open it again from your email." });
        return;
      }
      try {
        const invite = await checkFarmerInvite(uid, token);
        if (!cancelled) setLink({ kind: "ok", email: invite.email, firstName: invite.first_name });
      } catch (err) {
        if (!cancelled) {
          setLink({
            kind: "bad",
            message: err instanceof Error ? err.message : "This link cannot be used.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || link.kind !== "ok") return;
    setError(null);
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
      await setFarmerPassword({ uid, token, password, password_confirm: confirmPassword });
      router.push("/login?role=farmer&password_set=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout busy={submitting}>
      <FadeIn duration={500}>
        <AuthCard
          header={{
            icon: KeyRound,
            eyebrow: "Farmer account",
            title: link.kind === "ok" && link.firstName ? `Welcome, ${link.firstName}!` : "Set your password",
            description:
              link.kind === "ok"
                ? "Choose the password you will use to sign in to BulanTanom."
                : undefined,
            top: (
              <Link
                href="/login"
                className="-my-2 inline-block py-2 text-sm text-white/80 transition-colors hover:text-white"
              >
                ← Back to sign in
              </Link>
            ),
          }}
        >
          {link.kind === "checking" ? (
            <div className="flex justify-center py-6">
              <LoaderCircle className="text-primary size-6 animate-spin" />
            </div>
          ) : link.kind === "bad" ? (
            <div className="flex flex-col gap-4">
              <p
                className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: INK.rose, backgroundColor: tint(INK.rose, 10) }}
                role="alert"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {link.message}
              </p>
              <Button
                render={<Link href="/login?role=farmer" />}
                className={cn(AUTH_BUTTON_CLASSES, AUTH_GOLD_BUTTON.className)}
                style={AUTH_GOLD_BUTTON.style}
              >
                Go to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <AuthIconInput icon={Mail} id="email" type="email" autoComplete="username" value={link.email} readOnly />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <AuthPasswordField
                  icon={Lock}
                  id="password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">At least 8 characters.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword" className="text-foreground">
                  Confirm password
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
                <p
                  className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
                  style={{ color: INK.rose, backgroundColor: tint(INK.rose, 10) }}
                  role="alert"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className={cn(AUTH_BUTTON_CLASSES, AUTH_GOLD_BUTTON.className)}
                style={AUTH_GOLD_BUTTON.style}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Save password
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
