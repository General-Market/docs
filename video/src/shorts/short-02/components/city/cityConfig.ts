// ---------------------------------------------------------------------------
// City environment configuration — pure data, no React
// ---------------------------------------------------------------------------

// Seeded RNG (shared with TradingJourney3D)
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Building definitions
// ---------------------------------------------------------------------------

export interface BuildingDef {
  pos: [number, number, number];
  width: number;
  height: number;
  depth: number;
  glassColor: string;     // unlit window tint
  litColor: string;       // warm interior glow
  bodyColor: string;      // facade background
  mullionColor: string;   // structural frame
  litPct: number;         // fraction of windows lit, 0-1
  seed: number;           // deterministic RNG seed
  neonAccent?: string;
  setback?: number;       // upper setback ratio (0-0.3)
  crowned?: boolean;
  podiumH?: number;
  podiumScale?: number;
  crownType?: "antenna" | "spire";
}

// Converted from MIAMI_BUILDINGS — each entry now carries full color info
export const BUILDINGS: BuildingDef[] = [
  // Front row — behind road (z ~6-8)
  { pos: [-4, 0, 6], width: 1.8, height: 10, depth: 1.4, glassColor: "#88c8f0", litColor: "#ffd866", bodyColor: "#b8d0e0", mullionColor: "#708090", litPct: 0.65, seed: 5000, setback: 0.15, neonAccent: "#00ccff", podiumH: 2.5, podiumScale: 1.4 },
  { pos: [-6.5, 0, 7], width: 2.0, height: 18, depth: 1.6, glassColor: "#78b8e0", litColor: "#ffd866", bodyColor: "#a8c8d8", mullionColor: "#607888", litPct: 0.65, seed: 5001, setback: 0.2, crowned: true, crownType: "spire", neonAccent: "#00e5cc", podiumH: 3, podiumScale: 1.3 },
  { pos: [-2, 0, 7.5], width: 1.6, height: 8, depth: 1.4, glassColor: "#90d0f0", litColor: "#ffd866", bodyColor: "#c0d8e8", mullionColor: "#7888a0", litPct: 0.65, seed: 5002, neonAccent: "#00ccff" },
  { pos: [4, 0, 6.5], width: 2.0, height: 14, depth: 1.5, glassColor: "#80c0e8", litColor: "#ffd866", bodyColor: "#b0c8d8", mullionColor: "#687888", litPct: 0.65, seed: 5003, setback: 0.12, crowned: true, crownType: "antenna", neonAccent: "#00e5cc", podiumH: 2, podiumScale: 1.5 },
  { pos: [6, 0, 8], width: 1.6, height: 9, depth: 1.3, glassColor: "#98d0e8", litColor: "#ffd866", bodyColor: "#c0d0e0", mullionColor: "#708090", litPct: 0.65, seed: 5004, neonAccent: "#00ccff" },
  { pos: [2, 0, 7], width: 1.4, height: 20, depth: 1.2, glassColor: "#70b0d8", litColor: "#ffd866", bodyColor: "#a0c0d0", mullionColor: "#607080", litPct: 0.65, seed: 5005, setback: 0.3, crowned: true, crownType: "spire", neonAccent: "#00e5cc" },
  { pos: [0, 0, 6.8], width: 1.2, height: 6, depth: 1.0, glassColor: "#98d8f0", litColor: "#ffd866", bodyColor: "#c8e0e8", mullionColor: "#7890a0", litPct: 0.65, seed: 5006, podiumH: 1.5, podiumScale: 1.4 },
  // Deeper row (z ~10-14), taller backdrop
  { pos: [-3, 0, 11], width: 2.5, height: 24, depth: 2.2, glassColor: "#78b8e0", litColor: "#ffd866", bodyColor: "#a0c0d0", mullionColor: "#607080", litPct: 0.65, seed: 5007, setback: 0.25, crowned: true, crownType: "spire", neonAccent: "#00ccff", podiumH: 4, podiumScale: 1.3 },
  { pos: [1, 0, 12], width: 2.2, height: 18, depth: 2.0, glassColor: "#80c0e0", litColor: "#ffd866", bodyColor: "#b0c8d8", mullionColor: "#687888", litPct: 0.65, seed: 5008, setback: 0.15, crowned: true, crownType: "antenna", neonAccent: "#00e5cc" },
  { pos: [5, 0, 10], width: 2.2, height: 15, depth: 1.8, glassColor: "#88c8e8", litColor: "#ffd866", bodyColor: "#b8d0e0", mullionColor: "#708090", litPct: 0.65, seed: 5009, setback: 0.15, podiumH: 3, podiumScale: 1.4 },
  { pos: [-6, 0, 13], width: 1.8, height: 12, depth: 1.6, glassColor: "#78b8d8", litColor: "#ffd866", bodyColor: "#a8c0d0", mullionColor: "#607888", litPct: 0.65, seed: 5010, crowned: true, crownType: "antenna", neonAccent: "#00ccff" },
  { pos: [8, 0, 11], width: 2.0, height: 11, depth: 1.5, glassColor: "#90d0e8", litColor: "#ffd866", bodyColor: "#c0d8e0", mullionColor: "#708090", litPct: 0.65, seed: 5011, setback: 0.15, podiumH: 2.5, podiumScale: 1.3 },
  // Extra deep fill — skyline density
  { pos: [-8, 0, 14], width: 2.0, height: 14, depth: 1.8, glassColor: "#78b8e0", litColor: "#ffd866", bodyColor: "#a0c0d0", mullionColor: "#607080", litPct: 0.65, seed: 5012, neonAccent: "#00e5cc" },
  { pos: [3, 0, 15], width: 2.4, height: 20, depth: 2.0, glassColor: "#70b0d8", litColor: "#ffd866", bodyColor: "#a0b8d0", mullionColor: "#607080", litPct: 0.65, seed: 5013, setback: 0.2, crowned: true, crownType: "spire" },
  { pos: [9, 0, 14], width: 1.6, height: 10, depth: 1.4, glassColor: "#88c8f0", litColor: "#ffd866", bodyColor: "#b8d0e0", mullionColor: "#708090", litPct: 0.65, seed: 5014 },
];

// ---------------------------------------------------------------------------
// Neon fixtures
// ---------------------------------------------------------------------------

export interface NeonFixtureDef {
  pos: [number, number, number];
  rotation?: [number, number, number];
  length: number;
  color: string;
  radius?: number;
}

export const NEON_FIXTURES: NeonFixtureDef[] = [
  // Vertical neon tubes on buildings
  { pos: [-4, 2.5, 5.9], length: 2.5, color: "#ff2d7b" },
  { pos: [-6.5, 3.2, 6.9], length: 3.0, color: "#00e5cc" },
  { pos: [4, 2.5, 6.4], length: 2.8, color: "#ff00aa" },
  { pos: [2, 3.5, 6.9], length: 3.5, color: "#00ccff" },
  { pos: [6, 1.8, 7.9], length: 2.0, color: "#ff4422" },
  // Horizontal neon strips along road edge
  { pos: [-5, 0.15, 2.65], rotation: [0, 0, Math.PI / 2], length: 3.0, color: "#ff2d7b", radius: 0.015 },
  { pos: [3, 0.15, 2.65], rotation: [0, 0, Math.PI / 2], length: 4.0, color: "#00e5cc", radius: 0.015 },
  // Shorter accent tubes on building fronts
  { pos: [-3, 4.5, 10.9], length: 2.0, color: "#ffaa00" },
  { pos: [1, 4.0, 11.9], length: 2.5, color: "#00ff88" },
  { pos: [5, 3.0, 9.9], length: 2.0, color: "#ff2d7b" },
];

// ---------------------------------------------------------------------------
// Street lamps
// ---------------------------------------------------------------------------

export interface StreetLampDef {
  pos: [number, number, number];
  color: string;
}

export const STREET_LAMPS: StreetLampDef[] = [];

// ---------------------------------------------------------------------------
// Palm trees
// ---------------------------------------------------------------------------

export interface PalmTreeDef {
  pos: [number, number, number];
  seed: number;
}

export const PALM_POSITIONS: PalmTreeDef[] = [
  { pos: [-4, 0, -5], seed: 1001 },
  { pos: [-6, 0, -7], seed: 1002 },
  { pos: [-2, 0, -10], seed: 1003 },
  { pos: [5, 0, -6], seed: 1004 },
  { pos: [4, 0, -8], seed: 1005 },
  { pos: [0, 0, -15], seed: 1006 },
  { pos: [-1, 0, -12], seed: 1007 },
];

// ---------------------------------------------------------------------------
// Road configuration
// ---------------------------------------------------------------------------

export interface RoadConfig {
  roadZ: number;
  roadWidth: number;
  roadLength: number;
  dashCount: number;
  dashSpacing: number;
  sidewalkOffset: number;
  sidewalkWidth: number;
}

export const ROAD_CONFIG: RoadConfig = {
  roadZ: 4,
  roadWidth: 3,
  roadLength: 40,
  dashCount: 16,
  dashSpacing: 2.5,
  sidewalkOffset: 1.6,
  sidewalkWidth: 0.6,
};
