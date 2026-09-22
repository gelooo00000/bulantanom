import { defineMessages } from "../define";

/** The Harvest page. */
export const harvest = defineMessages({
  "harvestPage.title": { en: "Harvest", fil: "Anihan", bik: "Pag-ani" },
  "harvestPage.description": {
    en: "Expected harvest windows for your plants at Layuan Farm.",
    fil: "Inaasahang panahon ng ani ng iyong mga tanim sa Layuan Farm.",
    bik: "Inaasahan na panahon san ani san imo mga tanom sa Layuan Farm.",
  },
  "harvestPage.loading": {
    en: "Loading harvest windows…",
    fil: "Kinukuha ang mga panahon ng ani…",
    bik: "Kinukuha an mga panahon san ani…",
  },
  "harvestPage.emptyText": {
    en: "Add a plant to see its expected harvest window.",
    fil: "Magdagdag ng tanim para makita ang inaasahang panahon ng ani nito.",
    bik: "Magdugang san tanom para mahiling an inaasahan na panahon san ani kaini.",
  },
  "harvestPage.ready": { en: "Ready to harvest", fil: "Handa nang anihin", bik: "Pwede na anihon" },
  "harvestPage.within": {
    en: "Within {n} days",
    fil: "Sa loob ng {n} araw",
    bik: "Sa sulod san {n} adlaw",
  },
  "harvestPage.growing": { en: "Still growing", fil: "Lumalaki pa", bik: "Nagdadakula pa" },
  "harvestPage.next": { en: "Next: {crop}", fil: "Susunod: {crop}", bik: "Masunod: {crop}" },
  "harvestPage.noUpcoming": {
    en: "No upcoming window",
    fil: "Walang paparating na ani",
    bik: "Waray maabot na ani",
  },
  "harvestPage.approaching": {
    en: "Approaching ({n} days)",
    fil: "Malapit na ({n} araw)",
    bik: "Harani na ({n} adlaw)",
  },
  "harvestPage.passed": { en: "Window passed", fil: "Lumipas na ang panahon", bik: "Naglihis na an panahon" },
  "harvestPage.harvested": { en: "Harvested", fil: "Naani na", bik: "Naani na" },
  "harvestPage.note": {
    en: "Windows are calculated by BulanTanom from each crop's typical growing duration and your planting date. They are estimates — real timing shifts with weather, soil and variety, so check the plant before harvesting.",
    fil: "Kinakalkula ng BulanTanom ang panahon ng ani mula sa karaniwang tagal ng paglaki ng bawat pananim at sa iyong petsa ng pagtatanim. Tantya lamang ito — nagbabago ang aktwal na panahon depende sa panahon, lupa at uri, kaya tingnan muna ang tanim bago anihin.",
    bik: "Kinukwenta san BulanTanom an panahon san ani hali sa normal na kaluwagan san pagdakula san kada tanom asin sa imo petsa san pagtanom. Tantya sana ini — nagbabago an totoo na panahon segun sa klima, daga asin klase, kaya hilingon anay an tanom bago anihon.",
  },

  "phase.lastDay": {
    en: "Last day of window",
    fil: "Huling araw ng ani",
    bik: "Huri na adlaw san ani",
  },
  "phase.readyLeftOne": {
    en: "Ready now · 1 day left",
    fil: "Handa na · 1 araw na lang",
    bik: "Pwede na · 1 adlaw na sana",
  },
  "phase.readyLeft": {
    en: "Ready now · {n} days left",
    fil: "Handa na · {n} araw na lang",
    bik: "Pwede na · {n} adlaw na sana",
  },
  "phase.startsTomorrow": { en: "Starts tomorrow", fil: "Magsisimula bukas", bik: "Mapoon buwas" },
  "phase.startsIn": {
    en: "Starts in {n} days",
    fil: "Magsisimula sa loob ng {n} araw",
    bik: "Mapoon sa sulod san {n} adlaw",
  },
  "phase.closedOne": {
    en: "Window closed 1 day ago",
    fil: "Natapos ang panahon kahapon",
    bik: "Natapos an panahon kahapon",
  },
  "phase.closed": {
    en: "Window closed {n} days ago",
    fil: "Natapos ang panahon {n} araw na ang nakalipas",
    bik: "Natapos an panahon {n} adlaw na an naagi",
  },
  "phase.toGo": { en: "{n} days to go", fil: "{n} araw pa", bik: "{n} adlaw pa" },

  "harvestCard.dayOf": {
    en: "Day {n} of {total}",
    fil: "Ika-{n} araw sa {total}",
    bik: "Ika-{n} adlaw sa {total}",
  },
  "harvestCard.planted": { en: "Planted", fil: "Itinanim", bik: "Itinanom" },
  "harvestCard.opens": { en: "Window opens", fil: "Simula ng ani", bik: "Poon san ani" },
  "harvestCard.closes": { en: "Window closes", fil: "Katapusan ng ani", bik: "Katapusan san ani" },
  "harvestCard.length": { en: "Window length", fil: "Haba ng panahon ng ani", bik: "Kaluwagan san ani" },
  "harvestCard.view": { en: "View plant →", fil: "Tingnan ang tanim →", bik: "Hilingon an tanom →" },

  "category.fruit": { en: "Fruit", fil: "Prutas", bik: "Prutas" },
  "category.vegetable": { en: "Vegetable", fil: "Gulay", bik: "Gulay" },
});
