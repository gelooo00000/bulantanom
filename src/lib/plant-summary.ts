import type { BackendPlant } from "@/lib/api/plants-api";
import { englishT, type Translate } from "@/lib/i18n";

/**
 * How a plant describes itself on a card.
 *
 * Kept out of the component because the rules are all edge cases — an
 * unlabelled plant, a plant of a crop with no varieties, a plant recorded
 * today — and each one is easier to pin in a test than to eyeball in a grid.
 */

/**
 * The card's heading: the variety when the farmer named one, otherwise the
 * crop.
 *
 * Note this is deliberately NOT `plant.display_name`, which prefers the
 * farmer's label. The mockups put the label in the subtitle next to the
 * quantity and keep the heading botanical ("Lakatan", with "Banana · Plot B"
 * beneath), so a row of cards can be scanned by what is growing rather than
 * by plot names that all read alike.
 */
export function plantTitle(plant: BackendPlant): string {
  return plant.variant?.name ?? plant.crop.name;
}

/**
 * The line under the heading: what this planting is, where, and how it is
 * doing — without repeating the heading back at the farmer.
 *
 * The old subtitle was `crop.name · status`, which on an unlabelled plant
 * rendered as "Avocado · Growing" directly beneath a heading that already
 * said "Avocado". Every part here is dropped when it would be redundant or
 * is not recorded, so nothing renders as an empty separator.
 */
export function plantSubtitle(plant: BackendPlant, t: Translate = englishT): string {
  const parts: string[] = [];

  // Only when the heading showed the variety — otherwise this repeats it.
  if (plant.variant) parts.push(plant.crop.name);
  if (plant.label.trim()) parts.push(plant.label.trim());
  // A planned planting is stored as Growing, but is not in the ground yet.
  parts.push(plant.is_planned ? t("plant.planned") : plantStatusLabel(plant, t));

  return parts.join(" · ");
}

/**
 * Age in words.
 *
 * Fixes "1 days old", and treats a plant recorded on the day it went in as
 * "Planted today" rather than "0 days old", which reads like a missing value.
 */
export function plantAgeLabel(ageDays: number, t: Translate = englishT): string {
  if (ageDays <= 0) return t("age.today");
  if (ageDays === 1) return t("age.one");
  return t("age.many", { n: ageDays });
}

/** The status in the Farmer's language; Django's own label is English. */
export function plantStatusLabel(plant: BackendPlant, t: Translate = englishT): string {
  return plant.status in STATUS_KEYS ? t(STATUS_KEYS[plant.status]) : plant.status_label;
}

const STATUS_KEYS = {
  GROWING: "status.GROWING",
  READY_FOR_HARVEST: "status.READY_FOR_HARVEST",
  HARVESTED: "status.HARVESTED",
  ARCHIVED: "status.ARCHIVED",
} as const;
