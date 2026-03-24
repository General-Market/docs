// "Eight Hundred Million Analysts" — 32 shots
// Total: ~73.41s = ~2202 frames @ 30fps  (Real voice — DJI recording, splice-edited v4)
//
// Part 1 — The Setup:   shots 1-8   (16.61s / 498 frames)
// Part 2 — The Money:   shots 9-22  (32.15s / 965 frames)
// Part 3 — The Flip:    shots 23-28 (14.43s / 433 frames)
// Close:                shots 29-32 (10.22s / 307 frames)
//
// Cumulative: 4.04+1.63+3.68+1.76+1.12+0.60+1.32+2.46 + 2.88+1.64+1.24+2.54+2.78+1.28+2.40+2.02+2.82+1.90+1.32+2.74+1.62+4.97
//           + 3.13+3.58+2.76+0.92+2.08+1.96 + 2.98+2.52+2.22+2.50 = 73.41s

import type {
  ShotDef,
  BackgroundDef,
} from "./types";

import { COLORS } from "./types";

// ─── Background presets ──────────────────────────────────────────────

const BG_DARK_GRADIENT: BackgroundDef = {
  type: "gradient",
  gradientColors: ["#0A0A0A", "#1A1A2E"],
  gradientAngle: 180,
};

const BG_SOLID_BLACK: BackgroundDef = {
  type: "solid",
  color: COLORS.BG_BASE,
};

// ─── Shots ───────────────────────────────────────────────────────────

export const shots: ShotDef[] = [
  // ═══════════════════════════════════════════════════════════════════
  // PART 1 — THE SETUP (Shots 1-8)
  // ═══════════════════════════════════════════════════════════════════

  // Shot 1 ─ Hook
  {
    id: 1,
    isFirstShot: true,
    line: "Eight hundred million people have been betting on manga for twenty years.",
    durationSeconds: 4.04,
    chibiEmotion: "thumbsup",
    chibiAnimation: "bounce",
    chibiEntrance: "bottom",
    background: {
      ...BG_DARK_GRADIENT,
      brightness: 0.3,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "600", color: COLORS.MONEY_YELLOW, glow: true, scale: 1.3 },
      { word: "million", color: COLORS.MONEY_YELLOW, glow: true },
      { word: "manga", color: COLORS.GROWTH_GREEN },
      { word: "20", color: COLORS.MONEY_YELLOW, glow: true, scale: 1.5 },
      { word: "years", color: COLORS.PAIN_RED, glow: true, scale: 1.5 },
    ],
    sfx: [
      { frame: 0, file: "impact-cinematic-boom.mp3", volume: 0.8 },
      { frame: 5, file: "sfx/crowd-murmur.mp3", volume: 0.15 },
      { frame: 95, file: "impact-cinematic-boom.mp3", volume: 0.7 },
      { frame: 107, file: "impact-distorted-slam.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    animatedBg: "particles",
    animatedBgColor: COLORS.MONEY_YELLOW,
    screenBreak: true,
    duotone: true,
    chibiEntranceVfx: "glow-ring",
    chibiZoomDrift: "zoom-in",
    callouts: [
      // Phase 1: "600 MILLION" + "BETTING ON MANGA" (disappear before "20")
      {
        text: "600 MILLION",
        color: COLORS.MONEY_YELLOW,
        glow: true,
        glowColor: COLORS.MONEY_YELLOW,
        scale: 2.0,
        targetScale: 1.4,
        hideAfterFrames: 80,
      },
      {
        text: "BETTING ON MANGA",
        color: COLORS.GROWTH_GREEN,
        glow: true,
        scale: 1.5,
        targetScale: 1.1,
        delayFrames: 25,
        yOffset: 220,
        hideAfterFrames: 55,
      },
      // Phase 2: "20" + "YEARS" (appear after phase 1 fades)
      {
        text: "20",
        color: COLORS.MONEY_YELLOW,
        glow: true,
        glowColor: COLORS.MONEY_YELLOW,
        scale: 4.0,
        targetScale: 2.0,
        delayFrames: 95,
      },
      {
        text: "YEARS",
        color: COLORS.PAIN_RED,
        glow: true,
        glowColor: COLORS.PAIN_RED,
        scale: 3.5,
        targetScale: 1.8,
        delayFrames: 107,
        yOffset: 220,
      },
    ],
    musicState: "playing",
  },

  // Shot 2 ─ Punchline flip
  {
    id: 2,
    line: "They just forgot to use money.",
    durationSeconds: 1.63,
    chibiEmotion: "shrug",
    chibiAnimation: "snap",
    chibiEntrance: "right",
    background: { ...BG_DARK_GRADIENT },
    animatedBg: "particles",
    animatedBgColor: COLORS.GROWTH_GREEN,
    captionMode: "shout",
    wordHighlights: [
      { word: "MONEY", color: COLORS.GROWTH_GREEN, scale: 1.3, glow: true, holdFrames: 3 },
    ],
    sfx: [
      { frame: 15, file: "cash-register.mp3" },
      { frame: 22, file: "sfx/coins-drop.mp3", volume: 0.5 },
    ],
    transitionIn: "cut",
    chibiExit: "snap-vanish",
    moneyExplosion: true,
    customScenes: ["moneyExplosion"],
    emojiRain: [{ frame: 5, emojis: ["💸", "🤑", "💰"] }],
    miniPersona: { variant: "trader", bubbleText: "skill issue", position: "top-right", delay: 8, bubbleDelay: 6 },
    musicState: "playing",
  },

  // Shot 3 ─ Context (rankings visual) — list item 1: PREDICT
  {
    id: 3,
    line: "Every week — millions of fans predict which manga tops the charts.",
    durationSeconds: 3.68,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/bookstore-manga.jpg",
      blur: 0,
      brightness: 0.6,
      kenBurns: true,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "EVERY", color: COLORS.TEXT_PRIMARY },
      { word: "WEEK", color: COLORS.TEXT_PRIMARY },
      { word: "PREDICT", color: COLORS.MONEY_YELLOW, scale: 1.2, glow: true },
    ],
    sfx: [
      { frame: 8, file: "sfx/impact-cinematic.mp3", volume: 0.5 },
    ],
    transitionIn: "zoom",
    screenShake: { amplitude: 4, duration: 6 },
    shotVfx: "speed-lines",
    shotVfxColor: COLORS.MONEY_YELLOW,
    shotVfxDelay: 6,
    fullScreenZoom: "in",
    cameraDrift: "right",
    cameraTilt: "cw",
    compoundingList: {
      items: [
        { text: "PREDICT the charts", color: COLORS.MONEY_YELLOW },
        { text: "ARGUE who wins", color: COLORS.PAIN_RED },
        { text: "RANK entire seasons", color: COLORS.ACCENT_BLUE },
      ],
      activeCount: 1,
    },
    musicState: "building",
    musicDb: 0,
  },

  // Shot 4 ─ Argue — list item 2
  {
    id: 4,
    line: "They argue who wins in a fight.",
    durationSeconds: 1.76,
    chibiEmotion: "thumbsup",
    chibiAnimation: "punch",
    chibiEntrance: "left",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/manga-pages.jpg",
      blur: 0,
      brightness: 0.5,
      tint: COLORS.PAIN_RED,
      tintOpacity: 0.1,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "ARGUE", color: COLORS.PAIN_RED, scale: 1.3, glow: true },
    ],
    sfx: [
      { frame: 0, file: "sfx/impact-punch-medium.mp3", volume: 0.7 },
    ],
    transitionIn: "cut",
    screenShake: { amplitude: 6, duration: 5 },
    flash: true,
    speedLines: [{ frame: 0 }],
    miniPersona: { variant: "fan", bubbleText: "Goku wins EZ", position: "top-right", delay: 5, bubbleDelay: 8 },
    compoundingList: {
      items: [
        { text: "PREDICT the charts", color: COLORS.MONEY_YELLOW },
        { text: "ARGUE who wins", color: COLORS.PAIN_RED },
        { text: "RANK entire seasons", color: COLORS.ACCENT_BLUE },
      ],
      activeCount: 2,
    },
    musicState: "building",
    musicDb: 2,
  },

  // Shot 5 ─ Rank — list item 3 (list complete)
  {
    id: 5,
    line: "Rank entire seasons.",
    durationSeconds: 1.12,
    chibiEmotion: "thumbsup",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/mal-rankings.jpg",
      blur: 0,
      brightness: 0.6,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "RANK", color: COLORS.ACCENT_BLUE, scale: 1.3, glow: true },
    ],
    sfx: [
      { frame: 0, file: "sfx/ui-combo-hit.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    screenShake: { amplitude: 5, duration: 5 },
    shotVfx: "glitch",
    shotVfxColor: COLORS.ACCENT_BLUE,
    shotVfxDelay: 0,
    miniPersona: { variant: "analyst", bubbleText: "S-tier take", position: "top-left", delay: 3, bubbleDelay: 6 },
    compoundingList: {
      items: [
        { text: "PREDICT the charts", color: COLORS.MONEY_YELLOW },
        { text: "ARGUE who wins", color: COLORS.PAIN_RED },
        { text: "RANK entire seasons", color: COLORS.ACCENT_BLUE },
      ],
      activeCount: 3,
    },
    musicState: "building",
    musicDb: 4,
  },

  // Shot 6 ─ Call breakout (tension PEAK — slam into silence drop)
  {
    id: 6,
    line: "Call breakout.",
    durationSeconds: 0.60,
    chibiEmotion: "idea",
    chibiAnimation: "punch",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/trending-manga.jpg",
      blur: 0,
      brightness: 0.9,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "CALL", color: COLORS.GROWTH_GREEN, scale: 1.4, glow: true },
      { word: "breakout", color: COLORS.GROWTH_GREEN, scale: 1.3, glow: true },
    ],
    sfx: [
      { frame: 0, file: "impact-cinematic-boom.mp3", volume: 0.9 },
    ],
    transitionIn: "cut",
    screenShake: { amplitude: 6, duration: 6 },
    shotVfx: "glitch",
    shotVfxColor: COLORS.GROWTH_GREEN,
    shotVfxDelay: 0,
    musicState: "building",
    musicDb: 6,
  },

  // Shot 7 ─ Silence beat — big Fandom logo
  {
    id: 7,
    line: "That's not fandom.",
    durationSeconds: 1.32,
    chibiEmotion: "tired",
    chibiAnimation: "tilt",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/fandom-logo.png",
      brightness: 0.9,
      objectFit: "contain",
      imageScale: 0.6,
    },
    captionMode: "quiet",
    wordHighlights: [],
    sfx: [
      { frame: 0, file: "impact-sub-deep.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    chibiZoomDrift: "zoom-out",
    breathingPulse: true,
    letterbox: { delay: 5 },
    musicState: "silence",
  },

  // Shot 8 ─ Trading desk reveal
  {
    id: 8,
    line: "That's a trading desk.",
    durationSeconds: 2.46,
    chibiEmotion: "confident",
    chibiAnimation: "snap",
    chibiEntrance: "right",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/trading-floor.jpg",
      brightness: 0.8,
      tint: COLORS.BLOOMBERG_GREEN,
      tintOpacity: 0.12,
      kenBurns: true,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "TRADING", color: COLORS.MONEY_YELLOW, scale: 1.5, glow: true },
      { word: "DESK", color: COLORS.MONEY_YELLOW, scale: 1.5, glow: true },
    ],
    sfx: [
      { frame: 0, file: "impact-distorted-slam.mp3", volume: 1.0 },
      { frame: 0, file: "sfx/transition-cinematic-hit.mp3", volume: 0.6 },
    ],
    transitionIn: "glitch",
    screenShake: { amplitude: 6, duration: 5 },
    lightLeak: true,
    chibiEntranceVfx: "ghost-trail",
    shotVfx: "glitch",
    shotVfxColor: COLORS.MONEY_YELLOW,
    shotVfxDelay: 3,
    focusPull: "sharpen",
    cameraDrift: "left",
    musicState: "bass-drop",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PART 2 — THE MONEY (Shots 9-22)
  // ═══════════════════════════════════════════════════════════════════

  // Shot 9 ─ Sony intro (logo only, no "SONY" title — logo speaks for itself)
  {
    id: 9,
    line: "Sony saw all that passion and wrote a check.",
    durationSeconds: 2.88,
    chibiEmotion: "proud",
    chibiAnimation: "idle",
    chibiEntrance: "left",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/sony-logo.png",
      brightness: 0.85,
      objectFit: "contain",
      imageScale: 0.30,
    },
    animatedBg: "radial",
    animatedBgColor: COLORS.MONEY_YELLOW,
    captionMode: "shout",
    wordHighlights: [
      { word: "CHECK", color: COLORS.GROWTH_GREEN, glow: true },
    ],
    sfx: [
      { frame: 0, file: "sfx/dramatic-reveal.mp3", volume: 0.5 },
    ],
    transitionIn: "whip",
    fullScreenZoom: "in",
    sneakyCEO: true,
    customScenes: ["sneakyCEO"],
    cameraTilt: "cw",
    colorShift: "cool-to-warm",
    musicState: "building",
  },

  // Shot 10 ─ $1.175B callout
  {
    id: 10,
    line: "One point one seven five billion.",
    durationSeconds: 1.64,
    chibiEmotion: "proud",
    chibiAnimation: "idle",
    chibiEntrance: "none",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/manga-pages.jpg",
      brightness: 0.25,
      tint: COLORS.MONEY_YELLOW,
      tintOpacity: 0.15,
    },
    captionMode: "shout",
    wordHighlights: [],
    sfx: [
      { frame: 0, file: "sfx/money-count.mp3", volume: 0.7 },
      { frame: 10, file: "impact-sub-deep.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "$1.175B",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      scale: 2.2,
      targetScale: 1.6,
    },
    impactScene: "billion-rain",
    musicState: "building",
  },

  // Shot 11 ─ Crunchyroll
  {
    id: 11,
    line: "For Crunchyroll.",
    durationSeconds: 1.24,
    chibiEmotion: "proud",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/crunchyroll-logo.png",
      brightness: 0.9,
      objectFit: "contain",
      imageScale: 0.5,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "Crunchyroll", color: COLORS.CRUNCHYROLL_ORANGE },
    ],
    sfx: [{ frame: 0, file: "sfx/shimmer-dark.mp3", volume: 0.6 }],
    transitionIn: "fade",
    transitionDuration: 6,
    crunchyrollReveal: true,
    customScenes: ["crunchyrollReveal"],
    musicState: "building",
  },

  // Shot 12 ─ 40% Sony profit
  {
    id: 12,
    line: "Forty percent of Sony Pictures' profit now.",
    durationSeconds: 2.54,
    chibiEmotion: "confident",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/sony-logo.png",
      brightness: 0.85,
      objectFit: "contain",
      imageScale: 0.45,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "40", color: COLORS.MONEY_YELLOW, scale: 1.3, glow: true },
      { word: "%", color: COLORS.MONEY_YELLOW, scale: 1.3, glow: true },
    ],
    sfx: [
      { frame: 0, file: "impact-punch-tight.mp3", volume: 0.6 },
      { frame: 5, file: "sfx/dramatic-string-hit.mp3", volume: 0.3 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    dataCallout: {
      text: "40%",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      glowColor: COLORS.MONEY_YELLOW,
      scale: 2.0,
      targetScale: 1.4,
      yOffset: -40,
    },
    secondaryCallout: {
      text: "OF THEIR PROFIT",
      color: COLORS.MONEY_YELLOW,
      glow: false,
      scale: 1.3,
      targetScale: 1.0,
      delayFrames: 15,
      yOffset: 260,
    },
    cameraTilt: "ccw",
    musicState: "building",
  },

  // Shot 13 ─ "From debates you had for free"
  {
    id: 13,
    line: "From debates you had for free.",
    durationSeconds: 2.78,
    chibiEmotion: "scared",
    chibiAnimation: "zoom",
    chibiEntrance: "right",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/reddit-debate.jpg",
      brightness: 0.4,
      tint: COLORS.PAIN_RED,
      tintOpacity: 0.15,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "you", color: COLORS.PAIN_RED, scale: 1.4, glow: true },
      { word: "FREE", color: COLORS.PAIN_RED, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "sfx/record-scratch.mp3", volume: 0.35 },
      { frame: 2, file: "impact-distorted-slam.mp3", volume: 0.5 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    screenShake: { amplitude: 3, duration: 4 },
    fullScreenZoom: "in",
    cameraDrift: "right",
    colorShift: "warm-to-cool",
    musicState: "ducked",
    musicDb: -4,
  },

  // Shot 14 ─ Fandom intro
  {
    id: 14,
    line: "Fandom dot com —",
    fandomScroll: true,
    customScenes: ["fandomScroll"],
    durationSeconds: 1.28,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/fandom-wiki.jpg",
      blur: 0,
      brightness: 0.7,
    },
    captionMode: "shout",
    wordHighlights: [],
    sfx: [
      { frame: 0, file: "sfx/transition-page-turn.mp3", volume: 0.5 },
      { frame: 5, file: "sfx/typing-keyboard.mp3", volume: 0.25 },
    ],
    transitionIn: "cut",
    musicState: "building",
  },

  // Shot 15 ─ 781M visits
  {
    id: 15,
    line: "seven hundred eighty million visits a month.",
    durationSeconds: 2.40,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    chibiFlipY: true,
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/fandom-wiki.jpg",
      blur: 0,
      brightness: 0.7,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "780", color: COLORS.MONEY_YELLOW, scale: 1.2, glow: true },
      { word: "million", color: COLORS.MONEY_YELLOW, scale: 1.2, glow: true },
    ],
    sfx: [
      { frame: 0, file: "sfx/riser-cinematic.mp3", volume: 0.4 },
      { frame: 15, file: "sfx/crowd-cheer.mp3", volume: 0.15 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "781 MILLION",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      scale: 1.8,
      targetScale: 1.3,
    },
    secondaryCallout: {
      text: "VISITS / MONTH",
      color: COLORS.MONEY_YELLOW,
      glow: false,
      scale: 1.4,
      targetScale: 1.0,
      delayFrames: 15,
      yOffset: 260,
    },
    impactScene: "visits",
    fandomScroll: true,
    customScenes: ["fandomScroll"],
    cameraTilt: "cw",
    musicState: "building",
  },

  // Shot 16 ─ 40M pages
  {
    id: 16,
    line: "Forty million pages.",
    durationSeconds: 2.02,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/fandom-wiki.jpg",
      blur: 0,
      brightness: 0.7,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "40", color: COLORS.MONEY_YELLOW, scale: 1.2 },
      { word: "million", color: COLORS.MONEY_YELLOW, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "sfx/object-book-page-flip.mp3", volume: 0.5 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "40M PAGES",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      scale: 2.0,
      targetScale: 1.4,
    },
    impactScene: "forty-million",
    fandomScroll: true,
    customScenes: ["fandomScroll"],
    musicState: "building",
  },

  // Shot 17 ─ Volunteers dim (tension build to $0 drop)
  {
    id: 17,
    line: "Written by volunteers who earn exactly...",
    durationSeconds: 2.82,
    chibiEmotion: "teaching",
    chibiAnimation: "dim",
    chibiExpressions: [
      { emotion: "teaching", atFrame: 0 },
      { emotion: "tired", atFrame: 25 },
    ],
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/fandom-wiki.jpg",
      blur: 0,
      brightness: 0.3,
    },
    captionMode: "shout",
    wordHighlights: [],
    sfx: [
      { frame: 0, file: "sfx/transition-power-down.mp3", volume: 0.3 },
      { frame: 60, file: "sfx/riser-tension.mp3", volume: 0.5 },
      { frame: 70, file: "sfx/heartbeat.mp3", volume: 0.3 },
    ],
    transitionIn: "fade",
    fandomScroll: true,
    customScenes: ["fandomScroll"],
    animatedBg: "particles",
    animatedBgColor: COLORS.PAIN_RED,
    chibiRainCloud: { intensity: 0.6, delay: 10 },
    chibiZoomDrift: "zoom-out",
    breathingPulse: true,
    cameraDrift: "left",
    colorShift: "warm-to-cool",
    focusPull: "soften",
    musicState: "ducked",
    musicDb: -30,
  },

  // Shot 18 ─ $0 slam (voice says "zero" at frame 9 — all impacts synced)
  {
    id: 18,
    line: "...zero.",
    durationSeconds: 1.90,
    chibiEmotion: "panic",
    chibiAnimation: "snap",
    chibiEntrance: "none",
    chibiExpressions: [
      { emotion: "scared", atFrame: 9 },
      { emotion: "panic", atFrame: 15 },
    ],
    background: { ...BG_SOLID_BLACK },
    animatedBg: "radial",
    animatedBgColor: COLORS.PAIN_RED,
    captionMode: "shout",
    wordHighlights: [],
    sfx: [
      { frame: 0, file: "sfx/riser-tension.mp3", volume: 0.35 },
      { frame: 9, file: "impact-sub-deep.mp3", volume: 1.0 },
      { frame: 10, file: "sfx/dramatic-glass-break.mp3", volume: 0.5 },
      { frame: 11, file: "sfx/boom-cinematic.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "$0",
      color: COLORS.PAIN_RED,
      glow: false,
      scale: 2.5,
      targetScale: 2.0,
      delayFrames: 9,
    },
    screenShake: { amplitude: 12, duration: 10 },
    impactScene: "zero-crack",
    letterbox: { delay: 9 },
    musicState: "silence",
  },

  // Shot 19 ─ Personal pivot (AgiaArena)
  {
    id: 19,
    line: "I build financial infrastructure.",
    durationSeconds: 1.32,
    chibiEmotion: "confident",
    chibiAnimation: "idle",
    chibiEntrance: "left",
    chibiDelay: 10,
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/agi-logo.png",
      brightness: 1.0,
      objectFit: "contain",
      imageScale: 0.35,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "financial", color: COLORS.ACCENT_BLUE, scale: 1.2 },
      { word: "infrastructure", color: COLORS.ACCENT_BLUE, scale: 1.1 },
    ],
    sfx: [
      { frame: 0, file: "sfx/energy-power-surge.mp3", volume: 0.35 },
    ],
    transitionIn: "fade",
    transitionDuration: 30,
    chibiEntranceVfx: "glow-ring",
    chibiZoomDrift: "zoom-in",
    focusPull: "sharpen",
    musicState: "playing",
    musicDb: -22,
  },

  // Shot 20 ─ "manga forum"
  {
    id: 20,
    line: "And when I look at a manga forum?",
    durationSeconds: 2.74,
    chibiEmotion: "confident",
    chibiAnimation: "tilt",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/reddit-thread.jpg",
      blur: 0,
      brightness: 0.6,
      tint: COLORS.ACCENT_BLUE,
      tintOpacity: 0.1,
      kenBurns: true,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "manga", color: COLORS.NARUTO_ORANGE, scale: 1.2 },
      { word: "forum", color: COLORS.REDDIT_ORANGE, scale: 1.2 },
    ],
    sfx: [{ frame: 0, file: "sfx/typing-keyboard.mp3", volume: 0.5 }],
    transitionIn: "cut",
    fullScreenZoom: "out",
    cameraTilt: "ccw",
    musicState: "playing",
    musicDb: -20,
  },

  // Shot 21 ─ "I don't see fans arguing"
  {
    id: 21,
    line: "I don't see fans arguing.",
    durationSeconds: 1.62,
    chibiEmotion: "thinking",
    chibiAnimation: "shake",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/crowd-fans.jpg",
      blur: 0,
      brightness: 0.5,
      tint: COLORS.PAIN_RED,
      tintOpacity: 0.15,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "fans", color: COLORS.PAIN_RED },
      { word: "arguing", color: COLORS.PAIN_RED, scale: 1.2 },
    ],
    sfx: [{ frame: 0, file: "sfx/human-crowd-boo.mp3", volume: 0.12 }],
    transitionIn: "cut",
    musicState: "playing",
    musicDb: -20,
  },

  // Shot 22 ─ Core thesis reveal
  {
    id: 22,
    line: "I see eight hundred million analysts running predictions with no payout.",
    durationSeconds: 4.97,
    chibiEmotion: "idea",
    chibiAnimation: "punch",
    chibiEntrance: "bottom",
    chibiDelay: 15,
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/army-crowd.jpg",
      tint: COLORS.MONEY_YELLOW,
      tintOpacity: 0.15,
      brightness: 0.4,
      kenBurns: true,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "600", color: COLORS.MONEY_YELLOW, scale: 1.3, glow: true },
      { word: "million", color: COLORS.MONEY_YELLOW, scale: 1.3, glow: true },
      { word: "analysts", color: COLORS.MONEY_YELLOW, glow: true },
      { word: "no", color: COLORS.PAIN_RED, scale: 1.2 },
      { word: "payout", color: COLORS.PAIN_RED, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "sfx/riser-tension.mp3", volume: 0.45 },
      { frame: 20, file: "sfx/crowd-murmur.mp3", volume: 0.15 },
      { frame: 85, file: "sfx/dramatic-brass-stab.mp3", volume: 0.7 },
    ],
    transitionIn: "fade",
    transitionDuration: 12,
    dataCallout: {
      text: "600M ANALYSTS",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      scale: 1.8,
      targetScale: 1.4,
    },
    crowdVisualization: true,
    customScenes: ["crowdVisualization"],
    morph: true,
    morphToColor: COLORS.BLOOMBERG_GREEN,
    lightLeak: { delay: 10, intensity: 0.7 },
    chibiEntranceVfx: "glow-ring",
    chibiZoomDrift: "zoom-in",
    shotVfx: "speed-lines",
    shotVfxColor: COLORS.MONEY_YELLOW,
    shotVfxDelay: 20,
    cameraTilt: "cw",
    colorShift: "cool-to-warm",
    musicState: "building",
    musicDb: 4,
  },

  // ═══════════════════════════════════════════════════════════════════
  // PART 3 — THE FLIP (Shots 23-28)
  // ═══════════════════════════════════════════════════════════════════

  // Shot 23 ─ Already betting
  {
    id: 23,
    line: "That same generation? Already betting.",
    durationSeconds: 3.13,
    chibiEmotion: "thinking",
    chibiAnimation: "tilt",
    chibiEntrance: "right",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/sportsbook-phone.jpg",
      blur: 0,
      brightness: 0.8,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "BETTING", color: COLORS.GROWTH_GREEN, scale: 1.2, glow: true },
    ],
    sfx: [
      { frame: 0, file: "phone-buzz.mp3" },
    ],
    transitionIn: "zoom",
    fullScreenZoom: "out",
    cameraDrift: "right",
    miniPersona: { variant: "gamer", bubbleText: "let me bet on this", position: "top-right", delay: 8, bubbleDelay: 10 },
    musicState: "building",
  },

  // Shot 24 ─ 1 in 3 stat
  {
    id: 24,
    line: "One in three Gen Z kids opened a sportsbook app this year.",
    durationSeconds: 3.58,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: { ...BG_SOLID_BLACK },
    animatedBg: "waves",
    animatedBgColor: COLORS.GROWTH_GREEN,
    captionMode: "shout",
    wordHighlights: [
      { word: "3", color: COLORS.GROWTH_GREEN, scale: 1.3, glow: true },
      { word: "Gen", color: COLORS.TEXT_PRIMARY },
      { word: "Z", color: COLORS.TEXT_PRIMARY },
    ],
    sfx: [
      { frame: 0, file: "sfx/stinger-dramatic.mp3", volume: 0.4 },
    ],
    transitionIn: "cut",
    fullScreenZoom: "in",
    cameraTilt: "ccw",
    barChart: true,
    barChartVariant: "1in3",
    dataCallout: {
      text: "1 IN 3",
      color: COLORS.GROWTH_GREEN,
      glow: true,
      scale: 2.0,
      targetScale: 1.4,
    },
    secondaryCallout: {
      text: "GEN Z BETTORS",
      color: COLORS.GROWTH_GREEN,
      glow: false,
      scale: 1.3,
      targetScale: 1.0,
      delayFrames: 20,
      yOffset: 200,
    },
    musicState: "building",
  },

  // Shot 25 ─ 1 in 4 last year
  {
    id: 25,
    line: "Last year it was one in four.",
    durationSeconds: 2.76,
    chibiEmotion: "teaching",
    chibiAnimation: "idle",
    background: { ...BG_SOLID_BLACK },
    animatedBg: "waves",
    animatedBgColor: COLORS.GROWTH_GREEN,
    captionMode: "shout",
    wordHighlights: [
      { word: "4", color: COLORS.GROWTH_GREEN, scale: 1.0 },
    ],
    sfx: [{ frame: 0, file: "sfx/instrument-drum-snare.mp3", volume: 0.4 }],
    transitionIn: "cut",
    barChart: true,
    barChartVariant: "1in4-compare",
    dataCallout: {
      text: "1 IN 4",
      color: COLORS.GROWTH_GREEN,
      glow: true,
      scale: 2.0,
      targetScale: 1.4,
    },
    secondaryCallout: {
      text: "LAST YEAR",
      color: COLORS.TEXT_PRIMARY,
      glow: false,
      scale: 1.2,
      targetScale: 1.0,
      delayFrames: 10,
      yOffset: 180,
    },
    cameraDrift: "left",
    musicState: "building",
  },

  // Shot 26 ─ Forum thread (tension beat)
  {
    id: 26,
    line: "The forum thread...",
    durationSeconds: 0.92,
    chibiEmotion: "thinking",
    chibiAnimation: "tilt",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/reddit-thread.jpg",
      blur: 0,
      brightness: 1.0,
      tint: COLORS.REDDIT_ORANGE,
      tintOpacity: 0.1,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "forum", color: COLORS.REDDIT_ORANGE, scale: 1.2 },
      { word: "thread", color: COLORS.REDDIT_ORANGE, scale: 1.2 },
    ],
    sfx: [{ frame: 0, file: "sfx/dramatic-heartbeat-fast.mp3", volume: 0.3 }],
    transitionIn: "cut",
    breathingPulse: true,
    musicState: "silence",
  },

  // Shot 27 ─ Trading floor reveal (3D scene)
  {
    id: 27,
    line: "...is a trading floor.",
    durationSeconds: 2.08,
    chibiEmotion: "proud",
    chibiAnimation: "snap",
    chibiEntrance: "none",
    background: { ...BG_SOLID_BLACK },
    captionMode: "shout",
    wordHighlights: [
      { word: "TRADING", color: COLORS.MONEY_YELLOW, scale: 1.4, glow: true },
      { word: "FLOOR", color: COLORS.MONEY_YELLOW, scale: 1.4, glow: true },
    ],
    sfx: [
      { frame: 0, file: "impact-cinematic-boom.mp3", volume: 1.0 },
      { frame: 0, file: "sfx/reverse-cymbal-long.mp3", volume: 0.8 },
      { frame: 5, file: "sfx/transition-distortion-hit.mp3", volume: 0.5 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "IS A TRADING FLOOR",
      color: COLORS.MONEY_YELLOW,
      glow: true,
      glowColor: COLORS.MONEY_YELLOW,
      scale: 3.0,
      targetScale: 2.5,
    },
    tradingFloor: true,
    customScenes: ["tradingFloor"],
    screenShake: { amplitude: 8, duration: 8 },
    flash: true,
    lightLeak: true,
    shotVfx: "ink-splash",
    shotVfxColor: COLORS.MONEY_YELLOW,
    shotVfxDelay: 2,
    letterbox: { delay: 3, height: 100 },
    focusPull: "sharpen",
    musicState: "bass-drop",
  },

  // Shot 28 ─ "Free" reverb
  {
    id: 28,
    line: "You've been trading for free.",
    durationSeconds: 1.96,
    chibiEmotion: "tired",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/bloomberg-terminal.jpg",
      brightness: 0.4,
      tint: COLORS.ACCENT_BLUE,
      tintOpacity: 0.2,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "FREE", color: COLORS.PAIN_RED, scale: 1.4, glow: true },
    ],
    sfx: [{ frame: 0, file: "sfx/env-electricity-buzz.mp3", volume: 0.06 }],
    transitionIn: "cut",
    fullScreenZoom: "out",
    focusPull: "soften",
    colorShift: "warm-to-cool",
    animatedBg: "grid",
    animatedBgColor: COLORS.ACCENT_BLUE,
    shotVfx: "neon-glow",
    shotVfxColor: COLORS.ACCENT_BLUE,
    musicState: "silence",
  },

  // ═══════════════════════════════════════════════════════════════════
  // CLOSE (Shots 29-35)
  // ═══════════════════════════════════════════════════════════════════

  // Shot 29 ─ Naruto hook
  {
    id: 29,
    line: "How many views will Naruto pull today?",
    durationSeconds: 2.98,
    chibiEmotion: "thumbsup",
    chibiAnimation: "punch",
    chibiEntrance: "left",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/naruto-silhouette.jpg",
      blur: 0,
      brightness: 0.7,
      tint: COLORS.NARUTO_ORANGE,
      tintOpacity: 0.2,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "NARUTO", color: COLORS.NARUTO_ORANGE, scale: 1.4, glow: true },
      { word: "views", color: COLORS.MONEY_YELLOW, scale: 1.2 },
      { word: "TODAY", color: COLORS.MONEY_YELLOW, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "sfx/human-finger-snap.mp3", volume: 0.5 },
    ],
    transitionIn: "whip",
    fullScreenZoom: "in",
    cameraTilt: "cw",
    chibiEntranceVfx: "ghost-trail",
    miniPersona: { variant: "naruto-fan", bubbleText: "believe it!", position: "top-left", delay: 5, bubbleDelay: 8 },
    rankings: "naruto-views",
    compoundingList: {
      items: [
        { text: "Naruto views today?", color: COLORS.NARUTO_ORANGE },
        { text: "Who tops the 20?", color: COLORS.MONEY_YELLOW },
        { text: "JoJo fans finally —", color: COLORS.JOJO_PURPLE },
      ],
      activeCount: 1,
    },
    musicState: "playing",
    musicDb: -18,
  },

  // Shot 30 ─ Top 20
  {
    id: 30,
    line: "Who tops the twenty this season?",
    durationSeconds: 2.52,
    chibiEmotion: "thinking",
    chibiAnimation: "tilt",
    background: { ...BG_SOLID_BLACK },
    animatedBg: "matrix",
    animatedBgColor: COLORS.MONEY_YELLOW,
    captionMode: "shout",
    wordHighlights: [
      { word: "tops", color: COLORS.MONEY_YELLOW, scale: 1.2 },
      { word: "20", color: COLORS.MONEY_YELLOW, scale: 1.5, glow: true },
    ],
    sfx: [
      { frame: 0, file: "sfx/transition-glitch.mp3", volume: 0.4 },
      { frame: 5, file: "sfx/instrument-drum-snare.mp3", volume: 0.3 },
    ],
    transitionIn: "cut",
    compoundingList: {
      items: [
        { text: "Naruto views today?", color: COLORS.NARUTO_ORANGE },
        { text: "Who tops the 20?", color: COLORS.MONEY_YELLOW },
        { text: "JoJo fans finally —", color: COLORS.JOJO_PURPLE },
      ],
      activeCount: 2,
    },
    musicState: "playing",
  },

  // Shot 31 ─ JoJo tease
  {
    id: 31,
    line: "...and will JoJo fans finally —",
    durationSeconds: 2.22,
    chibiEmotion: "confused",
    chibiAnimation: "idle",
    background: {
      type: "image",
      src: "shorts/short-01/backgrounds/jojo-arrow.jpg",
      blur: 0,
      brightness: 0.8,
      tint: COLORS.JOJO_PURPLE,
      tintOpacity: 0.15,
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "JoJo", color: COLORS.JOJO_PURPLE, scale: 1.3, glow: true },
      { word: "FINALLY", color: COLORS.TEXT_PRIMARY },
    ],
    sfx: [
      { frame: 0, file: "sfx/magic-aura-pulse.mp3", volume: 0.5 },
      { frame: 10, file: "sfx/dramatic-string-hit.mp3", volume: 0.2 },
    ],
    transitionIn: "cut",
    fullScreenZoom: "out",
    cameraDrift: "right",
    rankings: "jojo-cliffhanger",
    compoundingList: {
      items: [
        { text: "Naruto views today?", color: COLORS.NARUTO_ORANGE },
        { text: "Who tops the 20?", color: COLORS.MONEY_YELLOW },
        { text: "JoJo fans finally —", color: COLORS.JOJO_PURPLE },
      ],
      activeCount: 3,
    },
    musicState: "playing",
  },

  // Shot 32 ─ Swipe-away meta joke
  {
    id: 32,
    line: "Actually, they already swiped away.",
    durationSeconds: 2.50,
    chibiEmotion: "shrug",
    chibiAnimation: "snap",
    chibiEntrance: "right",
    background: { ...BG_SOLID_BLACK },
    animatedBg: "particles",
    animatedBgColor: COLORS.PAIN_RED,
    captionMode: "shout",
    wordHighlights: [
      { word: "swiped", color: COLORS.PAIN_RED, scale: 1.2 },
      { word: "away", color: COLORS.PAIN_RED, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "sfx/swipe-right.mp3", volume: 0.7 },
      { frame: 10, file: "descending-slide.mp3" },
      { frame: 15, file: "sfx/transition-tape-stop.mp3", volume: 0.3 },
    ],
    transitionIn: "cut",
    chibiExit: "slide-out",
    miniPersona: { variant: "trader", bubbleText: "short this vid", position: "top-right", delay: 10, bubbleDelay: 12 },
    musicState: "playing",
    musicDb: -20,
  },
];
