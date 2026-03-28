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
  DOG_PHOTO: { start: 0, end: 15 },       /* Full-screen dog photo on phone */
  CHAT_IN: { start: 15, end: 80 },          /* Hard cut to "Good morning" chat */
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
const HEART_EYES = String.fromCodePoint(0x1f60d);
const DOG_FACE = String.fromCodePoint(0x1f436);
const DOG_FULL = String.fromCodePoint(0x1f415);
const RED_HEART = String.fromCodePoint(0x2764, 0xfe0f);
const CROWN = String.fromCodePoint(0x1f451);
const PARTY = String.fromCodePoint(0x1f973);
const MAIL = String.fromCodePoint(0x1f4e7);
const MEMO = String.fromCodePoint(0x1f4dd);
const MIC = String.fromCodePoint(0x1f3a4);
const CAMERA = String.fromCodePoint(0x1f4f7);
const CLIP = String.fromCodePoint(0x1f4ce);
const ARROW_LEFT = String.fromCodePoint(0x2190);
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
  /* Gemini desktop browser */
  geminiOpacity: number;
  geminiY: number;
  geminiScale: number;
  geminiPanX: number;
  geminiPanY: number;
  geminiDropdownOpen: number;
  geminiRow1: number;
  geminiRow2: number;
  geminiCheckmark: number;
  geminiGlowAngle: number;
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
    /* Phone starts centered and still — matching Scene03's resting phone.
       Hard cut: screen content changes, phone frame stays put. */
    phoneX: 0, phoneY: 0, phoneRotation: 0, phoneOpacity: 1, phoneScale: 0.82,
    butTextOpacity: 0,
    introOpacity: 0, introScale: 0.88, introClipRight: 100,
    geminiOpacity: 0, geminiY: 300, geminiScale: 1.0, geminiPanX: 0, geminiPanY: 0,
    geminiDropdownOpen: 0, geminiRow1: 0, geminiRow2: 0, geminiCheckmark: 0, geminiGlowAngle: 0,
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

    /* ═══ Phase 1: Phone already centered (hard cut from Scene03).
       No entrance arc — just gentle scale breathing. ═══ */

    /* Phone scale — breathing from 0.82 up, then zoom during photo expand */
    t.to(s, { phoneScale: 0.88, duration: sec(40), ease: "sine.inOut" }, 0);
    t.to(s, { phoneScale: 1.02, duration: sec(30), ease: "sine.inOut" }, sec(40));
    /* Camera push during photo expand — zoom in */
    t.to(s, { phoneScale: 1.25, duration: sec(30), ease: "power2.out" }, sec(PHASE.PHOTO_EXPAND.start));
    /* Pull back for AI response */
    t.to(s, { phoneScale: 0.98, duration: sec(30), ease: "power2.inOut" }, sec(PHASE.AI_RESPONSE.start));
    /* Emoji burst: slight shrink from energy release */
    t.to(s, { phoneScale: 0.90, duration: sec(20), ease: "power1.out" }, sec(PHASE.EMOJI_BURST.start));

    /* ═══ Phone exit — dramatic arc left, turns edge-on ═══ */
    const exitStart = sec(PHASE.TRANSITION_TEXT.start);
    const phoneExitTween = gsap.to({ t: 0 }, {
      t: 1, duration: sec(16), ease: "power3.in", paused: true,
      onUpdate() {
        const p = this.progress();
        /* Start from drift position and fly far left */
        s.phoneX = quadBezier(p, 20, -280, -850);
        s.phoneY = quadBezier(p, 0, -50, 20);
      },
    });
    t.add(phoneExitTween, exitStart);
    t.to(s, { phoneRotation: -18, duration: sec(16), ease: "power3.in" }, exitStart);
    t.to(s, { phoneOpacity: 0, duration: sec(10), ease: "power2.in" }, exitStart + sec(4));

    /* ═══ "But that's not all..." ═══ */
    const textStart = sec(PHASE.TRANSITION_TEXT.start);
    t.to(s, { butTextOpacity: 1, duration: sec(12), ease: "power2.out" }, textStart);

    const wordBase = sec(PHASE.TRANSITION_TEXT.start + 8);
    for (let i = 0; i < 3; i++) {
      const wStart = wordBase + sec(5) * i;
      t.to(s.wordOpacities, { [i]: 1, duration: sec(5), ease: "power2.out" }, wStart);
      t.to(s.wordYs, { [i]: 0, duration: sec(8), ease: "expo.out" }, wStart);
      t.to(s.wordXs, { [i]: 0, duration: sec(8), ease: "expo.out" }, wStart);
    }

    const allStart = wordBase + sec(15);
    t.to(s, { allOpacity: 1, duration: sec(5), ease: "power2.out" }, allStart);
    t.to(s, { allY: 0, allX: 0, duration: sec(8), ease: "expo.out" }, allStart);

    const dotBase = wordBase + sec(23);
    for (let i = 0; i < 3; i++) {
      const dStart = dotBase + sec(5) * i;
      t.to(s.dotScales, { [i]: 1, duration: sec(10), ease: "back.out(4)" }, dStart);
      t.to(s.dotOpacities, { [i]: 1, duration: sec(6), ease: "power2.out" }, dStart);
    }

    t.to(s, { butTextOpacity: 0, duration: sec(8), ease: "power2.in" }, sec(PHASE.INTRODUCING.start - 8));

    /* ═══ "Introducing" ═══ */
    t.to(s, { introOpacity: 1, duration: sec(6), ease: "power2.out" }, sec(PHASE.INTRODUCING.start));
    t.to(s, { introScale: 1.0, duration: sec(20), ease: "elastic.out(1, 0.6)" }, sec(PHASE.INTRODUCING.start));
    t.to(s, { introClipRight: 0, duration: sec(21), ease: "expo.out" }, sec(PHASE.INTRODUCING.start));
    /* Intro fades out fully BEFORE Gemini appears — no overlap */
    t.to(s, { introOpacity: 0, duration: sec(8), ease: "power2.in" }, sec(PHASE.INTRODUCING.start + 30));

    /* ═══ Gemini Desktop Browser UI ═══ */
    const gemStart = sec(PHASE.GEMINI_UI.start);
    t.to(s, { geminiOpacity: 1, duration: sec(8), ease: "power2.out" }, gemStart);
    t.to(s, { geminiY: 0, duration: sec(18), ease: "expo.out" }, gemStart);
    /* Start at full view, then zoom toward top-left corner for dropdown focus */
    t.to(s, { geminiScale: 1.9, duration: sec(46), ease: "power1.inOut" }, gemStart);
    t.to(s, { geminiPanX: -200, duration: sec(46), ease: "power1.inOut" }, gemStart);
    t.to(s, { geminiPanY: 180, duration: sec(46), ease: "power1.inOut" }, gemStart);
    /* Dropdown animation */
    t.to(s, { geminiDropdownOpen: 1, duration: sec(12), ease: "back.out(1.5)" }, sec(PHASE.GEMINI_UI.start + 8));
    t.to(s, { geminiRow1: 1, duration: sec(8), ease: "power2.out" }, sec(PHASE.GEMINI_UI.start + 12));
    t.to(s, { geminiRow2: 1, duration: sec(8), ease: "power2.out" }, sec(PHASE.GEMINI_UI.start + 18));
    t.to(s, { geminiCheckmark: 1, duration: sec(6), ease: "back.out(2)" }, sec(PHASE.GEMINI_UI.start + 16));
    /* Glow rotation */
    t.to(s, { geminiGlowAngle: 360, duration: sec(46), ease: "none" }, gemStart);

    /* ═══ Dark ending ═══ */
    t.to(s, { fadeToBlack: 0.97, duration: sec(13), ease: "power3.in" }, sec(326));
    t.to(s, { darkShrink: 0.88, duration: sec(13), ease: "power3.in" }, sec(326));

    tlRef.current = t;
  }

  tlRef.current!.seek(frame / fps);
  return { state: stateRef.current, frame };
}

/* ═══════════════════════════════════════════════════════
   DOG PHOTO SCREEN — Full-screen realistic dog photo
   painted with CSS. Reference: small grey/tan Yorkie
   puppy standing on sandy ground, green blurred bg.
   ═══════════════════════════════════════════════════════ */
const DogPhotoScreen: React.FC = () => {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: "linear-gradient(170deg, #a8c8a0 0%, #8db88a 20%, #c9b896 50%, #d4c4a0 65%, #bca87a 80%, #a09060 100%)",
    }}>
      {/* Sky / blurred background upper portion */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "45%",
        background: "linear-gradient(180deg, #c8dcc4 0%, #a8c8a0 40%, #90b888 100%)",
        filter: "blur(4px)",
      }} />
      {/* Ground / sandy surface */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
        background: "linear-gradient(180deg, #c8b890 0%, #d0c098 30%, #b8a070 60%, #a89060 100%)",
      }} />
      {/* Ground texture — scattered patches */}
      <div style={{
        position: "absolute", bottom: "10%", left: "20%", width: 60, height: 20,
        background: "rgba(160,140,100,0.4)", borderRadius: "50%", filter: "blur(3px)",
      }} />
      <div style={{
        position: "absolute", bottom: "25%", right: "15%", width: 40, height: 14,
        background: "rgba(140,120,80,0.3)", borderRadius: "50%", filter: "blur(2px)",
      }} />

      {/* Dog body — center of frame */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -45%)",
        width: 120, height: 140,
      }}>
        {/* Body */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -30%)",
          width: 80, height: 60,
          background: "linear-gradient(135deg, #b0a090 0%, #c8b8a0 30%, #a89878 60%, #988868 100%)",
          borderRadius: "45% 45% 40% 40%",
        }} />
        {/* Chest / lighter underside */}
        <div style={{
          position: "absolute", left: "50%", top: "58%",
          transform: "translate(-50%, -30%)",
          width: 50, height: 30,
          background: "linear-gradient(180deg, #d8c8b0, #c8b8a0)",
          borderRadius: "40%",
        }} />
        {/* Head */}
        <div style={{
          position: "absolute", left: "50%", top: "18%",
          transform: "translate(-50%, 0)",
          width: 55, height: 48,
          background: "linear-gradient(150deg, #a89070 0%, #c0a888 40%, #b09878 100%)",
          borderRadius: "50% 50% 45% 45%",
        }} />
        {/* Snout */}
        <div style={{
          position: "absolute", left: "50%", top: "40%",
          transform: "translate(-50%, 0)",
          width: 28, height: 18,
          background: "linear-gradient(180deg, #b8a080, #a89070)",
          borderRadius: "40% 40% 50% 50%",
        }} />
        {/* Nose */}
        <div style={{
          position: "absolute", left: "50%", top: "44%",
          transform: "translate(-50%, 0)",
          width: 10, height: 7,
          background: "#3a3028",
          borderRadius: "50%",
        }} />
        {/* Eyes */}
        <div style={{
          position: "absolute", left: "38%", top: "26%",
          width: 8, height: 8,
          background: "radial-gradient(circle at 40% 40%, #6a5040, #2a2018)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", left: "55%", top: "26%",
          width: 8, height: 8,
          background: "radial-gradient(circle at 40% 40%, #6a5040, #2a2018)",
          borderRadius: "50%",
        }} />
        {/* Eye glints */}
        <div style={{
          position: "absolute", left: "40%", top: "27%",
          width: 3, height: 3, background: "#fff",
          borderRadius: "50%", opacity: 0.8,
        }} />
        <div style={{
          position: "absolute", left: "57%", top: "27%",
          width: 3, height: 3, background: "#fff",
          borderRadius: "50%", opacity: 0.8,
        }} />
        {/* Left ear */}
        <div style={{
          position: "absolute", left: "22%", top: "8%",
          width: 22, height: 28,
          background: "linear-gradient(160deg, #908070, #a89078)",
          borderRadius: "50% 50% 20% 40%",
          transform: "rotate(-15deg)",
        }} />
        {/* Right ear */}
        <div style={{
          position: "absolute", right: "22%", top: "8%",
          width: 22, height: 28,
          background: "linear-gradient(200deg, #908070, #a89078)",
          borderRadius: "50% 50% 40% 20%",
          transform: "rotate(15deg)",
        }} />
        {/* Front legs */}
        <div style={{
          position: "absolute", left: "32%", bottom: "0%",
          width: 16, height: 40,
          background: "linear-gradient(180deg, #b0a090, #a89070)",
          borderRadius: "6px 6px 8px 8px",
        }} />
        <div style={{
          position: "absolute", right: "32%", bottom: "0%",
          width: 16, height: 40,
          background: "linear-gradient(180deg, #a89878, #988868)",
          borderRadius: "6px 6px 8px 8px",
        }} />
        {/* Tail — upward sweep */}
        <div style={{
          position: "absolute", right: "8%", top: "20%",
          width: 12, height: 40,
          background: "linear-gradient(180deg, #b8a888, #a89070)",
          borderRadius: "50%",
          transform: "rotate(-30deg)",
          transformOrigin: "bottom center",
        }} />
      </div>

      {/* Photo badge — small blue "Photos" pill at bottom */}
      <div style={{
        position: "absolute", bottom: 30, left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(66,133,244,0.85)",
        borderRadius: 14, padding: "4px 12px",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="#fff"/>
        </svg>
        <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>Photos</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PHONE MOCKUP
   ═══════════════════════════════════════════════════════ */
const PhoneMockup: React.FC<{
  children: React.ReactNode;
  tilt?: number;
  xTilt?: number;
  scale?: number;
  shadowOpacity?: number;
}> = ({ children, tilt = -3, xTilt = 3, scale = 1, shadowOpacity = 0.15 }) => {
  const shadowShiftX = -(tilt ?? -3) * 3;
  const shadowShiftY = 28 + Math.abs(tilt ?? 0) * 0.5;
  const edgeWidth = Math.max(0, Math.abs(tilt) * 0.6);
  const edgeSide = tilt < 0 ? "left" : "right";
  return (
    <div
      style={{
        position: "absolute",
        left: "50%", top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate(-50%, -50%) scale(${scale}) perspective(900px) rotateY(${tilt}deg) rotateX(${xTilt}deg)`,
        width: 280, height: 580,
        borderRadius: 40,
        background: "linear-gradient(145deg, #2A2A30, #1A1A1E, #35353A)",
        padding: 4,
        boxShadow: `${shadowShiftX}px ${shadowShiftY}px 70px rgba(0,0,0,${shadowOpacity * 1.2}), ${shadowShiftX * 0.5}px ${shadowShiftY * 0.5}px 30px rgba(0,0,0,${shadowOpacity * 0.6}), 0 4px 8px rgba(0,0,0,${shadowOpacity * 0.3})`,
      }}
    >
      {edgeWidth > 1 && (
        <div style={{
          position: "absolute", top: 8, bottom: 8,
          [edgeSide]: -edgeWidth,
          width: edgeWidth,
          borderRadius: edgeSide === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
          background: "linear-gradient(180deg, #3A3A40, #28282E, #3A3A40)",
          transform: `translateZ(-${edgeWidth * 0.5}px)`,
        }} />
      )}
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 36, background: PHONE_BG,
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: 36, background: PHONE_BG,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: GREY_TEXT,
          fontFamily: "system-ui, sans-serif", fontWeight: 600,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: 6, left: "50%",
            transform: "translateX(-50%)",
            width: 80, height: 22, borderRadius: 12, background: "#1A1A1A",
          }} />
          <div style={{ position: "absolute", left: 16, top: 10, fontSize: 10, fontWeight: 600 }}>9:41</div>
        </div>
        <div style={{ overflow: "hidden", height: 536 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   CHAT UI — "Good morning" screen with keyboard
   ═══════════════════════════════════════════════════════ */
const ChatUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const typingProgress = interpolate(frame, [10, 60], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const fullText = "Create a cute social caption for Baxter";
  const visibleChars = Math.floor(typingProgress * fullText.length);
  const typedText = fullText.slice(0, visibleChars);
  const showCursor = frame % 16 < 10 && frame < 65;

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
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, color: DARK_TEXT, fontWeight: 500 }}>Good morning</div>
        <div style={{ fontSize: 14, color: GREY_TEXT, opacity: 0.4 }}>{String.fromCodePoint(0x2197)}</div>
      </div>
      {/* Chats label */}
      <div style={{ padding: "6px 16px 2px", fontSize: 11, color: GREY_TEXT, opacity: 0.6 }}>Chats</div>
      {/* Content */}
      <div style={{ flex: 1, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>
        {/* Icon row — Google app chips */}
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
        {/* Small dog thumbnail */}
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
        {/* Typing bubble */}
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", opacity: bubbleSpring, transform: `translateY(${bubbleY}px) scale(${bubbleScale})`, transformOrigin: "bottom left" }}>
          <div style={{ background: USER_BUBBLE, borderRadius: 20, padding: "12px 16px", fontSize: 13.5, color: DARK_TEXT, lineHeight: 1.45 }}>
            {typedText}
            {showCursor && <span style={{ color: BLUE, fontWeight: 300 }}>|</span>}
          </div>
        </div>
      </div>
      {/* Input hint */}
      <div style={{ padding: "6px 14px 4px", fontSize: 11, color: "#9AA0A6", opacity: 0.5 }}>
        Type, talk, or share a photo
      </div>
      {/* Action buttons */}
      <div style={{ padding: "2px 14px 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: GREY_TEXT }}>{MIC}</div>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>{CAMERA}</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 32, height: 32, borderRadius: 16, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", transform: "rotate(-30deg)" }}>{PLAY}</div>
      </div>
      {/* Keyboard */}
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

/* ═══════════════════════════════════════════════════════
   AI RESPONSE UI
   ═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   4-POINT SPARKLE SVG — proper Gemini sparkle icon
   ═══════════════════════════════════════════════════════ */
const SparkleIcon: React.FC<{
  size?: number;
  color?: string;
  gradientId?: string;
  gradientColors?: [string, string];
}> = ({ size = 20, color, gradientId, gradientColors }) => {
  const useGrad = !!gradientId && !!gradientColors;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {useGrad && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientColors![0]} />
            <stop offset="100%" stopColor={gradientColors![1]} />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill={useGrad ? `url(#${gradientId})` : (color || BLUE)}
      />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════
   DESKTOP BROWSER FRAME with rainbow gradient border
   Reference: zoomed into top-left corner of browser.
   Rainbow/gradient border along left + top edges.
   ═══════════════════════════════════════════════════════ */
const DesktopBrowserFrame: React.FC<{
  children: React.ReactNode;
  scale?: number;
  x?: number;
  y?: number;
  glowAngle?: number;
}> = ({ children, scale = 1, x = 0, y = 0, glowAngle = 0 }) => {
  const gradAngle = 135 + glowAngle * 0.5;
  return (
    <div style={{
      position: "absolute",
      left: "50%", top: "50%",
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
      width: 560, height: 580,
      borderRadius: 14,
      /* Rainbow gradient border via padding trick — thicker + glow */
      background: `linear-gradient(${gradAngle}deg, #E91E63 0%, #E040FB 20%, #9C27B0 35%, #7C4DFF 50%, #536DFE 65%, #448AFF 80%, #40C4FF 100%)`,
      padding: 3,
      boxShadow: `0 20px 80px rgba(0,0,0,0.10), 0 4px 20px rgba(0,0,0,0.06), 0 0 30px rgba(156,39,176,0.12), 0 0 60px rgba(124,77,255,0.08)`,
    }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 12,
        background: "#FAFBFF",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Subtle top-left glow from the gradient border */}
        <div style={{
          position: "absolute", top: -40, left: -40,
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(156,39,176,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {children}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   GEMINI DROPDOWN UI — DESKTOP style
   Reference: hamburger menu, "Gemini" title with
   dropdown arrow, dropdown card with two rows:
   - Gemini: blue sparkle + checkmark circle
   - Gemini Advanced: pink/purple sparkle + "Upgrade" btn
   Grey "+" button on left, search bar at bottom.
   ═══════════════════════════════════════════════════════ */
const GeminiDesktopUI: React.FC<{
  dropdownOpen: number;
  row1: number;
  row2: number;
  checkmark: number;
}> = ({ dropdownOpen, row1, row2, checkmark }) => {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAFBFF",
      fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif",
      position: "relative",
    }}>
      {/* Top bar — hamburger + "Gemini" dropdown title */}
      <div style={{
        padding: "20px 28px",
        display: "flex", alignItems: "center", gap: 18,
      }}>
        {/* Hamburger menu — 3 horizontal lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ width: 20, height: 2, background: GREY_TEXT, borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: GREY_TEXT, borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: GREY_TEXT, borderRadius: 1 }} />
        </div>
        {/* "Gemini" title + dropdown arrow */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 22, color: DARK_TEXT, fontWeight: 400,
          letterSpacing: -0.3,
        }}>
          <span>Gemini</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginTop: 2 }}>
            <path d="M1 1L5 5L9 1" stroke={GREY_TEXT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Dropdown card */}
      <div style={{
        margin: "0 28px",
        background: "#F0F1F6",
        borderRadius: 16,
        overflow: "hidden",
        maxHeight: interpolate(dropdownOpen, [0, 1], [0, 150]),
        opacity: dropdownOpen,
        transform: `scaleY(${interpolate(dropdownOpen, [0, 1], [0.7, 1])})`,
        transformOrigin: "top",
        boxShadow: "0 4px 24px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {/* Row 1: Gemini with blue sparkle + checkmark */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          opacity: row1,
          transform: `translateX(${interpolate(row1, [0, 1], [-8, 0])}px)`,
          background: row1 > 0.5 ? "rgba(66,133,244,0.04)" : "transparent",
        }}>
          <SparkleIcon size={22} color="#4285F4" />
          <div style={{
            fontSize: 17, color: DARK_TEXT, fontWeight: 400,
            flex: 1, letterSpacing: -0.2,
          }}>Gemini</div>
          {/* Checkmark circle */}
          <div style={{
            width: 24, height: 24, borderRadius: 12,
            border: `1.5px solid ${checkmark > 0.5 ? GREY_TEXT : "#C4C7CC"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${interpolate(checkmark, [0, 1], [0.6, 1])})`,
            opacity: checkmark,
          }}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1.5" stroke={GREY_TEXT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#E2E4EA", margin: "0 16px" }} />

        {/* Row 2: Gemini Advanced with gradient sparkle + "Upgrade" button */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          opacity: row2,
          transform: `translateX(${interpolate(row2, [0, 1], [-8, 0])}px)`,
        }}>
          <SparkleIcon
            size={22}
            gradientId="advancedSparkle"
            gradientColors={["#E040FB", "#7C4DFF"]}
          />
          <div style={{
            fontSize: 17, color: DARK_TEXT, fontWeight: 400,
            flex: 1, letterSpacing: -0.2, whiteSpace: "nowrap",
          }}>Gemini Advanced</div>
          <div style={{
            background: DARK_TEXT, color: "#fff",
            fontSize: 13, fontWeight: 600,
            padding: "6px 16px", borderRadius: 6,
            whiteSpace: "nowrap",
            transform: `scale(${interpolate(row2, [0, 1], [0.8, 1])})`,
          }}>Upgrade</div>
        </div>
      </div>

      {/* "+" circle button — lower left */}
      <div style={{
        position: "absolute", bottom: 90, left: 32,
        width: 52, height: 52, borderRadius: 26,
        background: "#E2E4EA",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, color: GREY_TEXT, fontWeight: 300,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>+</div>

      {/* Bottom search/input bar */}
      <div style={{
        position: "absolute", bottom: 24, left: 28, right: 28,
        background: "#EFF0F6",
        borderRadius: 28,
        padding: "16px 22px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <SparkleIcon size={18} color="#9AA0A6" />
        <div style={{ fontSize: 15, color: "#9AA0A6", flex: 1 }}>Ask Gemini</div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 15V3M12 3L8 7M12 3L16 7" stroke="#9AA0A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17L2 21H22V17" stroke="#9AA0A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

/* ═══════════════════════════════════════════════════════
   MAIN SCENE — GSAP state-driven orchestration
   ═══════════════════════════════════════════════════════ */
export const Scene04: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const { state: s } = useGsapAnimState(fps);

  /* ── Phase visibility ── */
  const showDogPhoto = frame < PHASE.DOG_PHOTO.end;
  const showChat = frame >= PHASE.DOG_PHOTO.end && frame < PHASE.PHOTO_EXPAND.start;
  const showPhotoExpand = frame >= PHASE.PHOTO_EXPAND.start && frame < PHASE.AI_RESPONSE.start;
  const showAIResponse = frame >= PHASE.AI_RESPONSE.start && frame < PHASE.GEMINI_UI.start;
  const showGeminiUI = frame >= PHASE.GEMINI_UI.start;
  const showEmojis = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.TRANSITION_TEXT.start;
  const showButText = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.INTRODUCING.start + 15;
  const showIntro = frame >= PHASE.INTRODUCING.start && frame < PHASE.GEMINI_UI.start;

  /* Photo expand progress */
  const photoExpandProgress = interpolate(frame, [PHASE.PHOTO_EXPAND.start, PHASE.PHOTO_EXPAND.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* Phone tilt — strong entrance tilt, reduces over time, ramps up during exit */
  const phoneTilt = interpolate(frame,
    [0, 30, PHASE.PHOTO_EXPAND.start, PHASE.AI_RESPONSE.start, PHASE.EMOJI_BURST.start, PHASE.TRANSITION_TEXT.start, PHASE.TRANSITION_TEXT.start + 16],
    [-18, -14, -10, -6, -4, -4, -45],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  /* Phone X rotation — subtle forward lean that reduces over time */
  const phoneXTilt = interpolate(frame,
    [0, PHASE.AI_RESPONSE.start, PHASE.TRANSITION_TEXT.start, PHASE.TRANSITION_TEXT.start + 16],
    [5, 2, 2, 8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* Noise-based background */
  const bgX1 = 40 + noise2D("bgX", frame * 0.005, 0) * 12;
  const bgY1 = 40 + noise2D("bgY", frame * 0.005, 1) * 10;
  const bgX2 = 70 + noise2D("bg2X", frame * 0.004, 2) * 8;
  const bgY2 = 60 + noise2D("bg2Y", frame * 0.004, 3) * 6;

  /* Gemini local frame */
  const geminiLocalFrame = Math.max(0, frame - (PHASE.GEMINI_UI.start - 10));

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

        {/* ════════════════════════════════════════════════
            PHONE SECTION — Dog photo (hard cut) Chat AI Response
            ════════════════════════════════════════════════ */}
        {frame < PHASE.GEMINI_UI.start && (() => {
          const phoneIsExiting = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.TRANSITION_TEXT.start + 12;
          const emojiBursting = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.EMOJI_BURST.start + 12;
          const needsBlur = phoneIsExiting || emojiBursting;
          /* Perlin noise idle float — phone is never perfectly still */
          const phoneNoiseX = noise2D("phX", frame * 0.012, 0) * 6;
          const phoneNoiseY = noise2D("phY", 0, frame * 0.010) * 4;
          const phoneNoiseRot = noise2D("phR", frame * 0.008, 5) * 1.2;
          const content = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.phoneOpacity,
              transform: `translate(${s.phoneX + phoneNoiseX}px, ${s.phoneY + phoneNoiseY}px) rotate(${s.phoneRotation + phoneNoiseRot}deg)`,
            }}>
              <PhoneMockup tilt={phoneTilt} xTilt={phoneXTilt} scale={s.phoneScale} shadowOpacity={0.18}>
                {/* DOG PHOTO — full-screen, hard cut at frame 15 */}
                {showDogPhoto && <DogPhotoScreen />}
                {/* CHAT — "Good morning" with keyboard */}
                {showChat && <ChatUI frame={frame - PHASE.DOG_PHOTO.end} fps={fps} />}
                {/* Photo expand */}
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
                {/* AI Response */}
                {showAIResponse && <AIResponseUI frame={frame - PHASE.AI_RESPONSE.start} fps={fps} />}
              </PhoneMockup>
              {/* Floating emojis */}
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

        {/* ════════════════════════════════════════════════
            "But that's not all..." — staggered word reveal
            ════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════
            "Introducing" — gradient sweep
            ════════════════════════════════════════════════ */}
        {showIntro && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: 230,
            opacity: s.introOpacity,
            transform: `scale(${s.introScale}) translate(${introWobX}px, ${introWobY}px)`,
            zIndex: 10,
          }}>
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

        {/* ════════════════════════════════════════════════
            GEMINI UI — DESKTOP BROWSER with rainbow border
            Zoomed into top-left corner
            ════════════════════════════════════════════════ */}
        {showGeminiUI && (() => {
          const geminiContent = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.geminiOpacity,
              transform: `translateY(${s.geminiY}px) translate(${gemWobX}px, ${gemWobY}px)`,
            }}>
              <DesktopBrowserFrame
                scale={s.geminiScale}
                x={s.geminiPanX}
                y={s.geminiPanY}
                glowAngle={s.geminiGlowAngle}
              >
                <GeminiDesktopUI
                  dropdownOpen={s.geminiDropdownOpen}
                  row1={s.geminiRow1}
                  row2={s.geminiRow2}
                  checkmark={s.geminiCheckmark}
                />
              </DesktopBrowserFrame>
            </div>
          );
          if (geminiLocalFrame > 0 && geminiLocalFrame < 10) {
            return (
              <CameraMotionBlur samples={5} shutterAngle={90}>
                {geminiContent}
              </CameraMotionBlur>
            );
          }
          return geminiContent;
        })()}

        {/* Dark overlay for scene end */}
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
