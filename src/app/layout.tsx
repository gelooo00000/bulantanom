import type { Metadata } from "next";
import { Fredoka, Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/auth/auth-context";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme/theme-context";

// Lilita One is the brand face: the BulanTanom name, the landing page and the
// sign-in screens. Inside the Farmer, LGU and Admin apps, headings, buttons,
// navigation and big numbers use Fredoka — the same rounded shapes, but with
// real weights, so a dense dashboard keeps a clear hierarchy instead of
// shouting in one heavy weight. Running text everywhere is Nunito, a rounded
// sans that keeps forms, tables and AI results easy to read.
const lilita = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
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
      className={`dark landing-dark ${lilita.variable} ${fredoka.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint so a saved Light Mode never flashes dark first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
