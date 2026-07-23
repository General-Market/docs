import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { FPS, H, W } from "../theme";

// The Phone — the lie lives in a phone. Red P&L, a confessional note
// "I just need to fix my strategy." Apple dot-grid background, big bold
// "I lost because of strategy" on the left. The iceberg never appears
// at T0 — it's still in the device.

const SCENE_FRAMES = 90;

const PHONE_W = 470;
const PHONE_H = 970;

export const Proposal02Phone: React.FC = () => {
  const frame = useCurrentFrame();

  const bgIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneFly = interpolate(frame, [8, 38], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneA = interpolate(frame, [8, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneRot = interpolate(frame, [8, 90], [-7, -4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleA = interpolate(frame, [22, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [22, 46], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const noteA = interpolate(frame, [46, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f5f5f7",
        fontFamily: font,
        opacity: bgIn,
      }}
    >
      {/* Apple dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Soft blue spotlight behind the phone */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(40% 50% at 72% 50%, rgba(0,113,227,0.10) 0%, rgba(0,113,227,0) 70%)",
        }}
      />

      {/* Title on the left */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 220,
          color: "#1d1d1f",
          opacity: titleA,
          transform: `translateY(${titleY}px)`,
          maxWidth: 880,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: "rgba(29,29,31,0.62)",
            letterSpacing: "-0.012em",
            marginBottom: 12,
          }}
        >
          I lost because of
        </div>
        <div
          style={{
            fontSize: 184,
            fontWeight: 800,
            letterSpacing: "-0.028em",
            lineHeight: 0.96,
          }}
        >
          strategy
        </div>

        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e8e8ec",
            borderRadius: 999,
            fontFamily: font,
            fontSize: 16,
            color: "#1d1d1f",
            boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
            opacity: noteA,
            transform: `translateY(${(1 - noteA) * 8}px)`,
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "#86868b",
              textTransform: "uppercase",
            }}
          >
            Exhibit A
          </span>
          <span style={{ color: "#86868b" }}>·</span>
          <span style={{ fontStyle: "italic", color: "#1d1d1f" }}>
            "I just need to fix my strategy."
          </span>
        </div>
      </div>

      {/* Phone */}
      <div
        style={{
          position: "absolute",
          right: 110,
          top: H / 2 - PHONE_H / 2,
          width: PHONE_W,
          height: PHONE_H,
          background: "#1c1c1e",
          borderRadius: 56,
          boxShadow:
            "0 60px 120px rgba(0,0,0,0.32), 0 24px 50px rgba(0,0,0,0.22), inset 0 0 0 8px #0a0a0c",
          overflow: "hidden",
          transform: `translateY(${phoneFly}px) rotate(${phoneRot}deg)`,
          opacity: phoneA,
        }}
      >
        {/* Dynamic island */}
        <div
          style={{
            position: "absolute",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            width: 132,
            height: 36,
            background: "#000",
            borderRadius: 18,
            zIndex: 3,
          }}
        />

        {/* Screen */}
        <div
          style={{
            position: "absolute",
            inset: 10,
            background: "#fff",
            borderRadius: 48,
            overflow: "hidden",
          }}
        >
          {/* Status bar */}
          <div
            style={{
              padding: "20px 36px 0",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 600,
              color: "#000",
            }}
          >
            <span>9:41</span>
            <span>● ● ●</span>
          </div>

          {/* Header */}
          <div style={{ padding: "44px 28px 0" }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                letterSpacing: "0.16em",
                color: "#86868b",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Retail Trading App
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1d1d1f" }}>
              Portfolio
            </div>
          </div>

          {/* Balance */}
          <div style={{ padding: "26px 28px 0" }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                letterSpacing: "0.16em",
                color: "#86868b",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Today
            </div>
            <div
              style={{
                fontSize: 60,
                fontWeight: 700,
                color: "#d70015",
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              −${(847.23 - (frame % 5) * 0.41).toFixed(2)}
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#d70015",
                marginTop: 6,
                fontWeight: 500,
              }}
            >
              ▼ 12.4%&nbsp;&nbsp;·&nbsp;&nbsp;since open
            </div>
          </div>

          {/* Chart */}
          <div
            style={{
              margin: "28px 22px 0",
              height: 280,
              background:
                "linear-gradient(180deg, rgba(255,59,48,0.06) 0%, rgba(255,255,255,0) 100%)",
              position: "relative",
            }}
          >
            <svg
              viewBox="0 0 200 80"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%" }}
            >
              <defs>
                <linearGradient id="redfade" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#ff3b30" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#ff3b30" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,18 L18,12 L36,22 L54,16 L72,30 L90,28 L108,42 L126,38 L144,52 L162,48 L180,62 L200,70 L200,80 L0,80 Z"
                fill="url(#redfade)"
              />
              <path
                d="M0,18 L18,12 L36,22 L54,16 L72,30 L90,28 L108,42 L126,38 L144,52 L162,48 L180,62 L200,70"
                stroke="#ff3b30"
                strokeWidth="1.8"
                fill="none"
              />
            </svg>
          </div>

          {/* Confessional note tag */}
          <div
            style={{
              margin: "32px 22px 0",
              padding: "16px 18px",
              background: "#f2f2f7",
              borderRadius: 18,
              fontSize: 17,
              color: "#1d1d1f",
              lineHeight: 1.4,
              opacity: noteA,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: "#86868b",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Today's note
            </div>
            <span style={{ color: "#1d1d1f" }}>
              I just need to fix my{" "}
              <span style={{ fontWeight: 700 }}>strategy</span>.
            </span>
          </div>
        </div>
      </div>

      {/* Footer caption */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 64,
          fontFamily: monoFont,
          fontSize: 14,
          letterSpacing: "0.24em",
          color: "rgba(29,29,31,0.45)",
          textTransform: "uppercase",
          opacity: noteA,
        }}
      >
        <span style={{ color: "#1d1d1f", fontWeight: 600 }}>Reason 01 / 06</span>
        &nbsp;&nbsp;·&nbsp;&nbsp;one of the lies
      </div>
    </AbsoluteFill>
  );
};

export const proposal02PhoneMeta = {
  id: "Proposal02-Phone",
  component: Proposal02Phone,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
