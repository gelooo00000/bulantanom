"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, LoaderCircle, Mail, Shield, ShieldCheck, Sprout } from "lucide-react";
import { useEffect, useState, type ElementType, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/auth-context";

type SelectableRole = "farmer" | "lgu" | "admin";

/**
 * Only Farmer and LGU get a full card. Admin is reachable from the discreet
 * link beneath them (and still from /login?role=admin), deliberately kept as
 * a tertiary control: there is no public Admin or LGU registration anywhere
 * in the product, so promoting it would misrepresent who the page is for.
 *
 * The link is an entry point, not an authorization step — the backend still
 * rejects a non-Admin at /api/auth/admin/login/.
 */
const PUBLIC_ROLES: SelectableRole[] = ["farmer", "lgu"];

const ROLE_CARDS: {
  role: SelectableRole;
  title: string;
  description: string;
  cta: string;
  icon: ElementType;
  loginHeading: string;
  loginSupporting: string;
  submitLabel: string;
}[] = [
  {
    role: "farmer",
    title: "Farmer",
    description:
      "Manage crops, plant assessments, risk indicators, soil recommendations, and harvest information.",
    cta: "Continue as Farmer",
    icon: Sprout,
    loginHeading: "Welcome back, Farmer.",
    loginSupporting:
      "Continue monitoring your crops and making better decisions at Layuan Farm.",
    submitLabel: "Sign In",
  },
  {
    role: "lgu",
    title: "LGU Agricultural Officer",
    description:
      "Monitor farmer activity, plant health, risk assessments, and agricultural activity at Layuan Farm.",
    cta: "Continue as Officer",
    icon: Shield,
    loginHeading: "Welcome back, LGU Officer.",
    loginSupporting:
      "Monitor farmer activity, plant health, risk assessments, and agricultural data across Layuan Farm.",
    submitLabel: "Sign In",
  },
  {
    role: "admin",
    title: "Administrator",
    description: "System maintenance and account management.",
    cta: "Continue as Administrator",
    icon: ShieldCheck,
    loginHeading: "Administrator sign in.",
    loginSupporting:
      "Manage account approvals, roles, and system access for BulanTanom.",
    submitLabel: "Sign In",
  },
];

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, login } = useAuth();

  const initialRole = searchParams.get("role");
  const [selectedRole, setSelectedRole] = useState<SelectableRole | null>(
    initialRole === "farmer" || initialRole === "lgu" || initialRole === "admin"
      ? initialRole
      : null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justSignedUp = searchParams.get("signedUp") === "1";

  useEffect(() => {
    if (currentUser) {
      router.replace(DASHBOARD_BY_ROLE[currentUser.role]);
    }
  }, [currentUser, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedRole) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password, selectedRole);
      router.push(DASHBOARD_BY_ROLE[user.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (!selectedRole) {
    return (
      <AuthSplitLayout>
        <FadeIn duration={500}>
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-medium tracking-tight text-foreground">
                Welcome to BulanTanom
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how you access the agricultural intelligence platform.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {ROLE_CARDS.filter((card) => PUBLIC_ROLES.includes(card.role)).map(({ role, title, description, cta, icon: Icon }) => (
                <div
                  key={role}
                  className="liquid-glass flex flex-col items-start gap-3 rounded-2xl p-5"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border"
                    style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Button
                    className="mt-1"
                    onClick={() => setSelectedRole(role)}
                  >
                    {cta}
                    <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <ShieldCheck className="size-3.5 shrink-0" />
                Admin Login
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground/70">
              Secure access. Protected data. BulanTanom is built for Layuan Farm.
            </p>
          </div>
        </FadeIn>
      </AuthSplitLayout>
    );
  }

  const roleCard = ROLE_CARDS.find((r) => r.role === selectedRole);
  if (!roleCard) return null;

  return (
    <AuthSplitLayout>
      <FadeIn duration={500}>
        <AuthCard>
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedRole(null);
                setError(null);
              }}
              className="text-sm transition-colors hover:text-foreground"
              style={{ color: "var(--landing-accent)" }}
            >
              ← Back to role selection
            </button>
            <div className="mt-3 flex items-center gap-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <roleCard.icon className="size-4" />
              </span>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">
                {roleCard.loginHeading}
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{roleCard.loginSupporting}</p>
          </div>

          {justSignedUp && selectedRole === "farmer" && (
            <p className="text-risk-medium bg-risk-medium/10 rounded-lg px-3 py-2 text-sm">
              Registration submitted. You can sign in once an administrator
              approves your account.
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <AuthIconInput
                icon={Mail}
                id="email"
                type="email"
                required
                placeholder="you@example.com"
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

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={submitting} className="mt-1">
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  {roleCard.submitLabel}
                  <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          {selectedRole === "farmer" ? (
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium" style={{ color: "var(--landing-accent)" }}>
                Create one
              </Link>
            </p>
          ) : (
            /* Each non-Farmer role gets its own note — the Admin screen used
               to show the LGU wording, which was simply untrue there. */
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Shield className="size-3.5 shrink-0" />
              {selectedRole === "admin"
                ? "Administrator access is restricted to system accounts."
                : "LGU accounts are provisioned by system administrators."}
            </p>
          )}

        </AuthCard>
      </FadeIn>
    </AuthSplitLayout>
  );
}
