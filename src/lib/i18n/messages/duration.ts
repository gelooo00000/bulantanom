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

  "calendarChart.title": { en: "Harvest calendar", fil: "Kalendaryo ng ani", bik: "Kalendaryo san ani" },
  "calendarChart.summaryNone": {
    en: "No harvests due in the next 12 months.",
    fil: "Walang aanihin sa susunod na 12 buwan.",
    bik: "Waray aanihon sa masunod na 12 bulan.",
  },
  "calendarChart.summary": {
    en: "{n} ready in the next 12 months · {ready} ready now{later}",
    fil: "{n} ang aanihin sa susunod na 12 buwan · {ready} ang handa na{later}",
    bik: "{n} an aanihon sa masunod na 12 bulan · {ready} an pwede na{later}",
  },
  "calendarChart.later": {
    en: " · {n} after that",
    fil: " · {n} pagkatapos noon",
    bik: " · {n} pakatapos kaidto",
  },
  "calendarChart.month": { en: "Month", fil: "Buwan", bik: "Bulan" },
  "calendarChart.unit": { en: "plant", fil: "tanim", bik: "tanom" },
  "calendarChart.name": {
    en: "Plants ready to harvest each month for the next 12 months.",
    fil: "Mga tanim na aanihin bawat buwan sa susunod na 12 buwan.",
    bik: "Mga tanom na aanihon kada bulan sa masunod na 12 bulan.",
  },
  "calendarChart.hint": {
    en: "Point at a month to see which plants are ready in it.",
    fil: "Ituro ang isang buwan para makita kung aling tanim ang handa.",
    bik: "Ituro an sarong bulan para mahiling kun arin na tanom an pwede na.",
  },
  "calendarChart.due": {
    en: "Ready in {month} · {n}",
    fil: "Handa sa {month} · {n}",
    bik: "Pwede sa {month} · {n}",
  },
  "calendarChart.none": {
    en: "Nothing is ready in this month.",
    fil: "Walang aanihin sa buwang ito.",
    bik: "Waray aanihon sa bulan na ini.",
  },
  "calendarChart.laterNoteOne": {
    en: "1 more plant is further away than 12 months — a tree crop takes years.",
    fil: "1 pang tanim ang lampas sa 12 buwan — ilang taon ang punong-kahoy.",
    bik: "1 pa na tanom an labi sa 12 bulan — pira na taon an kahoy.",
  },
  "calendarChart.laterNote": {
    en: "{n} more plants are further away than 12 months, including tree crops that take years.",
    fil: "{n} pang tanim ang lampas sa 12 buwan, kabilang ang mga punong tumatagal ng ilang taon.",
    bik: "{n} pa na tanom an labi sa 12 bulan, kaiba an mga kahoy na naghahaloy nin pira na taon.",
  },
});
