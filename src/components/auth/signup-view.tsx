"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, LoaderCircle, Mail, Sprout, User } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { DashboardLoadingScreen } from "@/components/auth/dashboard-loading-screen";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";

export function SignupView() {
  const router = useRouter();
  const { currentUser, signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the account is created: the form gives way to the same
  // "Preparing your dashboard..." screen a Farmer sees after signing in.
  const [preparingFor, setPreparingFor] = useState<AuthUser | null>(null);
  // True while this form is creating the account, so the effect below does
  // not race the loading screen to the dashboard once the user is set.
  const signingUp = useRef(false);

  useEffect(() => {
    if (currentUser && !signingUp.current) {
      router.replace(DASHBOARD_BY_ROLE[currentUser.role]);
    }
  }, [currentUser, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // A second Enter before the first request answers must not send another.
    if (submitting) return;
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
    signingUp.current = true;
    try {
      // Signing up signs the Farmer in; the loading screen then opens their
      // own dashboard.
      const user = await signup({ name: fullName, email, password });
      setPreparingFor(user);
    } catch (err) {
      // A failed sign-up never shows the loading screen.
      signingUp.current = false;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Only on failure: on success the loading screen replaces the form,
      // and clearing the flag first would flash the button back to idle.
      setSubmitting(false);
    }
  }

  if (preparingFor) {
    return (
      <AuthSplitLayout>
        <DashboardLoadingScreen
          destination={DASHBOARD_BY_ROLE[preparingFor.role]}
          firstName={preparingFor.firstName}
          newAccount
        />
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout busy={submitting}>
      <FadeIn duration={500}>
        <AuthCard>
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-9"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <Sprout className="size-4" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Create your Farmer account.
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
              Manage your plants, assessments, risk monitoring, crop recommendations, and
              harvest tracking — all in one place for Layuan Farm.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-foreground">
                Full Name
              </Label>
              <AuthIconInput
                icon={User}
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <AuthIconInput
                icon={Mail}
                id="email"
                type="email"
                required
                placeholder="farmer@layuan.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <AuthPasswordField
                icon={Lock}
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm Password
              </Label>
              <AuthPasswordField
                icon={Lock}
                id="confirmPassword"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={submitting} className="mt-1">
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login?role=farmer" className="font-medium" style={{ color: "var(--landing-accent)" }}>
              Sign in
            </Link>
          </p>
        </AuthCard>
      </FadeIn>
    </AuthSplitLayout>
  );
}
