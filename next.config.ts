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
