import type { CharacterPreset } from "./types";

const presetRegistry = new Map<string, CharacterPreset>();

// ─── Built-in Presets ─────────────────────────────────────────────────

const BUILT_IN: CharacterPreset[] = [
  {
    id: "sonic-ceo",
    name: "Sonic CEO",
    assetDir: "shorts/short-01/chibis",
    defaultSize: 750,
    accentColor: "#00D4FF",
    glowColor: "#00D4FF",
    shadow: true,
  },
  {
    id: "test-chibi",
    name: "Test Chibi",
    assetDir: "test-chibi",
    defaultSize: 750,
    accentColor: "#2470ff",
    glowColor: "#2470ff",
    shadow: true,
  },
  {
    id: "goku-ceo",
    name: "Goku CEO",
    assetDir: "characters/goku-ceo",
    defaultSize: 750,
    accentColor: "#FF8C00",
    glowColor: "#FF8C00",
    shadow: true,
  },
  {
    id: "naruto-ceo",
    name: "Naruto CEO",
    assetDir: "characters/naruto-ceo",
    defaultSize: 750,
    accentColor: "#FF6B00",
    glowColor: "#FF6B00",
    shadow: true,
  },
];

for (const preset of BUILT_IN) {
  presetRegistry.set(preset.id, preset);
}

// ─── Public API ───────────────────────────────────────────────────────

export const getPreset = (id: string): CharacterPreset | undefined =>
  presetRegistry.get(id);

export const registerPreset = (preset: CharacterPreset): void => {
  presetRegistry.set(preset.id, preset);
};

export const getAllPresets = (): CharacterPreset[] =>
  Array.from(presetRegistry.values());
