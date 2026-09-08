import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/auth/auth-context";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme/theme-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
      className={`dark landing-dark ${inter.variable} h-full antialiased`}
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
