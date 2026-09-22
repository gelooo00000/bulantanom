/**
 * One line per message, with all three languages side by side, so a
 * reviewer can check the Filipino and Bikol against the English without
 * hunting through separate files. TypeScript refuses an entry that is
 * missing a language.
 *
 * Placeholders are written `{name}` and filled in by `t(key, { name })`.
 */
export type Entry = { en: string; fil: string; bik: string };

export function defineMessages<const T extends Record<string, Entry>>(messages: T): T {
  return messages;
}
