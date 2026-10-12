import { describe, expect, it } from "vitest";

import type { BackendPlant } from "@/lib/api/plants-api";
import { cropsIn, filterPlants } from "@/lib/plant-filter";

const BANANA = { id: "banana", name: "Banana", emoji: "🍌", search_terms: ["saging"] };
const MUSHROOM = { id: "mushroom", name: "Mushroom", emoji: "🍄", search_terms: [] };

function plant(id: number, crop: object, variant: string | null): BackendPlant {
  return {
    id,
    crop,
    variant: variant ? { name: variant } : null,
    label: "",
    display_name: variant ?? "",
  } as unknown as BackendPlant;
}

const plants = [
  plant(1, BANANA, "Latundan"),
  plant(2, BANANA, "Lakatan"),
  plant(3, MUSHROOM, "Straw Mushroom"),
  plant(4, MUSHROOM, "Oyster Mushroom"),
];
const ids = (list: BackendPlant[]) => list.map((p) => p.id);

describe("filterPlants", () => {
  it("keeps everything with no search and no crop", () => {
    expect(ids(filterPlants(plants, "  ", ""))).toEqual([1, 2, 3, 4]);
  });

  it("matches the variety, ignoring case", () => {
    expect(ids(filterPlants(plants, "LATUNDAN", ""))).toEqual([1]);
  });

  it("matches the crop name and its local search terms", () => {
    expect(ids(filterPlants(plants, "banana", ""))).toEqual([1, 2]);
    expect(ids(filterPlants(plants, "saging", ""))).toEqual([1, 2]);
  });

  it("needs every word typed to match", () => {
    expect(ids(filterPlants(plants, "straw mushroom", ""))).toEqual([3]);
  });

  it("combines the search with the crop dropdown", () => {
    expect(ids(filterPlants(plants, "", "mushroom"))).toEqual([3, 4]);
    expect(ids(filterPlants(plants, "lakatan", "mushroom"))).toEqual([]);
  });
});

describe("cropsIn", () => {
  it("lists each crop once, A–Z, with its plant count", () => {
    expect(cropsIn(plants)).toEqual([
      { id: "banana", name: "Banana", emoji: "🍌", count: 2 },
      { id: "mushroom", name: "Mushroom", emoji: "🍄", count: 2 },
    ]);
  });
});
