import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from "remotion";
import {
  COLORS,
  SANS,
  SERIF,
  MAP_GRID,
  MAP_ORIGIN,
  MAP_PITCH,
  MAP_DOT,
  Keys,
  S2_TEXT,
  S2_SCROLL,
  S3A_EYECHEV,
  S3A_TAB,
  S3B_GROUP_DX,
  DEV_EDGE,
  PHONE_EDGE,
  TOWER,
  BAND,
  EARTH_XFADE,
  EARTH_TITLE,
  EARTH_TILE,
  S4_C,
  S4_S,
  S4_SL,
  S4_SR,
  S4_GZ,
  SKY_EXPAND,
  S4_LEFT,
  S4_RIGHT,
  S4_CENTER,
  SKY_TITLE,
  PANEL_MOTION,
  B1_ARCHER_H,
  B1_CONFETTI_TOP,
  S6_DX,
  S6_CONT,
  S6_RL,
  S7_DL,
  S7_CR,
  S7_CYB,
  TxtKeys,
  B1_TXT,
  B2_TXT,
  B2_PL,
  B2_PT,
  B3_R,
  S7_D,
  B3_Z,
  DOT_PARA,
  CROWD_APEX,
  S3A_TXT,
  S5_SHIFT,
  S5_FRAME,
  S5_PHASES,
  CUBE_POSE,
  S8_CAPS,
  S8_CAP_TOP,
  S8_CAP_SIZE,
} from "./data";

// "Introducing LSEG World-Check On Demand" — 1:1 replicate.
// Reference: 1920x1080 @ 24fps (conformed), 67.04s => 1609 frames.
// Scene cuts (ffmpeg scene-detect, seconds): 0 / 4.29 / 9.17 / 19.92 /
// 25.58 / 32.5 / 37.04 / 53.125 / end. All photographic panels are baked
// crops from the reference (public/lseg-replicate/assets), mounted at their
// measured source rects; every plate, wipe, text and pattern is live DOM.
// Timing inside scenes is round-0: keyed to the per-second ref frames.

export const FPS = 24;
export const DURATION = 1609;

const A = (p: string) => staticFile(`lseg-replicate/assets/${p}`);
const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
const easeOut = Easing.out(Easing.cubic);

// Linear interpolation through a measured [frame, value] key table.
const keyed = (keys: Keys, f: number): number => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, v0] = keys[i - 1];
      const [f1, v1] = keys[i];
      return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0);
    }
  }
  return keys[keys.length - 1][1];
};

// Measured internal panel motion: translate/scale the still so it replays the
// ref clip's tracked drift, anchored so the asset's own source frame renders
// as cropped (transform = measured(fa) - measured(anchor)).
const panelMotion = (
  name: string,
  fa: number,
  anchor: number,
): { dx: number; dy: number; s: number } => {
  const keys = PANEL_MOTION[name];
  if (!keys) return { dx: 0, dy: 0, s: 1 };
  const at = (f: number, i: 1 | 2 | 3): number =>
    keyed(keys.map((k) => [k[0], k[i]] as [number, number]), f);
  return {
    dx: at(fa, 1) - at(anchor, 1),
    dy: at(fa, 2) - at(anchor, 2),
    s: at(fa, 3) / at(anchor, 3),
  };
};

const Photo: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style?: React.CSSProperties;
  motion?: { dx: number; dy: number; s: number };
}> = ({ src, x, y, w, h, style, motion }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      overflow: "hidden",
      ...style,
    }}
  >
    <Img
      src={A(src)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        objectFit: "cover",
        transform: motion
          ? `translate(${motion.dx}px, ${motion.dy}px) scale(${motion.s})`
          : undefined,
      }}
    />
  </div>
);

// White dots on royal — the recurring side-rail pattern. Default is the S7
// gradient belt look; S4's tile is FLAT #0129F2 with a measured 16.5px pitch
// at entry (r3, FFT autocorr) relaxing to ~22 by the settle.
const DotPanel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  pitch?: number;
  dotR?: number;
  flatBg?: string;
  dots?: boolean;
}> = ({ x, y, w, h, opacity = 1, pitch = 22, dotR = 2.6, flatBg, dots = true }) => (
  <svg
    style={{ position: "absolute", left: x, top: y, opacity }}
    width={w}
    height={h}
    viewBox={`0 0 ${w} ${h}`}
  >
    <defs>
      <linearGradient id="dotbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={COLORS.dotPanelBg} />
        <stop offset="1" stopColor={COLORS.dotPanelBg2} />
      </linearGradient>
    </defs>
    <rect width={w} height={h} fill={flatBg ?? "url(#dotbg)"} />
    {dots &&
      Array.from({ length: Math.ceil(h / pitch) }, (_, r) =>
      Array.from({ length: Math.ceil(w / pitch) }, (_, c) => (
        <circle
          key={`${r}-${c}`}
          cx={pitch / 2 + c * pitch}
          cy={pitch / 2 + r * pitch}
          r={dotR}
          fill="rgba(255,255,255,0.75)"
        />
      )),
    )}
  </svg>
);

// ————— S1 [0,103) — brand open —————
const Lockup: React.FC<{
  x: number;
  y: number;
  scale?: number;
  color?: string;
  riskTransform?: string;
}> = ({ x, y, scale = 1, color = "#fff", riskTransform }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      display: "flex",
      alignItems: "flex-start",
      gap: 54,
      color,
    }}
  >
    {/* r3 ink-metered vs f60/f1580: ref caps are ~20% TALLER than Georgia's
        at matched width — both blocks scaleY 1.2; RISK block sits higher
        (ref cap-top 485 vs LSEG 488) and 14px closer. */}
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 118,
        fontWeight: 700,
        letterSpacing: 6,
        lineHeight: 0.9,
        transform: "scaleY(1.2) translateY(-8px)",
        transformOrigin: "top left",
      }}
    >
      LSEG
    </div>
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 46,
        fontWeight: 600,
        letterSpacing: 4.5,
        lineHeight: 1.18,
        transform: riskTransform ?? "scaleY(1.2) translateY(-14px)",
        transformOrigin: "top left",
        marginLeft: -14,
      }}
    >
      RISK
      <br />
      INTELLIGENCE
    </div>
  </div>
);

const S1: React.FC = () => {
  const f = useCurrentFrame();
  // gradient wash reveal, left to right (f002 shows the sweep mid-flight)
  const sweep = interpolate(f, [6, 66], [-10, 130], { ...clamp });
  const wedgeIn = interpolate(f, [16, 64], [1, 0], {
    ...clamp,
    easing: easeOut,
  });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royal }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage: `linear-gradient(90deg, rgba(0,0,0,1) ${sweep - 18}%, rgba(0,0,0,0) ${sweep}%)`,
          maskImage: `linear-gradient(90deg, rgba(0,0,0,1) ${sweep - 18}%, rgba(0,0,0,0) ${sweep}%)`,
        }}
      >
        <Lockup x={292} y={488} />
      </div>
      {/* Shibuya wedge, slides in from top-right. Crop [1240,0,680x760]. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${wedgeIn * 430}px, ${wedgeIn * -300}px)`,
          clipPath:
            "polygon(1284px 0px, 1920px 0px, 1920px 790px, 1234px 312px)",
        }}
      >
        <Photo src="shibuya-wedge.png" x={1234} y={0} w={686} h={796} />
        {/* measured 6px white seam along the lower diagonal */}
        <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
          <line x1={1234} y1={312} x2={1920} y2={790} stroke="#fff" strokeWidth={6} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ————— S2 [103,166) — what-if split + strip scroll-off —————
const S2: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 at abs 103
  const fa = f + 103;
  const text = "What if you could manage risk...";
  const n = Math.floor(interpolate(fa, [103, 130], [0, text.length], { ...clamp }));
  const scroll = keyed(S2_SCROLL, fa);
  return (
    <AbsoluteFill style={{ backgroundColor: "#04053a" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${scroll}px)` }}>
        <Photo src="handshake-glass.png" x={0} y={0} w={957} h={1080} />
        <div style={{ position: "absolute", left: 957, top: 0, width: 8, height: 1080, background: "#fff" }} />
        <Photo src="phone-verification.png" x={965} y={0} w={913} h={1080} />
        <div style={{ position: "absolute", left: 1878, top: 0, width: 42, height: 1080, background: "#060B4E" }} />
        <DotPanel x={1888} y={340} w={32} h={500} opacity={0.5} />
        {/* r2: mid-conveyor panels (belt coords from scroll-normalized crops:
            afro f150, wall f158, teal f163, train f165 — sharpest passes) */}
        <Photo src="afro-polka.png" x={1936} y={0} w={800} h={1080} />
        <Photo src="woman-wall.png" x={2765} y={0} w={840} h={1080} />
        <Photo src="teal-glass.png" x={3620} y={0} w={860} h={1080} />
        <Photo src="train-platform.png" x={4485} y={0} w={1208} h={1080} />
        <div
          style={{
            position: "absolute",
            left: S2_TEXT.x,
            top: S2_TEXT.top,
            width: 1500,
            fontFamily: SANS,
            fontSize: S2_TEXT.size,
            fontWeight: 500,
            lineHeight: 1.2,
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {text.slice(0, n)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ————— S3a [166,220) — conveyor arrival — the moment it appears —————
const S3a: React.FC = () => {
  const f = useCurrentFrame();
  const fa = f + 166;
  // Panels stream through at different velocities and never hold still:
  // eye+chevron overshoot the mount and keep exiting left; the tablet
  // trails ~350px behind; the caption rides the tablet layer behind a
  // screen-fixed clip at x1001 (all template-tracked).
  const e = keyed(S3A_EYECHEV, fa);
  const t = keyed(S3A_TAB, fa);
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${e}px)` }}>
        <Photo src="eye-macro.png" x={0} y={0} w={585} h={1080} motion={panelMotion("eye-macro", fa, 179)} />
        {/* chevron city — crops carry their own white diagonals */}
        <Photo src="city-arrow-top.png" x={586} y={0} w={410} h={578} />
        <Photo src="city-arrow-teal.png" x={586} y={578} w={410} h={502} />
      </div>
      {/* r3: the caption rides its OWN measured track (S3A_TXT) — r1's
          tablet-rider + x1001 clip was fiction (the clip cut live text from
          f185). Ref: cap-top 478 const, font ~75, two-line pitch 87. */}
      <div
        style={{
          position: "absolute",
          left: keyed(S3A_TXT, fa) - 5,
          top: 456,
          fontFamily: SANS,
          fontSize: 75,
          fontWeight: 500,
          lineHeight: 1.16,
          color: COLORS.blueText,
          opacity: interpolate(fa, [172, 182], [0, 1], { ...clamp }),
        }}
      >
        the moment
        <br />
        it appears
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${t}px)` }}>
        <Photo src="man-tablet.png" x={1330} y={0} w={590} h={880} />
        <div style={{ position: "absolute", left: 1663, top: 880, width: 257, height: 200, background: "#0A138C" }} />
      </div>
    </AbsoluteFill>
  );
};

// ————— S3b/c/d [220,478) — phone-touch → developer → now you can → earth —————
const S3b: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 at abs 220
  const fa = f + 220;
  const dx = keyed(S3B_GROUP_DX, fa);
  const devEdge = keyed(DEV_EDGE, fa);
  const phoneEdge = keyed(PHONE_EDGE, fa);
  const towerX = TOWER.x0 + TOWER.v * (fa - TOWER.f0);
  const bandW = interpolate(fa, [BAND.grow0, BAND.grow1], [0, BAND.w], {
    ...clamp,
    easing: easeOut,
  });
  const xfade = interpolate(fa, [EARTH_XFADE.f0, EARTH_XFADE.f1], [0, 1], { ...clamp });
  const titleO = interpolate(fa, [429, 433], [0, 1], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalTile }}>
      {/* phone-touch full-bleed, pushed off right by the incoming panel */}
      {fa < 300 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `polygon(${phoneEdge}px 0, 1920px 0, 1920px 1080px, ${phoneEdge}px 1080px)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${Math.max(0, phoneEdge - keyed(PHONE_EDGE, 274))}px)` }}>
            <Photo src="phone-touch-full.png" x={0} y={0} w={1920} h={1080} motion={panelMotion("phone-touch", fa, 224)} />
            {fa >= 222 && towerX < 1920 && (
              <Photo src="tower-night.png" x={towerX} y={0} w={458} h={1080} />
            )}
          </div>
        </div>
      )}
      {/* pan group: [office | developer], group coords = screen at f380 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `polygon(0 0, ${devEdge}px 0, ${devEdge}px 1080px, 0 1080px)`,
        }}
      >
        <Photo src="office-pan.png" x={-276 + dx} y={0} w={1131} h={1080} />
        <Photo src="developer-pan.png" x={855 + dx} y={0} w={1451} h={1080} />
      </div>
      {/* now you can band */}
      {fa >= BAND.grow0 && fa < BAND.hide && (
        <div
          style={{
            position: "absolute",
            left: BAND.x,
            top: BAND.y,
            width: bandW,
            height: BAND.h,
            background: "#FCFCFC",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 92,
              fontWeight: 500,
              color: "#051EEE",
              paddingLeft: 33,
              whiteSpace: "nowrap",
            }}
          >
            now you can
          </div>
        </div>
      )}
      {/* earth crossfades over everything, title riding in */}
      {xfade > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: xfade }}>
          <Photo src="earth-full.png" x={0} y={0} w={1920} h={1080} motion={panelMotion("earth", fa, 450)} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: EARTH_TITLE.top,
              width: 1920,
              textAlign: "center",
              fontFamily: SANS,
              fontSize: EARTH_TITLE.size,
              fontWeight: 500,
              color: "#fff",
              opacity: titleO,
            }}
          >
            LSEG World-Check On Demand
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ————— S4 [478,614) — mosaic —————
const S4: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 at abs 478
  const fa = f + 478;
  const c = keyed(S4_C, fa);
  const s = keyed(S4_S, fa);
  const sL = fa < 560 ? keyed(S4_SL, fa) : s;
  const sR = fa < 560 ? keyed(S4_SR, fa) : s;
  const sky = SKY_EXPAND[0][0] <= fa ? keyed(SKY_EXPAND, fa) : 1;
  // earth tile (x, w, bottom) from the measured table; h = w / 1.763
  const ex = keyed(EARTH_TILE.map(([a, x]) => [a, x] as [number, number]), fa);
  const ew = keyed(EARTH_TILE.map(([a, , w]) => [a, w] as [number, number]), fa);
  const eb = keyed(EARTH_TILE.map(([a, , , b]) => [a, b] as [number, number]), fa);
  const eh = ew / 1.763;
  const escale = ew / 1920;
  const L = S4_LEFT;
  const R = S4_RIGHT;
  const C = S4_CENTER;
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {/* left column (entry stack extends below screen: gherkin is 772 tall,
          then cyan2 at 1608 and solar at 2031 — r1's solar at y1180 was a
          displaced fiction) */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${sL}px)` }}>
        <Photo src="hex-paving-couple.png" x={L.hex.x} y={L.hex.y} w={L.hex.w} h={L.hex.h} />
        <div style={{ position: "absolute", left: L.royal.x, top: L.royal.y, width: L.royal.w, height: L.royal.h, background: COLORS.royalTile }} />
        {/* full-height gherkin (f498, 451w — right 27px sit under the earth
            tile during entry) + settled-plate top overlay at full width */}
        {fa < 540 && (
          <Photo src="gherkin-full.png" x={L.gherkin.x} y={L.gherkin.y} w={451} h={772} motion={{ dx: 0, dy: 0, s: keyed(S4_GZ, fa) }} />
        )}
        {fa >= 540 && <Photo src="gherkin2.png" x={L.gherkin.x} y={L.gherkin.y} w={478} h={492} />}
        <div style={{ position: "absolute", left: 0, top: 1608, width: 478, height: 423, background: COLORS.lightBlueTile }} />
        <Photo src="solar-panels.png" x={0} y={2031} w={478} h={260} />
      </div>
      {/* right column (dot tile is 937 tall; cyan2 below at 1917) */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${sR}px)` }}>
        <Photo src="container2.png" x={R.container.x} y={R.container.y} w={R.container.w} h={R.container.h} motion={panelMotion("container-worker", fa, 560)} />
        <div style={{ position: "absolute", left: R.cyan.x, top: R.cyan.y, width: R.cyan.w, height: R.cyan.h, background: COLORS.lightBlueTile }} />
        <Photo src="microphones.png" x={R.microphones.x} y={R.microphones.y} w={R.microphones.w} h={R.microphones.h} motion={panelMotion("microphones", fa, 536)} />
        {/* NEGATIVE A/B (r3): matching the entry-frame dot pitch (16.5 by FFT,
            then 12.9-15.5 at f506 — the halftone MORPHS) lost -0.08..-0.13 on
            the dotBR crop at every gate: live pattern, phase unknowable, and
            misplaced dense ink loses to sparse (law 4). Keep the soft 22px
            lattice; only the bg was honestly wrong (ref is FLAT #0129F2 here,
            corners 240-243/39-42/1-3 — the r0 gradient was S7's). */}
        <DotPanel x={R.dot.x} y={R.dot.y} w={R.dot.w} h={937} flatBg={COLORS.dotPanelBg} />
        <div style={{ position: "absolute", left: R.dot.x, top: 1917, width: R.dot.w, height: 700, background: COLORS.lightBlueTile }} />
      </div>
      {/* center column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${c}px)` }}>
        <Photo src="boardroom.png" x={C.boardroom.x} y={C.boardroom.y} w={C.boardroom.w} h={C.boardroom.h} motion={panelMotion("boardroom", fa, 515)} />
        <Photo src="credit-card2.png" x={C.creditCard.x} y={C.creditCard.y} w={C.creditCard.w} h={C.creditCard.h} motion={panelMotion("credit-card", fa, 560)} />
        {/* skyline tile + DOM title; expands about (961.5, 539) into S5 */}
        <div
          style={{
            position: "absolute",
            left: C.skyline.x,
            top: C.skyline.y,
            width: C.skyline.w,
            height: C.skyline.h,
            transform: `scale(${sky})`,
            transformOrigin: `${961.5 - C.skyline.x}px ${539 - C.skyline.y}px`,
          }}
        >
          <Photo src="navy-skyline.png" x={11} y={3} w={958} h={545} motion={panelMotion("navy-skyline", fa, 560)} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: SKY_TITLE.top - C.skyline.y,
              width: C.skyline.w,
              textAlign: "center",
              fontFamily: SANS,
              fontSize: SKY_TITLE.size,
              fontWeight: 600,
              color: "#fff",
              opacity: interpolate(fa, [537, 545], [0, 1], { ...clamp }),
            }}
          >
            LSEG World-Check
          </div>
        </div>
      </div>
      {/* earth tile overlay: shrinks from full-bleed, rides up and out;
          a cyan band rides directly above it during the entry */}
      {fa < 517 && eb > 0 && eb - eh > 0 && (
        <div style={{ position: "absolute", left: ex, top: eb - eh - 800, width: ew, height: 800, background: COLORS.lightBlueTile }} />
      )}
      {fa < 517 && eb > 0 && (
        <div
          style={{
            position: "absolute",
            left: ex,
            top: eb - eh,
            width: ew,
            height: eh,
            overflow: "hidden",
          }}
        >
          <Img
            src={A("earth.png")}
            style={{ position: "absolute", left: 0, top: 0, width: ew, height: eh, objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: (EARTH_TITLE.top - (1080 - 1080) ) * escale + (eh - 1080 * escale) / 2,
              width: ew,
              textAlign: "center",
              fontFamily: SANS,
              fontSize: EARTH_TITLE.size * escale,
              fontWeight: 500,
              color: "#fff",
            }}
          >
            LSEG World-Check On Demand
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ————— S5 [614,780) — checklist —————
const CHECK_ITEMS = [
  "Updates in real time",
  "Sanctions",
  "PEPs",
  "Adverse Media",
  "Enforcement Data",
];
const S5: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 614 (25.58s)
  const fa = f + 614;
  // r3: measured shift table — the belt decelerates into a SETTLE at f722
  // (rows frozen at 299/525/758 through 746), then a closing-curtain exit:
  // the frame lines converge and wipe the items, all gone by 774.
  const shift = keyed(S5_SHIFT, fa);
  const frameTop = keyed(S5_FRAME.map((k) => [k[0], k[1]] as [number, number]), fa);
  const frameBot = keyed(S5_FRAME.map((k) => [k[0], k[2]] as [number, number]), fa);
  const frameO = interpolate(fa, [672, 676, 768, 774], [0, 1, 1, 0], { ...clamp });
  const exitO = interpolate(fa, [768, 774], [1, 0], { ...clamp });
  const phase = S5_PHASES.find((p) => fa >= p.f0 && fa < p.f1) ?? S5_PHASES[4];
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalChecklist }}>
      <div style={{ position: "absolute", left: 960, top: 0, width: 960, height: 1080 }}>
        <Photo
          src={phase.src}
          x={0}
          y={0}
          w={960}
          h={1080}
          motion={phase.motion ? panelMotion(phase.motion, fa, phase.anchor) : undefined}
        />
      </div>
      {/* static frame lines (appear ~674, close 746-774) */}
      <div style={{ position: "absolute", left: 60, top: frameTop, width: 815, height: 1, background: "rgba(255,255,255,0.85)", opacity: frameO }} />
      <div style={{ position: "absolute", left: 60, top: frameBot, width: 815, height: 1, background: "rgba(255,255,255,0.85)", opacity: frameO }} />
      {/* items live inside the frame band: real clip once the frame exists
          (ref hides entries below y873; the closing lines wipe items) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath:
            fa >= 674
              ? `inset(${frameTop}px 0 ${1080 - frameBot}px 0)`
              : undefined,
          opacity: exitO,
        }}
      >
      {CHECK_ITEMS.map((label, i) => {
        const center = 520 + i * 232 + shift;
        if (center < -150 || center > 1250) return null;
        return (
          <div key={label}>
            {i > 0 && (
              <div style={{ position: "absolute", left: 60, top: center - 116, width: 815, height: 1, background: "rgba(255,255,255,0.85)" }} />
            )}
            <div style={{ position: "absolute", left: 60, top: center - 70, width: 14, height: 140, borderRadius: 7, background: "rgba(2,10,170,0.9)" }} />
            <div
              style={{
                position: "absolute",
                left: 104,
                top: center - 32,
                width: 64,
                height: 64,
                borderRadius: 32,
                border: "3px solid #fff",
                color: "#fff",
                fontFamily: SANS,
                fontSize: 36,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              !
            </div>
            <div
              style={{
                position: "absolute",
                left: 192,
                top: center - 33,
                fontFamily: SANS,
                fontSize: 48,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
      </div>
    </AbsoluteFill>
  );
};

// ————— S6 [783,889) — handshake + payment triptych —————
// Measured r2: handshake pops full-bleed at the f783 cut; [gap|containers]
// slide in from the right, drift right, then the photo exits right while the
// triptych rushes in from the LEFT (S6_RL group = royal-strip left edge).
// r1's right-side triptych entrance was direction-fiction (law 17/26).
const S6: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 781 (r3: ref cut ramps 780->782)
  const fa = f + 781;
  const dx = keyed(S6_DX, fa);
  const cont = keyed(S6_CONT, fa);
  const rl = keyed(S6_RL, fa);
  const duo = interpolate(fa, [783, 801], [1, 0], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {dx < 1920 && (
        <>
          {/* full-bleed f784 frame (washed) under the color crop while the
              ref itself is washed; its content sits at dx+151 */}
          {fa < 791 && (
            <div style={{ position: "absolute", left: dx + 151, top: 0, width: 1920, height: 1080, overflow: "hidden" }}>
              <Img src={A("handshake-full.png")} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} />
            </div>
          )}
          <div style={{ position: "absolute", left: dx, top: 0, width: 1459, height: 1080, overflow: "hidden" }}>
            <Img src={A("handshake-office.png")} style={{ position: "absolute", left: 0, top: 0, width: 1459, height: 1080 }} />
          </div>
          {cont < 1920 && (
            <div style={{ position: "absolute", left: cont, top: 0, width: Math.max(0, 1920 - cont), height: 1080, overflow: "hidden" }}>
              <Img src={A("containers-wide.png")} style={{ position: "absolute", left: 0, top: 0, width: 328, height: 1080 }} />
            </div>
          )}
        </>
      )}
      {duo > 0 && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "#1d20c0", mixBlendMode: "color", opacity: duo }} />
          <div style={{ position: "absolute", inset: 0, background: "#1215a4", mixBlendMode: "multiply", opacity: duo * 0.55 }} />
        </>
      )}
      {fa >= 820 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${rl}px)` }}>
          <Photo src="street-blur2.png" x={-1356} y={0} w={559} h={1080} />
          <Photo src="phone-terminal2.png" x={-797} y={0} w={797} h={1080} />
          <div style={{ position: "absolute", left: 0, top: 0, width: 61, height: 1080, background: COLORS.royalTile }} />
          <Photo src="sky2.png" x={61} y={0} w={503} h={1080} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ————— S7 [889,1275) — benefits run —————
// r2 rebuild: ONE conveyor. B1's rails never hold (S7_CR/S7_CYB/S7_DL); B2
// rides 750px behind the dot rail; captions enter oversized and shrink on
// measured [l,t,w] tracks; B3 arrives as a dot rail then a shared vertical
// wipe (S7_D) drops navy+train while B2 exits below; the settled B3 layout
// zooms about x=1100 (B3_Z) and the navy expands to swallow the frame.
const txtTrack = (tab: TxtKeys, f: number) => ({
  l: keyed(tab.map((k) => [k[0], k[1]] as [number, number]), f),
  t: keyed(tab.map((k) => [k[0], k[2]] as [number, number]), f),
  w: keyed(tab.map((k) => [k[0], k[3]] as [number, number]), f),
});

const S7: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 889 (37.04s)
  const fa = f + 889;
  // r3: ref map text pops ON at abs f1150 (white-px step 0->17.7k, no
  // fade) and the dot map ramps 1150->1186; r2 ran 25 frames late.
  const mapIn = interpolate(f, [261, 297], [0, 1], { ...clamp, easing: easeOut });
  const dl = keyed(S7_DL, fa);
  const cr = keyed(S7_CR, fa);
  const cyb = keyed(S7_CYB, fa);
  const p = dl + 750;
  const d = fa >= 1021 ? keyed(S7_D, fa) : 0;
  const z = fa >= 1059 ? keyed(B3_Z, fa) : 1;
  // r3: zoom center re-fit from the navy panel's own edge pairs across the
  // zoom (1065<->1123<->1135): c=995, not r2's 1100 (that fit caught the
  // f1144+ cover expansion). Left edge now tracks ref <=5px through f1135.
  const px = 995 + (p - 995) * z;
  const r0 = fa >= 1008 ? keyed(B3_R, fa) : 1920;
  const rx = 995 + (r0 - 995) * z;
  const stripW = Math.max(dl - cr, 1);
  const archH = keyed(B1_ARCHER_H, fa);
  const confT = keyed(B1_CONFETTI_TOP, fa);
  const b1 = txtTrack(B1_TXT, fa);
  const s1 = b1.w / 305;
  const b2 = txtTrack(B2_TXT, fa);
  const b2l = fa < 986 ? p + 118 : b2.l;
  const b2t = fa < 986 ? 160 : b2.t;
  const s2 = (fa < 986 ? 537 : b2.w) / 365;
  let pl = keyed(B2_PL, fa);
  if (fa < 988) pl = Math.max(pl, p + 344);
  if (fa > 1029) pl = px;
  const pt = fa < 1026 ? 652 : keyed(B2_PT, fa);
  const coverL = interpolate(fa, [1144, 1148], [408, 0], { ...clamp });
  const coverR = interpolate(fa, [1148, 1152], [1520, 1920], { ...clamp });
  const b3o = interpolate(fa, [1048, 1058], [0, 1], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {fa < 1201 && (
        <div style={{ position: "absolute", inset: 0 }}>
          {/* left column: cyan grows rightward, cyan/royal boundary rises */}
          {cr > 0 && (
            <>
              <div style={{ position: "absolute", left: 0, top: 0, width: cr, height: Math.min(cyb, 1080), background: COLORS.cyanTile }} />
              {cyb < 1080 && (
                <div style={{ position: "absolute", left: 0, top: cyb, width: cr, height: 1080 - cyb, background: COLORS.royalTile }} />
              )}
            </>
          )}
          {/* B1 strip content rides between the rails, cover-scaled */}
          {fa < 992 && dl > cr + 5 && (
            <>
              {archH > 0 && (
                <div style={{ position: "absolute", left: cr, top: 0, width: stripW, height: archH, overflow: "hidden" }}>
                  <Img src={A("archer-tall.png")} style={{ position: "absolute", left: 0, top: 0, width: stripW, height: (stripW * 434) / 1082 }} />
                </div>
              )}
              {confT < 1078 && (
                <div style={{ position: "absolute", left: cr, top: confT, width: stripW, height: 1080 - confT, overflow: "hidden" }}>
                  <Img src={A("confetti-bw.png")} style={{ position: "absolute", left: 0, top: 0, width: stripW, height: (stripW * 200) / 1082 }} />
                </div>
              )}
            </>
          )}
          {/* B1 caption: measured [l,t,w] track, shrinks 1.76x then rides out */}
          {fa <= 975 && (
            <div
              style={{
                position: "absolute",
                left: b1.l - 4 * s1,
                top: b1.t - 10 * s1,
                transform: `scale(${s1})`,
                transformOrigin: "top left",
                fontFamily: SANS,
                fontSize: 78,
                fontWeight: 500,
                lineHeight: 1.09,
                color: COLORS.blueText,
              }}
            >
              increase
              <br />
              accuracy
            </div>
          )}
          {/* Belt dot panel. The ref halftone is a LIVE pattern (NCC of any
              crop decays fast; the f990 texture reads 0.78@980, 0.34@970) —
              measured ceiling. r3: while the belt MOVES the ref pattern is a
              dense motion-blurred halftone (~12px, morphing) — a FLAT panel
              beats the 22px lattice by +0.12-0.13 there (f910 .50 vs .64,
              f958 .47 vs .59; absent ink beats misplaced, law 4). Texture in
              its tightened valid window; lattice only where r2 measured it. */}
          {fa >= 976 && fa <= 1008 ? (
            <Img
              src={A("dots-belt.png")}
              style={{ position: "absolute", left: p - 750 + keyed(DOT_PARA, fa), top: 0, width: 750, height: 1080 }}
            />
          ) : (
            // r3: dots OFF for the belt panel's whole life — the ref pattern
            // here is a live dense halftone with density waves at every
            // phase; the gradient-only panel beats the lattice on the wipe's
            // left region too (f1033 .54 -> .75 sim at ref-median luma).
            <DotPanel x={px - 750} y={0} w={750} h={1080} dots={false} />
          )}
          {/* B2 card + navy + photo */}
          {p < 1930 && (
            <>
              <div style={{ position: "absolute", left: Math.max(px, 0), top: 0, width: 1920 - Math.max(px, 0), height: 1080, background: "#fff" }} />
              {650 + (pt - 652) < 1080 && (
                <div style={{ position: "absolute", left: px, top: 650 + (pt - 652), width: 344, height: 430, background: COLORS.navyPanel }} />
              )}
              {pt < 1080 && (
                <div style={{ position: "absolute", left: pl, top: pt, width: 1096, height: 428, overflow: "hidden" }}>
                  <Img src={A("woman-phone-wide.png")} style={{ position: "absolute", left: 0, top: 0, width: 1096, height: 428 }} />
                </div>
              )}
              {fa < 1053 && (
                <div
                  style={{
                    position: "absolute",
                    left: b2l - 4 * s2,
                    top: b2t - 24 * s2,
                    transform: `scale(${s2})`,
                    transformOrigin: "top left",
                    fontFamily: SANS,
                    fontSize: 78,
                    fontWeight: 500,
                    lineHeight: 1.06,
                    color: COLORS.blueText,
                  }}
                >
                  your
                  <br />
                  customers
                </div>
              )}
            </>
          )}
          {/* B3 dot rail: flat while sliding (f1030 flat .80 vs lattice .66),
              lattice once settled (f1060 lattice .57 vs flat .43 — the ref
              pattern is coarse and crisp only at rest). */}
          {r0 < 1920 && (
            <DotPanel
              x={rx}
              y={0}
              w={465 * z}
              h={1080}
              dots={fa >= 1056}
              flatBg={fa < 1056 ? COLORS.dotPanelBg : undefined}
            />
          )}
          {/* shared vertical wipe: B3 navy + train drop from the top */}
          {d > 0 && (
            <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: d, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: px, top: 0, width: Math.max(rx - px, 0), height: 1080, background: COLORS.navyPanel }} />
              {/* r3: the window WIDENS with the zoom (panelMotion already
                  carries the content scale — it tracked this same layout
                  zoom; the div width must ride it too or the visible slice
                  freezes at 460). */}
              <Photo src="train-woman.png" x={rx} y={0} w={460 * z} h={1080} motion={panelMotion("train-woman", fa, 1091)} />
            </div>
          )}
          {/* B3 caption — drawn BEFORE the cover so the expanding navy
              occludes it (r3: ref caption dies 1144-1146 as the cover
              crosses it; it never survives to the map) */}
          {b3o > 0 && (
            <div
              style={{
                position: "absolute",
                left: 995 + (652 - 995) * z,
                top: 470 * z - 22,
                fontFamily: SANS,
                fontSize: 82 * z,
                fontWeight: 500,
                color: "#fff",
                opacity: b3o,
              }}
            >
              {fa < 1116 ? "no more waiting" : "no more blind spots"}
            </div>
          )}
          {/* navy expands left then right to swallow the frame (f1144-1152) */}
          {fa >= 1144 && (
            <div style={{ position: "absolute", left: coverL, top: 0, width: Math.max(coverR - coverL, 0), height: 1080, background: COLORS.navyPanel }} />
          )}
        </div>
      )}
      {/* B4 world map */}
      {f >= 261 && f < 336 && (
        <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.6 + 0.4 * mapIn, transform: `scale(${0.96 + 0.04 * mapIn})` }}>
            {MAP_GRID.map((row, r) =>
              row.split("").map((cell, cIdx) =>
                cell === "." ? null : (
                  <div
                    key={`${r}-${cIdx}`}
                    style={{
                      position: "absolute",
                      left: MAP_ORIGIN.x + cIdx * MAP_PITCH,
                      top: MAP_ORIGIN.y + r * MAP_PITCH,
                      width: MAP_DOT,
                      height: MAP_DOT,
                      borderRadius: 3,
                      background: cell === "C" ? "#7AD3E6" : COLORS.royalTile,
                    }}
                  />
                ),
              ),
            )}
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 428,
              width: 1920,
              textAlign: "center",
              fontFamily: SANS,
              fontSize: 66,
              fontWeight: 500,
              lineHeight: 1.75,
              color: "#fff",
            }}
          >
            World-Check
            <br />
            On Demand
          </div>
        </AbsoluteFill>
      )}
      {/* B5 crowd wedge — r3: bg is NAVY (#010D99 sampled at three corners;
          royalTile was fiction) and the ref wedge reaches x~343 — the old
          crop started at 536 and missed 190px of it (crowd-overhead2 =
          f1230 re-crop). */}
      {f >= 312 && (
        <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
          {/* r3: fixed content, ERODING wedge clip — the apex retreats on
              the measured track while the people stay put (translating the
              photo lost -0.37; freezing lost -0.07/-0.14). Edge slopes from
              f1230: top hits y0 at apex+465, bottom hits y1080 at apex+855. */}
          {(() => {
            const ax = keyed(CROWD_APEX, fa);
            return (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  // after 1245 the late asset's own baked boundary is the
                  // truer wedge (its source frame is late; A/B .93 vs .85)
                  clipPath:
                    fa < 1245
                      ? `polygon(${ax}px 585px, ${ax + 465}px 0px, 1920px 0px, 1920px 1080px, ${ax + 855}px 1080px)`
                      : undefined,
                }}
              >
                {fa < 1249 && <Photo src="crowd-overhead2.png" x={340} y={0} w={1580} h={1080} />}
                {fa >= 1245 && (
                  <Photo
                    src="crowd-overhead.png"
                    x={536}
                    y={0}
                    w={1384}
                    h={1080}
                    style={{ opacity: interpolate(fa, [1245, 1249], [0, 1], { ...clamp }) }}
                  />
                )}
              </div>
            );
          })()}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ————— S8 [1275,1609] — cube finale + lockup —————
const CUBE_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
const cubeVerts = (yaw: number, pitch: number, roll: number) => {
  const idx = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ] as Array<[number, number, number]>;
  return idx.map(([x, y, z]) => {
    // yaw around Y, pitch around X, then roll in screen plane (r3 fit model)
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const persp = 5.2 / (5.2 + z2);
    const sx = x1 * persp;
    const sy = y1 * persp;
    return [
      sx * Math.cos(roll) - sy * Math.sin(roll),
      sx * Math.sin(roll) + sy * Math.cos(roll),
    ] as [number, number];
  });
};

const S8: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 1275 (53.125s)
  const fa = f + 1275;
  const dublin = f < 199;
  // NOTE: the dublin PANEL_MOTION s-column is already relative to the f1275
  // asset (first row 0.9625 at f1278 — the zoom leaps in the first 3 frames);
  // anchor-normalizing at 1275 clamps to that row and inflates s by 4%.
  // r3: NCC registration says our plate ran 0.5-1.0% small vs ref — boost
  // ramp measured 1.010 (early) -> 1.005 (late).
  const plateBoost = interpolate(fa, [1290, 1420], [1.01, 1.005], { ...clamp });
  const m0 = panelMotion("dublin-riverfront", fa, 1275);
  const m = { dx: m0.dx, dy: m0.dy, s: m0.s * 0.9625 * plateBoost };
  // r3 cube: measured pose keys (screen space, tumbling — see data.ts).
  const pose = {
    yaw: keyed(CUBE_POSE.map((k) => [k[0], k[1]] as [number, number]), fa),
    pitch: keyed(CUBE_POSE.map((k) => [k[0], k[2]] as [number, number]), fa),
    roll: keyed(CUBE_POSE.map((k) => [k[0], k[3]] as [number, number]), fa),
    size: keyed(CUBE_POSE.map((k) => [k[0], k[4]] as [number, number]), fa),
    cx: keyed(CUBE_POSE.map((k) => [k[0], k[5]] as [number, number]), fa),
    cy: keyed(CUBE_POSE.map((k) => [k[0], k[6]] as [number, number]), fa),
  };
  const verts = cubeVerts(pose.yaw, pose.pitch, pose.roll);
  const size = pose.size;
  const ccx = pose.cx;
  const ccy = pose.cy;
  // Captions swap INSTANTLY (white-mask counts jump full<->0 in <=2f) and
  // all die at f1463; r3 ink-bbox: cap-height 66.5 (font 93), cap-top 500.5,
  // left-aligned at ref ink left, letterSpacing stretches to ref width.
  const cap = S8_CAPS.find((c) => fa >= c.f0 && fa < c.f1);
  const nowO = interpolate(f, [203, 212, 258, 268], [0, 1, 1, 0], { ...clamp });
  const lockO = interpolate(f, [273, 295], [0, 1], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalTile }}>
      {dublin && (
        <>
          {/* outer ring: f1437-inpainted wide plate — the zoom-out exposes
              content beyond the f1275 crop; a royal border here is fiction
              (the ref is always full-bleed). Interior plate covers its
              inpaint scars. */}
          {/* r3: clamp outer scale to >=1 — the formula dips to ~0.97 late in
              the zoom and leaked a royal ring on every r2 frame (the ref is
              always full-bleed; a border is fiction). The ~2% ring-content
              misregistration under the clamp is invisible in the photo ring. */}
          <Photo
            src="dublin-outer.png"
            x={0}
            y={0}
            w={1920}
            h={1080}
            motion={{ dx: m.dx, dy: m.dy - 4.6 * (m.s / 0.8886), s: Math.max((m.s / 0.8886) * 1.005, 1.0) }}
          />
          <Photo src="dublin-riverfront.png" x={0} y={0} w={1920} h={1080} motion={m} />
          <svg
            style={{ position: "absolute", left: 0, top: 0 }}
            width={1920}
            height={1080}
          >
            {CUBE_EDGES.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={ccx + verts[a][0] * size}
                y1={ccy + verts[a][1] * size}
                x2={ccx + verts[b][0] * size}
                y2={ccy + verts[b][1] * size}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth={2.6}
              />
            ))}
          </svg>
          {cap && (
            <div
              style={{
                position: "absolute",
                left: cap.left,
                top: S8_CAP_TOP,
                fontFamily: SANS,
                fontSize: S8_CAP_SIZE,
                fontWeight: 500,
                letterSpacing: cap.ls,
                whiteSpace: "nowrap",
                color: "#fff",
              }}
            >
              {cap.text}
            </div>
          )}
        </>
      )}
      {!dublin && (
        <>
          <div
            style={{
              position: "absolute",
              left: 368,
              top: 486,
              fontFamily: SANS,
              fontSize: 96,
              fontWeight: 600,
              color: COLORS.nowText,
              opacity: nowO,
            }}
          >
            Now
          </div>
          {/* r3: the END lockup's RISK block is genuinely smaller than
              S1's (ref ink 959-1217 = 258w vs S1 436w; LSEG identical). */}
          <div style={{ position: "absolute", inset: 0, opacity: lockO }}>
            <Lockup x={552} y={491} riskTransform="scale(0.59, 1.02) translateY(-2px)" />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

export const LsegComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.royal }}>
    <Sequence from={0} durationInFrames={103}>
      <S1 />
    </Sequence>
    <Sequence from={103} durationInFrames={63}>
      <S2 />
    </Sequence>
    <Sequence from={166} durationInFrames={54}>
      <S3a />
    </Sequence>
    <Sequence from={220} durationInFrames={258}>
      <S3b />
    </Sequence>
    <Sequence from={478} durationInFrames={136}>
      <S4 />
    </Sequence>
    <Sequence from={614} durationInFrames={167}>
      <S5 />
    </Sequence>
    <Sequence from={781} durationInFrames={108}>
      <S6 />
    </Sequence>
    <Sequence from={889} durationInFrames={386}>
      <S7 />
    </Sequence>
    <Sequence from={1275} durationInFrames={334}>
      <S8 />
    </Sequence>
  </AbsoluteFill>
);

export const lsegReplicateMeta = {
  id: "Lseg-Replicate",
  component: LsegComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
