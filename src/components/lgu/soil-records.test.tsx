import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PhChange, SoilRecords } from "@/components/lgu/soil-records";
import type { LguSoilRecommendation } from "@/lib/api/lgu-api";
import { latestPerFarmer, needsAttention, phBand, previousPh } from "@/lib/lgu-soil-stats";

const PINEAPPLE = { id: "pineapple", name: "Pineapple", emoji: "🍍", reason: "Likes acid" };
const CORN = { id: "corn", name: "Corn", emoji: "🌽", reason: "Tolerant" };
const MANGO = { id: "mango", name: "Mango", emoji: "🥭", reason: "Deep soil" };

let nextId = 1;
function record(
  farmer: { id: number; name: string },
  created: string,
  overrides: Partial<LguSoilRecommendation> = {},
): LguSoilRecommendation {
  return {
    id: nextId++,
    farmer_id: farmer.id,
    farmer_name: farmer.name,
    farmer_email: `${farmer.name.split(" ")[0].toLowerCase()}@example.com`,
    soil_temperature: "28.0",
    soil_moisture: "55.0",
    soil_conductivity: 800,
    soil_ph: "6.5",
    nitrogen: 120,
    phosphorus: 80,
    potassium: 150,
    soil_fertility: 600,
    has_sensor_readings: true,
    notes: "",
    legacy_soil_type_label: "",
    legacy_soil_texture_label: "",
    legacy_drainage_label: "",
    legacy_soil_moisture_label: "",
    legacy_nitrogen_label: "",
    legacy_phosphorus_label: "",
    legacy_potassium_label: "",
    legacy_organic_matter_label: "",
    suitable_fruits: [PINEAPPLE],
    suitable_vegetables: [CORN],
    suitable_crops: [],
    fertilizer_recommendations: [],
    soil_improvement_watering: [],
    important_warnings: [],
    ai_generated: true,
    created_at: `${created}T08:00:00Z`,
    ...overrides,
  } as LguSoilRecommendation;
}

const MARIA = { id: 1, name: "Maria Santos" };
const JUAN = { id: 2, name: "Juan Cruz" };
const ANA = { id: 3, name: "Ana Lim" };

const RECORDS = [
  // Maria's soil moved from very acidic towards ideal.
  record(MARIA, "2026-09-01", { soil_ph: "4.8" }),
  record(MARIA, "2026-09-15", { soil_ph: "5.8", important_warnings: [{ recommendation: "Add lime" }] }),
  // Juan's latest check failed to reach the AI.
  record(JUAN, "2026-09-10", { soil_ph: "8.2", suitable_fruits: [MANGO], suitable_vegetables: [] }),
  record(JUAN, "2026-09-18", { soil_ph: "8.0", ai_generated: false, suitable_fruits: [], suitable_vegetables: [] }),
  // Ana: ideal soil, no warnings.
  record(ANA, "2026-09-12", { soil_ph: "6.4" }),
];

describe("soil statistics", () => {
  it("bands pH against the 6.0–7.0 guide", () => {
    expect(phBand(5.4)).toBe("TOO_ACIDIC");
    expect(phBand(5.5)).toBe("SLIGHTLY_ACIDIC");
    expect(phBand(6.0)).toBe("IDEAL");
    expect(phBand(7.0)).toBe("IDEAL");
    expect(phBand(7.1)).toBe("ALKALINE");
    expect(phBand(null)).toBe("NONE");
  });

  it("uses each farmer's latest record only", () => {
    expect(latestPerFarmer(RECORDS).map((r) => [r.farmer_name, r.soil_ph])).toEqual([
      ["Juan Cruz", "8.0"],
      ["Maria Santos", "5.8"],
      ["Ana Lim", "6.4"],
    ]);
  });

  it("compares a reading with the same farmer's previous pH", () => {
    const [first, second] = RECORDS;
    expect(previousPh(second, RECORDS)).toBe(4.8);
    expect(previousPh(first, RECORDS)).toBeNull();
  });

  it("flags soil outside the ideal range, or with AI warnings", () => {
    expect(needsAttention(RECORDS[1])).toBe(true); // 5.8 and a warning
    expect(needsAttention(RECORDS[3])).toBe(true); // 8.0
    expect(needsAttention(RECORDS[4])).toBe(false); // 6.4, no warnings
  });
});

function recordRows() {
  const list = screen.getByRole("region", { name: "Soil records" });
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

describe("SoilRecords", () => {
  it("has no soil pH or most-recommended-crops charts", () => {
    render(<SoilRecords records={RECORDS} />);
    expect(screen.queryByText("Soil pH across farmers")).not.toBeInTheDocument();
    expect(screen.queryByText("Most recommended crops")).not.toBeInTheDocument();
  });

  it("says how many farmers are still without AI advice", () => {
    render(<SoilRecords records={RECORDS} />);
    expect(
      screen.getByText(/1 farmer's latest soil check has no AI advice yet/),
    ).toBeInTheDocument();
  });

  it("lists each farmer's latest record by default, and every submission on request", async () => {
    const user = userEvent.setup();
    render(<SoilRecords records={RECORDS} />);
    expect(recordRows()).toHaveLength(3);
    await user.click(screen.getByRole("checkbox", { name: "Show every submission" }));
    expect(recordRows()).toHaveLength(5);
  });

  it("filters to the records that need a follow-up, with counts", async () => {
    const user = userEvent.setup();
    render(<SoilRecords records={RECORDS} />);
    await user.click(screen.getByRole("button", { name: /Needs attention\s*2/ }));
    expect(recordRows()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Not analysed\s*1/ }));
    expect(recordRows()).toHaveLength(1);
    expect(recordRows()[0]).toContain("Juan Cruz");
  });

  it("shows the pH band on each record", () => {
    render(<SoilRecords records={RECORDS} />);
    expect(screen.getByText("pH 5.8 · Slightly acidic")).toBeInTheDocument();
    expect(screen.getByText("pH 8.0 · Alkaline")).toBeInTheDocument();
    expect(screen.getByText("pH 6.4 · Ideal")).toBeInTheDocument();
  });

  it("shows how a farmer's pH moved since their previous reading", async () => {
    const user = userEvent.setup();
    render(<SoilRecords records={RECORDS} />);
    await user.click(screen.getByRole("button", { name: /Maria Santos/ }));
    expect(screen.getByText("pH 4.8 → 5.8")).toBeInTheDocument();
    expect(screen.getByText("towards the ideal range")).toBeInTheDocument();
  });
});

describe("PhChange", () => {
  it("calls a move away from 6.0–7.0 what it is", () => {
    render(<PhChange from={7.2} to={8.0} />);
    expect(screen.getByText("away from the ideal range")).toBeInTheDocument();
  });
});
