/**
 * WalletModal — a real WalletConnect → Fireblocks approval flow for the
 * walkthrough.
 *
 * When the walkthrough triggers an on-chain action (allocate a counterparty,
 * sign & bind a trade), a centered modal pops over a dimmed page in two phases,
 * the way the real flow feels:
 *
 *   1. CONNECT — a WalletConnect-style picker. Header "Connect a wallet", a tab
 *      row (Recent / Browser / QR Code) whose active-tab indicator SLIDES across
 *      the tabs (the "tab switching"), and a wallet list with a highlighted
 *      Fireblocks row. The orchestrator's cursor lands on that row.
 *   2. APPROVE — the panel SLIDES (not fades) to the Fireblocks approval: dark
 *      institutional navy, the Fireblocks shield + wordmark, an inner tab row
 *      (Details / Data / Advanced) whose indicator also slides, the transaction
 *      rows, and a Reject / Approve footer. Approve press → Confirming… (frame
 *      spinner) → Approved ✓ (green), held briefly.
 *
 * Everything is frame-driven (useCurrentFrame): the entrance spring, the tab
 * indicator slide, the phase slide, the press dip, the spinner rotation and the
 * success flip are all pure functions of the frame — never a CSS @keyframe or
 * transition, so Studio and a headless render draw the same picture.
 *
 * All geometry lives in module-level constants so the two cursor targets —
 * WALLET_CONNECT_POINT (canvas center of the Fireblocks row, connect phase) and
 * WALLET_APPROVE_POINT (canvas center of the Approve button, approve phase) —
 * are derived from the exact numbers the component lays out with.
 *
 * Palette: light WalletConnect chrome for the picker, deep Fireblocks navy for
 * the approval, the action on GM Electric (#2D5BFF) flipping to success-green
 * (#1FB877) on confirm. Fonts from common/fonts.
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { CANVAS_W, CANVAS_H } from "./geometry";

const GM_ELECTRIC = "#2D5BFF";
const SUCCESS = "#1FB877";
const AMBER = "#E8A13A";
const FB_ORANGE = "#F5841F"; // Fireblocks badge accent

// House spring (GMStyle §6) — the one settle for arrivals.
const HOUSE_SPRING = {
  config: { mass: 0.6, damping: 16, stiffness: 120 },
  durationInFrames: 26,
};

// EASE.out (GMStyle §7) for slides and tails.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Modal box geometry (module-level so both POINTs stay in lockstep) ─────────
export const MODAL_W = 440;
export const MODAL_H = 560;
export const MODAL_LEFT = Math.round((CANVAS_W - MODAL_W) / 2); // 740
export const MODAL_TOP = Math.round((CANVAS_H - MODAL_H) / 2); // 260

const PAD = 22;
const INNER_W = MODAL_W - PAD * 2; // 396

// ── Connect phase layout ──────────────────────────────────────────────────────
const C_HEADER_H = 64;
const C_TAB_TOP = C_HEADER_H; // 64
const C_TAB_H = 46;
const C_TAB_W = INNER_W / 3; // 132
const C_LIST_TOP = C_TAB_TOP + C_TAB_H + 18; // 128
const C_ROW_H = 62;
const C_ROW_GAP = 8;

const CONNECT_TABS = ["Recent", "Browser", "QR Code"];

// The wallet list — Fireblocks is the highlighted "Recent" row (index 0).
const WALLETS: { name: string; bg: string; letter: string; recent?: boolean }[] =
  [
    { name: "Fireblocks", bg: FB_ORANGE, letter: "F", recent: true },
    { name: "MetaMask", bg: "#F6851B", letter: "M" },
    { name: "Coinbase Wallet", bg: "#2D5BFF", letter: "C" },
    { name: "WalletConnect", bg: "#3B99FC", letter: "W" },
  ];

// Fireblocks row center, relative to the modal box, then mapped to canvas.
const FB_ROW_CY_REL = C_LIST_TOP + C_ROW_H / 2;

/** Canvas-space center of the Fireblocks row — aim the cursor here (connect). */
export const WALLET_CONNECT_POINT: { x: number; y: number } = {
  x: MODAL_LEFT + MODAL_W / 2,
  y: MODAL_TOP + FB_ROW_CY_REL,
};

// ── Approve phase layout ──────────────────────────────────────────────────────
const A_HEADER_H = 60;
const A_TITLE_H = 66;
const A_TAB_TOP = A_HEADER_H + A_TITLE_H; // 126
const A_TAB_H = 44;
const A_TAB_W = INNER_W / 3; // 132
const A_ROWS_TOP = A_TAB_TOP + A_TAB_H + 8; // 178

const FOOTER_PAD_BOTTOM = 22;
const BTN_H = 50;
const BTN_GAP = 12;
const BTN_W = (INNER_W - BTN_GAP) / 2; // 192

const APPROVE_TABS = ["Details", "Data", "Advanced"];

// Approve button (right footer button) center, relative to the modal box.
const APPROVE_LEFT_REL = PAD + BTN_W + BTN_GAP; // reject | approve
const APPROVE_CX_REL = APPROVE_LEFT_REL + BTN_W / 2;
const APPROVE_TOP_REL = MODAL_H - FOOTER_PAD_BOTTOM - BTN_H;
const APPROVE_CY_REL = APPROVE_TOP_REL + BTN_H / 2;

/** Canvas-space center of the Approve button — aim the cursor here (approve). */
export const WALLET_APPROVE_POINT: { x: number; y: number } = {
  x: MODAL_LEFT + APPROVE_CX_REL,
  y: MODAL_TOP + APPROVE_CY_REL,
};

// Frames the phase slide and the Approve press take.
const PHASE_SLIDE = 8;
const PRESS_FRAMES = 7;

// ── Glyphs ────────────────────────────────────────────────────────────────────

const Shield: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5v-6L12 2.5Z"
      fill={color}
      opacity={0.18}
    />
    <path
      d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5v-6L12 2.5Z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <path
      d="M9 12.2 11 14.2 15 9.8"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Check: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12.5 10 17.5 19 7"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Chevron: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 6 15 12 9 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Frame-driven spinner: a stroked arc rotated by frame angle (no keyframes). */
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
      style={{ transform: `rotate(${(frame * 14) % 360}deg)` }}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={2.4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.28} ${c}`}
      />
    </svg>
  );
};

/** A rounded wallet badge — a tinted square with a single-letter mark. */
const WalletBadge: React.FC<{ bg: string; letter: string; size: number }> = ({
  bg,
  letter,
  size,
}) =>
  letter === "F" ? (
    // Fireblocks — shield on its orange tile.
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        flex: "0 0 auto",
      }}
    >
      <Shield size={size * 0.62} color="#FFFFFF" />
    </div>
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFFFFF",
        fontFamily: font,
        fontSize: size * 0.5,
        fontWeight: 700,
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        flex: "0 0 auto",
      }}
    >
      {letter}
    </div>
  );

// ── Tab row (shared shape, drives the sliding indicator) ──────────────────────

const TabRow: React.FC<{
  tabs: string[];
  tabW: number;
  /** Continuous active index — fractional during the slide. */
  activeIdx: number;
  height: number;
  variant: "light" | "dark";
}> = ({ tabs, tabW, activeIdx, height, variant }) => {
  const dark = variant === "dark";
  const baseColor = dark ? "rgba(255,255,255,0.42)" : "#8A92A6";
  const activeColor = dark ? "#F5F7FA" : "#11151F";
  const indicator = dark ? GM_ELECTRIC : GM_ELECTRIC;
  const railColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  const indWidth = tabW - 28;
  const indLeft = PAD + activeIdx * tabW + (tabW - indWidth) / 2;

  return (
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        height,
        display: "flex",
      }}
    >
      {tabs.map((t, i) => {
        const near = 1 - Math.min(1, Math.abs(i - activeIdx));
        return (
          <div
            key={t}
            style={{
              width: tabW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: font,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: i === Math.round(activeIdx) ? activeColor : baseColor,
            }}
          >
            <span style={{ opacity: 0.55 + 0.45 * near }}>{t}</span>
          </div>
        );
      })}
      {/* Rail + sliding indicator (position is a pure function of activeIdx). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: railColor,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: indLeft - PAD,
          bottom: 0,
          width: indWidth,
          height: 2.5,
          background: indicator,
          borderRadius: 2,
          boxShadow: `0 0 8px ${indicator}66`,
        }}
      />
    </div>
  );
};

// ── Connect panel ─────────────────────────────────────────────────────────────

const ConnectPanel: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  // Active-tab indicator slides from "QR Code" (2) → "Recent" (0): the switch.
  const connIdx = interpolate(
    frame - startFrame,
    [4, 16],
    [2, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg,#FFFFFF 0%,#F4F6FB 100%)",
        color: "#11151F",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: C_HEADER_H,
          padding: `0 ${PAD}px`,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Connect a wallet
        </span>
        <span style={{ flex: 1 }} />
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8A92A6",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          ×
        </div>
      </div>

      {/* Tab row (sliding indicator) */}
      <div style={{ position: "absolute", top: C_TAB_TOP, left: 0, right: 0 }}>
        <TabRow
          tabs={CONNECT_TABS}
          tabW={C_TAB_W}
          activeIdx={connIdx}
          height={C_TAB_H}
          variant="light"
        />
      </div>

      {/* Wallet list */}
      <div
        style={{
          position: "absolute",
          top: C_LIST_TOP,
          left: PAD,
          right: PAD,
        }}
      >
        {WALLETS.map((w, i) => {
          const top = i * (C_ROW_H + C_ROW_GAP);
          const isFB = w.recent;
          return (
            <div
              key={w.name}
              style={{
                position: "absolute",
                top,
                left: 0,
                right: 0,
                height: C_ROW_H,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 14px",
                borderRadius: 14,
                background: isFB ? "rgba(45,91,255,0.07)" : "transparent",
                border: isFB
                  ? `1.5px solid ${GM_ELECTRIC}`
                  : "1px solid rgba(0,0,0,0.06)",
                boxShadow: isFB
                  ? "0 6px 18px rgba(45,91,255,0.14)"
                  : "none",
              }}
            >
              <WalletBadge bg={w.bg} letter={w.letter} size={38} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{w.name}</span>
                {w.recent && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: GM_ELECTRIC,
                      letterSpacing: "0.01em",
                    }}
                  >
                    Recent
                  </span>
                )}
              </div>
              <span style={{ flex: 1 }} />
              {isFB ? (
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: GM_ELECTRIC,
                    background: "rgba(45,91,255,0.10)",
                    border: "1px solid rgba(45,91,255,0.30)",
                    borderRadius: 999,
                    padding: "4px 9px",
                  }}
                >
                  Installed
                </span>
              ) : (
                <Chevron size={18} color="#B6BECE" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          bottom: 18,
          fontSize: 12.5,
          color: "#8A92A6",
          textAlign: "center",
        }}
      >
        Haven&apos;t got a wallet?{" "}
        <span style={{ color: GM_ELECTRIC, fontWeight: 600 }}>Get started</span>
      </div>
    </div>
  );
};

// ── Approve (Fireblocks) panel ────────────────────────────────────────────────

const ApprovePanel: React.FC<{
  frame: number;
  startFrame: number; // when this panel begins sliding in (connectFrame)
  action: string;
  rows: { label: string; value: string }[];
  approveFrame: number;
  confirmedFrame: number;
}> = ({ frame, startFrame, action, rows, approveFrame, confirmedFrame }) => {
  // Inner tab indicator slides from "Advanced" (2) → "Details" (0).
  const apIdx = interpolate(
    frame - (startFrame + PHASE_SLIDE),
    [0, 10],
    [2, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const pressed = frame >= approveFrame && frame < approveFrame + PRESS_FRAMES;
  const confirming = frame >= approveFrame && frame < confirmedFrame;
  const confirmed = frame >= confirmedFrame;

  const pressScale = pressed
    ? interpolate(frame - approveFrame, [0, PRESS_FRAMES], [0.965, 1], {
        easing: Easing.out(Easing.quad),
        extrapolateRight: "clamp",
      })
    : 1;
  const pressBright = pressed ? 1.15 : 1;

  const confirmPop = confirmed
    ? interpolate(frame - confirmedFrame, [0, 8], [0.92, 1], {
        easing: EASE_OUT,
        extrapolateRight: "clamp",
      })
    : 1;

  const approveBg = confirmed ? SUCCESS : GM_ELECTRIC;
  const approveGlow = confirmed
    ? "0 6px 22px rgba(31,184,119,0.45)"
    : "0 6px 22px rgba(45,91,255,0.45)";

  const rowText = "#C8D0E0";
  const labelText = "#8A92A6";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(160deg,#141B2D 0%,#0E1422 100%)",
        color: "#F5F7FA",
      }}
    >
      {/* Header: shield + wordmark + pending/confirmed pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: A_HEADER_H,
          padding: `0 ${PAD}px`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Shield size={24} color={FB_ORANGE} />
        <span
          style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}
        >
          Fireblocks
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 999,
            color: confirmed ? SUCCESS : AMBER,
            background: confirmed
              ? "rgba(31,184,119,0.12)"
              : "rgba(232,161,58,0.12)",
            border: `1px solid ${
              confirmed ? "rgba(31,184,119,0.35)" : "rgba(232,161,58,0.32)"
            }`,
          }}
        >
          {confirmed ? "Confirmed" : "Pending approval"}
        </span>
      </div>

      {/* Title */}
      <div style={{ padding: `16px ${PAD}px 0`, height: A_TITLE_H }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: labelText,
            marginBottom: 6,
          }}
        >
          Approve transaction
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {action}
        </div>
      </div>

      {/* Inner tab row (sliding indicator) */}
      <div style={{ position: "absolute", top: A_TAB_TOP, left: 0, right: 0 }}>
        <TabRow
          tabs={APPROVE_TABS}
          tabW={A_TAB_W}
          activeIdx={apIdx}
          height={A_TAB_H}
          variant="dark"
        />
      </div>

      {/* Transaction detail rows (the Details tab) */}
      <div
        style={{
          position: "absolute",
          top: A_ROWS_TOP,
          left: PAD,
          right: PAD,
        }}
      >
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "11px 0",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: labelText }}>
              {row.label}
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 500,
                color: rowText,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 220,
                textAlign: "right",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer buttons — pinned so the Approve center is fixed. */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          bottom: FOOTER_PAD_BOTTOM,
          display: "flex",
          gap: BTN_GAP,
        }}
      >
        <button
          style={{
            width: BTN_W,
            height: BTN_H,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "transparent",
            color: "#C8D0E0",
            fontFamily: font,
            fontSize: 16,
            fontWeight: 600,
            cursor: "default",
            opacity: confirming || confirmed ? 0.45 : 1,
          }}
        >
          Reject
        </button>

        <button
          style={{
            width: BTN_W,
            height: BTN_H,
            borderRadius: 12,
            border: "none",
            background: approveBg,
            color: "#FFFFFF",
            fontFamily: font,
            fontSize: 16,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "default",
            boxShadow: approveGlow,
            transform: `scale(${pressScale * confirmPop})`,
            filter: `brightness(${pressBright})`,
          }}
        >
          {confirmed ? (
            <>
              <Check size={20} color="#FFFFFF" />
              Approved
            </>
          ) : confirming ? (
            <>
              <Spinner size={20} frame={frame} color="#FFFFFF" />
              Confirming…
            </>
          ) : (
            "Approve"
          )}
        </button>
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export const WalletModal: React.FC<{
  action: string; // "Allocate counterparty" | "Sign & bind trade"
  rows: { label: string; value: string }[];
  startFrame: number; // connect modal appears
  approveFrame: number; // Approve pressed
  confirmedFrame: number; // flips to Approved
  connectFrame?: number; // when Fireblocks is picked → slide to approve phase
  dismissFrame?: number; // optional: scale + fade out from here
}> = ({
  action,
  rows,
  startFrame,
  approveFrame,
  confirmedFrame,
  connectFrame,
  dismissFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Default the Fireblocks pick to midway between appear and approve.
  const pick =
    connectFrame ?? Math.round((startFrame + approveFrame) / 2);

  // Entrance: spring pop of the box + backdrop fade-in.
  const inS = spring({
    fps,
    frame: frame - startFrame,
    config: HOUSE_SPRING.config,
    durationInFrames: HOUSE_SPRING.durationInFrames,
  });
  let boxScale = interpolate(inS, [0, 1], [0.94, 1]);
  let boxLift = interpolate(inS, [0, 1], [16, 0]);
  let backdrop = interpolate(frame - startFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let boxOpacity = backdrop;

  // Optional dismiss tail: scale down + fade (modal closing, not a scene cut).
  if (dismissFrame !== undefined && frame >= dismissFrame) {
    const out = interpolate(frame - dismissFrame, [0, 7], [0, 1], {
      easing: EASE_OUT,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    boxScale *= 1 - out * 0.05;
    boxLift += out * 12;
    boxOpacity *= 1 - out;
    backdrop *= 1 - out;
  }

  // Phase slide: connect panel exits left, approve panel enters right.
  const p = interpolate(frame - pick, [0, PHASE_SLIDE], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const connectX = -p * MODAL_W;
  const approveX = (1 - p) * MODAL_W;

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      {/* Dim backdrop over the whole canvas. */}
      <AbsoluteFill
        style={{
          background: `rgba(8,11,20,${0.55 * backdrop})`,
          backdropFilter: `blur(${2.5 * backdrop}px)`,
          WebkitBackdropFilter: `blur(${2.5 * backdrop}px)`,
        }}
      />

      {/* Centered modal box. */}
      <div
        style={{
          position: "absolute",
          left: MODAL_LEFT,
          top: MODAL_TOP,
          width: MODAL_W,
          height: MODAL_H,
          transform: `translateY(${boxLift}px) scale(${boxScale})`,
          opacity: boxOpacity,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${connectX}px)`,
          }}
        >
          <ConnectPanel frame={frame} startFrame={startFrame} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${approveX}px)`,
          }}
        >
          <ApprovePanel
            frame={frame}
            startFrame={pick}
            action={action}
            rows={rows}
            approveFrame={approveFrame}
            confirmedFrame={confirmedFrame}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
