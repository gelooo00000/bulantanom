import { defineMessages } from "../define";

/** One plant's page, and the card shown when its assessment is locked. */
export const plantDetail = defineMessages({
  "detail.loading": { en: "Loading plant…", fil: "Kinukuha ang tanim…", bik: "Kinukuha an tanom…" },
  "detail.loadFailed": {
    en: "Unable to load this plant.",
    fil: "Hindi ma-load ang tanim na ito.",
    bik: "Dili ma-load an tanom na ini.",
  },
  "detail.notFound": {
    en: "This plant could not be found in your records.",
    fil: "Hindi makita ang tanim na ito sa iyong talaan.",
    bik: "Dili makita an tanom na ini sa imo rekord.",
  },
  "detail.plantingDate": { en: "Planting date", fil: "Petsa ng pagtatanim", bik: "Petsa san pagtanom" },
  "detail.age": { en: "Current age", fil: "Kasalukuyang edad", bik: "Edad yana" },
  "detail.ageValue": { en: "{n} days", fil: "{n} araw", bik: "{n} adlaw" },
  "detail.status": { en: "Status", fil: "Kalagayan", bik: "Kamutangan" },
  "detail.harvestFrom": { en: "Harvest from", fil: "Ani mula", bik: "Ani poon" },
  "detail.harvestUntil": { en: "Harvest until", fil: "Ani hanggang", bik: "Ani sagkod" },
  "detail.overview": { en: "Overview", fil: "Pangkalahatan", bik: "Kabuuan" },
  "detail.assessments": { en: "Assessments", fil: "Mga Pagsusuri", bik: "Mga Pagsusi" },
  "detail.about": { en: "About {name}", fil: "Tungkol sa {name}", bik: "Manungod sa {name}" },
  "detail.typical": {
    en: "Typical growing period {growing} days, with a harvest window of about {window} days. Actual timing varies with weather, soil and plant health.",
    fil: "Karaniwang tagal ng paglaki ay {growing} araw, at ang panahon ng ani ay mga {window} araw. Nag-iiba ang aktwal na panahon depende sa panahon, lupa at kalusugan ng tanim.",
    bik: "Normal na kaluwagan san pagdakula {growing} adlaw, asin an panahon san ani mga {window} adlaw. Nagbabago an totoo na panahon segun sa klima, daga asin salud san tanom.",
  },
  "detail.typicalNoVariety": {
    en: "Typical growing period {growing} days, with a harvest window of about {window} days. Actual timing varies with variety, weather, soil and plant health.",
    fil: "Karaniwang tagal ng paglaki ay {growing} araw, at ang panahon ng ani ay mga {window} araw. Nag-iiba ang aktwal na panahon depende sa uri, panahon, lupa at kalusugan ng tanim.",
    bik: "Normal na kaluwagan san pagdakula {growing} adlaw, asin an panahon san ani mga {window} adlaw. Nagbabago an totoo na panahon segun sa klase, klima, daga asin salud san tanom.",
  },
  "detail.noAssessment": {
    en: "No assessment yet",
    fil: "Wala pang pagsusuri",
    bik: "Waray pa pagsusi",
  },
  "detail.noAssessmentText": {
    en: "Start this plant's first weekly assessment to get an AI risk reading.",
    fil: "Simulan ang unang lingguhang pagsusuri ng tanim na ito para makakuha ng resulta ng panganib mula sa AI.",
    bik: "Poonan an enot na pagsusi kada semana san tanom na ini para makakua san resulta san peligro hali sa AI.",
  },
  "detail.start": {
    en: "Start Weekly Assessment",
    fil: "Simulan ang Lingguhang Pagsusuri",
    bik: "Poonan an Pagsusi kada Semana",
  },
  "detail.completed": {
    en: "Assessment Completed",
    fil: "Tapos na ang Pagsusuri",
    bik: "Tapos na an Pagsusi",
  },
  "detail.nextIn": {
    en: "Next assessment in {n} days",
    fil: "Susunod na pagsusuri sa loob ng {n} araw",
    bik: "Masunod na pagsusi sa sulod san {n} adlaw",
  },
  "detail.nextInOne": {
    en: "Next assessment in 1 day",
    fil: "Susunod na pagsusuri bukas",
    bik: "Masunod na pagsusi buwas",
  },

  "lock.today": { en: "today", fil: "ngayon", bik: "yana" },
  "lock.inOne": { en: "in 1 day", fil: "bukas", bik: "buwas" },
  "lock.inDays": { en: "in {n} days", fil: "sa loob ng {n} araw", bik: "sa sulod san {n} adlaw" },
  "lock.notPlanted": { en: "Not planted yet", fil: "Hindi pa naitatanim", bik: "Dili pa natatanom" },
  "lock.plannedText": {
    en: "{name} is planned for {date}. You can assess it from that day — {when}.",
    fil: "Nakaplano ang {name} sa {date}. Masusuri mo ito simula sa araw na iyon — {when}.",
    bik: "Nakaplano an {name} sa {date}. Pwede mo ini susihon poon sa adlaw na idto — {when}.",
  },
  "lock.laterDate": { en: "a later date", fil: "isang susunod na petsa", bik: "masunod na petsa" },
  "lock.doneTitle": {
    en: "Weekly Assessment Completed",
    fil: "Tapos na ang Lingguhang Pagsusuri",
    bik: "Tapos na an Pagsusi kada Semana",
  },
  "lock.doneText": {
    en: "You have already completed this week's assessment for {name}. Your next assessment will be available {when}.",
    fil: "Natapos mo na ang pagsusuri ngayong linggo para sa {name}. Magagawa mo ang susunod na pagsusuri {when}.",
    bik: "Natapos mo na an pagsusi ngunyan na semana para sa {name}. Magagibo mo an masunod na pagsusi {when}.",
  },
  "lock.first": { en: "First assessment", fil: "Unang pagsusuri", bik: "Enot na pagsusi" },
  "lock.next": { en: "Next assessment", fil: "Susunod na pagsusuri", bik: "Masunod na pagsusi" },
  "lock.availableNow": { en: "Available now", fil: "Puwede na ngayon", bik: "Pwede na yana" },
  "lock.last": {
    en: "Last assessed {date} · one assessment per {n} days.",
    fil: "Huling nasuri {date} · isang pagsusuri bawat {n} araw.",
    bik: "Huri na nasusi {date} · saro na pagsusi kada {n} adlaw.",
  },
  "lock.backToPlant": { en: "Back to plant", fil: "Bumalik sa tanim", bik: "Balik sa tanom" },
  "lock.past": {
    en: "View past assessments",
    fil: "Tingnan ang mga nakaraang pagsusuri",
    bik: "Hilingon an mga nakaagi na pagsusi",
  },
});
