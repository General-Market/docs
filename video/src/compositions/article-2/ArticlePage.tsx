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
} from "./theme";

const NAV_H = 150;
const COL_W = 1180;

/** The frame each proof phrase begins its orange wipe. */
export type MarkTimes = {
  precedes: number;
  driver: number;
  onePct: number;
  third: number;
};

const ZERO_MARKS: MarkTimes = { precedes: 0, driver: 0, onePct: 0, third: 0 };

/** A run of body text: plain string, or an orange-wiped proof phrase. */
export type ArticleSegment = string | { mark: string; at: number; dur?: number };

/** Everything the Bloomberg shell needs to render a story. */
export type ArticleContent = {
  headline: string;
  byline: string;
  dateline: string;
  paragraphs: ArticleSegment[][];
};

/** The original attention-volume story, marks wired to {@link MarkTimes}. */
const defaultArticle = (m: MarkTimes): ArticleContent => ({
  headline: "Tweets Move Markets: Online Attention Now Drives Trading Volume",
  byline: "Olivia Raeburn",
  dateline: "May 22, 2026 at 9:14 AM EST",
  paragraphs: [
    [
      "A spike in Twitter impressions now reliably ",
      { mark: "precedes a jump in trading volume", at: m.precedes },
      ", and the link is no longer anecdotal.",
    ],
    [
      "Across four years of market data, the number of tweets was a ",
      { mark: "significant driver of next-day trading volume", at: m.driver },
      " — even after controlling for price and volatility.",
    ],
    [
      "The effect is proportional. Every ",
      { mark: "1% rise in impressions", at: m.onePct, dur: 12 },
      " lifts the following day’s volume by about ",
      { mark: "0.33%", at: m.third, dur: 12 },
      ".",
    ],
    [
      "The pattern holds across equities and crypto alike, and it runs strongest in the hours after a name suddenly goes viral.",
    ],
  ],
});

/** Orange highlighter that wipes in left-to-right. */
const Mark: React.FC<{
  children: React.ReactNode;
  at: number;
  dur?: number;
}> = ({ children, at, dur = 14 }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: -7,
          right: -7,
          top: "0.07em",
          bottom: "0.09em",
          background: ACCENT_HL,
          transform: `scaleX(${reveal})`,
          transformOrigin: "left center",
          borderRadius: 3,
          boxShadow: reveal > 0.02 ? `0 0 0 0.5px ${ACCENT_HL}` : "none",
        }}
      />
      <span style={{ position: "relative" }}>{children}</span>
    </span>
  );
};

const NavLink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: "rgba(255,255,255,0.82)" }}>{children}</span>
);

const Masthead: React.FC = () => (
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
        top: 22,
        fontFamily: SERIF,
        fontWeight: 700,
        fontSize: 47,
        color: "#fff",
        letterSpacing: "-0.5px",
      }}
    >
      Bloomberg
    </div>
    <div
      style={{
        position: "absolute",
        right: 54,
        top: 16,
        width: 58,
        height: 58,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SERIF,
        fontWeight: 800,
        fontSize: 50,
        color: "#fff",
        letterSpacing: "-2px",
      }}
    >
      ฿
    </div>
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 98,
        display: "flex",
        alignItems: "center",
        gap: 30,
        fontFamily: SANS_TEXT,
        fontSize: 21,
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
        Live TV
      </span>
      <NavLink>Markets ⌄</NavLink>
      <NavLink>Economics</NavLink>
      <NavLink>Industries</NavLink>
      <NavLink>Tech</NavLink>
      <NavLink>Politics</NavLink>
      <NavLink>Businessweek</NavLink>
      <NavLink>Opinion</NavLink>
      <NavLink>Video</NavLink>
      <NavLink>More ⌄</NavLink>
    </div>
  </div>
);

export interface ArticlePageProps {
  /** vertical scroll offset in px */
  scroll: number;
  /** when each proof phrase begins its orange wipe (ignored when `article` is given) */
  markTimes?: MarkTimes;
  /** override the headline/byline/body; defaults to the attention-volume story */
  article?: ArticleContent;
  /** V1 bottom blur ramp + channel watermark */
  bottomBlur?: boolean;
  /** whole-page blur, e.g. for a focus-pull reveal */
  fullBlurPx?: number;
  opacity?: number;
}

export const ArticlePage: React.FC<ArticlePageProps> = ({
  scroll,
  markTimes = ZERO_MARKS,
  article,
  bottomBlur = false,
  fullBlurPx = 0,
  opacity = 1,
}) => {
  const content = article ?? defaultArticle(markTimes);
  const pStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontSize: 42,
    lineHeight: 1.55,
    color: INK,
    margin: "0 0 40px 0",
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          // Integer radius + an isolated GPU layer: when the comp scales this
          // page, the blurred bitmap is transformed, not re-blurred every frame,
          // which is what made the blur shimmer.
          filter: fullBlurPx > 0.5 ? `blur(${Math.round(fullBlurPx)}px)` : undefined,
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          willChange: "filter",
        }}
      >
        <AbsoluteFill style={{ backgroundColor: PAGE }} />

        {/* scrolling article body */}
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
          <div style={{ width: COL_W, margin: "0 auto", paddingTop: 64, paddingBottom: 420 }}>
            <h1
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 62,
                lineHeight: 1.1,
                letterSpacing: "-1px",
                color: INK,
                margin: 0,
              }}
            >
              {content.headline}
            </h1>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 27, color: INK, marginTop: 34 }}>
              By <span style={{ textDecoration: "underline" }}>{content.byline}</span>
            </div>
            <div style={{ fontFamily: SANS_TEXT, fontSize: 24, color: INK_SOFT, marginTop: 10 }}>
              {content.dateline}
            </div>

            <div style={{ height: 56 }} />

            {content.paragraphs.map((segments, pi) => (
              <p key={pi} style={pStyle}>
                {segments.map((seg, si) =>
                  typeof seg === "string" ? (
                    <React.Fragment key={si}>{seg}</React.Fragment>
                  ) : (
                    <Mark key={si} at={seg.at} dur={seg.dur}>
                      {seg.mark}
                    </Mark>
                  ),
                )}
              </p>
            ))}
          </div>
        </div>

        <Masthead />

        {bottomBlur && (
          <>
            {/* channel watermark */}
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
                background:
                  "linear-gradient(to bottom, rgba(244,244,246,0) 0%, rgba(244,244,246,0.92) 100%)",
              }}
            />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
