/**
 * A colour for each crop in the catalogue, taken from what the crop looks
 * like (ginger brown, eggplant purple, banana yellow), used to outline a
 * plant's card when it is pointed at or tapped. Keyed by the catalogue name
 * from the crop seed migration; a crop added later without an entry falls
 * back to the app's primary colour.
 */
const CROP_COLORS: Record<string, string> = {
  Avocado: "#6b8e23",
  Banana: "#e0b000",
  Cacao: "#7b4a2a",
  "Cantaloupe / Melon": "#f0a050",
  Corn: "#e8c33a",
  Eggplant: "#6b3fa0",
  Ginger: "#a0703c",
  Grapes: "#7d3c98",
  "Green Chili Pepper": "#3fa34d",
  Guava: "#8cc152",
  Jackfruit: "#c9a227",
  "Java Plum (Duhat)": "#4b2c6b",
  "Lemongrass / Leafy Greens": "#7cb342",
  "Lettuce / Cabbage": "#66bb6a",
  Mushroom: "#a1887f",
  "Orange / Calamansi": "#f39c12",
  Papaya: "#f57c00",
  "Passion Fruit": "#6a1b9a",
  Pineapple: "#f4b400",
  "Pomelo / Grapefruit": "#c5b829",
  "Purple Sweet Potato (Ube)": "#7e57c2",
  "Radish / Jicama": "#c9a27a",
  "Rambutan / Lychee": "#d32f2f",
  "Red Chili Pepper": "#e53935",
  "Sapodilla (Chico)": "#8d6e63",
  "Soursop / Custard Apple": "#43a047",
  "Starfruit (Carambola)": "#fbc02d",
  "Sugar Apple (Atis)": "#9ccc65",
  Tomato: "#e53935",
  Watermelon: "#e8505b",
};

export function cropColor(cropName: string): string {
  return CROP_COLORS[cropName] ?? "var(--primary)";
}

/** The crop's colour at low strength, for the chip behind its emoji. */
export function cropTint(cropName: string, percent = 18): string {
  return `color-mix(in oklab, ${cropColor(cropName)} ${percent}%, transparent)`;
}

/**
 * Classes that outline a card in its crop's colour while pointed at,
 * pressed, or focused (a tap on a phone, where there is no hover). Pair
 * with `cropVar` on the same element, and make it focusable.
 */
export const CROP_OUTLINE =
  "outline-none hover:border-(--crop) hover:ring-3 hover:ring-(--crop)/25 focus:border-(--crop) focus:ring-3 focus:ring-(--crop)/25 active:border-(--crop) active:ring-3 active:ring-(--crop)/25";

/**
 * The same light outline for a card that is not one crop's (a chart, a
 * report): on hover it lights up in the app's primary colour, or in the
 * crop's colour when `cropVar` is set on the element.
 */
export const CARD_OUTLINE =
  "transition-[border-color,box-shadow] [--crop:var(--primary)] hover:border-(--crop) hover:ring-3 hover:ring-(--crop)/25";

/** Sets `--crop` for CROP_OUTLINE and other `(--crop)` classes. */
export function cropVar(cropName: string): React.CSSProperties {
  return { "--crop": cropColor(cropName) } as React.CSSProperties;
}
