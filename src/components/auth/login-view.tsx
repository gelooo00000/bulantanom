"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, LoaderCircle, Mail, Shield, ShieldCheck, Sprout } from "lucide-react";
import { useEffect, useRef, useState, type ElementType, type FormEvent } from "react";

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
import { cn } from "@/lib/utils";

type SelectableRole = "farmer" | "lgu" | "admin";

/**
 * The form opens straight away, signing in as a Farmer unless the link says
 * otherwise; Farmer and LGU share it through the switch at the top. Admin is
 * not on that switch: its entry point is the Admin button on the landing
 * page, which opens /login?role=admin directly. There is no public Admin or
 * LGU registration anywhere in the product, so promoting Admin here would
 * misrepresent who the page is for.
 *
 * The role is an entry point, not an authorization step — each role signs in
 * at its own endpoint and the backend rejects an account of another role.
 */
const PUBLIC_ROLES: SelectableRole[] = ["farmer", "lgu"];

const ROLE_CARDS: {
  role: SelectableRole;
  /** Short name, as shown on the role switch. */
  title: string;
  icon: ElementType;
  loginHeading: string;
  loginSupporting: string;
  submitLabel: string;
}[] = [
  {
    role: "farmer",
    title: "Farmer",
    icon: Sprout,
    loginHeading: "Welcome back, Farmer.",
    loginSupporting:
      "Continue monitoring your crops and making better decisions at Layuan Farm.",
    submitLabel: "Sign In",
  },
  {
    role: "lgu",
    title: "LGU Officer",
    icon: Shield,
    loginHeading: "Welcome back, LGU Officer.",
    loginSupporting:
      "Monitor farmer activity, plant health, risk assessments, and agricultural data across Layuan Farm.",
    submitLabel: "Sign In",
  },
  {
    role: "admin",
    title: "Administrator",
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
  const [selectedRole, setSelectedRole] = useState<SelectableRole>(
    initialRole === "lgu" || initialRole === "admin" ? initialRole : "farmer",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justSignedUp = searchParams.get("signedUp") === "1";
  // Set once a Farmer or LGU Officer signs in: the form gives way to the
  // "Preparing your dashboard..." screen, which opens the dashboard itself.
  const [preparingFor, setPreparingFor] = useState<AuthUser | null>(null);
  // True while this form is signing someone in, so the effect below does not
  // race the loading screen to the dashboard the moment the user is set.
  const signingIn = useRef(false);

  useEffect(() => {
    if (currentUser && !signingIn.current) {
      router.replace(DASHBOARD_BY_ROLE[currentUser.role]);
    }
  }, [currentUser, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // A second Enter before the first request answers must not send another.
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    signingIn.current = true;
    try {
      const user = await login(email, password, selectedRole);
      if (user.role === "admin") {
        // Admin goes straight in; the loading screen is for Farmers and Officers.
        router.push(DASHBOARD_BY_ROLE[user.role]);
      } else {
        setPreparingFor(user);
      }
    } catch (err) {
      // A failed sign-in never shows the loading screen.
      signingIn.current = false;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (preparingFor) {
    return (
      <AuthSplitLayout>
        <DashboardLoadingScreen
          destination={DASHBOARD_BY_ROLE[preparingFor.role]}
          firstName={preparingFor.firstName}
        />
      </AuthSplitLayout>
    );
  }

  const roleCard = ROLE_CARDS.find((r) => r.role === selectedRole);
  if (!roleCard) return null;

  return (
    <AuthSplitLayout busy={submitting}>
      <FadeIn duration={500}>
        <AuthCard>
          <div>
            <Link
              href="/"
              className="-my-2 inline-block py-2 text-sm transition-colors hover:text-foreground"
              style={{ color: "var(--landing-accent)" }}
            >
              ← Back to home
            </Link>

            {PUBLIC_ROLES.includes(selectedRole) && (
              <div
                role="group"
                aria-label="Sign in as"
                className="mt-3 grid grid-cols-2 gap-1 rounded-xl sm:mt-4 border border-[var(--glass-divider)] bg-[var(--glass-tile)] p-1"
              >
                {ROLE_CARDS.filter((card) => PUBLIC_ROLES.includes(card.role)).map(
                  ({ role, title, icon: Icon }) => {
                    const active = role === selectedRole;
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setSelectedRole(role);
                          setError(null);
                        }}
                        className={cn(
                          "focus-visible:ring-ring/50 font-heading flex h-9 items-center justify-center gap-2 rounded-lg text-sm tracking-wide transition-colors outline-none focus-visible:ring-3",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                        {title}
                      </button>
                    );
                  },
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2.5 sm:mt-5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border sm:size-9"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <roleCard.icon className="size-4" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {roleCard.loginHeading}
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">{roleCard.loginSupporting}</p>
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
