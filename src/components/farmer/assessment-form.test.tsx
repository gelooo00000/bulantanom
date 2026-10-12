import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentForm } from "@/components/farmer/assessment-form";
import type { BackendAssessment, EvidenceValidation } from "@/lib/api/risk-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ accessToken: "token" }) }));

const validateEvidence = vi.fn();
const submitAssessment = vi.fn();
vi.mock("@/lib/api/risk-api", async (original) => ({
  ...(await original<typeof import("@/lib/api/risk-api")>()),
  validateEvidence: (...args: unknown[]) => validateEvidence(...args),
  submitAssessment: (...args: unknown[]) => submitAssessment(...args),
}));

let todayWeather: unknown = { available: false };
vi.mock("@/lib/api/weather-api", () => ({
  fetchFarmWeather: () => Promise.resolve(todayWeather),
}));

const ACCEPTED: EvidenceValidation = {
  evidence_valid: true,
  verdict: "match",
  confidence: 0.9,
  detected_subject: "papaya plant",
  expected_crop: "Papaya",
  reason: "A papaya plant.",
  message: "Plant evidence accepted.",
  evidence_token: "signed-token",
  suggested_answers: { health_condition: "slightly_unhealthy", leaf_condition: "spots" },
};

function photo() {
  return new File(["jpeg-bytes"], "plant.jpg", { type: "image/jpeg" });
}

function renderForm(lastAssessment: BackendAssessment | null = null) {
  render(
    <AssessmentForm
      plantId={7}
      plantLabel="Sinta"
      cropId="papaya"
      lastAssessment={lastAssessment}
    />,
  );
}

/** The required answers the photo in these tests does not give. */
async function answerTheRest(user: ReturnType<typeof userEvent.setup>) {
  const growth = screen.getByRole("radiogroup", { name: /Growth compared/ });
  await user.click(within(growth).getByRole("radio", { name: "About as expected" }));
  const flowering = screen.getByRole("radiogroup", { name: /Flowering status/ });
  await user.click(within(flowering).getByRole("radio", { name: "Not flowering" }));
  const fruiting = screen.getByRole("radiogroup", { name: /Fruiting status/ });
  await user.click(within(fruiting).getByRole("radio", { name: "Not fruiting" }));
  const watering = screen.getByRole("radiogroup", { name: /Watering frequency/ });
  await user.click(within(watering).getByRole("radio", { name: "Daily" }));
  const soil = screen.getByRole("radiogroup", { name: /Soil moisture/ });
  await user.click(within(soil).getByRole("radio", { name: "Moist" }));
}

/** The answer chosen for one question. */
function chosen(question: RegExp) {
  const group = screen.getByRole("radiogroup", { name: question });
  return within(group).getByRole("radio", { checked: true });
}

beforeEach(() => {
  window.localStorage.clear();
  todayWeather = { available: false };
  validateEvidence.mockReset();
  submitAssessment.mockReset();
  // jsdom has no object URLs; the preview only needs a string.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("Weekly assessment: photo first", () => {
  it("checks the photo as soon as it is taken and fills in what it shows", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText(/2 answers were filled in from your photo/)).toBeInTheDocument();
    expect(validateEvidence).toHaveBeenCalledWith("token", 7, expect.any(File));
    expect(chosen(/Overall health/)).toHaveAccessibleName("Slightly unhealthy");
    expect(chosen(/Leaf condition/)).toHaveAccessibleName("Spots or lesions");
    expect(screen.getAllByText("From photo")).toHaveLength(2);
  });

  it("submits with the token from the early check instead of checking again", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/filled in from your photo/);
    await answerTheRest(user);
    await user.click(screen.getByRole("button", { name: /Submit Assessment/ }));

    await waitFor(() => expect(submitAssessment).toHaveBeenCalled());
    expect(validateEvidence).toHaveBeenCalledTimes(1);
    const [, , fields, , token] = submitAssessment.mock.calls[0];
    expect(fields).toMatchObject({ health_condition: "slightly_unhealthy", leaf_condition: "spots" });
    expect(token).toBe("signed-token");
  });

  it("never overwrites an answer the farmer chose before the photo", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    const user = userEvent.setup();
    renderForm();

    const health = screen.getByRole("radiogroup", { name: /Overall health/ });
    await user.click(within(health).getByRole("radio", { name: "Unhealthy" }));
    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText(/1 answer was filled in from your photo/)).toBeInTheDocument();
    expect(chosen(/Overall health/)).toHaveAccessibleName("Unhealthy");
  });

  it("starts from the last check's answers, and the photo's are newer", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    const user = userEvent.setup();
    renderForm({
      assessment_date: "2026-10-05",
      growth_condition: "slower_than_expected",
      health_condition: "healthy",
      leaf_condition: "healthy",
      flowering_status: "",
      fruiting_status: "",
      watering_frequency: "twice_weekly",
      soil_moisture: "moist",
      plant_height_cm: "40",
      notes: "Leaves look pale",
    } as unknown as BackendAssessment);

    expect(screen.getByText(/answers from the last check/)).toBeInTheDocument();
    expect(chosen(/Watering frequency/)).toHaveAccessibleName("Twice a week");
    expect(chosen(/Growth compared/)).toHaveAccessibleName("Slower than expected");
    // Height and written notes are this week's to give.
    expect(screen.getByLabelText(/Plant height/)).toHaveValue(null);

    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/2 answers were filled in from your photo/);
    expect(chosen(/Leaf condition/)).toHaveAccessibleName("Spots or lesions");
    expect(chosen(/Watering frequency/)).toHaveAccessibleName("Twice a week");
  });

  it("keeps submit off while a refused photo is selected", async () => {
    validateEvidence.mockResolvedValue({
      ...ACCEPTED,
      evidence_valid: false,
      verdict: "mismatch",
      evidence_token: undefined,
      suggested_answers: {},
      message: "Please upload a clear photo of your papaya plant.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText("Take a new photo to submit this assessment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Assessment/ })).toBeDisabled();
  });
});

describe("Weekly assessment: tap answers", () => {
  it("keeps a required answer when its button is tapped again", async () => {
    const user = userEvent.setup();
    renderForm();

    const flowering = screen.getByRole("radiogroup", { name: /Flowering status/ });
    const starting = within(flowering).getByRole("radio", { name: "Starting to flower" });
    await user.click(starting);
    await user.click(starting);
    expect(starting).toBeChecked();
  });

  it("keeps soil moisture once chosen: it is required too", async () => {
    const user = userEvent.setup();
    renderForm();

    const soil = screen.getByRole("radiogroup", { name: /Soil moisture/ });
    const moist = within(soil).getByRole("radio", { name: "Moist" });
    await user.click(moist);
    await user.click(moist);
    expect(moist).toBeChecked();
  });

  it("offers this crop's pests and saves the ticks as one answer", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Add more details" }));
    const pests = screen.getByRole("group", { name: "Pests you have seen" });
    // Papaya's list, not every pest there is.
    expect(within(pests).getByRole("checkbox", { name: /Mealybugs/ })).toBeInTheDocument();
    expect(within(pests).queryByRole("checkbox", { name: /Rats/ })).toBeNull();

    await user.click(within(pests).getByRole("checkbox", { name: /Whiteflies/ }));
    await user.click(within(pests).getByRole("checkbox", { name: /Mealybugs/ }));
    expect(screen.queryByPlaceholderText("Describe what you saw")).toBeNull();

    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/filled in from your photo/);
    await answerTheRest(user);
    await user.click(screen.getByRole("button", { name: /Submit Assessment/ }));

    await waitFor(() => expect(submitAssessment).toHaveBeenCalled());
    const [, , fields] = submitAssessment.mock.calls[0];
    expect(fields.pest_observation).toBe(
      "Mealybugs or scale insects; Whiteflies",
    );
    expect(fields.disease_observation).toBe("");
  });
});

describe("Weekly assessment: less to fill in", () => {
  it("keeps symptoms, height and notes behind 'Add more details' until asked for", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText(/Plant height/)).not.toBeVisible();
    expect(screen.getByRole("group", { name: "Pests you have seen", hidden: true })).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add more details" }));
    expect(screen.getByLabelText(/Plant height/)).toBeVisible();
    expect(screen.getByRole("group", { name: "Pests you have seen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hide details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows today's weather at the farm and sends no weather text itself", async () => {
    todayWeather = {
      available: true,
      temperature_c: 28,
      condition: "drizzle",
      is_day: true,
      observed_at: "2026-10-12T11:15",
    };
    validateEvidence.mockResolvedValue(ACCEPTED);
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    expect(
      await screen.findByText("Weather at the farm today: 28°C · Drizzle"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/added to your assessment/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add more details" }));
    await user.type(screen.getByLabelText(/What have you noticed/), "Bunga nahuhulog");
    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/filled in from your photo/);
    await answerTheRest(user);
    await user.click(screen.getByRole("button", { name: /Submit Assessment/ }));

    await waitFor(() => expect(submitAssessment).toHaveBeenCalled());
    const [, , fields] = submitAssessment.mock.calls[0];
    expect(fields).toMatchObject({ notes: "Bunga nahuhulog", environmental_observations: "" });
  });
});

describe("Weekly assessment: what is still needed", () => {
  it("starts with nothing answered for the farmer", () => {
    renderForm();

    for (const question of [
      /Growth compared/,
      /Overall health/,
      /Leaf condition/,
      /Flowering status/,
      /Fruiting status/,
      /Watering frequency/,
      /Soil moisture/,
    ]) {
      const group = screen.getByRole("radiogroup", { name: question });
      expect(within(group).queryByRole("radio", { checked: true })).toBeNull();
    }
  });

  it("marks each unanswered required question, with no list under Submit", () => {
    renderForm();

    expect(screen.getAllByText("Required")).toHaveLength(7);
    expect(screen.queryByText("To submit, still needed:")).toBeNull();
    expect(screen.getByRole("button", { name: /Submit Assessment/ })).toBeDisabled();
  });

  it("drops the Required mark once a question is answered", async () => {
    const user = userEvent.setup();
    renderForm();

    const leaves = screen.getByRole("radiogroup", { name: /Leaf condition/ });
    await user.click(within(leaves).getByRole("radio", { name: "Healthy green leaves" }));

    expect(screen.getAllByText("Required")).toHaveLength(6);
  });
});

describe("Weekly assessment: mushrooms", () => {
  const MUSHROOM_SKIPS = ["plant_height_cm", "leaf_condition", "flowering_status"] as const;

  it("asks mushroom condition in place of leaves, and requires it", async () => {
    validateEvidence.mockResolvedValue({ ...ACCEPTED, suggested_answers: {} });
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(
      <AssessmentForm
        plantId={8}
        plantLabel="Straw Mushroom"
        cropId="mushroom"
        skipQuestions={[...MUSHROOM_SKIPS]}
      />,
    );

    expect(screen.queryByRole("radiogroup", { name: /Leaf condition/ })).toBeNull();
    const condition = screen.getByRole("radiogroup", { name: /Mushroom condition/ });
    expect(screen.getByText("Mushroom condition").parentElement).toHaveTextContent("Required");

    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/Plant Evidence Verified|Plant evidence accepted|Verified/i);
    for (const [question, answer] of [
      [/Growth compared/, "About as expected"],
      [/Overall health/, "Healthy"],
      [/Fruiting status/, "Fruit forming"],
      [/Watering frequency/, "Daily"],
      [/Soil moisture/, "Moist"],
    ] as const) {
      const group = screen.getByRole("radiogroup", { name: question });
      await user.click(within(group).getByRole("radio", { name: answer }));
    }
    expect(screen.getByRole("button", { name: /Submit Assessment/ })).toBeDisabled();

    await user.click(within(condition).getByRole("radio", { name: "Slimy, soft or bad smell" }));
    await user.click(screen.getByRole("button", { name: /Submit Assessment/ }));

    await waitFor(() => expect(submitAssessment).toHaveBeenCalled());
    const [, , fields] = submitAssessment.mock.calls[0];
    expect(fields).toMatchObject({ mushroom_condition: "slimy", leaf_condition: "" });
  });

  it("never asks it of other crops, even if the crop list does not say so", () => {
    renderForm();
    expect(screen.queryByRole("radiogroup", { name: /Mushroom condition/ })).toBeNull();
  });
});

describe("Weekly assessment: draft", () => {
  async function answerSome() {
    const user = userEvent.setup();
    const view = render(
      <AssessmentForm plantId={7} plantLabel="Sinta" cropId="papaya" />,
    );
    const leaves = screen.getByRole("radiogroup", { name: /Leaf condition/ });
    await user.click(within(leaves).getByRole("radio", { name: "Slight yellowing" }));
    await user.click(screen.getByRole("button", { name: "Add more details" }));
    const pests = screen.getByRole("group", { name: "Pests you have seen" });
    await user.click(within(pests).getByRole("checkbox", { name: /Mealybugs/ }));
    await user.type(screen.getByLabelText(/What have you noticed/), "Dahon naninilaw");
    view.unmount();
    return user;
  }

  it("brings back today's unsent answers after the page is left", async () => {
    await answerSome();
    renderForm();

    expect(screen.getByText(/Your answers from earlier today are back/)).toBeInTheDocument();
    expect(chosen(/Leaf condition/)).toHaveAccessibleName("Slight yellowing");
    const pests = screen.getByRole("group", { name: "Pests you have seen" });
    expect(within(pests).getByRole("checkbox", { name: /Mealybugs/ })).toBeChecked();
    expect(screen.getByLabelText(/What have you noticed/)).toHaveValue("Dahon naninilaw");
  });

  it("starts over empty when asked", async () => {
    const user = await answerSome();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.queryByText(/Your answers from earlier today are back/)).toBeNull();
    const leaves = screen.getByRole("radiogroup", { name: /Leaf condition/ });
    expect(within(leaves).queryByRole("radio", { checked: true })).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("does not bring back a draft from another day", () => {
    window.localStorage.setItem(
      "bulantanom:assessment-draft:7",
      JSON.stringify({
        savedOn: "2026-01-01",
        answers: { leaf_condition: "spots" },
        height: "",
        notes: "",
        pests: [],
        diseases: [],
      }),
    );
    renderForm();

    expect(screen.queryByText(/Your answers from earlier today are back/)).toBeNull();
    expect(window.localStorage.getItem("bulantanom:assessment-draft:7")).toBeNull();
  });
});

describe("Weekly assessment: an empty draft", () => {
  it("does not claim answers are back when only a cleared answer was saved", () => {
    window.localStorage.setItem(
      "bulantanom:assessment-draft:7",
      JSON.stringify({
        savedOn: new Date().toLocaleDateString("en-CA"),
        answers: { soil_moisture: "" },
        height: "",
        notes: "",
        pests: [],
        diseases: [],
      }),
    );
    renderForm();

    expect(screen.queryByText(/Your answers from earlier today are back/)).toBeNull();
    expect(window.localStorage.getItem("bulantanom:assessment-draft:7")).toBeNull();
  });
});

describe("Weekly assessment: photo older than the plant", () => {
  it("explains the refusal and keeps Submit off", async () => {
    validateEvidence.mockResolvedValue({
      ...ACCEPTED,
      evidence_valid: false,
      verdict: "wrong_stage",
      evidence_token: undefined,
      suggested_answers: {},
      reason: "Pods are visible, but this plant was planted 11 days ago.",
      message: "This doesn't look like the radish / jicama you planted.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText("Photo doesn't match the plant's age")).toBeInTheDocument();
    expect(screen.getByText(/planted 11 days ago/)).toBeInTheDocument();
    expect(screen.queryByText(/filled in from your photo/)).toBeNull();
    expect(screen.getByRole("button", { name: /Submit Assessment/ })).toBeDisabled();
  });
});

describe("Weekly assessment: not the same plant", () => {
  it("explains the refusal and keeps Submit off", async () => {
    validateEvidence.mockResolvedValue({
      ...ACCEPTED,
      evidence_valid: false,
      verdict: "different_plant",
      evidence_token: undefined,
      suggested_answers: {},
      reason: "7 days ago this plant was fruiting; the photo now shows a seedling.",
      message: "This doesn't look like the same papaya as in its last photo.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText("Not the same plant as last time")).toBeInTheDocument();
    expect(screen.getByText(/7 days ago this plant was fruiting/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Assessment/ })).toBeDisabled();
  });
});
