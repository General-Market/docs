/**
 * WalletModal — a Fireblocks-style wallet approval popup for the UI walkthrough.
 *
 * When the walkthrough triggers an on-chain action (allocate a counterparty,
 * sign & bind a trade), this popup slides in from the top-right like a browser
 * wallet extension, shows the transaction it is about to sign, takes the click
 * on Approve, spins while confirming, then flips to a green "Approved" state.
 * It makes the walkthrough show real validation instead of magic.
 *
 * Everything is frame-driven (useCurrentFrame): the slide-in rides the house
 * spring, the press / spinner / success states are pure functions of the frame,
 * and the spinner rotates by frame angle — never a CSS @keyframe or transition,
 * so the same picture renders in Studio and headless.
 *
 * The popup geometry lives in module-level constants so WALLET_APPROVE_POINT —
 * the canvas-space center of the Approve button — is computed from the same
 * numbers the component lays out with, and the orchestrator can aim the Cursor
 * at it without guessing.
 *
 * Palette: a dark institutional wallet chrome (deep navy #0E1422 / #141B2D,
 * hairline borders, soft shadow) with the action on GM Electric (#2D5BFF) that
 * turns success-green (#1FB877) on confirm. Fonts from common/fonts.
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
import { CANVAS_W } from "./geometry";

const GM_ELECTRIC = "#2D5BFF";
const SUCCESS = "#1FB877";
const AMBER = "#E8A13A";

// House spring (GMStyle §6) — the one settle for arrivals.
const HOUSE_SPRING = {
  config: { mass: 0.6, damping: 16, stiffness: 120 },
  durationInFrames: 26,
};

// EASE.out (GMStyle §7) for the slide / fade tails.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Geometry (module-level so WALLET_APPROVE_POINT stays in lockstep) ─────────
export const WALLET_WIDTH = 420;
export const WALLET_HEIGHT = 470;
export const WALLET_TOP = 56;
export const WALLET_RIGHT = 56; // gap from the canvas right edge
export const WALLET_LEFT = CANVAS_W - WALLET_RIGHT - WALLET_WIDTH; // 1444

const PAD = 22; // panel inner side padding
const FOOTER_PAD_BOTTOM = 22;
const BTN_H = 50;
const BTN_GAP = 12;
const INNER_W = WALLET_WIDTH - PAD * 2; // 376
const BTN_W = (INNER_W - BTN_GAP) / 2; // 182

// Approve button center, relative to the panel, then mapped to canvas space.
const APPROVE_LEFT_REL = PAD + BTN_W + BTN_GAP; // reject | approve
const APPROVE_CX_REL = APPROVE_LEFT_REL + BTN_W / 2;
const APPROVE_TOP_REL = WALLET_HEIGHT - FOOTER_PAD_BOTTOM - BTN_H;
const APPROVE_CY_REL = APPROVE_TOP_REL + BTN_H / 2;

/** Canvas-space center of the Approve button — aim the cursor here. */
export const WALLET_APPROVE_POINT: { x: number; y: number } = {
  x: WALLET_LEFT + APPROVE_CX_REL,
  y: WALLET_TOP + APPROVE_CY_REL,
};

// Distance to park the panel fully off the right edge before it slides in.
const OFFSCREEN_X = WALLET_WIDTH + WALLET_RIGHT + 40;

// Frames the Approve press visibly stays depressed under the cursor.
const PRESS_FRAMES = 7;

// ── Glyphs ───────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export const WalletModal: React.FC<{
  action: string; // "Allocate counterparty" | "Sign & bind trade"
  rows: { label: string; value: string }[];
  startFrame: number;
  approveFrame: number;
  confirmedFrame: number;
  dismissFrame?: number; // optional: slide+fade out over ~6 frames from here
}> = ({ action, rows, startFrame, approveFrame, confirmedFrame, dismissFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide + spring in from the right.
  const inS = spring({
    fps,
    frame: frame - startFrame,
    config: HOUSE_SPRING.config,
    durationInFrames: HOUSE_SPRING.durationInFrames,
  });
  let translateX = interpolate(inS, [0, 1], [OFFSCREEN_X, 0]);
  let opacity = interpolate(frame - startFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Optional slide+fade out tail.
  if (dismissFrame !== undefined && frame >= dismissFrame) {
    const out = interpolate(frame - dismissFrame, [0, 6], [0, 1], {
      easing: EASE_OUT,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    translateX += out * OFFSCREEN_X;
    opacity *= 1 - out;
  }

  // Lifecycle states.
  const pressed = frame >= approveFrame && frame < approveFrame + PRESS_FRAMES;
  const confirming = frame >= approveFrame && frame < confirmedFrame;
  const confirmed = frame >= confirmedFrame;

  // Press dip: brief scale + brightness lift centred on the click.
  const pressScale = pressed
    ? interpolate(frame - approveFrame, [0, PRESS_FRAMES], [0.965, 1], {
        easing: Easing.out(Easing.quad),
        extrapolateRight: "clamp",
      })
    : 1;
  const pressBright = pressed ? 1.15 : 1;

  // Success pop on the moment of confirmation.
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
    <AbsoluteFill style={{ fontFamily: font }}>
      <div
        style={{
          position: "absolute",
          left: WALLET_LEFT,
          top: WALLET_TOP,
          width: WALLET_WIDTH,
          height: WALLET_HEIGHT,
          transform: `translateX(${translateX}px)`,
          opacity,
          background: "linear-gradient(160deg,#141B2D 0%,#0E1422 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset",
          color: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        {/* Header: shield + wordmark + pending/confirmed pill. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: `18px ${PAD}px 16px`,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Shield size={24} color={GM_ELECTRIC} />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#F5F7FA",
            }}
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

        {/* Title: the action being signed. */}
        <div style={{ padding: `18px ${PAD}px 4px` }}>
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
          <div
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            {action}
          </div>
        </div>

        {/* Transaction detail rows. */}
        <div style={{ padding: `14px ${PAD}px 0` }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "11px 0",
                borderTop:
                  i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span
                style={{ fontSize: 14, fontWeight: 500, color: labelText }}
              >
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

        {/* Footer buttons — absolutely pinned so the Approve center is fixed. */}
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
          {/* Reject (ghost). */}
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

          {/* Approve (filled brand → success). */}
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
    </AbsoluteFill>
  );
};
