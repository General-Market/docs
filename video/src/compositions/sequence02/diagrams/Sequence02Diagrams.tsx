/**
 * Sequence02 diagrams — tutorial grammar, sized for the content area next
 * to the webcam rect. Five scenes, each a self-contained card with 2-3
 * beats that land on the voice track.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE, PANEL, FONT, SPACE } from "../../tutorial/designTokens";
import { Sfx } from "../../tutorial/components/Sfx";
import {
  PLOB,
  PLOB_BG,
  TEXT_IN,
  TICK,
  TICK_SOFT,
  COUNT,
  MONEY,
  LAND,
  REVEAL,
  IMPACT,
  RAPID_POP,
  SWOOSH,
} from "../../tutorial/sfxMap";
import { getContentArea } from "../scenes";
import type { Rect } from "../../endcard/layout";
import { FPS, toFrames } from "../theme";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ── Scene anchors ────────────────────────────────────────────────────────

const SCENE2_START = 4.56;
const SCENE2_END = 13.92;
const SCENE3_START = 13.92;
const SCENE3_END = 24.40;
const SCENE5_START = 30.08;
const SCENE5_END = 37.28;
const SCENE6_START = 37.28;
const SCENE6_END = 46.48;
const SCENE8_START = 52.00;
const SCENE8_END = 60.56;

// Delay each diagram's mount slightly after scene start so the webcam rect
// lerp settles before the card lands.
const MOUNT_OFFSET = 10; // frames

// ── ContentAreaCard ──────────────────────────────────────────────────────
// White panel positioned inside the scene's content-area rect. Mirrors
// tutorial's DiagramCard entrance — 16-frame rise, 3→0 blur, 0.97→1 scale.

const ContentAreaCard: React.FC<{
  area: Rect;
  duration: number;
  children: React.ReactNode;
  padding?: string;
}> = ({ area, duration, children, padding = "32px 36px" }) => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 16], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const y = interpolate(enter, [0, 1], [24, 0], clamp);
  const scale = interpolate(enter, [0, 1], [0.97, 1], clamp);
  const blur = interpolate(enter, [0, 1], [3, 0], clamp);

  const exit = interpolate(
    frame,
    [duration - 16, duration],
    [1, 0],
    clamp,
  );

  const opacity = enter * exit;

  const INSET = 12;
  return (
    <div
      style={{
        position: "absolute",
        left: area.x + INSET,
        top: area.y + INSET,
        width: area.w - INSET * 2,
        height: area.h - INSET * 2,
        background: COLOR.bg,
        borderRadius: 30,
        border: `1px solid ${COLOR.border}`,
        boxShadow:
          "rgba(14,15,12,0.12) 0px 0px 0px 1px, 0 40px 120px rgba(0,0,0,0.45)",
        padding,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        filter: blur > 0.05 ? `blur(${blur}px)` : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT.body,
      }}
    >
      {children}
    </div>
  );
};

// ── Header stanza ────────────────────────────────────────────────────────
// Matches tutorial's "big green word + gray subtitle" header.

const Header: React.FC<{
  big: string;
  small: string;
  bigSize?: number;
  smallSize?: number;
  marginBottom?: number;
}> = ({ big, small, bigSize = 72, smallSize = 30, marginBottom = 28 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 18,
      marginBottom,
      flexWrap: "wrap",
    }}
  >
    <span
      style={{
        ...TYPE.sectionHeading,
        fontSize: bigSize,
        color: COLOR.wiseGreen,
      }}
    >
      {big}
    </span>
    <span
      style={{
        ...TYPE.cardTitle,
        fontSize: smallSize,
        color: COLOR.gray,
      }}
    >
      {small}
    </span>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// Scene 2 — The 70% pyramid (right-medium, content on left)
// ═════════════════════════════════════════════════════════════════════════

const TOTAL_TRADERS = 2000;
const GRID_COLS = 10;
const GRID_ROWS = 8;
const INSIDER_IDX = 3; // second row, 4th col — reads top-left area
const POOL_START = 1_000_000;
const INSIDER_TAKE = 700_000;

const PyramidBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat milestones (scene-local seconds)
  const B2_START = sec(3.0);
  const B3_START = sec(5.2);

  // Beat 1 — swarm + pool count
  const gridCells = GRID_COLS * GRID_ROWS;
  const traderCount = interpolate(
    frame,
    [sec(0.6), sec(2.6)],
    [0, TOTAL_TRADERS],
    { ...clamp, easing: EASE_OUT },
  );
  const poolValue = interpolate(
    frame,
    [sec(0.9), sec(2.9)],
    [0, POOL_START],
    { ...clamp, easing: EASE_OUT },
  );

  // Beat 2 — the pick
  const pickProgress = spring({
    frame: Math.max(0, frame - B2_START),
    fps,
    config: { damping: 11, stiffness: 180, mass: 0.9 },
  });
  const dimFactor = interpolate(pickProgress, [0, 1], [1, 0.28], clamp);

  // Beat 3 — siphon + banner
  const siphon = interpolate(
    frame,
    [B3_START, B3_START + sec(1.8)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  const poolDrained = interpolate(
    siphon,
    [0, 1],
    [POOL_START, POOL_START - INSIDER_TAKE],
    clamp,
  );
  const insiderCounter = interpolate(
    siphon,
    [0, 1],
    [0, INSIDER_TAKE],
    clamp,
  );
  const bannerSpring = spring({
    frame: Math.max(0, frame - (B3_START + sec(1.4))),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
  });

  const CELL = 48;
  const GAP = 8;
  const gridW = GRID_COLS * CELL + (GRID_COLS - 1) * GAP;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="2,000" small="traders · one market" bigSize={80} />

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flex: 1,
        }}
      >
        {/* Grid */}
        <div style={{ width: gridW }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            {Array.from({ length: gridCells }).map((_, i) => {
              const s = spring({
                frame: Math.max(0, frame - i * 1.2),
                fps,
                config: { damping: 18, stiffness: 200, mass: 0.4 },
              });
              const isInsider = i === INSIDER_IDX;
              const bg = isInsider
                ? COLOR.wiseGreen
                : frame >= B2_START
                  ? COLOR.lightSurface
                  : COLOR.lightMint;
              const border = isInsider
                ? `2px solid ${COLOR.darkGreen}`
                : `1px solid ${COLOR.border}`;
              const insiderScale = isInsider
                ? interpolate(pickProgress, [0, 1], [1, 1.35], clamp)
                : 1;
              const cellOpacity = isInsider ? 1 : dimFactor;
              return (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 10,
                    background: bg,
                    border,
                    opacity: s * cellOpacity,
                    transform: `scale(${interpolate(
                      s,
                      [0, 1],
                      [0.6, 1],
                      clamp,
                    )}) scale(${insiderScale})`,
                    boxShadow: isInsider
                      ? `0 6px 20px rgba(22,51,0,0.35)`
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Trader counter under grid */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <span
              style={{
                ...TYPE.statValue,
                fontSize: 48,
                color: COLOR.nearBlack,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(traderCount).toLocaleString()}
            </span>
            <span style={{ ...TYPE.caption, fontSize: 22 }}>traders</span>
          </div>

          {/* Pick label */}
          {frame >= B2_START + sec(0.4) && (
            <div
              style={{
                marginTop: 14,
                ...TYPE.bodySemibold,
                fontSize: 26,
                color: COLOR.darkGreen,
                opacity: interpolate(
                  frame,
                  [B2_START + sec(0.4), B2_START + sec(0.9)],
                  [0, 1],
                  clamp,
                ),
              }}
            >
              The insider.
            </div>
          )}
        </div>

        {/* Pool side */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              ...PANEL.greenAccent,
              padding: "20px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ ...TYPE.label, fontSize: 20, marginBottom: 6 }}>
              Profit pool
            </div>
            <div
              style={{
                ...TYPE.statValue,
                fontSize: 52,
                color: COLOR.darkGreen,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              $
              {Math.round(
                frame < B3_START ? poolValue : poolDrained,
              ).toLocaleString()}
            </div>
          </div>

          {/* Insider take (beat 3) */}
          {frame >= B3_START && (
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 22,
                background: COLOR.lightMint,
                border: `2px solid ${COLOR.wiseGreen}`,
                textAlign: "center",
                opacity: interpolate(
                  frame,
                  [B3_START, B3_START + sec(0.4)],
                  [0, 1],
                  clamp,
                ),
                transform: `translateY(${interpolate(
                  frame,
                  [B3_START, B3_START + sec(0.4)],
                  [12, 0],
                  clamp,
                )}px)`,
              }}
            >
              <div
                style={{
                  ...TYPE.label,
                  fontSize: 20,
                  marginBottom: 6,
                  color: COLOR.darkGreen,
                }}
              >
                To one trader
              </div>
              <div
                style={{
                  ...TYPE.statValue,
                  fontSize: 44,
                  color: COLOR.darkGreen,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                +${Math.round(insiderCounter).toLocaleString()}
              </div>
            </div>
          )}

          {/* Banner */}
          {bannerSpring > 0.01 && (
            <div
              style={{
                marginTop: "auto",
                padding: "18px 24px",
                borderRadius: 20,
                background: COLOR.nearBlack,
                color: COLOR.white,
                opacity: bannerSpring,
                transform: `scaleX(${interpolate(
                  bannerSpring,
                  [0, 1],
                  [0.82, 1],
                  clamp,
                )})`,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  ...TYPE.displayHero,
                  fontSize: 64,
                  color: COLOR.wiseGreen,
                  lineHeight: 1,
                }}
              >
                70%
              </span>
              <span
                style={{
                  ...TYPE.cardTitle,
                  fontSize: 26,
                  color: COLOR.white,
                  marginLeft: 12,
                }}
              >
                to one.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SFX layer */}
      <Sfx sound={TEXT_IN} delay={0} />
      <Sfx sound={COUNT} delay={sec(0.6)} />
      <Sfx sound={MONEY} delay={sec(0.9)} />
      <Sfx sound={IMPACT} delay={B2_START} />
      <Sfx sound={REVEAL} delay={B3_START} />
      <Sfx sound={MONEY} delay={B3_START + sec(0.2)} />
      <Sfx sound={LAND} delay={B3_START + sec(1.4)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 3 — Iceberg: three false culprits crossed out on the tip,
// camera pulls back, INSIDERS stamps the submerged mass. Full-frame
// 1920×1080 — occludes the webcam for its 10.48s run.
// ═════════════════════════════════════════════════════════════════════════

// Iceberg image geometry — mirrors iceberg/IcebergScene.tsx. Source image
// carries a watermark on the bottom 10%; crop it out.
const ICE_NATIVE_W = 1200;
const ICE_NATIVE_H = 836;
const ICE_CROP_BOTTOM = 0.1;
const ICE_CROPPED_H = ICE_NATIVE_H * (1 - ICE_CROP_BOTTOM);
const ICE_AR = ICE_NATIVE_W / ICE_CROPPED_H;
// Waterline ≈ y=270 in the cropped image.
const ICE_WATERLINE = 270 / ICE_CROPPED_H;

// Full-frame region. Scene 3 covers the webcam entirely.
const ICE_REGION_W = 1920;
const ICE_REGION_H = 1080;

// Min-cover scale on the full frame — the smallest scale at which the
// cropped image still covers 1920×1080 on every edge.
const ICE_MIN_COVER = ICE_REGION_W / (ICE_REGION_H * ICE_AR);

type Cam = { fx: number; fy: number; scale: number };

const ilerp = (a: number, b: number, t: number) => a + (b - a) * t;
const iease = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: ilerp(a.fx, b.fx, t),
  fy: ilerp(a.fy, b.fy, t),
  scale: ilerp(a.scale, b.scale, t),
});

// Tip ≈ y=0.10 (cropped). Push in on the top.
const CAM_TOP: Cam = { fx: 0.44, fy: 0.31, scale: 1.95 };
// Full view — just above min cover so sway has headroom on all sides.
const CAM_FULL: Cam = { fx: 0.5, fy: 0.5, scale: ICE_MIN_COVER + 0.08 };
// Submerged mass — bulk below the waterline.
const CAM_BOTTOM: Cam = { fx: 0.47, fy: 0.6, scale: 1.8 };

/**
 * Camera math — derives current image geometry from scene-local frame.
 * Shared between the image render and the label anchors so labels track
 * the iceberg in image-space rather than screen-space.
 */
const resolveIcebergCam = (
  frame: number,
  p1End: number,
  p2End: number,
  p3Settle: number,
) => {
  let cam: Cam;
  if (frame < p1End) {
    cam = CAM_TOP;
  } else if (frame < p2End) {
    const t = iease((frame - p1End) / (p2End - p1End));
    cam = lerpCam(CAM_TOP, CAM_FULL, t);
  } else {
    const raw = (frame - p2End) / Math.max(1, p3Settle - p2End);
    cam = lerpCam(CAM_FULL, CAM_BOTTOM, iease(Math.min(1, Math.max(0, raw))));
  }

  const swayX = Math.sin(frame * 0.055) * 6 + Math.sin(frame * 0.021) * 2;
  const swayY = Math.sin(frame * 0.041 + 1.1) * 3;

  const imgH = ICE_REGION_H * cam.scale;
  const imgW = imgH * ICE_AR;

  let imgLeft = ICE_REGION_W / 2 - cam.fx * imgW + swayX;
  let imgTop = ICE_REGION_H / 2 - cam.fy * imgH + swayY;

  // Clamp so the cropped image never exits the frame. CAM_FULL.scale is
  // deliberately ≥ ICE_MIN_COVER + headroom — this clamp can't push into
  // void unless sway would break cover, which the headroom prevents.
  imgLeft = Math.min(0, Math.max(ICE_REGION_W - imgW, imgLeft));
  imgTop = Math.min(0, Math.max(ICE_REGION_H - imgH, imgTop));

  const fullImgH = imgH / (1 - ICE_CROP_BOTTOM);
  const waterY = imgTop + ICE_WATERLINE * imgH;

  return { cam, imgLeft, imgTop, imgW, imgH, fullImgH, waterY };
};

type IcebergCamState = ReturnType<typeof resolveIcebergCam>;

const IcebergCameraView: React.FC<{ state: IcebergCamState; frame: number }> = ({
  state,
  frame,
}) => {
  const { imgLeft, imgTop, imgW, imgH, fullImgH, waterY } = state;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgW,
          height: imgH,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("iceberg.webp")}
          style={{
            width: imgW,
            height: fullImgH,
            display: "block",
          }}
        />
      </div>
      <IcebergShimmer y={waterY} width={ICE_REGION_W} frame={frame} />
    </>
  );
};

// Moving glint on the sea surface — soft glow + sharp crest.
const IcebergShimmer: React.FC<{
  y: number;
  width: number;
  frame: number;
}> = ({ y, width, frame }) => {
  const phase = frame * 2.6;
  const steps = 120;
  const amp = 5;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const yy =
      Math.sin(((x + phase) / 360) * Math.PI * 2) * amp +
      Math.sin(((x - phase * 0.7) / 160) * Math.PI * 2) * amp * 0.45 +
      Math.sin(((x + phase * 1.3) / 78) * Math.PI * 2) * amp * 0.22;
    pts.push(`${x.toFixed(1)},${yy.toFixed(2)}`);
  }
  const line = pts.join(" ");
  const BAND = 80;
  const common: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: y - BAND / 2,
    width,
    height: BAND,
    pointerEvents: "none",
    mixBlendMode: "screen",
  };
  return (
    <>
      <svg
        style={{ ...common, filter: "blur(6px)", opacity: 0.75 }}
        viewBox={`0 ${-BAND / 2} ${width} ${BAND}`}
      >
        <polyline
          points={line}
          stroke="rgba(175, 220, 242, 1)"
          strokeWidth="6"
          fill="none"
        />
      </svg>
      <svg
        style={{ ...common, filter: "blur(1.2px)" }}
        viewBox={`0 ${-BAND / 2} ${width} ${BAND}`}
      >
        <polyline
          points={line}
          stroke="rgba(250, 252, 255, 0.9)"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
    </>
  );
};

// ── Overlay cards — anchored to the iceberg image like map pins ─────────
// Each card has an (pctX, pctY) anchor in image-space. As the camera
// pans, sways, and zooms, the anchor translates with the image. The
// card's PIXEL SIZE stays constant — only its position follows the
// image. This is the map-pin model: drop a pin, pan the map, pin moves
// with the map but the pin itself never grows.
//
// Anchors chosen so both cards remain inside 1920×1080 at CAM_TOP (the
// most zoomed-in camera, where imgW is largest). At pctX=0.62 and
// CAM_TOP (imgLeft=-518, imgW=3359), the card center sits at x≈1565 —
// a 560-wide card clears the right edge with ~75px of headroom.

const CULPRITS: ReadonlyArray<{
  word: string;
  amount: string;
  glyph: string;
  /** Scene-local frame at which the word lands in voice. */
  revealAt: number;
}> = [
  // Scene 3 starts 13.92s. Voice lands at ≈14.9 / 16.0 / 17.2 — scene-local
  // frames 29 / 62 / 98 at 30fps. Estimates, not listened-verified.
  { word: "Strategy", amount: "−$1,240", glyph: "📉", revealAt: 29 },
  { word: "Fees", amount: "−$420", glyph: "💸", revealAt: 62 },
  { word: "Discipline", amount: "−$960", glyph: "⏱️", revealAt: 98 },
];

const REVEAL_SPRING_FRAMES = 12;
const SLASH_DELAY_FRAMES = 17; // ≈0.55s after word lands
const SLASH_WIPE_FRAMES = 8; // ≈0.28s

const DIVIDER = "1px solid rgba(14,15,12,0.08)";

// Image-space anchor → screen-space pixel position. Card size is
// constant in 1920-space; only the top/left follows the image.
const anchorToScreen = (
  cam: IcebergCamState,
  pctX: number,
  pctY: number,
) => ({
  x: cam.imgLeft + pctX * cam.imgW,
  y: cam.imgTop + pctY * cam.imgH,
});

const CULPRITS_ANCHOR = { pctX: 0.62, pctY: 0.12 };
const INSIDERS_ANCHOR = { pctX: 0.62, pctY: 0.62 };
const EXCHANGES_ANCHOR = { pctX: 0.22, pctY: 0.48 };

// Shared card shadow — softer Wise baseline (hairline ring + long diffuse lift).
const CARD_SHADOW =
  "rgba(14,15,12,0.12) 0px 0px 0px 1px, 0 20px 48px rgba(0,0,0,0.22)";

// Six exchanges — blurred hard. The viewer recognises the silhouette,
// the trademark stays unreproduced. Two real PNGs carried over from
// the crypto folder; binance + hyperliquid fetched from their own
// product icons; kalshi + robinhood are brand-colour SVG placeholders
// (signature hue only — under 14px blur, indistinguishable).
const EXCHANGES: ReadonlyArray<{ name: string; src: string }> = [
  { name: "Binance", src: "logos/exchanges/binance.png" },
  { name: "Polymarket", src: "logos/exchanges/polymarket.png" },
  { name: "Kalshi", src: "logos/exchanges/kalshi.svg" },
  { name: "Pump.fun", src: "logos/exchanges/pumpfun.png" },
  { name: "Hyperliquid", src: "logos/exchanges/hyperliquid.png" },
  { name: "Robinhood", src: "logos/exchanges/robinhood.svg" },
];

// Scene-local frame where the "all exchanges do this" beat lands.
// Scene 3 starts 13.92s; voice beat estimated 18.9–19.0s → frame ~150.
const EXCHANGES_REVEAL = 150;

const CulpritsCard: React.FC<{ cam: IcebergCamState }> = ({ cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Constant screen-space card size. Only its position tracks the image.
  const CARD_WIDTH = 560;
  const { x: centerX, y: centerY } = anchorToScreen(
    cam,
    CULPRITS_ANCHOR.pctX,
    CULPRITS_ANCHOR.pctY,
  );

  const rowFontSize = 44;
  const labelSize = 22;
  const amountSize = 38;
  const avatarSize = 64;
  const glyphSize = 34;
  const strikeH = 4;
  const rowPadV = SPACE.md; // 16 — Wise 8px grid
  const padV = SPACE.xl;    // 32
  const padH = SPACE.xxl - SPACE.sm; // 40 — one notch wider than xl
  const headerGap = SPACE.lg; // 24
  const rowHeight = avatarSize + rowPadV * 2; // fixed row → skeleton keeps card stable

  return (
    <div
      style={{
        position: "absolute",
        left: centerX - CARD_WIDTH / 2,
        top: centerY,
        width: CARD_WIDTH,
        pointerEvents: "none",
        transform: "translateY(-50%)",
      }}
    >
      <div
        style={{
          ...PANEL.white,
          background: COLOR.white,
          padding: `${padV}px ${padH}px`,
          borderRadius: 28,
          boxShadow: CARD_SHADOW,
        }}
      >
        {/* Header row — Wise activity screen style */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: headerGap,
          }}
        >
          <span
            style={{
              ...TYPE.label,
              fontSize: labelSize,
              color: COLOR.gray,
            }}
          >
            What you blamed
          </span>
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: labelSize,
              color: COLOR.gray,
              lineHeight: 1,
              letterSpacing: "0.04em",
            }}
          >
            ···
          </span>
        </div>

        {/* List rows — each row holds its height via a skeleton, then
            springs in on the voice beat, then the strike wipes across. */}
        {CULPRITS.map((row, i) => {
          const revealT = spring({
            frame: frame - row.revealAt,
            fps,
            durationInFrames: REVEAL_SPRING_FRAMES,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          const revealed = frame >= row.revealAt;
          const slashStart = row.revealAt + SLASH_DELAY_FRAMES;
          const slashT = interpolate(
            frame,
            [slashStart, slashStart + SLASH_WIPE_FRAMES],
            [0, 1],
            clamp,
          );

          return (
            <div
              key={row.word}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                paddingTop: i === 0 ? 0 : rowPadV,
                paddingBottom: rowPadV,
                borderBottom: i === CULPRITS.length - 1 ? "none" : DIVIDER,
                minHeight: rowHeight,
                position: "relative",
              }}
            >
              {/* Skeleton state — thin gray pill occupying the row until
                  the voice beat hits. Keeps the card height stable. */}
              {!revealed && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: "50%",
                      background: "rgba(14,15,12,0.06)",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: rowFontSize * 0.55,
                      borderRadius: 999,
                      background: "rgba(14,15,12,0.06)",
                    }}
                  />
                  <div
                    style={{
                      width: 96,
                      height: rowFontSize * 0.5,
                      borderRadius: 999,
                      background: "rgba(14,15,12,0.06)",
                      flexShrink: 0,
                    }}
                  />
                </div>
              )}

              {/* Revealed content */}
              {revealed && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    opacity: revealT,
                    transform: `translateY(${(1 - revealT) * 8}px)`,
                  }}
                >
                  <div
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: "50%",
                      background: COLOR.lightSurface,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: glyphSize,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {row.glyph}
                  </div>

                  {/* Word + animated strike. The strike wipes left→right
                      exactly across the word — not the amount. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <span
                        style={{
                          ...TYPE.bodySemibold,
                          fontSize: rowFontSize,
                          color: COLOR.nearBlack,
                          lineHeight: 1.1,
                        }}
                      >
                        {row.word}
                      </span>
                      {slashT > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: "50%",
                            width: `${slashT * 100}%`,
                            height: strikeH,
                            background: COLOR.danger,
                            borderRadius: strikeH / 2,
                            transform: "translateY(-50%)",
                            transformOrigin: "0 50%",
                          }}
                        />
                      )}
                    </span>
                  </div>

                  <span
                    style={{
                      fontFamily: FONT.body,
                      fontSize: amountSize,
                      fontWeight: 700,
                      color: COLOR.danger,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.01em",
                      flexShrink: 0,
                    }}
                  >
                    {row.amount}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InsidersCard: React.FC<{ cam: IcebergCamState }> = ({ cam }) => {
  // Constant screen-space card size. Anchored into the submerged mass
  // of the iceberg — the card rises into frame as the camera descends.
  const CARD_WIDTH = 600;
  const { x: centerX, y: centerY } = anchorToScreen(
    cam,
    INSIDERS_ANCHOR.pctX,
    INSIDERS_ANCHOR.pctY,
  );

  const insidersFontSize = 132;
  const pillFontSize = 22;
  const captionSize = 26;
  const padV = SPACE.xxl;            // 48
  const padH = SPACE.xxl + SPACE.xs; // 52

  return (
    <div
      style={{
        position: "absolute",
        left: centerX - CARD_WIDTH / 2,
        top: centerY,
        width: CARD_WIDTH,
        pointerEvents: "none",
        transform: "translateY(-50%)",
      }}
    >
      <div
        style={{
          ...PANEL.white,
          background: COLOR.white,
          padding: `${padV}px ${padH}px`,
          borderRadius: 34,
          boxShadow: CARD_SHADOW,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {/* Top-left red pill — Wise feature card accent */}
        <div style={{ display: "flex" }}>
          <div
            style={{
              ...TYPE.label,
              fontSize: pillFontSize,
              background: COLOR.danger,
              color: COLOR.white,
              padding: `${SPACE.sm + 2}px ${SPACE.md + 2}px`,
              borderRadius: 9999,
              letterSpacing: "0.08em",
              lineHeight: 1,
            }}
          >
            the real thing
          </div>
        </div>

        {/* INSIDERS — the feature word */}
        <div
          style={{
            ...TYPE.displayMega,
            fontSize: insidersFontSize,
            color: COLOR.nearBlack,
            letterSpacing: "-0.02em",
            lineHeight: 0.85,
            textAlign: "left",
            marginTop: Math.round(insidersFontSize * 0.22),
            marginBottom: Math.round(insidersFontSize * 0.2),
          }}
        >
          INSIDERS
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(14,15,12,0.08)",
            marginBottom: Math.round(captionSize * 0.7),
          }}
        />

        {/* Caption — factual, understated */}
        <div
          style={{
            ...TYPE.caption,
            fontSize: captionSize,
            color: COLOR.gray,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.3,
          }}
        >
          70% of winnings · every batch
        </div>
      </div>
    </div>
  );
};

// "Every exchange" card — six heavily-blurred logo tiles. Pinned to
// the left flank of the iceberg. Enters on the voice beat, stays put.
// Same map-pin model as the other two cards: image-space anchor,
// constant pixel size, no zoom scaling.
const ExchangesCard: React.FC<{ cam: IcebergCamState }> = ({ cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const CARD_WIDTH = 520;
  const { x: centerX, y: centerY } = anchorToScreen(
    cam,
    EXCHANGES_ANCHOR.pctX,
    EXCHANGES_ANCHOR.pctY,
  );

  // Spring entrance on the voice beat. Returns 0 before the reveal
  // frame (Math.max clamp), so opacity handles "hidden" on its own.
  const reveal = spring({
    frame: Math.max(0, frame - EXCHANGES_REVEAL),
    fps,
    durationInFrames: 16,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });
  const opacity = frame < EXCHANGES_REVEAL ? 0 : reveal;
  const translateY = (1 - reveal) * 12;

  const TILE = 56;

  return (
    <div
      style={{
        position: "absolute",
        left: centerX - CARD_WIDTH / 2,
        top: centerY,
        width: CARD_WIDTH,
        pointerEvents: "none",
        transform: "translateY(-50%)",
        opacity,
      }}
    >
      <div
        style={{
          ...PANEL.white,
          background: COLOR.white,
          padding: `${SPACE.lg}px ${SPACE.xl}px`,
          borderRadius: 28,
          boxShadow: CARD_SHADOW,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Label */}
        <div
          style={{
            ...TYPE.label,
            fontSize: 20,
            color: COLOR.gray,
            marginBottom: SPACE.md,
          }}
        >
          Every exchange
        </div>

        {/* Six blurred logo tiles */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: SPACE.sm,
          }}
        >
          {EXCHANGES.map((ex) => (
            <div
              key={ex.name}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: "50%",
                background: COLOR.white,
                border: `1px solid ${COLOR.border}`,
                boxShadow: "0 2px 6px rgba(14,15,12,0.08)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Img
                src={staticFile(ex.src)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(14px) saturate(1.15)",
                  transform: "scale(1.15)", // compensate for blur edge-fade
                }}
              />
            </div>
          ))}
        </div>

        {/* Divider + caption */}
        <div
          style={{
            height: 1,
            background: "rgba(14,15,12,0.08)",
            marginTop: SPACE.md,
            marginBottom: SPACE.md,
          }}
        />
        <div
          style={{
            ...TYPE.caption,
            fontSize: 22,
            color: COLOR.gray,
            lineHeight: 1.3,
          }}
        >
          Same hand · different sleeve.
        </div>
      </div>
    </div>
  );
};

const IcebergBeats: React.FC<{ area: Rect; duration: number }> = ({
  duration,
}) => {
  const frame = useCurrentFrame();

  // Scene 3 (10.48s) occupies the full 1920×1080 frame. Webcam beneath is
  // covered wholesale for this stretch — the iceberg carries the beat.
  //
  // The iceberg image pans and zooms in the background. The two cards
  // are pinned to points on the image: their position tracks the pan
  // and sway, but they never grow or shrink with the zoom. Map pins, not
  // decals. The three culprits reveal on voice beats and get slashed
  // ~0.55s later. INSIDERS stays visible the whole time — discovered
  // as the camera descends below the waterline.

  const P1_END = sec(4.0);
  const P2_END = sec(7.0);
  const P3_SETTLE = sec(9.0);

  const camState = resolveIcebergCam(frame, P1_END, P2_END, P3_SETTLE);

  // Outer fade — mirrors the webcam panel entrance/exit so the cover is clean.
  const enter = interpolate(frame, [0, 16], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const exit = interpolate(frame, [duration - 16, duration], [1, 0], clamp);
  const regionOpacity = enter * exit;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        opacity: regionOpacity,
        background: "#081826",
      }}
    >
      <IcebergCameraView state={camState} frame={frame} />

      {/* "what you blamed" card — pinned to the iceberg tip area.
          Culprits reveal on voice, get slashed shortly after. */}
      <CulpritsCard cam={camState} />

      {/* "every exchange" card — six blurred logo tiles on the left
          flank. Reveals on the "all exchanges do this" beat. */}
      <ExchangesCard cam={camState} />

      {/* "INSIDERS" card — pinned to the submerged mass. Rises into
          frame as the camera descends past the waterline. */}
      <InsidersCard cam={camState} />

      {/* SFX — voice-synced reveals and slashes for the three culprits.
          Reveal: soft plob. Slash: quick swish. */}
      {CULPRITS.map((row) => (
        <React.Fragment key={row.word}>
          <Sfx sound={PLOB_BG} delay={row.revealAt} />
          <Sfx
            sound={SWOOSH}
            delay={row.revealAt + SLASH_DELAY_FRAMES}
          />
        </React.Fragment>
      ))}

      {/* "every exchange" reveal — soft plob on the voice beat. */}
      <Sfx sound={PLOB_BG} delay={EXCHANGES_REVEAL} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 5 — Single-market exploit swimlane (right-small, content on left)
// ═════════════════════════════════════════════════════════════════════════

const MARKETS = ["AAPL", "TSLA", "NVDA", "GOOG", "NFLX", "MSFT"];
const INSIDER_COL = 3; // GOOG
const INSIDER_WIN = 12_400;
const YOU_LOSSES = [40, 120, 55, 300, 80, 60];

const SwimlaneBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.4);
  const pickSpring = spring({
    frame: Math.max(0, frame - B2_START),
    fps,
    config: { damping: 11, stiffness: 170, mass: 0.8 },
  });
  const insiderCount = interpolate(
    frame,
    [B2_START + sec(0.3), B2_START + sec(1.6)],
    [0, INSIDER_WIN],
    { ...clamp, easing: EASE_OUT },
  );

  const cellW = 150;
  const cellH = 74;
  const gap = 10;
  const labelW = 130;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="One shot" small="normal exchange" bigSize={76} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
        {/* Column headers */}
        <div style={{ display: "flex", alignItems: "center", gap, marginBottom: 6 }}>
          <div style={{ width: labelW }} />
          {MARKETS.map((m, i) => {
            const fadeIn = interpolate(
              frame,
              [sec(0.1 + i * 0.06), sec(0.3 + i * 0.06)],
              [0, 1],
              clamp,
            );
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  textAlign: "center",
                  ...TYPE.label,
                  fontSize: 22,
                  color: COLOR.gray,
                  opacity: fadeIn,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>

        {/* Insider row */}
        <div style={{ display: "flex", alignItems: "center", gap }}>
          <div
            style={{
              width: labelW,
              ...TYPE.bodySemibold,
              fontSize: 26,
              color: COLOR.nearBlack,
            }}
          >
            Insider
          </div>
          {MARKETS.map((m, i) => {
            const cellDelay = sec(0.6 + i * 0.12);
            const s = spring({
              frame: Math.max(0, frame - cellDelay),
              fps,
              config: { damping: 16, stiffness: 180, mass: 0.5 },
            });
            const isTarget = i === INSIDER_COL;
            const isPicked = isTarget && frame >= B2_START;
            const background = isPicked ? COLOR.lightMint : COLOR.lightSurface;
            const border = isPicked
              ? `2px solid ${COLOR.wiseGreen}`
              : `1px solid ${COLOR.border}`;
            const scale = isPicked
              ? interpolate(pickSpring, [0, 1], [1, 1.12], clamp)
              : 1;
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  height: cellH,
                  borderRadius: 14,
                  background,
                  border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: s,
                  transform: `translateY(${interpolate(
                    s,
                    [0, 1],
                    [10, 0],
                    clamp,
                  )}px) scale(${scale})`,
                  ...TYPE.bodySemibold,
                  fontSize: isPicked ? 30 : 28,
                  color: isPicked ? COLOR.darkGreen : COLOR.gray,
                  fontVariantNumeric: "tabular-nums",
                  boxShadow: isPicked
                    ? `0 6px 20px rgba(22,51,0,0.25)`
                    : "none",
                }}
              >
                {isPicked
                  ? `+$${Math.round(insiderCount).toLocaleString()}`
                  : "—"}
              </div>
            );
          })}
        </div>

        {/* You row */}
        <div style={{ display: "flex", alignItems: "center", gap }}>
          <div
            style={{
              width: labelW,
              ...TYPE.bodySemibold,
              fontSize: 26,
              color: COLOR.nearBlack,
            }}
          >
            You
          </div>
          {MARKETS.map((m, i) => {
            const cellDelay = sec(0.9 + i * 0.12);
            const s = spring({
              frame: Math.max(0, frame - cellDelay),
              fps,
              config: { damping: 16, stiffness: 180, mass: 0.5 },
            });
            const isTarget = i === INSIDER_COL;
            const pulseT =
              isTarget && frame >= B2_START + sec(0.1)
                ? interpolate(
                    frame,
                    [
                      B2_START + sec(0.1),
                      B2_START + sec(0.35),
                      B2_START + sec(0.6),
                    ],
                    [1, 1.08, 1],
                    clamp,
                  )
                : 1;
            return (
              <div
                key={m}
                style={{
                  width: cellW,
                  height: cellH,
                  borderRadius: 14,
                  background: "rgba(208,50,56,0.08)",
                  border: `1px solid rgba(208,50,56,0.35)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: s,
                  transform: `translateY(${interpolate(
                    s,
                    [0, 1],
                    [10, 0],
                    clamp,
                  )}px) scale(${pulseT})`,
                  ...TYPE.bodySemibold,
                  fontSize: 26,
                  color: COLOR.danger,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                −${YOU_LOSSES[i]}
              </div>
            );
          })}
        </div>

        {/* Caption */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 22px",
            background: COLOR.nearBlack,
            borderRadius: 18,
            opacity: interpolate(
              frame,
              [B2_START + sec(1.2), B2_START + sec(1.6)],
              [0, 1],
              clamp,
            ),
            transform: `translateY(${interpolate(
              frame,
              [B2_START + sec(1.2), B2_START + sec(1.6)],
              [10, 0],
              clamp,
            )}px)`,
          }}
        >
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 28,
              color: COLOR.white,
            }}
          >
            He picks.
          </span>
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 28,
              color: COLOR.wiseGreen,
              marginLeft: 14,
            }}
          >
            You cover.
          </span>
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {MARKETS.map((_, i) => (
        <Sfx
          key={`hdr-${i}`}
          sound={TICK_SOFT}
          delay={sec(0.1 + i * 0.06)}
        />
      ))}
      {MARKETS.map((_, i) => (
        <Sfx key={`ins-${i}`} sound={PLOB_BG} delay={sec(0.6 + i * 0.12)} />
      ))}
      {MARKETS.map((_, i) => (
        <Sfx key={`you-${i}`} sound={PLOB_BG} delay={sec(0.9 + i * 0.12)} />
      ))}
      <Sfx sound={IMPACT} delay={B2_START} />
      <Sfx sound={MONEY} delay={B2_START + sec(0.3)} />
      <Sfx sound={LAND} delay={B2_START + sec(1.4)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 6 — Batch dilution grid (left-small, content on right)
// ═════════════════════════════════════════════════════════════════════════

const BATCH_GRID = 10; // 10×10 = 100 cells
const EDGE_CELLS = [17, 43, 81]; // indices with real edge

const BatchGridBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.0);
  const B3_START = sec(5.6);

  const CELL = 44;
  const GAP = 6;
  const gridW = BATCH_GRID * CELL + (BATCH_GRID - 1) * GAP;
  const gridH = BATCH_GRID * CELL + (BATCH_GRID - 1) * GAP;

  // Avg line sweep
  const avgSweep = interpolate(
    frame,
    [B2_START + sec(0.8), B2_START + sec(2.0)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  // Line sits at 0.55% / 18.2% = ~3% from top of "edge-space" visualization.
  // Visually: place it near bottom of grid (since near-zero).

  // Beat 3 math
  const mathLineSpring = (i: number) =>
    spring({
      frame: Math.max(0, frame - (B3_START + sec(0.3 * i))),
      fps,
      config: { damping: 14, stiffness: 140, mass: 0.7 },
    });

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="A batch" small="100 markets forced" bigSize={76} />

      <div style={{ display: "flex", gap: 28, flex: 1 }}>
        {/* Grid */}
        <div
          style={{
            width: gridW,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${BATCH_GRID}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            {Array.from({ length: BATCH_GRID * BATCH_GRID }).map((_, i) => {
              const s = spring({
                frame: Math.max(0, frame - i * 1.0),
                fps,
                config: { damping: 20, stiffness: 220, mass: 0.35 },
              });
              const isEdge = EDGE_CELLS.includes(i);
              const showGreen = isEdge && frame >= B2_START;
              const dimOthers =
                frame >= B2_START + sec(0.4) && !isEdge
                  ? interpolate(
                      frame,
                      [B2_START + sec(0.4), B2_START + sec(1.0)],
                      [1, 0.55],
                      clamp,
                    )
                  : 1;
              const bg = showGreen
                ? COLOR.wiseGreen
                : COLOR.lightSurface;
              const border = showGreen
                ? `2px solid ${COLOR.darkGreen}`
                : `1px solid ${COLOR.border}`;
              const pulse = showGreen
                ? 1 +
                  0.06 *
                    Math.sin(((frame - B2_START) / fps) * 6 + i)
                : 1;
              return (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 8,
                    background: bg,
                    border,
                    opacity: s * dimOthers,
                    transform: `scale(${interpolate(
                      s,
                      [0, 1],
                      [0.5, 1],
                      clamp,
                    )}) scale(${pulse})`,
                    boxShadow: showGreen
                      ? `0 4px 12px rgba(22,51,0,0.35)`
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Avg edge line (near bottom because diluted is tiny) */}
          {avgSweep > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: gridH - 14,
                width: gridW * avgSweep,
                height: 3,
                background: COLOR.nearBlack,
                borderRadius: 2,
              }}
            />
          )}
          {avgSweep > 0.7 && (
            <div
              style={{
                position: "absolute",
                left: gridW * 0.7,
                top: gridH - 46,
                ...TYPE.label,
                fontSize: 20,
                color: COLOR.nearBlack,
                opacity: interpolate(avgSweep, [0.7, 1], [0, 1], clamp),
              }}
            >
              avg edge · 0.55%
            </div>
          )}

          {/* +18% tags on the green cells */}
          {frame >= B2_START + sec(0.5) &&
            EDGE_CELLS.map((idx) => {
              const col = idx % BATCH_GRID;
              const row = Math.floor(idx / BATCH_GRID);
              return (
                <div
                  key={`tag-${idx}`}
                  style={{
                    position: "absolute",
                    left: col * (CELL + GAP) - 8,
                    top: row * (CELL + GAP) - 26,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: COLOR.darkGreen,
                    ...TYPE.label,
                    color: COLOR.wiseGreen,
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    opacity: interpolate(
                      frame,
                      [B2_START + sec(0.5), B2_START + sec(0.9)],
                      [0, 1],
                      clamp,
                    ),
                    transform: `translateY(${interpolate(
                      frame,
                      [B2_START + sec(0.5), B2_START + sec(0.9)],
                      [6, 0],
                      clamp,
                    )}px)`,
                  }}
                >
                  +18%
                </div>
              );
            })}
        </div>

        {/* Math panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              ...TYPE.label,
              fontSize: 22,
              color: COLOR.gray,
              marginBottom: 4,
              opacity: mathLineSpring(0),
            }}
          >
            What actually happens
          </div>
          <div
            style={{
              ...TYPE.statValue,
              fontSize: 42,
              color: COLOR.nearBlack,
              fontVariantNumeric: "tabular-nums",
              opacity: mathLineSpring(0),
              transform: `translateX(${interpolate(
                mathLineSpring(0),
                [0, 1],
                [-12, 0],
                clamp,
              )}px)`,
            }}
          >
            18.2% × 3
          </div>
          <div
            style={{
              ...TYPE.cardTitle,
              fontSize: 22,
              color: COLOR.gray,
              opacity: mathLineSpring(1),
            }}
          >
            spread across 100 markets
          </div>
          <div
            style={{
              ...TYPE.statValue,
              fontSize: 42,
              color: COLOR.danger,
              fontVariantNumeric: "tabular-nums",
              opacity: mathLineSpring(1),
              transform: `translateX(${interpolate(
                mathLineSpring(1),
                [0, 1],
                [-12, 0],
                clamp,
              )}px)`,
            }}
          >
            0.55%
          </div>
          <div
            style={{
              marginTop: "auto",
              ...PANEL.greenAccent,
              padding: "18px 22px",
              textAlign: "center",
              opacity: mathLineSpring(2),
              transform: `scale(${interpolate(
                mathLineSpring(2),
                [0, 1],
                [0.9, 1],
                clamp,
              )})`,
            }}
          >
            <span
              style={{
                ...TYPE.bodySemibold,
                fontSize: 30,
                color: COLOR.darkGreen,
              }}
            >
              ≈ you
            </span>
          </div>
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Sfx
          key={`row-${i}`}
          sound={PLOB_BG}
          delay={sec(0.1 + i * 0.18)}
        />
      ))}
      <Sfx sound={IMPACT} delay={B2_START} />
      {EDGE_CELLS.map((_, i) => (
        <Sfx
          key={`edge-${i}`}
          sound={PLOB}
          delay={B2_START + sec(0.1 + i * 0.2)}
        />
      ))}
      <Sfx sound={COUNT} delay={B2_START + sec(0.8)} />
      <Sfx sound={REVEAL} delay={B3_START} />
      <Sfx sound={LAND} delay={B3_START + sec(0.6)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Scene 8 — Market roster tiles (right-medium, content on left)
// ═════════════════════════════════════════════════════════════════════════

const MARKET_TILES = [
  { icon: "🎮", name: "Twitch", q: "xQc > 120k at 21:00?", yes: 0.62 },
  { icon: "📉", name: "Meme shorts", q: "$WIF < $1.10 in 10m?", yes: 0.41 },
  { icon: "🐾", name: "Animals", q: "Koko video > 2M views today?", yes: 0.77 },
  { icon: "🎬", name: "Box office", q: "Dune 3 opens > $85M?", yes: 0.55 },
  { icon: "🌧️", name: "Weather", q: "Paris rain next 10m?", yes: 0.23 },
  { icon: "🗳️", name: "Elections", q: "Poll lead narrows?", yes: 0.49 },
  { icon: "🚆", name: "Rail", q: "DB on time > 65%?", yes: 0.52 },
  { icon: "🎵", name: "Streams", q: "Song #1 hits 5M?", yes: 0.38 },
  { icon: "⛏️", name: "Hashrate", q: "BTC hashrate new ATH?", yes: 0.29 },
  { icon: "⚽", name: "Sport", q: "PSG–OM over 2.5 goals?", yes: 0.47 },
];

const MarketTilesBeats: React.FC<{ area: Rect; duration: number }> = ({
  area,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const B2_START = sec(3.2);
  const B3_START = sec(6.0);

  const TILE_W = 176;
  const TILE_H = 150;
  const GAP = 14;

  const clockAngle = interpolate(
    frame,
    [B3_START, B3_START + sec(2.0)],
    [0, 360],
    { ...clamp, easing: EASE_OUT },
  );
  const tickerPulse =
    frame >= B3_START
      ? 1 + 0.04 * Math.sin(((frame - B3_START) / fps) * 6)
      : 1;

  return (
    <ContentAreaCard area={area} duration={duration}>
      <Header big="500 markets" small="10 examples" bigSize={68} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(5, ${TILE_W}px)`,
          gap: GAP,
          justifyContent: "flex-start",
          perspective: 1600,
        }}
      >
        {MARKET_TILES.map((t, i) => {
          const delay = sec(0.1 + i * 0.17);
          const s = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 15, stiffness: 150, mass: 0.6 },
          });
          const flipStart = B2_START + i * sec(0.06);
          const flipRaw = interpolate(
            frame,
            [flipStart, flipStart + sec(0.5)],
            [0, 1],
            clamp,
          );
          const flipDeg = flipRaw * 180;
          const yesPct = Math.round(t.yes * 100);

          return (
            <div
              key={t.name}
              style={{
                width: TILE_W,
                height: TILE_H,
                opacity: s,
                transform: `translateY(${interpolate(
                  s,
                  [0, 1],
                  [16, 0],
                  clamp,
                )}px)`,
                transformStyle: "preserve-3d",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${flipDeg}deg)`,
                  transition: "none",
                }}
              >
                {/* Front */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: COLOR.bg,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 18,
                    boxShadow: "rgba(14,15,12,0.08) 0px 0px 0px 1px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
                  <div style={{ fontSize: 42, lineHeight: 1 }}>{t.icon}</div>
                  <div>
                    <div
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 22,
                        color: COLOR.nearBlack,
                        marginBottom: 4,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        ...TYPE.caption,
                        fontSize: 16,
                        color: COLOR.gray,
                        lineHeight: 1.3,
                      }}
                    >
                      {t.q}
                    </div>
                  </div>
                </div>

                {/* Back — odds chip */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: COLOR.nearBlack,
                    borderRadius: 18,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div
                    style={{
                      ...TYPE.label,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        ...TYPE.statValue,
                        fontSize: 52,
                        color: COLOR.wiseGreen,
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1,
                      }}
                    >
                      {yesPct}
                    </span>
                    <span
                      style={{
                        ...TYPE.bodySemibold,
                        fontSize: 22,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      ¢ YES
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${yesPct}%`,
                        background: COLOR.wiseGreen,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom strip — 10-minute clock */}
      <div
        style={{
          marginTop: "auto",
          padding: "18px 24px",
          borderRadius: 22,
          background: frame >= B3_START ? COLOR.nearBlack : COLOR.lightSurface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          transition: "none",
          transform: `scale(${tickerPulse})`,
          opacity: interpolate(
            frame,
            [B3_START - sec(0.4), B3_START],
            [0.5, 1],
            clamp,
          ),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Clock SVG */}
          <svg width={56} height={56} viewBox="0 0 56 56">
            <circle
              cx={28}
              cy={28}
              r={24}
              fill="none"
              stroke={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
              strokeWidth={3}
            />
            <line
              x1={28}
              y1={28}
              x2={28 + 18 * Math.sin((clockAngle * Math.PI) / 180)}
              y2={28 - 18 * Math.cos((clockAngle * Math.PI) / 180)}
              stroke={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle
              cx={28}
              cy={28}
              r={2.5}
              fill={frame >= B3_START ? COLOR.wiseGreen : COLOR.gray}
            />
          </svg>
          <div>
            <div
              style={{
                ...TYPE.label,
                fontSize: 20,
                color:
                  frame >= B3_START
                    ? "rgba(255,255,255,0.6)"
                    : COLOR.gray,
              }}
            >
              Settlement
            </div>
            <div
              style={{
                ...TYPE.sectionHeading,
                fontSize: 44,
                color:
                  frame >= B3_START ? COLOR.wiseGreen : COLOR.nearBlack,
                lineHeight: 1,
              }}
            >
              Every 10 min
            </div>
          </div>
        </div>
        <div
          style={{
            ...TYPE.bodySemibold,
            fontSize: 22,
            color:
              frame >= B3_START ? "rgba(255,255,255,0.75)" : COLOR.gray,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          T−{Math.max(
            0,
            Math.round(
              10 - ((((frame - B3_START) / fps) * 5) % 10),
            ),
          )}
          m
        </div>
      </div>

      {/* SFX */}
      <Sfx sound={TEXT_IN} delay={0} />
      {MARKET_TILES.map((_, i) => (
        <Sfx
          key={`tile-${i}`}
          sound={PLOB_BG}
          delay={sec(0.1 + i * 0.17)}
        />
      ))}
      <Sfx sound={RAPID_POP} delay={B2_START} />
      <Sfx sound={LAND} delay={B3_START} />
      <Sfx sound={TICK} delay={B3_START + sec(0.5)} />
      <Sfx sound={TICK} delay={B3_START + sec(1.2)} />
    </ContentAreaCard>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Main export — mounts one Sequence per scene
// ═════════════════════════════════════════════════════════════════════════

export const Sequence02Diagrams: React.FC = () => {
  const area2 = getContentArea("right-medium")!;
  const area3 = getContentArea("left-medium")!;
  const area5 = getContentArea("right-small")!;
  const area6 = getContentArea("left-small")!;
  const area8 = getContentArea("right-medium")!;

  const dur = (startSec: number, endSec: number) =>
    toFrames(endSec) - toFrames(startSec) - MOUNT_OFFSET;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scene 2 */}
      <Sequence
        from={toFrames(SCENE2_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE2_START, SCENE2_END)}
      >
        <PyramidBeats
          area={area2}
          duration={dur(SCENE2_START, SCENE2_END)}
        />
      </Sequence>

      {/* Scene 3 */}
      <Sequence
        from={toFrames(SCENE3_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE3_START, SCENE3_END)}
      >
        <IcebergBeats
          area={area3}
          duration={dur(SCENE3_START, SCENE3_END)}
        />
      </Sequence>

      {/* Scene 5 */}
      <Sequence
        from={toFrames(SCENE5_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE5_START, SCENE5_END)}
      >
        <SwimlaneBeats
          area={area5}
          duration={dur(SCENE5_START, SCENE5_END)}
        />
      </Sequence>

      {/* Scene 6 */}
      <Sequence
        from={toFrames(SCENE6_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE6_START, SCENE6_END)}
      >
        <BatchGridBeats
          area={area6}
          duration={dur(SCENE6_START, SCENE6_END)}
        />
      </Sequence>

      {/* Scene 8 */}
      <Sequence
        from={toFrames(SCENE8_START) + MOUNT_OFFSET}
        durationInFrames={dur(SCENE8_START, SCENE8_END)}
      >
        <MarketTilesBeats
          area={area8}
          duration={dur(SCENE8_START, SCENE8_END)}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
