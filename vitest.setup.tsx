import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Each test starts from an empty document rather than inheriting the last
// one's DOM, which otherwise makes getAllBy* counts quietly wrong.
afterEach(() => {
  cleanup();
});

/**
 * `next/image` optimises through the Next server, which does not exist under
 * jsdom. Rendering a plain <img> keeps src and alt assertable - which is the
 * only part of it a component test has any business checking.
 */
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => {
    // `fill`, `priority` and `sizes` are Next-only props; passing them to a
    // real <img> would only produce React unknown-prop warnings.
    const { fill: _fill, priority: _priority, sizes: _sizes, ...safe } = rest;
    void _fill;
    void _priority;
    void _sizes;
    // A plain <img> is the entire point of this mock: next/image is what is
    // being replaced, so the lint rule steering back to it does not apply.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...safe} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
