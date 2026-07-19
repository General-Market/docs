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
  SKY_EXPAND,
  S4_LEFT,
  S4_RIGHT,
  S4_CENTER,
  SKY_TITLE,
  PANEL_MOTION,
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

// White dots on gradient royal — the recurring side-rail pattern.
const DotPanel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}> = ({ x, y, w, h, opacity = 1 }) => (
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
    <rect width={w} height={h} fill="url(#dotbg)" />
    {Array.from({ length: Math.ceil(h / 22) }, (_, r) =>
      Array.from({ length: Math.ceil(w / 22) }, (_, c) => (
        <circle
          key={`${r}-${c}`}
          cx={11 + c * 22}
          cy={11 + r * 22}
          r={2.6}
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
}> = ({ x, y, scale = 1, color = "#fff" }) => (
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
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 118,
        fontWeight: 700,
        letterSpacing: 8,
        lineHeight: 0.9,
      }}
    >
      LSEG
    </div>
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 46,
        fontWeight: 600,
        letterSpacing: 4,
        lineHeight: 1.18,
        paddingTop: 4,
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
            "polygon(1252px 0px, 1920px 0px, 1920px 748px, 1444px 318px)",
        }}
      >
        <Photo src="shibuya-crossing.png" x={1240} y={0} w={680} h={760} />
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(1001px 0, 1920px 0, 1920px 1080px, 1001px 1080px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 847 + t,
            top: 462,
            fontFamily: SANS,
            fontSize: 58,
            fontWeight: 500,
            lineHeight: 1.34,
            color: COLORS.blueText,
            opacity: interpolate(fa, [172, 182], [0, 1], { ...clamp }),
          }}
        >
          the moment
          <br />
          it appears
        </div>
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
      {/* left column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${s}px)` }}>
        <Photo src="hex-paving-couple.png" x={L.hex.x} y={L.hex.y} w={L.hex.w} h={L.hex.h} />
        <div style={{ position: "absolute", left: L.royal.x, top: L.royal.y, width: L.royal.w, height: L.royal.h, background: COLORS.royalTile }} />
        <Photo src="gherkin-towers.png" x={L.gherkin.x} y={L.gherkin.y} w={L.gherkin.w} h={L.gherkin.h} />
        <Photo src="solar-panels.png" x={L.solar.x} y={L.solar.y} w={L.solar.w} h={L.solar.h} />
      </div>
      {/* right column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${s}px)` }}>
        <Photo src="container-worker.png" x={R.container.x} y={R.container.y} w={R.container.w} h={R.container.h} motion={panelMotion("container-worker", fa, 587)} />
        <div style={{ position: "absolute", left: R.cyan.x, top: R.cyan.y, width: R.cyan.w, height: R.cyan.h, background: COLORS.lightBlueTile }} />
        <Photo src="microphones.png" x={R.microphones.x} y={R.microphones.y} w={R.microphones.w} h={R.microphones.h} motion={panelMotion("microphones", fa, 536)} />
        <DotPanel x={R.dot.x} y={R.dot.y} w={R.dot.w} h={R.dot.h} />
      </div>
      {/* center column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${c}px)` }}>
        <Photo src="boardroom.png" x={C.boardroom.x} y={C.boardroom.y} w={C.boardroom.w} h={C.boardroom.h} motion={panelMotion("boardroom", fa, 515)} />
        <Photo src="credit-card.png" x={C.creditCard.x} y={C.creditCard.y} w={C.creditCard.w} h={C.creditCard.h} motion={panelMotion("credit-card", fa, 515)} />
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
      {/* earth tile overlay: shrinks from full-bleed, rides up and out */}
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
  const t = f / FPS + 25.58;
  const shift = -190 * (t - 26.5);
  const photoO = (a: number, b: number) =>
    interpolate(t, [a, a + 0.35, b, b + 0.35], [0, 1, 1, 0], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalChecklist }}>
      <div style={{ position: "absolute", left: 960, top: 0, width: 960, height: 1080 }}>
        <Photo src="waterfall-poncho.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(25.7, 28.1) }} motion={panelMotion("waterfall-poncho", fa, 635)} />
        <Photo src="podium-speaker.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(28.1, 30.2) }} motion={panelMotion("podium-speaker", fa, 683)} />
        <Photo src="paris-street.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(30.2, 32.6) }} motion={panelMotion("paris-street", fa, 731)} />
      </div>
      {CHECK_ITEMS.map((label, i) => {
        const center = 520 + i * 232 + shift;
        if (center < -150 || center > 1250) return null;
        return (
          <div key={label}>
            <div style={{ position: "absolute", left: 60, top: center - 116, width: 815, height: 1, background: "rgba(255,255,255,0.85)" }} />
            {i === CHECK_ITEMS.length - 1 && (
              <div style={{ position: "absolute", left: 60, top: center + 116, width: 815, height: 1, background: "rgba(255,255,255,0.85)" }} />
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
    </AbsoluteFill>
  );
};

// ————— S6 [780,889) — handshake + payment triptych —————
const S6: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 780 (32.5s)
  const fa = f + 780;
  const handW = interpolate(f, [0, 14], [1240, 1459], { ...clamp, easing: easeOut });
  const contX = interpolate(f, [0, 14], [1470, 1694], { ...clamp, easing: easeOut });
  const duo = interpolate(f, [0, 18], [1, 0], { ...clamp });
  const tripIn = interpolate(f, [54, 82], [1, 0], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {f < 78 && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, width: handW, height: 1080, overflow: "hidden" }}>
            <Photo src="handshake-office.png" x={0} y={0} w={1459} h={1080} motion={panelMotion("handshake-office", fa, 803)} />
          </div>
          <div style={{ position: "absolute", left: contX, top: 0, width: 1920 - contX, height: 1080, overflow: "hidden" }}>
            <Photo src="containers-red.png" x={0} y={0} w={226} h={1080} motion={panelMotion("containers-red", fa, 803)} />
          </div>
          {/* duotone wash fading off */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#1d20c0",
              mixBlendMode: "color",
              opacity: duo,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#1215a4",
              mixBlendMode: "multiply",
              opacity: duo * 0.55,
            }}
          />
        </>
      )}
      {f >= 63 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${tripIn * 1920}px)`, background: "#fff" }}>
          <Photo src="street-blur.png" x={0} y={0} w={490} h={1080} motion={panelMotion("street-blur", fa, 851)} />
          <Photo src="phone-terminal.png" x={490} y={0} w={794} h={1080} motion={panelMotion("phone-terminal", fa, 851)} />
          <div style={{ position: "absolute", left: 1284, top: 0, width: 69, height: 1080, background: COLORS.royalTile }} />
          <Photo src="skyscrapers-up.png" x={1353} y={0} w={518} h={1080} motion={panelMotion("skyscrapers-up", fa, 851)} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ————— S7 [889,1275) — benefits run —————
const S7: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 889 (37.04s)
  const fa = f + 889;
  const drift = interpolate(f, [0, 72], [30, -40], { ...clamp });
  const b2In = interpolate(f, [66, 90], [1, 0], { ...clamp, easing: easeOut });
  const b3In = interpolate(f, [138, 162], [1, 0], { ...clamp, easing: easeOut });
  const mapIn = interpolate(f, [286, 306], [0, 1], { ...clamp, easing: easeOut });
  const crowdIn = interpolate(f, [312, 336], [1, 0], { ...clamp, easing: easeOut });
  const blueText = {
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: 84,
    lineHeight: 1.03,
    color: COLORS.blueText,
  } as const;
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {/* B1 increase accuracy */}
      {f < 90 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${drift}px)` }}>
          <div style={{ position: "absolute", left: 0, top: -60, width: 418, height: 500, background: COLORS.cyanTile }} />
          <div style={{ position: "absolute", left: 0, top: 440, width: 418, height: 700, background: COLORS.royalTile }} />
          <Photo src="archer.png" x={418} y={0} w={1082} h={335} motion={panelMotion("archer", fa, 923)} />
          <Photo src="confetti-bw.png" x={418} y={943} w={1082} h={200} motion={panelMotion("confetti-bw", fa, 923)} />
          <DotPanel x={1500} y={-60} w={420} h={1200} />
          <div style={{ position: "absolute", left: 510, top: 552, ...blueText }}>
            increase
            <br />
            accuracy
          </div>
        </div>
      )}
      {/* B2 your customers */}
      {f >= 66 && f < 162 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${b2In * 1920}px)`, background: "#fff" }}>
          <DotPanel x={0} y={0} w={756} h={1080} />
          <div style={{ position: "absolute", left: 756, top: 650, width: 324, height: 430, background: COLORS.navyPanel }} />
          <Photo src="woman-phone-home.png" x={1080} y={650} w={840} h={430} />
          <div style={{ position: "absolute", left: 878, top: 162, ...blueText }}>
            your
            <br />
            customers
          </div>
        </div>
      )}
      {/* B3 no more waiting / blind spots */}
      {f >= 138 && f < 296 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${b3In * 1920}px)`, background: "#fff" }}>
          <DotPanel x={0} y={0} w={465} h={1080} />
          <div style={{ position: "absolute", left: 465, top: 0, width: 985, height: 1043, background: COLORS.navyPanel }} />
          <Photo src="train-woman.png" x={1460} y={0} w={460} h={1080} motion={panelMotion("train-woman", fa, 1091)} />
          <div
            style={{
              position: "absolute",
              left: 465,
              top: 505,
              width: 985,
              textAlign: "center",
              fontFamily: SANS,
              fontSize: 64,
              fontWeight: 500,
              color: "#fff",
            }}
          >
            {f < 227 ? "no more waiting" : "no more blind spots"}
          </div>
        </div>
      )}
      {/* B4 world map */}
      {f >= 286 && f < 336 && (
        <AbsoluteFill style={{ backgroundColor: COLORS.navy, opacity: mapIn }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${0.96 + 0.04 * mapIn})` }}>
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
      {/* B5 crowd wedge */}
      {f >= 312 && (
        <AbsoluteFill style={{ backgroundColor: COLORS.royalTile }}>
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${crowdIn * 900}px)` }}>
            <Photo src="crowd-overhead.png" x={536} y={0} w={1384} h={1080} />
          </div>
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
const cubeVerts = (yaw: number, pitch: number) => {
  const v: Array<[number, number, number]> = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) v.push([sx, sy, sz]);
  // order: standard cube corners
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
    // yaw around Y, then pitch around X
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const persp = 5.2 / (5.2 + z2);
    return [x1 * persp, y1 * persp] as [number, number];
  });
};

const S8: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 1275 (53.125s)
  const dublin = f < 199;
  // isometric-ish corner view (ref f055 silhouette: cube spans ~625..1310 x,
  // ~150..885 y), slow drift. Static-plate SSIM ceiling here is ~0.44 — the
  // reference background is moving timelapse footage.
  const yaw = 0.785 + f * 0.003;
  const verts = cubeVerts(yaw, -0.42);
  const size = 272;
  const captions: Array<[number, number, string]> = [
    [9, 62, "World-Check On Demand"],
    [65, 113, "Built for automation."],
    [116, 161, "Scaled for the future."],
    [164, 199, "Trusted for 25 years."],
  ];
  const nowO = interpolate(f, [203, 212, 258, 268], [0, 1, 1, 0], { ...clamp });
  const lockO = interpolate(f, [273, 295], [0, 1], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalTile }}>
      {dublin && (
        <>
          <Photo src="dublin-riverfront.png" x={0} y={0} w={1920} h={1080} motion={panelMotion("dublin-riverfront", f + 1275, 1275)} />
          <svg
            style={{ position: "absolute", left: 0, top: 0 }}
            width={1920}
            height={1080}
          >
            {CUBE_EDGES.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={958 + verts[a][0] * size}
                y1={505 + verts[a][1] * size}
                x2={958 + verts[b][0] * size}
                y2={505 + verts[b][1] * size}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth={2.6}
              />
            ))}
          </svg>
          {captions.map(([a, b, textStr]) => {
            const o = interpolate(f, [a, a + 7, b - 6, b], [0, 1, 1, 0], {
              ...clamp,
            });
            return (
              <div
                key={textStr}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 500,
                  width: 1920,
                  textAlign: "center",
                  fontFamily: SANS,
                  fontSize: 76,
                  fontWeight: 500,
                  color: "#fff",
                  opacity: o,
                }}
              >
                {textStr}
              </div>
            );
          })}
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
          <div style={{ position: "absolute", inset: 0, opacity: lockO }}>
            <Lockup x={552} y={478} />
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
    <Sequence from={614} durationInFrames={166}>
      <S5 />
    </Sequence>
    <Sequence from={780} durationInFrames={109}>
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
