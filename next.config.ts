import type { NextConfig } from "next";

const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").origin;

// 'unsafe-inline' for scripts because every page here is prerendered, and a
// nonce needs each page rendered per request, which Render's free tier would
// feel on every visit. Styles need it for the inline style attributes that the
// charts and the landing page set throughout.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // /api/* is forwarded to Django (src/proxy.ts), whose URLs all end in "/".
  // The default redirect would strip that slash and break every API call.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Forwarded API calls may wait out a sleeping free-tier API (~75s to
    // wake) and Gemini (gunicorn allows 180s). The default gives up at 30s.
    proxyTimeout: 200_000,
  },
  images: {
    // 75 is Next's default for every image. 90 is allowed for the full-screen
    // farm photographs only, where a second lossy pass at 75 on an already
    // compressed JPEG visibly softened them.
    qualities: [75, 90],
  },
  async headers() {
    // Production only: `next dev` needs eval for its error overlay.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
