import React, { useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { gsap } from "gsap";

/* ─── timing (30fps, 339 frames ~ 11.3s) ─── */
const PHASE = {
  CHAT_IN: { start: 0, end: 80 },
  PHOTO_EXPAND: { start: 80, end: 110 },
  AI_RESPONSE: { start: 110, end: 170 },
  EMOJI_BURST: { start: 170, end: 205 },
  TRANSITION_TEXT: { start: 198, end: 258 },
  INTRODUCING: { start: 255, end: 298 },
  GEMINI_UI: { start: 293, end: 339 },
};

/* ─── colors ─── */
const BG = "#ECEDF5";
const PHONE_BG = "#FFFFFF";
const BLUE = "#4285F4";
const USER_BUBBLE = "#E8F0FE";
const AI_BUBBLE = "#FFFFFF";
const GREY_TEXT = "#5F6368";
const DARK_TEXT = "#202124";
const KB_BG = "#2C2C2E";
const KB_KEY = "#4A4A4C";
const KB_KEY_TEXT = "#FFFFFF";

/* ─── emoji constants ─── */
const PARTY = String.fromCodePoint(0x1f973);
const HEART_EYES = String.fromCodePoint(0x1f60d);
const DOG_FACE = String.fromCodePoint(0x1f436);
const DOG_FULL = String.fromCodePoint(0x1f415);
const RED_HEART = String.fromCodePoint(0x2764, 0xfe0f);
const CROWN = String.fromCodePoint(0x1f451);
const MAIL = String.fromCodePoint(0x1f4e7);
const MEMO = String.fromCodePoint(0x1f4dd);
const MIC = String.fromCodePoint(0x1f3a4);
const CAMERA = String.fromCodePoint(0x1f4f7);
const CLIP = String.fromCodePoint(0x1f4ce);
const SPARKLE = String.fromCodePoint(0x2728);
const ARROW_LEFT = String.fromCodePoint(0x2190);
const HAMBURGER = String.fromCodePoint(0x2630);
const ARROW_DOWN = String.fromCodePoint(0x25bc);
const CHECKMARK = String.fromCodePoint(0x2713);
const PLAY = String.fromCodePoint(0x25b6);

/* ─── quadratic bezier helper ─── */
function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/* ─── floating emoji config ─── */
const FLOATING_EMOJIS = [
  { emoji: HEART_EYES, endX: -240, endY: -180, size: 72, seed: 1, arcHeight: 120 },
  { emoji: PARTY, endX: -200, endY: -80, size: 66, seed: 2, arcHeight: 90 },
  { emoji: DOG_FACE, endX: -220, endY: 180, size: 44, seed: 3, arcHeight: 60 },
  { emoji: RED_HEART, endX: 280, endY: 60, size: 64, seed: 4, arcHeight: 140 },
  { emoji: RED_HEART, endX: 310, endY: 160, size: 56, seed: 5, arcHeight: 100 },
  { emoji: RED_HEART, endX: 270, endY: 250, size: 48, seed: 6, arcHeight: 80 },
  { emoji: RED_HEART, endX: 240, endY: -120, size: 42, seed: 7, arcHeight: 160 },
  { emoji: HEART_EYES, endX: 220, endY: -220, size: 50, seed: 8, arcHeight: 130 },
  { emoji: DOG_FACE, endX: -160, endY: -260, size: 36, seed: 9, arcHeight: 110 },
  { emoji: PARTY, endX: -280, endY: 60, size: 52, seed: 10, arcHeight: 100 },
];

/* ─── GSAP-driven animation state ─── */
interface AnimState {
  phoneX: number;
  phoneY: number;
  phoneRotation: number;
  phoneOpacity: number;
  phoneScale: number;
  butTextOpacity: number;
  introOpacity: number;
  introScale: number;
  introClipRight: number;
  geminiOpacity: number;
  geminiY: number;
  geminiScale: number;
  geminiPanX: number;
  geminiPanY: number;
  fadeToBlack: number;
  darkShrink: number;
  /* Per-word state for "But that's not all..." */
  wordOpacities: number[];
  wordYs: number[];
  wordXs: number[];
  allOpacity: number;
  allY: number;
  allX: number;
  dotScales: number[];
  dotOpacities: number[];
}

function createDefaultState(): AnimState {
  return {
    phoneX: 200, phoneY: 120, phoneRotation: 6, phoneOpacity: 0, phoneScale: 0.88,
    butTextOpacity: 0,
    introOpacity: 0, introScale: 0.88, introClipRight: 100,
    geminiOpacity: 0, geminiY: 120, geminiScale: 1.8, geminiPanX: -140, geminiPanY: 200,
    fadeToBlack: 0, darkShrink: 1,
    wordOpacities: [0, 0, 0], wordYs: [30, 30, 30], wordXs: [20, 20, 20],
    allOpacity: 0, allY: 30, allX: 20,
    dotScales: [0, 0, 0], dotOpacities: [0, 0, 0],
  };
}

function useGsapAnimState(fps: number): { state: AnimState; frame: number } {
  const frame = useCurrentFrame();
  const stateRef = useRef<AnimState>(createDefaultState());
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  if (!tlRef.current) {
    const s = stateRef.current;
    const sec = (f: number) => f / fps;
    const t = gsap.timeline({ paused: true });

    /* ═══ Phase 1: Phone entrance — curved motionPath arc ═══ */
    t.to(s, {
      phoneOpacity: 1,
      duration: sec(8),
      ease: "power2.out",
    }, 0);
    t.to(s, {
      phoneX: 0, phoneY: 0, phoneRotation: 0,
      duration: sec(20),
      ease: "expo.out",
      /* motionPath on a plain object: interpolate x/y through control points */
    }, 0);
    /* Overwrite the simple linear x/y with a curved path using onUpdate */
    const phoneEntryTween = gsap.to({ t: 0 }, {
      t: 1, duration: sec(20), ease: "expo.out", paused: true,
      onUpdate() {
        const progress = this.progress();
        s.phoneX = quadBezier(progress, 200, 40, 0);
        s.phoneY = quadBezier(progress, 120, -30, 0);
      },
    });
    t.add(phoneEntryTween, 0);

    /* Phone scale breathing */
    t.to(s, { phoneScale: 0.95, duration: sec(40), ease: "sine.inOut" }, 0);
    t.to(s, { phoneScale: 1.12, duration: sec(30), ease: "power2.inOut" }, sec(40));
    t.to(s, { phoneScale: 0.92, duration: sec(30), ease: "sine.inOut" }, sec(80));

    /* Emoji burst: shrink phone scale */
    t.to(s, { phoneScale: 0.88, duration: sec(20), ease: "power1.out" }, sec(PHASE.EMOJI_BURST.start));

    /* ═══ Phone exit — curved arc left ═══ */
    const exitStart = sec(PHASE.TRANSITION_TEXT.start);
    const phoneExitTween = gsap.to({ t: 0 }, {
      t: 1, duration: sec(14), ease: "power3.in", paused: true,
      onUpdate() {
        const p = this.progress();
        s.phoneX = quadBezier(p, 0, -200, -700);
        s.phoneY = quadBezier(p, 0, -60, 30);
      },
    });
    t.add(phoneExitTween, exitStart);
    t.to(s, { phoneRotation: -12, duration: sec(14), ease: "power3.in" }, exitStart);
    t.to(s, { phoneOpacity: 0, duration: sec(7), ease: "power2.in" }, exitStart);

    /* ═══ "But that's not all..." ═══ */
    const textStart = sec(PHASE.TRANSITION_TEXT.start);
    t.to(s, { butTextOpacity: 1, duration: sec(12), ease: "power2.out" }, textStart);

    /* Staggered word reveal: "But", "that's", "not" */
    const wordBase = sec(PHASE.TRANSITION_TEXT.start + 8);
    for (let i = 0; i < 3; i++) {
      const wStart = wordBase + sec(5) * i;
      t.to(s.wordOpacities, { [i]: 1, duration: sec(5), ease: "power2.out" }, wStart);
      t.to(s.wordYs, { [i]: 0, duration: sec(8), ease: "expo.out" }, wStart);
      t.to(s.wordXs, { [i]: 0, duration: sec(8), ease: "expo.out" }, wStart);
    }

    /* "all" word — delayed */
    const allStart = wordBase + sec(15);
    t.to(s, { allOpacity: 1, duration: sec(5), ease: "power2.out" }, allStart);
    t.to(s, { allY: 0, allX: 0, duration: sec(8), ease: "expo.out" }, allStart);

    /* Ellipsis dots — spring-like pop with back.out */
    const dotBase = wordBase + sec(23);
    for (let i = 0; i < 3; i++) {
      const dStart = dotBase + sec(5) * i;
      t.to(s.dotScales, { [i]: 1, duration: sec(10), ease: "back.out(4)" }, dStart);
      t.to(s.dotOpacities, { [i]: 1, duration: sec(6), ease: "power2.out" }, dStart);
    }

    /* Fade out "But that's not all..." */
    t.to(s, { butTextOpacity: 0, duration: sec(8), ease: "power2.in" }, sec(PHASE.INTRODUCING.start - 8));

    /* ═══ "Introducing" ═══ */
    t.to(s, { introOpacity: 1, duration: sec(6), ease: "power2.out" }, sec(PHASE.INTRODUCING.start));
    t.to(s, { introScale: 1.0, duration: sec(20), ease: "elastic.out(1, 0.6)" }, sec(PHASE.INTRODUCING.start));
    /* Gradient sweep: clipRight 100 → 0 */
    t.to(s, { introClipRight: 0, duration: sec(21), ease: "expo.out" }, sec(PHASE.INTRODUCING.start));
    /* Fade out */
    t.to(s, { introOpacity: 0, duration: sec(8), ease: "power2.in" }, sec(PHASE.GEMINI_UI.start - 8));

    /* ═══ Gemini UI ═══ */
    t.to(s, { geminiOpacity: 1, duration: sec(15), ease: "elastic.out(1, 0.5)" }, sec(PHASE.GEMINI_UI.start));
    t.to(s, { geminiY: 0, duration: sec(30), ease: "elastic.out(1, 0.5)" }, sec(PHASE.GEMINI_UI.start));
    t.to(s, { geminiScale: 2.2, duration: sec(46), ease: "power1.inOut" }, sec(PHASE.GEMINI_UI.start));
    t.to(s, { geminiPanX: -180, duration: sec(46), ease: "power1.inOut" }, sec(PHASE.GEMINI_UI.start));
    t.to(s, { geminiPanY: 230, duration: sec(46), ease: "power1.inOut" }, sec(PHASE.GEMINI_UI.start));

    /* ═══ Dark ending ═══ */
    t.to(s, { fadeToBlack: 0.97, duration: sec(13), ease: "power3.in" }, sec(326));
    t.to(s, { darkShrink: 0.88, duration: sec(13), ease: "power3.in" }, sec(326));

    tlRef.current = t;
  }

  /* Seek timeline to current frame */
  tlRef.current!.seek(frame / fps);

  return { state: stateRef.current, frame };
}

/* ─── Phone Mockup ─── */
const PhoneMockup: React.FC<{
  children: React.ReactNode;
  tilt?: number;
  xTilt?: number;
  scale?: number;
  shadowOpacity?: number;
}> = ({ children, tilt = -3, xTilt = 3, scale = 1, shadowOpacity = 0.15 }) => {
  const shadowShiftX = -(tilt ?? -3) * 3;
  const shadowShiftY = 28 + Math.abs(tilt ?? 0) * 0.5;
  /* Bezel edge thickness visible when tilted — proportional to tilt angle */
  const edgeWidth = Math.max(0, Math.abs(tilt) * 0.6);
  const edgeSide = tilt < 0 ? "left" : "right";
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate(-50%, -50%) scale(${scale}) perspective(900px) rotateY(${tilt}deg) rotateX(${xTilt}deg)`,
        width: 280,
        height: 580,
        borderRadius: 40,
        background: "linear-gradient(145deg, #2A2A30, #1A1A1E, #35353A)",
        padding: 4,
        boxShadow: `${shadowShiftX}px ${shadowShiftY}px 70px rgba(0,0,0,${shadowOpacity * 1.2}), ${shadowShiftX * 0.5}px ${shadowShiftY * 0.5}px 30px rgba(0,0,0,${shadowOpacity * 0.6}), 0 4px 8px rgba(0,0,0,${shadowOpacity * 0.3})`,
      }}
    >
      {/* Visible edge depth when tilted */}
      {edgeWidth > 1 && (
        <div style={{
          position: "absolute",
          top: 8,
          bottom: 8,
          [edgeSide]: -edgeWidth,
          width: edgeWidth,
          borderRadius: edgeSide === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
          background: "linear-gradient(180deg, #3A3A40, #28282E, #3A3A40)",
          transform: `translateZ(-${edgeWidth * 0.5}px)`,
        }} />
      )}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 36,
          background: PHONE_BG,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 36,
            background: PHONE_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: GREY_TEXT,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 80,
              height: 22,
              borderRadius: 12,
              background: "#1A1A1A",
            }}
          />
          <div style={{ position: "absolute", left: 16, top: 10, fontSize: 10, fontWeight: 600 }}>9:41</div>
        </div>
        <div style={{ overflow: "hidden", height: 536 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ─── Chat UI ─── */
const ChatUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const typingProgress = interpolate(frame, [10, 70], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const fullText = "Create a cute social caption for Baxter";
  const visibleChars = Math.floor(typingProgress * fullText.length);
  const typedText = fullText.slice(0, visibleChars);
  const showCursor = frame % 16 < 10 && frame < 75;

  const iconSpring = spring({ frame: frame - 2, fps, config: { damping: 8, stiffness: 120, mass: 0.5 } });
  const iconY = interpolate(iconSpring, [0, 1], [24, 0]);
  const iconScale = interpolate(iconSpring, [0, 1], [0.85, 1]);
  const photoSpring = spring({ frame: frame - 6, fps, config: { damping: 9, stiffness: 100, mass: 0.6 } });
  const photoY = interpolate(photoSpring, [0, 1], [20, 0]);
  const photoScale = interpolate(photoSpring, [0, 1], [0.9, 1]);
  const bubbleSpring = spring({ frame: frame - 10, fps, config: { damping: 7, stiffness: 110, mass: 0.5 } });
  const bubbleY = interpolate(bubbleSpring, [0, 1], [30, 0]);
  const bubbleScale = interpolate(bubbleSpring, [0, 1], [0.92, 1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, color: DARK_TEXT, fontWeight: 500 }}>Good morning</div>
        <div style={{ fontSize: 14, color: GREY_TEXT, opacity: 0.4 }}>{String.fromCodePoint(0x2197)}</div>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
        <div style={{ display: "flex", gap: 6, opacity: iconSpring, transform: `translateY(${iconY}px) scale(${iconScale})` }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#E8E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{MAIL}</div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FFF3E0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{MEMO}</div>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FFE0E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 16, height: 12, borderRadius: 3, background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderLeft: "5px solid #fff", borderTop: "3px solid transparent", borderBottom: "3px solid transparent" }} />
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 18, borderRadius: "50% 50% 50% 0", background: "#34A853", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fff" }} />
            </div>
          </div>
        </div>
        <div style={{ alignSelf: "flex-start", opacity: photoSpring, transform: `translateY(${photoY}px) scale(${photoScale})` }}>
          <div style={{
            width: 100, height: 80, borderRadius: 12,
            background: "linear-gradient(135deg, #A8D5A2 0%, #7CB87C 40%, #D4A574 60%, #C4956A 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontSize: 36, filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.2))" }}>{DOG_FULL}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 20, background: "linear-gradient(to top, rgba(139,195,74,0.4), transparent)" }} />
          </div>
        </div>
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", opacity: bubbleSpring, transform: `translateY(${bubbleY}px) scale(${bubbleScale})`, transformOrigin: "bottom left" }}>
          <div style={{ background: USER_BUBBLE, borderRadius: 20, padding: "12px 16px", fontSize: 13.5, color: DARK_TEXT, lineHeight: 1.45 }}>
            {typedText}
            {showCursor && <span style={{ color: BLUE, fontWeight: 300 }}>|</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: "6px 14px 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: GREY_TEXT }}>{MIC}</div>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: GREY_TEXT }}>{CAMERA}</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 32, height: 32, borderRadius: 16, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", transform: "rotate(-30deg)" }}>{PLAY}</div>
      </div>
      <div style={{ background: KB_BG, padding: "4px 3px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        {["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 2 }}>
            {row.split("").map((letter, li) => (
              <div key={li} style={{ width: ri === 2 ? 22 : 20, height: 24, borderRadius: 4, background: KB_KEY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: KB_KEY_TEXT, boxShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>
                {letter}
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 1 }}>
          <div style={{ width: 44, height: 22, borderRadius: 4, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: KB_KEY_TEXT }}>123</div>
          <div style={{ flex: 1, maxWidth: 120, height: 22, borderRadius: 4, background: KB_KEY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#AAA" }}>space</div>
          <div style={{ width: 44, height: 22, borderRadius: 4, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff" }}>return</div>
        </div>
      </div>
    </div>
  );
};

/* ─── AI Response UI ─── */
const AIResponseUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const responseText = "Baxter is the hilltop king! " + CROWN + " Look who's on top of the world! #doglover #majestic #hikingdog";
  const words = responseText.split(/(\s+)/);
  const totalWords = words.filter(w => w.trim().length > 0).length;
  const wordProgress = interpolate(frame, [5, 45], [0, totalWords], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let wordCount = 0;
  let visible = "";
  for (const w of words) {
    if (w.trim().length > 0) {
      wordCount++;
      if (wordCount > wordProgress) break;
    }
    visible += w;
  }
  const responseBubbleSpring = spring({ frame, fps, config: { damping: 7, stiffness: 100, mass: 0.6 } });
  const responseBubbleY = interpolate(responseBubbleSpring, [0, 1], [28, 0]);
  const responseBubbleScale = interpolate(responseBubbleSpring, [0, 1], [0.9, 1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 16, color: GREY_TEXT }}>{ARROW_LEFT}</div>
        <div style={{ fontSize: 14, color: DARK_TEXT, fontWeight: 500, flex: 1 }}>{"Baxter's Great Adventure"}</div>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: USER_BUBBLE, borderRadius: 18, padding: "10px 14px", fontSize: 12, color: GREY_TEXT, alignSelf: "flex-start", maxWidth: "80%" }}>
          Create a cute social caption for Baxter
        </div>
        <div style={{
          width: "100%", height: 150, borderRadius: 16,
          background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 25%, #8FBC8F 40%, #D4A574 55%, #C4956A 70%, #87CEEB 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ fontSize: 60, filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))" }}>{DOG_FULL}</div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(to bottom, rgba(135,206,235,0.5), transparent)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to top, rgba(107,175,107,0.5), transparent)" }} />
        </div>
        <div style={{
          background: AI_BUBBLE, borderRadius: 18, padding: "12px 16px",
          fontSize: 13.5, color: DARK_TEXT, lineHeight: 1.5,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          opacity: responseBubbleSpring,
          transform: `translateY(${responseBubbleY}px) scale(${responseBubbleScale})`,
          transformOrigin: "top left",
        }}>
          {visible.split(/(#\w+)/g).map((part, i) =>
            part.startsWith("#") ? (
              <span key={i} style={{ color: BLUE }}>{part}</span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      </div>
      <div style={{ padding: "6px 14px 6px", display: "flex", gap: 18, alignItems: "center", opacity: interpolate(frame, [40, 50], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "linear-gradient(135deg, #4285F4, #34A853, #FBBC04, #EA4335)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#fff" }} />
        </div>
        <div style={{ fontSize: 14, color: GREY_TEXT, opacity: 0.5 }}>{String.fromCodePoint(0x1f44d)}</div>
        <div style={{ fontSize: 14, color: GREY_TEXT, opacity: 0.5 }}>{String.fromCodePoint(0x1f44e)}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: GREY_TEXT, opacity: 0.4 }}>{String.fromCodePoint(0x2026)}</div>
      </div>
      <div style={{ padding: "6px 14px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: GREY_TEXT, borderTop: "1px solid #F0F0F0" }}>
        <span>{CLIP}</span>
        <span style={{ flex: 1, opacity: 0.5 }}>Ask, or share a photo...</span>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{MIC}</div>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{CAMERA}</div>
      </div>
    </div>
  );
};

/* ─── Browser Frame ─── */
const BrowserFrame: React.FC<{
  children: React.ReactNode;
  scale?: number;
  x?: number;
  y?: number;
  glowProgress?: number;
}> = ({ children, scale = 1, x = 0, y = 0, glowProgress = 0 }) => {
  const glowOpacity = 0.3 + glowProgress * 0.15;
  return (
    <div style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
      width: 480,
      height: 520,
      borderRadius: 16,
      background: PHONE_BG,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
      border: "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, #E91E63, #E040FB, #7C4DFF, #E91E63)",
        backgroundSize: "200% 100%",
        backgroundPosition: `${glowProgress * 100}% 0`,
        opacity: glowOpacity,
        zIndex: 10,
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 40,
        background: `linear-gradient(to bottom, rgba(233,30,99,${glowOpacity * 0.15}), transparent)`,
        zIndex: 5,
      }} />
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {children}
      </div>
    </div>
  );
};

/* ─── Gemini Dropdown UI ─── */
const GeminiDropdownUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const dropdownOpen = spring({ frame: frame - 10, fps, config: { damping: 6, stiffness: 90, mass: 0.8 } });
  const elementsDelay = spring({ frame: frame - 18, fps, config: { damping: 8, stiffness: 70, mass: 0.7 } });
  const row1Spring = spring({ frame: frame - 14, fps, config: { damping: 7, stiffness: 100, mass: 0.5 } });
  const row2Spring = spring({ frame: frame - 20, fps, config: { damping: 7, stiffness: 100, mass: 0.5 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: "system-ui, sans-serif", position: "relative" }}>
      <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 22, color: GREY_TEXT, letterSpacing: 2 }}>{HAMBURGER}</div>
        <div style={{ fontSize: 22, color: DARK_TEXT, fontWeight: 500, letterSpacing: -0.3 }}>
          {"Gemini "}
          <span style={{ fontSize: 14, color: GREY_TEXT }}>{ARROW_DOWN}</span>
        </div>
      </div>
      <div style={{
        margin: "0 24px", background: "#F8F9FA", borderRadius: 16,
        padding: `${interpolate(dropdownOpen, [0, 1], [0, 14])}px 18px`,
        maxHeight: interpolate(dropdownOpen, [0, 1], [0, 140]),
        overflow: "hidden", opacity: dropdownOpen,
        transform: `scaleY(${interpolate(dropdownOpen, [0, 1], [0.6, 1])})`,
        transformOrigin: "top",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
          opacity: row1Spring,
          transform: `translateX(${interpolate(row1Spring, [0, 1], [-12, 0])}px)`,
        }}>
          <div style={{ fontSize: 20, color: BLUE }}>{SPARKLE}</div>
          <div style={{ fontSize: 17, color: DARK_TEXT, fontWeight: 500, flex: 1 }}>Gemini</div>
          <div style={{ width: 24, height: 24, borderRadius: 12, border: "1.5px solid #9AA0A6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9AA0A6" }}>{CHECKMARK}</div>
        </div>
        <div style={{ height: 1, background: "#E8E8E8", margin: "2px 0" }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
          opacity: row2Spring,
          transform: `translateX(${interpolate(row2Spring, [0, 1], [-12, 0])}px)`,
        }}>
          <div style={{ fontSize: 20, background: "linear-gradient(135deg, #E040FB, #7C4DFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{SPARKLE}</div>
          <div style={{ fontSize: 17, color: DARK_TEXT, fontWeight: 500, flex: 1, whiteSpace: "nowrap" }}>Gemini Advanced</div>
          <div style={{ background: DARK_TEXT, color: "#fff", fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 5, whiteSpace: "nowrap" }}>Upgrade</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 80, left: 28, width: 52, height: 52, borderRadius: 26, background: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: GREY_TEXT, opacity: elementsDelay, transform: `translateY(${interpolate(elementsDelay, [0, 1], [10, 0])}px)`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>+</div>
      <div style={{ position: "absolute", bottom: 20, left: 24, right: 24, background: "#F0F0F4", borderRadius: 28, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, opacity: interpolate(elementsDelay, [0, 1], [0, 0.8]), transform: `translateY(${interpolate(elementsDelay, [0, 1], [8, 0])}px)` }}>
        <div style={{ fontSize: 17, color: BLUE }}>{SPARKLE}</div>
        <div style={{ fontSize: 15, color: "#9AA0A6", flex: 1 }}>Gemini</div>
      </div>
    </div>
  );
};

/* ─── Floating Emoji ─── */
const FloatingEmoji: React.FC<{
  emoji: string; endX: number; endY: number; size: number;
  seed: number; frame: number; fps: number; startFrame: number;
  arcHeight: number;
}> = ({ emoji, endX, endY, size, seed, frame, fps, startFrame, arcHeight }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const pathT = interpolate(localFrame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const controlX = endX * 0.3 + (seed % 2 === 0 ? -1 : 1) * arcHeight * 0.4;
  const controlY = endY * 0.3 - arcHeight;
  const currentX = quadBezier(pathT, 0, controlX, endX);
  const currentY = quadBezier(pathT, 0, controlY, endY);

  const scaleSpring = spring({ frame: localFrame, fps, config: { damping: 6, stiffness: 120, mass: 0.4 } });
  const floatScale = 1 + Math.sin(localFrame * 0.08 + seed) * 0.06;
  const currentScale = scaleSpring * floatScale;

  const launchSpin = interpolate(pathT, [0, 1], [0, (seed % 2 === 0 ? 1 : -1) * (15 + seed * 3)], { extrapolateRight: "clamp" });
  const wobble = Math.sin(localFrame * 0.1 + seed * 2) * 4;
  const rotation = pathT < 0.95 ? launchSpin : wobble;

  const settled = pathT >= 0.99;
  const noiseX = settled ? noise2D("emojiX" + seed, localFrame * 0.02, seed) * 8 : 0;
  const noiseY = settled ? noise2D("emojiY" + seed, localFrame * 0.015, seed) * 5 : 0;

  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: `translate(${currentX + noiseX}px, ${currentY + noiseY}px) scale(${currentScale}) rotate(${rotation}deg)`,
      fontSize: size, opacity: Math.min(scaleSpring * 1.5, 1),
      filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))",
      pointerEvents: "none",
    }}>
      {emoji}
    </div>
  );
};

/* ═══ Main Scene — GSAP state-driven orchestration ═══ */
export const Scene04: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const { state: s } = useGsapAnimState(fps);

  /* ── Phase visibility ── */
  const showChat = frame < PHASE.PHOTO_EXPAND.start;
  const showPhotoExpand = frame >= PHASE.PHOTO_EXPAND.start && frame < PHASE.AI_RESPONSE.start;
  const showAIResponse = frame >= PHASE.AI_RESPONSE.start && frame < PHASE.GEMINI_UI.start;
  const showGeminiUI = frame >= PHASE.GEMINI_UI.start;
  const showEmojis = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.TRANSITION_TEXT.start;
  const showButText = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.INTRODUCING.start + 15;
  const showIntro = frame >= PHASE.INTRODUCING.start && frame < PHASE.GEMINI_UI.start + 5;

  /* Photo expand progress */
  const photoExpandProgress = interpolate(frame, [PHASE.PHOTO_EXPAND.start, PHASE.PHOTO_EXPAND.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* Phone tilt — reference shows strong Y rotation (~18deg) that gradually reduces */
  const phoneTilt = interpolate(frame,
    [0, 30, PHASE.PHOTO_EXPAND.start, PHASE.AI_RESPONSE.start, PHASE.EMOJI_BURST.start],
    [-18, -14, -10, -6, -4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  /* Phone X rotation — subtle forward lean that reduces over time */
  const phoneXTilt = interpolate(frame,
    [0, PHASE.AI_RESPONSE.start],
    [5, 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* Noise-based background */
  const bgX1 = 40 + noise2D("bgX", frame * 0.005, 0) * 12;
  const bgY1 = 40 + noise2D("bgY", frame * 0.005, 1) * 10;
  const bgX2 = 70 + noise2D("bg2X", frame * 0.004, 2) * 8;
  const bgY2 = 60 + noise2D("bg2Y", frame * 0.004, 3) * 6;

  /* Gemini glow cycling */
  const geminiLocalFrame = Math.max(0, frame - PHASE.GEMINI_UI.start);
  const glowCycle = showGeminiUI ? (geminiLocalFrame % 120) / 120 : 0;

  /* Introducing glow effects */
  const introLocal = frame - PHASE.INTRODUCING.start;
  const glowBreath = 0.4 + Math.sin(Math.max(0, introLocal) * 0.18) * 0.15;
  const glowBreath2 = 0.25 + Math.sin(Math.max(0, introLocal) * 0.14 + 1.5) * 0.1;
  const glowX = interpolate(s.introClipRight, [0, 100], [0, -280]);
  const sweepEdgeX = interpolate(s.introClipRight, [0, 100], [320, -320]);
  const introWobX = noise2D("intx", frame * 0.02, 0) * 3;
  const introWobY = noise2D("inty", 0, frame * 0.02) * 2;

  /* Gemini noise wobble */
  const gemWobX = noise2D("gmwx", frame * 0.015, 0) * 3;
  const gemWobY = noise2D("gmwy", 0, frame * 0.015) * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{
        position: "absolute", inset: 0,
        transform: `scale(${s.darkShrink})`,
        transformOrigin: "center center",
        background: BG,
      }}>
        {/* Animated background gradients */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at ${bgX1}% ${bgY1}%, rgba(200,210,240,0.22) 0%, transparent 60%)`,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at ${bgX2}% ${bgY2}%, rgba(220,200,230,0.08) 0%, transparent 50%)`,
        }} />

        {/* Disclaimer */}
        {frame >= 40 && frame < PHASE.TRANSITION_TEXT.start && (
          <div style={{
            position: "absolute", bottom: 16, left: 20,
            fontSize: 9, color: "rgba(0,0,0,0.3)",
            fontFamily: "system-ui, sans-serif",
            opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}>
            Sequences shortened and simulated.
          </div>
        )}

        {/* Phone + emojis — GSAP drives position/opacity/scale/rotation */}
        {frame < PHASE.GEMINI_UI.start && (() => {
          const phoneIsExiting = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.TRANSITION_TEXT.start + 12;
          const emojiBursting = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.EMOJI_BURST.start + 12;
          const needsBlur = phoneIsExiting || emojiBursting;
          const content = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.phoneOpacity,
              transform: `translate(${s.phoneX}px, ${s.phoneY}px) rotate(${s.phoneRotation}deg)`,
            }}>
              <PhoneMockup tilt={phoneTilt} xTilt={phoneXTilt} scale={s.phoneScale} shadowOpacity={0.18}>
                {showChat && <ChatUI frame={frame} fps={fps} />}
                {showPhotoExpand && (
                  <div style={{
                    width: "100%", height: "100%",
                    background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 25%, #8FBC8F 40%, #D4A574 55%, #C4956A 70%, #87CEEB 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: interpolate(photoExpandProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
                  }}>
                    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, transparent 20%, rgba(0,0,0,0.08) 80%)" }} />
                    <div style={{
                      fontSize: interpolate(photoExpandProgress, [0, 1], [60, 110]),
                      filter: "drop-shadow(3px 3px 8px rgba(0,0,0,0.25))",
                      transform: `scale(${interpolate(photoExpandProgress, [0.5, 1], [1, 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
                    }}>{DOG_FULL}</div>
                  </div>
                )}
                {showAIResponse && <AIResponseUI frame={frame - PHASE.AI_RESPONSE.start} fps={fps} />}
              </PhoneMockup>
              {showEmojis && FLOATING_EMOJIS.map((item, i) => (
                <FloatingEmoji
                  key={i}
                  emoji={item.emoji}
                  endX={item.endX}
                  endY={item.endY}
                  size={item.size}
                  seed={item.seed}
                  frame={frame}
                  fps={fps}
                  startFrame={PHASE.EMOJI_BURST.start + i * 2}
                  arcHeight={item.arcHeight}
                />
              ))}
            </div>
          );
          return needsBlur ? (
            <CameraMotionBlur samples={6} shutterAngle={120}>{content}</CameraMotionBlur>
          ) : content;
        })()}

        {/* "But that's not all..." — GSAP drives word stagger + dot pops */}
        {showButText && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: s.butTextOpacity,
          }}>
            <div style={{
              fontSize: 42,
              fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif",
              fontWeight: 400, color: DARK_TEXT, letterSpacing: -0.5,
              display: "flex", alignItems: "baseline", gap: 10,
            }}>
              {["But", "that\u2019s", "not"].map((word, wi) => (
                <span key={wi} style={{
                  display: "inline-block",
                  opacity: s.wordOpacities[wi],
                  transform: `translate(${s.wordXs[wi]}px, ${s.wordYs[wi]}px)`,
                }}>{word}</span>
              ))}
              <span style={{
                display: "inline-block",
                color: BLUE,
                opacity: s.allOpacity,
                transform: `translate(${s.allX}px, ${s.allY}px)`,
              }}>all</span>
              <span style={{ display: "inline-flex", gap: 2, marginLeft: -2, alignItems: "baseline" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    color: i === 0 ? "#5C6BC0" : i === 1 ? "#7B1FA2" : "#AD1457",
                    fontSize: 42, fontWeight: 700,
                    display: "inline-block",
                    transformOrigin: "center bottom",
                    opacity: s.dotOpacities[i],
                    transform: `scale(${s.dotScales[i]})`,
                  }}>.</span>
                ))}
              </span>
            </div>
          </div>
        )}

        {/* "Introducing" — GSAP drives opacity, scale, clip-path sweep */}
        {showIntro && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: s.introOpacity,
            transform: `scale(${s.introScale}) translate(${introWobX}px, ${introWobY}px)`,
          }}>
            {/* Main glow */}
            <div style={{
              position: "absolute", width: 600, height: 240,
              transform: `translateX(${glowX * 0.6}px)`,
              background: `radial-gradient(ellipse at 50% 50%, rgba(220,140,200,${glowBreath * 1.2}) 0%, rgba(200,120,220,${glowBreath * 0.6}) 30%, rgba(180,100,240,${glowBreath * 0.3}) 55%, transparent 75%)`,
              filter: "blur(50px)",
            }} />
            <div style={{
              position: "absolute", width: 800, height: 200,
              background: `radial-gradient(ellipse, rgba(210,140,210,${glowBreath2 * 1.3}) 0%, rgba(190,120,220,${glowBreath2 * 0.5}) 35%, transparent 65%)`,
              filter: "blur(50px)",
              opacity: 0.7 + Math.sin(Math.max(0, introLocal) * 0.1) * 0.15,
            }} />
            {s.introClipRight > 2 && (
              <div style={{
                position: "absolute", width: 140, height: 120,
                transform: `translateX(${sweepEdgeX}px)`,
                background: "radial-gradient(ellipse, rgba(210,150,240,0.55) 0%, rgba(180,100,220,0.25) 40%, transparent 70%)",
                filter: "blur(28px)",
              }} />
            )}
            <div style={{ position: "relative" }}>
              <div style={{
                fontSize: 96,
                fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif",
                fontWeight: 300, letterSpacing: -1, textAlign: "center", whiteSpace: "nowrap",
                color: DARK_TEXT, opacity: 0.85,
              }}>Introducing</div>
              <div style={{
                fontSize: 96,
                fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif",
                fontWeight: 300, letterSpacing: -1, textAlign: "center", whiteSpace: "nowrap",
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, #D93025 0%, #E040A0 18%, #B040C0 36%, #8060E0 54%, #5080E8 72%, #4285F4 88%, #3B78E7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                clipPath: `inset(0 ${s.introClipRight}% 0 0)`,
              }}>Introducing</div>
            </div>
          </div>
        )}

        {/* Gemini UI — GSAP drives entry spring + zoom/pan */}
        {showGeminiUI && (() => {
          const geminiContent = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.geminiOpacity,
              transform: `translateY(${s.geminiY}px) translate(${gemWobX}px, ${gemWobY}px)`,
            }}>
              <BrowserFrame scale={s.geminiScale} x={s.geminiPanX} y={s.geminiPanY} glowProgress={glowCycle}>
                <GeminiDropdownUI frame={geminiLocalFrame} fps={fps} />
              </BrowserFrame>
            </div>
          );
          /* Motion blur during initial spring entry */
          if (geminiLocalFrame > 0 && geminiLocalFrame < 10) {
            return (
              <CameraMotionBlur samples={5} shutterAngle={90}>
                {geminiContent}
              </CameraMotionBlur>
            );
          }
          return geminiContent;
        })()}

        {/* Dark overlay */}
        {s.fadeToBlack > 0 && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: s.fadeToBlack }} />
        )}
      </div>
    </AbsoluteFill>
  );
};

export const scene04Meta = {
  id: "OFScene04",
  component: Scene04,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 339,
};
