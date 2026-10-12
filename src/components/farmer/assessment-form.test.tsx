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

/** The answer chosen for one question. */
function chosen(question: RegExp) {
  const group = screen.getByRole("radiogroup", { name: question });
  return within(group).getByRole("radio", { checked: true });
}

beforeEach(() => {
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

  it("offers this crop's pests and saves ticks and typed text as one answer", async () => {
    validateEvidence.mockResolvedValue(ACCEPTED);
    submitAssessment.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    const pests = screen.getByRole("group", { name: "Pests you have seen" });
    // Papaya's list, not every pest there is.
    expect(within(pests).getByRole("checkbox", { name: /Mealybugs/ })).toBeInTheDocument();
    expect(within(pests).queryByRole("checkbox", { name: /Rats/ })).toBeNull();

    await user.click(within(pests).getByRole("checkbox", { name: /Whiteflies/ }));
    await user.click(within(pests).getByRole("checkbox", { name: /Mealybugs/ }));
    const [pestOther] = screen.getAllByPlaceholderText("Describe what you saw");
    await user.type(pestOther, "maliit na uod");

    await user.upload(screen.getByLabelText("Take photo"), photo());
    await screen.findByText(/filled in from your photo/);
    await user.click(screen.getByRole("button", { name: /Submit Assessment/ }));

    await waitFor(() => expect(submitAssessment).toHaveBeenCalled());
    const [, , fields] = submitAssessment.mock.calls[0];
    expect(fields.pest_observation).toBe(
      "Mealybugs or scale insects; Whiteflies; Other: maliit na uod",
    );
    expect(fields.disease_observation).toBe("");
  });
});
