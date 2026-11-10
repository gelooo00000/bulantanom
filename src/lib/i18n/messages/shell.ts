import { defineMessages } from "../define";

/** The Farmer's frame: navigation, header, language menu, notification bell. */
export const shell = defineMessages({
  "nav.dashboard": { en: "Dashboard", fil: "Dashboard", bik: "Dashboard" },
  "nav.plants": { en: "My Plants", fil: "Aking mga Tanim", bik: "Mga Tanom Ko" },
  "nav.cropRecommendation": {
    en: "Crop Recommendation",
    fil: "Rekomendasyon ng Pananim",
    bik: "Rekomendasyon san Tanom",
  },
  "nav.risk": { en: "Risk Indicator", fil: "Antas ng Panganib", bik: "Tanda san Peligro" },
  "nav.harvest": { en: "Harvest", fil: "Anihan", bik: "Pag-ani" },
  "nav.farm": { en: "Layuan Farm", fil: "Layuan Farm", bik: "Layuan Farm" },
  "farm.badge": {
    en: "BulanTanom pilot site",
    fil: "Pilot na lugar ng BulanTanom",
    bik: "Pilot na lugar kan BulanTanom",
  },
  "farm.intro": {
    en: "Farmers here track their crops and submit weekly assessments that BulanTanom reads for plant risk, while agricultural officers follow the activity and step in on high-risk cases.",
    fil: "Dito, sinusubaybayan ng mga magsasaka ang kanilang pananim at nagpapasa ng lingguhang pagsusuri na binabasa ng BulanTanom para sa panganib sa halaman, habang sinusundan ng mga agricultural officer ang aktibidad at tumutulong sa mga kasong mataas ang panganib.",
    bik: "Digdi, sinusubaybayan kan mga parauma an saindang tanom asin nagpapasa nin semanal na pagsusi na binabasa kan BulanTanom para sa peligro kan tanom, mantang sinusundan kan mga agricultural officer an aktibidad asin nagtatabang sa mga kaso na hataas an peligro.",
  },
  "farm.explore": { en: "Explore the farm", fil: "Libutin ang bukid", bik: "Libuton an uma" },
  "farm.exploreText": {
    en: "A 3D site map of every facility, field and water source. Drag to look around, zoom in, and hover or tap a pin to see what it is.",
    fil: "Isang 3D na mapa ng bawat pasilidad, bukid at pinagkukunan ng tubig. I-drag para luminga, mag-zoom in, at itapat o i-tap ang isang pin para makita kung ano ito.",
    bik: "Sarong 3D na mapa kan gabos na pasilidad, uma asin burabod nin tubig. I-drag tanganing maglingaw, mag-zoom in, asin itapat o i-tap an sarong pin tanganing maaraman kun ano ini.",
  },
  "nav.assessments": { en: "Assessments", fil: "Mga Pagsusuri", bik: "Mga Pagsusi" },
  "shell.role": { en: "Farmer", fil: "Magsasaka", bik: "Parauma" },
  "shell.logOut": { en: "Log out", fil: "Mag-log out", bik: "Mag-log out" },
  "shell.more": { en: "More", fil: "Iba pa", bik: "Iba pa" },
  "shell.farm": { en: "Layuan Farm", fil: "Layuan Farm", bik: "Layuan Farm" },
  "weather.clear": { en: "Clear", fil: "Maaliwalas", bik: "Maliwanag" },
  "weather.mostly_clear": { en: "Mostly clear", fil: "Halos maaliwalas", bik: "Halos maliwanag" },
  "weather.partly_cloudy": { en: "Partly cloudy", fil: "Bahagyang maulap", bik: "Medyo madampog" },
  "weather.cloudy": { en: "Cloudy", fil: "Maulap", bik: "Madampog" },
  "weather.fog": { en: "Foggy", fil: "Mahamog", bik: "Magabon" },
  "weather.drizzle": { en: "Drizzle", fil: "Ambon", bik: "Tagiti" },
  "weather.light_rain": { en: "Light rain", fil: "Mahinang ulan", bik: "Luway na uran" },
  "weather.rain": { en: "Rain", fil: "Ulan", bik: "Uran" },
  "weather.heavy_rain": { en: "Heavy rain", fil: "Malakas na ulan", bik: "Makusog na uran" },
  "weather.thunderstorm": { en: "Thunderstorm", fil: "Kulog at kidlat", bik: "Dalugdog asin uran" },

  "language.label": { en: "Language", fil: "Wika", bik: "Tataramon" },
  "language.change": {
    en: "Change language (now {name})",
    fil: "Palitan ang wika (ngayon: {name})",
    bik: "Liwanan an tataramon (yana: {name})",
  },
  "language.note": {
    en: "Farmer screens only. Messages from the system and the AI stay in English.",
    fil: "Para sa mga screen ng magsasaka lamang. Nananatiling Ingles ang mga mensahe ng sistema at ng AI.",
    bik: "Para sana sa mga screen san parauma. Ingles pa giyapon an mga mensahe san sistema asin san AI.",
  },

  "bell.title": { en: "Notifications", fil: "Mga Abiso", bik: "Mga Abiso" },
  "bell.titleUnread": {
    en: "Notifications ({count} unread)",
    fil: "Mga Abiso ({count} hindi pa nababasa)",
    bik: "Mga Abiso ({count} dili pa nababasa)",
  },
  "bell.unread": { en: "Unread", fil: "Hindi pa nababasa", bik: "Dili pa nababasa" },
  "bell.all": { en: "All", fil: "Lahat", bik: "Ngatanan" },
  "bell.markAll": {
    en: "Mark all as read",
    fil: "Markahang nabasa lahat",
    bik: "Markahan na nabasa na ngatanan",
  },
  "bell.mute": {
    en: "Mute notification sound",
    fil: "I-mute ang tunog ng abiso",
    bik: "I-mute an tunog san abiso",
  },
  "bell.unmute": {
    en: "Unmute notification sound",
    fil: "Buksan ang tunog ng abiso",
    bik: "Buksan an tunog san abiso",
  },
  "bell.soundOn": {
    en: "Notification sound on",
    fil: "Bukas ang tunog ng abiso",
    bik: "Bukas an tunog san abiso",
  },
  "bell.soundOff": {
    en: "Notification sound off",
    fil: "Sarado ang tunog ng abiso",
    bik: "Sarado an tunog san abiso",
  },
  "bell.loadFailed": {
    en: "Unable to load notifications.",
    fil: "Hindi ma-load ang mga abiso.",
    bik: "Dili ma-load an mga abiso.",
  },
  "bell.noneUnread": {
    en: "No unread notifications",
    fil: "Walang hindi pa nababasang abiso",
    bik: "Waray abiso na dili pa nababasa",
  },
  "bell.none": { en: "No notifications yet", fil: "Wala pang abiso", bik: "Waray pa abiso" },
  "bell.allRead": {
    en: "Everything here has been read.",
    fil: "Nabasa na ang lahat dito.",
    bik: "Nabasa na an ngatanan digdi.",
  },
  "bell.emptyFarmer": {
    en: "Activity on your plants and assessments will appear here.",
    fil: "Lalabas dito ang mga nangyayari sa iyong mga tanim at pagsusuri.",
    bik: "Makikita digdi an mga nangyayari sa imo mga tanom asin pagsusi.",
  },
  "time.justNow": { en: "just now", fil: "ngayon lang", bik: "yana pa lang" },
  "time.minutes": { en: "{n}m ago", fil: "{n} minuto na", bik: "{n} minuto na an naagi" },
  "time.hours": { en: "{n}h ago", fil: "{n} oras na", bik: "{n} oras na an naagi" },
  "time.days": { en: "{n}d ago", fil: "{n} araw na", bik: "{n} adlaw na an naagi" },
});
