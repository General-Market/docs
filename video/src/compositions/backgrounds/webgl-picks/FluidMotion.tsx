// Source: a Codrops-style "Fluid Motion" four-section essay.
// The original is a long scrolling page with a fixed "Fluid Motion" headline
// behind the content and four numbered sections each comparing a "yes" vs "no"
// demo. The browser scroll is simulated here — the page slides up over 10s and
// each demo card auto-plays its little GSAP timeline as it enters view.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const BG = "#202022";        // backgroundLowerlight
const MID = "#101012";       // backgroundMidnight
const CTRL = "#3a3a3c";      // backgroundControls
const FG = "#e0e0e3";
const LOW = "#9a9a9e";
const ACCENT_OK = "#41c46c";
const ACCENT_BAD = "#e85a2c";
const GREEN = "#10a75f";

const PAGE_H = 4400; // simulated total scroll height in design px
const VIEW_H = 1080;

// Smooth ease-in-out for the scroll
const ease = Easing.bezier(0.4, 0, 0.2, 1);

type SectionLocalState = {
  // 0..1, where 0 means "just entered" and 1 means "completed"
  progress: number;
  visible: boolean;
};

// Map a top of an element (in design pixels) to a local 0..1 once it crosses
// the middle of the viewport. ~1.4s of demo time per section.
const localFromScroll = (scrollY: number, sectionTop: number): SectionLocalState => {
  const enter = sectionTop - VIEW_H * 0.7;
  const finish = sectionTop - VIEW_H * 0.15;
  if (scrollY < enter) return { progress: 0, visible: false };
  const t = (scrollY - enter) / Math.max(1, finish - enter);
  return {
    progress: Math.max(0, Math.min(1, t)),
    visible: scrollY > enter - 200,
  };
};

// ── Section frame ─────────────────────────────────────────────────────────

const SectionShell: React.FC<{
  number: string;
  title: string;
  description: string;
  explain: string;
  top: number;
  yes: React.ReactNode;
  no: React.ReactNode;
  yesProgress: number;
  noProgress: number;
}> = ({ number, title, description, explain, top, yes, no, yesProgress, noProgress }) => (
  <section
    style={{
      position: "absolute",
      top,
      left: 0,
      right: 0,
      height: 980,
      padding: "60px 120px",
      boxSizing: "border-box",
      color: FG,
    }}
  >
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 360px", gap: 32 }}>
      <div
        style={{
          fontFamily: '"Roboto Slab", "Times New Roman", serif',
          fontSize: 80,
          color: FG,
          transform: "rotate(-90deg) translate(-40px, 30px)",
          transformOrigin: "top left",
          opacity: 0.9,
        }}
      >
        {number}
      </div>
      <DemoCard ok progress={yesProgress}>
        {yes}
      </DemoCard>
      <DemoCard ok={false} progress={noProgress}>
        {no}
      </DemoCard>
      <div style={{ marginTop: 28 }}>
        <div style={{ height: 6, background: "#ddd", marginBottom: 24 }} />
        <div
          style={{
            color: LOW,
            fontSize: 18,
            lineHeight: 1.5,
            background: BG,
            padding: "16px 18px",
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
          }}
        >
          {explain}
        </div>
      </div>
    </div>
    <h1
      style={{
        position: "absolute",
        left: 380,
        bottom: 60,
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.3em",
        fontWeight: 600,
        fontSize: 44,
        color: FG,
      }}
    >
      {title}
    </h1>
    <p
      style={{
        position: "absolute",
        left: 380,
        right: 120,
        bottom: -120,
        margin: 0,
        background: BG,
        padding: "30px 40px",
        color: FG,
        boxShadow: "0 12px 36px rgba(0,0,0,.4)",
        maxWidth: 900,
      }}
    >
      {description}
    </p>
  </section>
);

const DemoCard: React.FC<{ ok: boolean; progress: number; children: React.ReactNode }> = ({
  ok,
  progress,
  children,
}) => {
  // Overlay fades out as the demo plays then fades back to the "done" state.
  const overlayOpacity = progress < 0.1
    ? 1
    : progress > 0.9
    ? 0.97
    : 0;
  return (
    <div
      style={{
        position: "relative",
        height: 340,
        background: "white",
        borderBottom: `5px solid ${ok ? ACCENT_OK : ACCENT_BAD}`,
        boxShadow: "inset 0 0 1px rgba(180,180,180,1)",
        overflow: "hidden",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: MID,
          opacity: overlayOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: LOW,
          fontSize: 32,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            background: CTRL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: ok ? ACCENT_OK : ACCENT_BAD,
            fontSize: 30,
            marginRight: 22,
          }}
        >
          {ok ? "✓" : "✕"}
        </div>
        <span style={{ opacity: 0.6 }}>▶</span>
      </div>
    </div>
  );
};

// ── Demo 1: Morphing form into confirmation ──────────────────────────────

const MorphDemo: React.FC<{ progress: number; flip?: boolean }> = ({ progress, flip }) => {
  // Field 1, 2, 3 collapse into "name" headline and the underline rows below.
  const t = progress; // 0..1
  const f3 = 1 - Math.min(1, t / 0.4);
  const text2Opacity = 1 - Math.min(1, t / 0.4);
  const f2 = 1 - Math.min(1, Math.max(0, (t - 0.2) / 0.3));
  const text1Opacity = 1 - Math.min(1, Math.max(0, (t - 0.4) / 0.3));
  const f1 = 1 - Math.min(1, Math.max(0, (t - 0.4) / 0.3));
  const headline = Math.min(1, Math.max(0, (t - 0.45) / 0.3));
  const lines = Math.min(1, Math.max(0, (t - 0.55) / 0.4));

  const flipDeg = flip ? Math.min(180, t * 360) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", padding: 24 }}>
      <div
        style={{
          width: 170,
          background: "#fff",
          border: `2px solid ${GREEN}`,
          borderRadius: 6,
          padding: "14px 12px",
          position: "relative",
        }}
      >
        {/* fake header text */}
        <div style={{ height: 9, background: "#cdd1d4", marginBottom: 14, width: "70%", opacity: 1 }} />
        {/* field 3 */}
        <FieldMorph
          progress={f3}
          textOpacity={text2Opacity}
          flipDeg={flipDeg}
        />
        {/* field 2 */}
        <FieldMorph
          progress={f2}
          textOpacity={text1Opacity}
          flipDeg={flipDeg}
        />
        {/* field 1 */}
        <FieldMorph
          progress={f1}
          textOpacity={text1Opacity}
          flipDeg={flipDeg}
        />
        {/* Big morphed headline */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 12,
            right: 12,
            opacity: headline,
            fontFamily: '"Helvetica Neue", sans-serif',
            fontWeight: 700,
            fontSize: 16,
            color: "#3b4144",
          }}
        >
          Rachel Smith
        </div>
        {/* Three result lines */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 70 + i * 18,
              height: 9,
              background: "#cdd1d4",
              opacity: lines,
              transformOrigin: "left",
              transform: `scaleX(${0.4 + 0.6 * Math.min(1, lines * 1.4 - i * 0.3)})`,
            }}
          />
        ))}
        {/* button */}
        <div
          style={{
            position: "absolute",
            left: 28,
            right: 28,
            bottom: 14,
            height: 30,
            background: GREEN,
            transform: `scale(${1 + 0.2 * Math.sin(progress * Math.PI)})`,
          }}
        />
      </div>
    </div>
  );
};

const FieldMorph: React.FC<{ progress: number; textOpacity: number; flipDeg: number }> = ({
  progress,
  textOpacity,
  flipDeg,
}) => (
  <div
    style={{
      height: 18,
      marginBottom: 14,
      background: "#f5f6f7",
      border: "1px solid #b1b6bb",
      transform: `scaleY(${progress}) rotateY(${flipDeg}deg)`,
      transformOrigin: "center",
    }}
  >
    <div
      style={{
        height: 9,
        margin: "4px 6px",
        background: "#cdd1d4",
        opacity: textOpacity * progress,
        width: "70%",
      }}
    />
  </div>
);

// ── Demo 2: Context-keeping vs jarring modal ─────────────────────────────

const ContextDemo: React.FC<{ progress: number; keepContext: boolean }> = ({ progress, keepContext }) => {
  const t = progress;
  // Marker shape morph timing
  const dotW = 14 + (200 - 14) * Math.max(0, Math.min(1, t * 2));
  const dotH = 14 + (65 - 14) * Math.max(0, Math.min(1, t * 2));
  const showRows = Math.max(0, Math.min(1, (t - 0.25) / 0.4));
  const labelMove = Math.max(0, Math.min(1, t * 2)) * -45;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          'url("https://s3-us-west-2.amazonaws.com/s.cdpn.io/28963/basemap.jpg") center/cover',
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: dotW,
          height: dotH,
          background: keepContext ? "white" : ACCENT_OK,
          borderRadius: keepContext ? 2 : 12,
          border: `2px solid ${keepContext ? "#ddd" : "transparent"}`,
          boxShadow: keepContext ? "0 6px 20px rgba(0,0,0,.25)" : "0 0 0 4px rgba(16,167,95,.25)",
          transition: "none",
        }}
      >
        {/* $147k label */}
        <div
          style={{
            color: keepContext ? "#3b4144" : "white",
            fontFamily: '"Helvetica Neue", sans-serif',
            fontWeight: 700,
            fontSize: 13,
            position: "absolute",
            left: keepContext ? 14 : "50%",
            top: keepContext ? 8 : "50%",
            transform: keepContext
              ? `translateY(${labelMove}px)`
              : "translate(-50%, -50%)",
          }}
        >
          $147k
        </div>
        {/* When keeping context, draw the house silhouette + small bars */}
        {keepContext && (
          <>
            <div
              style={{
                position: "absolute",
                left: 10,
                top: 30,
                width: 28,
                height: 28,
                background: ACCENT_OK,
                clipPath:
                  "polygon(50% 0%, 100% 50%, 85% 50%, 85% 100%, 15% 100%, 15% 50%, 0% 50%)",
                opacity: showRows,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 50,
                top: 30,
                right: 14,
                height: 6,
                background: CTRL,
                opacity: showRows,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 50,
                top: 44,
                right: 14,
                height: 6,
                background: CTRL,
                opacity: showRows,
              }}
            />
          </>
        )}
      </div>
      {/* When NOT keeping context, fake an unrelated modal slamming up */}
      {!keepContext && t > 0.35 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            width: 240,
            height: 110,
            background: "white",
            borderRadius: 6,
            boxShadow: "0 18px 50px rgba(0,0,0,.55)",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div style={{ float: "right", color: LOW }}>✕</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#3b4144", marginBottom: 12 }}>$147k</div>
          <div style={{ height: 6, background: CTRL, marginBottom: 8, width: "80%" }} />
          <div style={{ height: 6, background: CTRL, width: "65%" }} />
        </div>
      )}
    </div>
  );
};

// ── Demo 3: Entrances — calm grow vs chaotic spin ────────────────────────

const EntranceDemo: React.FC<{ progress: number; calm: boolean }> = ({ progress, calm }) => {
  const colors = ["#b51d02", "#fbb100", "#fdd167", "#004f3a", "#10a75f", "#20c063", "#2ed975"];
  const segments = 8;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 484 436" width="80%" height="80%">
        {Array.from({ length: segments }).map((_, i) => {
          const t = Math.max(0, Math.min(1, progress * 1.8 - i * 0.08));
          const scale = calm
            ? 0.9 + 0.1 * t
            : 1 - Math.cos((1 - t) * Math.PI * 2) * (1 - t) * 0.5;
          const rot = calm ? 0 : (1 - t) * 500;
          const opacity = t;
          const cx = 156 + (i % 2) * 220;
          const cy = 110 + Math.floor(i / 2) * 110;
          return (
            <g
              key={i}
              transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${scale}) translate(${-cx} ${-cy})`}
              opacity={opacity}
            >
              <circle cx={cx} cy={cy} r={80} fill={colors[i % colors.length]} />
            </g>
          );
        })}
        <rect
          x={14}
          y={22}
          width={20}
          height={176}
          fill="#cdd1d4"
          opacity={progress * 2}
          transform={`scale(1, ${calm ? progress * 1.4 : Math.min(1, 1 - Math.cos(progress * Math.PI * 4) * 0.6 + progress)})`}
          style={{ transformOrigin: "24px 24px" }}
        />
        <rect
          x={14}
          y={240}
          width={20}
          height={176}
          fill="#cdd1d4"
          opacity={progress * 2}
        />
        <rect width="100%" height="100%" fill="none" stroke="#b1b6bb" />
      </svg>
    </div>
  );
};

// ── Demo 4: Developer standards — proper accel vs janky ──────────────────

const DevDemo: React.FC<{ progress: number; smooth: boolean }> = ({ progress, smooth }) => {
  const reveal = Math.max(0, Math.min(1, progress * 1.3));
  const wobble = smooth ? 0 : Math.sin(progress * 50) * 4;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#e2f2e4", padding: 24, boxSizing: "border-box" }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          width: 50,
          height: 70,
          background: "#fff",
          borderRadius: 6,
          opacity: reveal,
          transform: `translateY(${wobble}px) scale(${0.9 + reveal * 0.1})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 35,
          top: 60,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: GREEN,
          opacity: reveal,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 12,
          width: 120,
          height: 32,
          background: ACCENT_OK,
          opacity: reveal,
          transform: `scaleX(${0.6 + reveal * 0.4})`,
          transformOrigin: "left",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 50,
          width: 100,
          height: 32,
          background: "#00d2a9",
          opacity: reveal,
          transform: `scaleX(${0.5 + reveal * 0.5})`,
          transformOrigin: "left",
        }}
      />
      <button
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(progress * Math.PI) * 0.15})`,
          padding: "10px 20px",
          background: progress > 0.2 ? "#ff7857" : ACCENT_OK,
          color: "white",
          border: "none",
          borderRadius: 6,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          opacity: progress < 0.05 ? 1 : Math.max(0, 1 - progress * 3),
        }}
      >
        Start
      </button>
      <div
        style={{
          position: "absolute",
          left: 30,
          bottom: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: GREEN,
          opacity: reveal,
          transform: `translateY(${smooth ? 0 : Math.sin(progress * 20) * 8}px)`,
        }}
      />
    </div>
  );
};

// ── Side nav indicator ────────────────────────────────────────────────────

const SideNav: React.FC<{ activeIdx: number }> = ({ activeIdx }) => (
  <div
    style={{
      position: "fixed",
      right: 30,
      top: 100,
      bottom: 100,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      zIndex: 50,
    }}
  >
    <div
      style={{
        position: "absolute",
        right: 17,
        top: 0,
        bottom: 0,
        width: 2,
        background: MID,
      }}
    />
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: MID,
          transform: i === activeIdx ? "scale(1.4)" : "scale(1)",
          transition: "none",
        }}
      />
    ))}
    <div
      style={{
        width: 50,
        height: 50,
        background: MID,
        transform: "translateX(-15px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 20,
      }}
    >
      ↓
    </div>
  </div>
);

// ── Main scene ────────────────────────────────────────────────────────────

const SECTIONS = [
  { number: "01", title: "Morphing", description: "In Fluid Motion, elements transform from one state to another — they don't blink in and out.", explain: "Morphing does mean shapes can shift. Morphing does not get paired with flipping." },
  { number: "02", title: "Context-Shifting", description: "Users scan in saccades — preserve placement. New windows force re-scanning.", explain: "The button becomes the title. We keep spatial awareness for the viewer." },
  { number: "03", title: "Entrances and Exits", description: "Standardized entrances. 90% scale + opacity for a subtle 'grew' effect.", explain: "Entrances start from 90% scale so as not to be jarring." },
  { number: "04", title: "Developer Standards", description: "How things move matters as much as the motion itself. Transform + opacity, hardware accelerated.", explain: "Best practices for interaction and fluid movement. Touch events don't wait 300ms." },
];

const SECTION_HEIGHT = 1100;
const SECTION_TOPS = SECTIONS.map((_, i) => i * SECTION_HEIGHT);

export const FluidMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const scrollProgress = ease(t);
  const scrollY = scrollProgress * (PAGE_H - VIEW_H);

  const states = SECTION_TOPS.map((top) => localFromScroll(scrollY, top));
  // Same value drives both yes/no demos
  const activeIdx = states.reduce(
    (acc, s, i) => (s.progress > 0.1 ? i : acc),
    0,
  );

  // Background "Fluid Motion" word — fixed position behind everything
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 380,
          color: "white",
          fontFamily: '"Oswald", system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 180,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          textShadow: "0 5px 30px rgba(0,0,0,0.2)",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      >
        Fluid Motion
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          transform: `translateY(${-scrollY}px)`,
          willChange: "transform",
        }}
      >
        {SECTIONS.map((s, i) => (
          <SectionShell
            key={i}
            number={s.number}
            title={s.title}
            description={s.description}
            explain={s.explain}
            top={SECTION_TOPS[i] + 80}
            yesProgress={states[i].progress}
            noProgress={states[i].progress}
            yes={
              i === 0 ? <MorphDemo progress={states[i].progress} /> :
              i === 1 ? <ContextDemo progress={states[i].progress} keepContext /> :
              i === 2 ? <EntranceDemo progress={states[i].progress} calm /> :
              <DevDemo progress={states[i].progress} smooth />
            }
            no={
              i === 0 ? <MorphDemo progress={states[i].progress} flip /> :
              i === 1 ? <ContextDemo progress={states[i].progress} keepContext={false} /> :
              i === 2 ? <EntranceDemo progress={states[i].progress} calm={false} /> :
              <DevDemo progress={states[i].progress} smooth={false} />
            }
          />
        ))}
      </div>

      <SideNav activeIdx={activeIdx} />
    </AbsoluteFill>
  );
};
