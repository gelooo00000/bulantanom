import { defineMessages } from "../define";

/**
 * The first week after planting, and the "too early to tell" reading.
 *
 * A panel review found the AI rating plants on the day they were planted, so
 * the first assessment now waits a week and a young plant can come back with
 * no risk level rather than an invented one.
 */
export const earlyStage = defineMessages({
  "early.badge": { en: "Too Early", fil: "Masyadong Maaga", bik: "Amay Pa" },
  "early.level": { en: "Too early to tell", fil: "Masyado pang maaga", bik: "Amay pa para masabi" },
  "early.resultTitle": {
    en: "Too early for a risk reading",
    fil: "Masyado pang maaga para sa resulta ng panganib",
    bik: "Amay pa para sa resulta san peligro",
  },
  "early.resultText": {
    en: "This plant is still establishing, so there is not enough growth yet to judge its risk. Your answers and photo were saved, and the next assessment will have more to compare against.",
    fil: "Nagsisimula pa lang tumubo ang tanim na ito, kaya wala pang sapat na paglaki para masuri ang panganib nito. Naka-save ang iyong mga sagot at litrato, at mas marami nang maihahambing sa susunod na pagsusuri.",
    bik: "Nagpupuon pa sana magtubo an tanom na ini, kaya waray pa igo na pagdakula para masusi an peligro kaini. Naka-save an imo mga simbag asin litrato, asin mas dakul na an maikukumpara sa masunod na pagsusi.",
  },

  "mismatch.title": {
    en: "This photo doesn't match the planting date",
    fil: "Hindi tugma ang litratong ito sa petsa ng pagtatanim",
    bik: "Dili angay an litrato na ini sa petsa san pagtanom",
  },
  "mismatch.text": {
    en: "The plant in the photo looks far older or younger than the date you recorded. Please check the planting date on this plant — this is a record to correct, not a danger to your crop.",
    fil: "Mukhang mas matanda o mas bata ang tanim sa litrato kaysa sa petsang itinala mo. Pakisuri ang petsa ng pagtatanim ng tanim na ito — talaan lang ito ang dapat itama, hindi panganib sa iyong pananim.",
    bik: "Garo mas gurang o mas hoben an tanom sa litrato kaysa sa petsa na inirekord mo. Susiha tabi an petsa san pagtanom san tanom na ini — rekord sana ini na dapat tamaon, dili peligro sa imo tanom.",
  },
  "mismatch.fix": {
    en: "Check the planting date",
    fil: "Suriin ang petsa ng pagtatanim",
    bik: "Susiha an petsa san pagtanom",
  },

  "young.title": { en: "Just planted", fil: "Katatanim lang", bik: "Bag-o pa sana natanom" },
  "young.text": {
    en: "{name} was planted on {date}. Its first assessment opens on {first} — {when} — so there is something to judge by then.",
    fil: "Itinanim ang {name} noong {date}. Magbubukas ang unang pagsusuri nito sa {first} — {when} — para may maisuri na.",
    bik: "Itinanom an {name} kan {date}. Mabukas an enot na pagsusi kaini sa {first} — {when} — para igwa na masusi.",
  },
  "young.first": { en: "First check {date}", fil: "Unang suri {date}", bik: "Enot na susi {date}" },
  "young.why": {
    en: "A plant in its first week has not visibly changed yet, so a risk reading would have nothing behind it.",
    fil: "Sa unang linggo, wala pang nakikitang pagbabago sa tanim, kaya walang batayan ang anumang resulta ng panganib.",
    bik: "Sa enot na semana, waray pa nahihiling na pagbabago sa tanom, kaya waray basehan an anuman na resulta san peligro.",
  },
});
