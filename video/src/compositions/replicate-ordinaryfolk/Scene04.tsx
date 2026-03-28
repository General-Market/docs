import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { noise2D } from "@remotion/noise";

/* ─── timing (30fps, 339 frames ~ 11.3s) ─── */
const PHASE = {
  CHAT_IN: { start: 0, end: 80 },
  PHOTO_EXPAND: { start: 80, end: 110 },
  AI_RESPONSE: { start: 110, end: 170 },
  EMOJI_BURST: { start: 170, end: 225 },
  TRANSITION_TEXT: { start: 218, end: 270 },
  INTRODUCING: { start: 265, end: 305 },
  GEMINI_UI: { start: 298, end: 339 },
};

/* ─── colors (matched to reference) ─── */
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

/* ─── floating emoji config (matched to reference frame 12) ─── */
const FLOATING_EMOJIS = [
  /* left side — party + heart-eyes cluster */
  { emoji: HEART_EYES, x: -240, y: -180, size: 72, seed: 1 },
  { emoji: PARTY, x: -200, y: -80, size: 66, seed: 2 },
  { emoji: DOG_FACE, x: -220, y: 180, size: 44, seed: 3 },
  /* right side — cascading hearts */
  { emoji: RED_HEART, x: 280, y: 60, size: 64, seed: 4 },
  { emoji: RED_HEART, x: 310, y: 160, size: 56, seed: 5 },
  { emoji: RED_HEART, x: 270, y: 250, size: 48, seed: 6 },
  { emoji: RED_HEART, x: 240, y: -120, size: 42, seed: 7 },
  /* scattered extras */
  { emoji: HEART_EYES, x: 220, y: -220, size: 50, seed: 8 },
  { emoji: DOG_FACE, x: -160, y: -260, size: 36, seed: 9 },
  { emoji: PARTY, x: -280, y: 60, size: 52, seed: 10 },
];

/* ─── Phone Mockup ─── */
const PhoneMockup: React.FC<{
  children: React.ReactNode;
  tilt?: number;
  scale?: number;
  x?: number;
  y?: number;
  shadowOpacity?: number;
  glowColor?: string;
}> = ({
  children,
  tilt = -3,
  scale = 1,
  x = 0,
  y = 0,
  shadowOpacity = 0.15,
  glowColor,
}) => {
  const glowShadow = glowColor
    ? `, 0 0 30px ${glowColor}, 0 0 60px ${glowColor}`
    : "";
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) perspective(1200px) rotateY(${tilt}deg) rotateX(3deg)`,
        width: 280,
        height: 580,
        borderRadius: 40,
        background: "linear-gradient(145deg, #2A2A30, #1A1A1E, #35353A)",
        padding: 4,
        boxShadow: `20px 28px 70px rgba(0,0,0,${shadowOpacity * 1.2}), 8px 12px 30px rgba(0,0,0,${shadowOpacity * 0.5}), 0 4px 8px rgba(0,0,0,${shadowOpacity * 0.3})${glowShadow}`,
      }}
    >
      {/* Inner screen */}
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
        {/* Status bar with notch */}
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
          {/* Notch / dynamic island */}
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
        {/* Content area */}
        <div style={{ overflow: "hidden", height: 536 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ─── Chat UI ─── */
const ChatUI: React.FC<{ frame: number; fps: number }> = ({ frame }) => {
  const typingProgress = interpolate(frame, [10, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fullText = "Create a cute social caption for Baxter";
  const visibleChars = Math.floor(typingProgress * fullText.length);
  const typedText = fullText.slice(0, visibleChars);
  const showCursor = frame % 16 < 10 && frame < 75;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: PHONE_BG,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #F0F0F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 16, color: DARK_TEXT, fontWeight: 500 }}>
          Good morning
        </div>
        {/* Expand icon — top-right arrow */}
        <div style={{ fontSize: 14, color: GREY_TEXT, opacity: 0.4 }}>{String.fromCodePoint(0x2197)}</div>
      </div>
      <div
        style={{
          flex: 1,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            opacity: interpolate(frame, [0, 15], [0, 0.6], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#E8E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{MAIL}</div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FFF3E0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{MEMO}</div>
          {/* YouTube-style chip */}
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FFE0E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 16, height: 12, borderRadius: 3, background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderLeft: "5px solid #fff", borderTop: "3px solid transparent", borderBottom: "3px solid transparent" }} />
            </div>
          </div>
          {/* Maps pin */}
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 18, borderRadius: "50% 50% 50% 0", background: "#34A853", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fff" }} />
            </div>
          </div>
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              width: 100, height: 80, borderRadius: 12,
              background: "linear-gradient(135deg, #A8D5A2 0%, #7CB87C 40%, #D4A574 60%, #C4956A 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: 36, filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.2))" }}>{DOG_FULL}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 20, background: "linear-gradient(to top, rgba(139,195,74,0.4), transparent)" }} />
          </div>
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "85%",
            opacity: interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
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
      {/* Mini keyboard — dark theme matching reference */}
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
const AIResponseUI: React.FC<{ frame: number; fps: number }> = ({ frame }) => {
  const responseText = "Baxter is the hilltop king! " + CROWN + " Look who's on top of the world! #doglover #majestic #hikingdog";
  const typeProgress = interpolate(frame, [0, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visibleChars = Math.floor(typeProgress * responseText.length);
  const visible = responseText.slice(0, visibleChars);

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
        <div
          style={{
            width: "100%", height: 150, borderRadius: 16,
            background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 25%, #8FBC8F 40%, #D4A574 55%, #C4956A 70%, #87CEEB 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 60, filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))" }}>{DOG_FULL}</div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(to bottom, rgba(135,206,235,0.5), transparent)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to top, rgba(107,175,107,0.5), transparent)" }} />
        </div>
        <div
          style={{
            background: AI_BUBBLE, borderRadius: 18, padding: "12px 16px",
            fontSize: 13.5, color: DARK_TEXT, lineHeight: 1.5,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {visible.split(/(#\w+)/g).map((part, i) =>
            part.startsWith("#") ? (
              <span key={i} style={{ color: BLUE }}>{part}</span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      </div>
      {/* Action icons below AI response — Google logo, thumbs, share, copy */}
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

/* ─── Gemini Dropdown UI ─── */
const GeminiDropdownUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const dropdownOpen = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: "system-ui, sans-serif", position: "relative" }}>
      {/* Pink accent line at top — matches reference (visible through phone bezel) */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #E91E63, #E040FB, #7C4DFF)", opacity: 0.85 }} />
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 18, color: GREY_TEXT }}>{HAMBURGER}</div>
        <div style={{ fontSize: 18, color: DARK_TEXT, fontWeight: 500 }}>
          {"Gemini "}
          <span style={{ fontSize: 12, color: GREY_TEXT }}>{ARROW_DOWN}</span>
        </div>
      </div>
      <div
        style={{
          margin: "0 16px", background: "#F8F9FA", borderRadius: 16,
          padding: `${interpolate(dropdownOpen, [0, 1], [0, 12])}px 14px`,
          maxHeight: interpolate(dropdownOpen, [0, 1], [0, 120]),
          overflow: "hidden", opacity: dropdownOpen,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ fontSize: 18, color: BLUE }}>{SPARKLE}</div>
          <div style={{ fontSize: 14, color: DARK_TEXT, fontWeight: 500, flex: 1 }}>Gemini</div>
          <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${BLUE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: BLUE }}>{CHECKMARK}</div>
        </div>
        <div style={{ height: 1, background: "#E0E0E0", margin: "4px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ fontSize: 18, background: "linear-gradient(135deg, #E040FB, #7C4DFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{SPARKLE}</div>
          <div style={{ fontSize: 14, color: DARK_TEXT, fontWeight: 500 }}>Gemini Advanced</div>
          <div style={{ background: DARK_TEXT, color: "#fff", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4 }}>Upgrade</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 60, left: 20, width: 48, height: 48, borderRadius: 24, background: "#E8E8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: GREY_TEXT, opacity: interpolate(dropdownOpen, [0, 1], [0, 1]), boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>+</div>
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "#F0F0F4", borderRadius: 28, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, opacity: interpolate(dropdownOpen, [0, 1], [0.3, 0.8]) }}>
        <div style={{ fontSize: 15, color: BLUE }}>{SPARKLE}</div>
        <div style={{ fontSize: 14, color: "#9AA0A6", flex: 1 }}>Gemini</div>
      </div>
    </div>
  );
};

/* ─── Floating Emoji ─── */
const FloatingEmoji: React.FC<{
  emoji: string; x: number; y: number; size: number;
  seed: number; frame: number; fps: number; startFrame: number;
}> = ({ emoji, x, y, size, seed, frame, fps, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const entryProgress = spring({ frame: localFrame, fps, config: { damping: 10, stiffness: 80, mass: 0.6 } });
  const noiseX = noise2D("emojiX" + seed, localFrame * 0.02, seed) * 12;
  const noiseY = noise2D("emojiY" + seed, localFrame * 0.015, seed) * 8;

  return (
    <div
      style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(${x + noiseX}px, ${y + noiseY}px) scale(${entryProgress})`,
        fontSize: size, opacity: entryProgress,
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))",
        pointerEvents: "none",
      }}
    >
      {emoji}
    </div>
  );
};

/* ═══ Main Scene ═══ */
export const Scene04: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneEntry = spring({ frame, fps, config: { damping: 14, stiffness: 60, mass: 1 } });
  const phoneY = interpolate(phoneEntry, [0, 1], [80, 0]);
  const phoneOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const photoExpandProgress = interpolate(frame, [PHASE.PHOTO_EXPAND.start, PHASE.PHOTO_EXPAND.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const transitionProgress = interpolate(frame, [PHASE.TRANSITION_TEXT.start, PHASE.TRANSITION_TEXT.start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phoneSlideX = interpolate(transitionProgress, [0, 1], [0, -600]);
  const phoneSlideOpacity = interpolate(transitionProgress, [0, 0.6], [1, 0], { extrapolateRight: "clamp" });

  const butTextOpacity = interpolate(frame,
    [PHASE.TRANSITION_TEXT.start, PHASE.TRANSITION_TEXT.start + 12, PHASE.INTRODUCING.start - 5, PHASE.INTRODUCING.start + 5],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const introOpacity = interpolate(frame,
    [PHASE.INTRODUCING.start, PHASE.INTRODUCING.start + 10, PHASE.GEMINI_UI.start - 8, PHASE.GEMINI_UI.start],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const introScale = interpolate(frame,
    [PHASE.INTRODUCING.start, PHASE.INTRODUCING.start + 20],
    [0.9, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const geminiEntry = spring({ frame: frame - PHASE.GEMINI_UI.start, fps, config: { damping: 14, stiffness: 60, mass: 1 } });
  const geminiY = interpolate(geminiEntry, [0, 1], [120, 0]);
  const geminiOpacity = frame >= PHASE.GEMINI_UI.start ? geminiEntry : 0;

  const fadeToBlack = interpolate(frame, [320, 338], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const showChat = frame < PHASE.PHOTO_EXPAND.start;
  const showPhotoExpand = frame >= PHASE.PHOTO_EXPAND.start && frame < PHASE.AI_RESPONSE.start;
  const showAIResponse = frame >= PHASE.AI_RESPONSE.start && frame < PHASE.GEMINI_UI.start;
  const showGeminiUI = frame >= PHASE.GEMINI_UI.start;

  // Zoom in during close-up chat, zoom out to normal, then scale up for emoji burst
  const zoomIn = interpolate(frame, [0, 40, 70, 80, 110], [0.92, 0.95, 1.12, 1.12, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const emojiScale = interpolate(frame, [PHASE.EMOJI_BURST.start, PHASE.EMOJI_BURST.start + 20], [0.92, 0.88], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phoneScale = frame < PHASE.EMOJI_BURST.start ? zoomIn : emojiScale;
  const phoneTilt = interpolate(frame, [0, PHASE.AI_RESPONSE.start], [-8, -4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Subtle animated background gradient — shifts over time */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at ${40 + noise2D("bgX", frame * 0.005, 0) * 12}% ${40 + noise2D("bgY", frame * 0.005, 1) * 10}%, rgba(200,210,240,0.35) 0%, transparent 65%)`,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at ${70 + noise2D("bg2X", frame * 0.004, 2) * 8}% ${60 + noise2D("bg2Y", frame * 0.004, 3) * 6}%, rgba(220,200,230,0.15) 0%, transparent 50%)`,
      }} />

      {/* Disclaimer text */}
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

      {frame < PHASE.GEMINI_UI.start && (
        <div style={{ position: "absolute", inset: 0, opacity: phoneOpacity * phoneSlideOpacity, transform: `translateX(${phoneSlideX}px) translateY(${phoneY}px)` }}>
          <PhoneMockup tilt={phoneTilt} scale={phoneScale} shadowOpacity={0.18}>
            {showChat && <ChatUI frame={frame} fps={fps} />}
            {showPhotoExpand && (
              <div style={{
                width: "100%", height: "100%",
                background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 25%, #8FBC8F 40%, #D4A574 55%, #C4956A 70%, #87CEEB 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: interpolate(photoExpandProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
              }}>
                {/* Simulated photo — grass/sky gradient with depth blur */}
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
          {frame >= PHASE.EMOJI_BURST.start && frame < PHASE.TRANSITION_TEXT.start &&
            FLOATING_EMOJIS.map((item, i) => (
              <FloatingEmoji key={i} emoji={item.emoji} x={item.x} y={item.y} size={item.size} seed={item.seed} frame={frame} fps={fps} startFrame={PHASE.EMOJI_BURST.start + i * 3} />
            ))}
        </div>
      )}

      {frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.INTRODUCING.start + 15 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, opacity: butTextOpacity }}>
          <div style={{ fontSize: 40, fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif", fontWeight: 300, color: DARK_TEXT, letterSpacing: -0.3 }}>
            {"But that\u2019s not "}
            <span style={{ color: BLUE }}>all</span>
            {frame > PHASE.TRANSITION_TEXT.start + 10 && <span style={{ color: "#9C27B0", fontSize: "0.7em", fontWeight: 700, letterSpacing: 2 }}>...</span>}
          </div>
        </div>
      )}

      {frame >= PHASE.INTRODUCING.start && frame < PHASE.GEMINI_UI.start + 5 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: introOpacity, transform: `scale(${introScale})` }}>
          {/* Subtle glow behind text — matches reference frame 18 */}
          <div style={{
            position: "absolute", width: 500, height: 140,
            background: "radial-gradient(ellipse, rgba(200,160,240,0.2) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />
          <div style={{ fontSize: 68, fontFamily: "'Google Sans', 'Product Sans', system-ui, sans-serif", fontWeight: 300, background: "linear-gradient(90deg, #DB4437 0%, #C2185B 25%, #9C27B0 50%, #5C6BC0 75%, #4285F4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1, position: "relative", textAlign: "center" }}>
            Introducing
          </div>
        </div>
      )}

      {showGeminiUI && (
        <div style={{ position: "absolute", inset: 0, opacity: geminiOpacity, transform: `translateY(${geminiY}px)` }}>
          <PhoneMockup tilt={-4} scale={2.8} x={-240} y={340} shadowOpacity={0.22} glowColor="rgba(233,30,99,0.2)">
            <GeminiDropdownUI frame={frame - PHASE.GEMINI_UI.start} fps={fps} />
          </PhoneMockup>
        </div>
      )}

      {fadeToBlack > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: fadeToBlack }} />
      )}
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
