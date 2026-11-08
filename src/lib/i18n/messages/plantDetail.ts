import { defineMessages } from "../define";

/** Loading a plant for its assessment, and the card shown when that is locked. */
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

  "lock.today": { en: "today", fil: "ngayon", bik: "yana" },
  "lock.inOne": { en: "in 1 day", fil: "bukas", bik: "buwas" },
  "lock.inDays": { en: "in {n} days", fil: "sa loob ng {n} araw", bik: "sa sulod san {n} adlaw" },
  "lock.harvestedTitle": {
    en: "Harvested",
    fil: "Naani na",
    bik: "Naani na",
  },
  "lock.harvestedText": {
    en: "{name} has been harvested, so there are no more weekly assessments. Its harvest report is in the Harvest Archive.",
    fil: "Naani na ang {name}, kaya wala nang lingguhang pagsusuri. Nasa Archive ng Anihan ang ulat ng ani nito.",
    bik: "Naani na an {name}, kaya mayo na nin semanal na pagsusi. Nasa Archive kan Pag-ani an report san ani kaini.",
  },
  "lock.lostTitle": { en: "Lost", fil: "Namatay", bik: "Nagadan" },
  "lock.lostText": {
    en: "{name} was reported lost, so there are no more weekly assessments. Its loss report is in the Harvest Archive.",
    fil: "Naiulat na namatay ang {name}, kaya wala nang lingguhang pagsusuri. Nasa Archive ng Anihan ang ulat nito.",
    bik: "Na-report na nagadan an {name}, kaya mayo na nin semanal na pagsusi. Nasa Archive kan Pag-ani an report kaini.",
  },
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
  "lock.past": {
    en: "View past assessments",
    fil: "Tingnan ang mga nakaraang pagsusuri",
    bik: "Hilingon an mga nakaagi na pagsusi",
  },
});
