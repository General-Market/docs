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
  EMOJI_BURST: { start: 170, end: 230 },
  TRANSITION_TEXT: { start: 230, end: 280 },
  INTRODUCING: { start: 270, end: 310 },
  GEMINI_UI: { start: 300, end: 339 },
};

/* ─── colors ─── */
const BG = "#F0F0F8";
const PHONE_BG = "#FFFFFF";
const BLUE = "#4285F4";
const USER_BUBBLE = "#E8F0FE";
const AI_BUBBLE = "#FFFFFF";
const GREY_TEXT = "#5F6368";
const DARK_TEXT = "#1F1F1F";

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

/* ─── floating emoji config ─── */
const FLOATING_EMOJIS = [
  { emoji: PARTY, x: -180, y: -200, size: 52, seed: 1 },
  { emoji: HEART_EYES, x: 190, y: -160, size: 44, seed: 2 },
  { emoji: DOG_FACE, x: -160, y: 180, size: 36, seed: 3 },
  { emoji: RED_HEART, x: 220, y: 100, size: 40, seed: 4 },
  { emoji: RED_HEART, x: 250, y: 160, size: 32, seed: 5 },
  { emoji: RED_HEART, x: 200, y: 220, size: 28, seed: 6 },
  { emoji: PARTY, x: -200, y: 60, size: 38, seed: 7 },
  { emoji: DOG_FACE, x: 160, y: -240, size: 30, seed: 8 },
];

/* ─── Phone Mockup ─── */
const PhoneMockup: React.FC<{
  children: React.ReactNode;
  tilt?: number;
  scale?: number;
  x?: number;
  y?: number;
  shadowOpacity?: number;
}> = ({
  children,
  tilt = -3,
  scale = 1,
  x = 0,
  y = 0,
  shadowOpacity = 0.15,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) perspective(1200px) rotateY(${tilt}deg) rotateX(2deg)`,
        width: 280,
        height: 560,
        borderRadius: 36,
        background: PHONE_BG,
        border: "3px solid #D0D0D8",
        overflow: "hidden",
        boxShadow: `12px 16px 40px rgba(0,0,0,${shadowOpacity}), 4px 6px 16px rgba(0,0,0,${shadowOpacity * 0.5})`,
      }}
    >
      <div
        style={{
          height: 32,
          background: PHONE_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: GREY_TEXT,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 600,
          borderBottom: "1px solid #F0F0F0",
        }}
      >
        9:41
      </div>
      <div style={{ flex: 1, overflow: "hidden", height: 528 }}>
        {children}
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
        }}
      >
        <div style={{ fontSize: 16, color: DARK_TEXT, fontWeight: 500 }}>
          Good morning
        </div>
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
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#E8E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{MAIL}</div>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FFF3E0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{MEMO}</div>
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
          <div style={{ background: USER_BUBBLE, borderRadius: 18, padding: "10px 14px", fontSize: 13, color: DARK_TEXT, lineHeight: 1.4 }}>
            {typedText}
            {showCursor && <span style={{ color: BLUE, fontWeight: 300 }}>|</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 14px 14px", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #F0F0F0" }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: GREY_TEXT }}>{MIC}</div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: GREY_TEXT }}>{CAMERA}</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 28, borderRadius: 14, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>{PLAY}</div>
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
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 14, color: GREY_TEXT }}>{ARROW_LEFT}</div>
        <div style={{ fontSize: 14, color: DARK_TEXT, fontWeight: 500 }}>{"Baxter's Great Adventure"}</div>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: USER_BUBBLE, borderRadius: 16, padding: "8px 12px", fontSize: 12, color: GREY_TEXT }}>
          Create a cute social caption for Baxter
        </div>
        <div
          style={{
            width: "100%", height: 140, borderRadius: 14,
            background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 30%, #D4A574 50%, #C4956A 70%, #87CEEB 100%)",
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
            background: AI_BUBBLE, borderRadius: 16, padding: "10px 14px",
            fontSize: 13, color: DARK_TEXT, lineHeight: 1.5,
            border: "1px solid #E8E8E8",
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
      <div style={{ padding: "8px 14px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: GREY_TEXT }}>
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
      <div style={{ position: "absolute", bottom: 60, left: 20, width: 44, height: 44, borderRadius: 22, background: "#E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: GREY_TEXT, opacity: interpolate(dropdownOpen, [0, 1], [0, 1]) }}>+</div>
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "#F0F0F4", borderRadius: 24, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, opacity: interpolate(dropdownOpen, [0, 1], [0.3, 0.8]) }}>
        <div style={{ fontSize: 14, color: BLUE }}>{SPARKLE}</div>
        <div style={{ fontSize: 13, color: "#999", flex: 1 }}>Gemini</div>
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
    [PHASE.TRANSITION_TEXT.start + 5, PHASE.TRANSITION_TEXT.start + 20, PHASE.INTRODUCING.start, PHASE.INTRODUCING.start + 15],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const introOpacity = interpolate(frame,
    [PHASE.INTRODUCING.start, PHASE.INTRODUCING.start + 15, PHASE.GEMINI_UI.start - 5, PHASE.GEMINI_UI.start + 5],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const geminiEntry = spring({ frame: frame - PHASE.GEMINI_UI.start, fps, config: { damping: 14, stiffness: 60, mass: 1 } });
  const geminiY = interpolate(geminiEntry, [0, 1], [120, 0]);
  const geminiOpacity = frame >= PHASE.GEMINI_UI.start ? geminiEntry : 0;

  const fadeToBlack = interpolate(frame, [325, 339], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const showChat = frame < PHASE.PHOTO_EXPAND.start;
  const showPhotoExpand = frame >= PHASE.PHOTO_EXPAND.start && frame < PHASE.AI_RESPONSE.start;
  const showAIResponse = frame >= PHASE.AI_RESPONSE.start && frame < PHASE.TRANSITION_TEXT.start;
  const showGeminiUI = frame >= PHASE.GEMINI_UI.start;

  const phoneScale = interpolate(frame, [PHASE.EMOJI_BURST.start, PHASE.EMOJI_BURST.start + 20], [0.95, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phoneTilt = interpolate(frame, [0, PHASE.AI_RESPONSE.start], [-4, -2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 40% 40%, rgba(200,210,240,0.4) 0%, transparent 70%)" }} />

      {frame < PHASE.GEMINI_UI.start && (
        <div style={{ position: "absolute", inset: 0, opacity: phoneOpacity * phoneSlideOpacity, transform: `translateX(${phoneSlideX}px) translateY(${phoneY}px)` }}>
          <PhoneMockup tilt={phoneTilt} scale={phoneScale} shadowOpacity={0.18}>
            {showChat && <ChatUI frame={frame} fps={fps} />}
            {showPhotoExpand && (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg, #87CEAB 0%, #6BAF6B 30%, #D4A574 50%, #C4956A 70%, #87CEEB 100%)", display: "flex", alignItems: "center", justifyContent: "center", opacity: interpolate(photoExpandProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) }}>
                <div style={{ fontSize: interpolate(photoExpandProgress, [0, 1], [60, 100]), filter: "drop-shadow(3px 3px 6px rgba(0,0,0,0.2))" }}>{DOG_FULL}</div>
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
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: butTextOpacity }}>
          <div style={{ fontSize: 38, fontFamily: "system-ui, sans-serif", fontWeight: 400, color: DARK_TEXT, letterSpacing: -0.5 }}>
            {"But that\u2019s not all"}
            <span style={{ color: frame > PHASE.TRANSITION_TEXT.start + 25 ? "#7C4DFF" : DARK_TEXT }}>...</span>
          </div>
        </div>
      )}

      {frame >= PHASE.INTRODUCING.start && frame < PHASE.GEMINI_UI.start + 5 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: introOpacity }}>
          <div style={{ fontSize: 54, fontFamily: "system-ui, sans-serif", fontWeight: 400, background: "linear-gradient(90deg, #DB4437 0%, #E040FB 40%, #4285F4 80%, #4285F4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>
            Introducing
          </div>
        </div>
      )}

      {showGeminiUI && (
        <div style={{ position: "absolute", inset: 0, opacity: geminiOpacity, transform: `translateY(${geminiY}px)` }}>
          <PhoneMockup tilt={-2} scale={1.1} y={40} shadowOpacity={0.2}>
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
