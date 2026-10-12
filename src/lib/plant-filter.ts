import type { BackendPlant } from "@/lib/api/plants-api";

/** Every word typed must appear in the plant's names or its crop's search terms. */
export function matchesQuery(plant: BackendPlant, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    plant.variant?.name,
    plant.crop.name,
    plant.label,
    plant.display_name,
    ...(plant.crop.search_terms ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export type CropOption = { id: string; name: string; emoji: string; count: number };

/** The crops the farmer actually grows, A–Z, with how many plants of each. */
export function cropsIn(plants: BackendPlant[]): CropOption[] {
  const byId = new Map<string, CropOption>();
  for (const p of plants) {
    const entry = byId.get(p.crop.id);
    if (entry) entry.count += 1;
    else byId.set(p.crop.id, { id: p.crop.id, name: p.crop.name, emoji: p.crop.emoji, count: 1 });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Plants that pass both the crop dropdown ("" = all) and the search box. */
export function filterPlants(plants: BackendPlant[], query: string, cropId: string): BackendPlant[] {
  return plants.filter((p) => (!cropId || p.crop.id === cropId) && matchesQuery(p, query));
}
