import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PhChange, SoilRecords } from "@/components/lgu/soil-records";
import type { LguSoilRecommendation } from "@/lib/api/lgu-api";
import {
  latestPerFarmer,
  phBand,
  previousPh,
  temperatureNeedsCheck,
} from "@/lib/lgu-soil-stats";

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

  it("flags a soil temperature Layuan's climate cannot produce", () => {
    expect(temperatureNeedsCheck("-0.1")).toBe(true);
    expect(temperatureNeedsCheck("60")).toBe(true);
    expect(temperatureNeedsCheck("28.4")).toBe(false);
    expect(temperatureNeedsCheck(null)).toBe(false);
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

  it("shows only the Analysed and Not analysed tabs, with counts", () => {
    render(<SoilRecords records={RECORDS} />);
    const tabs = within(screen.getByRole("group", { name: "Filter records" })).getAllByRole("button");
    expect(tabs.map((t) => t.textContent)).toEqual(["Analysed2", "Not analysed1"]);
    expect(screen.queryByRole("checkbox", { name: /Show every submission/ })).not.toBeInTheDocument();
  });

  it("opens on the analysed checks, each farmer's latest only", () => {
    render(<SoilRecords records={RECORDS} />);
    // Maria and Ana; Juan's latest check was not analysed.
    expect(recordRows()).toHaveLength(2);
    expect(screen.getByText("pH 5.8 · Slightly acidic")).toBeInTheDocument();
    expect(screen.getByText("pH 6.4 · Ideal")).toBeInTheDocument();
  });

  it("lists the farmers still waiting for AI advice under Not analysed", async () => {
    const user = userEvent.setup();
    render(<SoilRecords records={RECORDS} />);
    await user.click(screen.getByRole("button", { name: /Not analysed\s*1/ }));
    expect(recordRows()).toHaveLength(1);
    expect(recordRows()[0]).toContain("Juan Cruz");
    expect(screen.getByText(/still waiting for AI advice/)).toBeInTheDocument();
  });

  it("shows how a farmer's pH moved since their previous reading", async () => {
    const user = userEvent.setup();
    render(<SoilRecords records={RECORDS} />);
    await user.click(screen.getByRole("button", { name: /Maria Santos/ }));
    expect(screen.getByText("pH 4.8 → 5.8")).toBeInTheDocument();
    expect(screen.getByText("towards the ideal range")).toBeInTheDocument();
  });
});

describe("RecordCard detail", () => {
  const ODD = record({ id: 9, name: "Angelo Gloriane" }, "2026-09-19", {
    soil_ph: "4.0",
    soil_temperature: "-0.1",
    suitable_fruits: [PINEAPPLE],
    important_warnings: [
      { recommendation: "The soil temperature is dangerous for most crops." },
      { recommendation: "The soil pH of 4.00 is extremely acidic." },
    ],
    fertilizer_recommendations: [{ recommendation: "Apply agricultural lime." }],
  });

  async function openRecord() {
    const user = userEvent.setup();
    render(<SoilRecords records={[ODD]} />);
    await user.click(screen.getByRole("button", { name: /Angelo Gloriane/ }));
  }

  it("asks the officer to check an impossible reading before trusting the advice", async () => {
    await openRecord();
    expect(screen.getByRole("note")).toHaveTextContent(/Check this reading with the farmer/);
    expect(screen.getByRole("note")).toHaveTextContent(/-0\.1°C is not possible at Layuan/);
  });

  it("puts the AI's warnings before the readings and the advice", async () => {
    await openRecord();
    const sections = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(sections.indexOf("Warnings (2)")).toBeLessThan(sections.indexOf("Soil readings"));
    expect(sections.indexOf("Soil readings")).toBeLessThan(sections.indexOf("Fertilizer"));
  });

  it("gives each recommended crop the AI's reason, not just its name", async () => {
    await openRecord();
    const crops = screen.getByRole("region", { name: "Recommended crops (2)" });
    expect(crops).toHaveTextContent("Pineapple");
    expect(crops).toHaveTextContent("Likes acid");
  });

  it("labels the pH reading with its band", async () => {
    await openRecord();
    const readings = screen.getByRole("region", { name: "Soil readings" });
    expect(readings).toHaveTextContent("Too acidic");
  });
});

describe("PhChange", () => {
  it("calls a move away from 6.0–7.0 what it is", () => {
    render(<PhChange from={7.2} to={8.0} />);
    expect(screen.getByText("away from the ideal range")).toBeInTheDocument();
  });
});
