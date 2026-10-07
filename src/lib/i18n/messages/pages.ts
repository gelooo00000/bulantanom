import { defineMessages } from "../define";

/** Risk Indicator, Monitoring, and Assessment History (list and detail). */
export const pages = defineMessages({
  "riskPage.title": {
    en: "Plant Risk Indicator",
    fil: "Antas ng Panganib ng Tanim",
    bik: "Tanda san Peligro san Tanom",
  },
  "riskPage.description": {
    en: "AI risk readings across all your plants at Layuan Farm.",
    fil: "Mga resulta ng panganib mula sa AI para sa lahat ng iyong tanim sa Layuan Farm.",
    bik: "Mga resulta san peligro hali sa AI para sa ngatanan mo na tanom sa Layuan Farm.",
  },
  "riskPage.loading": {
    en: "Loading your risk readings…",
    fil: "Kinukuha ang mga resulta ng panganib…",
    bik: "Kinukuha an mga resulta san peligro…",
  },
  "riskPage.emptyTitle": { en: "No plants yet", fil: "Wala pang tanim", bik: "Waray pa tanom" },
  "riskPage.emptyText": {
    en: "Add a plant, then submit a weekly assessment to get an AI risk reading for it.",
    fil: "Magdagdag ng tanim, saka magsumite ng lingguhang pagsusuri para makakuha ng resulta ng panganib mula sa AI.",
    bik: "Magdugang san tanom, dayon magsumite san pagsusi kada semana para makakua san resulta san peligro hali sa AI.",
  },
  "riskPage.details": { en: "Details", fil: "Detalye", bik: "Detalye" },
  // Short forms for the plant tiles, which are half a phone wide.
  "riskPage.checked": { en: "Checked {date}", fil: "Nasuri {date}", bik: "Nasusi {date}" },
  "riskPage.nextInOne": { en: "Next in 1 day", fil: "Susunod: bukas", bik: "Masunod: buwas" },
  "riskPage.nextIn": {
    en: "Next in {n} days",
    fil: "Susunod sa {n} araw",
    bik: "Masunod sa {n} adlaw",
  },
  "riskPage.assessNow": { en: "Assess now", fil: "Suriin ngayon", bik: "Susiha yana" },
  "riskPage.plant": { en: "plant", fil: "tanim", bik: "tanom" },
  "riskPage.plants": { en: "plants", fil: "tanim", bik: "tanom" },
  "riskPage.byLevel": {
    en: "Risk by level",
    fil: "Panganib ayon sa antas",
    bik: "Peligro segun sa antas",
  },
  "riskPage.byLevelText": {
    en: "Select a level to see its plants.",
    fil: "Pumili ng antas para makita ang mga tanim nito.",
    bik: "Pumili nin antas para mahiling an mga tanom kaini.",
  },
  "riskPage.thisWeek": {
    en: "This week's checks",
    fil: "Mga pagsusuri ngayong linggo",
    bik: "Mga pagsusi ngunyan na semana",
  },
  "riskPage.thisWeekText": {
    en: "Each plant is assessed once a week.",
    fil: "Isang beses sa isang linggo sinusuri ang bawat tanim.",
    bik: "Kada tanom sinusuri saro kada semana.",
  },
  "riskPage.dueOf": {
    en: "of {total} due now",
    fil: "sa {total} ang dapat suriin ngayon",
    bik: "sa {total} an dapat susihon yana",
  },
  "riskPage.dueNow": { en: "Due now", fil: "Dapat suriin ngayon", bik: "Dapat susihon yana" },
  "riskPage.doneThisWeek": {
    en: "Done this week",
    fil: "Tapos ngayong linggo",
    bik: "Tapos ngunyan na semana",
  },
  "riskPage.notOpen": { en: "Not open yet", fil: "Hindi pa bukas", bik: "Dili pa bukas" },
  "riskPage.nothingDue": {
    en: "Nothing to assess right now.",
    fil: "Walang kailangang suriin ngayon.",
    bik: "Waray kinakaipuhan na susihon yana.",
  },
  "riskPage.more": { en: "+{n} more", fil: "+{n} pa", bik: "+{n} pa" },
  "riskPage.all": { en: "All", fil: "Lahat", bik: "Gabos" },
  "riskPage.search": { en: "Search plants", fil: "Maghanap ng tanim", bik: "Maghanap nin tanom" },
  "riskPage.sort": { en: "Sort plants", fil: "Ayusin ang mga tanim", bik: "Ayuson an mga tanom" },
  "riskPage.sortDue": {
    en: "Due first",
    fil: "Unahin ang dapat suriin",
    bik: "Unahon an dapat susihon",
  },
  "riskPage.sortRisk": {
    en: "Highest risk first",
    fil: "Pinakamataas na panganib muna",
    bik: "Pinakahataas na peligro enot",
  },
  "riskPage.sortName": { en: "Name A–Z", fil: "Pangalan A–Z", bik: "Ngaran A–Z" },
  "riskPage.noMatchTitle": { en: "No plants here", fil: "Walang tanim dito", bik: "Waray tanom digdi" },
  "riskPage.noMatchText": {
    en: "Try another level or search.",
    fil: "Subukan ang ibang antas o paghahanap.",
    bik: "Probaran an iba na antas o paghanap.",
  },
  "riskPage.notChecked": {
    en: "Not checked yet",
    fil: "Hindi pa nasusuri",
    bik: "Dili pa nasusi",
  },

  "history.description": {
    en: "All weekly assessments you have submitted, newest first.",
    fil: "Lahat ng lingguhang pagsusuring naisumite mo, pinakabago muna.",
    bik: "Ngatanan na pagsusi kada semana na naisumite mo, an pinakabago enot.",
  },
  "history.loading": {
    en: "Loading your assessments…",
    fil: "Kinukuha ang iyong mga pagsusuri…",
    bik: "Kinukuha an imo mga pagsusi…",
  },
  "history.emptyTitle": {
    en: "No assessments submitted yet",
    fil: "Wala pang naisumiteng pagsusuri",
    bik: "Waray pa naisumite na pagsusi",
  },
  "history.emptyText": {
    en: "Submit a weekly assessment for one of your plants to start building a history.",
    fil: "Magsumite ng lingguhang pagsusuri para sa isa sa iyong mga tanim para magsimula ang kasaysayan.",
    bik: "Magsumite san pagsusi kada semana para sa saro san imo mga tanom para mapoonan an kasaysayan.",
  },
  "history.goToPlants": {
    en: "Go to My Plants",
    fil: "Pumunta sa Aking mga Tanim",
    bik: "Magduman sa Mga Tanom Ko",
  },
  "history.countOne": { en: "1 assessment", fil: "1 pagsusuri", bik: "1 pagsusi" },
  "history.count": { en: "{n} assessments", fil: "{n} pagsusuri", bik: "{n} pagsusi" },
  "history.countOf": {
    en: "{shown} of {total} assessments",
    fil: "{shown} sa {total} pagsusuri",
    bik: "{shown} sa {total} pagsusi",
  },
  "history.all": { en: "All", fil: "Lahat", bik: "Ngatanan" },
  "history.noneAtLevel": {
    en: "No assessments at this risk level",
    fil: "Walang pagsusuri sa antas ng panganib na ito",
    bik: "Waray pagsusi sa klase san peligro na ini",
  },
  "history.tryFilter": {
    en: "Try a different filter to see your other readings.",
    fil: "Subukan ang ibang filter para makita ang iba mong resulta.",
    bik: "Probaran an iba na filter para mahiling an iba mo na resulta.",
  },

  "asmtDetail.loading": {
    en: "Loading assessment…",
    fil: "Kinukuha ang pagsusuri…",
    bik: "Kinukuha an pagsusi…",
  },
  "asmtDetail.loadFailed": {
    en: "Unable to load this assessment.",
    fil: "Hindi ma-load ang pagsusuring ito.",
    bik: "Dili ma-load an pagsusi na ini.",
  },
  "asmtDetail.notFound": {
    en: "This assessment could not be found in your records.",
    fil: "Hindi makita ang pagsusuring ito sa iyong talaan.",
    bik: "Dili makita an pagsusi na ini sa imo rekord.",
  },
  "asmtDetail.backShort": {
    en: "Back to history",
    fil: "Bumalik sa kasaysayan",
    bik: "Balik sa kasaysayan",
  },
  "asmtDetail.back": {
    en: "Back to Assessment History",
    fil: "Bumalik sa Kasaysayan ng Pagsusuri",
    bik: "Balik sa Mga Nakaagi na Pagsusi",
  },
});
