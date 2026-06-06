/**
 * walkthroughData — the beat timeline the engine plays.
 *
 * A step is a sequence of BEATS, each a real micro-action: the cursor glides to a
 * control, clicks (with a pulse on the control), the screen STATE changes (the
 * screenshot swaps) behind a Chrome page-load bar, a field is typed in the app's
 * OWN font, a figure rolls (masked with the real background), an on-chain action
 * pops a WalletConnect→Fireblocks approval the cursor walks through, and the
 * lower-third caption changes IN SYNC. CHOREO is hand-authored against the
 * captured manifest (walkthrough-video.json: screens + named target rects +
 * each target's computed style).
 */

import manifest from "../../../public/walkthrough/taker/walkthrough-video.json";
import { toCanvas, toCanvasPoint, WINDOW_CENTER, type Rect, type Point } from "./geometry";
import { FIREBLOCKS_APPROVE_POINT } from "./FireblocksPage";
import { APP_FONT } from "./appFont";

export type { Rect, Point } from "./geometry";
export { VIEWPORT } from "./geometry";

export const FPS = 30;

// ─── Manifest types ──────────────────────────────────────────────────────────

type CapturedStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  letterSpacing?: string;
  textAlign?: "left" | "right" | "center";
  background?: string;
};
type TargetEntry = Rect & { style?: CapturedStyle };
type ManifestScreen = { id: string; image: string; targets: Record<string, TargetEntry> };
type ManifestStep = { name: string; screens: ManifestScreen[] };
const STEP_BY_NAME: Record<string, ManifestStep> = Object.fromEntries(
  (manifest.steps as ManifestStep[]).map((s) => [s.name, s]),
);

/** A captured style, with the app face swapped for the loaded Hanken handle. */
export type OverlayStyle = CapturedStyle;

// ─── Authoring DSL ───────────────────────────────────────────────────────────

type Side = "left" | "right" | "top" | "bottom";
type WalletSpec = { action: string; rows: { label: string; value: string }[] };
type RawBeat = {
  screen: number;
  caption: string;
  cursorTo?: string;
  click?: boolean;
  type?: { target: string; value: string };
  roll?: { target: string; to: number; prefix?: string; suffix?: string; decimals?: number };
  callout?: { target: string; label: string; side: Side };
  fireblocks?: WalletSpec; // switch the browser to the Fireblocks console & approve
  loading?: boolean;
  hold: number;
};
type RawStep = { name: string; title: string; url: string; beats: RawBeat[] };

// ─── Timing constants (frames @ 30fps) ───────────────────────────────────────

const MOVE = 24;
const CLICK_GAP = 5;
const AFTER = 8;
const NOCLICK_GAP = 3;
const CALLOUT_DELAY = 6;
const LOAD = 34;
const CLICK_LOAD = 18;
const ROLL = 26;
const typeDur = (v: string) => Math.max(18, v.length * 2);
// Fireblocks-approval beat: the browser switches to the Fireblocks console (a
// new page → a page load), the cursor glides to Approve and presses it.
const FB_LOAD = LOAD; // the Fireblocks tab loads (white + nav bar)
const FB_CURSOR = FB_LOAD + 6; // cursor begins gliding to Approve after load
const FB_APPROVE = FB_CURSOR + MOVE + CLICK_GAP;
const FB_CONFIRMED = FB_APPROVE + 26;

// ─── The choreography ────────────────────────────────────────────────────────

const NET = "Sonic testnet";
const CHOREO: RawStep[] = [
  {
    name: "collateral",
    title: "Fund your balance",
    url: "app.crxfx.com/collateral",
    beats: [
      { screen: 0, caption: "Your collateral — ready to post as margin.", loading: true, callout: { target: "total", label: "Posted, haircut-adjusted", side: "bottom" }, hold: 42 },
      { screen: 0, caption: "Deposit adds more, anytime.", cursorTo: "deposit", click: true, hold: 26 },
    ],
  },
  {
    name: "counterparty",
    title: "Pick your counterparty",
    url: "app.crxfx.com/counterparties",
    beats: [
      { screen: 0, caption: "Pick the one desk you'll trade with.", loading: true, cursorTo: "select", click: true, hold: 16 },
      { screen: 1, caption: "It moves no money — one on-chain flag.", callout: { target: "noMoney", label: "No funds move", side: "left" }, cursorTo: "confirm", click: true, hold: 14 },
      { screen: 1, caption: "Approve it in the Fireblocks console.", fireblocks: { action: "Allocate counterparty", rows: [{ label: "Network", value: NET }, { label: "Contract", value: "CRX" }, { label: "Function", value: "preAllocate" }, { label: "Counterparty", value: "Meridian FX" }, { label: "Fee", value: "~$0.00" }] }, hold: 20 },
      { screen: 2, caption: "Allocated — that desk is now live.", callout: { target: "locked", label: "Your posted margin", side: "bottom" }, hold: 34 },
    ],
  },
  {
    name: "amount",
    title: "Say what to hedge",
    url: "app.crxfx.com/hedge",
    beats: [
      { screen: 0, caption: "Start a hedge — what do you owe?", loading: true, cursorTo: "amount", click: true, hold: 10 },
      { screen: 0, caption: "Type the amount you owe.", type: { target: "amount", value: "1,000,000" }, hold: 20 },
      { screen: 1, caption: "Your locked value, live.", callout: { target: "hero", label: "Locked value, live", side: "left" }, hold: 26 },
      { screen: 1, caption: "Set your settle date next.", cursorTo: "next", click: true, hold: 10 },
    ],
  },
  {
    name: "date",
    title: "Choose the settle date",
    url: "app.crxfx.com/hedge",
    beats: [
      { screen: 0, caption: "Pick when it settles.", cursorTo: "settles", callout: { target: "settles", label: "Your settle date", side: "top" }, hold: 28 },
      { screen: 0, caption: "Ask the desk for a firm quote.", cursorTo: "getquote", click: true, hold: 10 },
    ],
  },
  {
    name: "quote",
    title: "Get a firm quote",
    url: "app.crxfx.com/hedge",
    beats: [
      { screen: 0, caption: "Your maker is pricing the rate…", hold: 40 },
      { screen: 1, caption: "A firm rate comes back.", callout: { target: "rate", label: "The firm rate", side: "left" }, hold: 24 },
      { screen: 1, caption: "Lock it before it expires.", cursorTo: "lock", click: true, hold: 12 },
      { screen: 1, caption: "Sign & bind in the Fireblocks console.", fireblocks: { action: "Sign & bind trade", rows: [{ label: "Network", value: NET }, { label: "Pair", value: "USD/INR" }, { label: "Notional", value: "$1,000,000" }, { label: "Rate", value: "84.1970" }, { label: "Function", value: "openAndBind" }] }, hold: 20 },
    ],
  },
  {
    name: "locked",
    title: "Your rate is locked",
    url: "app.crxfx.com/hedge",
    beats: [
      { screen: 0, caption: "Locked — settles in USDC, whatever the market does.", loading: true, cursorTo: "hero", callout: { target: "hero", label: "Locked", side: "left" }, hold: 50 },
    ],
  },
  {
    name: "positions",
    title: "Watch the position",
    url: "app.crxfx.com/positions",
    beats: [
      { screen: 0, caption: "Watch it live — locked rate vs the mark.", loading: true, callout: { target: "pnl", label: "Live P&L", side: "left" }, hold: 28 },
      { screen: 0, caption: "Margin health, live.", cursorTo: "health", callout: { target: "health", label: "Healthy", side: "bottom" }, hold: 28 },
    ],
  },
  {
    name: "position-detail",
    title: "The full position",
    url: "app.crxfx.com/positions/usd-inr",
    beats: [
      { screen: 0, caption: "Open one for the full position.", loading: true, callout: { target: "pnl", label: "What you stand to get", side: "left" }, hold: 40 },
    ],
  },
  {
    name: "settled",
    title: "It settles itself",
    url: "app.crxfx.com/activity",
    beats: [
      { screen: 0, caption: "At maturity it settles itself.", loading: true, callout: { target: "settled", label: "Settled at the fixing", side: "right" }, hold: 46 },
    ],
  },
];

// ─── Resolved (canvas-space, frame-timed) ────────────────────────────────────

export type ResolvedBeat = {
  image: string;
  url: string;
  caption: string;
  len: number;
  loadBar?: { dur: number };
  whiteFlash?: boolean; // a navigation → flash the content white, then reveal
  cursor?: { from: Point; to: Point; startFrame: number; moveDuration: number; clickFrame?: number };
  clickPulse?: { rect: Rect; atFrame: number };
  type?: { rect: Rect; value: string; startFrame: number; dur: number; style?: OverlayStyle };
  roll?: { rect: Rect; to: number; startFrame: number; dur: number; prefix?: string; suffix?: string; decimals: number; style?: OverlayStyle };
  callout?: { rect: Rect; label: string; side: Side; appearFrame: number; index: number };
  // A Fireblocks-console approval: the browser shows console.fireblocks.io and
  // the cursor (the normal `cursor` field, single leg) presses Approve.
  fireblocks?: { action: string; rows: { label: string; value: string }[]; approveFrame: number; confirmedFrame: number };
};

export type ResolvedStep = { name: string; title: string; durationInFrames: number; beats: ResolvedBeat[] };

let prevPoint: Point = WINDOW_CENTER;
let prevImage = "";

const resolveStep = (raw: RawStep): ResolvedStep => {
  const m = STEP_BY_NAME[raw.name];
  const beats: ResolvedBeat[] = raw.beats.map((b, bi) => {
    const screen = m.screens[b.screen];
    const targets = screen.targets;
    const rectOf = (name: string): Rect => toCanvas(targets[name]);
    const pointOf = (name: string): Point => toCanvasPoint(targets[name]);
    // Captured style, with the app face swapped for the loaded Hanken handle so
    // the overlay renders in the same glyphs as the screenshot.
    const styleOf = (name: string): OverlayStyle | undefined => {
      const s = targets[name]?.style;
      return s ? { ...s, fontFamily: APP_FONT } : undefined;
    };

    // ── Fireblocks-console approval: the browser switches to a NEW page. ──
    if (b.fireblocks) {
      const cursor = { from: prevPoint, to: FIREBLOCKS_APPROVE_POINT, startFrame: FB_CURSOR, moveDuration: MOVE, clickFrame: FB_APPROVE };
      prevPoint = FIREBLOCKS_APPROVE_POINT;
      prevImage = ""; // leaving the app page entirely → the next app screen reloads
      return {
        image: "",
        url: "console.fireblocks.io",
        caption: b.caption,
        len: FB_CONFIRMED + b.hold,
        loadBar: { dur: FB_LOAD },
        whiteFlash: true,
        cursor,
        fireblocks: { action: b.fireblocks.action, rows: b.fireblocks.rows, approveFrame: FB_APPROVE, confirmedFrame: FB_CONFIRMED },
      };
    }

    const isNav = prevImage !== "" && screen.image !== prevImage;
    const loadDur = b.loading ? LOAD : isNav ? CLICK_LOAD : 0;
    const isFirstOnPage = b.loading || isNav;
    prevImage = screen.image;

    const a = loadDur;
    const lead = b.cursorTo ? MOVE : 0;
    const clickFrame = b.click ? a + lead + CLICK_GAP : undefined;
    const actionStart = a + lead + (b.click ? AFTER : NOCLICK_GAP);

    const to = b.cursorTo ? pointOf(b.cursorTo) : prevPoint;
    const cursor = { from: prevPoint, to, startFrame: a, moveDuration: MOVE, clickFrame };
    prevPoint = to;

    const clickPulse = b.cursorTo && b.click ? { rect: rectOf(b.cursorTo), atFrame: clickFrame! } : undefined;

    let actionDur = b.click ? 12 : 0;
    let type: ResolvedBeat["type"];
    if (b.type) {
      const d = typeDur(b.type.value);
      type = { rect: rectOf(b.type.target), value: b.type.value, startFrame: actionStart, dur: d, style: styleOf(b.type.target) };
      actionDur = Math.max(actionDur, d);
    }
    let roll: ResolvedBeat["roll"];
    if (b.roll) {
      roll = { rect: rectOf(b.roll.target), to: b.roll.to, startFrame: actionStart, dur: ROLL, prefix: b.roll.prefix, suffix: b.roll.suffix, decimals: b.roll.decimals ?? 0, style: styleOf(b.roll.target) };
      actionDur = Math.max(actionDur, ROLL);
    }
    let callout: ResolvedBeat["callout"];
    if (b.callout) {
      callout = { rect: rectOf(b.callout.target), label: b.callout.label, side: b.callout.side, appearFrame: actionStart + CALLOUT_DELAY, index: bi + 1 };
      actionDur = Math.max(actionDur, 22);
    }

    return {
      image: screen.image,
      url: raw.url,
      caption: b.caption,
      len: actionStart + actionDur + b.hold,
      loadBar: loadDur > 0 ? { dur: loadDur } : undefined,
      whiteFlash: isFirstOnPage,
      cursor,
      clickPulse,
      type,
      roll,
      callout,
    };
  });

  return { name: raw.name, title: raw.title, durationInFrames: beats.reduce((s, b) => s + b.len, 0), beats };
};

export const STEPS: ResolvedStep[] = CHOREO.map(resolveStep);

export const TOTAL_FRAMES = STEPS.reduce((s, st) => s + st.durationInFrames, 0);
