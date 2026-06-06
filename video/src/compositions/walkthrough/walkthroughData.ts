/**
 * walkthroughData — the beat timeline the engine plays.
 *
 * A step is a sequence of BEATS, each a real micro-action: the cursor glides to a
 * control, presses it (a click pulse + cursor dip), and the screen STATE changes
 * behind a white page-load. The browser carries two TABS — CRX and Fireblocks —
 * and an on-chain action is approved by clicking the Fireblocks tab, approving in
 * the real console, then clicking back to the CRX tab. A field types in the app's
 * own font; the lower-third caption changes IN SYNC with each action. CHOREO is
 * hand-authored against the captured manifest (walkthrough-video.json: screens +
 * named target rects + each target's computed style).
 */

import manifest from "../../../public/walkthrough/taker/walkthrough-video.json";
import { toCanvas, toCanvasPoint, WINDOW_CENTER, type Rect, type Point } from "./geometry";
import { FIREBLOCKS_APPROVE_POINT } from "./FireblocksPage";
import { tabCenter } from "./BrowserChrome";
import { APP_FONT } from "./appFont";

export type { Rect, Point } from "./geometry";
export { VIEWPORT } from "./geometry";

export const FPS = 30;

// The two browser tabs. Index 0 = the CRX app, 1 = the Fireblocks console.
export const CRX_TAB = tabCenter(0, 2);
export const FB_TAB = tabCenter(1, 2);

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
  callout?: { target: string; label: string; side: Side };
  fireblocks?: WalletSpec; // click the Fireblocks tab, approve in the console
  loading?: boolean;
  hold: number;
};
type RawStep = { name: string; title: string; url: string; beats: RawBeat[] };

// ─── Timing (frames @ 30fps) — uniform so every click feels the same ─────────

const MOVE = 22; // cursor glide to a control (a touch quicker = snappier)
const CLICK_GAP = 4; // press lands this soon after arrival
const SETTLE = 7; // beat holds this long after the press before the cut
const WHITE = 12; // white page-load veil
const TAB_HOLD = 6; // beat holds after a tab click before the page swaps
const CALLOUT_DELAY = 5;
const ROLL_NA = 0;
const typeDur = (v: string) => Math.max(16, v.length * 2);
// Fireblocks approval timeline (within the fireblocks beat).
const FB_TAB_CLICK = MOVE + CLICK_GAP; // click the Fireblocks tab
const FB_PAGE = FB_TAB_CLICK + TAB_HOLD; // console paints (white-load)
const FB_APPROVE = FB_PAGE + WHITE + MOVE + CLICK_GAP; // glide to Approve & press
const FB_CONFIRMED = FB_APPROVE + 24;
void ROLL_NA;

// ─── The choreography ────────────────────────────────────────────────────────

const NET = "Sonic testnet";
const CHOREO: RawStep[] = [
  {
    name: "collateral",
    title: "Fund your balance",
    url: "app.crxfx.com/collateral",
    beats: [
      { screen: 0, caption: "Your collateral — ready to post as margin.", loading: true, callout: { target: "total", label: "Posted, haircut-adjusted", side: "bottom" }, hold: 40 },
      { screen: 0, caption: "Deposit adds more, anytime.", cursorTo: "deposit", click: true, hold: 14 },
    ],
  },
  {
    name: "counterparty",
    title: "Pick your counterparty",
    url: "app.crxfx.com/counterparties",
    beats: [
      { screen: 0, caption: "Pick the one desk you'll trade with.", loading: true, cursorTo: "select", click: true, hold: 14 },
      { screen: 1, caption: "It moves no money — one on-chain flag.", callout: { target: "noMoney", label: "No funds move", side: "left" }, cursorTo: "confirm", click: true, hold: 14 },
      { screen: 1, caption: "Approve it in your Fireblocks console.", fireblocks: { action: "Allocate counterparty", rows: [{ label: "Network", value: NET }, { label: "Contract", value: "CRX" }, { label: "Function", value: "preAllocate" }, { label: "Counterparty", value: "Meridian FX" }, { label: "Fee", value: "~$0.00" }] }, hold: 18 },
      { screen: 2, caption: "Allocated — that desk is now live.", loading: true, callout: { target: "locked", label: "Your posted margin", side: "bottom" }, hold: 32 },
    ],
  },
  {
    name: "amount",
    title: "Say what to hedge",
    url: "app.crxfx.com/new-hedge",
    beats: [
      { screen: 0, caption: "Start a hedge — what do you owe?", loading: true, cursorTo: "amount", click: true, hold: 8 },
      { screen: 0, caption: "Type the amount you owe.", type: { target: "amount", value: "1,000,000" }, hold: 18 },
      { screen: 1, caption: "Your locked value, live.", callout: { target: "hero", label: "Locked value, live", side: "left" }, hold: 24 },
      { screen: 1, caption: "Now set the settle date.", cursorTo: "next", click: true, hold: 8 },
    ],
  },
  {
    name: "date",
    title: "Choose the settle date",
    url: "app.crxfx.com/new-hedge",
    beats: [
      { screen: 0, caption: "Pick the day it settles.", loading: true, cursorTo: "day", click: true, hold: 10 },
      { screen: 1, caption: "Settles June 24.", callout: { target: "settles", label: "Your settle date", side: "top" }, hold: 22 },
      { screen: 1, caption: "Ask the desk for a firm quote.", cursorTo: "getquote", click: true, hold: 8 },
    ],
  },
  {
    name: "quote",
    title: "Get a firm quote",
    url: "app.crxfx.com/new-hedge",
    beats: [
      { screen: 0, caption: "Your maker is pricing the rate…", loading: true, hold: 36 },
      { screen: 1, caption: "A firm rate comes back.", callout: { target: "rate", label: "The firm rate", side: "left" }, hold: 22 },
      { screen: 1, caption: "Lock it before it expires.", cursorTo: "lock", click: true, hold: 10 },
      { screen: 1, caption: "Sign & bind in your Fireblocks console.", fireblocks: { action: "Sign & bind trade", rows: [{ label: "Network", value: NET }, { label: "Pair", value: "USD/INR" }, { label: "Notional", value: "$1,000,000" }, { label: "Rate", value: "84.1970" }, { label: "Function", value: "openAndBind" }] }, hold: 18 },
    ],
  },
  {
    name: "locked",
    title: "Your rate is locked",
    url: "app.crxfx.com/new-hedge",
    beats: [
      { screen: 0, caption: "Locked — settles in USDC, whatever the market does.", loading: true, cursorTo: "hero", callout: { target: "hero", label: "Locked", side: "left" }, hold: 48 },
    ],
  },
  {
    name: "positions",
    title: "Watch the position",
    url: "app.crxfx.com/positions",
    beats: [
      { screen: 0, caption: "Watch it live — locked rate vs the mark.", loading: true, callout: { target: "pnl", label: "Live P&L", side: "left" }, hold: 26 },
      { screen: 0, caption: "Margin health, live.", cursorTo: "health", callout: { target: "health", label: "Healthy", side: "bottom" }, hold: 28 },
    ],
  },
  {
    name: "settled",
    title: "It settles itself",
    url: "app.crxfx.com/activity",
    beats: [
      { screen: 0, caption: "At maturity it settles itself.", loading: true, callout: { target: "settled", label: "Settled at the fixing", side: "right" }, hold: 44 },
    ],
  },
];

// ─── Resolved (canvas-space, frame-timed) ────────────────────────────────────

type Leg = { from: Point; to: Point; startFrame: number; moveDuration: number; clickFrame?: number };

export type ResolvedBeat = {
  image: string;
  url: string;
  caption: string;
  len: number;
  activeTab: 0 | 1; // which browser tab is in front (0 CRX, 1 Fireblocks)
  loadBar?: { dur: number; at: number };
  whiteFlash?: { at: number };
  tabLeg?: Leg; // a first cursor leg that clicks a tab to switch pages
  cursor?: Leg; // the main cursor leg
  clickPulse?: { rect: Rect; atFrame: number };
  type?: { rect: Rect; value: string; startFrame: number; dur: number; style?: OverlayStyle };
  callout?: { rect: Rect; label: string; side: Side; appearFrame: number; index: number };
  fireblocks?: { action: string; rows: { label: string; value: string }[]; approveFrame: number; confirmedFrame: number };
};

export type ResolvedStep = { name: string; title: string; durationInFrames: number; beats: ResolvedBeat[] };

let prevPoint: Point = WINDOW_CENTER;
let prevImage = "";
let prevTab: 0 | 1 = 0;

const resolveStep = (raw: RawStep): ResolvedStep => {
  const m = STEP_BY_NAME[raw.name];
  const beats: ResolvedBeat[] = raw.beats.map((b, bi) => {
    const screen = m.screens[b.screen];
    const targets = screen.targets;
    const rectOf = (name: string): Rect => toCanvas(targets[name]);
    const pointOf = (name: string): Point => toCanvasPoint(targets[name]);
    const styleOf = (name: string): OverlayStyle | undefined => {
      const s = targets[name]?.style;
      return s ? { ...s, fontFamily: APP_FONT } : undefined;
    };

    // ── Fireblocks approval: click the Fireblocks tab → console → Approve. ──
    if (b.fireblocks) {
      const tabLeg: Leg = { from: prevPoint, to: FB_TAB, startFrame: 0, moveDuration: MOVE, clickFrame: FB_TAB_CLICK };
      const cursor: Leg = { from: FB_TAB, to: FIREBLOCKS_APPROVE_POINT, startFrame: FB_PAGE + WHITE, moveDuration: MOVE, clickFrame: FB_APPROVE };
      prevPoint = FIREBLOCKS_APPROVE_POINT;
      prevImage = ""; // the next CRX page reloads after we tab back
      prevTab = 1;
      return {
        image: "",
        url: "console.fireblocks.io",
        caption: b.caption,
        len: FB_CONFIRMED + b.hold,
        activeTab: 1,
        whiteFlash: { at: FB_PAGE },
        loadBar: { dur: WHITE + 18, at: FB_PAGE },
        tabLeg,
        cursor,
        fireblocks: { action: b.fireblocks.action, rows: b.fireblocks.rows, approveFrame: FB_APPROVE, confirmedFrame: FB_CONFIRMED },
      };
    }

    // Returning to the CRX tab after a Fireblocks approval is a real click too.
    const needTabBack = prevTab === 1;
    const tabBack: Leg | undefined = needTabBack
      ? { from: prevPoint, to: CRX_TAB, startFrame: 0, moveDuration: MOVE, clickFrame: FB_TAB_CLICK }
      : undefined;
    const base = needTabBack ? FB_TAB_CLICK + TAB_HOLD : 0; // page work begins after the tab-back

    const isNav = prevImage !== "" && screen.image !== prevImage;
    const showLoad = b.loading || isNav || needTabBack;
    prevImage = screen.image;
    prevTab = 0;

    const flashAt = base;
    const loadStart = base;
    const a = base + (showLoad ? WHITE : 0); // action begins after the white-load
    const lead = b.cursorTo ? MOVE : 0;
    const clickFrame = b.click ? a + lead + CLICK_GAP : undefined;
    const actionStart = a + lead + (b.click ? SETTLE : 0);

    const fromPoint = needTabBack ? CRX_TAB : prevPoint;
    const to = b.cursorTo ? pointOf(b.cursorTo) : fromPoint;
    const cursor: Leg = { from: fromPoint, to, startFrame: a, moveDuration: MOVE, clickFrame };
    prevPoint = to;

    const clickPulse = b.cursorTo && b.click ? { rect: rectOf(b.cursorTo), atFrame: clickFrame! } : undefined;

    let actionDur = b.click ? SETTLE : 0;
    let type: ResolvedBeat["type"];
    if (b.type) {
      const d = typeDur(b.type.value);
      type = { rect: rectOf(b.type.target), value: b.type.value, startFrame: actionStart, dur: d, style: styleOf(b.type.target) };
      actionDur = Math.max(actionDur, d);
    }
    let callout: ResolvedBeat["callout"];
    if (b.callout) {
      callout = { rect: rectOf(b.callout.target), label: b.callout.label, side: b.callout.side, appearFrame: actionStart + CALLOUT_DELAY, index: bi + 1 };
      actionDur = Math.max(actionDur, 20);
    }

    return {
      image: screen.image,
      url: raw.url,
      caption: b.caption,
      len: actionStart + actionDur + b.hold,
      activeTab: 0,
      whiteFlash: showLoad ? { at: flashAt } : undefined,
      loadBar: showLoad ? { dur: WHITE + 14, at: loadStart } : undefined,
      tabLeg: tabBack,
      cursor,
      clickPulse,
      type,
      callout,
    };
  });

  return { name: raw.name, title: raw.title, durationInFrames: beats.reduce((s, b) => s + b.len, 0), beats };
};

export const STEPS: ResolvedStep[] = CHOREO.map(resolveStep);

export const TOTAL_FRAMES = STEPS.reduce((s, st) => s + st.durationInFrames, 0);
