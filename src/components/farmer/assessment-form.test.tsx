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

let recentWeather: unknown = { available: false };
vi.mock("@/lib/api/weather-api", () => ({
  fetchRecentFarmWeather: () => Promise.resolve(recentWeather),
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
      cropName="Papaya"
      cropId="papaya"
      lastAssessment={lastAssessment}
    />,
  );
}

/** Growth and watering: the answers a photo never gives. */
async function answerTheRest(user: ReturnType<typeof userEvent.setup>) {
  const growth = screen.getByRole("radiogroup", { name: /Growth compared/ });
  await user.click(within(growth).getByRole("radio", { name: "About as expected" }));
  const watering = screen.getByRole("radiogroup", { name: /Watering frequency/ });
  await user.click(within(watering).getByRole("radio", { name: "Daily" }));
}

/** The answer chosen for one question. */
function chosen(question: RegExp) {
  const group = screen.getByRole("radiogroup", { name: question });
  return within(group).getByRole("radio", { checked: true });
}

beforeEach(() => {
  window.localStorage.clear();
  recentWeather = { available: false };
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
  it("lets an optional answer be cleared by tapping it again", async () => {
    const user = userEvent.setup();
    renderForm();

    const flowering = screen.getByRole("radiogroup", { name: /Flowering status/ });
    const starting = within(flowering).getByRole("radio", { name: "Starting to flower" });
    await user.click(starting);
    expect(starting).toBeChecked();
    await user.click(starting);
    expect(within(flowering).queryByRole("radio", { checked: true })).toBeNull();
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

  it("shows the farm's week of weather and sends no weather text itself", async () => {
    recentWeather = {
      available: true,
      days: 7,
      from: "2026-10-06",
      to: "2026-10-12",
      rain_total_mm: 42.5,
      rainy_days: 4,
      wettest_day_mm: 25.5,
      temperature_max_c: 32,
      temperature_min_c: 23,
    };
    validateEvidence.mockResolvedValue(ACCEPTED);
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    expect(
      await screen.findByText(
        "Weather at the farm, last 7 days: 42.5 mm of rain on 4 days, 23–32°C.",
      ),
    ).toBeInTheDocument();

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

    for (const question of [/Growth compared/, /Overall health/, /Leaf condition/, /Watering frequency/]) {
      const group = screen.getByRole("radiogroup", { name: question });
      expect(within(group).queryByRole("radio", { checked: true })).toBeNull();
    }
  });

  it("names each missing item and marks the unanswered required questions", () => {
    renderForm();

    expect(screen.getByText("To submit, still needed:")).toBeInTheDocument();
    for (const item of [
      "Plant photo",
      "Growth compared with expected",
      "Overall health",
      "Leaf condition",
      "Watering frequency",
    ]) {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Required")).toHaveLength(4);
  });

  it("drops an item once it is answered", async () => {
    const user = userEvent.setup();
    renderForm();

    const leaves = screen.getByRole("radiogroup", { name: /Leaf condition/ });
    await user.click(within(leaves).getByRole("radio", { name: "Healthy green leaves" }));

    expect(screen.queryByRole("button", { name: "Leaf condition" })).toBeNull();
    expect(screen.getAllByText("Required")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Plant photo" })).toBeInTheDocument();
  });
});

describe("Weekly assessment: draft", () => {
  async function answerSome() {
    const user = userEvent.setup();
    const view = render(
      <AssessmentForm plantId={7} plantLabel="Sinta" cropName="Papaya" cropId="papaya" />,
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
