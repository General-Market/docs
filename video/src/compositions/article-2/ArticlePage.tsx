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

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

const CircleBtn: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 56,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size,
      background: "rgba(38,38,42,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
    }}
  >
    {children}
  </div>
);

/** YouTube-style transport: red scrub bar + translucent controls. */
const PlayerChrome: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = 456 + frame / 30; // opens at 7:36 like the reference
  const total = 705; // 11:45
  const frac = sec / total;

  const trackLeft = 26;
  const trackW = W - trackLeft - 26;
  const playedW = trackW * frac;
  const bufferedW = trackW * Math.min(1, frac + 0.14);

  const Y_BAR = 1080 - 108;
  const Y_ROW = 1080 - 70;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 22, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: trackLeft,
          top: Y_BAR,
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
          top: Y_BAR,
          width: bufferedW,
          height: 5,
          borderRadius: 4,
          background: "rgba(150,150,154,0.55)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: trackLeft,
          top: Y_BAR,
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
          top: Y_BAR - 6.5,
          width: 18,
          height: 18,
          borderRadius: 18,
          background: "#FF1F44",
          boxShadow: "0 0 10px rgba(255,31,68,0.5)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 30,
          top: Y_ROW,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <CircleBtn>
          <svg width="22" height="24" viewBox="0 0 22 24">
            <path d="M2 2 L20 12 L2 22 Z" fill="#fff" />
          </svg>
        </CircleBtn>
        <CircleBtn>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <path d="M3 10 H8 L14 5 V21 L8 16 H3 Z" fill="#fff" />
            <path
              d="M17 8 C20 11 20 15 17 18"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </CircleBtn>
        <div
          style={{
            height: 56,
            padding: "0 22px",
            borderRadius: 980,
            background: "rgba(38,38,42,0.55)",
            display: "flex",
            alignItems: "center",
            fontFamily: SANS_TEXT,
            fontSize: 26,
            color: "#fff",
            letterSpacing: "0.2px",
          }}
        >
          {fmt(sec)} / {fmt(total)}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 30,
          top: Y_ROW,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 70,
            height: 40,
            borderRadius: 999,
            background: "rgba(38,38,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "0 6px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 28,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2 L10 6 L2 10 Z" fill="#16181D" />
            </svg>
          </div>
        </div>
        <CircleBtn size={48}>
          <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 800 }}>CC</span>
        </CircleBtn>
        <CircleBtn size={48}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3.4" fill="#fff" />
            <g fill="#fff">
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i * Math.PI) / 4;
                const x = 12 + Math.cos(a) * 8.5;
                const y = 12 + Math.sin(a) * 8.5;
                return (
                  <rect key={i} x={x - 1.6} y={y - 1.6} width={3.2} height={3.2} rx={0.8} />
                );
              })}
            </g>
          </svg>
        </CircleBtn>
        <CircleBtn size={48}>
          <svg width="26" height="22" viewBox="0 0 26 22">
            <path
              d="M9 6 L4 11 L9 16 M17 6 L22 11 L17 16"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CircleBtn>
        <CircleBtn size={48}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M3 9 V3 H9 M21 9 V3 H15 M3 15 V21 H9 M21 15 V21 H15"
              stroke="#fff"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CircleBtn>
      </div>
    </div>
  );
};

export interface ArticlePageProps {
  /** vertical scroll offset in px */
  scroll: number;
  /** when each proof phrase begins its orange wipe (ignored when `article` is given) */
  markTimes?: MarkTimes;
  /** override the headline/byline/body; defaults to the attention-volume story */
  article?: ArticleContent;
  /** V1 bottom blur ramp + channel watermark */
  bottomBlur?: boolean;
  /** YouTube-style transport */
  showChrome?: boolean;
  /** whole-page blur, e.g. for a focus-pull reveal */
  fullBlurPx?: number;
  opacity?: number;
}

export const ArticlePage: React.FC<ArticlePageProps> = ({
  scroll,
  markTimes = ZERO_MARKS,
  article,
  bottomBlur = false,
  showChrome = false,
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
          filter: fullBlurPx > 0 ? `blur(${fullBlurPx}px)` : undefined,
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
            {/* bottom blur ramp */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 460,
                zIndex: 20,
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 34%)",
                maskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 34%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 260,
                zIndex: 21,
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(244,244,246,0.7) 100%)",
              }}
            />
          </>
        )}

        {showChrome && <PlayerChrome />}
      </div>
    </AbsoluteFill>
  );
};
