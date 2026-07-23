import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { FPS, H, W } from "../theme";

// The Course — a landing page for the lie. Polished trading-course chrome,
// iceberg as the hero marketing image, six course modules across the
// bottom. As we descend, modules tick off. The brochure is the lie.

const SCENE_FRAMES = 90;

const MODULES = [
  "Strategy",
  "Fees",
  "Liq hunters",
  "Front runners",
  "Spoofers",
  "Insiders",
];

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

export const Proposal03Course: React.FC = () => {
  const frame = useCurrentFrame();

  const pageIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const navIn = interpolate(frame, [0, 16], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleA = interpolate(frame, [10, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [10, 32], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroA = interpolate(frame, [16, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroScale = interpolate(frame, [16, 42], [1.06, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const modsA = interpolate(frame, [26, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const proofA = interpolate(frame, [32, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counter ticking up to 50,000 students
  const enrolled = Math.round(
    interpolate(frame, [30, 80], [49873, 50214], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fafafa",
        fontFamily: font,
        opacity: pageIn,
      }}
    >
      {/* Nav */}
      <div
        style={{
          height: 88,
          borderBottom: "1px solid #e8e8ec",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "saturate(180%) blur(20px)",
          transform: `translateY(${navIn.toFixed(2)}px)`,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0071e3",
            letterSpacing: "-0.018em",
            marginRight: 64,
          }}
        >
          edgeacademy
        </div>
        <div
          style={{
            display: "flex",
            gap: 36,
            fontSize: 15,
            color: "#515154",
            flex: 1,
          }}
        >
          <span>Curriculum</span>
          <span>Mentors</span>
          <span>Proof</span>
          <span>Pricing</span>
          <span>Login</span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#0071e3",
            padding: "10px 22px",
            borderRadius: 980,
          }}
        >
          Enroll →
        </div>
      </div>

      {/* Hero — split left/right */}
      <div
        style={{
          position: "absolute",
          inset: "88px 0 220px 0",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          padding: "60px 80px 0",
          gap: 36,
        }}
      >
        {/* Copy */}
        <div style={{ paddingTop: 28 }}>
          <div
            style={{
              fontSize: 14,
              color: "#0071e3",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 16,
              opacity: titleA,
              transform: `translateY(${titleY}px)`,
            }}
          >
            12-Week Program · Cohort 47
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: "#515154",
              letterSpacing: "-0.014em",
              marginBottom: 6,
              opacity: titleA,
              transform: `translateY(${titleY}px)`,
            }}
          >
            Master your
          </div>
          <div
            style={{
              fontSize: 158,
              fontWeight: 800,
              color: "#1d1d1f",
              letterSpacing: "-0.028em",
              lineHeight: 0.96,
              marginBottom: 24,
              opacity: titleA,
              transform: `translateY(${titleY}px)`,
            }}
          >
            strategy.
          </div>

          <div
            style={{
              fontSize: 19,
              color: "#6e6e73",
              lineHeight: 1.5,
              maxWidth: 560,
              marginBottom: 28,
              opacity: heroA,
            }}
          >
            Stop blaming the market. Stop revenge trading. Build the discipline
            of consistently profitable retail traders.
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 26,
              opacity: heroA,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#1d1d1f",
                padding: "14px 26px",
                borderRadius: 980,
              }}
            >
              Enroll · $499
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1d1d1f",
                border: "1px solid #d2d2d7",
                padding: "13px 26px",
                borderRadius: 980,
              }}
            >
              Watch trailer
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 14,
              color: "#86868b",
              opacity: proofA,
            }}
          >
            <span style={{ color: "#ff9500", fontSize: 18, letterSpacing: 0 }}>
              ★★★★★
            </span>
            <span>
              4.9 ·{" "}
              <span style={{ color: "#1d1d1f", fontWeight: 600 }}>
                {enrolled.toLocaleString("en-US")}
              </span>{" "}
              students enrolled
            </span>
          </div>
        </div>

        {/* Visual — iceberg as hero marketing image */}
        <div
          style={{
            position: "relative",
            transform: `scale(${heroScale})`,
            opacity: heroA,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.16), 0 12px 30px rgba(0,0,0,0.08)",
              background: "#000",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "-12%",
                width: IMG_NATIVE_W * 0.7,
                height: IMG_NATIVE_H * 0.7,
                transform: "translateX(-50%)",
              }}
            >
              <Img
                src={staticFile("iceberg-tiers-clean.webp")}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  filter: "saturate(0.95) brightness(1.02)",
                }}
              />
            </div>
            {/* Subtle glass shine on the framed image */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 30%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Cohort badge */}
          <div
            style={{
              position: "absolute",
              top: 30,
              right: -16,
              background: "#fff",
              borderRadius: 980,
              padding: "10px 18px 10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 10px 26px rgba(0,0,0,0.14)",
              opacity: proofA,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                background: "#34c759",
                borderRadius: 999,
                boxShadow: "0 0 0 4px rgba(52,199,89,0.18)",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "#1d1d1f",
                fontWeight: 600,
                letterSpacing: "-0.008em",
              }}
            >
              Cohort starts Monday
            </span>
          </div>
        </div>
      </div>

      {/* Modules — runs along the bottom; T0 = Strategy active */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 76,
          display: "flex",
          gap: 12,
          opacity: modsA,
          transform: `translateY(${(1 - modsA) * 12}px)`,
        }}
      >
        {MODULES.map((label, i) => {
          const active = i === 0;
          const isLast = i === MODULES.length - 1;
          return (
            <div
              key={label}
              style={{
                flex: 1,
                padding: "16px 20px",
                borderRadius: 14,
                background: active ? "#1d1d1f" : "#f5f5f7",
                border: `1px solid ${active ? "#1d1d1f" : "#e8e8ec"}`,
                color: active ? "#fff" : "#6e6e73",
                fontSize: 17,
                fontWeight: 500,
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                letterSpacing: "-0.012em",
              }}
            >
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  color: active ? "rgba(255,255,255,0.55)" : "#86868b",
                  fontWeight: 700,
                }}
              >
                0{i + 1}
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {isLast && (
                <span
                  style={{
                    color: "#ff453a",
                    fontWeight: 800,
                    fontSize: 14,
                    marginLeft: 4,
                  }}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer microcopy */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 32,
          fontFamily: monoFont,
          fontSize: 12,
          letterSpacing: "0.24em",
          color: "#86868b",
          textTransform: "uppercase",
          opacity: proofA,
        }}
      >
        <span style={{ color: "#1d1d1f", fontWeight: 600 }}>
          Reason 01 / 06
        </span>
        &nbsp;&nbsp;·&nbsp;&nbsp;the brochure for the lie
      </div>
    </AbsoluteFill>
  );
};

export const proposal03CourseMeta = {
  id: "Proposal03-Course",
  component: Proposal03Course,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
