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
  "nav.monitoring": { en: "Monitoring", fil: "Pagsubaybay", bik: "Pagbantay" },
  "nav.history": {
    en: "Assessment History",
    fil: "Kasaysayan ng Pagsusuri",
    bik: "Mga Nakaagi na Pagsusi",
  },
  "shell.role": { en: "Farmer", fil: "Magsasaka", bik: "Parauma" },
  "shell.logOut": { en: "Log out", fil: "Mag-log out", bik: "Mag-log out" },
  "shell.more": { en: "More", fil: "Iba pa", bik: "Iba pa" },
  "shell.farm": { en: "Layuan Farm", fil: "Layuan Farm", bik: "Layuan Farm" },
  "shell.weather": {
    en: "28°C · Partly sunny",
    fil: "28°C · Bahagyang maaraw",
    bik: "28°C · Medyo mainit an adlaw",
  },

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
