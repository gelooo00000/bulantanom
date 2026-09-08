export type CropCategory = "fruit" | "vegetable";

export type Crop = {
  id: string;
  name: string;
  category: CropCategory;
  growingDurationDays: number;
  harvestWindowDays: number;
  description: string;
  /** Extra local/alternate names used only for searching the picker. */
  searchTerms?: string[];
};

/**
 * Canonical BulanTanom crop catalog — the single source of truth for every
 * crop the Farmer can track. `mock-data.ts` re-exports `CROPS` from here so
 * existing imports keep working, and this file is the one place to migrate
 * when the Django/MySQL crop table lands.
 *
 * ⚠️ MOCK AGRICULTURAL DATA — `growingDurationDays` and `harvestWindowDays`
 * are indicative placeholders in the same spirit as the rest of the mock
 * data, kept only so the existing growth-stage and harvest-countdown UI has
 * something to compute from. They are NOT verified agronomic figures for
 * Layuan Farm and must be replaced by the real crop table (ideally sourced
 * from PhilRice / DA references or the farm's own records) in the backend
 * crop milestone. Do not cite them as researched values.
 */
export const CROPS: Crop[] = [
  // ---------------------------------------------------------------- Fruits
  {
    id: "starfruit",
    name: "Starfruit (Carambola)",
    category: "fruit",
    growingDurationDays: 730,
    harvestWindowDays: 90,
    description: "A tropical fruit tree that bears ridged, star-shaped fruit.",
    searchTerms: ["carambola", "balimbing"],
  },
  {
    id: "guava",
    name: "Guava",
    category: "fruit",
    growingDurationDays: 730,
    harvestWindowDays: 120,
    description: "A hardy fruit tree that tolerates a wide range of soils.",
    searchTerms: ["bayabas"],
  },
  {
    id: "passion-fruit",
    name: "Passion Fruit",
    category: "fruit",
    growingDurationDays: 365,
    harvestWindowDays: 90,
    description: "A climbing vine crop that needs trellising and steady moisture.",
  },
  {
    id: "grapes",
    name: "Grapes",
    category: "fruit",
    growingDurationDays: 730,
    harvestWindowDays: 60,
    description: "A trellised vine crop requiring pruning and good drainage.",
    searchTerms: ["ubas"],
  },
  {
    id: "cantaloupe",
    name: "Cantaloupe / Melon",
    category: "fruit",
    growingDurationDays: 85,
    harvestWindowDays: 21,
    description: "A short-season vining melon grown on warm, well-drained soil.",
    searchTerms: ["melon", "muskmelon"],
  },
  {
    id: "watermelon",
    name: "Watermelon",
    category: "fruit",
    growingDurationDays: 90,
    harvestWindowDays: 21,
    description: "A sprawling vine crop needing space, warmth, and steady water.",
    searchTerms: ["pakwan"],
  },
  {
    id: "orange-calamansi",
    name: "Orange / Calamansi",
    category: "fruit",
    growingDurationDays: 730,
    harvestWindowDays: 120,
    description: "A citrus tree valued for its long fruiting window.",
    searchTerms: ["calamansi", "citrus", "kalamansi"],
  },
  {
    id: "banana",
    name: "Banana",
    category: "fruit",
    growingDurationDays: 300,
    harvestWindowDays: 30,
    description: "A fast-establishing perennial producing fruit in bunches.",
    searchTerms: ["saging"],
  },
  {
    id: "pineapple",
    name: "Pineapple",
    category: "fruit",
    growingDurationDays: 540,
    harvestWindowDays: 30,
    description: "A drought-tolerant bromeliad grown from suckers or crowns.",
    searchTerms: ["pinya"],
  },
  {
    id: "soursop",
    name: "Soursop / Custard Apple",
    category: "fruit",
    growingDurationDays: 1095,
    harvestWindowDays: 90,
    description: "A small tropical tree bearing large, soft-fleshed fruit.",
    searchTerms: ["guyabano", "custard apple"],
  },
  {
    id: "java-plum",
    name: "Java Plum (Duhat)",
    category: "fruit",
    growingDurationDays: 1460,
    harvestWindowDays: 60,
    description: "A large tree producing dark, astringent seasonal fruit.",
    searchTerms: ["duhat", "jamun"],
  },
  {
    id: "papaya",
    name: "Papaya",
    category: "fruit",
    growingDurationDays: 270,
    harvestWindowDays: 60,
    description: "A fast-growing fruit tree suited to Layuan's warm, humid climate.",
    searchTerms: ["papaya"],
  },
  {
    id: "pomelo",
    name: "Pomelo / Grapefruit",
    category: "fruit",
    growingDurationDays: 1095,
    harvestWindowDays: 120,
    description: "A large citrus tree with thick-rinded fruit.",
    searchTerms: ["suha", "grapefruit"],
  },
  {
    id: "sapodilla",
    name: "Sapodilla (Chico)",
    category: "fruit",
    growingDurationDays: 1825,
    harvestWindowDays: 120,
    description: "A slow-growing tree bearing sweet, grainy brown fruit.",
    searchTerms: ["chico", "chiku"],
  },
  {
    id: "rambutan-lychee",
    name: "Rambutan / Lychee",
    category: "fruit",
    growingDurationDays: 1460,
    harvestWindowDays: 45,
    description: "Humid-climate trees with a short, concentrated fruiting season.",
    searchTerms: ["lychee", "litsias"],
  },
  {
    id: "sugar-apple",
    name: "Sugar Apple (Atis)",
    category: "fruit",
    growingDurationDays: 1095,
    harvestWindowDays: 60,
    description: "A compact tree bearing segmented, sweet-fleshed fruit.",
    searchTerms: ["atis", "sweetsop"],
  },
  {
    id: "jackfruit",
    name: "Jackfruit",
    category: "fruit",
    growingDurationDays: 1460,
    harvestWindowDays: 90,
    description: "A large tree producing the heaviest tree-borne fruit.",
    searchTerms: ["langka"],
  },
  {
    id: "avocado",
    name: "Avocado",
    category: "fruit",
    growingDurationDays: 1460,
    harvestWindowDays: 90,
    description: "An evergreen tree needing well-drained soil and wind shelter.",
  },
  {
    id: "cacao",
    name: "Cacao",
    category: "fruit",
    growingDurationDays: 1460,
    harvestWindowDays: 150,
    description: "A shade-tolerant understory tree grown for its pods.",
    searchTerms: ["cocoa"],
  },

  // ------------------------------------------------- Vegetables & Crops
  {
    id: "pepper",
    name: "Green Chili Pepper",
    category: "vegetable",
    growingDurationDays: 95,
    harvestWindowDays: 40,
    description: "A warm-season crop prone to pest pressure during fruiting.",
    searchTerms: ["sili", "siling berde", "pepper"],
  },
  {
    id: "tomato",
    name: "Tomato",
    category: "vegetable",
    growingDurationDays: 85,
    harvestWindowDays: 30,
    description: "A high-yield vegetable crop, sensitive to overwatering and blight.",
    searchTerms: ["kamatis"],
  },
  {
    id: "lettuce-cabbage",
    name: "Lettuce / Cabbage",
    category: "vegetable",
    growingDurationDays: 70,
    harvestWindowDays: 21,
    description: "Cool-season leafy heads best grown in the cooler months.",
    searchTerms: ["repolyo", "letsugas"],
  },
  {
    id: "eggplant",
    name: "Eggplant",
    category: "vegetable",
    growingDurationDays: 110,
    harvestWindowDays: 45,
    description: "A hardy, heat-tolerant vegetable with an extended harvest window.",
    searchTerms: ["talong"],
  },
  {
    id: "red-chili",
    name: "Red Chili Pepper",
    category: "vegetable",
    growingDurationDays: 100,
    harvestWindowDays: 45,
    description: "A hot pepper left on the plant to ripen fully red.",
    searchTerms: ["sili", "siling labuyo"],
  },
  {
    id: "mushroom",
    name: "Mushroom",
    category: "vegetable",
    growingDurationDays: 30,
    harvestWindowDays: 14,
    description: "Grown on prepared substrate in a shaded, humid environment.",
    searchTerms: ["kabute", "oyster"],
  },
  {
    id: "purple-sweet-potato",
    name: "Purple Sweet Potato (Ube)",
    category: "vegetable",
    growingDurationDays: 150,
    harvestWindowDays: 30,
    description: "A root crop grown from vine cuttings in loose, loamy soil.",
    searchTerms: ["ube", "kamote", "yam"],
  },
  {
    id: "ginger",
    name: "Ginger",
    category: "vegetable",
    growingDurationDays: 240,
    harvestWindowDays: 30,
    description: "A rhizome crop that prefers partial shade and rich soil.",
    searchTerms: ["luya"],
  },
  {
    id: "lemongrass",
    name: "Lemongrass / Leafy Greens",
    category: "vegetable",
    growingDurationDays: 120,
    harvestWindowDays: 60,
    description: "Cut-and-come-again clumping greens with repeat harvests.",
    searchTerms: ["tanglad", "greens"],
  },
  {
    id: "radish-jicama",
    name: "Radish / Jicama",
    category: "vegetable",
    growingDurationDays: 60,
    harvestWindowDays: 21,
    description: "Quick-maturing root crops grown in loose, stone-free soil.",
    searchTerms: ["labanos", "singkamas"],
  },
  {
    id: "corn",
    name: "Corn",
    category: "vegetable",
    growingDurationDays: 100,
    harvestWindowDays: 21,
    description: "A staple cereal crop planted in blocks for good pollination.",
    searchTerms: ["mais"],
  },
];

export const CROP_CATEGORY_LABEL: Record<CropCategory, string> = {
  fruit: "Fruits",
  vegetable: "Vegetables & Crops",
};

export function getCropsByCategory(category: CropCategory): Crop[] {
  return CROPS.filter((crop) => crop.category === category);
}

/**
 * Substring match across the display name and any local-name aliases, so
 * "cara" finds Starfruit (Carambola), "ube" finds Purple Sweet Potato (Ube)
 * and "duhat" finds Java Plum (Duhat).
 */
export function searchCrops(crops: Crop[], query: string): Crop[] {
  const q = query.trim().toLowerCase();
  if (!q) return crops;
  return crops.filter((crop) => {
    // Display name matches anywhere, so "cara" finds "Starfruit (Carambola)".
    if (crop.name.toLowerCase().includes(q)) return true;
    // Aliases match from the start only — otherwise "atis" would match
    // Tomato via its "kamatis" alias.
    return (crop.searchTerms ?? []).some((term) => term.toLowerCase().startsWith(q));
  });
}
