import type { LightingPreset } from "../../types/lighting";

export { goldenHour } from "./golden-hour";
export { brightMorning, brightMorningSun, brightMidday } from "./bright-midday";
export { bitcoinSunset } from "./bitcoin-sunset";
export { neonNight, neonMidnight, neonDoom } from "./neon-night";
export { stormyRed, purpleTwilight } from "./stormy-red";
export { bossArena } from "./boss-arena";
export { sunsetReturn, deepGolden } from "./sunset-return";

// Import all presets for the registry
import { goldenHour } from "./golden-hour";
import { brightMorning, brightMorningSun, brightMidday } from "./bright-midday";
import { bitcoinSunset } from "./bitcoin-sunset";
import { neonNight, neonMidnight, neonDoom } from "./neon-night";
import { stormyRed, purpleTwilight } from "./stormy-red";
import { bossArena } from "./boss-arena";
import { sunsetReturn, deepGolden } from "./sunset-return";

/** All presets indexed by ID — used by LightingController for string lookups */
export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  "golden-hour": goldenHour,
  "bright-morning": brightMorning,
  "bright-morning-sun": brightMorningSun,
  "bright-midday": brightMidday,
  "bitcoin-sunset": bitcoinSunset,
  "neon-night": neonNight,
  "neon-midnight": neonMidnight,
  "neon-doom": neonDoom,
  "stormy-red": stormyRed,
  "purple-twilight": purpleTwilight,
  "boss-arena": bossArena,
  "sunset-return": sunsetReturn,
  "deep-golden": deepGolden,
};

/** Maps scene phases to lighting preset IDs */
export const PHASE_LIGHTING_MAP: Record<string, string> = {
  "car-lot": "golden-hour",
  "forex-intro": "bright-morning",
  "forex": "bright-morning-sun",
  "stocks-intro": "bright-midday",
  "stocks": "bright-midday",
  "bitcoin-intro": "bitcoin-sunset",
  "bitcoin": "bitcoin-sunset",
  "goldman": "neon-night",
  "0dte": "stormy-red",
  "ambush": "neon-night",
  "memecoins-solo": "neon-midnight",
  "memecoins": "neon-doom",
  "polymarket": "purple-twilight",
  "defeat": "boss-arena",
  "return": "sunset-return",
  "car-lot-final": "deep-golden",
  "car-departure": "golden-hour",
};
