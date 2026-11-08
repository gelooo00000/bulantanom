import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves the Django API from this site's own address: /api/* is forwarded to
 * the backend.
 *
 * On Render the frontend and the API have different *.onrender.com hosts, and
 * onrender.com is a public suffix, so the browser treats them as two sites.
 * The sign-in cookies were then third-party cookies, which iPhone Safari
 * blocks outright: farmers were signed out on every reload. Same address,
 * first-party cookies.
 *
 * Forwarding hides the visitor's address behind this server's, and the API's
 * per-address sign-in limits need the real one. It travels in
 * X-BulanTanom-Client-IP, which the API believes only alongside the shared
 * API_PROXY_SECRET (backend accounts.throttles.client_ip).
 */

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").origin;

const CLIENT_IP_HEADER = "x-bulantanom-client-ip";
const PROXY_SECRET_HEADER = "x-bulantanom-proxy-secret";

function visitorAddress(request: NextRequest): string {
  // Render's edge is Cloudflare, which sets this itself.
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = new URL(`${pathname}${search}`, API_ORIGIN);

  const headers = new Headers(request.headers);
  // Render routes by Host: keeping this site's would send the request back here.
  headers.delete("host");
  // Never pass on a visitor's own copy of these.
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  const secret = process.env.API_PROXY_SECRET;
  const address = visitorAddress(request);
  if (secret && address) {
    headers.set(CLIENT_IP_HEADER, address);
    headers.set(PROXY_SECRET_HEADER, secret);
  }

  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
