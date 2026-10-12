import { defineMessages } from "../define";

/** The weekly assessment: page, form, answer choices, photo upload and check. */
export const assessment = defineMessages({
  "asmt.title": {
    en: "Weekly Assessment",
    fil: "Lingguhang Pagsusuri",
    bik: "Pagsusi kada Semana",
  },
  // The assessment is opened from the Risk Indicator, so every way back leads there.
  "asmt.backToRisk": {
    en: "Back to Risk Indicator",
    fil: "Bumalik sa Antas ng Panganib",
    bik: "Balik sa Tanda san Peligro",
  },
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

  "asmt.growth": { en: "Growth", fil: "Paglaki", bik: "Pagdakula" },
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
  "asmt.overallHealth": { en: "Overall health", fil: "Pangkalahatang kalusugan", bik: "Kabuuan na salud" },
  "asmt.leaf": { en: "Leaf condition", fil: "Kalagayan ng dahon", bik: "Kamutangan san dahon" },
  "asmt.flowerFruit": {
    en: "Flowering & fruiting",
    fil: "Pamumulaklak at pamumunga",
    bik: "Pagburak asin pagbunga",
  },
  "asmt.flowering": { en: "Flowering status", fil: "Pamumulaklak", bik: "Pagburak" },
  "asmt.fruiting": { en: "Fruiting status", fil: "Pamumunga", bik: "Pagbunga" },
  "asmt.waterSoil": { en: "Water & soil", fil: "Tubig at lupa", bik: "Tubig asin daga" },
  "asmt.watering": { en: "Watering frequency", fil: "Dalas ng pagdidilig", bik: "Kadalasan san pagbubo" },
  "asmt.soil": { en: "Soil moisture", fil: "Basa ng lupa", bik: "Kabasa san daga" },
  "asmt.symptoms": { en: "Symptoms", fil: "Mga sintomas", bik: "Mga sintomas" },
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
  "asmt.needNewPhoto": {
    en: "Take a new photo to submit this assessment.",
    fil: "Kumuha ng bagong litrato para maisumite ang pagsusuring ito.",
    bik: "Magkuha nin bag-ong litrato para maisumite an pagsusi na ini.",
  },
  "asmt.photoChecking": {
    en: "Checking your photo…",
    fil: "Sinusuri ang iyong litrato…",
    bik: "Sinususi an imo litrato…",
  },
  "asmt.photoCheckingText": {
    en: "We'll fill in what the photo shows, so you have less to answer.",
    fil: "Pupunan namin ang makikita sa litrato para mas kaunti ang sasagutin mo.",
    bik: "Pupunuan mi an nahihiling sa litrato para mas dikit an simbagon mo.",
  },
  "asmt.prefilled": {
    en: "{n} answers were filled in from your photo. Check them and change any that are wrong.",
    fil: "{n} sagot ang pinunan mula sa iyong litrato. Tingnan ang mga ito at palitan kung may mali.",
    bik: "{n} na simbag an pinunuan hali sa imo litrato. Hilingon an mga ini asin liwanan kun igwa nin sala.",
  },
  "asmt.prefilledOne": {
    en: "1 answer was filled in from your photo. Check it and change it if it is wrong.",
    fil: "1 sagot ang pinunan mula sa iyong litrato. Tingnan ito at palitan kung mali.",
    bik: "1 na simbag an pinunuan hali sa imo litrato. Hilingon ini asin liwanan kun sala.",
  },
  "asmt.moreDetails": {
    en: "Add more details",
    fil: "Magdagdag ng iba pang detalye",
    bik: "Magdugang nin iba pang detalye",
  },
  "asmt.hideDetails": { en: "Hide details", fil: "Itago ang detalye", bik: "Itago an detalye" },
  "asmt.moreDetailsHint": {
    en: "Pests or disease you saw, plant height, and anything else you noticed.",
    fil: "Peste o sakit na nakita mo, taas ng tanim, at iba pang napansin mo.",
    bik: "Peste o helang na nahiling mo, langkaw san tanom, asin iba pang nahiling mo.",
  },
  "asmt.required": { en: "Required", fil: "Kailangan", bik: "Kaipuhan" },
  "asmt.waitPhotoCheck": {
    en: "Wait for the photo check to finish.",
    fil: "Hintaying matapos ang pagsusuri ng litrato.",
    bik: "Hulaton na matapos an pagsusi san litrato.",
  },
  "asmt.draftBack": {
    en: "Your answers from earlier today are back, so you can carry on. Take the photo again to submit.",
    fil: "Bumalik ang mga sagot mo kanina, kaya maaari kang magpatuloy. Kumuha ulit ng litrato para maisumite.",
    bik: "Nagbalik an mga simbag mo kaina, kaya pwede ka magpadagos. Magkuha giraray nin litrato para maisumite.",
  },
  "asmt.startOver": { en: "Start over", fil: "Magsimula muli", bik: "Magpoon giraray" },
  "asmt.mushroom": {
    en: "Mushroom condition",
    fil: "Kalagayan ng kabute",
    bik: "Kamutangan san kabuti",
  },
  "opt.mushroom.healthy": {
    en: "Firm, normal colour",
    fil: "Matigas, normal ang kulay",
    bik: "Matagas, normal an kolor",
  },
  "opt.mushroom.discoloured": {
    en: "Yellow or brown patches",
    fil: "May dilaw o kayumangging bahagi",
    bik: "Igwang duyaw o kayumanggi na parte",
  },
  "opt.mushroom.spots": {
    en: "Spots or blotches",
    fil: "May batik o mantsa",
    bik: "May mantsa o batik",
  },
  "opt.mushroom.slimy": {
    en: "Slimy, soft or bad smell",
    fil: "Malagkit, malambot o mabaho",
    bik: "Malagkit, malumoy o mabaho",
  },
  "opt.mushroom.dry": {
    en: "Dry or cracked caps",
    fil: "Tuyo o may bitak na takip",
    bik: "Mamara o may bitak na payong",
  },
  "opt.mushroom.misshapen": {
    en: "Misshapen, or long thin stems",
    fil: "Kakaiba ang hugis, o mahaba at manipis na tangkay",
    bik: "Iba an porma, o halaba asin manipis na tangkay",
  },
  "opt.mushroom.mold": {
    en: "Green or other mold",
    fil: "Berde o ibang amag",
    bik: "Berde o iba na agupong",
  },
  "weather.today": {
    en: "Weather at the farm today: {temperature}°C · {condition}",
    fil: "Panahon sa bukid ngayon: {temperature}°C · {condition}",
    bik: "Panahon sa uma ngunyan: {temperature}°C · {condition}",
  },
  "asmt.fromPhoto": { en: "From photo", fil: "Mula sa litrato", bik: "Hali sa litrato" },
  "asmt.fromLastCheck": { en: "Last check", fil: "Huling pagsusuri", bik: "Huring pagsusi" },
  "asmt.lastCheckFilled": {
    en: "Your answers from the last check ({date}) are filled in. Change anything that is different now.",
    fil: "Nakalagay na ang mga sagot mo noong huling pagsusuri ({date}). Palitan ang anumang naiba ngayon.",
    bik: "Nakalaag na an mga simbag mo kan huring pagsusi ({date}). Liwanan an ano man na naiba ngunyan.",
  },
  "asmt.nextPlant": {
    en: "Assess next: {name}",
    fil: "Susunod na suriin: {name}",
    bik: "Sunod na susihon: {name}",
  },
  "asmt.stillDue": {
    en: "{n} plants are still due for their weekly check.",
    fil: "{n} tanim pa ang kailangang suriin ngayong linggo.",
    bik: "{n} pang tanom an kaipuhan susihon ngunyan na semana.",
  },
  "asmt.stillDueOne": {
    en: "1 plant is still due for its weekly check.",
    fil: "1 tanim pa ang kailangang suriin ngayong linggo.",
    bik: "1 pang tanom an kaipuhan susihon ngunyan na semana.",
  },
  "asmt.allChecked": {
    en: "All your plants are checked for this week.",
    fil: "Nasuri na ang lahat ng iyong tanim ngayong linggo.",
    bik: "Nasusi na an gabos mong tanom ngunyan na semana.",
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
  "asmt.answersMismatch": {
    en: "Your answers don't match the photo, so this assessment can't be evaluated. Correct the answers or take a new photo, then submit again.",
    fil: "Hindi tugma ang iyong mga sagot sa litrato, kaya hindi masusuri ang assessment na ito. Itama ang mga sagot o kumuha ng bagong litrato, saka isumite muli.",
    bik: "Dili angay an imo mga simbag sa litrato, kaya dili masusuri ini na assessment. Tadtaron an mga simbag o magkuha nin bag-o na litrato, dangan isumite giraray.",
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
    en: "Photo of your plant",
    fil: "Litrato ng iyong tanim",
    bik: "Litrato san imo tanom",
  },
  "upload.hint": {
    en: "Show the plant clearly in good lighting for better evaluation.",
    fil: "Ipakita nang malinaw ang tanim sa maliwanag na lugar para mas mahusay na masuri.",
    bik: "Ipahiling nin malinaw an tanom sa maliwanag na lugar para mas marhay an pagsusi.",
  },
  "upload.takePhoto": { en: "Take photo", fil: "Kumuha ng litrato", bik: "Magkuha nin litrato" },
  "upload.fromGallery": {
    en: "Choose from gallery",
    fil: "Pumili mula sa gallery",
    bik: "Pumili hali sa gallery",
  },
  "upload.preparing": {
    en: "Preparing photo…",
    fil: "Inihahanda ang litrato…",
    bik: "Inaandam an litrato…",
  },
  "upload.limits": {
    en: "Large photos are made smaller automatically.",
    fil: "Awtomatikong pinaliliit ang malalaking litrato.",
    bik: "Awtomatikong pinapasadit an darakulang litrato.",
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
  "verdict.not_genuine": {
    en: "Not a Photo of Your Plant",
    fil: "Hindi Litrato ng Iyong Tanim",
    bik: "Dili Litrato san Imo Tanom",
  },
  "verdict.unclear": {
    en: "Photo Not Clear Enough",
    fil: "Hindi Sapat ang Linaw ng Litrato",
    bik: "Dili Igo an Linaw san Litrato",
  },
  "verdict.wrong_stage": {
    en: "Photo doesn't match the plant's age",
    fil: "Hindi tugma ang litrato sa edad ng tanim",
    bik: "Dai angay an litrato sa edad san tanom",
  },
  "verdict.replace": { en: "Replace Image", fil: "Palitan ang Litrato", bik: "Liwanan an Litrato" },
});
