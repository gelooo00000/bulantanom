import { useCallback, useSyncExternalStore } from "react";

import { MESSAGES, type MessageKey } from "./messages";

export type { MessageKey } from "./messages";

/**
 * The Farmer's reading language: English, Filipino, or Bikol as spoken in
 * Bulan, Sorsogon.
 *
 * Only the Farmer screens are translated. LGU and admin stay in English, the
 * language officers already work in. The choice is kept per device, and
 * English is the default, so nobody sees a change until they pick one.
 */
export type Language = "en" | "fil" | "bik";

export const LANGUAGES: { code: Language; name: string; short: string }[] = [
  { code: "en", name: "English", short: "EN" },
  { code: "fil", name: "Filipino", short: "FIL" },
  { code: "bik", name: "Bikol (Bulan)", short: "BIK" },
];

/** Locale for dates and numbers. Bikol has none of its own; Filipino's
 *  month names (Enero, Pebrero…) are the ones used in Bulan too. */
export const DATE_LOCALE: Record<Language, string> = {
  en: "en-PH",
  fil: "fil-PH",
  bik: "fil-PH",
};

const STORAGE_KEY = "bulantanom.language";
const listeners = new Set<() => void>();

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "fil" || value === "bik";
}

function readLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : "en";
  } catch {
    // Private windows and blocked storage fall back to English.
    return "en";
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changing the language updates this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Still switches for this visit; it just will not be remembered.
  }
  listeners.forEach((listener) => listener());
}

export type Vars = Record<string, string | number>;

export function translate(language: Language, key: MessageKey, vars?: Vars): string {
  const text = MESSAGES[key][language] || MESSAGES[key].en;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translate = (key: MessageKey, vars?: Vars) => string;

/** The default for plain helper functions that take an optional `t`. */
export const englishT: Translate = (key, vars) => translate("en", key, vars);

/**
 * `t(key, vars)` in the Farmer's language.
 *
 * The server always renders English and the saved choice applies straight
 * after hydration, so there is never a hydration mismatch. Pass
 * `enabled = false` from a component shared with LGU or admin screens to
 * keep those in English.
 */
export function useLanguage(enabled = true) {
  const saved = useSyncExternalStore(subscribe, readLanguage, () => "en" as const);
  const language: Language = enabled ? saved : "en";
  const t = useCallback<Translate>(
    (key, vars) => translate(language, key, vars),
    [language],
  );
  return { language, setLanguage, t, dateLocale: DATE_LOCALE[language] };
}

/**
 * For components shared between the Farmer and the LGU screens (risk
 * badges, result cards): translated on /farmer pages, English elsewhere.
 *
 * Reading the address during render is safe for hydration, because the
 * server and the first client render both use English regardless.
 */
export function useFarmerLanguage() {
  const onFarmerPage =
    typeof window !== "undefined" && window.location.pathname.startsWith("/farmer");
  return useLanguage(onFarmerPage);
}
