import { defineMessages } from "../define";

/** Words used across many Farmer screens, and the calendar. */
export const common = defineMessages({
  "common.loading": { en: "Loading…", fil: "Naglo-load…", bik: "Hulat anay…" },
  "common.tryAgain": { en: "Try again", fil: "Subukan muli", bik: "Probaran liwat" },
  "common.cancel": { en: "Cancel", fil: "Kanselahin", bik: "Kanselahon" },
  "common.save": { en: "Save", fil: "I-save", bik: "I-save" },
  "common.back": { en: "Back", fil: "Bumalik", bik: "Balik" },
  "common.continue": { en: "Continue", fil: "Magpatuloy", bik: "Padayon" },
  "common.delete": { en: "Delete", fil: "Burahin", bik: "Paraon" },
  "common.close": { en: "Close", fil: "Isara", bik: "Sararhan" },
  "common.viewAll": { en: "View all", fil: "Tingnan lahat", bik: "Hilingon ngatanan" },
  "common.today": { en: "Today", fil: "Ngayon", bik: "Yana" },
  "common.days": { en: "{n} days", fil: "{n} araw", bik: "{n} adlaw" },
  "common.day": { en: "{n} day", fil: "{n} araw", bik: "{n} adlaw" },
  "common.loadFailed": {
    en: "Unable to load this. Please try again.",
    fil: "Hindi ito ma-load. Pakisubukan muli.",
    bik: "Dili ini ma-load. Probaran tabi liwat.",
  },

  "risk.LOW": { en: "Low", fil: "Mababa", bik: "Hababa" },
  "risk.MEDIUM": { en: "Medium", fil: "Katamtaman", bik: "Tunga-tunga" },
  "risk.HIGH": { en: "High", fil: "Mataas", bik: "Hataas" },
  "risk.lowRisk": { en: "Low risk", fil: "Mababang panganib", bik: "Hababa na peligro" },
  "risk.mediumRisk": {
    en: "Medium risk",
    fil: "Katamtamang panganib",
    bik: "Tunga-tunga na peligro",
  },
  "risk.highRisk": { en: "High risk", fil: "Mataas na panganib", bik: "Hataas na peligro" },
  "risk.notAssessed": { en: "Not assessed", fil: "Hindi pa nasuri", bik: "Dili pa nasusi" },

  "calendar.placeholder": {
    en: "Select a date",
    fil: "Pumili ng petsa",
    bik: "Pili san petsa",
  },
  "calendar.dialog": {
    en: "Choose planting date",
    fil: "Pumili ng petsa ng pagtatanim",
    bik: "Pili san petsa san pagtanom",
  },
  "calendar.previous": {
    en: "Previous month",
    fil: "Nakaraang buwan",
    bik: "Nakaagi na bulan",
  },
  "calendar.next": { en: "Next month", fil: "Susunod na buwan", bik: "Masunod na bulan" },
  "calendar.month": { en: "Month", fil: "Buwan", bik: "Bulan" },
  "calendar.year": { en: "Year", fil: "Taon", bik: "Taon" },

  // Filipino and Bikol both use the Spanish-derived month names.
  "month.0": { en: "January", fil: "Enero", bik: "Enero" },
  "month.1": { en: "February", fil: "Pebrero", bik: "Pebrero" },
  "month.2": { en: "March", fil: "Marso", bik: "Marso" },
  "month.3": { en: "April", fil: "Abril", bik: "Abril" },
  "month.4": { en: "May", fil: "Mayo", bik: "Mayo" },
  "month.5": { en: "June", fil: "Hunyo", bik: "Hunyo" },
  "month.6": { en: "July", fil: "Hulyo", bik: "Hulyo" },
  "month.7": { en: "August", fil: "Agosto", bik: "Agosto" },
  "month.8": { en: "September", fil: "Setyembre", bik: "Setyembre" },
  "month.9": { en: "October", fil: "Oktubre", bik: "Oktubre" },
  "month.10": { en: "November", fil: "Nobyembre", bik: "Nobyembre" },
  "month.11": { en: "December", fil: "Disyembre", bik: "Disyembre" },

  // Sunday is Linggo in Filipino but Domingo in Bikol.
  "weekday.0": { en: "Su", fil: "Lin", bik: "Dom" },
  "weekday.1": { en: "Mo", fil: "Lun", bik: "Lun" },
  "weekday.2": { en: "Tu", fil: "Mar", bik: "Mar" },
  "weekday.3": { en: "We", fil: "Miy", bik: "Miy" },
  "weekday.4": { en: "Th", fil: "Huw", bik: "Huw" },
  "weekday.5": { en: "Fr", fil: "Biy", bik: "Biy" },
  "weekday.6": { en: "Sa", fil: "Sab", bik: "Sab" },
});
