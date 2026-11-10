"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, LoaderCircle, Mail, Shield, ShieldCheck, Sprout } from "lucide-react";
import { useEffect, useRef, useState, type ElementType, type FormEvent } from "react";

import { AUTH_GOLD_BUTTON, AuthCard } from "@/components/auth/auth-card";
import { AUTH_BUTTON_CLASSES, AuthIconInput, AuthPasswordField } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { DashboardLoadingScreen } from "@/components/auth/dashboard-loading-screen";
import { VerifyEmailStep } from "@/components/auth/verify-email-step";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DASHBOARD_BY_ROLE } from "@/lib/auth/constants";
import { EmailNotVerifiedError, NewDeviceError, useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";
import { INK, PALETTE, gradient, tint, type Swatch } from "@/components/admin/palette";
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
  /** Gold line above the heading in the banner. */
  eyebrow: string;
  swatch: Swatch;
  ink: string;
  loginHeading: string;
  /** A line under the heading; left out where the heading says enough. */
  loginSupporting?: string;
  submitLabel: string;
}[] = [
  {
    role: "farmer",
    title: "Farmer",
    icon: Sprout,
    eyebrow: "Farmer sign in",
    swatch: PALETTE.forest,
    ink: INK.forest,
    loginHeading: "Welcome back, Farmer.",
    submitLabel: "Sign In",
  },
  {
    role: "lgu",
    title: "LGU Officer",
    icon: Shield,
    eyebrow: "LGU Officer sign in",
    swatch: PALETTE.gold,
    ink: INK.gold,
    loginHeading: "Welcome back, LGU Officer.",
    submitLabel: "Sign In",
  },
  {
    role: "admin",
    title: "Administrator",
    icon: ShieldCheck,
    eyebrow: "Administrator",
    swatch: PALETTE.violet,
    ink: INK.violet,
    loginHeading: "Administrator sign in.",
    loginSupporting:
      "Manage account approvals, roles, and system access for BulanTanom.",
    submitLabel: "Sign In",
  },
];

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, login, verifyLogin, resendLoginCode } = useAuth();

  const initialRole = searchParams.get("role");
  const [selectedRole, setSelectedRole] = useState<SelectableRole>(
    initialRole === "lgu" || initialRole === "admin" ? initialRole : "farmer",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justReset = searchParams.get("reset") === "1";
  // Set once a Farmer or LGU Officer signs in: the form gives way to the
  // "Preparing your dashboard..." screen, which opens the dashboard itself.
  const [preparingFor, setPreparingFor] = useState<AuthUser | null>(null);
  // A Farmer who never typed their sign-up code: the right password got a
  // fresh code emailed, and the form gives way to "Enter the code".
  const [unverified, setUnverified] = useState<EmailNotVerifiedError | null>(null);
  // A correct password on a device this account has not used: a code went
  // to the account's email and the form gives way to "Is this you?".
  const [newDevice, setNewDevice] = useState<NewDeviceError | null>(null);
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
      enterDashboard(await login(email, password, selectedRole));
    } catch (err) {
      // A failed sign-in never shows the loading screen.
      signingIn.current = false;
      if (err instanceof EmailNotVerifiedError) {
        // Still signing in, through the code step: keep the loading screen
        // ahead of the redirect once the code is accepted.
        signingIn.current = true;
        setUnverified(err);
      } else if (err instanceof NewDeviceError) {
        signingIn.current = true;
        setNewDevice(err);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setSubmitting(false);
    }
  }

  function enterDashboard(user: AuthUser) {
    if (user.role === "admin") {
      // Admin goes straight in; the loading screen is for Farmers and Officers.
      router.push(DASHBOARD_BY_ROLE[user.role]);
    } else {
      setPreparingFor(user);
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

  if (unverified) {
    return (
      <AuthSplitLayout>
        <VerifyEmailStep
          email={unverified.email}
          resendAfter={unverified.resendAfter}
          onVerified={setPreparingFor}
          onBack={() => {
            signingIn.current = false;
            setUnverified(null);
          }}
          backLabel="Back to sign in"
        />
      </AuthSplitLayout>
    );
  }

  if (newDevice) {
    return (
      <AuthSplitLayout>
        <VerifyEmailStep
          email={newDevice.email}
          resendAfter={newDevice.resendAfter}
          heading="Is this you?"
          intro={
            <>
              This is the first time you are signing in on this device, so we sent a 6-digit
              code to <strong className="font-medium text-foreground break-all">{newDevice.email}</strong>.
              Enter it below. This device will not ask again for 30 days.
            </>
          }
          verify={(code) => verifyLogin(newDevice.email, newDevice.challenge, code)}
          resend={() => resendLoginCode(newDevice.email, newDevice.challenge)}
          onVerified={enterDashboard}
          onBack={() => {
            signingIn.current = false;
            setNewDevice(null);
            setPassword("");
          }}
          backLabel="Back to sign in"
        />
      </AuthSplitLayout>
    );
  }

  const roleCard = ROLE_CARDS.find((r) => r.role === selectedRole);
  if (!roleCard) return null;

  return (
    <AuthSplitLayout busy={submitting}>
      <FadeIn duration={500}>
        <AuthCard
          header={{
            icon: roleCard.icon,
            eyebrow: roleCard.eyebrow,
            title: roleCard.loginHeading,
            description: roleCard.loginSupporting,
            top: (
              <Link
                href="/"
                className="-my-2 inline-block py-2 text-sm text-white/80 transition-colors hover:text-white"
              >
                ← Back to home
              </Link>
            ),
          }}
        >
          {PUBLIC_ROLES.includes(selectedRole) && (
            <div role="group" aria-label="Sign in as" className="grid grid-cols-2 gap-2">
              {ROLE_CARDS.filter((card) => PUBLIC_ROLES.includes(card.role)).map(
                ({ role, title, icon: Icon, swatch, ink }) => {
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
                        "focus-visible:ring-ring/50 font-heading flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold tracking-wide transition-all outline-none focus-visible:ring-3",
                        active
                          ? "border-transparent text-white shadow-[0_10px_22px_-10px_var(--role)]"
                          : "border-[var(--glass-divider)] bg-[var(--glass-tile)] text-muted-foreground hover:text-foreground",
                      )}
                      style={
                        {
                          "--role": swatch[1],
                          ...(active ? { backgroundImage: gradient(swatch) } : {}),
                        } as React.CSSProperties
                      }
                    >
                      <Icon className="size-4" style={active ? undefined : { color: ink }} />
                      {title}
                    </button>
                  );
                },
              )}
            </div>
          )}

          {justReset && (
            <p className="text-risk-low bg-risk-low/10 rounded-xl px-3 py-2 text-sm" role="status">
              Your password has been changed. Please sign in.
            </p>
          )}

          {/* The phone's password manager may save and fill these: farmers
              type less, and can keep a stronger password than they would
              type by hand every time. */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <AuthIconInput
                icon={Mail}
                id="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                {selectedRole === "farmer" && (
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium"
                    style={{ color: "var(--landing-accent)" }}
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <AuthPasswordField
                icon={Lock}
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className={cn(AUTH_BUTTON_CLASSES, AUTH_GOLD_BUTTON.className, "mt-1")}
              style={AUTH_GOLD_BUTTON.style}
            >
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
            <p
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-xs text-muted-foreground"
              style={{ backgroundColor: tint(roleCard.ink, 10) }}
            >
              <Shield className="size-3.5 shrink-0" style={{ color: roleCard.ink }} />
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
