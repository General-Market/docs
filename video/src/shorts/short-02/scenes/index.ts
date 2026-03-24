import type { SceneDefinition } from "../../../engine/types/scene";

// Car scenes
export { carLotScene } from "./car-lot.scene";
export { returnScene } from "./return.scene";
export { carDepartureScene } from "./car-departure.scene";

// Intro scenes (desk + other character)
export { forexIntroScene } from "./forex-intro.scene";
export { stocksIntroScene } from "./stocks-intro.scene";
export { bitcoinIntroScene } from "./bitcoin-intro.scene";

// Solo desk scenes
export { forexScene } from "./forex.scene";
export { stocksScene } from "./stocks.scene";
export { bitcoinScene } from "./bitcoin.scene";
export { odteScene } from "./0dte.scene";
export { memecoinsSoloScene } from "./memecoins-solo.scene";
export { polymarketScene } from "./polymarket.scene";
export { carLotFinalScene } from "./car-lot-final.scene";

// Boss/threat scenes (desk + big robot)
export { goldmanScene } from "./goldman.scene";
export { ambushScene } from "./ambush.scene";
export { memecoinsScene } from "./memecoins.scene";
export { defeatScene } from "./defeat.scene";

// Import all for the map
import { carLotScene } from "./car-lot.scene";
import { forexIntroScene } from "./forex-intro.scene";
import { forexScene } from "./forex.scene";
import { stocksIntroScene } from "./stocks-intro.scene";
import { stocksScene } from "./stocks.scene";
import { bitcoinIntroScene } from "./bitcoin-intro.scene";
import { bitcoinScene } from "./bitcoin.scene";
import { goldmanScene } from "./goldman.scene";
import { odteScene } from "./0dte.scene";
import { ambushScene } from "./ambush.scene";
import { memecoinsSoloScene } from "./memecoins-solo.scene";
import { memecoinsScene } from "./memecoins.scene";
import { polymarketScene } from "./polymarket.scene";
import { defeatScene } from "./defeat.scene";
import { returnScene } from "./return.scene";
import { carLotFinalScene } from "./car-lot-final.scene";
import { carDepartureScene } from "./car-departure.scene";

/** All scenes indexed by phase ID — the bridge between shots.ts and the engine */
export const SCENE_MAP: Record<string, SceneDefinition> = {
  "car-lot": carLotScene,
  "forex-intro": forexIntroScene,
  "forex": forexScene,
  "stocks-intro": stocksIntroScene,
  "stocks": stocksScene,
  "bitcoin-intro": bitcoinIntroScene,
  "bitcoin": bitcoinScene,
  "goldman": goldmanScene,
  "0dte": odteScene,
  "ambush": ambushScene,
  "memecoins-solo": memecoinsSoloScene,
  "memecoins": memecoinsScene,
  "polymarket": polymarketScene,
  "defeat": defeatScene,
  "return": returnScene,
  "car-lot-final": carLotFinalScene,
  "car-departure": carDepartureScene,
};
