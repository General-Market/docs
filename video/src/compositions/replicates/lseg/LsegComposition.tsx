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

const Photo: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style?: React.CSSProperties;
}> = ({ src, x, y, w, h, style }) => (
  <Img
    src={A(src)}
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      objectFit: "cover",
      ...style,
    }}
  />
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

// ————— S2 [103,166) — what-if split —————
const S2: React.FC = () => {
  const f = useCurrentFrame(); // local
  const text = "What if you could manage risk...";
  const n = Math.floor(interpolate(f, [2, 34], [0, text.length], { ...clamp }));
  return (
    <AbsoluteFill style={{ backgroundColor: "#04053a" }}>
      <Photo src="handshake-glass.png" x={0} y={0} w={957} h={1080} />
      <div
        style={{
          position: "absolute",
          left: 957,
          top: 0,
          width: 8,
          height: 1080,
          background: "#fff",
        }}
      />
      <Photo src="phone-verification.png" x={965} y={0} w={913} h={1080} />
      <div
        style={{
          position: "absolute",
          left: 1878,
          top: 0,
          width: 42,
          height: 1080,
          background: "#060B4E",
        }}
      />
      <DotPanel x={1888} y={340} w={32} h={500} opacity={0.5} />
      <div
        style={{
          position: "absolute",
          left: 286,
          top: 528,
          width: 1400,
          fontFamily: SANS,
          fontSize: 66,
          fontWeight: 500,
          color: "#fff",
          letterSpacing: 1,
        }}
      >
        {text.slice(0, n)}
      </div>
    </AbsoluteFill>
  );
};

// ————— S3a [166,220) — the moment it appears —————
const S3a: React.FC = () => {
  const f = useCurrentFrame();
  const slide = interpolate(f, [0, 26], [1, 0], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${-slide * 640}px)`,
        }}
      >
        <Photo src="eye-macro.png" x={0} y={0} w={585} h={1080} />
        {/* chevron city — crops carry their own white diagonals */}
        <Photo src="city-arrow-top.png" x={586} y={0} w={410} h={578} />
        <Photo src="city-arrow-teal.png" x={586} y={578} w={410} h={502} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 1078,
          top: 470,
          fontFamily: SANS,
          fontSize: 58,
          fontWeight: 500,
          lineHeight: 1.55,
          color: COLORS.blueText,
          opacity: interpolate(f, [6, 16], [0, 1], { ...clamp }),
        }}
      >
        the moment
        <br />
        it appears
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${slide * 590}px)`,
        }}
      >
        <Photo src="man-tablet.png" x={1330} y={0} w={590} h={880} />
        <div
          style={{
            position: "absolute",
            left: 1663,
            top: 880,
            width: 257,
            height: 200,
            background: "#0A138C",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ————— S3b/c/d [220,478) — phone-touch → developer → now you can → earth —————
const S3b: React.FC = () => {
  const f = useCurrentFrame(); // local, 0 at 220
  // beat A: phone-touch + shrinking tower rail [0,44)
  const towerX = interpolate(f, [0, 40], [1462, 1922], {
    ...clamp,
    easing: easeOut,
  });
  // beat B: dev slides in to x455 (12.5s pose), pans right to x830 while
  // office enters from the left (14.5-16.2s).
  const devSlide = interpolate(f, [44, 78, 96, 148], [1090, -375, -375, 0], {
    ...clamp,
    easing: easeOut,
  });
  const officeIn = interpolate(f, [112, 152], [1, 0], {
    ...clamp,
    easing: easeOut,
  });
  // now-you-can band [160,210)
  const bandW = interpolate(f, [160, 186], [0, 650], {
    ...clamp,
    easing: easeOut,
  });
  // earth rise [208,238), title [238,250)
  const earthY = interpolate(f, [208, 238], [1080, 0], {
    ...clamp,
    easing: easeOut,
  });
  const titleO = interpolate(f, [238, 252], [0, 1], { ...clamp });
  const earthScale = interpolate(f, [208, 258], [1.02, 1.07], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {f < 130 && (
        <>
          <Photo src="phone-touch.png" x={0} y={0} w={1616} h={1080} />
          <Photo src="tower-night.png" x={towerX} y={0} w={458} h={1080} />
        </>
      )}
      {/* developer slides in from right, office from left */}
      {f >= 44 && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${devSlide}px)`,
            }}
          >
            <Photo src="developer-code.png" x={830} y={0} w={1090} h={1080} />
            <div
              style={{
                position: "absolute",
                left: 1920,
                top: 0,
                width: 145,
                height: 1080,
                background: COLORS.royalTile,
                opacity: interpolate(f, [96, 120], [1, 0], { ...clamp }),
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${-officeIn * 830}px)`,
            }}
          >
            <Photo src="office-training.png" x={0} y={0} w={830} h={1080} />
          </div>
        </>
      )}
      {/* now you can */}
      {f >= 160 && f < 216 && (
        <div
          style={{
            position: "absolute",
            left: 630,
            top: 478,
            width: bandW,
            height: 102,
            background: "#fff",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 64,
              fontWeight: 500,
              color: COLORS.blueText,
              paddingLeft: 46,
              whiteSpace: "nowrap",
            }}
          >
            now you can
          </div>
        </div>
      )}
      {/* earth full-bleed rise */}
      {f >= 208 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${earthY}px)`,
          }}
        >
          <Img
            src={A("earth.png")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1920,
              height: 1109,
              objectFit: "cover",
              transform: `scale(${earthScale})`,
            }}
          />
          <div
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
  const f = useCurrentFrame(); // local, 0 at 478 (≈19.92s)
  const t = f / FPS + 19.92;
  // center column scrolls up fast then drifts; sides drift down.
  const c = interpolate(t, [20.4, 21, 22, 24, 25.6], [300, 0, -805, -830, -845], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const s = interpolate(t, [21, 22, 24, 25.6], [0, 293, 305, 320], {
    ...clamp,
  });
  // earth shrinks from full-bleed into the centre tile, then rides the column
  const er = interpolate(t, [19.92, 20.42], [0, 1], {
    ...clamp,
    easing: easeOut,
  });
  const ex = interpolate(er, [0, 1], [0, 345]);
  const ey = interpolate(er, [0, 1], [0, 186]) + (t > 20.42 ? c - 0 : 0);
  const ew = interpolate(er, [0, 1], [1920, 1212]);
  const eh = interpolate(er, [0, 1], [1109, 700]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {/* left column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${s}px)` }}>
        <Photo src="hex-paving-couple.png" x={0} y={-305} w={478} h={505} />
        <div style={{ position: "absolute", left: 0, top: 200, width: 478, height: 345, background: COLORS.royalTile }} />
        <Photo src="gherkin-towers.png" x={0} y={545} w={478} h={535} />
      </div>
      {/* right column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${s}px)` }}>
        <Photo src="container-worker.png" x={1443} y={-305} w={477} h={175} />
        <div style={{ position: "absolute", left: 1443, top: -130, width: 477, height: 417, background: COLORS.lightBlueTile }} />
        <Photo src="microphones.png" x={1447} y={287} w={473} h={403} />
        <DotPanel x={1443} y={690} w={477} h={390} />
        <div style={{ position: "absolute", left: 1443, top: 1080, width: 477, height: 320, background: COLORS.royalTile }} />
      </div>
      {/* center column */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${c}px)` }}>
        <div style={{ position: "absolute", left: 478, top: -258, width: 965, height: 300, background: COLORS.lightBlueTile }} />
        <Photo src="boardroom.png" x={478} y={42} w={965} h={553} />
        <Photo src="credit-card.png" x={957} y={595} w={486} h={485} />
        <div style={{ position: "absolute", left: 478, top: 595, width: 479, height: 485, background: "#fff" }} />
        <Photo src="navy-skyline.png" x={481} y={1095} w={958} h={545} />
        <div style={{ position: "absolute", left: 478, top: 1640, width: 965, height: 385, background: COLORS.royalTile }} />
      </div>
      {/* earth transition layer */}
      {t < 22 && (
        <Img
          src={A("earth.png")}
          style={{ position: "absolute", left: ex, top: ey, width: ew, height: eh, objectFit: "cover" }}
        />
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
  const t = f / FPS + 25.58;
  const shift = -190 * (t - 26.5);
  const photoO = (a: number, b: number) =>
    interpolate(t, [a, a + 0.35, b, b + 0.35], [0, 1, 1, 0], { ...clamp });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.royalChecklist }}>
      <div style={{ position: "absolute", left: 960, top: 0, width: 960, height: 1080 }}>
        <Photo src="waterfall-poncho.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(25.7, 28.1) }} />
        <Photo src="podium-speaker.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(28.1, 30.2) }} />
        <Photo src="paris-street.png" x={0} y={0} w={960} h={1080} style={{ opacity: photoO(30.2, 32.6) }} />
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
  const handW = interpolate(f, [0, 14], [1240, 1459], { ...clamp, easing: easeOut });
  const contX = interpolate(f, [0, 14], [1470, 1694], { ...clamp, easing: easeOut });
  const duo = interpolate(f, [0, 18], [1, 0], { ...clamp });
  const tripIn = interpolate(f, [63, 90], [1, 0], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {f < 78 && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, width: handW, height: 1080, overflow: "hidden" }}>
            <Photo src="handshake-office.png" x={0} y={0} w={1459} h={1080} />
          </div>
          <div style={{ position: "absolute", left: contX, top: 0, width: 1920 - contX, height: 1080, overflow: "hidden" }}>
            <Photo src="containers-red.png" x={0} y={0} w={226} h={1080} />
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
          <Photo src="street-blur.png" x={0} y={0} w={490} h={1080} />
          <Photo src="phone-terminal.png" x={490} y={0} w={794} h={1080} />
          <div style={{ position: "absolute", left: 1284, top: 0, width: 69, height: 1080, background: COLORS.royalTile }} />
          <Photo src="skyscrapers-up.png" x={1353} y={0} w={518} h={1080} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ————— S7 [889,1275) — benefits run —————
const S7: React.FC = () => {
  const f = useCurrentFrame(); // 0 at 889 (37.04s)
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
          <Photo src="archer.png" x={418} y={0} w={1082} h={335} />
          <Photo src="confetti-bw.png" x={418} y={943} w={1082} h={200} />
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
          <Photo src="train-woman.png" x={1460} y={0} w={460} h={1080} />
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
  const zoom = 1 + f * 0.0003;
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
          <Img
            src={A("dublin-riverfront.png")}
            style={{
              position: "absolute",
              inset: 0,
              width: 1920,
              height: 1080,
              transform: `scale(${zoom})`,
            }}
          />
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
