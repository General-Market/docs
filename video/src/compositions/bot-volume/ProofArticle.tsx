import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ACCENT,
  ACCENT_HL,
  INK,
  INK_SOFT,
  NAV_BG,
  PAGE,
  SANS,
  SANS_TEXT,
  SERIF,
  W,
} from "../article-2/theme";
import type { Seg } from "./screens";

const NAV_H = 132;
const COL_W = 1180;

/** Accent highlighter that wipes in left-to-right; wraps cleanly across lines. */
const Mark: React.FC<{ children: React.ReactNode; at: number; dur?: number }> = ({
  children,
  at,
  dur = 16,
}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${ACCENT_HL}, ${ACCENT_HL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${reveal * 100}% 74%`,
        backgroundPositionY: "center",
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
        borderRadius: 3,
        padding: "0.02em 0.08em",
        margin: "0 -0.08em",
        color: INK,
      }}
    >
      {children}
    </span>
  );
};

const NavLink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: "rgba(255,255,255,0.82)" }}>{children}</span>
);

const Masthead: React.FC<{ brand: string }> = ({ brand }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: W,
      height: NAV_H,
      background: NAV_BG,
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      zIndex: 30,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 20,
        fontFamily: SERIF,
        fontWeight: 700,
        fontSize: 44,
        color: "#fff",
        letterSpacing: "-0.5px",
      }}
    >
      {brand}
    </div>
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 86,
        display: "flex",
        alignItems: "center",
        gap: 30,
        fontFamily: SANS_TEXT,
        fontSize: 20,
        letterSpacing: "-0.1px",
      }}
    >
      <span
        style={{
          color: "#ff3b30",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 9, background: "#ff3b30" }} />
        Live
      </span>
      <NavLink>Markets ⌄</NavLink>
      <NavLink>Economics</NavLink>
      <NavLink>Tech</NavLink>
      <NavLink>Opinion</NavLink>
      <NavLink>More ⌄</NavLink>
    </div>
  </div>
);

/** Thin YouTube-style scrub bar — sells the "found this in a clip" feel. */
const Chrome: React.FC = () => {
  const frame = useCurrentFrame();
  const frac = (456 + frame / 30) / 705;
  const trackLeft = 26;
  const trackW = W - trackLeft - 26;
  const playedW = trackW * frac;
  const Y = 1080 - 40;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 22, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: trackLeft,
          top: Y,
          width: trackW,
          height: 5,
          borderRadius: 4,
          background: "rgba(120,120,124,0.45)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: trackLeft,
          top: Y,
          width: playedW,
          height: 5,
          borderRadius: 4,
          background: "linear-gradient(90deg,#FF1F44,#FF5C8A)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: trackLeft + playedW - 9,
          top: Y - 6.5,
          width: 18,
          height: 18,
          borderRadius: 18,
          background: "#FF1F44",
          boxShadow: "0 0 10px rgba(255,31,68,0.5)",
        }}
      />
    </div>
  );
};

export interface ProofArticleProps {
  brand: string;
  title: string;
  author: string;
  date: string;
  paragraphs: Seg[][];
  scroll: number;
  fullBlurPx?: number;
  opacity?: number;
  /** local frame the first highlight begins wiping */
  markStart: number;
  /** frames between successive highlights */
  markGap: number;
  bottomBlur?: boolean;
  showChrome?: boolean;
}

export const ProofArticle: React.FC<ProofArticleProps> = ({
  brand,
  title,
  author,
  date,
  paragraphs,
  scroll,
  fullBlurPx = 0,
  opacity = 1,
  markStart,
  markGap,
  bottomBlur = false,
  showChrome = false,
}) => {
  const pStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontSize: 44,
    lineHeight: 1.55,
    color: INK,
    margin: "0 0 38px 0",
  };

  // Assign each marked run a sequential reveal time across the whole article.
  let markIdx = 0;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: fullBlurPx > 0 ? `blur(${fullBlurPx}px)` : undefined,
        }}
      >
        <AbsoluteFill style={{ backgroundColor: PAGE }} />

        <div
          style={{
            position: "absolute",
            top: NAV_H,
            left: 0,
            width: W,
            transform: `translateY(${-scroll}px)`,
            zIndex: 10,
          }}
        >
          <div style={{ width: COL_W, margin: "0 auto", paddingTop: 96, paddingBottom: 360 }}>
            <h1
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 64,
                lineHeight: 1.1,
                letterSpacing: "-1px",
                color: INK,
                margin: 0,
              }}
            >
              {title}
            </h1>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 26, color: INK, marginTop: 30 }}>
              By <span style={{ textDecoration: "underline" }}>{author}</span>
            </div>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 23, color: INK_SOFT, marginTop: 10 }}>
              {date}
            </div>

            <div style={{ height: 54 }} />

            {paragraphs.map((segs, pi) => (
              <p key={pi} style={pStyle}>
                {segs.map((seg, si) =>
                  seg.mark ? (
                    <Mark key={si} at={markStart + markGap * markIdx++}>
                      {seg.t}
                    </Mark>
                  ) : (
                    <span key={si}>{seg.t}</span>
                  ),
                )}
              </p>
            ))}
          </div>
        </div>

        <Masthead brand={brand} />

        {bottomBlur && (
          <>
            <div
              style={{
                position: "absolute",
                right: 64,
                top: 540,
                width: 54,
                height: 54,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${ACCENT}, #5AC8FA)`,
                opacity: 0.5,
                zIndex: 15,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 380,
                zIndex: 20,
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40%)",
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 40%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 220,
                zIndex: 21,
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(244,244,246,0.7) 100%)",
              }}
            />
          </>
        )}

        {showChrome && <Chrome />}
      </div>
    </AbsoluteFill>
  );
};
