import { defineMessages } from "../define";

/** My Plants, the plant cards, and a single plant's page. */
export const plants = defineMessages({
  "status.GROWING": { en: "Growing", fil: "Lumalaki", bik: "Nagdadakula" },
  "status.READY_FOR_HARVEST": {
    en: "Ready for harvest",
    fil: "Handa nang anihin",
    bik: "Pwede na anihon",
  },
  "status.HARVESTED": { en: "Harvested", fil: "Naani na", bik: "Naani na" },
  "status.ARCHIVED": { en: "Archived", fil: "Naka-archive", bik: "Naka-archive" },

  "age.today": { en: "Planted today", fil: "Itinanim ngayon", bik: "Itinanom yana" },
  "age.one": { en: "1 day old", fil: "1 araw na", bik: "1 adlaw na" },
  "age.many": { en: "{n} days old", fil: "{n} araw na", bik: "{n} adlaw na" },

  "card.plantingOn": {
    en: "Planting on {date}",
    fil: "Itatanim sa {date}",
    bik: "Itatanom sa {date}",
  },
  "card.planted": { en: "Planted {date}", fil: "Itinanim {date}", bik: "Itinanom {date}" },
  "card.expected": {
    en: "Expected harvest {date}",
    fil: "Inaasahang ani {date}",
    bik: "Inaasahan na ani {date}",
  },
  "card.plannedAssess": {
    en: "Planned · assess from {date}",
    fil: "Nakaplano · masusuri simula {date}",
    bik: "Nakaplano · pwede susihon poon {date}",
  },
  "card.ready": {
    en: "Ready to assess",
    fil: "Handa nang suriin",
    bik: "Pwede na susihon",
  },
  "card.assessedNext": {
    en: "Assessed · next {date}",
    fil: "Nasuri na · susunod sa {date}",
    bik: "Nasusi na · masunod sa {date}",
  },
  "card.select": { en: "Select {name}", fil: "Piliin ang {name}", bik: "Pilion an {name}" },

  "myPlants.title": { en: "My Plants", fil: "Aking mga Tanim", bik: "Mga Tanom Ko" },
  "myPlants.count": {
    en: "{n} plants tracked at Layuan Farm.",
    fil: "{n} tanim ang sinusubaybayan sa Layuan Farm.",
    bik: "{n} tanom an binabantayan sa Layuan Farm.",
  },
  "myPlants.countOne": {
    en: "1 plant tracked at Layuan Farm.",
    fil: "1 tanim ang sinusubaybayan sa Layuan Farm.",
    bik: "1 tanom an binabantayan sa Layuan Farm.",
  },
  "myPlants.description": {
    en: "Your crops at Layuan Farm.",
    fil: "Ang iyong mga pananim sa Layuan Farm.",
    bik: "An imo mga tanom sa Layuan Farm.",
  },
  "myPlants.select": { en: "Select", fil: "Pumili", bik: "Pili" },
  "myPlants.toolbar": {
    en: "Selected plants",
    fil: "Mga napiling tanim",
    bik: "Mga napili na tanom",
  },
  "myPlants.tapToSelect": {
    en: "Tap plants to select them",
    fil: "I-tap ang mga tanim para piliin",
    bik: "I-tap an mga tanom para pilion",
  },
  "myPlants.selected": { en: "{n} selected", fil: "{n} ang napili", bik: "{n} an napili" },
  "myPlants.selectAll": { en: "Select all", fil: "Piliin lahat", bik: "Pilion ngatanan" },
  "myPlants.clearAll": { en: "Clear all", fil: "Alisin lahat", bik: "Halion ngatanan" },
  "myPlants.loading": {
    en: "Loading your plants…",
    fil: "Kinukuha ang iyong mga tanim…",
    bik: "Kinukuha an imo mga tanom…",
  },
  "myPlants.emptyTitle": {
    en: "No plants added yet",
    fil: "Wala pang naidagdag na tanim",
    bik: "Waray pa naidugang na tanom",
  },
  "myPlants.deletedOne": {
    en: "1 plant deleted.",
    fil: "Nabura ang 1 tanim.",
    bik: "Napara an 1 tanom.",
  },
  "myPlants.deletedMany": {
    en: "{n} plants deleted.",
    fil: "Nabura ang {n} tanim.",
    bik: "Napara an {n} tanom.",
  },
  "myPlants.deleteFailed": {
    en: "{failed} of {total} could not be deleted ({names}). Check your connection and try again.",
    fil: "{failed} sa {total} ang hindi nabura ({names}). Suriin ang iyong koneksyon at subukan muli.",
    bik: "{failed} sa {total} an dili napara ({names}). Susiha an imo koneksyon asin probaran liwat.",
  },
  "myPlants.confirmTitleOne": {
    en: "Delete 1 plant?",
    fil: "Burahin ang 1 tanim?",
    bik: "Paraon an 1 tanom?",
  },
  "myPlants.confirmTitleMany": {
    en: "Delete {n} plants?",
    fil: "Burahin ang {n} tanim?",
    bik: "Paraon an {n} tanom?",
  },
  "myPlants.confirmText": {
    en: "This permanently deletes the plant and all of its weekly assessments, AI risk readings and evidence photos. It can't be undone.",
    fil: "Permanenteng mabubura ang tanim at lahat ng lingguhang pagsusuri, resulta ng AI, at mga litrato nito. Hindi na ito maibabalik.",
    bik: "Permanente na mapapara an tanom asin ngatanan na pagsusi kada semana, resulta san AI, asin mga litrato kaini. Dili na ini maibabalik.",
  },
  "myPlants.confirmOne": {
    en: "Yes, delete 1 plant",
    fil: "Oo, burahin ang 1 tanim",
    bik: "Oo, paraon an 1 tanom",
  },
  "myPlants.confirmMany": {
    en: "Yes, delete {n} plants",
    fil: "Oo, burahin ang {n} tanim",
    bik: "Oo, paraon an {n} tanom",
  },
  "myPlants.deleting": { en: "Deleting…", fil: "Binubura…", bik: "Pinapara…" },
});
