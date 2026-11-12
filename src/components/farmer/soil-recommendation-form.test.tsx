import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SoilRecommendationForm } from "@/components/farmer/soil-recommendation-form";
import type { SoilRecommendation } from "@/lib/api/soil-api";

const fetchHistory = vi.fn();
const reanalyze = vi.fn();
const create = vi.fn();
const outdated = vi.fn();

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("@/lib/notification-refresh", () => ({ requestNotificationRefresh: vi.fn() }));
vi.mock("@/lib/api/soil-api", () => ({
  createSoilRecommendation: (...args: unknown[]) => create(...args),
  fetchSoilRecommendations: (...args: unknown[]) => fetchHistory(...args),
  reanalyzeSoilRecommendation: (...args: unknown[]) => reanalyze(...args),
  isOutdatedAdvice: (...args: unknown[]) => outdated(...args),
}));

const failed: SoilRecommendation = {
  id: 7,
  soil_temperature: "28.5",
  soil_moisture: "65.00",
  soil_conductivity: 850,
  soil_ph: "6.50",
  nitrogen: 120,
  phosphorus: 80,
  potassium: 150,
  soil_fertility: 600,
  has_sensor_readings: true,
  soil_check: {
    status: "favorable",
    findings: [{ field: "soil_ph", level: "good", code: "ok", value: 6.5 }],
  },
  legacy_soil_type: "unknown",
  legacy_soil_texture: "unknown",
  legacy_drainage: "unknown",
  legacy_soil_moisture: "unknown",
  legacy_nitrogen: "unknown",
  legacy_phosphorus: "unknown",
  legacy_potassium: "unknown",
  legacy_organic_matter: "unknown",
  notes: "",
  suitable_fruits: [],
  suitable_vegetables: [],
  suitable_crops: [],
  fertilizer_recommendations: [],
  soil_improvement_watering: [],
  important_warnings: [],
  ai_generated: false,
  ai_available: true,
  failure_reason: "AI recommendation is temporarily unavailable.",
  created_at: "2026-09-14T15:59:27Z",
  updated_at: "2026-09-14T15:59:27Z",
};

const analyzed: SoilRecommendation = {
  ...failed,
  ai_generated: true,
  failure_reason: "",
  suitable_fruits: [{ id: "mango", name: "Mango", emoji: "🥭", reason: "Suits the soil." }],
  fertilizer_recommendations: [{ recommendation: "Add organic compost." }],
};

beforeEach(() => {
  fetchHistory.mockReset().mockResolvedValue([failed]);
  reanalyze.mockReset();
  create.mockReset();
  outdated.mockReset().mockReturnValue(false);
});

/** The page opens on the form; the saved result is behind "See Result". */
async function openSavedResult() {
  render(<SoilRecommendationForm />);
  await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
}

describe("SoilRecommendationForm retry", () => {
  /**
   * A Gemini outage used to leave the Farmer at a dead end: the only way to
   * get a recommendation was to type the whole assessment in again.
   */
  it("re-runs the analysis on the saved assessment", async () => {
    reanalyze.mockResolvedValue(analyzed);
    await openSavedResult();

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(reanalyze).toHaveBeenCalledWith("token", 7);
    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("keeps the button and says so when Gemini is still unavailable", async () => {
    reanalyze.mockResolvedValue(failed);
    await openSavedResult();

    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/still unavailable/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("offers to analyze an assessment that was saved without analysis", async () => {
    fetchHistory.mockResolvedValue([{ ...failed, failure_reason: "" }]);
    await openSavedResult();

    // The blank form's submit button shares this label, so wait for the
    // result screen before looking for the retry button.
    await screen.findByText(/no ai recommendation was generated/i);
    expect(screen.getByRole("button", { name: /get recommendation/i })).toBeEnabled();
  });
});

/** Types a valid reading into all seven soil detector fields. */
async function fillReadings() {
  const values: Record<string, string> = {
    "soil-soil-temperature": "28.5",
    "soil-soil-moisture": "65",
    "soil-soil-conductivity": "850",
    "soil-soil-ph": "6.5",
    "soil-nitrogen": "120",
    "soil-phosphorus": "80",
    "soil-potassium": "150",
  };
  for (const [id, value] of Object.entries(values)) {
    await userEvent.type(document.getElementById(id) as HTMLElement, value);
  }
}

describe("SoilRecommendationForm result view", () => {
  it("opens on the form, with the saved result one click away", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    render(<SoilRecommendationForm />);

    expect(screen.getByText("Soil Detector Readings")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByText("Soil Detector Readings")).not.toBeInTheDocument();
  });

  it("offers no result button before anything was ever saved", async () => {
    fetchHistory.mockResolvedValue([]);
    render(<SoilRecommendationForm />);

    await waitFor(() => expect(fetchHistory).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "See Result" })).not.toBeInTheDocument();
  });

  it("goes straight to the result once the recommendation is saved", async () => {
    fetchHistory.mockResolvedValue([]);
    create.mockResolvedValue(analyzed);
    render(<SoilRecommendationForm />);

    await fillReadings();
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.getByText("Crop recommendation saved successfully.")).toBeInTheDocument();
  });

  it("returns to a blank form, and can show the result again", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    render(<SoilRecommendationForm />);

    await userEvent.click(await screen.findByRole("button", { name: "See Result" }));
    await userEvent.click(screen.getByRole("button", { name: /back to soil information/i }));

    expect(screen.getByText("Soil Detector Readings")).toBeInTheDocument();
    expect(document.getElementById("soil-soil-ph")).toHaveValue(null);
    await userEvent.click(screen.getByRole("button", { name: "See Result" }));
    expect(await screen.findByText("Mango")).toBeInTheDocument();
  });
});

describe("SoilRecommendationForm additional soil information", () => {
  it("refuses notes that are not words, without sending anything", async () => {
    fetchHistory.mockResolvedValue([]);
    render(<SoilRecommendationForm />);

    await fillReadings();
    await userEvent.type(screen.getByLabelText(/additional soil information/i), "12345 !!!");
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(await screen.findByText(/must describe something in words/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("SoilRecommendationForm soil warning signs", () => {
  const unsuitable: SoilRecommendation = {
    ...analyzed,
    soil_ph: "9.50",
    soil_check: {
      status: "unsuitable",
      findings: [
        { field: "soil_moisture", level: "good", code: "ok", value: 65 },
        { field: "soil_ph", level: "critical", code: "ph_high", value: 9.5 },
      ],
    },
    important_warnings: [{ recommendation: "Do not plant until the pH is lowered." }],
  };

  it("shows no crops for unsuitable soil, and says how to fix it", async () => {
    fetchHistory.mockResolvedValue([unsuitable]);
    await openSavedResult();

    expect(await screen.findByText("No crops recommended for this soil")).toBeInTheDocument();
    expect(screen.queryByText("Mango")).not.toBeInTheDocument();
    expect(screen.getByText(/pH too high \(9.5\)/)).toBeInTheDocument();
    expect(screen.getByText("Fix first")).toBeInTheDocument();
    // The fixing advice is opened straight away.
    expect(screen.getByText("Do not plant until the pH is lowered.")).toBeInTheDocument();
  });

  it("shows the warning signs even when the AI was unavailable", async () => {
    fetchHistory.mockResolvedValue([{ ...failed, soil_check: unsuitable.soil_check }]);
    await openSavedResult();

    expect(await screen.findByText("Soil warning signs")).toBeInTheDocument();
    expect(screen.getByText(/not ready for planting yet/)).toBeInTheDocument();
  });

  it("lists the crops for favourable soil", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    await openSavedResult();

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.getByText("Your soil looks good for planting.")).toBeInTheDocument();
  });
});

describe("SoilRecommendationForm past results", () => {
  const older: SoilRecommendation = {
    ...analyzed,
    id: 3,
    soil_ph: "5.40",
    suitable_fruits: [{ id: "pineapple", name: "Pineapple", emoji: "🍍", reason: "Likes acid soil." }],
    created_at: "2026-08-12T01:10:00Z",
    updated_at: "2026-08-12T01:10:00Z",
  };
  const newer: SoilRecommendation = { ...analyzed, id: 9, created_at: "2026-09-24T06:28:00Z" };

  it("opens the newest result and lists every saved one, newest first", async () => {
    fetchHistory.mockResolvedValue([newer, older]);
    await openSavedResult();

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    const options = Array.from(picker.options).map((option) => option.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatch(/September 24, 2026.*pH 6\.50 \(latest\)$/);
    expect(options[1]).toMatch(/August 12, 2026.*pH 5\.40$/);
  });

  it("shows an older result when it is picked, without another request", async () => {
    fetchHistory.mockResolvedValue([newer, older]);
    await openSavedResult();

    await userEvent.selectOptions(screen.getByLabelText("Result from"), "3");

    expect(await screen.findByText("Pineapple")).toBeInTheDocument();
    expect(screen.queryByText("Mango")).not.toBeInTheDocument();
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it("marks a result that was never analysed", async () => {
    fetchHistory.mockResolvedValue([newer, { ...older, ai_generated: false, failure_reason: "" }]);
    await openSavedResult();

    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    expect(picker.options[1].textContent).toMatch(/— not analyzed$/);
  });

  it("keeps the older results when a new one is added", async () => {
    fetchHistory.mockResolvedValue([older]);
    create.mockResolvedValue(newer);
    render(<SoilRecommendationForm />);
    await screen.findByRole("button", { name: "See Result" });

    await fillReadings();
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    const picker = screen.getByLabelText("Result from") as HTMLSelectElement;
    expect(picker.value).toBe("9");
    expect(picker.options).toHaveLength(2);
    expect(picker.options[0].textContent).toMatch(/\(latest\)$/);
  });

  it("hides the picker when there is only one result", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    await openSavedResult();

    expect(await screen.findByText("Mango")).toBeInTheDocument();
    expect(screen.queryByLabelText("Result from")).not.toBeInTheDocument();
  });
});

describe("SoilRecommendationForm outdated advice", () => {
  it("rewrites an old result with the current advice when it is opened", async () => {
    const reworded = {
      ...analyzed,
      updated_at: "2026-10-08T02:00:00Z",
      fertilizer_recommendations: [{ recommendation: "Mix compost into the soil." }],
    };
    fetchHistory.mockResolvedValue([analyzed]);
    outdated.mockImplementation((soil: SoilRecommendation) => soil.updated_at < "2026-10-07T17:35:00Z");
    reanalyze.mockResolvedValue(reworded);

    await openSavedResult();
    await waitFor(() => expect(reanalyze).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "See more" }));

    expect(await screen.findByText("Mix compost into the soil.")).toBeInTheDocument();
    expect(reanalyze).toHaveBeenCalledTimes(1);
    expect(reanalyze).toHaveBeenCalledWith("token", analyzed.id);
  });

  it("keeps the old advice when the rewrite fails", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    outdated.mockReturnValue(true);
    reanalyze.mockRejectedValue(new Error("down"));

    await openSavedResult();

    await waitFor(() => expect(reanalyze).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "See more" }));
    expect(screen.getByText("Add organic compost.")).toBeInTheDocument();
  });
});

const readSoilSensor = vi.fn();
vi.mock("@/lib/arduino/soil-sensor", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isSerialSupported: () => true,
  readSoilSensor: (...args: unknown[]) => readSoilSensor(...args),
}));

const SENSOR_READING = {
  soil_moisture: 65.2,
  soil_temperature: 28.5,
  soil_conductivity: 850,
  soil_ph: 6.5,
  nitrogen: 120,
  phosphorus: 80,
  potassium: 150,
};

/** Sign -> Laptop -> instructions -> Connect by USB -> back on the form, filled in. */
async function readWithSensor() {
  await userEvent.click(screen.getByRole("button", { name: "Use the Arduino sensor" }));
  await userEvent.click(await screen.findByRole("button", { name: /laptop/i }));
  expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(await screen.findByText("How to use the sensor")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
  await userEvent.click(await screen.findByRole("button", { name: /connect by usb/i }));
  expect(await screen.findByRole("button", { name: /read again/i })).toBeInTheDocument();
}

describe("SoilRecommendationForm typed readings", () => {
  beforeEach(() => {
    fetchHistory.mockResolvedValue([]);
  });

  it("refuses a typed 0, because it cannot give a crop recommendation", async () => {
    render(<SoilRecommendationForm />);
    await fillReadings();
    const nitrogen = screen.getByLabelText("Nitrogen (N)");
    await userEvent.clear(nitrogen);
    await userEvent.type(nitrogen, "0");
    await userEvent.click(screen.getByRole("button", { name: /get recommendation/i }));

    expect(
      await screen.findByText("Invalid reading: 0 cannot give a crop recommendation."),
    ).toBeInTheDocument();
    expect(nitrogen).toHaveAttribute("aria-invalid", "true");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("SoilRecommendationForm with the Arduino sensor", () => {
  beforeEach(() => {
    fetchHistory.mockResolvedValue([]);
    readSoilSensor.mockReset().mockResolvedValue(SENSOR_READING);
  });

  it("shows that the feature works with the Arduino hardware", async () => {
    render(<SoilRecommendationForm />);
    expect(
      await screen.findByText("This feature can be used with the Arduino hardware"),
    ).toBeInTheDocument();
  });

  it("fills the seven text fields, and Get Recommendation sends them", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    create.mockResolvedValue({ ...analyzed, id: 9, created_at: "2026-11-04T01:00:00Z" });
    render(<SoilRecommendationForm />);
    expect(await screen.findByRole("button", { name: /see result/i })).toBeInTheDocument();
    await readWithSensor();

    expect(screen.getByLabelText("Soil Temperature")).toHaveValue(28.5);
    expect(screen.getByLabelText("Soil pH")).toHaveValue(6.5);
    expect(screen.getByLabelText("Nitrogen (N)")).toHaveValue(120);
    expect(create).not.toHaveBeenCalled();
    // Neither the Arduino sign nor See Result beside the sensor's readings.
    expect(screen.queryByText("This feature can be used with the Arduino hardware")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /see result/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^get recommendation$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /get crop recommendation/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      soil_temperature: 28.5,
      soil_ph: 6.5,
      nitrogen: 120,
    });
    expect(create.mock.calls[0][0]).not.toHaveProperty("soil_fertility");
  });

  it("marks 0 readings invalid, names them and holds back the recommendation", async () => {
    readSoilSensor.mockResolvedValue({ ...SENSOR_READING, soil_conductivity: 0, nitrogen: 0, phosphorus: 0, potassium: 0 });
    render(<SoilRecommendationForm />);
    await readWithSensor();

    // The raw values stay in the fields.
    expect(screen.getByLabelText("Nitrogen (N)")).toHaveValue(0);
    expect(screen.getByLabelText("Soil Conductivity")).toHaveValue(0);
    expect(screen.getByLabelText("Nitrogen (N)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Soil pH")).not.toHaveAttribute("aria-invalid");
    expect(screen.getAllByText("Invalid reading: the sensor returned 0.")).toHaveLength(4);

    expect(screen.queryByText(/filled in from the sensor/i)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Some readings are invalid (Soil Conductivity, Nitrogen (N), Phosphorus (P), Potassium (K)). Please check the sensor connection and read again.",
    );
    expect(screen.getByText("A crop recommendation needs all seven valid readings.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get crop recommendation/i })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });

  it("Read Again gets fresh values and turns the recommendation on once all seven are valid", async () => {
    create.mockResolvedValue({ ...analyzed, id: 9, created_at: "2026-11-04T01:00:00Z" });
    readSoilSensor
      .mockResolvedValueOnce({ ...SENSOR_READING, nitrogen: 0 })
      .mockResolvedValueOnce(SENSOR_READING);
    render(<SoilRecommendationForm />);
    await readWithSensor();
    expect(screen.getByRole("button", { name: /get crop recommendation/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /read again/i }));
    expect(await screen.findByText(/filled in from the sensor/i)).toBeInTheDocument();
    expect(readSoilSensor).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Nitrogen (N)")).toHaveValue(120);
    expect(screen.queryByText(/needs all seven valid readings/i)).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /get crop recommendation/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(create).toHaveBeenCalled());
  });

  it("does not let the farmer type over the sensor's readings, even a 0", async () => {
    readSoilSensor.mockResolvedValue({ ...SENSOR_READING, nitrogen: 0 });
    render(<SoilRecommendationForm />);
    await readWithSensor();

    const nitrogen = screen.getByLabelText("Nitrogen (N)");
    expect(nitrogen).toHaveAttribute("readonly");
    await userEvent.type(nitrogen, "55");
    expect(nitrogen).toHaveValue(0);
  });

  it("goes Back to the Connect page to read again", async () => {
    render(<SoilRecommendationForm />);
    await readWithSensor();

    await userEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(await screen.findByRole("button", { name: /connect by usb/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /connect by usb/i }));
    expect(await screen.findByText(/filled in from the sensor/i)).toBeInTheDocument();
    expect(readSoilSensor).toHaveBeenCalledTimes(2);
  });

  it("flags a reading outside the sensor's range beside its field", async () => {
    readSoilSensor.mockResolvedValue({ ...SENSOR_READING, soil_ph: 2.5 });
    render(<SoilRecommendationForm />);
    await readWithSensor();

    expect(screen.getByText(/soil ph must be between 3 and 10/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid \(soil ph\)/i);
    expect(screen.getByRole("button", { name: /get crop recommendation/i })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });

  it("hides See Result while the Arduino steps are open", async () => {
    fetchHistory.mockResolvedValue([analyzed]);
    render(<SoilRecommendationForm />);
    expect(await screen.findByRole("button", { name: /see result/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /use the arduino sensor/i }));
    expect(screen.queryByRole("button", { name: /see result/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /type the readings instead/i }));
    expect(screen.getByRole("button", { name: /see result/i })).toBeInTheDocument();
  });

  it("sends Additional Soil Information with the sensor readings", async () => {
    create.mockResolvedValue({ ...analyzed, id: 9, created_at: "2026-11-04T01:00:00Z" });
    render(<SoilRecommendationForm />);
    await readWithSensor();
    await userEvent.type(screen.getByLabelText(/additional soil information/i), "Dries out fast");
    await userEvent.click(screen.getByRole("button", { name: /get crop recommendation/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ notes: "Dries out fast" });
  });

  it("explains a probe that is not answering and keeps manual entry available", async () => {
    const { SensorError } = await import("@/lib/arduino/soil-sensor");
    readSoilSensor.mockRejectedValue(new SensorError("probe_not_answering"));
    render(<SoilRecommendationForm />);
    await userEvent.click(await screen.findByRole("button", { name: "Use the Arduino sensor" }));
    await userEvent.click(await screen.findByRole("button", { name: /laptop/i }));
    await userEvent.click(await screen.findByRole("button", { name: /next/i }));
    await userEvent.click(await screen.findByRole("button", { name: /next/i }));
    await userEvent.click(await screen.findByRole("button", { name: /connect by usb/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/probe is not answering/i);
  });

  it("asks laptop or phone first, warns about iPhones, and shows phone steps", async () => {
    render(<SoilRecommendationForm />);
    await userEvent.click(await screen.findByRole("button", { name: "Use the Arduino sensor" }));
    expect(screen.getByText("Which device will you use?")).toBeInTheDocument();
    expect(screen.getByText(/iphones can't use the arduino/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^phone/i }));
    await userEvent.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText(/turn on bluetooth/i)).toBeInTheDocument();
    expect(screen.getByText(/download the app named serial usb terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/baud rate to 115200/i)).toBeInTheDocument();
    expect(screen.queryByText(/usb cable/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/iphones cannot connect/i);
    expect(screen.queryByRole("button", { name: /connect by usb/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect by bluetooth/i })).not.toBeInTheDocument();
  });

  it("offers only Connect by USB on a laptop, even when Bluetooth exists", async () => {
    Object.defineProperty(navigator, "bluetooth", { value: {}, configurable: true });
    try {
      render(<SoilRecommendationForm />);
      await userEvent.click(await screen.findByRole("button", { name: "Use the Arduino sensor" }));
      await userEvent.click(await screen.findByRole("button", { name: /laptop/i }));
      await userEvent.click(await screen.findByRole("button", { name: /next/i }));
      await userEvent.click(await screen.findByRole("button", { name: /next/i }));
      expect(await screen.findByRole("button", { name: /connect by usb/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /connect by bluetooth/i })).not.toBeInTheDocument();
    } finally {
      delete (navigator as { bluetooth?: unknown }).bluetooth;
    }
  });
});
