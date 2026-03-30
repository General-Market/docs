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
import { Phone3D } from "../../lib/Phone3D";
import { useFloat3D, TILT_PRESETS } from "../../lib/tilt3d";
import { GM } from "./theme";

/* ─── timing (30fps, 339 frames ~ 11.3s) ─── */
const PHASE = {
  DOG_PHOTO: { start: 0, end: 15 },       /* Full-screen dog photo on phone */
  CHAT_IN: { start: 15, end: 80 },          /* Hard cut to "Good morning" chat */
  PHOTO_EXPAND: { start: 80, end: 110 },
  AI_RESPONSE: { start: 110, end: 170 },
  EMOJI_BURST: { start: 170, end: 205 },
  TRANSITION_TEXT: { start: 198, end: 258 },
  INTRODUCING: { start: 255, end: 298 },
  GM_UI: { start: 293, end: 339 },
};

/* ─── colors ─── */
const BG = GM.greenLight;
const PHONE_BG = GM.bgPage;
const GM_GREEN = GM.green;
const GM_DARK_GREEN = GM.greenDark;
const USER_BUBBLE = GM.greenLight;
const AI_BUBBLE = GM.bgPage;
const GREY_TEXT = "#5F6368";
const DARK_TEXT = GM.textPrimary;
const KB_BG = "#2C2C2E";
const KB_KEY = "#4A4A4C";
const KB_KEY_TEXT = GM.textInverse;
const FONT = GM.fontSans;

/* ─── emoji constants ─── */
const HEART_EYES = String.fromCodePoint(0x1f60d);
const DOG_FACE = String.fromCodePoint(0x1f436);
const RED_HEART = String.fromCodePoint(0x2764, 0xfe0f);
const PARTY = String.fromCodePoint(0x1f973);
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
  /* GM desktop browser */
  gmOpacity: number;
  gmY: number;
  gmScale: number;
  gmPanX: number;
  gmPanY: number;
  gmDropdownOpen: number;
  gmRow1: number;
  gmRow2: number;
  gmCheckmark: number;
  gmGlowAngle: number;
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
    /* Phone enters from bottom-right with dramatic arc — reference shows
       phone off-screen at 35s, corner visible at 36s, settled by 37s. */
    phoneX: 400, phoneY: 500, phoneRotation: 8, phoneOpacity: 0, phoneScale: 1.3,
    butTextOpacity: 0,
    introOpacity: 0, introScale: 0.88, introClipRight: 100,
    gmOpacity: 0, gmY: 300, gmScale: 1.0, gmPanX: 0, gmPanY: 0,
    gmDropdownOpen: 0, gmRow1: 0, gmRow2: 0, gmCheckmark: 0, gmGlowAngle: 0,
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

    /* ═══ Phase 1: Dramatic entrance arc from bottom-right.
       Reference: phone off-screen at 35s, corner visible at 36s (~f40),
       fully settled by 37s (~f70). ═══ */

    /* Fade in during entrance */
    t.to(s, { phoneOpacity: 1, duration: sec(8), ease: "power2.out" }, 0);

    /* Entrance: bottom-right → center. Simple .to() — no onUpdate bezier
       (onUpdate doesn't fire on seek-past, leaving position stuck). */
    t.to(s, { phoneX: 0, phoneY: 0, duration: sec(35), ease: "power3.out" }, 0);
    t.to(s, { phoneRotation: 0, duration: sec(35), ease: "power3.out" }, 0);

    /* Phone scale — now driven by Remotion interpolate keyframes (motionScale).
       GSAP phoneScale set to 1.0 so it's inert in the wrapper transform. */
    t.to(s, { phoneScale: 1.0, duration: 0 }, 0);

    /* ═══ Phone exit — fly far left ═══ */
    const exitStart = sec(PHASE.TRANSITION_TEXT.start);
    t.to(s, { phoneX: -850, phoneY: 20, duration: sec(16), ease: "power3.in" }, exitStart);
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
    /* Intro holds, then crossfades WITH GM rising — reference shows overlap */
    t.to(s, { introOpacity: 0, duration: sec(8), ease: "power2.in" }, sec(PHASE.GM_UI.start - 4));

    /* ═══ GM Desktop Browser UI ═══ */
    /* Browser starts rising 5 frames early to overlap with fading "Introducing" */
    const gemStart = sec(PHASE.GM_UI.start);
    const gemRise = sec(PHASE.GM_UI.start - 5);
    t.to(s, { gmOpacity: 1, duration: sec(6), ease: "power2.out" }, gemRise);
    t.to(s, { gmY: 0, duration: sec(18), ease: "expo.out" }, gemRise);
    /* Zoom into dropdown area — keep "GM" title visible, hide rainbow border.
       Reference: zoom centers on dropdown card, not on browser edge.
       panX less extreme to avoid exposing right-side rainbow border. */
    t.to(s, { gmScale: 2.4, duration: sec(46), ease: "power2.in" }, gemStart);
    t.to(s, { gmPanX: -180, duration: sec(46), ease: "power2.in" }, gemStart);
    t.to(s, { gmPanY: 160, duration: sec(46), ease: "power2.in" }, gemStart);
    /* Dropdown animation */
    t.to(s, { gmDropdownOpen: 1, duration: sec(12), ease: "back.out(1.5)" }, sec(PHASE.GM_UI.start + 8));
    t.to(s, { gmRow1: 1, duration: sec(8), ease: "power2.out" }, sec(PHASE.GM_UI.start + 12));
    t.to(s, { gmRow2: 1, duration: sec(8), ease: "power2.out" }, sec(PHASE.GM_UI.start + 18));
    t.to(s, { gmCheckmark: 1, duration: sec(6), ease: "back.out(2)" }, sec(PHASE.GM_UI.start + 16));
    /* Glow rotation */
    t.to(s, { gmGlowAngle: 360, duration: sec(46), ease: "none" }, gemStart);

    /* ═══ Dark ending — removed. FadeWrapper now handles the zoom-out
       exit with scaleOut=3 over 24 frames. Keeping internal darkening
       killed the zoom (zooming into blackness is invisible). ═══ */

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
      background: GM.textInverse, fontFamily: FONT,
    }}>
      {/* GM Header Bar */}
      <div style={{height:56,backgroundColor:GM.textInverse,borderBottom:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:36,height:36,backgroundColor:"#000",borderRadius:4,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:6}}>
            {[0,1,2].map(j=><div key={j} style={{width:20,height:2.5,backgroundColor:GM.bgPage,borderRadius:1}} />)}
          </div>
          <span style={{fontSize:19,fontWeight:900,letterSpacing:"-0.03em",color:GM.textPrimary}}>General Market</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:3,backgroundColor:GM.greenStatus}} />
          <div style={{fontSize:12,fontWeight:600,border:`1px solid ${GM.borderMedium}`,borderRadius:6,padding:"4px 12px",color:GM.textPrimary}}>Connect</div>
        </div>
      </div>
      {/* Tab Strip */}
      <div style={{display:"flex",borderBottom:`1px solid ${GM.borderLight}`}}>
        {["Markets","Portfolio","Vision","Create"].map((tab,ti)=>(
          <div key={ti} style={{flex:1,textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:ti===1?600:500,color:ti===1?GM.textPrimary:GM.textSecondary,borderBottom:ti===1?`2px solid ${GM.textPrimary}`:"2px solid transparent",fontFamily:FONT}}>{tab}</div>
        ))}
      </div>
      {/* Portfolio Content */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",color:GM.textMuted,marginBottom:4}}>Portfolio</div>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.03em",color:GM.textPrimary,fontFamily:GM.fontMono}}>$12,847.32</div>
        <div style={{fontSize:13,color:GM.greenStatus,fontFamily:GM.fontMono,marginTop:2}}>+$847.32 (+7.05%)</div>
        {/* Mini area chart */}
        <svg width="100%" height={120} viewBox="0 0 280 120" style={{marginTop:8}}>
          <defs><linearGradient id="chartGrad04dog" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3}/><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02}/></linearGradient></defs>
          <path d="M0 90 Q30 85,60 70 Q90 55,120 60 Q150 50,180 35 Q210 25,240 30 Q260 28,280 20 L280 120 L0 120Z" fill="url(#chartGrad04dog)"/>
          <path d="M0 90 Q30 85,60 70 Q90 55,120 60 Q150 50,180 35 Q210 25,240 30 Q260 28,280 20" fill="none" stroke="#3B82F6" strokeWidth={2}/>
        </svg>
      </div>
      {/* Holdings */}
      {[
        {name:"DeFi Blue Chip ITP",shares:"4.2 shares",value:"$3,420.15",change:"+12.4%",up:true},
        {name:"AI Narrative ITP",shares:"2.8 shares",value:"$2,103.40",change:"+8.7%",up:true},
        {name:"L1 Leaders ITP",shares:"6.1 shares",value:"$4,892.00",change:"-2.1%",up:false},
        {name:"Memecoin Index",shares:"10.0 shares",value:"$2,431.77",change:"+22.3%",up:true},
      ].map((row,ri)=>(
        <div key={ri} style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${GM.borderLight}`,padding:"10px 16px"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:GM.textPrimary}}>{row.name}</div>
            <div style={{fontSize:12,fontFamily:GM.fontMono,color:GM.textMuted}}>{row.shares}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontFamily:GM.fontMono,color:GM.textPrimary}}>{row.value}</div>
            <div style={{fontSize:12,fontFamily:GM.fontMono,color:row.up?GM.greenStatus:GM.redStatus}}>{row.change}</div>
          </div>
        </div>
      ))}
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
  const fullText = "Rebalance portfolio...";
  const visibleChars = Math.floor(typingProgress * fullText.length);
  const typedText = fullText.slice(0, visibleChars);
  const showCursor = frame % 16 < 10 && frame < 65;

  const cardSpring = spring({ frame: frame - 8, fps, config: { damping: 9, stiffness: 100, mass: 0.6 } });
  const cardY = interpolate(cardSpring, [0, 1], [20, 0]);
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: FONT }}>
      {/* GM Header Bar */}
      <div style={{height:56,backgroundColor:GM.textInverse,borderBottom:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:36,height:36,backgroundColor:"#000",borderRadius:4,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:6}}>
            {[0,1,2].map(j=><div key={j} style={{width:20,height:2.5,backgroundColor:GM.bgPage,borderRadius:1}} />)}
          </div>
          <span style={{fontSize:19,fontWeight:900,letterSpacing:"-0.03em",color:GM.textPrimary}}>General Market</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:3,backgroundColor:GM.greenStatus}} />
          <div style={{fontSize:12,fontWeight:600,border:`1px solid ${GM.borderMedium}`,borderRadius:6,padding:"4px 12px",color:GM.textPrimary}}>Connect</div>
        </div>
      </div>
      {/* Tab Strip */}
      <div style={{display:"flex",borderBottom:`1px solid ${GM.borderLight}`}}>
        {["Markets","Portfolio","Vision","Create"].map((tab,ti)=>(
          <div key={ti} style={{flex:1,textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:ti===3?600:500,color:ti===3?GM.textPrimary:GM.textSecondary,borderBottom:ti===3?`2px solid ${GM.textPrimary}`:"2px solid transparent",fontFamily:FONT}}>{tab}</div>
        ))}
      </div>
      {/* Input field */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ height: 40, backgroundColor: "#F4F4F5", border: `1px solid ${GM.borderMedium}`, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 13, color: GM.textMuted, fontFamily: FONT }}>
          {typedText || "Rebalance portfolio..."}
          {showCursor && <span style={{ color: GM_GREEN, fontWeight: 300 }}>|</span>}
        </div>
      </div>
      {/* Recent action card */}
      <div style={{ padding: "0 16px", flex: 1, opacity: cardSpring, transform: `translateY(${cardY}px) scale(${cardScale})`, transformOrigin: "top left" }}>
        <div style={{ border: `1px solid ${GM.borderLight}`, borderRadius: 6, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width={16} height={16} viewBox="0 0 16 16"><circle cx={8} cy={8} r={7} fill={GM.greenStatus}/><path d="M5 8l2 2 4-4" stroke={GM.textInverse} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: DARK_TEXT }}>Portfolio rebalanced</span>
          </div>
          <div style={{ fontSize: 12, color: GREY_TEXT, lineHeight: 1.5, marginBottom: 8 }}>
            BTC 40%, ETH 30%, SOL 15%, AVAX 10%, LINK 5%
          </div>
          <div style={{ fontSize: 12, fontFamily: GM.fontMono, color: GM.greenStatus }}>
            Estimated APY: 12.4%
          </div>
        </div>
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
          <div style={{ width: 44, height: 22, borderRadius: 4, background: GM_GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: GM.textInverse }}>return</div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   AI RESPONSE UI
   ═══════════════════════════════════════════════════════ */
const AIResponseUI: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const responseBubbleSpring = spring({ frame, fps, config: { damping: 7, stiffness: 100, mass: 0.6 } });
  const responseBubbleY = interpolate(responseBubbleSpring, [0, 1], [28, 0]);
  const responseBubbleScale = interpolate(responseBubbleSpring, [0, 1], [0.9, 1]);
  const btnSpring = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 120, mass: 0.5 } });

  const allocations = [
    { asset: "BTC", pct: "40%", value: "$5,138.93" },
    { asset: "ETH", pct: "30%", value: "$3,854.20" },
    { asset: "SOL", pct: "15%", value: "$1,927.10" },
    { asset: "AVAX", pct: "10%", value: "$1,284.73" },
    { asset: "LINK", pct: "5%", value: "$642.36" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: PHONE_BG, fontFamily: FONT }}>
      {/* GM Header Bar */}
      <div style={{height:56,backgroundColor:GM.textInverse,borderBottom:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:36,height:36,backgroundColor:"#000",borderRadius:4,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:6}}>
            {[0,1,2].map(j=><div key={j} style={{width:20,height:2.5,backgroundColor:GM.bgPage,borderRadius:1}} />)}
          </div>
          <span style={{fontSize:19,fontWeight:900,letterSpacing:"-0.03em",color:GM.textPrimary}}>General Market</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:3,backgroundColor:GM.greenStatus}} />
          <div style={{fontSize:12,fontWeight:600,border:`1px solid ${GM.borderMedium}`,borderRadius:6,padding:"4px 12px",color:GM.textPrimary}}>Connect</div>
        </div>
      </div>
      {/* Tab Strip */}
      <div style={{display:"flex",borderBottom:`1px solid ${GM.borderLight}`}}>
        {["Markets","Portfolio","Vision","Create"].map((tab,ti)=>(
          <div key={ti} style={{flex:1,textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:ti===3?600:500,color:ti===3?GM.textPrimary:GM.textSecondary,borderBottom:ti===3?`2px solid ${GM.textPrimary}`:"2px solid transparent",fontFamily:FONT}}>{tab}</div>
        ))}
      </div>
      {/* Response card */}
      <div style={{ flex: 1, padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          border: `1px solid ${GM.borderLight}`, borderRadius: 6, padding: 16,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          opacity: responseBubbleSpring,
          transform: `translateY(${responseBubbleY}px) scale(${responseBubbleScale})`,
          transformOrigin: "top left",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK_TEXT, marginBottom: 12 }}>Rebalance Complete</div>
          {/* Allocation table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${GM.borderLight}`, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: GM.textMuted, flex: 1 }}>Asset</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: GM.textMuted, width: 40, textAlign: "right" }}>%</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: GM.textMuted, width: 72, textAlign: "right" }}>Value</span>
            </div>
            {allocations.map((a, ai) => (
              <div key={ai} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: DARK_TEXT, fontFamily: GM.fontMono, flex: 1 }}>{a.asset}</span>
                <span style={{ fontSize: 12, color: GREY_TEXT, fontFamily: GM.fontMono, width: 40, textAlign: "right" }}>{a.pct}</span>
                <span style={{ fontSize: 12, color: DARK_TEXT, fontFamily: GM.fontMono, width: 72, textAlign: "right" }}>{a.value}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Execute button */}
        <div style={{
          height: 40, backgroundColor: GM.greenStatus, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 600, color: GM.textInverse,
          opacity: btnSpring,
          transform: `translateY(${interpolate(btnSpring, [0, 1], [10, 0])}px)`,
        }}>
          Execute Trade
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   4-POINT SPARKLE SVG — proper GM sparkle icon
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
        fill={useGrad ? `url(#${gradientId})` : (color || GM_GREEN)}
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
      /* Green gradient border via padding trick — thicker + glow */
      background: `linear-gradient(${gradAngle}deg, ${GM.green} 0%, ${GM.greenDark} 33%, ${GM.greenStatus} 66%, ${GM.green} 100%)`,
      padding: 3,
      boxShadow: `0 20px 80px rgba(0,0,0,0.10), 0 4px 20px rgba(0,0,0,0.06), 0 0 30px rgba(0,163,108,0.12), 0 0 60px rgba(0,138,90,0.08)`,
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
          background: "radial-gradient(circle, rgba(0,163,108,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {children}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   GM DROPDOWN UI — DESKTOP style
   Reference: hamburger menu, "GM" title with
   dropdown arrow, dropdown card with two rows:
   - GM: green sparkle + checkmark circle
   - GM Pro: green sparkle + "Upgrade" btn
   Grey "+" button on left, search bar at bottom.
   ═══════════════════════════════════════════════════════ */
const GMDesktopUI: React.FC<{
  dropdownOpen: number;
  row1: number;
  row2: number;
  checkmark: number;
}> = ({ dropdownOpen, row1, row2, checkmark }) => {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAFBFF",
      fontFamily: FONT,
      position: "relative",
    }}>
      {/* Top bar — hamburger + "GM" dropdown title */}
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
        {/* "GM" title + dropdown arrow */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 22, color: DARK_TEXT, fontWeight: 400,
          letterSpacing: -0.3,
        }}>
          <span>GM</span>
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
        {/* Row 1: GM with green sparkle + checkmark */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          opacity: row1,
          transform: `translateX(${interpolate(row1, [0, 1], [-8, 0])}px)`,
          background: row1 > 0.5 ? "rgba(0,163,108,0.04)" : "transparent",
        }}>
          <SparkleIcon size={22} color={GM_GREEN} />
          <div style={{
            fontSize: 17, color: DARK_TEXT, fontWeight: 400,
            flex: 1, letterSpacing: -0.2,
          }}>GM</div>
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

        {/* Row 2: GM Pro with gradient sparkle + "Upgrade" button */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px",
          opacity: row2,
          transform: `translateX(${interpolate(row2, [0, 1], [-8, 0])}px)`,
        }}>
          <SparkleIcon
            size={22}
            gradientId="advancedSparkle"
            gradientColors={[GM_GREEN, GM_DARK_GREEN]}
          />
          <div style={{
            fontSize: 17, color: DARK_TEXT, fontWeight: 400,
            flex: 1, letterSpacing: -0.2, whiteSpace: "nowrap",
          }}>GM Pro</div>
          <div style={{
            background: DARK_TEXT, color: GM.textInverse,
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
        <div style={{ fontSize: 15, color: "#9AA0A6", flex: 1 }}>Ask GM</div>
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
  const phoneTilt3D = useFloat3D(frame, fps, TILT_PRESETS.phoneFloat);

  /* ── Phase visibility ── */
  const showDogPhoto = frame < PHASE.DOG_PHOTO.end;
  const showChat = frame >= PHASE.DOG_PHOTO.end && frame < PHASE.PHOTO_EXPAND.start;
  const showPhotoExpand = frame >= PHASE.PHOTO_EXPAND.start && frame < PHASE.AI_RESPONSE.start;
  const showAIResponse = frame >= PHASE.AI_RESPONSE.start && frame < PHASE.GM_UI.start;
  const showGMUI = frame >= PHASE.GM_UI.start;
  const showEmojis = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.TRANSITION_TEXT.start;
  const showButText = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.INTRODUCING.start + 15;
  const showIntro = frame >= PHASE.INTRODUCING.start && frame < PHASE.GM_UI.start;

  /* Photo expand progress */
  const photoExpandProgress = interpolate(frame, [PHASE.PHOTO_EXPAND.start, PHASE.PHOTO_EXPAND.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* ── Precise motion track: phone camera/chat/response sequence ──
   * Frame-by-frame extraction from reference (0:38-0:48).
   * Phone gradually flattens as user reads content, NEVER fully flat.
   * Minimum 3deg tilt at all times.
   *
   * Keyframes:
   *   f0   (entrance):  scale=1.2, rotateY=-15°, rotateX=5°  — dog photo, camera UI
   *   f60  (2s):        scale=1.3, rotateY=-12°, rotateX=5°  — typing "Creat|", keyboard
   *   f120 (4s):        scale=1.5, rotateY=-10°, rotateX=4°  — zoomed into prompt
   *   f180 (6s):        scale=1.4, rotateY=-8°,  rotateX=3°  — AI response appears
   *   f240 (8s):        scale=1.0, rotateY=-3°,  rotateX=1°  — full response + emojis, nearly flat
   *   f300 (exit):      scale=0.9, rotateY=-45°, rotateX=5°  — dramatic edge-on exit
   */
  const motionScale = interpolate(frame,
    [0, 60, 120, 180, 240, 300],
    [1.3, 1.4, 1.5, 1.4, 1.1, 0.9],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const phoneTilt = interpolate(frame,
    [0, 60, 120, 180, 240, 300],
    [-15, -12, -10, -8, -3, -45],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const phoneXTilt = interpolate(frame,
    [0, 60, 120, 180, 240, 300],
    [5, 5, 4, 3, 1, 5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* Noise-based background */
  const bgX1 = 40 + noise2D("bgX", frame * 0.005, 0) * 12;
  const bgY1 = 40 + noise2D("bgY", frame * 0.005, 1) * 10;
  const bgX2 = 70 + noise2D("bg2X", frame * 0.004, 2) * 8;
  const bgY2 = 60 + noise2D("bg2Y", frame * 0.004, 3) * 6;

  /* GM local frame */
  const gmLocalFrame = Math.max(0, frame - (PHASE.GM_UI.start - 10));

  /* Introducing glow effects */
  const introLocal = frame - PHASE.INTRODUCING.start;
  const glowBreath = 0.4 + Math.sin(Math.max(0, introLocal) * 0.18) * 0.15;
  const glowBreath2 = 0.25 + Math.sin(Math.max(0, introLocal) * 0.14 + 1.5) * 0.1;
  const glowX = interpolate(s.introClipRight, [0, 100], [0, -280]);
  const sweepEdgeX = interpolate(s.introClipRight, [0, 100], [320, -320]);
  const introWobX = noise2D("intx", frame * 0.02, 0) * 3;
  const introWobY = noise2D("inty", 0, frame * 0.02) * 2;

  /* GM noise wobble */
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
        {frame < PHASE.GM_UI.start && (() => {
          const phoneIsExiting = frame >= PHASE.TRANSITION_TEXT.start && frame < PHASE.TRANSITION_TEXT.start + 12;
          const emojiBursting = frame >= PHASE.EMOJI_BURST.start && frame < PHASE.EMOJI_BURST.start + 12;
          const needsBlur = phoneIsExiting || emojiBursting;
          /* Phone3D screen content — all phases layered, each sub-component has its own GM header */
          const phoneScreenContent = (
            <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: PHONE_BG }}>
              {/* Portfolio screen */}
              {showDogPhoto && <DogPhotoScreen />}
              {/* Chat/Prompt screen */}
              {showChat && <ChatUI frame={frame - PHASE.DOG_PHOTO.end} fps={fps} />}
              {/* Photo expand — transition to green chart view */}
              {showPhotoExpand && (
                <div style={{
                  width: "100%", height: "100%",
                  background: `linear-gradient(145deg, ${GM_GREEN} 0%, ${GM_DARK_GREEN} 50%, ${GM.greenStatus} 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: interpolate(photoExpandProgress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, transparent 20%, rgba(0,0,0,0.08) 80%)" }} />
                  <div style={{ fontSize: 22, fontWeight: 700, color: GM.textInverse, fontFamily: FONT, textAlign: "center" }}>
                    <div>Portfolio</div>
                    <div style={{ fontSize: 40, fontFamily: GM.fontMono, marginTop: 8, transform: `scale(${interpolate(photoExpandProgress, [0.5, 1], [1, 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }}>$12,847</div>
                  </div>
                </div>
              )}
              {/* AI Response screen */}
              {showAIResponse && <AIResponseUI frame={frame - PHASE.AI_RESPONSE.start} fps={fps} />}
            </div>
          );
          /* Convert degree tilts to radians for Phone3D */
          const tiltYRad = (phoneTilt * Math.PI) / 180;
          const tiltXRad = (phoneXTilt * Math.PI) / 180;
          const content = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.phoneOpacity,
            }}>
              <Phone3D
                rotateY={tiltYRad}
                rotateX={tiltXRad}
                scale={motionScale}
                width={340}
                height={700}
                screenContent={phoneScreenContent}
                style={{transform: `translate(${s.phoneX}px, ${s.phoneY}px) ${phoneTilt3D.transform}`}}
              />
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
              fontFamily: FONT,
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
                color: GM_GREEN,
                opacity: s.allOpacity,
                transform: `translate(${s.allX}px, ${s.allY}px)`,
              }}>all</span>
              <span style={{ display: "inline-flex", gap: 2, marginLeft: -2, alignItems: "baseline" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    color: i === 0 ? GM_GREEN : i === 1 ? GM_DARK_GREEN : GM.greenStatus,
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
            display: "flex", alignItems: "center", justifyContent: "center",
            paddingBottom: 80,
            opacity: s.introOpacity,
            transform: `scale(${s.introScale}) translate(${introWobX}px, ${introWobY}px)`,
            zIndex: 10,
          }}>
            {/* Subtle glow — much less prominent than before */}
            <div style={{
              position: "absolute", width: 500, height: 160,
              background: `radial-gradient(ellipse at 50% 50%, rgba(200,190,220,${glowBreath * 0.3}) 0%, transparent 60%)`,
              filter: "blur(40px)",
            }} />
            <div style={{ position: "relative" }}>
              <div style={{
                fontSize: 56,
                fontFamily: FONT,
                fontWeight: 400, letterSpacing: -0.5, textAlign: "center", whiteSpace: "nowrap",
                color: GREY_TEXT,
              }}>Introducing</div>
              {/* Gradient reveal — subtle, matching reference's slight color */}
              <div style={{
                fontSize: 56,
                fontFamily: FONT,
                fontWeight: 400, letterSpacing: -0.5, textAlign: "center", whiteSpace: "nowrap",
                position: "absolute", inset: 0,
                background: `linear-gradient(90deg, #5F6368 0%, ${GM_GREEN} 40%, ${GM_DARK_GREEN} 60%, #5F6368 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                clipPath: `inset(0 ${s.introClipRight}% 0 0)`,
              }}>Introducing</div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            GM UI — DESKTOP BROWSER with rainbow border
            Zoomed into top-left corner
            ════════════════════════════════════════════════ */}
        {showGMUI && (() => {
          const gmContent = (
            <div style={{
              position: "absolute", inset: 0,
              opacity: s.gmOpacity,
              transform: `translateY(${s.gmY}px) translate(${gemWobX}px, ${gemWobY}px)`,
            }}>
              <DesktopBrowserFrame
                scale={s.gmScale}
                x={s.gmPanX}
                y={s.gmPanY}
                glowAngle={s.gmGlowAngle}
              >
                <GMDesktopUI
                  dropdownOpen={s.gmDropdownOpen}
                  row1={s.gmRow1}
                  row2={s.gmRow2}
                  checkmark={s.gmCheckmark}
                />
              </DesktopBrowserFrame>
            </div>
          );
          if (gmLocalFrame > 0 && gmLocalFrame < 10) {
            return (
              <CameraMotionBlur samples={5} shutterAngle={90}>
                {gmContent}
              </CameraMotionBlur>
            );
          }
          return gmContent;
        })()}

        {/* Dark overlay for scene end */}
        {s.fadeToBlack > 0 && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: s.fadeToBlack }} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/* Suppress noUnusedLocals for constants preserved from original composition */
void USER_BUBBLE; void AI_BUBBLE; void MIC; void CAMERA; void CLIP; void ARROW_LEFT; void PLAY;

export const scene04Meta = {
  id: "GMScene04",
  component: Scene04,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 390,
};
