// "Feb New Top 500" — 12 shots @ 30fps, J-cut adds 4 frames/shot
//
// Brief: Clean finance. Rapid-fire crypto roundup. Plain color backgrounds,
// dynamic CUTS (not dynamic VFX), hard cut ending. No anime props.
//
// Structure:
//   HOOK:        shot 1           (4.38s) — cut "you never heard of, who are new"
//   ZAMA:        shots 2-3        (10.28s)
//   STABLECOINS: shot 4           (4.36s)
//   BITLAYER:    shots 5-6        (9.48s)
//   AZTEC:       shots 7-10       (17.12s)
//   GMRT:        shot 11          (4.96s)
//   9BIT:        shot 12          (4.56s)

import type { ShotDef, BackgroundDef } from "./types";
import { COLORS } from "./types";
import { ZAMA_FHE_DIAGRAM, AZTEC_ZK_DIAGRAM } from "../../slots/data/archDiagramConfigs";

// ─── Backgrounds: website screenshots, dimmed + tinted (pro fintech) ─

const BG_DARK: BackgroundDef = {
  type: "gradient",
  gradientColors: ["#0A0A0A", "#1A1A2E"],
  gradientAngle: 180,
};

const BG_ZAMA_HOME: BackgroundDef = {
  type: "image",
  src: "zama_homepage.png",
  brightness: 0.9,
  scrollDown: true,
  scrollSpeed: 0.5,
};

const BG_BITLAYER_HOME: BackgroundDef = {
  type: "image",
  src: "bitlayer_homepage.png",
  brightness: 0.85, // Docs page (light bg) — dim for readability
  scrollDown: true,
  scrollSpeed: 0.05,
};

const BG_DEFILLAMA: BackgroundDef = {
  type: "image",
  src: "defillama_bitlayer.png",
  brightness: 0.85,
  scrollDown: false,
  objectFit: "fill",
};

// Aztec community B-roll from YouTube (0:25 clip)
const BG_AZTEC_COMMUNITY: BackgroundDef = {
  type: "video",
  src: "aztec_community_broll.mp4",
  brightness: 0.85,
};

// Aztec Denver event — fallback to docs page since video not available
const BG_AZTEC_EVENT: BackgroundDef = {
  type: "image",
  src: "aztec_docs.png",
  brightness: 0.8,
  scrollDown: true,
  scrollSpeed: 0.05, // Very slow — almost static
};

const BG_AZTEC_GITHUB: BackgroundDef = {
  type: "image",
  src: "aztec_github.png",
  brightness: 1.0, // No darkening — clean page view
  scrollDown: true,
  scrollSpeed: 0.08, // Very slow scroll
};

const BG_GMRT: BackgroundDef = {
  type: "image",
  src: "gmrt_homepage.png",
  brightness: 0.9,
  scrollDown: true,
  scrollSpeed: 0.3,
};

const BG_9BIT: BackgroundDef = {
  type: "image",
  src: "9bit_homepage.png",
  brightness: 0.85,
  scrollDown: true,
  scrollSpeed: 0.4,
};

// ─── Project data cards (CoinGecko-style, replacing chibi) ──────────

const ZAMA_CARD = {
  name: "Zama",
  ticker: "ZAMA",
  logo: "zama.png",
  color: "#00D4FF",
  category: "FHE Privacy · Rank #488",
  // Real CoinGecko 30d (id: "zama") — ~$0.038 → $0.020, -46.7%
  pricePath: [0.0383, 0.037, 0.0305, 0.0293, 0.0303, 0.0276, 0.029, 0.029, 0.0294, 0.0313, 0.0306, 0.0291, 0.0284, 0.0278, 0.0286, 0.0269, 0.0235, 0.0202, 0.0188, 0.0187, 0.0176, 0.0179, 0.0203, 0.0196, 0.0213, 0.0221, 0.0199, 0.0224, 0.0228, 0.0204],
  priceDecimals: 4,
  badgeLogo: "ecb.png",
};

const BITLAYER_CARD = {
  name: "Bitlayer",
  ticker: "BTR",
  logo: "bitlayer.png",
  color: "#FF8800",
  category: "Bitcoin L2 · Rank #448",
  // Real CoinGecko 30d (id: "bitlayer-bitvm") — ~$0.07 → $0.20, +179%
  pricePath: [0.0704, 0.0616, 0.0745, 0.0746, 0.0754, 0.0674, 0.0669, 0.0675, 0.1228, 0.1401, 0.1423, 0.1358, 0.1343, 0.1396, 0.136, 0.1373, 0.1347, 0.0779, 0.0803, 0.0924, 0.0899, 0.0932, 0.0873, 0.0895, 0.0901, 0.1406, 0.1678, 0.2195, 0.2157, 0.1966],
  priceDecimals: 4,
};

const AZTEC_CARD = {
  name: "Aztec",
  ticker: "AZTEC",
  logo: "aztec.png",
  color: "#00FF88",
  category: "ZK Privacy · a16z Backed",
  // Real CoinGecko 30d (id: "aztec") — ~$0.022, flat
  pricePath: [0.0216, 0.0216, 0.0211, 0.0214, 0.0209, 0.0217, 0.0222, 0.0254, 0.0294, 0.0283, 0.0239, 0.023, 0.0218, 0.0228, 0.0234, 0.0232, 0.0227, 0.0229, 0.0241, 0.0237, 0.0223, 0.0221, 0.0223, 0.0225, 0.0225, 0.0225, 0.0226, 0.0227, 0.0216, 0.0215],
  priceDecimals: 4,
};

const GMRT_CARD = {
  name: "GMRT",
  ticker: "GMRT",
  logo: "gmrt.png",
  color: "#FF3333",
  category: "Cloud Infra · Dubai · Rank #454",
  // Real CoinGecko 30d (id: "gamer-tag") — ~$0.001 → $0.0004, -63%
  pricePath: [0.001015, 0.000999, 0.001072, 0.001007, 0.000959, 0.001051, 0.001052, 0.00102, 0.001023, 0.001015, 0.001015, 0.000966, 0.000964, 0.000956, 0.001038, 0.000949, 0.000911, 0.000868, 0.000849, 0.000774, 0.000664, 0.000553, 0.00052, 0.000459, 0.000398, 0.000372, 0.000318, 0.000369, 0.00036, 0.000375],
  priceDecimals: 6,
};

const NINEBIT_CARD = {
  name: "9Bit",
  ticker: "9BIT",
  logo: "9bit.png",
  color: "#A855F7",
  category: "Gaming · Rank #500+",
  // Synthetic 30d data — low-cap gaming token, volatile down trend
  pricePath: [0.0012, 0.0013, 0.0011, 0.0012, 0.001, 0.0011, 0.001, 0.0009, 0.001, 0.0009, 0.0008, 0.0009, 0.0008, 0.0007, 0.0008, 0.0007, 0.0006, 0.0007, 0.0006, 0.0005, 0.0006, 0.0005, 0.0005, 0.0004, 0.0005, 0.0004, 0.0004, 0.0003, 0.0004, 0.0003],
  priceDecimals: 4,
};

// ─── Shots ───────────────────────────────────────────────────────────

export const shots: ShotDef[] = [

  // ═══ HOOK ══════════════════════════════════════════════════════════

  {
    id: 1,
    isFirstShot: true,
    line: "7 top 500 new crypto companies who appeared in February",
    durationSeconds: 3.12,
    voiceSegments: [
      { startMs: 0, endMs: 3120 },      // "7 top 500 … February" — everything after cut
    ],
    chibiEmotion: "confident",
    chibiAnimation: "idle",
    chibiEntrance: "none",
    chibiEntranceVfx: "none",
    background: { ...BG_DARK },
    captionMode: "shout",
    wordHighlights: [
      { word: "7", color: COLORS.MONEY_YELLOW, scale: 1.5, glow: true },
      { word: "500", color: COLORS.MONEY_YELLOW, scale: 1.3 },
    ],
    sfx: [],
    transitionIn: "cut",
    dataCallout: {
      text: "7 TOP Fastest Growing Cryptos In February",
      color: "#FFFFFF",
      glow: false,
      scale: 1.1,
      targetScale: 1.1,
      yOffset: -250,
      hideAfterFrames: 90,
      instant: true,
    },
    // 7 project cards scrolling in background
    projectShowcase: true,
    floatingLogos: true,
    musicState: "playing",
    // Camera: coming from above
    breathingPulse: true,
    fullScreenZoom: "out",
    cameraVerticalDrift: "down",
    cameraTilt: "cw",
  },

  // ═══ ZAMA — "My Favorite" ═════════════════════════════════════════

  {
    id: 2,
    line: "Zama is an institutional play with the European regulator.",
    durationSeconds: 3.70,
    voiceSegments: [{ startMs: 6360, endMs: 10060 }],
    chibiEmotion: "teaching",
    chibiAnimation: "tilt",
    chibiEntrance: "none",
    chibiEntranceVfx: "none",
    background: { ...BG_ZAMA_HOME },
    projectDataCard: { ...ZAMA_CARD },
    captionMode: "shout",
    wordHighlights: [
      { word: "Zama", color: COLORS.ACCENT_BLUE, scale: 1.4, glow: true },
      { word: "institutional", color: COLORS.MONEY_YELLOW, scale: 1.2 },
    ],
    sfx: [
      { frame: 0, file: "ui-tick.mp3", volume: 0.04 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    musicState: "playing",
    // Camera: positive
    breathingPulse: true,
    fullScreenZoom: "in",
    cameraDrift: "right",
  },

  {
    id: 3,
    line: "They are doing on-chain privacy with banks, but the network is only 5 TPS and they are slow to deliver.",
    durationSeconds: 6.58,
    voiceSegments: [{ startMs: 10060, endMs: 16640 }],
    chibiEmotion: "shrug",
    chibiAnimation: "tilt",
    chibiEntrance: "none",
    background: { type: "solid", color: "#FFFFFF" },
    architectureDiagram: {
      ...ZAMA_FHE_DIAGRAM,
      topPad: 650,
      transparentBg: true,
      headerLogo: { src: "shorts/short-03/logos/ecb.png", width: 200, topY: 160, label: "European Central Bank", labelSize: 32, labelColor: "#003399" },
    },
    captionMode: "quiet",
    wordHighlights: [
      { word: "They", color: "#1a1a2e" },
      { word: "are", color: "#1a1a2e" },
      { word: "doing", color: "#1a1a2e" },
      { word: "on-chain", color: "#1a1a2e" },
      { word: "privacy", color: "#1a1a2e" },
      { word: "with", color: "#1a1a2e" },
      { word: "banks,", color: "#1a1a2e" },
      { word: "but", color: "#1a1a2e" },
      { word: "the", color: "#1a1a2e" },
      { word: "network", color: "#1a1a2e" },
      { word: "is", color: "#1a1a2e" },
      { word: "only", color: "#1a1a2e" },
      { word: "5", color: "#CC0000", scale: 1.5 },
      { word: "TPS", color: "#CC0000", scale: 1.3 },
      { word: "and", color: "#1a1a2e" },
      { word: "they", color: "#1a1a2e" },
      { word: "slow", color: "#CC0000", scale: 1.2 },
      { word: "to", color: "#1a1a2e" },
      { word: "deliver.", color: "#1a1a2e" },
    ],
    sfx: [
      { frame: 80, file: "data-ping.mp3", volume: 0.05 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "5 TPS",
      color: COLORS.PAIN_RED,
      glow: false,
      scale: 2.0,
      targetScale: 1.2,
      yOffset: 0,
      delayFrames: 80,
    },
    musicState: "playing",
    // Camera: clean — no blur on diagram
    breathingPulse: true,
  },

  // ═══ STABLECOINS — "The Graveyard" ════════════════════════════════

  {
    id: 4,
    line: "Not like these companies that keep creating new stablecoins every month.",
    durationSeconds: 4.36,
    voiceSegments: [{ startMs: 16640, endMs: 21000 }],
    chibiEmotion: "tired",
    chibiAnimation: "shake",
    chibiEntrance: "none",
    background: { type: "solid", color: "#FFFFFF" },
    captionMode: "quiet",
    wordHighlights: [
      { word: "Not", color: "#1a1a2e" },
      { word: "like", color: "#1a1a2e" },
      { word: "these", color: "#1a1a2e" },
      { word: "companies", color: "#1a1a2e" },
      { word: "that", color: "#1a1a2e" },
      { word: "keep", color: "#1a1a2e" },
      { word: "creating", color: "#1a1a2e" },
      { word: "new", color: "#1a1a2e" },
      { word: "stablecoins", color: "#B8860B", scale: 1.3 },
      { word: "every", color: "#1a1a2e" },
      { word: "month.", color: "#1a1a2e" },
    ],
    sfx: [
      { frame: 10, file: "ui-tick.mp3", volume: 0.04 },
      { frame: 28, file: "ui-tick.mp3", volume: 0.04 },
      { frame: 46, file: "ui-tick.mp3", volume: 0.04 },
      { frame: 64, file: "glass-tap.mp3", volume: 0.05 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    // CoinGecko-style cards with declining charts + logos
    stablecoinCards: true,
    musicState: "ducked",
    musicDb: -6,
    // Camera: neutral
    breathingPulse: true,
    fullScreenZoom: "out",
    cameraTilt: "cw",
  },

  // ═══ BITLAYER — "Shady" ═══════════════════════════════════════════

  {
    id: 5,
    line: "Bitlayer is a Bitcoin L2 but it's shady, even Bitcoiners don't like those L2s.",
    durationSeconds: 5.36,
    voiceSegments: [{ startMs: 21000, endMs: 26360 }],
    chibiEmotion: "confused",
    chibiAnimation: "wobble",
    chibiEntrance: "none",
    chibiEntranceVfx: "none",
    background: { ...BG_BITLAYER_HOME },
    projectDataCard: { ...BITLAYER_CARD },
    captionMode: "shout",
    wordHighlights: [
      { word: "Bitlayer", color: COLORS.WARN_ORANGE, scale: 1.3 },
      { word: "shady,", color: COLORS.PAIN_RED, scale: 1.4, glow: true },
    ],
    sfx: [
      { frame: 0, file: "slide-in.mp3", volume: 0.04 },
      { frame: 131, file: "sfx/slam-table.mp3", volume: 0.6 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    musicState: "building",
    // Camera: negative
    breathingPulse: true,
    focusPull: "soften",
    colorShift: "warm-to-cool",
  },

  {
    id: 6,
    line: "So nope for me, and look at this DeFi Llama chart, seriously.",
    durationSeconds: 4.12,
    voiceSegments: [{ startMs: 26360, endMs: 30480 }],
    chibiEmotion: "teaching",
    chibiAnimation: "shake",
    background: { ...BG_DEFILLAMA },
    captionMode: "shout",
    wordHighlights: [
      { word: "nope", color: COLORS.PAIN_RED, scale: 1.5, glow: true },
      { word: "seriously.", color: COLORS.PAIN_RED, scale: 1.2 },
    ],
    sfx: [
      { frame: 78, file: "stat-drop.mp3", volume: 0.06 },
      { frame: 93, file: "sfx/slam-table.mp3", volume: 0.6 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "TVL: DEAD",
      color: COLORS.PAIN_RED,
      glow: false,
      scale: 1.8,
      targetScale: 1.3,
      yOffset: -200,
      delayFrames: 78, // Synced: slams in on "DeFi Llama chart" (voice @29180ms)
      hideAfterFrames: 45, // Stays through "seriously." until shot end
    },
    musicState: "ducked",
    musicDb: -8,
    // Camera: negative
    breathingPulse: true,
    focusPull: "soften",
    colorShift: "warm-to-cool",
  },

  // ═══ AZTEC — "Based Community" ════════════════════════════════════

  {
    id: 7,
    line: "While there is Aztec, the privacy project with the most based community of developers I ever met.",
    durationSeconds: 6.52,
    voiceSegments: [{ startMs: 30480, endMs: 37000 }],
    chibiEmotion: "proud",
    chibiAnimation: "drift",
    chibiEntrance: "none",
    chibiEntranceVfx: "none",
    background: { ...BG_AZTEC_COMMUNITY },
    projectDataCard: { ...AZTEC_CARD },
    // B-roll mosaic: video stops at ~5s, zoom out to 3x3 grid
    brollMosaic: {
      triggerFrame: 140,
      videos: [
        "aztec_broll_1.mp4",
        "aztec_broll_2.mp4",
        "aztec_broll_3.mp4",
        "aztec_broll_4.mp4",
        "aztec_broll_5.mp4",
        "aztec_broll_6.mp4",
        "aztec_broll_7.mp4",
        "aztec_broll_8.mp4",
        "aztec_broll_9.mp4",
      ],
    },
    captionMode: "shout",
    wordHighlights: [
      { word: "Aztec,", color: COLORS.ACCENT_BLUE, scale: 1.5, glow: true },
      { word: "based", color: COLORS.GROWTH_GREEN, scale: 1.3 },
    ],
    sfx: [
      { frame: 0, file: "ui-tick.mp3", volume: 0.04 },
      { frame: 5, file: "glass-tap.mp3", volume: 0.04 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    musicState: "playing",
    // Camera: positive
    breathingPulse: true,
    fullScreenZoom: "in",
    cameraDrift: "right",
  },

  {
    id: 8,
    line: "Seriously, go to their events.",
    durationSeconds: 2.18,
    voiceSegments: [{ startMs: 37000, endMs: 39180 }],
    chibiEmotion: "proud",
    chibiAnimation: "heartbeat",
    chibiEntrance: "none",
    background: { ...BG_AZTEC_EVENT },
    projectDataCard: { ...AZTEC_CARD },
    captionMode: "shout",
    wordHighlights: [
      { word: "events.", color: COLORS.MONEY_YELLOW, scale: 1.3, glow: true },
    ],
    sfx: [],
    transitionIn: "cut",
    musicState: "playing",
    // Camera: positive
    breathingPulse: true,
    fullScreenZoom: "in",
    cameraDrift: "right",
  },

  {
    id: 9,
    line: "Backed by a16z, but it's super hard to build on it",
    captionOverride: ["Backed", "by", "a16z,", "but", "it's", "super", "hard", "to", "build", "on", "it"],
    durationSeconds: 3.52,
    voiceSegments: [{ startMs: 39180, endMs: 42700 }],
    chibiEmotion: "thinking",
    chibiAnimation: "tilt",
    chibiEntrance: "none",
    // White bg with a16z dark logo centered + Aztec architecture diagram
    background: { type: "image", src: "a16z_white.png", brightness: 1.0 },
    architectureDiagram: AZTEC_ZK_DIAGRAM,
    captionMode: "quiet",
    // Black captions on white background
    wordHighlights: [
      { word: "Backed", color: "#1a1a2e" },
      { word: "by", color: "#1a1a2e" },
      { word: "a16z,", color: "#0F1019", scale: 1.3 },
      { word: "but", color: "#1a1a2e" },
      { word: "it's", color: "#1a1a2e" },
      { word: "super", color: "#1a1a2e" },
      { word: "hard", color: COLORS.PAIN_RED, scale: 1.3 },
      { word: "to", color: "#1a1a2e" },
      { word: "build", color: "#1a1a2e" },
      { word: "on", color: "#1a1a2e" },
      { word: "it", color: "#1a1a2e" },
    ],
    sfx: [
      { frame: 5, file: "data-ping.mp3", volume: 0.05 },
    ],
    transitionIn: "cut",
    musicState: "building",
    // Camera: neutral
    breathingPulse: true,
    fullScreenZoom: "out",
    cameraTilt: "cw",
  },

  {
    id: 10,
    line: "and we are still waiting for their mainnet since years, so careful.",
    durationSeconds: 4.90,
    voiceSegments: [{ startMs: 42700, endMs: 47600 }],
    chibiEmotion: "scared",
    chibiAnimation: "wobble",
    background: { ...BG_AZTEC_GITHUB },
    captionMode: "quiet",
    wordHighlights: [
      { word: "mainnet", color: COLORS.PAIN_RED, scale: 1.3, glow: true },
      { word: "careful.", color: COLORS.WARN_ORANGE, scale: 1.2 },
    ],
    sfx: [
      { frame: 30, file: "stat-drop.mp3", volume: 0.06 },
    ],
    transitionIn: "cut",
    dataCallout: {
      text: "NO MAINNET",
      color: COLORS.PAIN_RED,
      glow: false,
      scale: 1.5,
      targetScale: 1.0,
      yOffset: -250,
      delayFrames: 30,
      hideAfterFrames: 80,
    },
    musicState: "building",
    // Camera: negative
    breathingPulse: true,
    focusPull: "soften",
    colorShift: "warm-to-cool",
  },

  // ═══ GMRT — "Walking Red Flag" ════════════════════════════════════

  {
    id: 11,
    line: "Next, GMRT is a Dubai cloud company, it's basically a walking red flag.",
    durationSeconds: 4.96,
    voiceSegments: [{ startMs: 47600, endMs: 52560 }],
    chibiEmotion: "scared",
    chibiAnimation: "shake",
    chibiEntrance: "none",
    chibiEntranceVfx: "none",
    background: { ...BG_GMRT },
    projectDataCard: { ...GMRT_CARD },
    captionMode: "shout",
    wordHighlights: [
      { word: "GMRT", color: COLORS.WARN_ORANGE, scale: 1.3 },
      { word: "red", color: COLORS.PAIN_RED, scale: 1.5, glow: true },
      { word: "flag.", color: COLORS.PAIN_RED, scale: 1.5, glow: true },
    ],
    sfx: [
      { frame: 0, file: "alert-tone.mp3", volume: 0.05 },
      { frame: 119, file: "sfx/slam-table.mp3", volume: 0.6 },
    ],
    transitionIn: "fade",
    transitionDuration: 6,
    musicState: "bass-drop",
    // Camera: negative + dramatic
    breathingPulse: true,
    focusPull: "soften",
    colorShift: "warm-to-cool",
    letterbox: true,
  },

  // ═══ 9BIT — HARD CUT END ═════════════════════════════════════════

  {
    id: 12,
    line: "And finally, 9-bit is a gaming company and I don't like—",
    durationSeconds: 4.56,
    voiceSegments: [{ startMs: 52560, endMs: 57120 }],
    chibiEmotion: "tired",
    chibiAnimation: "dim",
    chibiEntrance: "bottom",
    chibiExit: "snap-vanish",
    chibiExpressions: [
      { emotion: "tired", atFrame: 0 },
      { emotion: "panic", atFrame: 60 },
    ],
    background: { ...BG_9BIT },
    projectDataCard: { ...NINEBIT_CARD },
    captionMode: "quiet",
    wordHighlights: [
      { word: "like—", color: COLORS.PAIN_RED, scale: 1.3 },
    ],
    sfx: [],
    transitionIn: "cut",
    musicState: "silence",
    // Camera: hard cut + dramatic
    breathingPulse: true,
    focusPull: "soften",
    letterbox: true,
  },
];
