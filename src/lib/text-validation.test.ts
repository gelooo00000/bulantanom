import { describe, expect, it } from "vitest";

import { nameProblem, notesProblem } from "@/lib/text-validation";

describe("nameProblem", () => {
  it("accepts real names", () => {
    for (const name of ["Juan", "Ma. Luisa", "Dela Cruz", "O'Neil", "Peña", "Jean-Paul"]) {
      expect(nameProblem(name, "Name"), name).toBeNull();
    }
  });

  it("refuses numbers, symbols, single letters and mashes", () => {
    for (const name of ["", "J", "Juan2", "123", "!!!", "<b>Juan</b>", "Aaaaaa", "x".repeat(51)]) {
      expect(nameProblem(name, "Name"), name).not.toBeNull();
    }
    expect(nameProblem("", "Last name", { required: false })).toBeNull();
  });
});

describe("notesProblem", () => {
  it("accepts plain notes in any language, and an empty one", () => {
    for (const text of [
      "",
      "The soil dries quickly after two sunny days.",
      "Mabilis matuyo ang lupa, 3 araw lang.",
      "Madali mamara an daga.",
    ]) {
      expect(notesProblem(text, "Notes", 1000), text).toBeNull();
    }
  });

  it("refuses notes that are not words", () => {
    for (const text of [
      "12345",
      "!!!???",
      "aaaaaaaaa",
      "qwrtplkjh",
      "see https://example.com",
      "visit www.spam.ph",
      "<script>alert(1)</script>",
      "x".repeat(1001),
    ]) {
      expect(notesProblem(text, "Notes", 1000), text).not.toBeNull();
    }
  });
});
