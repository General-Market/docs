/**
 * walkthroughData — the beat timeline the engine plays.
 *
 * A step is no longer one static screenshot. It is a sequence of BEATS, each a
 * real micro-action: the cursor glides to a control, clicks, the screen STATE
 * changes (the screenshot swaps), a field is typed, a figure rolls, a popup
 * springs, a page-load bar sweeps — and the lower-third caption changes IN SYNC
 * with the action. The choreography (CHOREO) is hand-authored against the
 * captured manifest (walkthrough-video.json): each step's screens + named target
 * rects. resolveStep() turns it into absolute, canvas-space, frame-timed beats.
 */

import manifest from "../../../public/walkthrough/taker/walkthrough-video.json";
import {
  toCanvas,
  toCanvasPoint,
  WINDOW_CENTER,
  type Rect,
  type Point,
} from "./geometry";

export type { Rect, Point } from "./geometry";
export { VIEWPORT } from "./geometry";

export const FPS = 30;

// ─── Manifest types ──────────────────────────────────────────────────────────

type ManifestScreen = { id: string; image: string; targets: Record<string, Rect> };
type ManifestStep = { name: string; screens: ManifestScreen[] };
const STEP_BY_NAME: Record<string, ManifestStep> = Object.fromEntries(
  (manifest.steps as ManifestStep[]).map((s) => [s.name, s]),
);

// ─── Authoring DSL ───────────────────────────────────────────────────────────

type Side = "left" | "right" | "top" | "bottom";
type RawBeat = {
  screen: number; // index into the step's screens
  caption: string; // lower-third sub-line, synced to this beat
  cursorTo?: string; // target name on screens[screen] — the cursor destination
  click?: boolean; // ripple on arrival
  type?: { target: string; value: string; prefix?: string };
  roll?: { target: string; to: number; prefix?: string; suffix?: string; decimals?: number };
  callout?: { target: string; label: string; side: Side };
  loading?: boolean; // a browser page-load bar at the start of this beat
  hold: number; // frames held after the action completes
};
type RawStep = { name: string; title: string; beats: RawBeat[] };

// ─── Timing constants (frames @ 30fps) ───────────────────────────────────────

const MOVE = 24; // cursor glide to a target
const CLICK_GAP = 5; // click fires this long after arrival
const AFTER = 8; // post-click settle before the state change / overlay
const NOCLICK_GAP = 3; // settle when a beat doesn't click
const CALLOUT_DELAY = 6; // popup springs this long after the action starts
const LOAD = 34; // page-load bar duration
const ROLL = 26; // number count-up duration
const typeDur = (v: string) => Math.max(18, v.length * 2);

// ─── The choreography ────────────────────────────────────────────────────────

const CHOREO: RawStep[] = [
  {
    name: "collateral",
    title: "Fund your balance",
    beats: [
      { screen: 0, caption: "Your collateral — ready to post as margin.", loading: true, callout: { target: "total", label: "Posted, haircut-adjusted", side: "bottom" }, hold: 44 },
      { screen: 0, caption: "Deposit adds more, anytime.", cursorTo: "deposit", click: true, hold: 28 },
    ],
  },
  {
    name: "counterparty",
    title: "Pick your counterparty",
    beats: [
      { screen: 0, caption: "Pick the one desk you'll trade with.", loading: true, cursorTo: "select", click: true, hold: 18 },
      { screen: 1, caption: "It moves no money — one on-chain flag.", callout: { target: "noMoney", label: "No funds move", side: "left" }, cursorTo: "confirm", click: true, hold: 26 },
      { screen: 2, caption: "That desk is now your live counterparty.", callout: { target: "locked", label: "Your posted margin", side: "bottom" }, hold: 40 },
    ],
  },
  {
    name: "amount",
    title: "Say what to hedge",
    beats: [
      { screen: 0, caption: "Start a hedge — what do you owe?", loading: true, cursorTo: "amount", click: true, hold: 12 },
      { screen: 0, caption: "Type the amount you owe.", type: { target: "amount", value: "1,000,000", prefix: "$ " }, hold: 22 },
      { screen: 1, caption: "The locked value updates live.", roll: { target: "hero", to: 84315000, prefix: "₹" }, hold: 18 },
      { screen: 1, caption: "Next.", cursorTo: "next", click: true, hold: 12 },
    ],
  },
  {
    name: "date",
    title: "Choose the settle date",
    beats: [
      { screen: 0, caption: "Pick when it settles.", cursorTo: "settles", callout: { target: "settles", label: "Your settle date", side: "top" }, hold: 30 },
      { screen: 0, caption: "Next.", cursorTo: "next", click: true, hold: 12 },
    ],
  },
  {
    name: "pick-desk",
    title: "One desk quotes you",
    beats: [
      { screen: 0, caption: "Confirm the desk that quotes you.", cursorTo: "meridian", click: true, callout: { target: "meridian", label: "One desk, directed", side: "top" }, hold: 36 },
    ],
  },
  {
    name: "quote",
    title: "Get a firm quote",
    beats: [
      { screen: 0, caption: "Your maker is pricing the rate…", hold: 42 },
      { screen: 1, caption: "A firm rate comes back.", roll: { target: "hero", to: 84197000, prefix: "₹" }, callout: { target: "rate", label: "The firm rate", side: "left" }, hold: 26 },
      { screen: 1, caption: "Lock it before it expires.", cursorTo: "lock", click: true, hold: 22 },
    ],
  },
  {
    name: "locked",
    title: "Your rate is locked",
    beats: [
      { screen: 0, caption: "Locked — settles in USDC, whatever the market does.", callout: { target: "hero", label: "Locked", side: "left" }, hold: 52 },
    ],
  },
  {
    name: "positions",
    title: "Watch the position",
    beats: [
      { screen: 0, caption: "Watch it live — locked rate vs the mark.", loading: true, callout: { target: "pnl", label: "Live P&L", side: "left" }, hold: 30 },
      { screen: 0, caption: "Margin health, live.", cursorTo: "health", callout: { target: "health", label: "Healthy", side: "bottom" }, hold: 30 },
    ],
  },
  {
    name: "position-detail",
    title: "The full position",
    beats: [
      { screen: 0, caption: "Open one for the full position.", loading: true, callout: { target: "pnl", label: "What you stand to get", side: "left" }, hold: 42 },
    ],
  },
  {
    name: "settled",
    title: "It settles itself",
    beats: [
      { screen: 0, caption: "At maturity it settles itself.", loading: true, callout: { target: "settled", label: "Settled at the fixing", side: "right" }, hold: 48 },
    ],
  },
];

// ─── Resolved (canvas-space, frame-timed) ────────────────────────────────────

export type ResolvedBeat = {
  image: string;
  caption: string;
  len: number; // frames this beat runs
  loadBar?: { dur: number };
  cursor: { from: Point; to: Point; startFrame: number; moveDuration: number; clickFrame?: number };
  type?: { rect: Rect; value: string; startFrame: number; dur: number; prefix?: string };
  roll?: { rect: Rect; to: number; startFrame: number; dur: number; prefix?: string; suffix?: string; decimals: number; fontSize: number };
  callout?: { rect: Rect; label: string; side: Side; appearFrame: number; index: number };
};

export type ResolvedStep = {
  name: string;
  title: string;
  durationInFrames: number;
  beats: ResolvedBeat[];
};

let prevPoint: Point = WINDOW_CENTER;

const resolveStep = (raw: RawStep): ResolvedStep => {
  const m = STEP_BY_NAME[raw.name];
  const beats: ResolvedBeat[] = raw.beats.map((b, bi) => {
    const targets = m.screens[b.screen].targets;
    const rectOf = (name: string): Rect => toCanvas(targets[name]);
    const pointOf = (name: string): Point => toCanvasPoint(targets[name]);

    const loadDur = b.loading ? LOAD : 0;
    const a = loadDur; // action phase begins after any page-load bar
    const lead = b.cursorTo ? MOVE : 0;
    const clickFrame = b.click ? a + lead + CLICK_GAP : undefined;
    const actionStart = a + lead + (b.click ? AFTER : NOCLICK_GAP);

    const to = b.cursorTo ? pointOf(b.cursorTo) : prevPoint;
    const cursor = { from: prevPoint, to, startFrame: a, moveDuration: MOVE, clickFrame };
    prevPoint = to;

    let actionDur = b.click ? 12 : 0;
    let type: ResolvedBeat["type"];
    if (b.type) {
      const d = typeDur(b.type.value);
      type = { rect: rectOf(b.type.target), value: b.type.value, startFrame: actionStart, dur: d, prefix: b.type.prefix };
      actionDur = Math.max(actionDur, d);
    }
    let roll: ResolvedBeat["roll"];
    if (b.roll) {
      const rect = rectOf(b.roll.target);
      roll = { rect, to: b.roll.to, startFrame: actionStart, dur: ROLL, prefix: b.roll.prefix, suffix: b.roll.suffix, decimals: b.roll.decimals ?? 0, fontSize: Math.round(rect.h * 0.82) };
      actionDur = Math.max(actionDur, ROLL);
    }
    let callout: ResolvedBeat["callout"];
    if (b.callout) {
      callout = { rect: rectOf(b.callout.target), label: b.callout.label, side: b.callout.side, appearFrame: actionStart + CALLOUT_DELAY, index: bi + 1 };
      actionDur = Math.max(actionDur, 22);
    }

    const len = actionStart + actionDur + b.hold;
    return { image: m.screens[b.screen].image, caption: b.caption, len, loadBar: b.loading ? { dur: loadDur } : undefined, cursor, type, roll, callout };
  });

  return { name: raw.name, title: raw.title, durationInFrames: beats.reduce((s, b) => s + b.len, 0), beats };
};

export const STEPS: ResolvedStep[] = CHOREO.map(resolveStep);

export const TOTAL_FRAMES = STEPS.reduce((s, st) => s + st.durationInFrames, 0);
