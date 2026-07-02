import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export const FPS = 60;
export const DURATION = 467; // 7.78s — matches reference loopscale-original.mp4

// ═══════════════════════════════════════════════════════════════
// All numbers below are measured from the reference video,
// frame-by-frame (see agent report). Beziers are least-squares
// fits to per-frame position data — RMSE < 0.7% of range.
// ═══════════════════════════════════════════════════════════════

const BG = "#141718";
const W = 1280;
const CX = W / 2;

// Fitted master curves
const EASE_OPEN = Easing.bezier(0.47, 0.1, 0.02, 1); // aperture open  f21–99
const EASE_SLIDE = Easing.bezier(0.36, 0.19, 0.02, 1); // logo slide     f86–126
const EASE_CLOSE = Easing.bezier(0.48, 0.04, 0.0, 1); // aperture close f358–412
const EASE_POP = Easing.bezier(0.0, 0.38, 0.0, 1); // coin pop       f176–218
const EASE_COIN1 = Easing.bezier(0.29, 0.27, 0.01, 1); // coin1 shift    f206–244
const EASE_COIN2 = Easing.bezier(0.08, 0.41, 0.19, 1); // coin2 emerge   f212–248

// Line field: 27 rows. y-centers and per-row half-width of the closed
// aperture (distance from screen center-x to the line tip), measured
// on frame 406 (fully closed, no content). Left/right symmetric.
const ROW_Y = [
  16, 42, 69, 96, 123, 149, 176, 202, 229, 256, 282, 309, 336, 363, 389, 416,
  442, 469, 496, 522, 549, 576, 602, 629, 656, 682, 709,
];
const ROW_HW = [
  17, 66, 103, 133, 159, 178, 196, 210, 222, 232, 239, 245, 249, 250, 250, 249,
  244, 239, 231, 223, 211, 196, 179, 158, 133, 105, 67,
];
const LINE_H = 3;
const LINE_COLOR = "168, 170, 171"; // peak paint; measured edge luma 161 at full brightness
// Along-line brightness falls off in absolute screen-x (measured on f406):
// x=0 →1.0, x≈40 →0.90, x≈160 →0.80, x≈320 →0.66, x≈390 →0.61.
const LINE_GRAD = `rgba(${LINE_COLOR},1) 0%, rgba(${LINE_COLOR},0.90) 6.2%, rgba(${LINE_COLOR},0.80) 25%, rgba(${LINE_COLOR},0.66) 50%, rgba(${LINE_COLOR},0.61) 61%, rgba(${LINE_COLOR},0.45) 100%`;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── Line field (background aperture) ───
const LineField: React.FC<{ frame: number }> = ({ frame }) => {
  // Aperture delta: every line tip retracts by the same amount.
  // Open 0→307 (f21–99), slow drift +12 (f99–358), close ×(1-p) (f358–412).
  const open = interpolate(frame, [21, 99], [0, 307], { easing: EASE_OPEN, ...clamp });
  const drift = interpolate(frame, [99, 358], [0, 12], clamp);
  const close = interpolate(frame, [358, 412], [0, 1], { easing: EASE_CLOSE, ...clamp });
  const d = (open + drift) * (1 - close);

  // Layer brightness, measured as edge-luma over time (peak = 1 at the
  // closing flash, f402–412), then linear fade-out to the plain bg.
  const opacity = interpolate(
    frame,
    [0, 38, 120, 240, 358, 402, 412, 458],
    [0, 0.735, 0.735, 0.657, 0.657, 1, 1, 0],
    clamp,
  );

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill style={{ opacity }}>
      {ROW_Y.map((y, i) => {
        const width = Math.max(0, CX - (ROW_HW[i] + d));
        if (width < 1) return null;
        return (
          <React.Fragment key={y}>
            {/* Outer div clips; inner div carries the fixed screen-space gradient */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: y - LINE_H / 2,
                width,
                height: LINE_H,
                overflow: "hidden",
                filter: "blur(0.5px)",
              }}
            >
              <div
                style={{
                  width: CX,
                  height: LINE_H,
                  background: `linear-gradient(to right, ${LINE_GRAD})`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: y - LINE_H / 2,
                width,
                height: LINE_H,
                overflow: "hidden",
                display: "flex",
                justifyContent: "flex-end",
                filter: "blur(0.5px)",
              }}
            >
              <div
                style={{
                  width: CX,
                  height: LINE_H,
                  flexShrink: 0,
                  background: `linear-gradient(to left, ${LINE_GRAD})`,
                }}
              />
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Logo lockup ───
// Loopscale fades in centered (f24–96, linear), slides left f86–126.
// Transfero + etherfuse strip (with both × marks) fades in at rest (f98–168).
const Logos: React.FC<{ frame: number; dimOut: number }> = ({ frame, dimOut }) => {
  const slide = interpolate(frame, [86, 126], [0, 1], { easing: EASE_SLIDE, ...clamp });
  const dx = 366 * (1 - slide);
  const loopscaleOpacity = interpolate(frame, [24, 96], [0, 1], clamp) * dimOut;
  const stripOpacity = interpolate(frame, [98, 168], [0, 1], clamp) * dimOut;

  // Velocity-proportional motion blur on the slide (peak ~23 px/frame).
  const slidePrev = interpolate(frame - 1, [86, 126], [0, 1], { easing: EASE_SLIDE, ...clamp });
  const vx = Math.abs(366 * (slide - slidePrev));
  const blur = Math.min(vx * 0.08, 2);

  return (
    <>
      {stripOpacity > 0 && (
        <Img
          src={staticFile("loopscale-assets/mid-strip.png")}
          style={{
            position: "absolute",
            left: 432,
            top: 318,
            width: 728,
            height: 84,
            opacity: stripOpacity,
          }}
        />
      )}
      {loopscaleOpacity > 0 && (
        <Img
          src={staticFile("loopscale-assets/loopscale-logo.png")}
          style={{
            position: "absolute",
            left: 112,
            top: 322,
            width: 310,
            height: 78,
            opacity: loopscaleOpacity,
            transform: `translateX(${dx}px)`,
            filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        />
      )}
    </>
  );
};

// ─── Coins ───
// Transfero token pops at center-bottom (f176–218), then shifts left
// while the etherfuse coin emerges from behind it to the right.
const Coins: React.FC<{ frame: number; dimOut: number }> = ({ frame, dimOut }) => {
  if (frame < 176 || dimOut <= 0) return null;

  const pop = interpolate(frame, [176, 218], [0, 1], { easing: EASE_POP, ...clamp });
  const c1 = interpolate(frame, [206, 244], [0, 1], { easing: EASE_COIN1, ...clamp });
  const c2 = interpolate(frame, [212, 248], [0, 1], { easing: EASE_COIN2, ...clamp });

  // Rest centers: coin1 (586.5, 574.5), coin2 (681.5, 574.5); both start at x=640.
  const dx1 = 53.5 * (1 - c1);
  const dx2 = -41.5 * (1 - c2);

  const c2Prev = interpolate(frame - 1, [212, 248], [0, 1], { easing: EASE_COIN2, ...clamp });
  const v2 = Math.abs(41.5 * (c2 - c2Prev));
  const blur2 = Math.min(v2 * 0.12, 1.5);

  return (
    <>
      {/* etherfuse coin — behind, emerges rightward */}
      <Img
        src={staticFile("loopscale-assets/coin-etherfuse.png")}
        style={{
          position: "absolute",
          left: 616.5,
          top: 509.5,
          width: 130,
          height: 130,
          opacity: dimOut,
          transform: `translateX(${dx2}px) scale(${pop})`,
          filter: blur2 > 0.3 ? `blur(${blur2.toFixed(2)}px)` : undefined,
        }}
      />
      {/* Transfero token — front */}
      <Img
        src={staticFile("loopscale-assets/coin-transfero.png")}
        style={{
          position: "absolute",
          left: 521.5,
          top: 509.5,
          width: 130,
          height: 130,
          opacity: dimOut,
          transform: `translateX(${dx1}px) scale(${pop})`,
        }}
      />
    </>
  );
};

export const LoopscaleComposition: React.FC = () => {
  const frame = useCurrentFrame();
  // Content (logos + coins) dims to zero linearly f309–360; lines persist.
  const dimOut = interpolate(frame, [309, 360], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <LineField frame={frame} />
      <Logos frame={frame} dimOut={dimOut} />
      <Coins frame={frame} dimOut={dimOut} />
    </AbsoluteFill>
  );
};

export const loopscaleReplicateMeta = {
  id: "Loopscale-Replicate",
  component: LoopscaleComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
