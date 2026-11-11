import type { Metadata } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

import { SPLASH_INIT_SCRIPT, SplashScreen } from "@/components/shared/splash-screen";
import { AuthProvider } from "@/lib/auth/auth-context";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme/theme-context";

// Lilita One is the system's face: the BulanTanom name, headings, buttons
// and big numbers. Nunito sets the running text, AI findings, tables, forms
// and labels: its rounded ends match Lilita's, but it is light enough to
// read at length and has real weights for bold.
const lilita = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});
const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
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
      className={`dark landing-dark ${lilita.variable} ${nunito.variable} h-full antialiased`}
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
