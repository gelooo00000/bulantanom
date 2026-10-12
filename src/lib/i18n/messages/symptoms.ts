import { defineMessages } from "../define";

/**
 * Pest and disease tick boxes on the weekly assessment (lib/symptoms.ts says
 * which crop shows which). Short, plain names a farmer recognises in the
 * field, with what to look for where the name alone may not be known.
 */
export const symptoms = defineMessages({
  "sym.pestTitle": {
    en: "Pests you have seen",
    fil: "Mga peste na nakita mo",
    bik: "Mga peste na nahiling mo",
  },
  "sym.diseaseTitle": {
    en: "Signs of disease",
    fil: "Mga palatandaan ng sakit",
    bik: "Mga tanda san helang",
  },
  "sym.tickAll": {
    en: "Tick all you see. Leave empty if you saw none.",
    fil: "Markahan ang lahat ng nakikita mo. Iwanang blangko kung wala.",
    bik: "Markahan an gabos na nahihiling mo. Pabayaan na blangko kun mayo.",
  },
  "sym.other": { en: "Something else", fil: "Iba pa", bik: "Iba pa" },
  "sym.otherPlaceholder": {
    en: "Describe what you saw",
    fil: "Ilarawan ang nakita mo",
    bik: "Isaysay an nahiling mo",
  },

  "sym.pest.aphids": {
    en: "Aphids (tiny bugs on young shoots)",
    fil: "Aphids (maliliit na kulisap sa usbong)",
    bik: "Aphids (sadit na insekto sa usbong)",
  },
  "sym.pest.caterpillars": {
    en: "Caterpillars or worms",
    fil: "Higad o uod",
    bik: "Higad o ulod",
  },
  "sym.pest.leaf_miners": {
    en: "Leaf miners (winding lines in leaves)",
    fil: "Leaf miner (paikot-ikot na guhit sa dahon)",
    bik: "Leaf miner (likaw-likaw na guhit sa dahon)",
  },
  "sym.pest.mealybugs": {
    en: "Mealybugs or scale (white, cottony bugs)",
    fil: "Mealybug o scale (puting parang bulak)",
    bik: "Mealybug o scale (puti na garo gapas)",
  },
  "sym.pest.whiteflies": {
    en: "Whiteflies (tiny white flies under leaves)",
    fil: "Whitefly (maliliit na puting langaw sa ilalim ng dahon)",
    bik: "Whitefly (sadit na puti na lango sa ilalom san dahon)",
  },
  "sym.pest.fruit_flies": {
    en: "Fruit flies (stings or maggots in fruit)",
    fil: "Langaw ng prutas (tusok o uod sa bunga)",
    bik: "Lango san prutas (tusok o ulod sa bunga)",
  },
  "sym.pest.borers": {
    en: "Borers (holes in stem, shoot or fruit)",
    fil: "Borer (butas sa tangkay, usbong o bunga)",
    bik: "Borer (buslo sa tangkay, usbong o bunga)",
  },
  "sym.pest.beetles": {
    en: "Beetles or weevils",
    fil: "Salagubang o weevil",
    bik: "Salagubang o weevil",
  },
  "sym.pest.snails": {
    en: "Snails or slugs",
    fil: "Suso o linta-lupa",
    bik: "Igi o linta-daga",
  },
  "sym.pest.mites": {
    en: "Mites (fine webbing, speckled leaves)",
    fil: "Mites (manipis na sapot, batik-batik na dahon)",
    bik: "Mites (manipis na lawa-lawa, batik-batik na dahon)",
  },
  "sym.pest.thrips": {
    en: "Thrips (silvery scratches on leaves)",
    fil: "Thrips (kulay-pilak na gasgas sa dahon)",
    bik: "Thrips (kolor-pilak na gasgas sa dahon)",
  },
  "sym.pest.gnats": {
    en: "Small flies or gnats",
    fil: "Maliliit na langaw o niknik",
    bik: "Sadit na lango o niknik",
  },
  "sym.pest.rats": {
    en: "Rats or other animals",
    fil: "Daga o ibang hayop",
    bik: "Daga o iba na hayop",
  },

  "sym.disease.leaf_spots": {
    en: "Spots on leaves",
    fil: "Batik sa dahon",
    bik: "Mantsa sa dahon",
  },
  "sym.disease.powdery": {
    en: "White powder on leaves",
    fil: "Puting pulbos sa dahon",
    bik: "Puti na pulbos sa dahon",
  },
  "sym.disease.sooty": {
    en: "Black, sooty coating",
    fil: "Itim na parang uling na balot",
    bik: "Itom na garo uling na balot",
  },
  "sym.disease.rot": {
    en: "Rotting stem, root or base",
    fil: "Nabubulok na tangkay, ugat o puno",
    bik: "Nalalata na tangkay, gamot o puno",
  },
  "sym.disease.fruit_rot": {
    en: "Rotting fruit",
    fil: "Nabubulok na bunga",
    bik: "Nalalata na bunga",
  },
  "sym.disease.wilt": {
    en: "Wilting even when watered",
    fil: "Nalalanta kahit dinidiligan",
    bik: "Nalalaya maski binububoan nin tubig",
  },
  "sym.disease.mosaic": {
    en: "Mottled, curled or shrunken leaves",
    fil: "Batik-batik, kulot o lumiit na dahon",
    bik: "Batik-batik, kulot o nagsadit na dahon",
  },
  "sym.disease.blight": {
    en: "Brown, dying leaf edges or patches",
    fil: "Kayumanggi at namamatay na gilid o bahagi ng dahon",
    bik: "Kayumanggi asin nagagadan na gilid o parte san dahon",
  },
  "sym.disease.mold": {
    en: "Mold or fungus growing",
    fil: "Amag o fungus na tumutubo",
    bik: "Agupong o fungus na nagtutubo",
  },
  "sym.disease.canker": {
    en: "Cracks or sores on bark or stem",
    fil: "Bitak o sugat sa balat o tangkay",
    bik: "Bitak o bakat sa luwas o tangkay",
  },
});
