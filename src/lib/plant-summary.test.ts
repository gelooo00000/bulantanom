import { describe, expect, it } from "vitest";

import type { BackendPlant } from "@/lib/api/plants-api";
import { plantAgeLabel, plantSubtitle, plantTitle } from "@/lib/plant-summary";

function plant(over: Partial<BackendPlant> = {}): BackendPlant {
  return {
    id: 1,
    crop: { id: "avocado", name: "Avocado", emoji: "🥑" },
    variant: null,
    label: "",
    display_name: "Avocado",
    status_label: "Growing",
    age_days: 4,
    ...over,
  } as unknown as BackendPlant;
}

describe("plantTitle", () => {
  it("uses the crop when there is no variety", () => {
    expect(plantTitle(plant())).toBe("Avocado");
  });

  it("uses the variety when the farmer named one", () => {
    expect(
      plantTitle(
        plant({
          crop: { id: "banana", name: "Banana", emoji: "🍌" } as BackendPlant["crop"],
          variant: { id: "lakatan", name: "Lakatan" } as BackendPlant["variant"],
        }),
      ),
    ).toBe("Lakatan");
  });
});

describe("plantSubtitle", () => {
  it("does not repeat the crop name back under the heading", () => {
    // This was the bug: "Avocado" above, "Avocado · Growing" directly below.
    expect(plantSubtitle(plant())).toBe("Growing");
  });

  it("names the crop when the heading showed the variety", () => {
    const p = plant({
      crop: { id: "banana", name: "Banana", emoji: "🍌" } as BackendPlant["crop"],
      variant: { id: "lakatan", name: "Lakatan" } as BackendPlant["variant"],
      label: "Plot B",
    });
    expect(plantTitle(p)).toBe("Lakatan");
    expect(plantSubtitle(p)).toBe("Banana · Plot B · Growing");
  });

  it("includes the plot when one is recorded", () => {
    expect(plantSubtitle(plant({ label: "Plot A" }))).toBe("Plot A · Growing");
  });

  it("omits a blank plot rather than leaving a dangling separator", () => {
    expect(plantSubtitle(plant({ label: "   " }))).toBe("Growing");
    expect(plantSubtitle(plant({ label: "" }))).not.toContain("·");
  });

  it("carries the real status through, not a hardcoded one", () => {
    expect(plantSubtitle(plant({ status_label: "Ready for harvest" }))).toBe(
      "Ready for harvest",
    );
  });
});

describe("plantAgeLabel", () => {
  it("says 1 day, not 1 days", () => {
    expect(plantAgeLabel(1)).toBe("1 day old");
  });

  it("pluralises everything else", () => {
    expect(plantAgeLabel(4)).toBe("4 days old");
    expect(plantAgeLabel(200)).toBe("200 days old");
  });

  it("reads a same-day planting as planted today, not 0 days old", () => {
    expect(plantAgeLabel(0)).toBe("Planted today");
  });

  it("never renders a negative age", () => {
    // The API clamps at 0, but a clock skew should not produce "-1 days old".
    expect(plantAgeLabel(-3)).toBe("Planted today");
  });
});
