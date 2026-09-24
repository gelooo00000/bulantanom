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

  "plantsGuide.open": { en: "How to use", fil: "Paano gamitin", bik: "Paano gamiton" },
  "plantsGuide.hide": { en: "Hide", fil: "Itago", bik: "Itago" },
  "plantsGuide.title": {
    en: "How to use My Plants",
    fil: "Paano gamitin ang Aking mga Tanim",
    bik: "Paano gamiton an Mga Tanom Ko",
  },
  "plantsGuide.intro": {
    en: "Follow these steps to track each plant from planting to harvest.",
    fil: "Sundin ang mga hakbang na ito para masubaybayan ang bawat tanim mula pagtatanim hanggang ani.",
    bik: "Sunudon an mga hakbang na ini para mabantayan an kada tanom poon pagtanom sagkod ani.",
  },
  "plantsGuide.addTitle": { en: "Add your plant", fil: "Idagdag ang tanim", bik: "Idugang an tanom" },
  "plantsGuide.addBody": {
    en: "Tap “Add Plant”, choose the crop and its variety if you know it, then pick the day you planted it. A future date saves it as Planned.",
    fil: "I-tap ang “Magdagdag ng Tanim”, piliin ang pananim at ang uri nito kung alam mo, saka piliin ang araw ng pagtatanim. Kapag petsa sa hinaharap ang pinili, ise-save ito bilang Nakaplano.",
    bik: "I-tap an “Magdugang san Tanom”, pilion an tanom asin an klase kaini kun aram mo, dangan pilion an adlaw san pagtanom. Kun petsa sa maabot an pinili, ise-save ini bilang Nakaplano.",
  },
  "plantsGuide.cardTitle": { en: "Read the plant card", fil: "Basahin ang card ng tanim", bik: "Basahon an card san tanom" },
  "plantsGuide.cardBody": {
    en: "Each card shows the expected harvest date and when the next check is due: “First check”, “Ready to assess”, or “Assessed · next”.",
    fil: "Ipinapakita ng bawat card ang inaasahang petsa ng ani at kung kailan ang susunod na suri: “Unang suri”, “Handa nang suriin”, o “Nasuri na · susunod”.",
    bik: "Ipinapahiling san kada card an inaasahan na petsa san ani asin kun nuarin an sunod na susi: “Enot na susi”, “Pwede na susihon”, o “Nasusi na · masunod”.",
  },
  "plantsGuide.assessTitle": { en: "Check it every week", fil: "Suriin linggo-linggo", bik: "Susihon kada semana" },
  "plantsGuide.assessBody": {
    en: "Open the plant and tap “Start Weekly Assessment”. Answer the questions and take a clear photo of the plant. The first check opens 7 days after planting, then once every 7 days.",
    fil: "Buksan ang tanim at i-tap ang “Simulan ang Lingguhang Pagsusuri”. Sagutin ang mga tanong at kumuha ng malinaw na litrato ng tanim. Bubukas ang unang suri 7 araw matapos itanim, at pagkatapos ay isang beses kada 7 araw.",
    bik: "Buksan an tanom asin i-tap an “Poonan an Pagsusi kada Semana”. Simbagon an mga hapot asin magkua san malinaw na litrato san tanom. Mabukas an enot na susi 7 adlaw pakatanom, dangan sarong beses kada 7 adlaw.",
  },
  "plantsGuide.riskTitle": { en: "Act on the risk result", fil: "Kumilos ayon sa resulta", bik: "Maghiro segun sa resulta" },
  "plantsGuide.riskBody": {
    en: "After each check the AI rates the plant Low, Medium or High risk, or “Too early to tell”, and lists what to do next. Follow the advice, and ask your LGU agriculturist when the risk is High.",
    fil: "Pagkatapos ng bawat suri, binibigyan ng AI ang tanim ng Mababa, Katamtaman o Mataas na panganib, o “Masyado pang maaga”, at inililista ang susunod na gagawin. Sundin ang payo, at magtanong sa iyong LGU agriculturist kapag Mataas ang panganib.",
    bik: "Pakatapos san kada susi, tinatawan san AI an tanom san Hababa, Tunga-tunga o Hataas na peligro, o “Amay pa para masabi”, asin inlilista an sunod na gibohon. Sunudon an tambag, asin maghapot sa imo LGU agriculturist kun Hataas an peligro.",
  },
  "plantsGuide.harvestTitle": { en: "Harvest on time", fil: "Umani sa tamang oras", bik: "Mag-ani sa tamang oras" },
  "plantsGuide.harvestBody": {
    en: "Watch the harvest dates on the card and on the Harvest page. The card turns “Ready for harvest” when the harvest window opens.",
    fil: "Bantayan ang mga petsa ng ani sa card at sa pahina ng Ani. Magiging “Handa nang anihin” ang card kapag nagbukas na ang panahon ng ani.",
    bik: "Bantayan an mga petsa san ani sa card asin sa pahina san Ani. Magigin “Pwede na anihon” an card kun nagbukas na an panahon san ani.",
  },
  "plantsGuide.removeTitle": { en: "Remove old plants", fil: "Alisin ang lumang tanim", bik: "Paraon an daan na tanom" },
  "plantsGuide.removeBody": {
    en: "Tap “Select”, tick the plants you no longer grow, then tap “Delete”. You will be asked to confirm first.",
    fil: "I-tap ang “Pumili”, piliin ang mga tanim na hindi mo na pinapalago, saka i-tap ang “Burahin”. Tatanungin ka muna bago ito burahin.",
    bik: "I-tap an “Pili”, pilion an mga tanom na dili mo na pinapadakula, dangan i-tap an “Paraon”. Hahaputon ka muna bago ini paraon.",
  },
});
