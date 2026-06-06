/**
 * FireblocksPage — a faithful recreation of the real Fireblocks web console
 * (console.fireblocks.io/v2) Transaction History view with the Recent activity
 * panel open, as a FULL browser page.
 *
 * Rebuilt 1:1 against real product references (June 2026):
 *   • Console screenshots — kevinsmall.dev/web3/fireblocks-101 (sandbox console:
 *     white sidebar, #F6F6F6 body, blue "+ Transfer" pill #3F74EA, the nav order
 *     Accounts / Assets / NFTs / Staking / Swap ÷ Tokenization / Whitelisted
 *     addresses / Fireblocks Network / Web3 access ÷ Transaction history, the
 *     #DFE8FD active-item pill, the near-black #010C38 activity toggle).
 *   • Help Center art — support.fireblocks.io article 5864261395996 "Reviewing
 *     transaction details (Recent Activity and Transaction History)": the dark
 *     #030C37 Recent activity panel, #182146 transaction cards with the
 *     source›destination chevron band (#202648), the Direction/Account/Asset/
 *     Status filter pills, the status-color system (yellow = pending on
 *     Fireblocks, blue = pending outside, green = complete) with the per-card
 *     progress bar (#BADFB1 when complete); article 360016614180 "Creating new
 *     transfers": the Transaction History table (blue column heads, Source /
 *     Destination / Amount / Asset / Status / Created At, dot+label statuses,
 *     teal-green #00B29C "Completed").
 *   • Official brand kit (fireblocks.com/brandkit, 2025): the exact logo lockup
 *     SVG paths (rounded square + knocked-out triangle + wordmark), Network
 *     Navy #212647, Bandwidth Blue #678BFF, Genesis Grey #F9FAFC, Token Gold
 *     #FFC64E.
 *   • Mobile approval screen (fireblocks-101-4.png): the Deny ✕ (outlined) /
 *     Approve ✓ (filled blue) button pair.
 *   • Console status wording: "Pending Authorization" (developers.fireblocks.com
 *     /reference/statuses) and "Transaction Authorization Policy" (TAP).
 *
 * Everything that moves is a pure function of useCurrentFrame() — no CSS
 * @keyframes — so Studio and a headless render draw the identical frame:
 *   approveFrame   → the Approve button dips and brightens (the press);
 *   approving      → a frame-driven spinner ("Approving…"), Deny dims;
 *   confirmedFrame → the button flips green with a check ("Approved"), the
 *                    statuses flip green, the card progress bar fills.
 *
 * The Approve button center is computed from the same layout constants the
 * card lays out with and exported, mapped to canvas space, so the cursor
 * target can never drift from what is drawn.
 */

import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { SCREEN_LEFT, SCREEN_TOP, SCREEN_W, SCREEN_H } from "./geometry";

// ── Palette — measured from console screenshots + official brand kit ──────────
const BODY_BG = "#F6F6F6"; // console body (sampled)
const SIDEBAR_BG = "#FFFFFF"; // left nav (sampled)
const HAIRLINE = "#E8E9EE";
const INK = "#1C2030"; // primary dark text
const INK_SOFT = "#3F4654"; // nav labels
const ICON_GREY = "#8A8F9D";
const NAVY = "#212647"; // brand Network Navy (logo)
const FB_BLUE = "#3F74EA"; // Transfer button / primary action (sampled)
const NAV_ACTIVE_BG = "#DFE8FD"; // active nav pill (sampled)
const NAV_ACTIVE_TX = "#29499E"; // active nav text (sampled wordmark blue)
const TABLE_HEAD = "#4068AE"; // blue column heads (sampled)
const VALUE_BLUE = "#4068AE"; // amount / asset cell text (sampled)
const CELL_GREY = "#8A98A8"; // Created At (sampled)
const GREEN = "#00B29C"; // "Completed" teal-green (sampled)
const PENDING_Y = "#E0A114"; // pending status on white
const BLUE_STATUS = "#4A78E8"; // "pending outside Fireblocks" blue
const AVATAR_ORANGE = "#F2A93B"; // console avatar (sampled)

// Recent activity panel (all sampled from Help Center screenshots)
const PANEL_BG = "#030C37";
const CARD_BG = "#182146";
const BAND_BG = "#202648";
const BADGE_BG = "#2B3356";
const PANEL_TX = "#FFFFFF";
const PANEL_SUBT = "#8A93B4";
const PANEL_LINE = "rgba(255,255,255,0.10)";
const GOLD = "#FFC64E"; // brand Token Gold — pending status in the dark panel
const GREEN_LIGHT = "#8DE3A0"; // completed text in the dark panel
const GREEN_BAR = "#BADFB1"; // completed progress bar (sampled)

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Layout (page-local, 0..1440 / 0..900) ─────────────────────────────────────
const SIDEBAR_W = 180;

const PANEL_W = 400;
const PANEL_LEFT = SCREEN_W - PANEL_W; // 1040
const PANEL_PAD = 20;

const CARD_TOP = 106;
const CARD_LEFT = PANEL_LEFT + PANEL_PAD; // 1060
const CARD_W = PANEL_W - PANEL_PAD * 2; // 360
const CARD_PAD = 14;
const CARD_H = 560;
const CARD_INNER = CARD_W - CARD_PAD * 2; // 332

const BTN_H = 42;
const BTN_GAP = 10;
const BTN_W = (CARD_INNER - BTN_GAP) / 2; // 161

// Bottom-anchored stack inside the card (card-relative tops)
const BTN_REL_TOP = CARD_H - CARD_PAD - BTN_H; // 504
const BAR_REL_TOP = BTN_REL_TOP - 12 - 3; // 489
const STATUS_REL_TOP = BAR_REL_TOP - 8 - 24; // 457
const TAP_REL_TOP = STATUS_REL_TOP - 10 - 50; // 397

// Approve = right footer button. Centre derived from the same numbers it draws.
const APPROVE_CX = CARD_LEFT + CARD_PAD + BTN_W + BTN_GAP + BTN_W / 2; // 1325.5
const APPROVE_CY = CARD_TOP + BTN_REL_TOP + BTN_H / 2; // 631

/** Canvas-space centre of the Approve button — aim the cursor here. */
export const FIREBLOCKS_APPROVE_POINT: { x: number; y: number } = {
  x: SCREEN_LEFT + APPROVE_CX, // 1565.5
  y: SCREEN_TOP + APPROVE_CY, // 731
};

/** Address-bar host for the browser chrome when this page is shown. */
export const FIREBLOCKS_URL = "console.fireblocks.io";

const PRESS_FRAMES = 7;

// ── Icons (thin line set, console-faithful) ───────────────────────────────────
type IconProps = { size?: number; color?: string; strokeWidth?: number };

const Ico = (d: string, vb = "0 0 24 24"): React.FC<IconProps> =>
  function Icon({ size = 17, color = ICON_GREY, strokeWidth = 1.6 }) {
    return (
      <svg width={size} height={size} viewBox={vb} fill="none" aria-hidden>
        <path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

// Left-nav set (one per real console item)
const AccountsI = Ico("M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z");
const AssetsI = Ico("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.5v9M9.5 9.8c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2");
const NftI = Ico("M4.5 5.5h15v13h-15ZM4.5 14.5 9 10l4.5 4.5 3-3 3 3M15.5 8.6h0");
const StakingI = Ico("M5 6.5c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5S15.9 9 12 9 5 7.9 5 6.5ZM5 6.5v11C5 18.9 8.1 20 12 20s7-1.1 7-2.5v-11M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5");
const SwapI = Ico("M7.5 9.5h11l-3.2-3.2M16.5 14.5h-11l3.2 3.2");
const TokenizationI = Ico("M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z");
const WhitelistI = Ico("M9.5 6h11M9.5 12h11M9.5 18h11M4 6.2l1.3 1.3L7.8 5M4 12.2l1.3 1.3 2.5-2.5M4 18.2l1.3 1.3L7.8 17");
const NetworkI = Ico("M12 4.5h0M19 9h0M19 15.5h0M12 20h0M5 15.5h0M5 9h0M12 4.5 19 9v6.5L12 20l-7-4.5V9Z");
const Web3I = Ico("M12 3.5 19.5 8v8L12 20.5 4.5 16V8ZM12 12l7.5-4M12 12v8.5M12 12 4.5 8");
const HistoryI = Ico("M5 4.5h14v15H5ZM8.5 9h7M8.5 12.5h7M8.5 16h4.5");

// Top-bar / panel set
const GearI = Ico(
  "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.1a2 2 0 1 1-4 0v-.04a1.7 1.7 0 0 0-2.87-1.26l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13.5h-.1a2 2 0 1 1 0-4h.04A1.7 1.7 0 0 0 5.8 6.63l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.04A1.7 1.7 0 0 0 11.6 2.6v-.1a2 2 0 1 1 4 0v.04a1.7 1.7 0 0 0 2.87 1.26l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04A1.7 1.7 0 0 0 21.4 9.5h.1a2 2 0 1 1 0 4h-.04a1.7 1.7 0 0 0-1.56 1.04Z",
);
const HelpI = Ico("M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM9.6 9.2c.3-1.2 1.3-2 2.6-2 1.5 0 2.6 1 2.6 2.3 0 2-2.4 2.1-2.4 3.8M12 16.8h0");
const SearchI = Ico("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4");
const FilterLinesI = Ico("M4 7h16M7 12h10M10 17h4");
const CollapseI = Ico("M4 12h12M12 7l4.5 5L12 17M20 5v14");
const FunnelI = Ico("M4 5h16l-6 7v6l-4-2v-4Z");
const RefreshI = Ico("M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4");
const DownloadI = Ico("M12 4v10M7.5 10.5 12 15l4.5-4.5M5 19h14");
const ShieldI = Ico("M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6ZM9 12l2 2 4-4");
const InfoI = Ico("M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 11v5M12 7.6h0");
const VaultMiniI = Ico("M4.5 5.5h15v13h-15ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z");
const GlobeMiniI = Ico("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z");
const ChevronRightI = Ico("M9 5l7 7-7 7");

// ── Fireblocks logo — the OFFICIAL 2025 lockup, exact brand-kit SVG paths ─────
// Source: fireblocks.com/brandkit → Logo.zip → Digital/Lockup/SVG.
// Rounded square with the knocked-out triangle + the full wordmark.
const LOCKUP_VB = "0 0 569.38 96";
const LOCKUP_PATHS: string[] = [
  // symbol — square + triangle knockout
  "M82,0H14C6.27,0,0,6.27,0,14v68c0,7.73,6.27,14,14,14h68c7.73,0,14-6.27,14-14V14c0-7.73-6.27-14-14-14ZM65.53,68H30.47c-3.87,0-6.27-4.2-4.31-7.53l17.61-29.99c1.94-3.3,6.71-3.29,8.63.02l17.45,29.99c1.94,3.33-.47,7.51-4.32,7.51Z",
  // e
  "M257.61,30.12c-15.59,0-24.36,9.56-24.36,26.52s8.77,26.5,24.36,26.5c11.58,0,20.26-4.93,23-15.81.22-.88-.46-1.74-1.35-1.74h-6.92c-.65,0-1.21.44-1.35,1.07-.59,2.52-3.08,8.68-13.38,8.68-7.53,0-12.91-4.93-14.39-13.68-.14-.85.52-1.63,1.38-1.63h35.98c.77,0,1.39-.62,1.39-1.39v-1.52c0-17.34-8.77-27-24.36-27ZM270.74,52.83h-26.15c-.86,0-1.52-.77-1.38-1.61,1.39-8.44,6.52-13.19,14.51-13.19s13.02,4.75,14.4,13.19c.14.85-.52,1.61-1.38,1.61Z",
  // r
  "M230.19,31.37h-5.26c-4.78,0-9.19,2.55-11.58,6.69-.66,1.16-2.43.68-2.43-.65v-4.71c0-.77-.62-1.39-1.39-1.39h-7.65c-.77,0-1.39.62-1.39,1.39v47.88c0,.77.62,1.39,1.39,1.39h7.65c.77,0,1.39-.62,1.39-1.39v-29.82c0-5.75,4.66-10.41,10.4-10.41h5.18c.47,0,.9-.26,1.13-.66l3.7-6.36c.51-.87-.12-1.95-1.13-1.95Z",
  // F
  "M169.45,13.97h-44.06c-.77,0-1.39.62-1.39,1.39v65.2c0,.77.62,1.39,1.39,1.39h7.73c.77,0,1.39-.62,1.39-1.39v-29.89c0-.72.59-1.3,1.3-1.3l24.58-.04c.42,0,.81-.18,1.07-.51l3.57-6.18c.75-.91.1-2.28-1.07-2.28h-21.31c-1.07,0-2.09.39-2.9,1.11-.96.86-2.23,1.99-2.82,2.52-.94.83-2.41.16-2.41-1.09v-18.1c0-.77.62-1.39,1.39-1.39h29.77c.47,0,.9-.25,1.13-.65l3.75-6.56c.7-.91.05-2.24-1.11-2.24Z",
  // c
  "M469.1,63.94h-7.29c-.64,0-1.18.43-1.34,1.04-1.54,6.08-6.08,9.49-12.54,9.49-9.16,0-14.63-6.34-14.63-17.84s5.36-17.84,14.63-17.84,11.78,6.53,12.45,9.11c.16.6.72,1.03,1.34,1.03h7.35c.88,0,1.54-.81,1.38-1.67-2.17-11.03-10.29-17.14-22.91-17.14-15.69,0-24.36,9.55-24.36,26.5s8.68,26.5,24.36,26.5c12.65,0,20.86-6.3,22.94-17.54.16-.86-.51-1.65-1.38-1.65Z",
  // k
  "M499.83,54.83h0c-.51-.57-.47-1.44.09-1.95l21.38-19.52c.81-.73.29-2.07-.81-2.07h-9.15c-.34,0-.68.13-.94.36l-19.34,17.67c-.65.6-1.7.13-1.7-.75V15.35c0-.77-.61-1.38-1.38-1.38h-7.38c-.77,0-1.38.61-1.38,1.38v65.24c0,.77.61,1.38,1.38,1.38h7.38c.77,0,1.38-.61,1.38-1.38v-21.08c0-.94,1.16-1.38,1.78-.68l20.13,22.68c.26.29.64.47,1.03.47h9.28c1.03,0,1.57-1.22.88-1.99l-22.64-25.16Z",
  // s
  "M549.89,52.07h0c-10.53-1.96-12.96-3.33-12.96-7.52s4.38-6.82,9.85-6.82c9.6,0,11.35,5.61,11.65,8.15.08.7.69,1.21,1.38,1.21h7.05c.82,0,1.46-.7,1.39-1.51-.78-9.71-8.39-15.44-21.47-15.44-11.7,0-19.78,5.65-19.78,14.82,0,7.79,4.1,12.86,19.88,15.5,10.92,1.76,12.37,3.6,12.37,7.9,0,4.78-4.19,7.21-11.01,7.21-10.36.01-12.04-6.18-12.27-8.94-.05-.73-.65-1.29-1.39-1.29h-7.12c-.81,0-1.46.69-1.39,1.5.79,11.41,9.72,16.33,21.96,16.33s21.34-5.46,21.34-15.39c0-8.57-4.29-12.76-19.49-15.69Z",
  // o
  "M391.98,30.12c-15.69,0-25.05,11.4-25.05,26.5s9.36,26.5,25.05,26.5,25.05-11.4,25.05-26.5-9.36-26.5-25.05-26.5ZM391.98,74.85c-10.04,0-14.72-7.7-14.72-18.23s4.67-18.23,14.72-18.23,14.72,7.7,14.72,18.23-4.67,18.23-14.72,18.23Z",
  // b
  "M318.71,30.21h0c-6.84.01-12.35,2.6-15.6,7.12-.55.75-1.74.35-1.74-.57V15.37c0-.77-.62-1.39-1.39-1.39h-7.35c-.77,0-1.39.62-1.39,1.39v65.2c0,.77.62,1.39,1.39,1.39h6.96c.77,0,1.39-.62,1.39-1.39v-5.46c0-.91,1.18-1.22,1.67-.46,3.27,5.15,8.89,8.39,15.87,8.39,13.84,0,22.31-9.75,22.31-26.41s-8.57-26.41-22.12-26.41ZM315.89,74.66c-9.07,0-14.43-6.92-14.43-18.03s5.36-18.13,14.43-18.13,14.63,7.01,14.63,18.13-5.46,18.03-14.63,18.03Z",
];
const LOCKUP_RECTS = [
  { x: 179.14, y: 31.29, width: 10.14, height: 50.68, rx: 1.39 }, // i stem
  { x: 178.71, y: 13.97, width: 10.98, height: 11.49, rx: 1.47 }, // i dot
  { x: 348.11, y: 13.97, width: 10.14, height: 67.99, rx: 1.39 }, // l
];

const FireblocksLogo: React.FC<{ height: number; color?: string }> = ({
  height,
  color = NAVY,
}) => (
  <svg
    width={(height * 569.38) / 96}
    height={height}
    viewBox={LOCKUP_VB}
    fill="none"
    aria-hidden
  >
    {LOCKUP_PATHS.map((d, i) => (
      <path key={i} d={d} fill={color} />
    ))}
    {LOCKUP_RECTS.map((r, i) => (
      <rect key={`r${i}`} {...r} ry={r.rx} fill={color} />
    ))}
  </svg>
);

// ── Frame-driven spinner (stroked arc rotated by frame) ───────────────────────
const Spinner: React.FC<{ size: number; frame: number; color: string }> = ({
  size,
  frame,
  color,
}) => {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: `rotate(${(frame * 16) % 360}deg)` }}
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={2.4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.3} ${c}`}
      />
    </svg>
  );
};

const Check: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12.5 10 17.5 19 7" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </svg>
);

// ── Left navigation rail (real console: white, narrow, grouped) ───────────────
type NavItem = { id: string; label: string; Icon: React.FC<IconProps>; active?: boolean };
const NAV_GROUPS: NavItem[][] = [
  [
    { id: "accounts", label: "Accounts", Icon: AccountsI },
    { id: "assets", label: "Assets", Icon: AssetsI },
    { id: "nfts", label: "NFTs", Icon: NftI },
    { id: "staking", label: "Staking", Icon: StakingI },
    { id: "swap", label: "Swap", Icon: SwapI },
  ],
  [
    { id: "tokenization", label: "Tokenization", Icon: TokenizationI },
    { id: "whitelisted", label: "Whitelisted addresses", Icon: WhitelistI },
    { id: "network", label: "Fireblocks Network", Icon: NetworkI },
    { id: "web3", label: "Web3 access", Icon: Web3I },
  ],
  [{ id: "history", label: "Transaction history", Icon: HistoryI, active: true }],
];

const Sidebar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: SIDEBAR_W,
      height: SCREEN_H,
      background: SIDEBAR_BG,
      borderRight: `1px solid ${HAIRLINE}`,
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Official lockup */}
    <div style={{ padding: "20px 16px 16px" }}>
      <FireblocksLogo height={19} />
    </div>

    {/* + Transfer (the one filled-blue action in the rail) */}
    <div style={{ padding: "0 14px 16px" }}>
      <div
        style={{
          height: 38,
          borderRadius: 9,
          background: FB_BLUE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          boxShadow: "0 2px 6px rgba(63,116,234,0.35)",
        }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: font, fontSize: 13.5, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
          Transfer
        </span>
      </div>
    </div>

    {/* Grouped nav with hairline dividers, exactly the real order */}
    <div style={{ display: "flex", flexDirection: "column" }}>
      {NAV_GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div style={{ height: 1, background: HAIRLINE, margin: "8px 14px" }} />}
          {group.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                height: 38,
                margin: "1px 8px",
                padding: "0 9px",
                borderRadius: 8,
                background: n.active ? NAV_ACTIVE_BG : "transparent",
              }}
            >
              <n.Icon size={16} color={n.active ? NAV_ACTIVE_TX : ICON_GREY} strokeWidth={n.active ? 1.8 : 1.6} />
              <span
                style={{
                  fontFamily: font,
                  fontSize: 12.5,
                  fontWeight: n.active ? 700 : 500,
                  color: n.active ? NAV_ACTIVE_TX : INK_SOFT,
                  lineHeight: 1.15,
                }}
              >
                {n.label}
              </span>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ── Top row of the main area (title + gear / help / avatar, like the console) ─
const TopRow: React.FC = () => (
  <>
    <span
      style={{
        position: "absolute",
        left: SIDEBAR_W + 28,
        top: 26,
        fontFamily: font,
        fontSize: 21,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        color: INK,
      }}
    >
      Transaction History
    </span>

    <div
      style={{
        position: "absolute",
        right: SCREEN_W - PANEL_LEFT + 24,
        top: 24,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <GearI size={18} color={ICON_GREY} />
      <HelpI size={18} color={ICON_GREY} />
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: AVATAR_ORANGE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          M
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontFamily: font, fontSize: 10.5, color: CELL_GREY }}>General Market</span>
          <span style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: INK }}>Max Guillabert</span>
        </div>
      </div>
    </div>

    {/* Filter / refresh / export circles above the table, right-aligned */}
    <div
      style={{
        position: "absolute",
        right: SCREEN_W - PANEL_LEFT + 24,
        top: 76,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {[FunnelI, RefreshI, DownloadI].map((I, i) => (
        <div
          key={i}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: `1px solid ${HAIRLINE}`,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <I size={14} color={FB_BLUE} strokeWidth={1.7} />
        </div>
      ))}
    </div>
  </>
);

// ── Transaction History table (white card, blue heads, dot statuses) ──────────
type TxStatus = "pending" | "completed" | "confirming";
type TxRow = {
  source: string;
  sourceKind: "vault" | "external";
  dest: string;
  destKind: "vault" | "external";
  amount: string;
  asset: string;
  status: TxStatus;
  created: string;
};

const CONTEXT_ROWS: TxRow[] = [
  { source: "External", sourceKind: "external", dest: "Treasury Vault", destKind: "vault", amount: "2,500,000", asset: "USDC", status: "completed", created: "6/6/26, 9:12 AM" },
  { source: "Treasury Vault", sourceKind: "vault", dest: "OTC Desk", destKind: "external", amount: "14.25", asset: "Bitcoin", status: "confirming", created: "6/6/26, 8:55 AM" },
  { source: "Treasury Vault", sourceKind: "vault", dest: "Vault 02", destKind: "vault", amount: "750,000", asset: "USDC", status: "completed", created: "6/6/26, 8:31 AM" },
  { source: "External", sourceKind: "external", dest: "Treasury Vault", destKind: "vault", amount: "120.5", asset: "Ethereum", status: "completed", created: "6/5/26, 4:48 PM" },
  { source: "Treasury Vault", sourceKind: "vault", dest: "Exchange", destKind: "external", amount: "300,000", asset: "USDC", status: "completed", created: "6/5/26, 2:06 PM" },
];

const STATUS_META: Record<TxStatus, { color: string; label: string }> = {
  pending: { color: PENDING_Y, label: "Pending Authorization" },
  completed: { color: GREEN, label: "Completed" },
  confirming: { color: BLUE_STATUS, label: "Confirming" },
};

const StatusCell: React.FC<{ status: TxStatus }> = ({ status }) => {
  const m = STATUS_META[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: m.color, flex: "0 0 auto" }} />
      <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: m.color, whiteSpace: "nowrap" }}>{m.label}</span>
    </div>
  );
};

const EndpointCell: React.FC<{ name: string; kind: "vault" | "external" }> = ({ name, kind }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
    {kind === "vault" ? <VaultMiniI size={14} color={ICON_GREY} /> : <GlobeMiniI size={14} color={ICON_GREY} />}
    <span style={{ fontFamily: font, fontSize: 12.5, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {name}
    </span>
  </div>
);

const TxTable: React.FC<{ pending: TxRow; confirmed: boolean }> = ({ pending, confirmed }) => {
  const COLS = "14px 1.2fr 1.2fr 0.85fr 0.75fr 1.25fr 1fr";
  const headStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 12,
    fontWeight: 700,
    color: TABLE_HEAD,
  };
  const rows: { row: TxRow; selected: boolean }[] = [
    { row: pending, selected: true },
    ...CONTEXT_ROWS.map((r) => ({ row: r, selected: false })),
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: SIDEBAR_W + 24,
        top: 116,
        width: PANEL_LEFT - (SIDEBAR_W + 24) - 24,
        borderRadius: 8,
        background: "#fff",
        border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 1px 3px rgba(28,32,48,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header — blue column heads, like the real table */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 12,
          alignItems: "center",
          height: 42,
          padding: "0 16px",
          background: "#FBFBFC",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <span />
        <span style={headStyle}>Source</span>
        <span style={headStyle}>Destination</span>
        <span style={headStyle}>Amount</span>
        <span style={headStyle}>Asset</span>
        <span style={headStyle}>Status</span>
        <span style={headStyle}>Created At</span>
      </div>

      {/* Rows */}
      {rows.map(({ row, selected }, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            alignItems: "center",
            height: 50,
            padding: "0 16px",
            borderBottom: i === rows.length - 1 ? "none" : `1px solid #F0F1F4`,
            background: selected ? "#F0F5FE" : "#fff",
            position: "relative",
          }}
        >
          {selected && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: FB_BLUE }} />}
          <ChevronRightI size={11} color="#C2C7D1" />
          <EndpointCell name={row.source} kind={row.sourceKind} />
          <EndpointCell name={row.dest} kind={row.destKind} />
          <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 600, color: VALUE_BLUE, whiteSpace: "nowrap" }}>{row.amount}</span>
          <span style={{ fontFamily: font, fontSize: 12.5, color: VALUE_BLUE, whiteSpace: "nowrap" }}>{row.asset}</span>
          <StatusCell status={selected ? (confirmed ? "completed" : "pending") : row.status} />
          <span style={{ fontFamily: font, fontSize: 12, color: CELL_GREY, whiteSpace: "nowrap" }}>{row.created}</span>
        </div>
      ))}
    </div>
  );
};

// ── Recent activity panel (the dark approval surface) ─────────────────────────
const FilterPill: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: 26,
      padding: "0 13px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.38)",
    }}
  >
    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: PANEL_TX }}>{label}</span>
  </div>
);

/** Source › Destination band at the top of an activity card. */
const Band: React.FC<{
  srcLabel: string;
  srcName: string;
  dstLabel: string;
  dstName: string;
}> = ({ srcLabel, srcName, dstLabel, dstName }) => (
  <div
    style={{
      height: 54,
      borderRadius: 8,
      background: BAND_BG,
      display: "grid",
      gridTemplateColumns: "1fr 26px 1fr",
      alignItems: "center",
      padding: "0 12px",
    }}
  >
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
      <span style={{ fontFamily: font, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: PANEL_SUBT }}>
        {srcLabel}
      </span>
      <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: PANEL_TX, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {srcName}
      </span>
    </div>
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5l7 7-7 7" stroke="#57596E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
      <span style={{ fontFamily: font, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: PANEL_SUBT }}>
        {dstLabel}
      </span>
      <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: PANEL_TX, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {dstName}
      </span>
    </div>
  </div>
);

const RecentActivityPanel: React.FC<{
  frame: number;
  action: string;
  rows: { label: string; value: string }[];
  approveFrame: number;
  confirmedFrame: number;
}> = ({ frame, action, rows, approveFrame, confirmedFrame }) => {
  const pressed = frame >= approveFrame && frame < approveFrame + PRESS_FRAMES;
  const approving = frame >= approveFrame && frame < confirmedFrame;
  const confirmed = frame >= confirmedFrame;

  const pressScale = pressed
    ? interpolate(frame - approveFrame, [0, PRESS_FRAMES], [0.965, 1], { easing: Easing.out(Easing.quad), extrapolateRight: "clamp" })
    : 1;
  const confirmPop = confirmed
    ? interpolate(frame - confirmedFrame, [0, 9], [0.93, 1], { easing: EASE_OUT, extrapolateRight: "clamp" })
    : 1;
  // Yellow bar sits partial while pending; fills green on completion.
  const barFrac = confirmed
    ? interpolate(frame - confirmedFrame, [0, 14], [0.42, 1], { easing: EASE_OUT, extrapolateRight: "clamp" })
    : 0.42;

  const amountRow = rows.find((r) => /amount|value|notional/i.test(r.label));
  const destRow = rows.find((r) => /to$|destination|counterpart|recipient/i.test(r.label));

  const approveBg = confirmed ? GREEN : FB_BLUE;
  const approveGlow = confirmed ? "0 6px 18px rgba(0,178,156,0.45)" : "0 6px 18px rgba(63,116,234,0.45)";

  return (
    <div
      style={{
        position: "absolute",
        left: PANEL_LEFT,
        top: 0,
        width: PANEL_W,
        height: SCREEN_H,
        background: PANEL_BG,
        boxShadow: "-18px 0 44px rgba(3,12,55,0.28)",
      }}
    >
      {/* Header: title + count, search / filter / collapse */}
      <div style={{ position: "absolute", left: PANEL_PAD, top: 22, right: PANEL_PAD, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: font, fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: PANEL_TX }}>
          Recent activity
        </span>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: BADGE_BG,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 11.5,
            fontWeight: 700,
            color: PANEL_TX,
          }}
        >
          1
        </span>
        <div style={{ flex: 1 }} />
        <SearchI size={16} color="#A9B0C7" />
        <FilterLinesI size={16} color="#A9B0C7" />
        <CollapseI size={16} color="#A9B0C7" />
      </div>

      {/* Filter pills, exactly the real four */}
      <div style={{ position: "absolute", left: PANEL_PAD, top: 62, display: "flex", gap: 8 }}>
        {["Direction", "Account", "Asset", "Status"].map((l) => (
          <FilterPill key={l} label={l} />
        ))}
      </div>

      {/* The pending transaction card — the approval surface */}
      <div
        style={{
          position: "absolute",
          left: PANEL_PAD,
          top: CARD_TOP,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 10,
          background: CARD_BG,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: CARD_PAD, top: CARD_PAD, width: CARD_INNER }}>
          <Band
            srcLabel="Vault"
            srcName="Treasury Vault"
            dstLabel="External"
            dstName={destRow?.value ?? action}
          />

          {/* Amount row + outgoing-direction tile */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, height: 38 }}>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: PANEL_TX, whiteSpace: "nowrap" }}>
                {amountRow?.value ?? "1,000,000 USDC"}
              </span>
              <span style={{ fontFamily: font, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: PANEL_SUBT }}>
                {action}
              </span>
            </div>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: BADGE_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 18 18 6M9 6h9v9" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Detail rows (clipped above the fixed bottom stack) */}
        <div
          style={{
            position: "absolute",
            left: CARD_PAD,
            top: CARD_PAD + 54 + 12 + 38 + 8,
            width: CARD_INNER,
            height: TAP_REL_TOP - (CARD_PAD + 54 + 12 + 38 + 8) - 8,
            overflow: "hidden",
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                height: 32,
                borderTop: i === 0 ? "none" : `1px solid ${PANEL_LINE}`,
              }}
            >
              <span style={{ fontFamily: font, fontSize: 12, fontWeight: 500, color: PANEL_SUBT, whiteSpace: "nowrap" }}>{row.label}</span>
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "#D7DCEC",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 200,
                  textAlign: "right",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Transaction Authorization Policy note */}
        <div
          style={{
            position: "absolute",
            left: CARD_PAD,
            top: TAP_REL_TOP,
            width: CARD_INNER,
            height: 50,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 12px",
            borderRadius: 8,
            background: "rgba(255,198,78,0.08)",
            border: "1px solid rgba(255,198,78,0.28)",
            boxSizing: "border-box",
          }}
        >
          <ShieldI size={18} color={GOLD} strokeWidth={1.7} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, minWidth: 0 }}>
            <span style={{ fontFamily: font, fontSize: 11.5, fontWeight: 700, color: PANEL_TX, whiteSpace: "nowrap" }}>
              Transaction Authorization Policy
            </span>
            <span style={{ fontFamily: font, fontSize: 10.5, color: PANEL_SUBT, whiteSpace: "nowrap" }}>
              Requires 1 approval · you are the designated approver
            </span>
          </div>
        </div>

        {/* Status row — console status colors: yellow pending → green complete */}
        <div
          style={{
            position: "absolute",
            left: CARD_PAD,
            top: STATUS_REL_TOP,
            width: CARD_INNER,
            height: 24,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: confirmed ? GREEN_LIGHT : GOLD, whiteSpace: "nowrap" }}>
            {confirmed ? "Completed" : "Pending Authorization"}
          </span>
          <InfoI size={13} color={confirmed ? GREEN_LIGHT : GOLD} strokeWidth={1.8} />
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: font, fontSize: 11.5, color: PANEL_SUBT }}>{confirmed ? "Just now" : "9:41 AM"}</span>
        </div>

        {/* Per-card progress bar (green full bar when complete, like the console) */}
        <div
          style={{
            position: "absolute",
            left: CARD_PAD,
            top: BAR_REL_TOP,
            width: CARD_INNER,
            height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.10)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barFrac * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: confirmed ? GREEN_BAR : GOLD,
            }}
          />
        </div>

        {/* Deny ✕ / Approve ✓ — the real Fireblocks approval button pair */}
        <div style={{ position: "absolute", left: CARD_PAD, top: BTN_REL_TOP, display: "flex", gap: BTN_GAP }}>
          <button
            style={{
              width: BTN_W,
              height: BTN_H,
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.30)",
              background: "transparent",
              color: "#E6E9F4",
              fontFamily: font,
              fontSize: 13.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "default",
              opacity: approving || confirmed ? 0.35 : 1,
            }}
          >
            Deny
            <Cross size={13} color="#E6E9F4" />
          </button>
          <button
            style={{
              width: BTN_W,
              height: BTN_H,
              borderRadius: 9,
              border: "none",
              background: approveBg,
              color: "#fff",
              fontFamily: font,
              fontSize: 13.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "default",
              boxShadow: approveGlow,
              transform: `scale(${pressScale * confirmPop})`,
              filter: `brightness(${pressed ? 1.14 : 1})`,
            }}
          >
            {confirmed ? (
              <>
                Approved
                <Check size={15} color="#fff" />
              </>
            ) : approving ? (
              <>
                <Spinner size={16} frame={frame} color="#fff" />
                Approving…
              </>
            ) : (
              <>
                Approve
                <Check size={15} color="#fff" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* A compact completed card below, for context */}
      <div
        style={{
          position: "absolute",
          left: PANEL_PAD,
          top: CARD_TOP + CARD_H + 14,
          width: CARD_W,
          height: 132,
          borderRadius: 10,
          background: CARD_BG,
          border: "1px solid rgba(255,255,255,0.06)",
          padding: CARD_PAD,
          boxSizing: "border-box",
        }}
      >
        <Band srcLabel="External" srcName="Counterparty" dstLabel="Vault" dstName="Treasury Vault" />
        <div style={{ display: "flex", alignItems: "center", marginTop: 10, gap: 7 }}>
          <span style={{ fontFamily: font, fontSize: 13.5, fontWeight: 800, color: PANEL_TX }}>2,500,000 USDC</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: font, fontSize: 11.5, fontWeight: 700, color: GREEN_LIGHT }}>Completed</span>
          <span style={{ fontFamily: font, fontSize: 11, color: PANEL_SUBT }}>9:12 AM</span>
        </div>
        <div style={{ marginTop: 9, height: 3, borderRadius: 999, background: GREEN_BAR }} />
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const FireblocksPage: React.FC<{
  action: string;
  rows: { label: string; value: string }[];
  approveFrame: number;
  confirmedFrame: number;
}> = ({ action, rows, approveFrame, confirmedFrame }) => {
  const frame = useCurrentFrame();
  const confirmed = frame >= confirmedFrame;

  // The pending row in the table mirrors the panel's transaction.
  const amountRow = rows.find((r) => /amount|value|notional/i.test(r.label));
  const assetRow = rows.find((r) => /asset|token|currency/i.test(r.label));
  const destRow = rows.find((r) => /to$|destination|counterpart|recipient/i.test(r.label));
  const pending: TxRow = {
    source: "Treasury Vault",
    sourceKind: "vault",
    dest: destRow?.value ?? action,
    destKind: "external",
    amount: amountRow?.value?.replace(/[^\d.,]/g, "") || "1,000,000",
    asset: assetRow?.value?.split(" ")[0] ?? "USDC",
    status: "pending",
    created: "6/6/26, 9:41 AM",
  };

  return (
    <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, background: BODY_BG, overflow: "hidden", fontFamily: font }}>
      <Sidebar />
      <TopRow />
      <TxTable pending={pending} confirmed={confirmed} />
      <RecentActivityPanel frame={frame} action={action} rows={rows} approveFrame={approveFrame} confirmedFrame={confirmedFrame} />
    </div>
  );
};
