import { defineMessages } from "../define";

/** Risk readings: badges, counts, assessment rows, the full AI result card. */
export const risk = defineMessages({
  "riskBadge.low": { en: "Low Risk", fil: "Mababang Panganib", bik: "Hababa na Peligro" },
  "riskBadge.medium": {
    en: "Medium Risk",
    fil: "Katamtamang Panganib",
    bik: "Tunga-tunga na Peligro",
  },
  "riskBadge.high": { en: "High Risk", fil: "Mataas na Panganib", bik: "Hataas na Peligro" },
  "riskCounts.noReading": {
    en: "No reading yet",
    fil: "Wala pang resulta",
    bik: "Waray pa resulta",
  },

  "row.noReading": { en: "No reading", fil: "Walang resulta", bik: "Waray resulta" },
  "row.day": { en: "day {n}", fil: "ika-{n} araw", bik: "ika-{n} adlaw" },
  "row.unavailable": {
    en: "AI risk analysis was not available for this assessment.",
    fil: "Hindi naging available ang AI na pagsusuri ng panganib para sa pagsusuring ito.",
    bik: "Dili nakaabot an AI na pagsusi san peligro para sa pagsusi na ini.",
  },
  "row.viewPhoto": { en: "View photo", fil: "Tingnan ang litrato", bik: "Hilingon an litrato" },
  "row.hidePhoto": { en: "Hide photo", fil: "Itago ang litrato", bik: "Itago an litrato" },
  "row.noPhoto": { en: "No photo", fil: "Walang litrato", bik: "Waray litrato" },
  "row.photoAlt": {
    en: "Plant condition evidence for {name}",
    fil: "Litrato ng kalagayan ng {name}",
    bik: "Litrato san kamutangan san {name}",
  },

  "result.noReading": {
    en: "No risk reading",
    fil: "Walang resulta ng panganib",
    bik: "Waray resulta san peligro",
  },
  "result.evidence": { en: "Plant evidence", fil: "Litrato ng tanim", bik: "Litrato san tanom" },
  "result.unavailableTitle": {
    en: "AI risk analysis unavailable",
    fil: "Hindi available ang AI na pagsusuri ng panganib",
    bik: "Dili pa makakua san AI na pagsusi san peligro",
  },
  "result.unavailableDefault": {
    en: "AI risk analysis is temporarily unavailable.",
    fil: "Pansamantalang hindi available ang AI na pagsusuri ng panganib.",
    bik: "Temporaryo na dili makakua san AI na pagsusi san peligro.",
  },
  "result.saved": {
    en: "Your assessment and photo were saved — you can run the analysis again without re-entering anything.",
    fil: "Naka-save ang iyong pagsusuri at litrato — maaari mong patakbuhin muli ang pagsusuri nang hindi na muling naglalagay ng anuman.",
    bik: "Naka-save an imo pagsusi asin litrato — pwede mo liwat padaganon an pagsusi na dili na kinahanglan magbutang liwat san anuman.",
  },
  "result.stillUnavailable": {
    en: "Analysis is still unavailable.",
    fil: "Hindi pa rin available ang pagsusuri.",
    bik: "Dili pa giyapon makakua san pagsusi.",
  },
  "result.analyzing": { en: "Analyzing…", fil: "Sinusuri…", bik: "Sinususi…" },
  "result.retry": {
    en: "Retry analysis",
    fil: "Subukang suriin muli",
    bik: "Probaran liwat an pagsusi",
  },
  "result.expected": { en: "Expected", fil: "Inaasahan", bik: "Inaasahan" },
  "result.observed": { en: "Observed", fil: "Nakita", bik: "Nahiling" },
  "result.visual": {
    en: "Visual observations",
    fil: "Mga nakita sa litrato",
    bik: "Mga nahiling sa litrato",
  },
  "result.factors": {
    en: "Risk factors",
    fil: "Mga sanhi ng panganib",
    bik: "Mga rason san peligro",
  },
  "result.causes": { en: "Possible causes", fil: "Posibleng dahilan", bik: "Posible na rason" },
  "result.actions": {
    en: "Recommended actions",
    fil: "Mga inirerekomendang gawin",
    bik: "Mga rekomendado na himuon",
  },
  "result.monitoring": {
    en: "Monitoring advice",
    fil: "Payo sa pagsubaybay",
    bik: "Sugo sa pagbantay",
  },
  "result.limitations": { en: "Limitations", fil: "Mga limitasyon", bik: "Mga limitasyon" },
  "result.reassess": {
    en: "Reassess in about {n} days",
    fil: "Suriin muli pagkalipas ng mga {n} araw",
    bik: "Susiha liwat pakalihis san mga {n} adlaw",
  },
  "result.aiNote": {
    en: "AI-generated guidance. Not a diagnosis, and not a replacement for an agricultural officer.",
    fil: "Gabay na gawa ng AI. Hindi ito diyagnosis, at hindi kapalit ng agricultural officer.",
    bik: "Giya na gibo san AI. Dili ini diyagnosis, asin dili kapalit san agricultural officer.",
  },
  "result.aiNotePhoto": {
    en: "AI-generated guidance including photo analysis. Not a diagnosis, and not a replacement for an agricultural officer.",
    fil: "Gabay na gawa ng AI, kasama ang pagsusuri ng litrato. Hindi ito diyagnosis, at hindi kapalit ng agricultural officer.",
    bik: "Giya na gibo san AI, kaiba an pagsusi san litrato. Dili ini diyagnosis, asin dili kapalit san agricultural officer.",
  },
  "result.aiText": {
    en: "The AI's written findings are in English.",
    fil: "Nasa Ingles ang isinulat na resulta ng AI.",
    bik: "Nasa Ingles an sinurat na resulta san AI.",
  },
  "result.infoNote": {
    en: "Risk readings compare your report against the crop's expected development for its current age. They are estimates, not guarantees.",
    fil: "Inihahambing ng resulta ang iyong ulat sa inaasahang paglaki ng pananim sa kasalukuyang edad nito. Tantya lamang ito, hindi garantiya.",
    bik: "Ikinukumpara san resulta an imo report sa inaasahan na pagdakula san tanom sa edad kaini yana. Tantya sana ini, dili garantiya.",
  },

  "trend.title": {
    en: "Assessment activity",
    fil: "Aktibidad ng pagsusuri",
    bik: "Aktibidad san pagsusi",
  },
  "trend.showChart": { en: "Show chart", fil: "Ipakita ang tsart", bik: "Ipahiling an tsart" },
  "trend.showNumbers": {
    en: "Show numbers",
    fil: "Ipakita ang mga bilang",
    bik: "Ipahiling an mga numero",
  },
  "trend.none": {
    en: "No assessments in the last {days} days.",
    fil: "Walang pagsusuri sa nakaraang {days} araw.",
    bik: "Waray pagsusi sa nakaagi na {days} adlaw.",
  },
  "trend.one": {
    en: "1 assessment in the last {days} days.",
    fil: "1 pagsusuri sa nakaraang {days} araw.",
    bik: "1 pagsusi sa nakaagi na {days} adlaw.",
  },
  "trend.many": {
    en: "{n} assessments in the last {days} days.",
    fil: "{n} pagsusuri sa nakaraang {days} araw.",
    bik: "{n} pagsusi sa nakaagi na {days} adlaw.",
  },
  "trend.chartLabel": {
    en: "{n} assessments over the last {days} days, busiest day {peak}.",
    fil: "{n} pagsusuri sa nakaraang {days} araw, pinakamarami sa isang araw: {peak}.",
    bik: "{n} pagsusi sa nakaagi na {days} adlaw, pinakadakul sa saro na adlaw: {peak}.",
  },
  "trend.caption": {
    en: "Assessments submitted per day",
    fil: "Mga pagsusuring naisumite bawat araw",
    bik: "Mga pagsusi na naisumite kada adlaw",
  },
  "trend.date": { en: "Date", fil: "Petsa", bik: "Petsa" },
  "trend.count": { en: "Assessments", fil: "Mga pagsusuri", bik: "Mga pagsusi" },
  "trend.emptyPeriod": {
    en: "No assessments in this period.",
    fil: "Walang pagsusuri sa panahong ito.",
    bik: "Waray pagsusi sa panahon na ini.",
  },
  "trend.peak": {
    en: "Peak {n} in a day",
    fil: "Pinakamarami: {n} sa isang araw",
    bik: "Pinakadakul: {n} sa saro na adlaw",
  },
});
