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
    en: "Your plants by their latest reading.",
    fil: "Ang iyong mga tanim ayon sa huling resulta.",
    bik: "An imo mga tanom segun sa pinakahuring resulta.",
  },
  "riskPage.withReading": {
    en: "With a risk reading",
    fil: "May resulta ng panganib",
    bik: "May resulta san peligro",
  },
  "riskPage.withoutReading": {
    en: "No risk level yet",
    fil: "Wala pang antas ng panganib",
    bik: "Waray pa antas san peligro",
  },
  "riskPage.dueNow": { en: "Due now", fil: "Dapat suriin ngayon", bik: "Dapat susihon yana" },
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
    en: "Back to Risk Indicator",
    fil: "Bumalik sa Antas ng Panganib",
    bik: "Balik sa Tanda san Peligro",
  },
  "asmtDetail.back": {
    en: "Back to Risk Indicator",
    fil: "Bumalik sa Antas ng Panganib",
    bik: "Balik sa Tanda san Peligro",
  },
});
