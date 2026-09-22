import { addPlant } from "./addPlant";
import { assessment } from "./assessment";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { harvest } from "./harvest";
import { pages } from "./pages";
import { plantDetail } from "./plantDetail";
import { plants } from "./plants";
import { risk } from "./risk";
import { shell } from "./shell";
import { soil } from "./soil";

/** Every namespace, merged. Keys are prefixed per screen, so they never clash. */
export const MESSAGES = {
  ...addPlant,
  ...assessment,
  ...common,
  ...dashboard,
  ...harvest,
  ...pages,
  ...plantDetail,
  ...plants,
  ...risk,
  ...shell,
  ...soil,
};

export type MessageKey = keyof typeof MESSAGES;

export { addPlant, assessment, common, dashboard, harvest, pages, plantDetail, plants, risk, shell, soil };
