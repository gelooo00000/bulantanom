"use client";

import { ImageOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { refreshAccessToken } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * An <img> for an endpoint that requires the access token.
 *
 * Evidence photos are not public files. They are streamed by
 * `plants.views.AssessmentEvidenceView` only after the caller is authorized
 * against the stored Assessment, and a plain `<img src>` cannot satisfy that:
 * browsers never attach an Authorization header to an image request. The
 * previous markup pointed a bare tag at that endpoint, so every stored photo
 * silently rendered as a broken image.
 *
 * So the bytes are fetched here with the token and handed to the tag as an
 * object URL. Authorization stays exactly where it was — on the server, per
 * request — rather than being traded for a public URL.
 *
 * State is stored together with the `src` it belongs to so switching
 * assessments never shows the previous plant's photo, and so nothing is set
 * synchronously inside the effect body.
 */

type LoadState = {
  src: string;
  url: string | null;
  failed: boolean;
};

export function AuthedImage({
  src,
  alt,
  className,
  containerClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}) {
  const { accessToken } = useAuth();
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    if (!src || !accessToken) return;

    let cancelled = false;
    let created: string | null = null;

    (async () => {
      try {
        let response = await fetch(src, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        // An evidence photo is often opened well after the page loaded, so
        // this request is a likely place for an expired token to surface.
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            response = await fetch(src, {
              headers: { Authorization: `Bearer ${refreshed}` },
            });
          }
        }

        if (!response.ok) throw new Error(String(response.status));

        const blob = await response.blob();
        // Checked before creating, so a cancelled load never leaks a URL
        // that the cleanup below would no longer know about.
        if (cancelled) return;

        created = URL.createObjectURL(blob);
        setState({ src, url: created, failed: false });
      } catch {
        if (!cancelled) setState({ src, url: null, failed: true });
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, accessToken]);

  const settled = state?.src === src ? state : null;

  if (settled?.failed) {
    return (
      <div
        className={cn(
          "text-muted-foreground bg-muted flex h-40 flex-col items-center justify-center gap-2 text-xs",
          containerClassName,
        )}
      >
        <ImageOff className="size-5" />
        Evidence photo could not be loaded.
      </div>
    );
  }

  if (!settled?.url) {
    return (
      <div
        className={cn(
          "bg-muted flex h-40 items-center justify-center",
          containerClassName,
        )}
      >
        <LoaderCircle className="text-muted-foreground size-5 animate-spin" />
        <span className="sr-only">Loading evidence photo</span>
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- authorized blob URL, dimensions unknown
  return <img src={settled.url} alt={alt} className={className} />;
}
