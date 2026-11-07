import { englishT, type Translate } from "@/lib/i18n";

/**
 * Rules for the free-text fields people type into - the browser copy of
 * backend/accounts/text_validation.py. Django checks again; this copy shows
 * the problem beside the field before anything is sent.
 *
 * Language-neutral on purpose, so English, Filipino and Bikol all pass.
 */

export const NAME_MAX = 50;
export const SOIL_NOTES_MAX = 2000;
export const ASSESSMENT_NOTES_MAX = 1000;

const NAME_ALLOWED = /^\p{L}+(?:[ \-'.’]+\p{L}*)*$/u;
const LETTER = /\p{L}/gu;
const REPEATED = /(.)\1{4,}/iu; // 5+ of the same character in a row
const URL = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|ph|io|xyz)\b)/i;
const HTML = /<[^>]*>/;
const WORD = /\p{L}+/gu;
const VOWELS = /[aeiouyáéíóúàèìòùâêîôûäëïöü]/i;

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Why `value` is not an acceptable name, or null when it is. */
export function nameProblem(
  value: string,
  label: string,
  { required = true, t = englishT }: { required?: boolean; t?: Translate } = {},
): string | null {
  const text = cleanText(value);
  if (!text) return required ? t("text.required", { label }) : null;
  if (text.length > NAME_MAX) return t("text.nameTooLong", { label, max: NAME_MAX });
  if (!NAME_ALLOWED.test(text)) return t("text.nameChars", { label });
  if ((text.match(LETTER) ?? []).length < 2) return t("text.nameShort", { label });
  if (REPEATED.test(text)) return t("text.nameFake", { label });
  return null;
}

/** Why optional free text is not acceptable, or null when it is. */
export function notesProblem(
  value: string,
  label: string,
  max: number,
  t: Translate = englishT,
): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) return t("text.tooLong", { label, max });
  if (HTML.test(text)) return t("text.noHtml", { label });
  if (URL.test(text)) return t("text.noLinks", { label });
  const words = text.match(WORD) ?? [];
  if (words.join("").length < 3) return t("text.needsWords", { label });
  if (REPEATED.test(text)) return t("text.repeated", { label });
  for (const word of words) {
    const noVowel = word.length >= 6 && !VOWELS.test(word);
    if (noVowel || word.length > 30) return t("text.gibberish", { label });
  }
  return null;
}
