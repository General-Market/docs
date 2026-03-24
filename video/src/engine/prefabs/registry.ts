import type { PrefabRegistry } from "../types/prefab";

// Characters
import { MixamoCharacter } from "../characters/MixamoCharacter";
import { SmartCharacter } from "../characters/SmartCharacter";
import { BigRobot } from "../characters/BigRobot";
import { BackgroundNPCs } from "../characters/NpcSpawner";

// Props
import { MonitorScreen } from "../props/monitors/MonitorScreen";
import { SimpleCar } from "../props/SimpleCar";
import { HeartSign } from "../props/HeartSign";

/**
 * Default prefab registry.
 * Reference these by name in scene definition files.
 *
 * Usage in a .scene.ts:
 *   { id: "hero", prefab: "mixamo-character", ... }
 */
export const DEFAULT_REGISTRY: PrefabRegistry = {
  "mixamo-character": {
    name: "Mixamo Character",
    component: MixamoCharacter as any,
    defaults: { characterKey: "casualMan", color: "#3B82F6" },
  },
  "smart-character": {
    name: "Smart Character",
    component: SmartCharacter as any,
    defaults: {},
  },
  "big-robot": {
    name: "Big Robot",
    component: BigRobot as any,
    defaults: {},
  },
  "npc-spawner": {
    name: "NPC Spawner",
    component: BackgroundNPCs as any,
    defaults: {},
  },
  "monitor": {
    name: "Monitor Screen",
    component: MonitorScreen as any,
    defaults: {},
  },
  "car": {
    name: "Simple Car",
    component: SimpleCar as any,
    defaults: {},
  },
  "heart-sign": {
    name: "I Heart Miami Sign",
    component: HeartSign as any,
    defaults: {},
  },
  "trading-desk": {
    name: "Trading Desk",
    // TODO: Extract TradingSetup from monolith into engine/props/TradingDesk.tsx
    component: null as any,
    defaults: {
      accentColor: "#3B82F6",
      primaryChart: "candlestick",
      chartSeed: 42,
    },
  },
};
