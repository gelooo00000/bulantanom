import type { Metadata } from "next";
import { Lilita_One } from "next/font/google";
import "./globals.css";

import { SPLASH_INIT_SCRIPT, SplashScreen } from "@/components/shared/splash-screen";
import { AuthProvider } from "@/lib/auth/auth-context";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme/theme-context";

// Lilita One is the one face of the whole system: the BulanTanom name,
// headings, buttons, navigation, numbers and running text.
const lilita = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "BulanTanom",
  description:
    "AI-powered plant risk monitoring for farmers and agricultural officers at Layuan Nature Integrated Farm.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme classes live on <html> so portalled UI (Select / Menu / Popover
    // popups, which Base UI renders into document.body) inherits them too.
    // They are applied by THEME_INIT_SCRIPT below before first paint and
    // thereafter by ThemeProvider — `dark landing-dark` is the default, so
    // this markup starts in the same state the script will confirm.
    <html
      lang="en"
      className={`dark landing-dark ${lilita.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint so a saved Light Mode never flashes dark first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Hides the splash at once if this visit already saw it. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SplashScreen />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
