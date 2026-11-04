import { defineMessages } from "../define";

/**
 * Crop Recommendation. `soil.<name>` mirrors every entry of `SOIL_STRINGS`
 * in `lib/soil-options.ts`, so `useSoilStrings()` can hand the form the same
 * object shape in the Farmer's language.
 */
export const soil = defineMessages({
  "soilPage.title": {
    en: "Crop Recommendation",
    fil: "Rekomendasyon ng Pananim",
    bik: "Rekomendasyon san Tanom",
  },
  "soilPage.description": {
    en: "Enter your soil properties to get suitable crop suggestions for Layuan Farm.",
    fil: "Ilagay ang katangian ng iyong lupa para makakuha ng mga angkop na pananim para sa Layuan Farm.",
    bik: "Ibutang an kinaiya san imo daga para makakua san mga angay na tanom para sa Layuan Farm.",
  },

  // The optional Arduino soil sensor (components/farmer/arduino-sensor-wizard).
  "arduino.badge": { en: "Works with Arduino", fil: "Gumagana sa Arduino", bik: "Nagagana sa Arduino" },
  "arduino.signTitle": {
    en: "This feature can be used with the Arduino hardware",
    fil: "Magagamit ang feature na ito kasama ang Arduino hardware",
    bik: "Puwede gamiton an feature na ini kaiba an Arduino hardware",
  },
  "arduino.signBody": {
    en: "Put the soil sensor in your soil and it fills in seven readings for you.",
    fil: "Ilagay ang soil sensor sa iyong lupa at ito na ang maglalagay ng pitong sukat para sa iyo.",
    bik: "Ibutang an soil sensor sa imo daga asin ini na an mabutang san pito na sukat para sa imo.",
  },
  "arduino.useSensor": {
    en: "Use the Arduino sensor",
    fil: "Gamitin ang Arduino sensor",
    bik: "Gamiton an Arduino sensor",
  },
  "arduino.typeInstead": {
    en: "Type the readings instead",
    fil: "I-type na lang ang mga sukat",
    bik: "I-type na sana an mga sukat",
  },
  "arduino.stepOf": { en: "Step {step} of 3", fil: "Hakbang {step} sa 3", bik: "Lakdang {step} sa 3" },
  "arduino.next": { en: "Next", fil: "Susunod", bik: "Sunod" },
  "arduino.back": { en: "Back", fil: "Bumalik", bik: "Balik" },
  "arduino.introBody": {
    en: "The sensor measures soil moisture, temperature, conductivity, pH, nitrogen, phosphorus and potassium. You still type Soil Fertility yourself.",
    fil: "Sinusukat ng sensor ang basa, temperatura, conductivity, pH, nitrogen, phosphorus at potassium ng lupa. Ikaw pa rin ang magta-type ng Soil Fertility.",
    bik: "Sinusukat san sensor an kabasa, temperatura, conductivity, pH, nitrogen, phosphorus asin potassium san daga. Ikaw pa man an mata-type san Soil Fertility.",
  },
  "arduino.npkNote": {
    en: "Nitrogen, phosphorus and potassium from the sensor are estimates, not lab results.",
    fil: "Tantiya lang ang nitrogen, phosphorus at potassium mula sa sensor, hindi resulta ng laboratoryo.",
    bik: "Tantiya sana an nitrogen, phosphorus asin potassium hali sa sensor, bako resulta san laboratoryo.",
  },
  "arduino.howTitle": {
    en: "How to use the sensor",
    fil: "Paano gamitin ang sensor",
    bik: "Paano gamiton an sensor",
  },
  "arduino.how1": {
    en: "Push the probe straight into the soil where your crops will grow, until its metal prongs are fully in.",
    fil: "Itusok nang diretso ang probe sa lupang tataniman, hanggang lubog na ang mga bakal nito.",
    bik: "Itusok nin diretso an probe sa daga na tatamnan, sagkod na lubog na an mga puthaw kaini.",
  },
  "arduino.how2": {
    en: "Plug the Arduino into this computer with the USB cable.",
    fil: "Isaksak ang Arduino sa computer na ito gamit ang USB cable.",
    bik: "Isaksak an Arduino sa computer na ini gamit an USB cable.",
  },
  "arduino.how3": {
    en: "Press Go, then choose the Arduino from the list your browser shows.",
    fil: "Pindutin ang Go, saka piliin ang Arduino sa listahang ipapakita ng browser.",
    bik: "Pinduton an Go, dangan pilion an Arduino sa listahan na ipapahiling san browser.",
  },
  "arduino.how4": {
    en: "Keep the probe still for about 10 seconds while it reads.",
    fil: "Huwag galawin ang probe nang mga 10 segundo habang nagsusukat.",
    bik: "Dili paghirohiro an probe nin mga 10 segundo mantang nagsusukat.",
  },
  "arduino.goTitle": {
    en: "Ready to read your soil",
    fil: "Handa nang sukatin ang iyong lupa",
    bik: "Andam na sukaton an imo daga",
  },
  "arduino.goBody": {
    en: "Press Go and pick the Arduino's port.",
    fil: "Pindutin ang Go at piliin ang port ng Arduino.",
    bik: "Pinduton an Go asin pilion an port san Arduino.",
  },
  "arduino.go": { en: "Go", fil: "Go", bik: "Go" },
  "arduino.reading": {
    en: "Reading your soil… keep the probe still.",
    fil: "Sinusukat ang iyong lupa… huwag galawin ang probe.",
    bik: "Sinusukat an imo daga… dili paghirohiro an probe.",
  },
  "arduino.resultTitle": {
    en: "Your sensor readings",
    fil: "Mga sukat mula sa sensor",
    bik: "Mga sukat hali sa sensor",
  },
  "arduino.useReadings": {
    en: "Use these readings",
    fil: "Gamitin ang mga sukat na ito",
    bik: "Gamiton an mga sukat na ini",
  },
  "arduino.readAgain": { en: "Read again", fil: "Sukatin muli", bik: "Sukaton giraray" },
  "arduino.unsupported": {
    en: "This browser cannot connect to the Arduino. Open BulanTanom in Chrome or Edge on a computer, or type the readings instead.",
    fil: "Hindi makakonekta ang browser na ito sa Arduino. Buksan ang BulanTanom sa Chrome o Edge sa computer, o i-type na lang ang mga sukat.",
    bik: "Dili makakonekta an browser na ini sa Arduino. Buksan an BulanTanom sa Chrome o Edge sa computer, o i-type na sana an mga sukat.",
  },
  "arduino.error.cancelled": {
    en: "No Arduino was chosen. Press Go to try again.",
    fil: "Walang napiling Arduino. Pindutin ang Go para subukan muli.",
    bik: "Waray napili na Arduino. Pinduton an Go para probaran giraray.",
  },
  "arduino.error.busy": {
    en: "Another program is using the Arduino. Close the Arduino IDE's Serial Monitor, then try again.",
    fil: "May ibang programang gumagamit sa Arduino. Isara ang Serial Monitor ng Arduino IDE, saka subukan muli.",
    bik: "May iba na programa na naggagamit sa Arduino. Isara an Serial Monitor san Arduino IDE, dangan probaran giraray.",
  },
  "arduino.error.no_data": {
    en: "No readings came from the Arduino. Check that the soil sensor program is uploaded, then try again.",
    fil: "Walang dumating na sukat mula sa Arduino. Tiyaking naka-upload ang programa ng soil sensor, saka subukan muli.",
    bik: "Waray nag-abot na sukat hali sa Arduino. Siguraduhon na naka-upload an programa san soil sensor, dangan probaran giraray.",
  },
  "arduino.error.probe_not_answering": {
    en: "The Arduino is connected, but the soil probe is not answering. Check the probe's power and its A and B wires.",
    fil: "Nakakonekta ang Arduino pero hindi sumasagot ang soil probe. Suriin ang kuryente ng probe at ang mga wire na A at B.",
    bik: "Nakakonekta an Arduino pero dili nasimbag an soil probe. Hilingon an kuryente san probe asin an mga wire na A asin B.",
  },
  "arduino.error.disconnected": {
    en: "The Arduino was disconnected. Plug it back in and try again.",
    fil: "Natanggal ang Arduino. Isaksak itong muli at subukan ulit.",
    bik: "Natanggal an Arduino. Isaksak ini giraray asin probaran utro.",
  },
  "arduino.filledNotice": {
    en: "Seven readings were filled in from the sensor. Type Soil Fertility, then press Get Recommendation.",
    fil: "Napunan na ang pitong sukat mula sa sensor. I-type ang Soil Fertility, saka pindutin ang Kunin ang Rekomendasyon.",
    bik: "Napunan na an pito na sukat hali sa sensor. I-type an Soil Fertility, dangan pinduton an Kuaon an Rekomendasyon.",
  },

  "soil.resultTitle": {
    en: "What to plant in your soil",
    fil: "Ano ang maitatanim sa iyong lupa",
    bik: "Ano an puwedeng itanom sa imo daga",
  },
  "soil.suitableFruits": {
    en: "Fruits that will grow well",
    fil: "Mga prutas na tutubo nang maayos",
    bik: "Mga prutas na matubo nin marhay",
  },
  "soil.suitableVegetables": {
    en: "Vegetables that will grow well",
    fil: "Mga gulay na tutubo nang maayos",
    bik: "Mga gulay na matubo nin marhay",
  },
  "soil.suitableCrops": {
    en: "Other crops that will grow well",
    fil: "Iba pang pananim na tutubo nang maayos",
    bik: "Iba pang tanom na matubo nin marhay",
  },
  "soil.fertilizer": {
    en: "What to add to your soil",
    fil: "Ano ang idadagdag sa iyong lupa",
    bik: "Ano an idudugang sa imo daga",
  },
  "soil.soilImprovement": {
    en: "How to fix your soil and watering",
    fil: "Paano ayusin ang lupa at pagdidilig",
    bik: "Paano ayuson an daga asin pagbubo",
  },
  "soil.warnings": {
    en: "Be careful",
    fil: "Mag-ingat",
    bik: "Mag-ingat",
  },
  "soil.seeMoreAdvice": {
    en: "See more",
    fil: "Tingnan pa",
    bik: "Hilingon pa",
  },
  "soil.seeLess": {
    en: "Show fewer",
    fil: "Ipakita nang mas kaunti",
    bik: "Ipahiling an mas dikit",
  },
  "soil.noWarnings": {
    en: "No major warnings based on the information provided.",
    fil: "Walang malaking babala batay sa impormasyong ibinigay.",
    bik: "Waray dakula na paabiso basado sa impormasyon na itinao.",
  },
  "soil.soilType": { en: "Soil Type", fil: "Uri ng Lupa", bik: "Klase san Daga" },
  "soil.soilTexture": { en: "Soil Texture", fil: "Tekstura ng Lupa", bik: "Tekstura san Daga" },
  "soil.drainage": { en: "Drainage", fil: "Pagdaloy ng Tubig", bik: "Pagdalagan san Tubig" },
  "soil.soilMoisture": { en: "Soil Moisture", fil: "Basa ng Lupa", bik: "Kabasa san Daga" },
  "soil.phLevel": { en: "Soil pH", fil: "pH ng Lupa", bik: "pH san Daga" },
  "soil.phHint": {
    en: "Leave blank if you do not know.",
    fil: "Iwanang blangko kung hindi mo alam.",
    bik: "Pabayaan na blangko kun dili mo aram.",
  },
  "soil.nitrogen": { en: "Nitrogen", fil: "Nitrogen", bik: "Nitrogen" },
  "soil.phosphorus": { en: "Phosphorus", fil: "Phosphorus", bik: "Phosphorus" },
  "soil.potassium": { en: "Potassium", fil: "Potassium", bik: "Potassium" },
  "soil.organicMatter": { en: "Organic Matter", fil: "Organikong Bagay", bik: "Organiko na Bagay" },
  "soil.additionalInfo": {
    en: "Additional Soil Information",
    fil: "Karagdagang Impormasyon sa Lupa",
    bik: "Dugang na Impormasyon sa Daga",
  },
  "soil.additionalInfoHint": {
    en: "e.g. The soil becomes dry quickly.",
    fil: "hal. Mabilis matuyo ang lupa.",
    bik: "pananglitan: Madali mamara an daga.",
  },
  "soil.optional": { en: "Optional", fil: "Opsyonal", bik: "Opsyonal" },
  "soil.submit": { en: "Get Recommendation", fil: "Kunin ang Rekomendasyon", bik: "Kuaon an Rekomendasyon" },
  "soil.sensorSectionTitle": {
    en: "Soil Detector Readings",
    fil: "Mga Sukat ng Soil Detector",
    bik: "Mga Sukat san Soil Detector",
  },
  "soil.sensorSectionHint": {
    en: "Enter the readings from your soil detector. All eight are needed for a crop recommendation.",
    fil: "Ilagay ang mga sukat mula sa iyong soil detector. Kailangan ang lahat ng walo para sa rekomendasyon ng pananim.",
    bik: "Ibutang an mga sukat hali sa imo soil detector. Kinahanglan an ngatanan na walo para sa rekomendasyon san tanom.",
  },
  "soil.analyzing": {
    en: "Analyzing your soil information…",
    fil: "Sinusuri ang impormasyon ng iyong lupa…",
    bik: "Sinususi an impormasyon san imo daga…",
  },
  "soil.analyzingHint": {
    en: "Reviewing what you reported to suggest suitable crops.",
    fil: "Sinusuri ang iyong iniulat para magmungkahi ng angkop na pananim.",
    bik: "Sinususi an imo inireport para magsugerir san angay na tanom.",
  },
  "soil.aiUnavailable": {
    en: "AI recommendation is temporarily unavailable.",
    fil: "Pansamantalang hindi available ang rekomendasyon ng AI.",
    bik: "Temporaryo na dili makakua san rekomendasyon san AI.",
  },
  "soil.savedNotice": {
    en: "Your soil information has been saved successfully. Please try again later.",
    fil: "Matagumpay na na-save ang impormasyon ng iyong lupa. Pakisubukan muli mamaya.",
    bik: "Naka-save na an impormasyon san imo daga. Probaran tabi liwat maya-maya.",
  },
  "soil.tryAgain": { en: "Try Again", fil: "Subukan Muli", bik: "Probaran Liwat" },
  "soil.retrying": { en: "Analyzing…", fil: "Sinusuri…", bik: "Sinususi…" },
  "soil.retryHint": {
    en: "Your soil information is saved — try again without re-entering anything.",
    fil: "Naka-save ang impormasyon ng iyong lupa — subukan muli nang hindi na naglalagay muli.",
    bik: "Naka-save an impormasyon san imo daga — probaran liwat na dili na magbutang liwat.",
  },
  "soil.stillUnavailable": {
    en: "AI recommendation is still unavailable. Please try again in a few minutes.",
    fil: "Hindi pa rin available ang rekomendasyon ng AI. Pakisubukan muli pagkalipas ng ilang minuto.",
    bik: "Dili pa giyapon makakua san rekomendasyon san AI. Probaran tabi liwat pakalihis san pira na minuto.",
  },
  "soil.backToSoilInfo": {
    en: "Back to Soil Information",
    fil: "Bumalik sa Impormasyon ng Lupa",
    bik: "Balik sa Impormasyon san Daga",
  },
  "soil.seeResult": { en: "See Result", fil: "Tingnan ang Resulta", bik: "Hilingon an Resulta" },
  "soil.resultFrom": { en: "Result from", fil: "Resulta noong", bik: "Resulta kan" },
  "soil.latestTag": { en: "latest", fil: "pinakabago", bik: "pinakabago" },
  "soil.notAnalyzedTag": { en: "not analyzed", fil: "hindi pa nasuri", bik: "dili pa nasusi" },
  "soil.saved": { en: "Saved", fil: "Na-save", bik: "Na-save" },
  "soil.saveSuccess": {
    en: "Crop recommendation saved successfully.",
    fil: "Matagumpay na na-save ang rekomendasyon ng pananim.",
    bik: "Naka-save na an rekomendasyon san tanom.",
  },
  "soil.newAssessmentReady": {
    en: "Enter your soil information for a new assessment.",
    fil: "Ilagay ang impormasyon ng iyong lupa para sa bagong pagsusuri.",
    bik: "Ibutang an impormasyon san imo daga para sa bago na pagsusi.",
  },
  "soil.soilIntelligence": {
    en: "Crop Recommendation",
    fil: "Rekomendasyon ng Pananim",
    bik: "Rekomendasyon san Tanom",
  },
  "soil.latestAssessment": { en: "Last Assessment", fil: "Huling Pagsusuri", bik: "Huri na Pagsusi" },
  "soil.viewRecommendation": {
    en: "View Full Recommendation",
    fil: "Tingnan ang Buong Rekomendasyon",
    bik: "Hilingon an Bilog na Rekomendasyon",
  },
  "soil.noAssessmentTitle": {
    en: "No soil assessment yet",
    fil: "Wala pang pagsusuri ng lupa",
    bik: "Waray pa pagsusi san daga",
  },
  "soil.noAssessmentBody": {
    en: "Enter your soil information to get AI crop suggestions for your plot.",
    fil: "Ilagay ang impormasyon ng iyong lupa para makakuha ng mungkahing pananim mula sa AI.",
    bik: "Ibutang an impormasyon san imo daga para makakua san sugerido na tanom hali sa AI.",
  },
  "soil.assessmentSaved": {
    en: "Soil assessment saved.",
    fil: "Na-save ang pagsusuri ng lupa.",
    bik: "Na-save an pagsusi san daga.",
  },
  "soil.notAnalyzed": {
    en: "No AI recommendation was generated for this assessment. Submit it to get crop suggestions.",
    fil: "Walang nagawang rekomendasyon ng AI para sa pagsusuring ito. Isumite ito para makakuha ng mungkahing pananim.",
    bik: "Waray nagibo na rekomendasyon san AI para sa pagsusi na ini. Isumite ini para makakua san sugerido na tanom.",
  },

  "sensor.soil_temperature": {
    en: "Soil Temperature",
    fil: "Temperatura ng Lupa",
    bik: "Temperatura san Daga",
  },
  "sensor.soil_moisture": { en: "Soil Moisture", fil: "Basa ng Lupa", bik: "Kabasa san Daga" },
  "sensor.soil_conductivity": {
    en: "Soil Conductivity",
    fil: "Conductivity ng Lupa",
    bik: "Conductivity san Daga",
  },
  "sensor.soil_ph": { en: "Soil pH", fil: "pH ng Lupa", bik: "pH san Daga" },
  "sensor.nitrogen": { en: "Nitrogen (N)", fil: "Nitrogen (N)", bik: "Nitrogen (N)" },
  "sensor.phosphorus": { en: "Phosphorus (P)", fil: "Phosphorus (P)", bik: "Phosphorus (P)" },
  "sensor.potassium": { en: "Potassium (K)", fil: "Potassium (K)", bik: "Potassium (K)" },
  "sensor.soil_fertility": {
    en: "Soil Fertility",
    fil: "Taba ng Lupa",
    bik: "Kataba san Daga",
  },
  "sensor.range": {
    en: "{min} to {max} {unit}",
    fil: "{min} hanggang {max} {unit}",
    bik: "{min} sagkod {max} {unit}",
  },
  "sensor.required": {
    en: "{label} is required.",
    fil: "Kailangan ang {label}.",
    bik: "Kinahanglan an {label}.",
  },
  "sensor.notNumber": {
    en: "{label} must be a number.",
    fil: "Dapat numero ang {label}.",
    bik: "Dapat numero an {label}.",
  },
  "sensor.outOfRange": {
    en: "{label} must be between {min} and {max} {unit}.",
    fil: "Dapat nasa pagitan ng {min} at {max} {unit} ang {label}.",
    bik: "Dapat nasa tahaw san {min} asin {max} {unit} an {label}.",
  },
});
