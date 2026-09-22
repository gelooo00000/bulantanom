import { defineMessages } from "../define";

/** The weekly assessment: page, form, answer choices, photo upload and check. */
export const assessment = defineMessages({
  "asmt.title": {
    en: "Weekly Assessment",
    fil: "Lingguhang Pagsusuri",
    bik: "Pagsusi kada Semana",
  },
  "asmt.backTo": { en: "Back to {name}", fil: "Bumalik sa {name}", bik: "Balik sa {name}" },
  "asmt.intro": {
    en: "Answer a few questions about {name} to get an AI risk reading.",
    fil: "Sagutin ang ilang tanong tungkol sa {name} para makakuha ng resulta ng panganib mula sa AI.",
    bik: "Simbagon an pira na hapot manungod sa {name} para makakua san resulta san peligro hali sa AI.",
  },
  "asmt.alreadyDone": {
    en: "{name} has already been assessed this week.",
    fil: "Nasuri na ang {name} ngayong linggo.",
    bik: "Nasusi na an {name} ngunyan na semana.",
  },

  "asmt.select": { en: "Select", fil: "Pumili", bik: "Pili" },
  "asmt.growth": { en: "Growth", fil: "Paglaki", bik: "Pagdakula" },
  "asmt.growthText": {
    en: "How the plant has developed this week.",
    fil: "Paano lumaki ang tanim ngayong linggo.",
    bik: "Paano nagdakula an tanom ngunyan na semana.",
  },
  "asmt.height": {
    en: "Plant height (cm, optional)",
    fil: "Taas ng tanim (cm, opsyonal)",
    bik: "Kahalangkaw san tanom (cm, opsyonal)",
  },
  "asmt.heightExample": { en: "e.g. 45", fil: "hal. 45", bik: "pananglitan 45" },
  "asmt.growthCompared": {
    en: "Growth compared with expected",
    fil: "Paglaki kumpara sa inaasahan",
    bik: "Pagdakula kumpara sa inaasahan",
  },
  "asmt.health": { en: "Plant health", fil: "Kalusugan ng tanim", bik: "Salud san tanom" },
  "asmt.healthText": {
    en: "Overall condition and what the leaves look like.",
    fil: "Pangkalahatang kalagayan at hitsura ng mga dahon.",
    bik: "Kabuuan na kamutangan asin hitsura san mga dahon.",
  },
  "asmt.overallHealth": { en: "Overall health", fil: "Pangkalahatang kalusugan", bik: "Kabuuan na salud" },
  "asmt.leaf": { en: "Leaf condition", fil: "Kalagayan ng dahon", bik: "Kamutangan san dahon" },
  "asmt.flowerFruit": {
    en: "Flowering & fruiting",
    fil: "Pamumulaklak at pamumunga",
    bik: "Pagburak asin pagbunga",
  },
  "asmt.blankIfNA": {
    en: "Leave blank if not applicable yet.",
    fil: "Iwanang blangko kung hindi pa angkop.",
    bik: "Pabayaan na blangko kun dili pa angay.",
  },
  "asmt.flowering": { en: "Flowering status", fil: "Pamumulaklak", bik: "Pagburak" },
  "asmt.fruiting": { en: "Fruiting status", fil: "Pamumunga", bik: "Pagbunga" },
  "asmt.waterSoil": { en: "Water & soil", fil: "Tubig at lupa", bik: "Tubig asin daga" },
  "asmt.waterSoilText": {
    en: "How the plant has been watered and how the soil feels.",
    fil: "Paano dinidiligan ang tanim at ano ang pakiramdam ng lupa.",
    bik: "Paano binububoan an tanom asin ano an pakiramdam san daga.",
  },
  "asmt.watering": { en: "Watering frequency", fil: "Dalas ng pagdidilig", bik: "Kadalasan san pagbubo" },
  "asmt.soil": { en: "Soil moisture", fil: "Basa ng lupa", bik: "Kabasa san daga" },
  "asmt.symptoms": { en: "Symptoms", fil: "Mga sintomas", bik: "Mga sintomas" },
  "asmt.symptomsText": {
    en: "Leave blank if you haven't noticed anything.",
    fil: "Iwanang blangko kung wala kang napansin.",
    bik: "Pabayaan na blangko kun waray ka nahiling.",
  },
  "asmt.pest": { en: "Pest observations", fil: "Mga napansing peste", bik: "Mga nahiling na peste" },
  "asmt.disease": {
    en: "Disease-like symptoms",
    fil: "Mga sintomas na parang sakit",
    bik: "Mga sintomas na garo helang",
  },
  "asmt.noneObserved": { en: "None observed", fil: "Walang napansin", bik: "Waray nahiling" },
  "asmt.evidence": {
    en: "Plant condition evidence",
    fil: "Litrato ng kalagayan ng tanim",
    bik: "Litrato san kamutangan san tanom",
  },
  "asmt.evidenceText": {
    en: "A clear photo of your {crop} is required. We check that it matches the crop before evaluating risk.",
    fil: "Kailangan ang malinaw na litrato ng iyong {crop}. Sinusuri namin kung tugma ito sa pananim bago suriin ang panganib.",
    bik: "Kinahanglan an malinaw na litrato san imo {crop}. Sinususi mi kun angay ini sa tanom bago susihon an peligro.",
  },
  "asmt.observations": { en: "Observations", fil: "Mga obserbasyon", bik: "Mga obserbasyon" },
  "asmt.observationsText": {
    en: "Anything else worth noting.",
    fil: "Iba pang dapat tandaan.",
    bik: "Iba pa na dapat tandaan.",
  },
  "asmt.environment": {
    en: "Environmental observations",
    fil: "Mga napansin sa kapaligiran",
    bik: "Mga nahiling sa palibot",
  },
  "asmt.environmentExample": {
    en: "e.g. Heavy rain the past few days",
    fil: "hal. Malakas na ulan nitong mga nakaraang araw",
    bik: "pananglitan: Makusog na uran kan mga nakaagi na adlaw",
  },
  "asmt.notes": {
    en: "What have you noticed about your plant this week?",
    fil: "Ano ang napansin mo sa iyong tanim ngayong linggo?",
    bik: "Ano an nahiling mo sa imo tanom ngunyan na semana?",
  },
  "asmt.notesPlaceholder": {
    en: "In your own words, describe anything that concerns you about this plant.",
    fil: "Sa sarili mong salita, ilarawan ang anumang ikinababahala mo sa tanim na ito.",
    bik: "Sa sadiri mo na tataramon, isaysay an anuman na ikinababaraka mo sa tanom na ini.",
  },
  "asmt.anyLanguage": {
    en: "You can write in English, Filipino or Bikol.",
    fil: "Maaari kang sumulat sa Ingles, Filipino o Bikol.",
    bik: "Pwede ka magsurat sa Ingles, Filipino o Bikol.",
  },
  "asmt.submit": { en: "Submit Assessment", fil: "Isumite ang Pagsusuri", bik: "Isumite an Pagsusi" },
  "asmt.needPhoto": {
    en: "Add a plant photo to submit this assessment.",
    fil: "Magdagdag ng litrato ng tanim para maisumite ang pagsusuring ito.",
    bik: "Magdugang san litrato san tanom para maisumite an pagsusi na ini.",
  },
  "asmt.checking": {
    en: "Checking plant evidence…",
    fil: "Sinusuri ang litrato ng tanim…",
    bik: "Sinususi an litrato san tanom…",
  },
  "asmt.checkingText": {
    en: "We're verifying that your photo matches the selected crop.",
    fil: "Tinitingnan namin kung tugma ang iyong litrato sa napiling pananim.",
    bik: "Hinihiling mi kun angay an imo litrato sa napili na tanom.",
  },
  "asmt.evaluating": { en: "Evaluating {name}…", fil: "Sinusuri ang {name}…", bik: "Sinususi an {name}…" },
  "asmt.step1": {
    en: "Comparing actual condition with expected development",
    fil: "Inihahambing ang aktwal na kalagayan sa inaasahang paglaki",
    bik: "Ikinukumpara an totoo na kamutangan sa inaasahan na pagdakula",
  },
  "asmt.step2": {
    en: "Generating risk evaluation",
    fil: "Ginagawa ang pagsusuri ng panganib",
    bik: "Ginigibo an pagsusi san peligro",
  },
  "asmt.verifyFailed": {
    en: "Plant evidence could not be verified right now. Please try again in a moment.",
    fil: "Hindi masuri ang litrato ng tanim ngayon. Pakisubukan muli mamaya.",
    bik: "Dili masusi an litrato san tanom yana. Probaran tabi liwat maya-maya.",
  },
  "asmt.wentWrong": {
    en: "Something went wrong.",
    fil: "May nangyaring mali.",
    bik: "May nangyari na sala.",
  },

  "opt.growth.faster_than_expected": {
    en: "Faster than expected",
    fil: "Mas mabilis kaysa inaasahan",
    bik: "Mas madali kaysa inaasahan",
  },
  "opt.growth.as_expected": {
    en: "About as expected",
    fil: "Halos gaya ng inaasahan",
    bik: "Haros siring sa inaasahan",
  },
  "opt.growth.slower_than_expected": {
    en: "Slower than expected",
    fil: "Mas mabagal kaysa inaasahan",
    bik: "Mas maluway kaysa inaasahan",
  },
  "opt.growth.stunted": {
    en: "Stunted / barely growing",
    fil: "Bansot / halos hindi lumalaki",
    bik: "Bansot / haros dili nagdadakula",
  },
  "opt.health.healthy": { en: "Healthy", fil: "Malusog", bik: "Marhay an salud" },
  "opt.health.slightly_unhealthy": {
    en: "Slightly unhealthy",
    fil: "Medyo hindi malusog",
    bik: "Medyo dili marhay an salud",
  },
  "opt.health.unhealthy": { en: "Unhealthy", fil: "Hindi malusog", bik: "Dili marhay an salud" },
  "opt.leaf.healthy": {
    en: "Healthy green leaves",
    fil: "Malusog na berdeng dahon",
    bik: "Marhay na berde na dahon",
  },
  "opt.leaf.slight_yellowing": {
    en: "Slight yellowing",
    fil: "Bahagyang naninilaw",
    bik: "Medyo nagdudulaw",
  },
  "opt.leaf.yellowing": {
    en: "Noticeable yellowing",
    fil: "Halatang naninilaw",
    bik: "Halata na nagdudulaw",
  },
  "opt.leaf.spots": { en: "Spots or lesions", fil: "May batik o sugat", bik: "May mantsa o bakat" },
  "opt.leaf.wilting": {
    en: "Wilting or drooping",
    fil: "Nalalanta o nakalaylay",
    bik: "Nalalaya o nakalaylay",
  },
  "opt.leaf.damaged": {
    en: "Visible damage / holes",
    fil: "May sira / butas",
    bik: "May guba / buslot",
  },
  "opt.flowering.not_flowering": { en: "Not flowering", fil: "Hindi namumulaklak", bik: "Dili nagbuburak" },
  "opt.flowering.starting": {
    en: "Starting to flower",
    fil: "Nagsisimulang mamulaklak",
    bik: "Nagpupuon magburak",
  },
  "opt.flowering.flowering": { en: "Flowering", fil: "Namumulaklak", bik: "Nagbuburak" },
  "opt.flowering.finished": {
    en: "Flowering finished",
    fil: "Tapos nang mamulaklak",
    bik: "Tapos na magburak",
  },
  "opt.fruiting.not_fruiting": { en: "Not fruiting", fil: "Hindi namumunga", bik: "Dili nagbubunga" },
  "opt.fruiting.forming": { en: "Fruit forming", fil: "Nagsisimulang mamunga", bik: "Nagpupuon magbunga" },
  "opt.fruiting.developing": {
    en: "Fruit developing",
    fil: "Lumalaki ang bunga",
    bik: "Nagdadakula an bunga",
  },
  "opt.fruiting.ripening": { en: "Fruit ripening", fil: "Nahihinog ang bunga", bik: "Naluluto an bunga" },
  "opt.watering.daily": { en: "Daily", fil: "Araw-araw", bik: "Aldaw-aldaw" },
  "opt.watering.every_other_day": {
    en: "Every other day",
    fil: "Tuwing ikalawang araw",
    bik: "Kada ikaduwa na adlaw",
  },
  "opt.watering.twice_weekly": {
    en: "Twice a week",
    fil: "Dalawang beses sa isang linggo",
    bik: "Duwa na beses kada semana",
  },
  "opt.watering.weekly": { en: "Weekly", fil: "Isang beses sa isang linggo", bik: "Saro na beses kada semana" },
  "opt.watering.rain_fed": { en: "Rain-fed only", fil: "Ulan lang", bik: "Uran sana" },
  "opt.soil.dry": { en: "Dry", fil: "Tuyo", bik: "Mamara" },
  "opt.soil.slightly_dry": { en: "Slightly dry", fil: "Medyo tuyo", bik: "Medyo mamara" },
  "opt.soil.moist": { en: "Moist", fil: "Mamasa-masa", bik: "Medyo basa" },
  "opt.soil.wet": { en: "Wet", fil: "Basa", bik: "Basa" },
  "opt.soil.waterlogged": { en: "Waterlogged", fil: "Lubog sa tubig", bik: "Lubog sa tubig" },

  "upload.onlyJpegPng": {
    en: "Only JPEG and PNG photos are accepted.",
    fil: "JPEG at PNG na litrato lamang ang tinatanggap.",
    bik: "JPEG asin PNG na litrato sana an inaako.",
  },
  "upload.tooLarge": {
    en: "That photo is larger than 5MB. Please choose a smaller one.",
    fil: "Lampas sa 5MB ang litratong iyan. Pumili ng mas maliit.",
    bik: "Labi sa 5MB an litrato na iyan. Pili tabi san mas sadit.",
  },
  "upload.label": {
    en: "Upload plant photo",
    fil: "Mag-upload ng litrato ng tanim",
    bik: "Mag-upload san litrato san tanom",
  },
  "upload.photo": { en: "Plant photo", fil: "Litrato ng tanim", bik: "Litrato san tanom" },
  "upload.alt": {
    en: "Selected plant condition evidence",
    fil: "Napiling litrato ng kalagayan ng tanim",
    bik: "Napili na litrato san kamutangan san tanom",
  },
  "upload.replace": { en: "Replace", fil: "Palitan", bik: "Liwanan" },
  "upload.remove": { en: "Remove", fil: "Alisin", bik: "Halion" },
  "upload.title": {
    en: "Upload Plant Photo",
    fil: "Mag-upload ng Litrato ng Tanim",
    bik: "Mag-upload san Litrato san Tanom",
  },
  "upload.hint": {
    en: "Show the plant clearly in good lighting for better evaluation.",
    fil: "Ipakita nang malinaw ang tanim sa maliwanag na lugar para mas mahusay na masuri.",
    bik: "Ipahiling nin malinaw an tanom sa maliwanag na lugar para mas marhay an pagsusi.",
  },
  "upload.choose": { en: "Choose photo", fil: "Pumili ng litrato", bik: "Pili san litrato" },
  "upload.limits": {
    en: "JPEG or PNG · up to 5MB",
    fil: "JPEG o PNG · hanggang 5MB",
    bik: "JPEG o PNG · sagkod 5MB",
  },

  "verdict.match": {
    en: "Plant Evidence Verified",
    fil: "Beripikado ang Litrato ng Tanim",
    bik: "Beripikado an Litrato san Tanom",
  },
  "verdict.mismatch": {
    en: "Evidence Doesn't Match",
    fil: "Hindi Tugma ang Litrato",
    bik: "Dili Angay an Litrato",
  },
  "verdict.no_plant": {
    en: "Invalid Plant Evidence",
    fil: "Hindi Wastong Litrato ng Tanim",
    bik: "Dili Tama na Litrato san Tanom",
  },
  "verdict.unclear": {
    en: "Photo Not Clear Enough",
    fil: "Hindi Sapat ang Linaw ng Litrato",
    bik: "Dili Igo an Linaw san Litrato",
  },
  "verdict.replace": { en: "Replace Image", fil: "Palitan ang Litrato", bik: "Liwanan an Litrato" },
});
