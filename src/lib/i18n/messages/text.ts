import { defineMessages } from "../define";

/**
 * Text-field validation (lib/text-validation.ts). The same rules run again
 * in Django (accounts/text_validation.py).
 */
export const text = defineMessages({
  "text.required": { en: "{label} is required.", fil: "Kailangan ang {label}.", bik: "Kinahanglan an {label}." },
  "text.nameTooLong": {
    en: "{label} must be {max} characters or fewer.",
    fil: "Dapat {max} na character o mas kaunti ang {label}.",
    bik: "Dapat {max} na character o mas dikit an {label}.",
  },
  "text.nameChars": {
    en: "{label} can only contain letters, spaces, hyphens (-), apostrophes (') and periods (.).",
    fil: "Letra, espasyo, gitling (-), kudlit (') at tuldok (.) lang ang puwede sa {label}.",
    bik: "Letra, espasyo, gitling (-), kudlit (') asin tuldok (.) sana an puwede sa {label}.",
  },
  "text.nameShort": {
    en: "{label} must have at least 2 letters.",
    fil: "Dapat may hindi bababa sa 2 letra ang {label}.",
    bik: "Dapat may dai mababa sa 2 letra an {label}.",
  },
  "text.nameFake": {
    en: "{label} does not look like a real name.",
    fil: "Mukhang hindi totoong pangalan ang {label}.",
    bik: "Garo dai totoo na pangaran an {label}.",
  },
  "text.tooLong": {
    en: "Please keep {label} under {max} characters.",
    fil: "Panatilihing mas maikli sa {max} na character ang {label}.",
    bik: "Dapat mas halipot sa {max} na character an {label}.",
  },
  "text.noHtml": {
    en: "{label} cannot contain code or HTML tags.",
    fil: "Hindi puwedeng may code o HTML tag ang {label}.",
    bik: "Dai puwede na may code o HTML tag an {label}.",
  },
  "text.noLinks": {
    en: "{label} cannot contain links. Describe what you see instead.",
    fil: "Hindi puwedeng may link ang {label}. Ilarawan na lang ang nakikita mo.",
    bik: "Dai puwede na may link an {label}. Ilarawan na sana an nahihiling mo.",
  },
  "text.needsWords": {
    en: "{label} must describe something in words, not only numbers or symbols.",
    fil: "Dapat ilarawan sa salita ang {label}, hindi lang numero o simbolo.",
    bik: "Dapat ilarawan sa tataramon an {label}, bako sana numero o simbolo.",
  },
  "text.repeated": {
    en: "{label} has a character repeated too many times.",
    fil: "May letrang paulit-ulit nang sobra sa {label}.",
    bik: "May letra na sobra an pagbalik-balik sa {label}.",
  },
  "text.gibberish": {
    en: "{label} does not look like real words. Please describe it plainly.",
    fil: "Mukhang hindi totoong salita ang {label}. Ilarawan ito nang malinaw.",
    bik: "Garo dai totoo na tataramon an {label}. Ilarawan ini nin malinaw.",
  },
  "text.soilNotesLabel": {
    en: "Additional soil information",
    fil: "Karagdagang impormasyon sa lupa",
    bik: "Dugang na impormasyon sa daga",
  },
  "text.assessmentNotesLabel": { en: "Your notes", fil: "Ang iyong tala", bik: "An imo nota" },
});
