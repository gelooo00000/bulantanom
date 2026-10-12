/**
 * An unsent weekly assessment, kept on the phone while the farmer fills it
 * in, so a dropped signal, a closed browser or a switch to another app does
 * not lose their answers.
 *
 * Only what the farmer chose themselves is kept (answers they tapped, height,
 * notes, ticked symptoms); the photo is not, since it must be taken fresh,
 * and suggestions from the photo or the last check are made again. A draft
 * comes back only on the day it was saved: by the next day the plant may
 * look different, so starting over is the honest default.
 *
 * Browser storage can be missing or full (private windows, old phones); every
 * call fails quietly and the form simply works without a draft.
 */

export type AssessmentDraft = {
  /** Local date it was saved, YYYY-MM-DD. */
  savedOn: string;
  /** The farmer's own choice answers; "" means they cleared an optional one. */
  answers: Record<string, string>;
  height: string;
  notes: string;
  pests: string[];
  diseases: string[];
};

type DraftContent = Omit<AssessmentDraft, "savedOn">;

const key = (plantId: number) => `bulantanom:assessment-draft:${plantId}`;

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function readDraft(plantId: number): AssessmentDraft | null {
  try {
    const raw = window.localStorage.getItem(key(plantId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<AssessmentDraft>;
    const valid =
      typeof draft.savedOn === "string" &&
      typeof draft.answers === "object" &&
      draft.answers !== null &&
      Object.values(draft.answers).every((value) => typeof value === "string") &&
      typeof draft.height === "string" &&
      typeof draft.notes === "string" &&
      isStrings(draft.pests) &&
      isStrings(draft.diseases);
    if (!valid || draft.savedOn !== today()) {
      window.localStorage.removeItem(key(plantId));
      return null;
    }
    return draft as AssessmentDraft;
  } catch {
    return null;
  }
}

/** Keeps the draft, or removes it when nothing in it is the farmer's own. */
export function saveDraft(plantId: number, content: DraftContent): void {
  const empty =
    Object.keys(content.answers).length === 0 &&
    !content.height.trim() &&
    !content.notes.trim() &&
    content.pests.length === 0 &&
    content.diseases.length === 0;
  try {
    if (empty) {
      window.localStorage.removeItem(key(plantId));
    } else {
      window.localStorage.setItem(key(plantId), JSON.stringify({ ...content, savedOn: today() }));
    }
  } catch {
    // No storage: the form still works, just without a draft.
  }
}

export function clearDraft(plantId: number): void {
  try {
    window.localStorage.removeItem(key(plantId));
  } catch {
    // Nothing to clear.
  }
}
