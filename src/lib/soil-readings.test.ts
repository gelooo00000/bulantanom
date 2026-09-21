import { describe, expect, it } from "vitest";

import { SENSOR_FIELDS, validateReading } from "@/lib/soil-options";

/**
 * The device's ranges, pinned on the client side.
 *
 * Django enforces these too and is the authority; this check exists so a
 * mistyped reading is caught beside the field that caused it rather than
 * after a round trip. That makes the two copies worth keeping in step, and
 * the first test below is what notices if they drift.
 */

const byKey = Object.fromEntries(SENSOR_FIELDS.map((f) => [f.key, f]));

describe("sensor field definitions", () => {
  it("covers exactly the eight readings the detector reports", () => {
    expect(SENSOR_FIELDS.map((f) => f.key)).toEqual([
      "soil_temperature",
      "soil_moisture",
      "soil_conductivity",
      "soil_ph",
      "nitrogen",
      "phosphorus",
      "potassium",
      "soil_fertility",
    ]);
  });

  it("matches the device ranges the backend validates against", () => {
    const expected: Record<string, [number, number]> = {
      soil_temperature: [-40, 80],
      soil_moisture: [0, 100],
      soil_conductivity: [0, 20000],
      soil_ph: [3, 10],
      nitrogen: [1, 1999],
      phosphorus: [1, 1999],
      potassium: [1, 1999],
      soil_fertility: [0, 3000],
    };
    for (const field of SENSOR_FIELDS) {
      expect([field.min, field.max]).toEqual(expected[field.key]);
    }
  });

  it("gives every reading a unit to render beside the input", () => {
    for (const field of SENSOR_FIELDS) {
      expect(field.unit.length).toBeGreaterThan(0);
    }
    expect(byKey.soil_temperature.unit).toBe("°C");
    expect(byKey.soil_conductivity.unit).toBe("µS/cm");
    expect(byKey.nitrogen.unit).toBe("mg/kg");
  });

  it("allows decimals where the sensor reports them", () => {
    expect(byKey.soil_temperature.step).toBeLessThan(1);
    expect(byKey.soil_ph.step).toBeLessThan(1);
    // Whole numbers for the mg/kg readings.
    expect(byKey.nitrogen.step).toBe(1);
  });
});

describe("validateReading", () => {
  it("accepts a reading inside the range", () => {
    expect(validateReading(byKey.soil_ph, "6.5")).toBeNull();
    expect(validateReading(byKey.soil_temperature, "28.5")).toBeNull();
    expect(validateReading(byKey.nitrogen, "120")).toBeNull();
  });

  it("accepts the exact bounds", () => {
    expect(validateReading(byKey.soil_moisture, "0")).toBeNull();
    expect(validateReading(byKey.soil_moisture, "100")).toBeNull();
    expect(validateReading(byKey.soil_ph, "3")).toBeNull();
    expect(validateReading(byKey.soil_ph, "10")).toBeNull();
  });

  it("rejects readings above the sensor's range", () => {
    expect(validateReading(byKey.soil_moisture, "101")).toMatch(/between 0 and 100/);
    expect(validateReading(byKey.soil_conductivity, "20001")).toMatch(/20000/);
    expect(validateReading(byKey.nitrogen, "2000")).toMatch(/1999/);
    expect(validateReading(byKey.soil_fertility, "3001")).toMatch(/3000/);
  });

  it("rejects readings below the sensor's range", () => {
    expect(validateReading(byKey.soil_ph, "2.9")).toMatch(/between 3 and 10/);
    expect(validateReading(byKey.soil_temperature, "-41")).toMatch(/-40/);
    expect(validateReading(byKey.nitrogen, "0")).toMatch(/between 1 and 1999/);
  });

  it("accepts a negative temperature, which is in range", () => {
    // The only reading that legitimately goes below zero.
    expect(validateReading(byKey.soil_temperature, "-10")).toBeNull();
  });

  it("treats an empty field as missing, not out of range", () => {
    // The detector gives a value for every field, so blank means unfinished
    // rather than a farmer declining to answer.
    expect(validateReading(byKey.soil_ph, "")).toMatch(/required/);
    expect(validateReading(byKey.soil_ph, "   ")).toMatch(/required/);
  });

  it("rejects text that is not a number", () => {
    expect(validateReading(byKey.soil_ph, "abc")).toMatch(/must be a number/);
    expect(validateReading(byKey.nitrogen, "12a")).toMatch(/must be a number/);
  });

  it("names the field and unit so the message stands alone", () => {
    expect(validateReading(byKey.soil_conductivity, "99999")).toBe(
      "Soil Conductivity must be between 0 and 20000 µS/cm.",
    );
  });
});
