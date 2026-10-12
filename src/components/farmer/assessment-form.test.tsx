import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentForm } from "@/components/farmer/assessment-form";
import type { EvidenceValidation } from "@/lib/api/risk-api";

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

function renderForm() {
  render(<AssessmentForm plantId={7} plantLabel="Sinta" cropName="Papaya" />);
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
    expect(screen.getByRole("combobox", { name: /Overall health/ })).toHaveTextContent(
      "Slightly unhealthy",
    );
    expect(screen.getByRole("combobox", { name: /Leaf condition/ })).toHaveTextContent(
      "Spots or lesions",
    );
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

    await user.click(screen.getByRole("combobox", { name: /Overall health/ }));
    await user.click(await screen.findByRole("option", { name: "Unhealthy" }));
    await user.upload(screen.getByLabelText("Take photo"), photo());

    expect(await screen.findByText(/1 answer was filled in from your photo/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Overall health/ })).toHaveTextContent(/^Unhealthy$/);
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
