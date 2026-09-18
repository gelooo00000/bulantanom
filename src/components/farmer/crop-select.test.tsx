import { describe, expect, it } from "vitest";

import { matchedVariant, matches } from "@/components/farmer/crop-select";
import type { BackendCrop } from "@/lib/api/plants-api";

/**
 * A farmer searches for what they planted, not its botanical parent. Before
 * varieties were searchable, 58 of the 74 names in the catalog returned
 * nothing at all — "Lakatan" and "Sweet Corn" were each a dead end despite
 * both being in the database. These pin that they are reachable.
 */

function crop(over: Partial<BackendCrop> & Pick<BackendCrop, "id" | "name">): BackendCrop {
  return {
    category: "vegetable",
    category_label: "Vegetables & Crops",
    emoji: "🌱",
    growing_duration_days: 100,
    harvest_window_days: 30,
    description: "",
    search_terms: [],
    variants: [],
    planting_window: null,
    ...over,
  } as BackendCrop;
}

const CROPS: BackendCrop[] = [
  crop({
    id: "corn",
    name: "Corn",
    emoji: "🌽",
    search_terms: ["mais"],
    variants: [
      {
        id: "corn-sweet",
        name: "Sweet Corn",
        description: "",
        growing_duration_days: 75,
        harvest_window_days: 14,
        search_terms: ["sweet corn"],
      },
    ],
  }),
  crop({
    id: "banana",
    name: "Banana",
    category: "fruit",
    category_label: "Fruit",
    emoji: "🍌",
    search_terms: ["saging"],
    variants: [
      {
        id: "banana-lakatan",
        name: "Lakatan",
        description: "",
        growing_duration_days: 400,
        harvest_window_days: 30,
        search_terms: ["lakatan"],
      },
    ],
  }),
  crop({ id: "tomato", name: "Tomato", emoji: "🍅", search_terms: ["kamatis"] }),
];


const find = (query: string) => CROPS.filter((c) => matches(c, query));

describe("crop picker search", () => {
  it("finds a crop by a variety name", () => {
    const hits = find("lakatan");
    expect(hits.map((c) => c.id)).toEqual(["banana"]);
  });

  it("names which variety matched, so the result is not a mystery", () => {
    const banana = CROPS.find((c) => c.id === "banana")!;
    expect(matchedVariant(banana, "lakatan")?.name).toBe("Lakatan");
  });

  it("finds a variety whose name spans two words", () => {
    expect(find("sweet corn").map((c) => c.id)).toEqual(["corn"]);
  });

  it("matches a variety on a partial name", () => {
    expect(find("laka").map((c) => c.id)).toEqual(["banana"]);
  });

  it("still finds crops by their own name", () => {
    expect(find("tomato").map((c) => c.id)).toEqual(["tomato"]);
  });

  it("still finds crops by a local alias", () => {
    expect(find("kamatis").map((c) => c.id)).toEqual(["tomato"]);
  });

  it("does not attribute a variety the farmer did not search for", () => {
    const corn = CROPS.find((c) => c.id === "corn")!;
    // "corn" hit the crop's own name, so no variety should be credited.
    expect(matchedVariant(corn, "mais")).toBeNull();
  });

  it("returns nothing for a query that matches neither", () => {
    expect(find("zzzz")).toEqual([]);
  });

  it("treats an empty query as everything", () => {
    expect(find("")).toHaveLength(CROPS.length);
    expect(matchedVariant(CROPS[0], "")).toBeNull();
  });
});
