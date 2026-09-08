"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  FlaskConical,
  Lock,
  LoaderCircle,
  Mail,
  Radar,
  Sprout,
  User,
} from "lucide-react";
import { useEffect, useState, type ElementType, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";

const FEATURES: { icon: ElementType; title: string; description: string }[] = [
  {
    icon: Sprout,
    title: "Plant Monitoring",
    description: "Track crop growth and plant conditions.",
  },
  {
    icon: FlaskConical,
    title: "Soil Intelligence",
    description: "Record soil properties and receive plant recommendations.",
  },
  {
    icon: Radar,
    title: "Risk Monitoring",
    description: "Understand low, medium, and high plant risk conditions.",
  },
];

export function SignupView() {
  const router = useRouter();
  const { currentUser, signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (currentUser) {
      router.replace(DASHBOARD_BY_ROLE[currentUser.role]);
    }
  }, [currentUser, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      // Registration does not sign the Farmer in — the account is created
      // PENDING and must be approved by an Admin first.
      await signup({ name: fullName, email, password });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthSplitLayout>
        <FadeIn duration={500}>
          <AuthCard>
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <CircleCheck className="size-6" />
              </span>
              <div>
                <h1 className="text-2xl font-medium tracking-tight text-foreground">
                  Registration submitted
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your Farmer account is currently waiting for administrator
                  approval. You will be able to access BulanTanom once your
                  account has been approved.
                </p>
              </div>

              <div
                className="w-full rounded-xl border p-3 text-left"
                style={{ borderColor: "var(--landing-border)" }}
              >
                <p className="text-xs tracking-wide text-muted-foreground/70 uppercase">Submitted as</p>
                <p className="mt-1 text-sm font-medium text-foreground">{fullName}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
                <p className="text-risk-medium mt-2 flex items-center gap-1.5 text-xs">
                  <Clock className="size-3.5" />
                  Pending approval
                </p>
              </div>

              <Button
                nativeButton={false}
                render={<Link href="/login?role=farmer" />}
                className="w-full"
              >
                Return to Login
                <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
              </Button>
            </div>
          </AuthCard>
        </FadeIn>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <FadeIn duration={500}>
        <AuthCard>
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <Sprout className="size-4" />
              </span>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">
                Create your Farmer account.
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your plants, assessments, risk monitoring, soil recommendations, and
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

          <div className="grid grid-cols-1 gap-4 border-border border-t pt-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <Icon className="size-4" style={{ color: "var(--landing-accent)" }} />
                <p className="mt-1.5 text-xs font-medium text-foreground">{title}</p>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </AuthCard>
      </FadeIn>
    </AuthSplitLayout>
  );
}
