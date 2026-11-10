/**
 * The Admin console's palette: a forest green base with warm gold, sky blue,
 * rose and pink accents. Each accent is a light-to-deep pair for gradients.
 */
export const PALETTE = {
  forest: ["#10b981", "#065f46"],
  gold: ["#fbbf24", "#d97706"],
  sky: ["#38bdf8", "#0369a1"],
  rose: ["#fb7185", "#e11d48"],
  pink: ["#f472b6", "#be185d"],
  violet: ["#a78bfa", "#6d28d9"],
} as const;

export type Swatch = readonly [string, string];

export const gradient = ([from, to]: Swatch, angle = 135) => `linear-gradient(${angle}deg, ${from}, ${to})`;

/** A colour at low strength, for tinted backgrounds. */
export const tint = (color: string, percent = 12) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;
