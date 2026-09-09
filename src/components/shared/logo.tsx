import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The Layuan Nature Integrated Farm mark.
 *
 * One component rather than a copy per surface: the brand mark previously
 * lived inline in both the role shell and the auth layout, which is how two
 * copies of the same thing drift apart.
 *
 * The asset is a square JPEG wordmark on a white background, so it is placed
 * on a white tile rather than a themed one - a transparent-looking treatment
 * would just render as a white block sitting awkwardly on the dark surface.
 * The tile keeps it deliberate in both themes, and the ring gives it an edge
 * in Light Mode where white-on-near-white would otherwise float.
 *
 * `object-contain` on a square box showing a square image means the whole
 * mark is always visible at its true aspect ratio - never cropped, never
 * stretched.
 */
export function Logo({
  className,
  /** Rendered pixel size; drives the `sizes` hint so Next serves a small file. */
  px = 32,
}: {
  className?: string;
  px?: number;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/10",
        className,
      )}
    >
      <Image
        src="/layuan.jpg"
        alt="Layuan Nature Integrated Farm"
        fill
        // A 2048px source for a ~32px box: without this Next would ship a far
        // larger file than the slot can ever show.
        sizes={`${px}px`}
        className="object-contain p-0.5"
        priority
      />
    </span>
  );
}
