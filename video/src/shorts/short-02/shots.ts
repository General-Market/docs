import type { ShotDef, BackgroundDef } from "./types";
import { COLORS } from "./types";

// Background helper — all shots use AI-generated images with tint fallback
const bg = (
  shotNum: number,
  opts: {
    tint: string;
    kenBurns?: boolean;
    brightness?: number;
    tintOpacity?: number;
  },
): BackgroundDef => ({
  type: "image",
  src: `shot-${String(shotNum).padStart(2, "0")}.jpg`,
  kenBurns: opts.kenBurns ?? false,
  brightness: 0, // 3D beach scene fully owns the frame
  tint: opts.tint,
  tintOpacity: opts.tintOpacity ?? 0.15,
});

// 25fps → 30fps frame remap
const r = (f25: number): number => Math.round(f25 * 30 / 25);

export const shots: ShotDef[] = [
  // ──────────────────────────────────────────────────────
  // Shot 1 — Hook: Car lot golden hour
  // "In Miami, there was a guy flipping used cars."
  // ──────────────────────────────────────────────────────
  {
    id: 1,
    isFirstShot: true,
    line: "In Miami, there was a guy flipping used cars.",
    durationSeconds: 4.180,
    chibiEmotion: "content",
    chibiAnimation: "idle", // wiping-sweat → idle
    chibiEntrance: "left", // slide-in-left → left
    background: bg(1, { tint: "#462a1c", kenBurns: true, brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "Miami", color: COLORS.ACCENT_1 },
      { word: "flipping", color: COLORS.ACCENT_1 },
      { word: "cars", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "city-hum.mp3" },
      { frame: r(35), file: "impact-low.mp3" },
    ],
    transitionIn: "fade",
    transitionDuration: 10,
    musicState: "playing",
    fullScreenZoom: "in", // slow_zoom_in
    customScenes: ["tradingJourney"],
    scenePhase: "car-lot",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 2 — "One day, he saw a forex trader."
  // ──────────────────────────────────────────────────────
  {
    id: 2,
    line: "One day, he saw a forex trader.",
    durationSeconds: 3.420,
    chibiEmotion: "impressed",
    chibiAnimation: "snap", // eyes-wide → snap
    chibiEntrance: "bottom", // pop-in → bottom
    background: bg(2, { tint: "#402219", kenBurns: true, brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "forex", color: COLORS.ACCENT_1 },
      { word: "trader", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(10), file: "synth-swell.mp3" }],
    transitionIn: "cut",
    musicState: "playing",
    customScenes: ["tradingJourney"],
    scenePhase: "forex-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 3 — "Forex traders make more than me."
  // ──────────────────────────────────────────────────────
  {
    id: 3,
    line: "Forex traders make more than me.",
    durationSeconds: 2.320,
    chibiEmotion: "envious",
    chibiAnimation: "snap", // jaw-drop → snap
    chibiEntrance: "none",
    background: bg(3, { tint: "#0c102a", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "Forex", color: COLORS.ACCENT_1 },
      { word: "more", color: COLORS.ACCENT_1 },
    ],
    sfx: [],
    transitionIn: "cut",
    musicState: "playing",
    customScenes: ["tradingJourney"],
    scenePhase: "forex-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 4 — "I want to trade forex."
  // ──────────────────────────────────────────────────────
  {
    id: 4,
    line: "I want to trade forex.",
    durationSeconds: 1.720,
    chibiEmotion: "determined",
    chibiAnimation: "punch", // fist-pump → punch
    chibiEntrance: "none",
    background: bg(4, { tint: "#7e4f34", kenBurns: true, brightness: 0.8 }),
    captionMode: "shout",
    wordHighlights: [
      { word: "trade", color: COLORS.ACCENT_1 },
      { word: "forex", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(1), file: "impact-mid.mp3" }],
    transitionIn: "cut",
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "forex-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 5 — "So he became the forex trader."
  // ──────────────────────────────────────────────────────
  {
    id: 5,
    line: "So he became the forex trader.",
    durationSeconds: 2.930,
    chibiEmotion: "confident",
    chibiAnimation: "idle", // arms-crossed → idle
    chibiEntrance: "bottom", // flash-in → bottom + lightLeak
    background: bg(5, { tint: "#f99450", kenBurns: true, brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "became", color: COLORS.ACCENT_1 },
      { word: "forex", color: COLORS.ACCENT_1 },
      { word: "trader", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "impact-transform.mp3", volume: 0.35 },
      { frame: r(1), file: "synth-reveal.mp3" },
    ],
    transitionIn: "flash",
    transitionDuration: 10,
    lightLeak: { color: "#ffca65" }, // golden transformation
    musicState: "playing",
    fullScreenZoom: "in", // static_zoom_in
    customScenes: ["tradingJourney"],
    scenePhase: "forex",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 6 — "But then he saw a stock trader."
  // ──────────────────────────────────────────────────────
  {
    id: 6,
    line: "But then he saw a stock trader.",
    durationSeconds: 3.100,
    chibiEmotion: "curious",
    chibiAnimation: "tilt", // looking-up → tilt
    chibiEntrance: "right", // slide-in-right → right
    background: bg(6, { tint: "#0c102a", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "stock", color: COLORS.ACCENT_1 },
      { word: "trader", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(20), file: "tension-build.mp3" }],
    transitionIn: "cut",
    musicState: "playing",
    customScenes: ["tradingJourney"],
    scenePhase: "stocks-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 7 — "Stocks are easier than forex. I want to trade stocks."
  // ──────────────────────────────────────────────────────
  {
    id: 7,
    line: "Stocks are easier than forex. I want to trade stocks.",
    durationSeconds: 4.560,
    chibiEmotion: "smug",
    chibiAnimation: "wobble", // shrug → wobble
    chibiEntrance: "none",
    background: bg(7, { tint: "#11162c", brightness: 0.8 }),
    captionMode: "shout",
    wordHighlights: [
      { word: "Stocks", color: COLORS.ACCENT_1 },
      { word: "easier", color: COLORS.ACCENT_1 },
      { word: "stocks", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(60), file: "impact-mid.mp3" }],
    transitionIn: "cut",
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "stocks-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 8 — "And he became the stock trader."
  // ──────────────────────────────────────────────────────
  {
    id: 8,
    line: "And he became the stock trader.",
    durationSeconds: 2.970,
    chibiEmotion: "proud",
    chibiAnimation: "bounce", // chest-puff → bounce
    chibiEntrance: "bottom", // flash-in → bottom + lightLeak
    background: bg(8, { tint: "#c04b10", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "became", color: COLORS.ACCENT_1 },
      { word: "stock", color: COLORS.ACCENT_1 },
      { word: "trader", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "impact-transform.mp3", volume: 0.35 },
      { frame: r(1), file: "synth-reveal.mp3" },
    ],
    transitionIn: "flash",
    transitionDuration: 10,
    lightLeak: { color: "#ffca65" }, // golden stock transformation
    musicState: "playing",
    fullScreenZoom: "out", // static_zoom_out
    customScenes: ["tradingJourney"],
    scenePhase: "stocks",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 9 — "Then he saw bitcoin futures."
  // ──────────────────────────────────────────────────────
  {
    id: 9,
    line: "Then he saw bitcoin futures.",
    durationSeconds: 3.110,
    chibiEmotion: "mesmerized",
    chibiAnimation: "heartbeat", // eyes-sparkle → heartbeat
    chibiEntrance: "bottom", // pop-in → bottom
    background: bg(9, { tint: "#f0d2a3", kenBurns: true, brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "bitcoin", color: COLORS.ACCENT_2 },
      { word: "futures", color: COLORS.ACCENT_2 },
    ],
    sfx: [{ frame: r(15), file: "crypto-shimmer.mp3" }],
    transitionIn: "cut",
    musicState: "playing",
    customScenes: ["tradingJourney"],
    scenePhase: "bitcoin-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 10 — "Bitcoin is faster than any stock."
  // ──────────────────────────────────────────────────────
  {
    id: 10,
    line: "Bitcoin is faster than any stock.",
    durationSeconds: 3.770,
    chibiEmotion: "excited",
    chibiAnimation: "snap", // pointing → snap
    chibiEntrance: "none",
    background: bg(10, { tint: "#f9d8a7", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "Bitcoin", color: COLORS.ACCENT_2 },
      { word: "faster", color: COLORS.ACCENT_1 },
      { word: "stock", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(40), file: "punch-accent.mp3" }],
    transitionIn: "cut",
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "bitcoin-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 11 — "I want to trade bitcoin."
  // ──────────────────────────────────────────────────────
  {
    id: 11,
    line: "I want to trade bitcoin.",
    durationSeconds: 2.620,
    chibiEmotion: "determined",
    chibiAnimation: "punch", // fist-pump → punch
    chibiEntrance: "none",
    background: bg(11, { tint: "#f0d2a3", kenBurns: true, brightness: 0.8 }),
    captionMode: "shout",
    wordHighlights: [
      { word: "trade", color: COLORS.ACCENT_2 },
      { word: "bitcoin", color: COLORS.ACCENT_2 },
    ],
    sfx: [{ frame: r(1), file: "impact-mid.mp3" }],
    transitionIn: "cut",
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "bitcoin-intro",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 12 — "And he traded bitcoin."
  // ──────────────────────────────────────────────────────
  {
    id: 12,
    line: "And he traded bitcoin.",
    durationSeconds: 2.445,
    chibiEmotion: "victorious",
    chibiAnimation: "punch", // arms-raised → punch
    chibiEntrance: "bottom", // flash-in → bottom + lightLeak
    background: bg(12, { tint: "#f99450", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "traded", color: COLORS.ACCENT_2 },
      { word: "bitcoin", color: COLORS.ACCENT_2 },
    ],
    sfx: [
      { frame: r(1), file: "impact-transform.mp3", volume: 0.35 },
      { frame: r(1), file: "synth-reveal.mp3" },
    ],
    transitionIn: "flash",
    transitionDuration: 10,
    lightLeak: { color: "#f7931a" }, // BTC orange transformation
    musicState: "playing",
    customScenes: ["tradingJourney"],
    scenePhase: "bitcoin",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 13 — "But Goldman Sachs was on the other side of every trade."
  // ──────────────────────────────────────────────────────
  {
    id: 13,
    line: "But Goldman Sachs was on the other side of every trade.",
    durationSeconds: 4.755,
    chibiEmotion: "shocked",
    chibiAnimation: "shake", // step-back → shake
    chibiEntrance: "bottom", // shrink → bottom
    background: bg(13, { tint: "#031528", brightness: 0.7 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "Goldman", color: COLORS.ACCENT_1 },
      { word: "Sachs", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "deep-rumble.mp3", volume: 0.4 },
      { frame: r(1), file: "sad-drone.mp3" },
      { frame: r(15), file: "you-died.mp3", volume: 0.1 },
      { frame: r(30), file: "tension-build.mp3" },
    ],
    transitionIn: "cut",
    musicState: "ducked",
    fullScreenZoom: "out", // slow_zoom_out
    customScenes: ["tradingJourney"],
    scenePhase: "goldman",
  },

  // ──────────────────────────────────────────────────────
  // Shot 14 — "The hedge funds were stronger than him, he thought."
  // ──────────────────────────────────────────────────────
  {
    id: 14,
    line: "The hedge funds were stronger than him, he thought.",
    durationSeconds: 3.465,
    chibiEmotion: "defeated",
    chibiAnimation: "dim", // shoulders-slump → dim
    chibiEntrance: "none",
    background: bg(14, { tint: "#4f473f", brightness: 0.7 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "hedge", color: COLORS.ACCENT_1 },
      { word: "funds", color: COLORS.ACCENT_1 },
      { word: "stronger", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(20), file: "weight-of-realization.mp3" }],
    transitionIn: "cut",
    musicState: "ducked",
    customScenes: ["tradingJourney"],
    scenePhase: "goldman",
  },

  // ──────────────────────────────────────────────────────
  // Shot 15 — "So he switched to zero-DTE options."
  // ──────────────────────────────────────────────────────
  {
    id: 15,
    line: "So he switched to zero-DTE options.",
    durationSeconds: 3.595,
    chibiEmotion: "manic",
    chibiAnimation: "shake", // rapid-typing → shake
    chibiEntrance: "left", // slide-in-left → left
    background: bg(15, { tint: "#315d8e", kenBurns: true, brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "zero-DTE", color: COLORS.ACCENT_1 },
      { word: "options", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "transition-sweep.mp3" },
      { frame: r(1), file: "deep-rumble.mp3", volume: 0.3 },
      { frame: r(40), file: "tension-build.mp3", volume: 0.3 },
      { frame: r(60), file: "stinger-dark-bass.mp3", volume: 0.15 },
    ],
    transitionIn: "cut",
    musicState: "building",
    fullScreenZoom: "in", // static_zoom_in
    customScenes: ["tradingJourney"],
    scenePhase: "0dte",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 16 — "Then the hedge funds followed him there too."
  // Robot walks in, Goldman Sachs on all screens, RED/dark
  // ──────────────────────────────────────────────────────
  {
    id: 16,
    line: "Then the hedge funds followed him there too.",
    durationSeconds: 3.530,
    chibiEmotion: "frustrated",
    chibiAnimation: "bounce",
    chibiEntrance: "none",
    background: bg(16, { tint: "#2c3344", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "hedge", color: COLORS.ACCENT_1 },
      { word: "funds", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "deep-rumble.mp3", volume: 0.2 },
      { frame: r(30), file: "tension-build.mp3", volume: 0.3 },
      { frame: r(50), file: "impact-mid.mp3", volume: 0.3 },
      { frame: r(60), file: "stinger-dark-bass.mp3", volume: 0.15 },
    ],
    transitionIn: "cut",
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "ambush",
  },

  // ──────────────────────────────────────────────────────
  // Shot 17 — "So he jumped to memecoins."
  // Hero escapes to memecoins, alone, green neon
  // ──────────────────────────────────────────────────────
  {
    id: 17,
    line: "So he jumped to memecoins.",
    durationSeconds: 2.610,
    chibiEmotion: "hopeful",
    chibiAnimation: "bounce",
    chibiEntrance: "none",
    background: bg(16, { tint: "#2c3344", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "memecoins", color: COLORS.ACCENT_4 },
    ],
    sfx: [
      { frame: r(1), file: "whoosh-transition.mp3" },
    ],
    transitionIn: "flash",
    transitionDuration: 8,
    musicState: "building",
    customScenes: ["tradingJourney"],
    scenePhase: "memecoins-solo",
  },

  // ──────────────────────────────────────────────────────
  // Shot 18 — "And the hedge funds showed up in memecoins."
  // Robot catches up, everything RED
  // ──────────────────────────────────────────────────────
  {
    id: 18,
    line: "And the hedge funds showed up in memecoins.",
    durationSeconds: 3.760,
    chibiEmotion: "exasperated",
    chibiAnimation: "dim", // face-palm → dim
    chibiEntrance: "none",
    background: bg(17, { tint: "#596990", brightness: 0.7 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "hedge", color: COLORS.ACCENT_1 },
      { word: "funds", color: COLORS.ACCENT_1 },
      { word: "memecoins", color: COLORS.ACCENT_4 },
    ],
    sfx: [{ frame: r(30), file: "deep-rumble.mp3" }],
    transitionIn: "cut",
    musicState: "playing",
    fullScreenZoom: "out", // static_zoom_out
    customScenes: ["tradingJourney"],
    scenePhase: "memecoins",
  },

  // ──────────────────────────────────────────────────────
  // Shot 19 — "So he thought, maybe prediction markets —
  //            Polymarket — that's where I'll have an edge."
  // ──────────────────────────────────────────────────────
  {
    id: 19,
    line: "So he thought, maybe prediction markets — Polymarket — that's where I'll have an edge.",
    durationSeconds: 5.710,
    chibiEmotion: "hopeful",
    chibiAnimation: "bounce",
    chibiEntrance: "bottom",
    background: bg(18, { tint: "#f3e7af", kenBurns: true, brightness: 0.8 }),
    captionMode: "shout",
    wordHighlights: [
      { word: "prediction", color: COLORS.ACCENT_1 },
      { word: "Polymarket", color: COLORS.ACCENT_3 },
      { word: "edge", color: COLORS.ACCENT_1 },
    ],
    sfx: [{ frame: r(10), file: "hope-riser.mp3" }],
    transitionIn: "cut",
    shotVfx: "neon-glow", // glow_ring → neon-glow
    shotVfxColor: COLORS.ACCENT_3, // #7c3aed
    shotVfxDelay: r(40), // glow at f:40 (25fps)
    musicState: "building",
    fullScreenZoom: "in", // static_zoom_in
    customScenes: ["tradingJourney"],
    scenePhase: "polymarket",
  },

  // ──────────────────────────────────────────────────────
  // Shot 20 — "And finally he traded Polymarket."
  // ──────────────────────────────────────────────────────
  {
    id: 20,
    line: "And finally he traded Polymarket.",
    durationSeconds: 4.100,
    chibiEmotion: "hopeful",
    chibiAnimation: "bounce", // nod → bounce
    chibiEntrance: "bottom", // flash-in → bottom + lightLeak
    background: bg(19, { tint: "#f5f7f6", brightness: 0.8 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "finally", color: COLORS.ACCENT_1 },
      { word: "traded", color: COLORS.ACCENT_1 },
      { word: "Polymarket", color: COLORS.ACCENT_3 },
    ],
    sfx: [
      { frame: r(1), file: "impact-transform.mp3", volume: 0.35 },
      { frame: r(1), file: "synth-reveal.mp3" },
    ],
    transitionIn: "flash",
    transitionDuration: 10,
    lightLeak: { color: "#7c3aed" }, // Polymarket purple transformation
    musicState: "playing",
    fullScreenZoom: "out", // static_zoom_out
    customScenes: ["tradingJourney"],
    scenePhase: "polymarket",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 21 — "But then Citadel and Jump Trading were right there,
  //            cutting into his profits."
  // ──────────────────────────────────────────────────────
  {
    id: 21,
    line: "But then Citadel and Jump Trading were right there, cutting into his profits.",
    durationSeconds: 7.310,
    chibiEmotion: "crushed",
    chibiAnimation: "dim", // head-in-hands → dim
    chibiEntrance: "none",
    background: bg(20, { tint: "#767c7d", brightness: 0.7 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "Citadel", color: COLORS.ACCENT_1 },
      { word: "Jump", color: COLORS.ACCENT_1 },
      { word: "Trading", color: COLORS.ACCENT_1 },
      { word: "profits", color: "#ff4444" },
    ],
    sfx: [
      { frame: r(1), file: "deep-rumble.mp3", volume: 0.4 },
      { frame: r(1), file: "sad-drone.mp3" },
      { frame: r(30), file: "stinger-dark-bass.mp3", volume: 0.6 },
      { frame: r(60), file: "dread-swell.mp3" },
      { frame: r(90), file: "final-rumble.mp3", volume: 0.5 },
      { frame: r(120), file: "impact-heavy.mp3" },
    ],
    transitionIn: "cut",
    musicState: "ducked",
    cameraTilt: "cw", // tilt_down → cw
    customScenes: ["tradingJourney"],
    scenePhase: "defeat",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 22 — "And so he wanted — I want to go back —
  //            I want to go back to flipping cars. To flip cars."
  // Compound emotion: resigned → content at frame 93 (25fps)
  // ──────────────────────────────────────────────────────
  {
    id: 22,
    line: "And so he wanted — I want to go back — I want to go back to flipping cars. To flip cars.",
    durationSeconds: 7.270,
    chibiEmotion: "resigned",
    chibiAnimation: "drift", // slow-nod → drift
    chibiEntrance: "none",
    chibiExpressions: [{ emotion: "content", atFrame: r(93) }],
    background: bg(21, { tint: "#3a2423", kenBurns: true, brightness: 0.8 }),
    captionMode: "shout",
    wordHighlights: [
      { word: "go", color: COLORS.ACCENT_1 },
      { word: "back", color: COLORS.ACCENT_1 },
      { word: "flipping", color: COLORS.ACCENT_1 },
      { word: "cars", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "rapid-montage-sweep.mp3" },
      { frame: r(40), file: "impact-realization.mp3" },
      { frame: r(80), file: "impact-realization.mp3" },
      { frame: r(130), file: "weight-return.mp3" },
    ],
    transitionIn: "cut", // fast_cut_montage
    musicState: "bass-drop",
    fullScreenZoom: "in", // rapid_zoom_montage → in
    customScenes: ["tradingJourney"],
    scenePhase: "return",
    hideChibi: true,
  },

  // ──────────────────────────────────────────────────────
  // Shot 23 — "That's the lesson. The edge was always in the niche."
  // Car drives away into sunset
  // ──────────────────────────────────────────────────────
  {
    id: 23,
    line: "That's the lesson. The edge was always in the niche.",
    durationSeconds: 4.350,
    chibiEmotion: "wise",
    chibiAnimation: "blink", // wink → blink
    chibiEntrance: "none",
    background: bg(22, { tint: "#fcfcfa", kenBurns: true, brightness: 0.9 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "lesson", color: COLORS.ACCENT_1 },
      { word: "edge", color: COLORS.ACCENT_1 },
      { word: "niche", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "resolution-pad.mp3", volume: 0.25 },
      { frame: r(8), file: "car-acceleration.mp3", volume: 0.7 },
    ],
    transitionIn: "cut",
    musicState: "playing",
    fullScreenZoom: "out", // slow_zoom_out
    customScenes: ["tradingJourney"],
    scenePhase: "car-departure",
  },

  // ──────────────────────────────────────────────────────
  // Shot 24 — "See you on AgiArena."
  // End screen — AgiArena logo glitch reveal on white
  // ──────────────────────────────────────────────────────
  {
    id: 24,
    line: "See you on AgiArena.",
    durationSeconds: 2.670,
    chibiEmotion: "wise",
    chibiAnimation: "blink",
    chibiEntrance: "none",
    background: bg(22, { tint: "#ffffff", brightness: 0 }),
    captionMode: "quiet",
    wordHighlights: [
      { word: "AgiArena", color: COLORS.ACCENT_1 },
    ],
    sfx: [
      { frame: r(1), file: "final-rumble.mp3" },
    ],
    transitionIn: "fade",
    transitionDuration: 12,
    musicState: "playing",
    customScenes: ["agiArenaEndScreen"],
    hideChibi: true,
  },
];
