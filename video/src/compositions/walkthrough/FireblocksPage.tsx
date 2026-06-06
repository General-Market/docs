/**
 * FireblocksPage — a faithful recreation of the real Fireblocks web console
 * (console.fireblocks.io) transaction-approval view, as a FULL browser page.
 *
 * This is the *page content* (1440×900). The engine wraps it in BrowserChrome
 * and docks it at SCREEN_LEFT/SCREEN_TOP, exactly the way Screen.tsx mounts a
 * screenshot — so to the viewer it reads as another tab the user switched to.
 * It REPLACES the old corner WalletModal: instead of a fake wallet popup, the
 * actual institutional custody console is shown, and the user approves there.
 *
 * The console is reproduced from the live product:
 *   • the deep-navy enterprise theme (near-black indigo body, darker rail);
 *   • the left navigation rail — the orange square+triangle Fireblocks mark and
 *     wordmark, a workspace switcher, and the real nav order (Home, Accounts,
 *     Transactions [active], Web3, Smart Transfer, Reports, Settings) with a
 *     pinned account row at the foot;
 *   • a top bar with the workspace name, an environment pill, a search field, a
 *     notification bell and the user avatar;
 *   • the Transactions table (Asset · Amount · Destination · Status · Submitted)
 *     with the pending row selected;
 *   • the Transaction Details drawer docked on the right — the asset header, the
 *     detail rows (passed in), the Transaction Authorization Policy note
 *     ("Requires 1 approval"), and the Reject / Approve footer.
 *
 * Everything that moves is a pure function of useCurrentFrame() — no CSS
 * @keyframes — so Studio and a headless render draw the identical frame:
 *   approveFrame   → the Approve button dips and brightens (the press);
 *   approving      → a frame-driven spinner ("Approving…"), Reject dims;
 *   confirmedFrame → the button flips green with a check ("Approved"), the
 *                    status pills flip to green, with a small settle pop.
 *
 * The Approve button center is computed from the same layout constants the
 * footer lays out with and exported, mapped to canvas space, so the cursor
 * target can never drift from what is drawn.
 */

import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { SCREEN_LEFT, SCREEN_TOP, SCREEN_W, SCREEN_H } from "./geometry";

// ── Fireblocks palette (institutional navy + brand orange + action blue) ──────
const BG = "#0A0F24"; // main body — near-black indigo
const RAIL = "#070B1C"; // left navigation rail, a shade deeper
const PANEL = "#10162F"; // drawer + table surface
const PANEL_HI = "#171F3D"; // selected / hovered row
const LINE = "rgba(255,255,255,0.07)";
const LINE_SOFT = "rgba(255,255,255,0.045)";
const TEXT = "#EAEEF8";
const SUBT = "#8A93AE";
const FB_BLUE = "#3E7BFA"; // Fireblocks action blue
const FB_BLUE_DK = "#2C63E0";
const SUCCESS = "#22C07C";
const AMBER = "#F5B23D"; // pending / honey-yellow accent
const ORANGE_A = "#FF8A3D"; // brand mark gradient stops
const ORANGE_B = "#F0531F";

const MUTED = "#4E5878"; // faint ink — placeholders, column heads

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Layout (page-local, 0..1440 / 0..900) ─────────────────────────────────────
const SIDEBAR_W = 240;
const TOPBAR_H = 64;

const DRAWER_W = 460;
const DRAWER_LEFT = SCREEN_W - DRAWER_W; // 980
const DRAWER_TOP = TOPBAR_H; // 64
const DRAWER_H = SCREEN_H - TOPBAR_H; // 836
const DRAWER_PAD = 28;
const DRAWER_INNER = DRAWER_W - DRAWER_PAD * 2; // 404

const BTN_GAP = 12;
const BTN_H = 48;
const FOOTER_PAD = 28;
const BTN_W = (DRAWER_INNER - BTN_GAP) / 2; // 196

// Approve = right footer button. Centre derived from the same numbers it draws.
const APPROVE_LEFT_REL = DRAWER_PAD + BTN_W + BTN_GAP; // 236
const APPROVE_CX = DRAWER_LEFT + APPROVE_LEFT_REL + BTN_W / 2; // 1314
const APPROVE_TOP = DRAWER_TOP + DRAWER_H - FOOTER_PAD - BTN_H; // 824
const APPROVE_CY = APPROVE_TOP + BTN_H / 2; // 848

/** Canvas-space centre of the Approve button — aim the cursor here. */
export const FIREBLOCKS_APPROVE_POINT: { x: number; y: number } = {
  x: SCREEN_LEFT + APPROVE_CX, // 1554
  y: SCREEN_TOP + APPROVE_CY, // 948
};

/** Address-bar host for the browser chrome when this page is shown. */
export const FIREBLOCKS_URL = "console.fireblocks.io";

const PRESS_FRAMES = 7;

// ── Icons (thin line set, console-faithful) ───────────────────────────────────
type IconProps = { size?: number; color?: string; strokeWidth?: number };

const Ico = (
  d: string,
  vb = "0 0 24 24",
): React.FC<IconProps> =>
  function Icon({ size = 18, color = SUBT, strokeWidth = 1.7 }) {
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

const HomeI = Ico("M4 11 12 4l8 7M6 9.5V20h12V9.5");
const VaultI = Ico(
  "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 3h0",
);
const SwapI = Ico("M7 7h11l-3-3M17 17H6l3 3");
const Web3I = Ico(
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z",
);
const BoltI = Ico("M13 3 5 13h6l-1 8 8-11h-6l1-7Z");
const DocI = Ico("M7 3h7l5 5v13H7ZM14 3v5h5M9.5 13h7M9.5 16.5h7");
const GearI = Ico(
  "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.1a2 2 0 1 1-4 0v-.04a1.7 1.7 0 0 0-2.87-1.26l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13.5h-.1a2 2 0 1 1 0-4h.04A1.7 1.7 0 0 0 5.8 6.63l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.04A1.7 1.7 0 0 0 11.6 2.6v-.1a2 2 0 1 1 4 0v.04a1.7 1.7 0 0 0 2.87 1.26l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04A1.7 1.7 0 0 0 21.4 9.5h.1a2 2 0 1 1 0 4h-.04a1.7 1.7 0 0 0-1.56 1.04Z",
);
const BellI = Ico(
  "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0",
);
const SearchI = Ico("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4");
const ChevronI = Ico("M8 5l7 7-7 7");
const PolicyI = Ico("M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6ZM9 12l2 2 4-4");

// ── Fireblocks brand mark — overlapping square + triangle, orange gradient ────
const FireblocksMark: React.FC<{ size: number }> = ({ size }) => {
  const id = "fbmark";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="3" x2="28" y2="29">
          <stop offset="0" stopColor={ORANGE_A} />
          <stop offset="1" stopColor={ORANGE_B} />
        </linearGradient>
      </defs>
      {/* base rounded square */}
      <rect x="4" y="9" width="16" height="16" rx="3.5" fill={`url(#${id})`} />
      {/* overlapping triangle block — the "fire block" layering */}
      <path
        d="M17 4.5 28.5 16 17 16Z"
        fill={`url(#${id})`}
        opacity="0.92"
      />
      <path
        d="M12.5 20 20 12.5 20 20Z"
        fill="#0A0F24"
        opacity="0.22"
      />
    </svg>
  );
};

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

// ── Left navigation rail ──────────────────────────────────────────────────────
const NAV: { id: string; label: string; Icon: React.FC<IconProps>; active?: boolean }[] = [
  { id: "home", label: "Home", Icon: HomeI },
  { id: "accounts", label: "Accounts", Icon: VaultI },
  { id: "transactions", label: "Transactions", Icon: SwapI, active: true },
  { id: "web3", label: "Web3", Icon: Web3I },
  { id: "smart", label: "Smart Transfer", Icon: BoltI },
  { id: "reports", label: "Reports", Icon: DocI },
  { id: "settings", label: "Settings", Icon: GearI },
];

const Sidebar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: SIDEBAR_W,
      height: SCREEN_H,
      background: RAIL,
      borderRight: `1px solid ${LINE}`,
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Brand lockup */}
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "22px 22px 18px" }}>
      <FireblocksMark size={26} />
      <span style={{ fontFamily: font, fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em", color: TEXT }}>
        Fireblocks
      </span>
    </div>

    {/* Workspace switcher */}
    <div style={{ padding: "0 16px 14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 44,
          padding: "0 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.035)",
          border: `1px solid ${LINE}`,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${FB_BLUE}, ${FB_BLUE_DK})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            flex: "0 0 auto",
          }}
        >
          G
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            General Market
          </span>
          <span style={{ fontFamily: font, fontSize: 11, color: SUBT }}>Main Workspace</span>
        </div>
        <ChevronI size={14} color={SUBT} />
      </div>
    </div>

    {/* Nav items */}
    <div style={{ padding: "4px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV.map((n) => (
        <div
          key={n.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 40,
            padding: "0 12px",
            borderRadius: 9,
            position: "relative",
            background: n.active ? "rgba(62,123,250,0.12)" : "transparent",
          }}
        >
          {n.active && (
            <div
              style={{
                position: "absolute",
                left: -12,
                top: 9,
                width: 3,
                height: 22,
                borderRadius: 3,
                background: FB_BLUE,
              }}
            />
          )}
          <n.Icon size={18} color={n.active ? FB_BLUE : SUBT} strokeWidth={n.active ? 1.9 : 1.7} />
          <span
            style={{
              fontFamily: font,
              fontSize: 14,
              fontWeight: n.active ? 600 : 500,
              color: n.active ? TEXT : "#A6AEC6",
              letterSpacing: "-0.005em",
            }}
          >
            {n.label}
          </span>
        </div>
      ))}
    </div>

    <div style={{ flex: 1 }} />

    {/* Pinned account row */}
    <div style={{ padding: "12px 16px 18px", borderTop: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${ORANGE_A}, ${ORANGE_B})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            flex: "0 0 auto",
          }}
        >
          M
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: TEXT }}>Max Guillabert</span>
          <span style={{ fontFamily: font, fontSize: 11, color: SUBT }}>Admin · Owner</span>
        </div>
        <ChevronI size={14} color={SUBT} />
      </div>
    </div>
  </div>
);

// ── Top bar ───────────────────────────────────────────────────────────────────
const TopBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: SIDEBAR_W,
      top: 0,
      width: SCREEN_W - SIDEBAR_W,
      height: TOPBAR_H,
      borderBottom: `1px solid ${LINE}`,
      display: "flex",
      alignItems: "center",
      padding: "0 28px",
      gap: 16,
      background: BG,
    }}
  >
    <span style={{ fontFamily: font, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: TEXT }}>
      Transactions
    </span>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(34,192,124,0.12)",
        border: "1px solid rgba(34,192,124,0.3)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: SUCCESS }} />
      <span style={{ fontFamily: font, fontSize: 11.5, fontWeight: 600, color: SUCCESS, letterSpacing: "0.01em" }}>
        Mainnet
      </span>
    </div>

    <div style={{ flex: 1 }} />

    {/* Search */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: 240,
        height: 38,
        padding: "0 13px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${LINE}`,
      }}
    >
      <SearchI size={16} color={SUBT} />
      <span style={{ fontFamily: font, fontSize: 13.5, color: MUTED }}>Search transactions, assets…</span>
    </div>

    {/* Bell with dot */}
    <div style={{ position: "relative", width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BellI size={18} color={SUBT} />
      <span style={{ position: "absolute", top: 8, right: 9, width: 7, height: 7, borderRadius: 999, background: AMBER, border: `1.5px solid ${BG}` }} />
    </div>

    {/* Avatar */}
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${ORANGE_A}, ${ORANGE_B})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: 15,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      M
    </div>
  </div>
);

// ── Transactions table (context behind the drawer) ────────────────────────────
type TxRow = { asset: string; sub: string; amount: string; dest: string; status: "pending" | "completed"; time: string; mark: string };

const CONTEXT_ROWS: TxRow[] = [
  { asset: "USDC", sub: "Ethereum", amount: "2,500,000.00", dest: "Counterparty · Settle", status: "completed", time: "09:41", mark: ORANGE_B },
  { asset: "USDC", sub: "Ethereum", amount: "750,000.00", dest: "Treasury · Vault 02", status: "completed", time: "09:12", mark: FB_BLUE },
  { asset: "WBTC", sub: "Ethereum", amount: "14.250000", dest: "OTC Desk · Withdraw", status: "completed", time: "08:55", mark: AMBER },
];

const StatusChip: React.FC<{ kind: "pending" | "completed" | "approved" }> = ({ kind }) => {
  const map = {
    pending: { c: AMBER, bg: "rgba(245,178,61,0.12)", bd: "rgba(245,178,61,0.32)", label: "Pending approval", spin: false },
    completed: { c: SUCCESS, bg: "rgba(34,192,124,0.12)", bd: "rgba(34,192,124,0.3)", label: "Completed", spin: false },
    approved: { c: SUCCESS, bg: "rgba(34,192,124,0.12)", bd: "rgba(34,192,124,0.3)", label: "Approved", spin: false },
  }[kind];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 9px", borderRadius: 999, background: map.bg, border: `1px solid ${map.bd}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: map.c }} />
      <span style={{ fontFamily: font, fontSize: 11.5, fontWeight: 600, color: map.c, letterSpacing: "0.01em" }}>{map.label}</span>
    </div>
  );
};

const AssetCell: React.FC<{ asset: string; sub: string; mark: string }> = ({ asset, sub, mark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
    <div style={{ width: 30, height: 30, borderRadius: 999, background: mark, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 12, fontWeight: 700, color: "#fff", flex: "0 0 auto" }}>
      {asset[0]}
    </div>
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
      <span style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: TEXT }}>{asset}</span>
      <span style={{ fontFamily: font, fontSize: 11.5, color: SUBT }}>{sub}</span>
    </div>
  </div>
);

const TxTable: React.FC<{ pending: TxRow; confirmed: boolean }> = ({ pending, confirmed }) => {
  const COLS = "minmax(0,1.3fr) 1fr 1.1fr 150px";
  const cellHeadStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: MUTED,
  };
  const rows: { row: TxRow; selected: boolean }[] = [
    { row: pending, selected: true },
    ...CONTEXT_ROWS.map((r) => ({ row: r, selected: false })),
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: SIDEBAR_W + 28,
        top: TOPBAR_H + 24,
        width: DRAWER_LEFT - (SIDEBAR_W + 28) - 24,
        borderRadius: 14,
        background: PANEL,
        border: `1px solid ${LINE}`,
        overflow: "hidden",
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, height: 52, padding: "0 20px", borderBottom: `1px solid ${LINE}` }}>
        {["All", "Pending", "Completed"].map((t, i) => (
          <div key={t} style={{ position: "relative", height: "100%", display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: font, fontSize: 14, fontWeight: i === 1 ? 600 : 500, color: i === 1 ? TEXT : SUBT }}>{t}</span>
            {i === 1 && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2.5, borderRadius: 2, background: FB_BLUE }} />}
            {i === 1 && (
              <span style={{ marginLeft: 8, fontFamily: monoFont, fontSize: 11, fontWeight: 600, color: AMBER, background: "rgba(245,178,61,0.14)", borderRadius: 999, padding: "2px 7px" }}>
                1
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, padding: "12px 20px", borderBottom: `1px solid ${LINE_SOFT}` }}>
        <span style={cellHeadStyle}>Asset</span>
        <span style={{ ...cellHeadStyle, textAlign: "right" }}>Amount</span>
        <span style={cellHeadStyle}>Destination</span>
        <span style={cellHeadStyle}>Status</span>
      </div>

      {/* Rows */}
      {rows.map(({ row, selected }, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 16,
            alignItems: "center",
            padding: "14px 20px",
            borderBottom: i === rows.length - 1 ? "none" : `1px solid ${LINE_SOFT}`,
            background: selected ? PANEL_HI : "transparent",
            position: "relative",
          }}
        >
          {selected && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: FB_BLUE }} />}
          <AssetCell asset={row.asset} sub={row.sub} mark={row.mark} />
          <span style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 500, color: TEXT, textAlign: "right" }}>{row.amount}</span>
          <span style={{ fontFamily: font, fontSize: 13.5, color: "#B7BFD6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.dest}</span>
          <div>
            <StatusChip kind={selected ? (confirmed ? "approved" : "pending") : "completed"} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Transaction Details drawer (the approval surface) ─────────────────────────
const Drawer: React.FC<{
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

  const approveBg = confirmed ? SUCCESS : FB_BLUE;
  const approveGlow = confirmed ? "0 8px 24px rgba(34,192,124,0.4)" : "0 8px 24px rgba(62,123,250,0.4)";

  return (
    <div
      style={{
        position: "absolute",
        left: DRAWER_LEFT,
        top: DRAWER_TOP,
        width: DRAWER_W,
        height: DRAWER_H,
        background: PANEL,
        borderLeft: `1px solid ${LINE}`,
        boxShadow: "-24px 0 60px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Drawer header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${DRAWER_PAD}px ${DRAWER_PAD}px 18px` }}>
        <span style={{ fontFamily: font, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: TEXT }}>Transaction details</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: SUBT, fontFamily: font, fontSize: 17, background: "rgba(255,255,255,0.04)" }}>×</div>
      </div>

      <div style={{ height: 1, background: LINE }} />

      {/* Asset / status block */}
      <div style={{ padding: `20px ${DRAWER_PAD}px 4px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: ORANGE_B, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 17, fontWeight: 700, color: "#fff", flex: "0 0 auto" }}>
            U
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: SUBT }}>{action}</span>
            <span style={{ fontFamily: font, fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em", color: TEXT }}>Approve transaction</span>
          </div>
          <StatusChip kind={confirmed ? "approved" : "pending"} />
        </div>
      </div>

      {/* Detail rows */}
      <div style={{ padding: `4px ${DRAWER_PAD}px`, flex: 1, overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "13px 0",
              borderTop: i === 0 ? "none" : `1px solid ${LINE_SOFT}`,
            }}
          >
            <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: SUBT }}>{row.label}</span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#D4DAEA",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 230,
                textAlign: "right",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Transaction Authorization Policy note */}
      <div style={{ margin: `0 ${DRAWER_PAD}px 14px`, display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, background: "rgba(62,123,250,0.07)", border: "1px solid rgba(62,123,250,0.22)" }}>
        <PolicyI size={20} color={FB_BLUE} strokeWidth={1.7} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: TEXT }}>Transaction Authorization Policy</span>
          <span style={{ fontFamily: font, fontSize: 12, color: SUBT }}>Requires 1 approval · 1 of 1 approvers</span>
        </div>
      </div>

      {/* Footer: Reject / Approve */}
      <div style={{ display: "flex", gap: BTN_GAP, padding: `0 ${DRAWER_PAD}px ${FOOTER_PAD}px` }}>
        <button
          style={{
            width: BTN_W,
            height: BTN_H,
            borderRadius: 11,
            border: `1px solid ${LINE}`,
            background: "rgba(255,255,255,0.03)",
            color: "#C2CADF",
            fontFamily: font,
            fontSize: 15,
            fontWeight: 600,
            cursor: "default",
            opacity: approving || confirmed ? 0.4 : 1,
          }}
        >
          Reject
        </button>
        <button
          style={{
            width: BTN_W,
            height: BTN_H,
            borderRadius: 11,
            border: "none",
            background: approveBg,
            color: "#fff",
            fontFamily: font,
            fontSize: 15,
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
              <Check size={19} color="#fff" />
              Approved
            </>
          ) : approving ? (
            <>
              <Spinner size={18} frame={frame} color="#fff" />
              Approving…
            </>
          ) : (
            "Approve"
          )}
        </button>
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

  // The pending row in the table mirrors the drawer's transaction.
  const amountRow = rows.find((r) => /amount|value|notional/i.test(r.label));
  const assetRow = rows.find((r) => /asset|token|currency/i.test(r.label));
  const destRow = rows.find((r) => /to|destination|counterpart|recipient/i.test(r.label));
  const pending: TxRow = {
    asset: assetRow?.value?.split(" ")[0] ?? "USDC",
    sub: "Ethereum",
    amount: amountRow?.value?.replace(/[^\d.,]/g, "") || "1,000,000.00",
    dest: destRow?.value ?? action,
    status: "pending",
    time: "Now",
    mark: ORANGE_B,
  };

  return (
    <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, background: BG, overflow: "hidden", fontFamily: font }}>
      {/* faint top sheen, like the real console body */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1200px 400px at 70% -10%, rgba(62,123,250,0.06), transparent 60%)", pointerEvents: "none" }} />

      <Sidebar />
      <TopBar />
      <TxTable pending={pending} confirmed={confirmed} />
      <Drawer frame={frame} action={action} rows={rows} approveFrame={approveFrame} confirmedFrame={confirmedFrame} />
    </div>
  );
};
