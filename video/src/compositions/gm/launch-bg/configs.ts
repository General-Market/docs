import type { SceneConfig } from "./shared";
import { ToneMappingMode } from "postprocessing";

/**
 * V1 — Silver ISO
 * Clean brushed silver. Diffuse white/gray. Studio lighting.
 * No iridescence. Pure metallic reflection. BlackRock annual report.
 */
export const silverIso: SceneConfig = {
  baseColor: "#1a1a22",
  metalness: 0.95,
  roughnessRange: [0.15, 0.02],
  clearcoat: 1.0,
  clearcoatRoughness: 0.03,
  iridescence: 0,
  iridescenceIOR: 1.3,
  iridescenceThicknessBase: [100, 400],
  envMapIntensity: 4.0,
  reflectivity: 1.0,

  slatCount: 52,
  slatWidth: 0.06,
  slatGap: 0.001,
  slatAngle: 0.15,
  slatAngleOscillation: 0.03,
  slatAlternate: true,

  pointLights: [
    { color: "#ffffff", speed: 0.08, phase: 0, yOffset: 0.5, radius: 2.5 },
    { color: "#e0e0e8", speed: 0.06, phase: 1.5, yOffset: -0.3, radius: 3.0 },
    { color: "#c0c0d0", speed: 0.1, phase: 3.0, yOffset: 0.8, radius: 2.0 },
    { color: "#ffffff", speed: 0.07, phase: 4.5, yOffset: -0.6, radius: 2.8 },
    { color: "#d0d0e0", speed: 0.09, phase: 2.0, yOffset: 0.0, radius: 2.2 },
    { color: "#f0f0ff", speed: 0.05, phase: 0.5, yOffset: 0.7, radius: 3.2 },
    { color: "#b0b0c0", speed: 0.12, phase: 5.0, yOffset: -0.8, radius: 1.8 },
    { color: "#ffffff", speed: 0.04, phase: 1.0, yOffset: -0.1, radius: 2.6 },
  ],
  pointLightIntensity: 35,
  ambientIntensity: 0.02,
  ambientColor: "#0a0a10",
  directionalIntensity: 6,

  lightformers: [
    { color: "#ffffff", form: "rect", scale: [8, 3, 1], orbitRadius: 6, orbitSpeed: 0.04, yOffset: 4, intensity: 1.5 },
    { color: "#e0e8ff", form: "rect", scale: [10, 2, 1], orbitRadius: 7, orbitSpeed: 0.03, yOffset: -3, intensity: 1.0 },
    { color: "#d0d8f0", form: "circle", scale: [4, 4, 1], orbitRadius: 5, orbitSpeed: 0.05, yOffset: 5, intensity: 1.2 },
  ],
  envIntensity: 0.2,
  envResolution: 256,

  ribbons: [
    { color: "#888899", y: 0.3, w: 5, h: 2 },
    { color: "#999aaa", y: -0.5, w: 4.5, h: 1.5 },
    { color: "#aaaabc", y: 1.0, w: 4, h: 1.2 },
    { color: "#777788", y: -0.8, w: 5.5, h: 1.8 },
    { color: "#bbbbcc", y: 0.0, w: 5, h: 1.6 },
    { color: "#666677", y: -1.2, w: 4.5, h: 1.3 },
  ],
  ribbonOpacity: 0.5,

  fov: 50,
  cameraZRange: [1.5, 1.35, 1.5],
  cameraDriftX: 0.04,
  cameraDriftY: 0.02,

  bloomThreshold: 0.85,
  bloomIntensity: 0.4,
  toneMapping: ToneMappingMode.AGX,
  toneMappingExposure: 2.0,
};

/**
 * V2 — Emerald Brand
 * GM brand greens on dark metal. Institutional.
 * Moderate iridescence with green bias.
 */
export const emeraldBrand: SceneConfig = {
  baseColor: "#060e0a",
  metalness: 0.88,
  roughnessRange: [0.2, 0.025],
  clearcoat: 0.8,
  clearcoatRoughness: 0.06,
  iridescence: 0.85,
  iridescenceIOR: 1.8,
  iridescenceThicknessBase: [80, 350],
  envMapIntensity: 3.0,
  reflectivity: 0.9,

  slatCount: 48,
  slatWidth: 0.065,
  slatGap: 0.001,
  slatAngle: 0.2,
  slatAngleOscillation: 0.05,
  slatAlternate: true,

  pointLights: [
    { color: "#00A36C", speed: 0.15, phase: 0, yOffset: 0.8, radius: 2.0 },
    { color: "#008A5A", speed: 0.12, phase: 1.2, yOffset: -0.3, radius: 2.5 },
    { color: "#16A34A", speed: 0.18, phase: 2.4, yOffset: 1.0, radius: 1.8 },
    { color: "#00cc88", speed: 0.1, phase: 3.6, yOffset: -0.5, radius: 2.0 },
    { color: "#ffffff", speed: 0.14, phase: 4.8, yOffset: 0.1, radius: 1.9 },
    { color: "#00ddaa", speed: 0.16, phase: 0.8, yOffset: -0.1, radius: 1.6 },
    { color: "#E6F7F0", speed: 0.11, phase: 2.0, yOffset: 0.5, radius: 2.3 },
    { color: "#00A36C", speed: 0.09, phase: 5.0, yOffset: 0.0, radius: 1.7 },
    { color: "#22ffaa", speed: 0.08, phase: 0.5, yOffset: 0.7, radius: 2.8 },
    { color: "#008A5A", speed: 0.07, phase: 3.0, yOffset: -0.6, radius: 3.0 },
    { color: "#ffffff", speed: 0.06, phase: 1.8, yOffset: 0.9, radius: 2.5 },
  ],
  pointLightIntensity: 45,
  ambientIntensity: 0.01,
  ambientColor: "#040a08",
  directionalIntensity: 4,

  lightformers: [
    { color: "#00A36C", form: "rect", scale: [6, 2, 1], orbitRadius: 6, orbitSpeed: 0.08, yOffset: 4, intensity: 1.0 },
    { color: "#008A5A", form: "rect", scale: [7, 2, 1], orbitRadius: 7, orbitSpeed: 0.06, yOffset: -3, intensity: 0.8 },
    { color: "#16A34A", form: "circle", scale: [3, 3, 1], orbitRadius: 5, orbitSpeed: 0.1, yOffset: 5, intensity: 1.2 },
  ],
  envIntensity: 0.15,
  envResolution: 256,

  ribbons: [
    { color: "#00A36C", y: 0.4, w: 6, h: 2.5 },
    { color: "#008A5A", y: -0.6, w: 5.5, h: 2.0 },
    { color: "#16A34A", y: 1.2, w: 5, h: 1.8 },
    { color: "#00cc88", y: -1.0, w: 6.5, h: 2.2 },
    { color: "#22ffaa", y: 0.0, w: 6, h: 2.0 },
    { color: "#0A2E1C", y: -1.5, w: 5.5, h: 1.8 },
    { color: "#E6F7F0", y: 0.9, w: 5, h: 1.5 },
    { color: "#00A36C", y: -0.3, w: 6, h: 2.3 },
  ],
  ribbonOpacity: 0.85,

  fov: 50,
  cameraZRange: [1.5, 1.3, 1.5],
  cameraDriftX: 0.06,
  cameraDriftY: 0.03,

  bloomThreshold: 0.8,
  bloomIntensity: 0.6,
  toneMapping: ToneMappingMode.AGX,
  toneMappingExposure: 2.5,
};

/**
 * V3 — Obsidian Gold
 * Black chrome with warm amber/gold accents.
 * Luxury. Deep contrast. Slow, heavy movement.
 */
export const obsidianGold: SceneConfig = {
  baseColor: "#080808",
  metalness: 0.96,
  roughnessRange: [0.08, 0.015],
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  iridescence: 0.3,
  iridescenceIOR: 1.4,
  iridescenceThicknessBase: [200, 500],
  envMapIntensity: 3.5,
  reflectivity: 1.0,

  slatCount: 44,
  slatWidth: 0.072,
  slatGap: 0.002,
  slatAngle: 0.18,
  slatAngleOscillation: 0.03,
  slatAlternate: true,

  pointLights: [
    { color: "#ffaa00", speed: 0.06, phase: 0, yOffset: 0.3, radius: 2.0 },
    { color: "#ff8800", speed: 0.05, phase: 1.5, yOffset: -0.4, radius: 2.5 },
    { color: "#ffcc44", speed: 0.08, phase: 3.0, yOffset: 0.7, radius: 1.8 },
    { color: "#ffffff", speed: 0.04, phase: 4.0, yOffset: -0.2, radius: 2.2 },
    { color: "#dd9900", speed: 0.07, phase: 2.0, yOffset: 0.0, radius: 1.6 },
    { color: "#ffdd88", speed: 0.03, phase: 5.0, yOffset: 0.5, radius: 3.0 },
    { color: "#cc7700", speed: 0.09, phase: 0.8, yOffset: -0.7, radius: 2.3 },
    { color: "#ffffff", speed: 0.05, phase: 3.5, yOffset: 0.9, radius: 2.8 },
  ],
  pointLightIntensity: 40,
  ambientIntensity: 0.008,
  ambientColor: "#0a0804",
  directionalIntensity: 3,

  lightformers: [
    { color: "#ffaa00", form: "rect", scale: [8, 2, 1], orbitRadius: 6, orbitSpeed: 0.03, yOffset: 4, intensity: 1.0 },
    { color: "#ff8800", form: "rect", scale: [6, 3, 1], orbitRadius: 7, orbitSpeed: 0.025, yOffset: -4, intensity: 0.8 },
    { color: "#ffffff", form: "circle", scale: [3, 3, 1], orbitRadius: 5, orbitSpeed: 0.04, yOffset: 5, intensity: 1.5 },
  ],
  envIntensity: 0.12,
  envResolution: 256,

  ribbons: [
    { color: "#ffaa00", y: 0.3, w: 5, h: 2 },
    { color: "#ff8800", y: -0.5, w: 4.5, h: 1.5 },
    { color: "#cc7700", y: 0.8, w: 4, h: 1.2 },
    { color: "#ffcc44", y: -0.9, w: 5.5, h: 1.8 },
    { color: "#dd9900", y: 0.0, w: 5, h: 1.6 },
    { color: "#553300", y: -1.3, w: 4.5, h: 1.3 },
  ],
  ribbonOpacity: 0.7,

  fov: 50,
  cameraZRange: [1.6, 1.45, 1.6],
  cameraDriftX: 0.03,
  cameraDriftY: 0.015,

  bloomThreshold: 0.75,
  bloomIntensity: 0.7,
  toneMapping: ToneMappingMode.AGX,
  toneMappingExposure: 2.0,
};

/**
 * V4 — Frost
 * Ice blue / cyan on white-tinted metal. Clean, cold, Nordic.
 * High roughness for diffuse look. Minimal iridescence.
 */
export const frost: SceneConfig = {
  baseColor: "#10121a",
  metalness: 0.8,
  roughnessRange: [0.35, 0.03],
  clearcoat: 0.5,
  clearcoatRoughness: 0.15,
  iridescence: 0.4,
  iridescenceIOR: 1.5,
  iridescenceThicknessBase: [150, 350],
  envMapIntensity: 2.5,
  reflectivity: 0.7,

  slatCount: 50,
  slatWidth: 0.06,
  slatGap: 0.001,
  slatAngle: 0.22,
  slatAngleOscillation: 0.04,
  slatAlternate: true,

  pointLights: [
    { color: "#44aaff", speed: 0.1, phase: 0, yOffset: 0.6, radius: 2.2 },
    { color: "#88ccff", speed: 0.08, phase: 1.5, yOffset: -0.3, radius: 2.8 },
    { color: "#00ddff", speed: 0.12, phase: 2.5, yOffset: 0.9, radius: 1.6 },
    { color: "#ffffff", speed: 0.06, phase: 3.5, yOffset: -0.5, radius: 2.0 },
    { color: "#66bbff", speed: 0.09, phase: 4.5, yOffset: 0.1, radius: 2.5 },
    { color: "#aaddff", speed: 0.07, phase: 0.8, yOffset: -0.7, radius: 1.9 },
    { color: "#00ccee", speed: 0.11, phase: 2.0, yOffset: 0.4, radius: 3.0 },
    { color: "#ffffff", speed: 0.05, phase: 5.0, yOffset: -0.1, radius: 2.3 },
    { color: "#55bbff", speed: 0.08, phase: 1.0, yOffset: 0.7, radius: 2.6 },
    { color: "#ccddff", speed: 0.04, phase: 3.0, yOffset: -0.8, radius: 2.1 },
  ],
  pointLightIntensity: 50,
  ambientIntensity: 0.015,
  ambientColor: "#060810",
  directionalIntensity: 5,

  lightformers: [
    { color: "#44aaff", form: "rect", scale: [7, 3, 1], orbitRadius: 6, orbitSpeed: 0.05, yOffset: 4, intensity: 1.2 },
    { color: "#88ccff", form: "rect", scale: [9, 2, 1], orbitRadius: 7, orbitSpeed: 0.04, yOffset: -3, intensity: 0.9 },
    { color: "#ffffff", form: "circle", scale: [4, 4, 1], orbitRadius: 5, orbitSpeed: 0.06, yOffset: 5, intensity: 1.5 },
    { color: "#00ddff", form: "rect", scale: [5, 2, 1], orbitRadius: 6, orbitSpeed: 0.03, yOffset: -5, intensity: 0.7 },
  ],
  envIntensity: 0.18,
  envResolution: 256,

  ribbons: [
    { color: "#44aaff", y: 0.3, w: 6, h: 2.5 },
    { color: "#88ccff", y: -0.5, w: 5.5, h: 2.0 },
    { color: "#00ddff", y: 1.0, w: 5, h: 1.5 },
    { color: "#aaddff", y: -0.9, w: 6, h: 2.0 },
    { color: "#66bbff", y: 0.0, w: 5.5, h: 1.8 },
    { color: "#ccddff", y: -1.3, w: 5, h: 1.5 },
    { color: "#ffffff", y: 0.8, w: 4, h: 1.2 },
  ],
  ribbonOpacity: 0.75,

  fov: 50,
  cameraZRange: [1.5, 1.3, 1.5],
  cameraDriftX: 0.05,
  cameraDriftY: 0.025,

  bloomThreshold: 0.7,
  bloomIntensity: 0.8,
  toneMapping: ToneMappingMode.AGX,
  toneMappingExposure: 2.5,
};

/**
 * V5 — Prismatic (Original Solana style)
 * Full rainbow spectrum. Maximum iridescence. The reference.
 */
export const prismatic: SceneConfig = {
  baseColor: "#0a0a14",
  metalness: 0.85,
  roughnessRange: [0.2, 0.025],
  clearcoat: 0.8,
  clearcoatRoughness: 0.08,
  iridescence: 0.9,
  iridescenceIOR: 2.0,
  iridescenceThicknessBase: [80, 350],
  envMapIntensity: 3.0,
  reflectivity: 0.95,

  slatCount: 48,
  slatWidth: 0.065,
  slatGap: 0.001,
  slatAngle: 0.2,
  slatAngleOscillation: 0.05,
  slatAlternate: true,

  pointLights: [
    { color: "#ff1493", speed: 0.15, phase: 0, yOffset: 0.8, radius: 2.0 },
    { color: "#00ff88", speed: 0.12, phase: 1.2, yOffset: -0.3, radius: 2.5 },
    { color: "#8b5cf6", speed: 0.18, phase: 2.4, yOffset: 1.0, radius: 1.8 },
    { color: "#0066ff", speed: 0.1, phase: 3.6, yOffset: -0.5, radius: 2.0 },
    { color: "#ff6b00", speed: 0.14, phase: 4.8, yOffset: 0.1, radius: 1.9 },
    { color: "#00ddcc", speed: 0.16, phase: 0.8, yOffset: -0.1, radius: 1.6 },
    { color: "#ff69b4", speed: 0.11, phase: 2.0, yOffset: -0.6, radius: 2.3 },
    { color: "#33ff55", speed: 0.13, phase: 3.2, yOffset: -0.8, radius: 1.5 },
    { color: "#cc33ff", speed: 0.09, phase: 5.0, yOffset: 0.0, radius: 1.7 },
    { color: "#ffaa00", speed: 0.17, phase: 1.6, yOffset: -0.9, radius: 1.8 },
    { color: "#22cc66", speed: 0.08, phase: 0.5, yOffset: 0.5, radius: 2.8 },
    { color: "#00ddaa", speed: 0.07, phase: 3.0, yOffset: 0.7, radius: 2.5 },
  ],
  pointLightIntensity: 45,
  ambientIntensity: 0.01,
  ambientColor: "#080814",
  directionalIntensity: 4,

  lightformers: [
    { color: "#ff2288", form: "rect", scale: [6, 2, 1], orbitRadius: 6, orbitSpeed: 0.08, yOffset: 4, intensity: 1.0 },
    { color: "#00bb77", form: "rect", scale: [7, 2, 1], orbitRadius: 7, orbitSpeed: 0.06, yOffset: -3, intensity: 0.8 },
    { color: "#6644dd", form: "circle", scale: [3, 3, 1], orbitRadius: 5, orbitSpeed: 0.1, yOffset: 5, intensity: 1.2 },
    { color: "#ffaa22", form: "rect", scale: [5, 1.5, 1], orbitRadius: 6, orbitSpeed: 0.05, yOffset: -5, intensity: 0.6 },
  ],
  envIntensity: 0.15,
  envResolution: 256,

  ribbons: [
    { color: "#ff1493", y: 0.4, w: 6, h: 2.5 },
    { color: "#00cc66", y: -0.6, w: 5.5, h: 2.0 },
    { color: "#6633ff", y: 1.2, w: 5, h: 1.8 },
    { color: "#ff8800", y: -1.0, w: 6.5, h: 2.2 },
    { color: "#00aaff", y: 0.0, w: 6, h: 2.0 },
    { color: "#ff44aa", y: -1.5, w: 5.5, h: 1.8 },
    { color: "#22ffbb", y: 0.9, w: 5, h: 1.5 },
    { color: "#aa44ff", y: -0.3, w: 6, h: 2.3 },
  ],
  ribbonOpacity: 0.85,

  fov: 50,
  cameraZRange: [1.5, 1.3, 1.5],
  cameraDriftX: 0.06,
  cameraDriftY: 0.03,

  bloomThreshold: 0.8,
  bloomIntensity: 0.6,
  toneMapping: ToneMappingMode.AGX,
  toneMappingExposure: 2.5,
};

// ═══════════════════════════════════════════════════════
// WHITE SERIES
// ═══════════════════════════════════════════════════════

