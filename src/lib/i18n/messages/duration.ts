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

  "timeline.title": { en: "Harvest timeline", fil: "Takdang panahon ng ani", bik: "Panahon san ani" },
  "timeline.summary": {
    en: "{n} to harvest in the next {months} months · {ready} ready now",
    fil: "{n} ang aanihin sa susunod na {months} buwan · {ready} ang handa na",
    bik: "{n} an aanihon sa masunod na {months} bulan · {ready} an pwede na",
  },
  "timeline.summaryNone": {
    en: "Nothing to harvest in the next {months} months.",
    fil: "Walang aanihin sa susunod na {months} buwan.",
    bik: "Waray aanihon sa masunod na {months} bulan.",
  },
  "timeline.rangeLabel": { en: "How far ahead", fil: "Gaano kalayo", bik: "Gurano kaharayo" },
  "timeline.range": { en: "{n} mo", fil: "{n} buwan", bik: "{n} bulan" },
  "timeline.readyNow": { en: "Ready now", fil: "Handa na", bik: "Pwede na" },
  "timeline.tomorrow": { en: "Ready tomorrow", fil: "Handa bukas", bik: "Pwede buwas" },
  "timeline.in": { en: "in {time}", fil: "sa loob ng {time}", bik: "sa sulod san {time}" },
  "timeline.window": {
    en: "Harvest from {from} to {to} · about {time}",
    fil: "Anihin mula {from} hanggang {to} · mga {time}",
    bik: "Anihon poon {from} sagkod {to} · mga {time}",
  },
  "timeline.todayKey": { en: "Today, {date}", fil: "Ngayon, {date}", bik: "Yana, {date}" },
  "timeline.hint": {
    en: "Tap a plant for its dates.",
    fil: "I-tap ang tanim para sa mga petsa.",
    bik: "I-tap an tanom para sa mga petsa.",
  },
  "timeline.later": {
    en: "Later than {months} months ({n})",
    fil: "Lampas sa {months} buwan ({n})",
    bik: "Labi sa {months} bulan ({n})",
  },
});
