import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ACCENT_HL, INK, INK_SOFT, SANS, SANS_TEXT, SERIF, W } from "../article-2/theme";
import type { BrandKey, Seg } from "./screens";

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
      }}
    >
      {children}
    </span>
  );
};

type BrandSpec = {
  page: string;
  ink: string;
  inkSoft: string;
  masthead: React.ReactNode;
};

const navStyle = (color: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 28,
  fontFamily: SANS_TEXT,
  fontSize: 20,
  letterSpacing: "-0.1px",
  color,
});

const liveDot = (
  <span style={{ color: "#ff3b30", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
    <span style={{ width: 9, height: 9, borderRadius: 9, background: "#ff3b30" }} />
    Live
  </span>
);

const BRANDS: Record<BrandKey, BrandSpec> = {
  // Financial Times — salmon paper, black serif wordmark.
  ft: {
    page: "#FFF1E5",
    ink: "#262A33",
    inkSoft: "#6B6258",
    masthead: (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#FFF1E5",
          borderBottom: "2px solid #1A1A1A",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 48,
            top: 26,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 46,
            color: "#1A1A1A",
            letterSpacing: "0.5px",
          }}
        >
          FINANCIAL TIMES
        </div>
        <div style={{ position: "absolute", left: 50, top: 90, ...navStyle("#33302E") }}>
          <span style={{ fontWeight: 700 }}>Markets</span>
          <span>Companies</span>
          <span>Opinion</span>
          <span>Tech</span>
          <span>Work &amp; Careers</span>
        </div>
      </div>
    ),
  },

  // Investing.com — dark navy bar, white wordmark with an orange ".com".
  investing: {
    page: "#ffffff",
    ink: INK,
    inkSoft: INK_SOFT,
    masthead: (
      <div style={{ position: "absolute", inset: 0, background: "#0E1420" }}>
        <div
          style={{
            position: "absolute",
            left: 48,
            top: 28,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 9,
              background: "#F5A623",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 26 26">
              <rect x="3" y="14" width="5" height="9" rx="1" fill="#0E1420" />
              <rect x="10.5" y="9" width="5" height="14" rx="1" fill="#0E1420" />
              <rect x="18" y="4" width="5" height="19" rx="1" fill="#0E1420" />
            </svg>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 38, letterSpacing: "-1px" }}>
            <span style={{ color: "#fff" }}>Investing</span>
            <span style={{ color: "#F5A623" }}>.com</span>
          </div>
        </div>
        <div style={{ position: "absolute", left: 50, top: 90, ...navStyle("rgba(255,255,255,0.82)") }}>
          {liveDot}
          <span>Markets</span>
          <span>Crypto</span>
          <span>News</span>
          <span>Analysis</span>
          <span>Tools</span>
        </div>
      </div>
    ),
  },

  // Bloomberg — black bar, white serif wordmark (the house reference look).
  bloomberg: {
    page: "#ffffff",
    ink: INK,
    inkSoft: INK_SOFT,
    masthead: (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#0B0B0C",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 48,
            top: 22,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 46,
            color: "#fff",
            letterSpacing: "-0.5px",
          }}
        >
          Bloomberg
        </div>
        <div style={{ position: "absolute", left: 50, top: 90, ...navStyle("rgba(255,255,255,0.82)") }}>
          {liveDot}
          <span>Markets ⌄</span>
          <span>Economics</span>
          <span>Technology</span>
          <span>Opinion</span>
        </div>
      </div>
    ),
  },
};

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
  brand: BrandKey;
  title: string;
  author: string;
  date: string;
  paragraphs: Seg[][];
  scroll: number;
  fullBlurPx?: number;
  opacity?: number;
  /** local frame each highlight begins wiping, in document order */
  markTimes: number[];
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
  markTimes,
  bottomBlur = false,
  showChrome = false,
}) => {
  const spec = BRANDS[brand];
  const pStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontSize: 44,
    lineHeight: 1.55,
    color: spec.ink,
    margin: "0 0 38px 0",
  };

  // Assign each marked run the next reveal time, in document order.
  let markIdx = 0;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          // Integer radius + an isolated GPU layer so the comp's scale transforms
          // a cached blurred bitmap instead of re-blurring every frame (the
          // shimmer source).
          filter: fullBlurPx > 0.5 ? `blur(${Math.round(fullBlurPx)}px)` : undefined,
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          willChange: "filter",
        }}
      >
        <AbsoluteFill style={{ backgroundColor: spec.page }} />

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
          <div style={{ width: COL_W, margin: "0 auto", paddingTop: 84, paddingBottom: 360 }}>
            <h1
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 64,
                lineHeight: 1.1,
                letterSpacing: "-1px",
                color: spec.ink,
                margin: 0,
              }}
            >
              {title}
            </h1>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 26, color: spec.ink, marginTop: 28 }}>
              By <span style={{ textDecoration: "underline" }}>{author}</span>
            </div>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 23, color: spec.inkSoft, marginTop: 10 }}>
              {date}
            </div>

            <div style={{ height: 52 }} />

            {paragraphs.map((segs, pi) => (
              <p key={pi} style={pStyle}>
                {segs.map((seg, si) =>
                  seg.mark ? (
                    <Mark key={si} at={markTimes[markIdx++] ?? 9999}>
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

        {/* masthead */}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: NAV_H, zIndex: 30 }}>
          {spec.masthead}
        </div>

        {bottomBlur && (
          <>
            {/* bottom fade — a plain gradient, not a backdrop-filter (which
                flickers frame-to-frame in Chromium renders) */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 360,
                zIndex: 21,
                background: `linear-gradient(to bottom, ${spec.page}00 0%, ${spec.page} 100%)`,
              }}
            />
          </>
        )}

        {showChrome && <Chrome />}
      </div>
    </AbsoluteFill>
  );
};
