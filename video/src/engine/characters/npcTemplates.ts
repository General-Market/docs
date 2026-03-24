// Per-phase NPC seeds so each scene has unique walker patterns
export const PHASE_NPC_SEEDS: Record<string, number> = {
  "car-lot": 1111,
  "forex-intro": 2222,
  forex: 3333,
  "stocks-intro": 4400,
  stocks: 4444,
  "bitcoin-intro": 5500,
  bitcoin: 5555,
  goldman: 6666,
  "0dte": 7777,
  ambush: 6677,
  "memecoins-solo": 8877,
  memecoins: 8888,
  polymarket: 9999,
  defeat: 1234,
  return: 5678,
  "car-lot-final": 9012,
  "car-departure": 9013,
};

export const NPC_COLORS = [
  "#9CA3AF", "#6B7280", "#78716C", "#A8A29E",
  "#8B7355", "#6D8B74", "#7C6F64", "#D4A574",
  "#E8B4B8", "#B4D4E8", "#D4E8B4", "#E8D4B4",
];

// Movement patterns for NPCs
export type MovePattern = "walk" | "run" | "circle" | "zigzag" | "stationary" | "wander";

// Per-phase NPC behavior templates
export interface NpcTemplate {
  anim: string;           // animation name
  useRobot: boolean;      // true = RobotExpressive (more anims), false = Soldier
  move: MovePattern;
  speed: number;          // base speed multiplier
  scale: number;
  zRange: [number, number]; // min/max z position
}

// Goofy themed NPC sets per phase
export const PHASE_NPC_TEMPLATES: Record<string, NpcTemplate[]> = {
  "car-lot": [
    // People checking out cars, taking photos, excited
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.55, zRange: [-3, -6] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-4, -8] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-4, -6] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.45, zRange: [-6, -10] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -12] },
  ],
  "forex-intro": [
    // Beach joggers, couples, someone waving — women dancing
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -8] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-8, -12] },
  ],
  forex: [
    // Beach vibes — women dancing, people chilling
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.55, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.5, zRange: [-10, -14] },
  ],
  "stocks-intro": [
    // Watching — protagonist observes, some people walk by
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.45, zRange: [-7, -10] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-9, -13] },
  ],
  stocks: [
    // Business-like — walking with purpose, one on phone, thumbs up
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.8, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.7, scale: 0.5, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-7, -10] },
    { anim: "Yes", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-9, -13] },
  ],
  "bitcoin-intro": [
    // Watching BTC trader — curious onlookers
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.55, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "circle", speed: 0.2, scale: 0.5, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.45, zRange: [-8, -12] },
  ],
  bitcoin: [
    // Crypto hype — dancing, jumping, running excited, waving
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-3, -5] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Walk", useRobot: false, move: "zigzag", speed: 0.6, scale: 0.45, zRange: [-8, -12] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-10, -14] },
  ],
  goldman: [
    // Intimidation — people running away, cowering, scared
    { anim: "Run", useRobot: false, move: "run", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.7, scale: 0.45, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.35, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  "0dte": [
    // Panic — running, zigzag, falling over (capped speeds)
    { anim: "Run", useRobot: false, move: "zigzag", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 0.7, scale: 0.45, zRange: [-4, -7] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.9, scale: 0.5, zRange: [-4, -6] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.55, zRange: [-5, -8] },
    { anim: "Jump", useRobot: false, move: "walk", speed: 0.5, scale: 0.45, zRange: [-6, -9] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.4, zRange: [-8, -12] },
  ],
  ambush: [
    // Intimidation — people running away, cowering, scared
    { anim: "Run", useRobot: false, move: "run", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.7, scale: 0.45, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.35, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  "memecoins-solo": [
    // Party chaos — dancing wildly, jumping, running in circles (same as memecoins)
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.5, zRange: [-6, -9] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 1.0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-10, -14] },
  ],
  memecoins: [
    // Party chaos — dancing wildly, jumping, running in circles
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.5, zRange: [-6, -9] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 1.0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-10, -14] },
  ],
  polymarket: [
    // Debate — standing in groups, arguing, pointing
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Yes", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.5, zRange: [-5, -8] },
    { anim: "Standing", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-8, -12] },
  ],
  defeat: [
    // Somber — slow walking, sitting around, dejected
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.2, scale: 0.5, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
    { anim: "Sitting", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.15, scale: 0.45, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  return: [
    // Peaceful — slow strolling, waving, chill vibes
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.35, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.2, scale: 0.45, zRange: [-8, -12] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-10, -14] },
  ],
  "car-lot-final": [
    // PARTY — everyone close, jumping, dancing, celebrating around the desk
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.65, zRange: [-1.5, -2.5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.65, zRange: [-1.5, -2.5] },
    { anim: "Jump", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-2, -3] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.6, zRange: [-2, -3.5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-1.5, -2] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-2, -3] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -4] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.6, scale: 0.55, zRange: [-3, -4.5] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
  ],
  "car-departure": [
    // Peaceful — slow strolling, waving, chill vibes (same as return)
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.35, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.2, scale: 0.45, zRange: [-8, -12] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-10, -14] },
  ],
};
