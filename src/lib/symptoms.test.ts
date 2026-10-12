import { describe, expect, it } from "vitest";

import { DISEASES, PESTS, symptomsFor, toObservationText } from "@/lib/symptoms";
import { MESSAGES } from "@/lib/i18n/messages";

describe("symptoms", () => {
  it("every pest and disease has its tick-box text", () => {
    for (const pest of PESTS) expect(MESSAGES).toHaveProperty(`sym.pest.${pest}`);
    for (const disease of DISEASES) expect(MESSAGES).toHaveProperty(`sym.disease.${disease}`);
  });

  it("gives a crop missing from the list the general problems", () => {
    expect(symptomsFor("not-a-crop").pests).toContain("aphids");
    expect(symptomsFor("mushroom").diseases).toEqual(["mold", "rot"]);
  });

  it("saves ticks and typed text as plain English", () => {
    expect(toObservationText(["aphids", "mites"], "")).toBe("Aphids; Mites");
    expect(toObservationText(["aphids"], "  kuhol  ")).toBe("Aphids; Other: kuhol");
    expect(toObservationText([], "kuhol")).toBe("kuhol");
    expect(toObservationText([], "   ")).toBe("");
  });
});
