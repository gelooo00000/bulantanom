import { defineMessages } from "../define";

/** Lengths of time, and the Harvest page's plainer wording. */
export const duration = defineMessages({
  "duration.day": { en: "{n} day", fil: "{n} araw", bik: "{n} adlaw" },
  "duration.days": { en: "{n} days", fil: "{n} araw", bik: "{n} adlaw" },
  "duration.week": { en: "about 1 week", fil: "mga 1 linggo", bik: "mga 1 semana" },
  "duration.weeks": { en: "about {n} weeks", fil: "mga {n} linggo", bik: "mga {n} semana" },
  "duration.month": { en: "about 1 month", fil: "mga 1 buwan", bik: "mga 1 bulan" },
  "duration.months": { en: "about {n} months", fil: "mga {n} buwan", bik: "mga {n} bulan" },
  "duration.year": { en: "about 1 year", fil: "mga 1 taon", bik: "mga 1 taon" },
  "duration.years": { en: "about {n} years", fil: "mga {n} taon", bik: "mga {n} taon" },
  "duration.yearMonths": {
    en: "about 1 year {months} months",
    fil: "mga 1 taon {months} buwan",
    bik: "mga 1 taon {months} bulan",
  },
  "duration.yearsMonths": {
    en: "about {years} years {months} months",
    fil: "mga {years} taon {months} buwan",
    bik: "mga {years} taon {months} bulan",
  },

  // Plainer replacements for "Window opens / closes / length".
  "harvestCard.readyFrom": { en: "Ready from", fil: "Puwedeng anihin mula", bik: "Pwede anihon poon" },
  "harvestCard.readyUntil": { en: "Ready until", fil: "Hanggang", bik: "Sagkod" },
  "harvestCard.lasts": {
    en: "You can harvest for",
    fil: "Puwedeng anihin nang",
    bik: "Pwede anihon sulod san",
  },
  "harvestCard.grown": {
    en: "{done} of {total} grown",
    fil: "{done} sa {total} ang lumaki",
    bik: "{done} sa {total} an nagdakula",
  },
  "harvestCard.toGo": { en: "{time} to go", fil: "{time} pa", bik: "{time} pa" },
  "harvestCard.startsIn": { en: "Starts in {time}", fil: "Magsisimula sa {time}", bik: "Mapoon sa {time}" },
  "harvestCard.closedAgo": {
    en: "Ended {time} ago",
    fil: "Natapos {time} na ang nakalipas",
    bik: "Natapos {time} na an naagi",
  },
  "harvestCard.readyLeft": {
    en: "Ready now · {time} left",
    fil: "Handa na · {time} na lang",
    bik: "Pwede na · {time} na sana",
  },

  "calendarChart.title": {
    en: "Harvests by month",
    fil: "Ani bawat buwan",
    bik: "Ani kada bulan",
  },
  "calendarChart.summary": {
    en: "{n} plants ready to harvest in the next 12 months",
    fil: "{n} tanim ang aanihin sa susunod na 12 buwan",
    bik: "{n} tanom an aanihon sa masunod na 12 bulan",
  },
  "calendarChart.summaryOne": {
    en: "1 plant ready to harvest in the next 12 months",
    fil: "1 tanim ang aanihin sa susunod na 12 buwan",
    bik: "1 tanom an aanihon sa masunod na 12 bulan",
  },
  "calendarChart.summaryNone": {
    en: "No harvests in the next 12 months.",
    fil: "Walang aanihin sa susunod na 12 buwan.",
    bik: "Waray aanihon sa masunod na 12 bulan.",
  },
  "calendarChart.later": {
    en: "+ {n} more later than 12 months (tree crops take years)",
    fil: "+ {n} pa na lampas sa 12 buwan (ilang taon ang punong-kahoy)",
    bik: "+ {n} pa na labi sa 12 bulan (pira na taon an kahoy)",
  },
});
