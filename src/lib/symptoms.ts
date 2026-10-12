/**
 * The pests and disease signs offered as tick boxes on the weekly
 * assessment, per crop: the common problems of that crop in Bicol, so a
 * farmer ticks what they see instead of typing it. Anything not listed goes
 * in the "Something else" box.
 *
 * What is ticked is stored as plain English names in the assessment's
 * pest_observation / disease_observation text (toObservationText), the same
 * fields typed answers always used, so the AI evaluation, LGU pages and
 * reports read it unchanged.
 */

export const PESTS = [
  "aphids",
  "caterpillars",
  "leaf_miners",
  "mealybugs",
  "whiteflies",
  "fruit_flies",
  "borers",
  "beetles",
  "snails",
  "mites",
  "thrips",
  "gnats",
  "rats",
] as const;

export const DISEASES = [
  "leaf_spots",
  "powdery",
  "sooty",
  "rot",
  "fruit_rot",
  "wilt",
  "mosaic",
  "blight",
  "mold",
  "canker",
] as const;

export type Pest = (typeof PESTS)[number];
export type Disease = (typeof DISEASES)[number];

/** The names saved in the assessment, whatever the farmer's app language. */
const STORED_NAME: Record<Pest | Disease, string> = {
  aphids: "Aphids",
  caterpillars: "Caterpillars or worms",
  leaf_miners: "Leaf miners",
  mealybugs: "Mealybugs or scale insects",
  whiteflies: "Whiteflies",
  fruit_flies: "Fruit flies",
  borers: "Borers (holes in stem, shoot or fruit)",
  beetles: "Beetles or weevils",
  snails: "Snails or slugs",
  mites: "Mites",
  thrips: "Thrips",
  gnats: "Small flies or gnats",
  rats: "Rats or other animals",
  leaf_spots: "Spots on leaves",
  powdery: "White powder on leaves",
  sooty: "Black sooty coating",
  rot: "Rotting stem, root or base",
  fruit_rot: "Rotting fruit",
  wilt: "Wilting even when watered",
  mosaic: "Mottled, curled or shrunken leaves",
  blight: "Brown, dying leaf edges or patches",
  mold: "Mold or fungus growing",
  canker: "Cracks or sores on bark or stem",
};

type CropSymptoms = { pests: Pest[]; diseases: Disease[] };

/** For a crop missing below: problems most plants can get. */
const GENERAL: CropSymptoms = {
  pests: ["aphids", "caterpillars", "mealybugs", "beetles", "snails"],
  diseases: ["leaf_spots", "rot", "wilt", "blight"],
};

const BY_CROP: Record<string, CropSymptoms> = {
  avocado: {
    pests: ["mealybugs", "borers", "thrips", "beetles"],
    diseases: ["rot", "fruit_rot", "leaf_spots", "canker"],
  },
  banana: {
    pests: ["beetles", "aphids", "caterpillars", "thrips"],
    diseases: ["wilt", "leaf_spots", "mosaic", "rot"],
  },
  cacao: {
    pests: ["borers", "mealybugs", "beetles", "rats"],
    diseases: ["fruit_rot", "canker", "wilt", "leaf_spots"],
  },
  cantaloupe: {
    pests: ["aphids", "beetles", "fruit_flies", "whiteflies", "mites"],
    diseases: ["powdery", "mosaic", "wilt", "fruit_rot", "leaf_spots"],
  },
  grapes: {
    pests: ["mealybugs", "thrips", "beetles", "caterpillars", "mites"],
    diseases: ["powdery", "mold", "fruit_rot", "leaf_spots"],
  },
  guava: {
    pests: ["fruit_flies", "mealybugs", "whiteflies", "caterpillars"],
    diseases: ["fruit_rot", "wilt", "leaf_spots", "sooty"],
  },
  jackfruit: {
    pests: ["fruit_flies", "borers", "mealybugs"],
    diseases: ["fruit_rot", "rot", "leaf_spots"],
  },
  "java-plum": {
    pests: ["fruit_flies", "caterpillars", "mealybugs"],
    diseases: ["leaf_spots", "fruit_rot", "sooty"],
  },
  "orange-calamansi": {
    pests: ["aphids", "leaf_miners", "mealybugs", "mites", "fruit_flies"],
    diseases: ["canker", "sooty", "leaf_spots", "rot", "mosaic"],
  },
  papaya: {
    pests: ["mealybugs", "aphids", "mites", "fruit_flies", "whiteflies"],
    diseases: ["mosaic", "rot", "fruit_rot", "powdery"],
  },
  "passion-fruit": {
    pests: ["fruit_flies", "aphids", "mites", "snails"],
    diseases: ["mosaic", "wilt", "fruit_rot", "leaf_spots"],
  },
  pineapple: {
    pests: ["mealybugs", "beetles", "rats"],
    diseases: ["rot", "wilt", "fruit_rot"],
  },
  pomelo: {
    pests: ["leaf_miners", "aphids", "mealybugs", "fruit_flies", "mites"],
    diseases: ["canker", "sooty", "rot", "leaf_spots"],
  },
  "rambutan-lychee": {
    pests: ["mealybugs", "borers", "fruit_flies", "caterpillars"],
    diseases: ["fruit_rot", "powdery", "leaf_spots", "sooty"],
  },
  sapodilla: {
    pests: ["fruit_flies", "mealybugs", "caterpillars"],
    diseases: ["sooty", "leaf_spots", "fruit_rot"],
  },
  soursop: {
    pests: ["mealybugs", "borers", "fruit_flies"],
    diseases: ["fruit_rot", "leaf_spots", "sooty"],
  },
  starfruit: {
    pests: ["fruit_flies", "mealybugs", "caterpillars"],
    diseases: ["leaf_spots", "sooty", "fruit_rot"],
  },
  "sugar-apple": {
    pests: ["mealybugs", "borers", "fruit_flies"],
    diseases: ["fruit_rot", "leaf_spots", "sooty"],
  },
  watermelon: {
    pests: ["aphids", "beetles", "fruit_flies", "whiteflies", "thrips"],
    diseases: ["powdery", "wilt", "mosaic", "fruit_rot", "leaf_spots"],
  },
  corn: {
    pests: ["borers", "caterpillars", "aphids", "rats"],
    diseases: ["leaf_spots", "mold", "rot", "blight"],
  },
  eggplant: {
    pests: ["borers", "whiteflies", "aphids", "beetles", "mites"],
    diseases: ["wilt", "fruit_rot", "leaf_spots", "mosaic"],
  },
  ginger: {
    pests: ["borers", "caterpillars", "beetles"],
    diseases: ["rot", "wilt", "leaf_spots"],
  },
  lemongrass: {
    pests: ["aphids", "caterpillars", "snails"],
    diseases: ["leaf_spots", "blight", "rot"],
  },
  "lettuce-cabbage": {
    pests: ["caterpillars", "aphids", "snails", "beetles"],
    diseases: ["rot", "leaf_spots", "mold", "blight"],
  },
  mushroom: {
    pests: ["gnats", "mites", "snails", "rats"],
    diseases: ["mold", "rot"],
  },
  pepper: {
    pests: ["aphids", "thrips", "mites", "whiteflies", "fruit_flies"],
    diseases: ["mosaic", "fruit_rot", "wilt", "leaf_spots"],
  },
  "red-chili": {
    pests: ["aphids", "thrips", "mites", "whiteflies", "fruit_flies"],
    diseases: ["mosaic", "fruit_rot", "wilt", "leaf_spots"],
  },
  "purple-sweet-potato": {
    pests: ["beetles", "caterpillars", "rats"],
    diseases: ["rot", "mosaic", "leaf_spots"],
  },
  "radish-jicama": {
    pests: ["caterpillars", "aphids", "beetles", "snails"],
    diseases: ["rot", "leaf_spots", "mold"],
  },
  tomato: {
    pests: ["whiteflies", "caterpillars", "aphids", "mites", "leaf_miners"],
    diseases: ["blight", "wilt", "mosaic", "leaf_spots", "fruit_rot"],
  },
};

export function symptomsFor(cropId: string): CropSymptoms {
  return BY_CROP[cropId] ?? GENERAL;
}

/**
 * The text saved for one list: the ticked names, then anything typed.
 * Empty when nothing was ticked or typed, which reads as "none observed".
 */
export function toObservationText(ticked: Iterable<Pest | Disease>, other: string): string {
  const names = [...ticked].map((id) => STORED_NAME[id]);
  const typed = other.trim();
  if (typed) names.push(names.length ? `Other: ${typed}` : typed);
  return names.join("; ");
}
