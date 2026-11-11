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
  "arduino.deviceStep": {
    en: "Choose your device",
    fil: "Piliin ang iyong device",
    bik: "Pilion an imo device",
  },
  "arduino.deviceTitle": {
    en: "Which device will you use?",
    fil: "Aling device ang gagamitin mo?",
    bik: "Arin na device an gagamiton mo?",
  },
  "arduino.deviceBody": {
    en: "The sensor connects to a laptop with a USB cable, or to a phone by Bluetooth.",
    fil: "Kumokonekta ang sensor sa laptop gamit ang USB cable, o sa telepono gamit ang Bluetooth.",
    bik: "Nagkokonekta an sensor sa laptop gamit an USB cable, o sa telepono gamit an Bluetooth.",
  },
  "arduino.deviceLaptop": { en: "Laptop", fil: "Laptop", bik: "Laptop" },
  "arduino.deviceLaptopHint": {
    en: "Chrome or Edge, with the USB cable",
    fil: "Chrome o Edge, gamit ang USB cable",
    bik: "Chrome o Edge, gamit an USB cable",
  },
  "arduino.devicePhone": { en: "Phone", fil: "Telepono", bik: "Telepono" },
  "arduino.devicePhoneHint": {
    en: "Android phone with Chrome, by Bluetooth",
    fil: "Android na telepono na may Chrome, gamit ang Bluetooth",
    bik: "Android na telepono na may Chrome, gamit an Bluetooth",
  },
  "arduino.iphoneWarningTitle": {
    en: "iPhones can't use the Arduino.",
    fil: "Hindi magagamit ng iPhone ang Arduino.",
    bik: "Dili magagamit kan iPhone an Arduino.",
  },
  "arduino.iphoneWarning": {
    en: "iPhones and iPads cannot connect to the sensor. Use an Android phone or a laptop, or type the readings instead.",
    fil: "Hindi makakonekta sa sensor ang iPhone at iPad. Gumamit ng Android na telepono o laptop, o i-type na lang ang mga sukat.",
    bik: "Dili makakonekta sa sensor an iPhone asin iPad. Maggamit nin Android na telepono o laptop, o i-type na sana an mga sukat.",
  },
  "arduino.phoneApp": {
    en: "Download the app named Serial USB Terminal from the Google Play Store.",
    fil: "I-download ang app na Serial USB Terminal mula sa Google Play Store.",
    bik: "I-download an app na Serial USB Terminal hali sa Google Play Store.",
  },
  "arduino.phoneBaud": {
    en: "Open Serial USB Terminal, go to Settings, and change the Baud rate to 115200.",
    fil: "Buksan ang Serial USB Terminal, pumunta sa Settings, at palitan ang Baud rate sa 115200.",
    bik: "Buksan an Serial USB Terminal, magduman sa Settings, asin ribayan an Baud rate sa 115200.",
  },
  "arduino.phoneHow1": {
    en: "Open BulanTanom in Chrome on your Android phone and turn on Bluetooth (and Location, on older phones).",
    fil: "Buksan ang BulanTanom sa Chrome sa iyong Android na telepono at buksan ang Bluetooth (at ang Location, sa mas lumang telepono).",
    bik: "Buksan an BulanTanom sa Chrome sa imo Android na telepono asin buksan an Bluetooth (asin an Location, sa mas gurang na telepono).",
  },
  "arduino.phoneHow2": {
    en: "Turn the sensor on with its power bank or charger, and keep your phone within a few metres of it.",
    fil: "Buksan ang sensor gamit ang power bank o charger nito, at ilapit ang telepono nang ilang metro lang.",
    bik: "Buksan an sensor gamit an power bank o charger kaini, asin idani an telepono nin pira sana na metro.",
  },
  "arduino.unsupportedPhone": {
    en: "This phone's browser cannot connect to the sensor by Bluetooth. Open BulanTanom in Chrome on an Android phone (iPhones cannot connect), use a laptop, or type the readings instead.",
    fil: "Hindi makakonekta sa sensor gamit ang Bluetooth ang browser ng teleponong ito. Buksan ang BulanTanom sa Chrome sa Android na telepono (hindi makakonekta ang iPhone), gumamit ng laptop, o i-type na lang ang mga sukat.",
    bik: "Dili makakonekta sa sensor gamit an Bluetooth an browser kan telepono na ini. Buksan an BulanTanom sa Chrome sa Android na telepono (dili makakonekta an iPhone), maggamit nin laptop, o i-type na sana an mga sukat.",
  },
  "arduino.stepOf": { en: "Step {step} of 3", fil: "Hakbang {step} sa 3", bik: "Lakdang {step} sa 3" },
  "arduino.next": { en: "Next", fil: "Susunod", bik: "Sunod" },
  "arduino.back": { en: "Back", fil: "Bumalik", bik: "Balik" },
  "arduino.introBody": {
    en: "The sensor measures soil temperature, moisture, conductivity, pH, nitrogen, phosphorus and potassium - every reading the form needs.",
    fil: "Sinusukat ng sensor ang temperatura, basa, conductivity, pH, nitrogen, phosphorus at potassium ng lupa - lahat ng sukat na kailangan ng form.",
    bik: "Sinusukat san sensor an temperatura, kabasa, conductivity, pH, nitrogen, phosphorus asin potassium san daga - ngatanan na sukat na kinahanglan san form.",
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
  "arduino.how2Bluetooth": {
    en: "Turn the sensor on and keep this phone within a few metres of it, with Bluetooth on.",
    fil: "Buksan ang sensor at ilapit ang teleponong ito nang ilang metro lang, nakabukas ang Bluetooth.",
    bik: "Buksan an sensor asin idani an telepono na ini nin pira sana na metro, bukas an Bluetooth.",
  },
  "arduino.how3Bluetooth": {
    en: "Press Connect by Bluetooth, then choose BulanTanom-Soil from the list.",
    fil: "Pindutin ang Connect by Bluetooth, saka piliin ang BulanTanom-Soil sa listahan.",
    bik: "Pinduton an Connect by Bluetooth, dangan pilion an BulanTanom-Soil sa listahan.",
  },
  "arduino.how3": {
    en: "Press Connect by USB, then choose the Arduino from the list your browser shows.",
    fil: "Pindutin ang Kumonekta sa USB, saka piliin ang Arduino sa listahang ipapakita ng browser.",
    bik: "Pinduton an Magkonekta sa USB, dangan pilion an Arduino sa listahan na ipapahiling san browser.",
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
    en: "Press Connect by USB and pick the Arduino's port.",
    fil: "Pindutin ang Kumonekta sa USB at piliin ang port ng Arduino.",
    bik: "Pinduton an Magkonekta sa USB asin pilion an port san Arduino.",
  },
  "arduino.goBodyBluetooth": {
    en: "Press Connect by Bluetooth and pick BulanTanom-Soil.",
    fil: "Pindutin ang Connect by Bluetooth at piliin ang BulanTanom-Soil.",
    bik: "Pinduton an Connect by Bluetooth asin pilion an BulanTanom-Soil.",
  },
  "arduino.goUsb": { en: "Connect by USB", fil: "Kumonekta sa USB", bik: "Magkonekta sa USB" },
  "arduino.goBluetooth": {
    en: "Connect by Bluetooth",
    fil: "Kumonekta sa Bluetooth",
    bik: "Magkonekta sa Bluetooth",
  },
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
    en: "This browser cannot connect to the Arduino. Open BulanTanom in Chrome on an Android phone or in Chrome or Edge on a computer, or type the readings instead.",
    fil: "Hindi makakonekta ang browser na ito sa Arduino. Buksan ang BulanTanom sa Chrome sa Android na telepono o sa Chrome o Edge sa computer, o i-type na lang ang mga sukat.",
    bik: "Dili makakonekta an browser na ini sa Arduino. Buksan an BulanTanom sa Chrome sa Android na telepono o sa Chrome o Edge sa computer, o i-type na sana an mga sukat.",
  },
  "arduino.error.cancelled": {
    en: "No Arduino was chosen. Press Connect by USB to try again.",
    fil: "Walang napiling Arduino. Pindutin ang Kumonekta sa USB para subukan muli.",
    bik: "Waray napili na Arduino. Pinduton an Magkonekta sa USB para probaran giraray.",
  },
  "arduino.error.busy": {
    en: "Another program is using the Arduino. Close the Arduino IDE's Serial Monitor, then try again.",
    fil: "May ibang programang gumagamit sa Arduino. Isara ang Serial Monitor ng Arduino IDE, saka subukan muli.",
    bik: "May iba na programa na naggagamit sa Arduino. Isara an Serial Monitor san Arduino IDE, dangan probaran giraray.",
  },
  "arduino.error.no_data": {
    en: "Nothing came from the Arduino. Check that you picked the Arduino's port (often named CP2102 or USB to UART) and that the BulanTanom soil sensor sketch is uploaded, then try again.",
    fil: "Walang dumating mula sa Arduino. Tiyaking port ng Arduino ang napili mo (kadalasang CP2102 o USB to UART ang pangalan) at naka-upload ang BulanTanom soil sensor sketch, saka subukan muli.",
    bik: "Waray nag-abot hali sa Arduino. Siguraduhon na port san Arduino an napili mo (parati CP2102 o USB to UART an ngaran) asin naka-upload an BulanTanom soil sensor sketch, dangan probaran giraray.",
  },
  "arduino.error.unrecognized": {
    en: "The Arduino is sending something, but not BulanTanom soil readings. Upload the BulanTanom soil sensor sketch (hardware/soil-sensor), then try again.",
    fil: "May ipinapadala ang Arduino, pero hindi ito mga sukat ng BulanTanom. I-upload ang BulanTanom soil sensor sketch (hardware/soil-sensor), saka subukan muli.",
    bik: "May pinapadara an Arduino, pero bako ini mga sukat san BulanTanom. I-upload an BulanTanom soil sensor sketch (hardware/soil-sensor), dangan probaran giraray.",
  },
  "arduino.received": {
    en: "Last thing the Arduino sent:",
    fil: "Huling ipinadala ng Arduino:",
    bik: "Huring pinadara san Arduino:",
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
  "arduino.error.bluetooth_off": {
    en: "Bluetooth is off. Turn on Bluetooth (and Location, on older Android phones), then try again.",
    fil: "Nakapatay ang Bluetooth. Buksan ang Bluetooth (at ang Location, sa mas lumang Android), saka subukan muli.",
    bik: "Nakapatay an Bluetooth. Buksan an Bluetooth (asin an Location, sa mas gurang na Android), dangan probaran giraray.",
  },
  "arduino.error.ble_permission_denied": {
    en: "Chrome is not allowed to use Bluetooth. Allow Nearby devices for Chrome in your phone's Settings, and Bluetooth for this site in Chrome's site settings, then try again.",
    fil: "Hindi pinapayagang gumamit ng Bluetooth ang Chrome. Payagan ang Nearby devices para sa Chrome sa Settings ng telepono, at ang Bluetooth para sa site na ito sa site settings ng Chrome, saka subukan muli.",
    bik: "Dili tinutugutan an Chrome na maggamit nin Bluetooth. Tugutan an Nearby devices para sa Chrome sa Settings san telepono, asin an Bluetooth para sa site na ini sa site settings san Chrome, dangan probaran giraray.",
  },
  "arduino.error.ble_not_found": {
    en: "No sensor was chosen. If BulanTanom-Soil did not show up in the list, check that the sensor is on and close by, then try again.",
    fil: "Walang napiling sensor. Kung hindi lumabas ang BulanTanom-Soil sa listahan, tiyaking nakabukas at malapit ang sensor, saka subukan muli.",
    bik: "Waray napili na sensor. Kun dili nagluwas an BulanTanom-Soil sa listahan, siguraduhon na bukas asin harani an sensor, dangan probaran giraray.",
  },
  "arduino.error.ble_wrong_device": {
    en: "That device is not sending BulanTanom soil readings. Upload the BulanTanom soil sensor sketch (hardware/soil-sensor) to the ESP32, then try again.",
    fil: "Hindi nagpapadala ng sukat ng BulanTanom ang device na iyon. I-upload ang BulanTanom soil sensor sketch (hardware/soil-sensor) sa ESP32, saka subukan muli.",
    bik: "Dili nagpapadara nin sukat san BulanTanom an device na iyan. I-upload an BulanTanom soil sensor sketch (hardware/soil-sensor) sa ESP32, dangan probaran giraray.",
  },
  "arduino.error.ble_connect_failed": {
    en: "Could not connect to the sensor. Move closer, turn the sensor off and on, then try again.",
    fil: "Hindi makakonekta sa sensor. Lumapit, patayin at buksan muli ang sensor, saka subukan ulit.",
    bik: "Dili makakonekta sa sensor. Magdani, patayon asin buksan giraray an sensor, dangan probaran utro.",
  },
  "arduino.error.ble_no_data": {
    en: "The sensor connected but sent nothing. Turn it off and on, then try again.",
    fil: "Nakakonekta ang sensor pero walang ipinadala. Patayin at buksan ito muli, saka subukan ulit.",
    bik: "Nakakonekta an sensor pero waray pinadara. Patayon asin buksan ini giraray, dangan probaran utro.",
  },
  "arduino.error.ble_disconnected": {
    en: "The Bluetooth connection to the sensor dropped. Move closer and try again.",
    fil: "Naputol ang Bluetooth na koneksyon sa sensor. Lumapit at subukan muli.",
    bik: "Napugtol an Bluetooth na koneksyon sa sensor. Magdani asin probaran giraray.",
  },
  "arduino.filledNotice": {
    en: "All seven readings were filled in from the sensor.",
    fil: "Napunan na ang pitong sukat mula sa sensor.",
    bik: "Napunan na an pito na sukat hali sa sensor.",
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
    en: "Enter the readings from your soil detector. All seven are needed for a crop recommendation.",
    fil: "Ilagay ang mga sukat mula sa iyong soil detector. Kailangan ang lahat ng pito para sa rekomendasyon ng pananim.",
    bik: "Ibutang an mga sukat hali sa imo soil detector. Kinahanglan an ngatanan na pito para sa rekomendasyon san tanom.",
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

  // Soil check warning signs (components/farmer/soil-check-panel). The
  // grades come from backend/plants/soil_check.py; these only word them.
  "soilCheck.title": { en: "Soil warning signs", fil: "Mga babala sa lupa", bik: "Mga paabiso sa daga" },
  "soilCheck.favorable": {
    en: "Your soil looks good for planting.",
    fil: "Maayos ang iyong lupa para magtanim.",
    bik: "Marhay an imo daga para magtanom.",
  },
  "soilCheck.needs_care": {
    en: "You can plant, but some readings need care. Only crops that can handle them are shown.",
    fil: "Puwede kang magtanim, pero may ilang sukat na kailangang bantayan. Ang ipinapakita lang ay mga pananim na kaya ito.",
    bik: "Puwede ka magtanom, pero may pira na sukat na kaipuhan bantayan. An ipinapahiling sana iyo an mga tanom na kaya ini.",
  },
  "soilCheck.unsuitable": {
    en: "Your soil is not ready for planting yet. Fix the problems below first, then test the soil again.",
    fil: "Hindi pa handa ang iyong lupa para magtanim. Ayusin muna ang mga problema sa ibaba, saka subukan muli ang lupa.",
    bik: "Dili pa andam an imo daga para magtanom. Ayuson muna an mga problema sa ubos, dangan sukaton liwat an daga.",
  },
  "soilCheck.noCropsTitle": {
    en: "No crops recommended for this soil",
    fil: "Walang inirerekomendang pananim para sa lupang ito",
    bik: "Waray rekomendado na tanom para sa daga na ini",
  },
  "soilCheck.noCropsBody": {
    en: "Planting now would likely fail. Follow the steps below to fix the soil, then check it again.",
    fil: "Malamang na hindi tutubo kung magtatanim ngayon. Sundin ang mga hakbang sa ibaba para ayusin ang lupa, saka suriin muli.",
    bik: "Posible na dili matubo kun magtanom ngunyan. Sunodon an mga hakbang sa ubos para ayuson an daga, dangan susiha liwat.",
  },
  "soilCheck.level.good": { en: "Good", fil: "Maayos", bik: "Marhay" },
  "soilCheck.level.caution": { en: "Needs care", fil: "Bantayan", bik: "Bantayan" },
  "soilCheck.level.critical": { en: "Fix first", fil: "Ayusin muna", bik: "Ayuson muna" },
  "soilCheck.ok": { en: "Fine for most crops.", fil: "Ayos para sa karamihan ng pananim.", bik: "Marhay para sa kadaklan na tanom." },
  "soilCheck.ph_low": {
    en: "Too sour (pH {value}). Most crops like 5.5 to 7.5. Mix in garden lime or wood ash.",
    fil: "Masyadong maasim (pH {value}). Gusto ng karamihan ng pananim ang 5.5 hanggang 7.5. Haluan ng apog o abo ng kahoy.",
    bik: "Sobra na maaslom (pH {value}). Gusto san kadaklan na tanom an 5.5 sagkod 7.5. Halean nin apog o abo san kahoy.",
  },
  "soilCheck.ph_high": {
    en: "pH too high ({value}). Most crops like 5.5 to 7.5. Add compost or rotted manure.",
    fil: "Masyadong mataas ang pH ({value}). Gusto ng karamihan ng pananim ang 5.5 hanggang 7.5. Lagyan ng compost o bulok na dumi ng hayop.",
    bik: "Sobra kahalangkaw an pH ({value}). Gusto san kadaklan na tanom an 5.5 sagkod 7.5. Butangan nin compost o lapa na ati san hayop.",
  },
  "soilCheck.moisture_low": {
    en: "Too dry ({value}%). Water the soil well and cover it with mulch.",
    fil: "Masyadong tuyo ({value}%). Diligan nang mabuti ang lupa at takpan ng mulch.",
    bik: "Sobra na mamara ({value}%). Bubuan nin marhay an daga asin takopan nin mulch.",
  },
  "soilCheck.moisture_high": {
    en: "Too wet ({value}%). Roots can rot. Dig drainage canals or raise the beds.",
    fil: "Masyadong basa ({value}%). Puwedeng mabulok ang ugat. Gumawa ng kanal o itaas ang taniman.",
    bik: "Sobra na basa ({value}%). Puwede malapa an gamot. Magkutkot nin kanal o pahalangkawon an tanuman.",
  },
  "soilCheck.temp_low": {
    en: "Too cold ({value} °C). Wait for warmer days before planting.",
    fil: "Masyadong malamig ({value} °C). Maghintay ng mas mainit na araw bago magtanim.",
    bik: "Sobra na malipot ({value} °C). Maghalat nin mas mainit na aldaw bago magtanom.",
  },
  "soilCheck.temp_high": {
    en: "Too hot ({value} °C). Shade the soil, mulch it and water early in the morning.",
    fil: "Masyadong mainit ({value} °C). Lilimin ang lupa, lagyan ng mulch at diligan nang maaga.",
    bik: "Sobra na mainit ({value} °C). Lilungan an daga, butangan nin mulch asin bubuan nin aga.",
  },
  "soilCheck.salt_high": {
    en: "Too salty ({value} µS/cm). Flush the soil with plenty of clean water and add compost.",
    fil: "Masyadong maalat ({value} µS/cm). Buhusan ang lupa ng maraming malinis na tubig at lagyan ng compost.",
    bik: "Sobra na maparat ({value} µS/cm). Bubuan an daga nin dakol na malinig na tubig asin butangan nin compost.",
  },
  "soilCheck.n_low": {
    en: "Low nitrogen ({value} mg/kg). Add compost, manure or a nitrogen fertilizer.",
    fil: "Kulang sa nitrogen ({value} mg/kg). Lagyan ng compost, dumi ng hayop o nitrogen fertilizer.",
    bik: "Kulang sa nitrogen ({value} mg/kg). Butangan nin compost, ati san hayop o nitrogen fertilizer.",
  },
  "soilCheck.p_low": {
    en: "Low phosphorus ({value} mg/kg). Add bone meal or a phosphorus fertilizer.",
    fil: "Kulang sa phosphorus ({value} mg/kg). Lagyan ng bone meal o phosphorus fertilizer.",
    bik: "Kulang sa phosphorus ({value} mg/kg). Butangan nin bone meal o phosphorus fertilizer.",
  },
  "soilCheck.k_low": {
    en: "Low potassium ({value} mg/kg). Add wood ash or a potassium fertilizer.",
    fil: "Kulang sa potassium ({value} mg/kg). Lagyan ng abo ng kahoy o potassium fertilizer.",
    bik: "Kulang sa potassium ({value} mg/kg). Butangan nin abo san kahoy o potassium fertilizer.",
  },
});
