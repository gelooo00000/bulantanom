import { defineMessages } from "../define";

/** The Farmer dashboard and its cards. */
export const dashboard = defineMessages({
  "dash.loading": {
    en: "Loading your farm data…",
    fil: "Kinukuha ang datos ng iyong bukid…",
    bik: "Kinukuha an datos san imo uma…",
  },
  "dash.cantConnect": {
    en: "Unable to connect to BulanTanom.",
    fil: "Hindi makakonekta sa BulanTanom.",
    bik: "Dili makakonekta sa BulanTanom.",
  },
  "dash.eyebrow": {
    en: "Layuan Farm · AI Farm Intelligence",
    fil: "Layuan Farm · AI para sa Bukid",
    bik: "Layuan Farm · AI para sa Uma",
  },
  "dash.welcome": {
    en: "Welcome, {name}.",
    fil: "Maligayang pagdating, {name}.",
    bik: "Dagos, {name}.",
  },
  "dash.emptyTitle": {
    en: "You haven't added any plants yet",
    fil: "Wala ka pang naidadagdag na tanim",
    bik: "Waray ka pa naidugang na tanom",
  },
  "dash.emptyText": {
    en: "Add your first plant to start tracking its growth, risk, and harvest window.",
    fil: "Idagdag ang iyong unang tanim para masubaybayan ang paglaki, panganib, at panahon ng ani nito.",
    bik: "Idugang an imo enot na tanom para mabantayan an pagdakula, peligro, asin panahon san pag-ani kaini.",
  },
  "dash.addFirst": {
    en: "Add Your First Plant",
    fil: "Idagdag ang Unang Tanim",
    bik: "Idugang an Enot na Tanom",
  },
  "dash.cropRisk": { en: "Crop risk", fil: "Panganib sa pananim", bik: "Peligro san tanom" },
  "dash.details": { en: "Details", fil: "Detalye", bik: "Detalye" },

  "alerts.none": {
    en: "Nothing needs your attention right now.",
    fil: "Walang kailangang asikasuhin sa ngayon.",
    bik: "Waray kinahanglan asikasuhon yana.",
  },
  "alerts.title": {
    en: "Needs attention",
    fil: "Kailangang asikasuhin",
    bik: "Kinahanglan asikasuhon",
  },

  "harvest.title": { en: "Harvest schedule", fil: "Iskedyul ng ani", bik: "Iskedyul san ani" },
  "harvest.all": { en: "All harvests", fil: "Lahat ng ani", bik: "Ngatanan na ani" },
  "harvest.none": {
    en: "No harvests scheduled. Add a plant and its window will appear here.",
    fil: "Walang nakatakdang ani. Magdagdag ng tanim at lalabas dito ang panahon ng ani nito.",
    bik: "Waray pa ani na nakatakda. Magdugang san tanom asin makikita digdi an panahon san ani kaini.",
  },
  "when.readyNow": { en: "Ready now", fil: "Handa na", bik: "Pwede na anihon" },
  "when.today": { en: "Today", fil: "Ngayon", bik: "Yana" },
  "when.tomorrow": { en: "Tomorrow", fil: "Bukas", bik: "Buwas" },
  "when.days": { en: "in {n} days", fil: "sa loob ng {n} araw", bik: "sa sulod san {n} adlaw" },
  "when.month": { en: "in 1 month", fil: "sa loob ng 1 buwan", bik: "sa sulod san 1 bulan" },
  "when.months": {
    en: "in {n} months",
    fil: "sa loob ng {n} buwan",
    bik: "sa sulod san {n} bulan",
  },
  "when.year": { en: "in 1 year", fil: "sa loob ng 1 taon", bik: "sa sulod san 1 taon" },
  "when.years": { en: "in {n} years", fil: "sa loob ng {n} taon", bik: "sa sulod san {n} taon" },

  "suited.title": {
    en: "Planted on your date",
    fil: "Naitanim sa iyong petsa",
    bik: "Natanom sa imo petsa",
  },
  "suited.pickDate": { en: "Pick a date", fil: "Pumili ng petsa", bik: "Pili san petsa" },
  "suited.addPlant": { en: "Add a plant", fil: "Magdagdag ng tanim", bik: "Magdugang san tanom" },
  "suited.empty": {
    en: "Plants you add will appear here by the date you planted them.",
    fil: "Lalabas dito ang mga tanim na idaragdag mo ayon sa petsa ng pagtatanim.",
    bik: "Makikita digdi an mga tanom na idugang mo segun sa petsa san pagtanom.",
  },
  "suited.nothingPlanned": {
    en: "Nothing is planned for {date}.",
    fil: "Walang nakaplano para sa {date}.",
    bik: "Waray nakaplano para sa {date}.",
  },
  "suited.nothingPlanted": {
    en: "Nothing was planted on {date}.",
    fil: "Walang naitanim noong {date}.",
    bik: "Waray natanom kan {date}.",
  },
  "suited.plannedFor": {
    en: "Planned for {date} · {count}",
    fil: "Nakaplano sa {date} · {count}",
    bik: "Nakaplano sa {date} · {count}",
  },
  "suited.plantedOn": {
    en: "Planted on {date} · {count}",
    fil: "Naitanim noong {date} · {count}",
    bik: "Natanom kan {date} · {count}",
  },
  "suited.listLabel": {
    en: "Planted on this date",
    fil: "Naitanim sa petsang ito",
    bik: "Natanom sa petsa na ini",
  },

  "plants.one": { en: "1 plant", fil: "1 tanim", bik: "1 tanom" },
  "plants.many": { en: "{n} plants", fil: "{n} tanim", bik: "{n} tanom" },
  "plant.planned": { en: "Planned", fil: "Nakaplano", bik: "Nakaplano" },

  "addTile.title": {
    en: "Add another plant",
    fil: "Magdagdag ng isa pang tanim",
    bik: "Magdugang san iba pa na tanom",
  },
  "addTile.hint": {
    en: "See what's recommended to plant now",
    fil: "Tingnan ang mga inirerekomendang itanim ngayon",
    bik: "Hilingon an mga rekomendado na itanom yana",
  },
  "addPlant.button": { en: "Add Plant", fil: "Magdagdag ng Tanim", bik: "Magdugang san Tanom" },
});
