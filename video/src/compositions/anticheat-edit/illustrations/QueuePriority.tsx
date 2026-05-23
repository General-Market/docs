import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// Cutting the line — two orders arrive at the same price and the same
// instant. The matching engine fills front-to-back. The MM's order springs
// to the FRONT of the queue; yours drops back. A second beat: an AMEND badge
// showing the MM can shrink its order without losing its place in line.
//
// Horizontal queue of slots. The front (fill point) is on the LEFT.
// Resting filler orders sit in the middle slots; the two contested orders
// (YOU and MM, both "@10") animate into their final positions.

const QUEUE_Y = 470;
const SLOT_W = 150;
const SLOT_H = 116;
const GAP = 22;
const STEP = SLOT_W + GAP;
const SLOTS = 6;
const QUEUE_LEFT = (1920 - (SLOTS * SLOT_W + (SLOTS - 1) * GAP)) / 2;

const slotX = (i: number): number => QUEUE_LEFT + i * STEP;

const Slot: React.FC<{ index: number; delay: number }> = ({ index, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: slotX(index),
        top: QUEUE_Y - SLOT_H / 2,
        width: SLOT_W,
        height: SLOT_H,
        borderRadius: 14,
        border: "1.5px dashed rgba(255,255,255,0.20)",
        opacity: op,
      }}
    />
  );
};

const Order: React.FC<{
  label: string;
  price: string;
  slot: number; // final slot index
  fromSlot: number; // where it appears before springing
  highlight: boolean;
  delay: number;
  amend?: boolean;
}> = ({ label, price, slot, fromSlot, highlight, delay, amend }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const move = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.7, damping: 16, stiffness: 110 },
    durationInFrames: 26,
  });
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(move, [0, 1], [slotX(fromSlot), slotX(slot)]);

  // amend badge: appears later, then the order visibly shrinks a touch
  const amendOp = amend
    ? interpolate(frame, [88, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const shrink = amend
    ? interpolate(frame, [96, 112], [1, 0.82], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const fill = highlight ? "rgba(91,121,255,0.26)" : "rgba(255,255,255,0.07)";
  const border = highlight ? scene.accentSoft : "rgba(255,255,255,0.30)";

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: QUEUE_Y - (SLOT_H * shrink) / 2,
          width: SLOT_W,
          height: SLOT_H * shrink,
          borderRadius: 14,
          background: fill,
          border: `1.5px solid ${border}`,
          boxShadow: highlight
            ? `0 0 0 1px ${scene.accentSoft} inset, 0 16px 40px rgba(0,82,255,0.32)`
            : "0 14px 32px rgba(2,14,43,0.40)",
          opacity: op,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: highlight ? scene.accentSoft : scene.ink,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: scene.inkDim,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {price}
        </div>
      </div>

      {amend ? (
        <div
          style={{
            position: "absolute",
            left: x + SLOT_W - 28,
            top: QUEUE_Y - (SLOT_H * shrink) / 2 - 22,
            opacity: amendOp,
            padding: "6px 12px",
            borderRadius: 999,
            background: scene.accentSoft,
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: scene.blueAbyss,
            boxShadow: "0 10px 24px rgba(0,82,255,0.40)",
            whiteSpace: "nowrap",
          }}
        >
          Amend · keeps place
        </div>
      ) : null}
    </>
  );
};

export const QueuePriority: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOp = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 08 / 13" title="Cutting the line">
      <AbsoluteFill>
        {/* FILLS HERE marker on the left edge of the queue */}
        <div
          style={{
            position: "absolute",
            left: slotX(0) - 6,
            top: QUEUE_Y - SLOT_H / 2 - 56,
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.accentSoft,
            opacity: labelOp,
          }}
        >
          ↓ Fills here · front of queue
        </div>

        {/* empty slot guides */}
        {Array.from({ length: SLOTS }).map((_, i) => (
          <Slot key={i} index={i} delay={12 + i * 1.2} />
        ))}

        {/* resting filler orders (neutral) in middle slots */}
        <Order label="—" price="@10" slot={2} fromSlot={2} highlight={false} delay={20} />
        <Order label="—" price="@10" slot={3} fromSlot={3} highlight={false} delay={24} />

        {/* MM springs to the FRONT (slot 0), appearing from the back */}
        <Order label="MM" price="@10" slot={0} fromSlot={4} highlight delay={44} amend />

        {/* YOU drops back (slot 4), appearing from the front */}
        <Order label="YOU" price="@10" slot={4} fromSlot={1} highlight={false} delay={52} />

        {/* arrow showing simultaneity at top */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: QUEUE_Y + SLOT_H / 2 + 70,
            textAlign: "center",
            opacity: interpolate(frame, [60, 74], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: scene.ink,
            }}
          >
            Same price, same instant —{" "}
          </span>
          <span
            style={{
              fontFamily: font,
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: scene.accentSoft,
            }}
          >
            theirs fills first
          </span>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
