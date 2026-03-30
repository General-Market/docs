import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Phone3D } from "../../lib/Phone3D";
import { useFloat3D, TILT_PRESETS } from "../../lib/tilt3d";
import { GM, SourceLogos } from "./theme";

/* --- bezier / motion helpers --- */
function cubicBez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}


function organicWobble(seed: string, frame: number, ax = 3, ay = 2, speed = 0.02) {
  return {
    x: noise2D(seed + "wx", frame * speed, 0) * ax,
    y: noise2D(seed + "wy", 0, frame * speed) * ay,
    rot: noise2D(seed + "wr", frame * speed * 0.7, 0.5) * 1.5,
  };
}

/* --- palette (GM brand) --- */
const PINK = GM.red;          /* accent red */
const PURPLE = GM.greenDark;  /* dark green */
const BLUE = GM.green;        /* primary green */
const LAVENDER = GM.greenLight; /* light green bg */
const BG = GM.bgSurface;
const BG_WARM = GM.bgPage;
const DARK = GM.textPrimary;

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_OUT_QUART = Easing.bezier(0.25, 1, 0.5, 1);
const EASE_IN_QUART = Easing.bezier(0.5, 0, 0.75, 0);

/* --- Avalanche bokeh particle data --- */
interface BokehParticle {
  id: number; startX: number; startY: number; size: number;
  color: string; speed: number; yDrift: number; delay: number; blur: number;
  opacity: number;
}

function generateBokehParticles(count: number, seed: number): BokehParticle[] {
  const rng = seededRandom(seed);
  const colors = [
    GM.green,GM.greenDark,GM.green,GM.greenLight,GM.red,GM.redStatus,
    GM.textInverse,GM.green,GM.greenDark,GM.greenLight,GM.green,GM.greenDark,
  ];
  return Array.from({length: count}, (_, i) => ({
    id: i,
    startX: 1300 + rng()*400, /* start just off-screen right, tighter spread */
    startY: -40 + rng()*800, /* extend past vertical edges for density */
    size: 8 + rng()*22, /* 8-30px bokeh spheres */
    color: colors[Math.floor(rng()*colors.length)],
    speed: 350 + rng()*600, /* px per second streaming left */
    yDrift: (rng()-0.5)*140, /* vertical wander */
    delay: rng()*18, /* stagger entry over ~0.6s for fast density */
    blur: 2 + rng()*6, /* bokeh blur amount */
    opacity: 0.25 + rng()*0.65,
  }));
}

/* --- SEGMENT 1: Particle Avalanche (Bard→Gemini transition) --- */
const AVALANCHE_COUNT = 220;

const SegParticleAvalancheInner: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const bokeh = useMemo(() => generateBokehParticles(AVALANCHE_COUNT, 42), []);

  /* Orange/warm center glow */
  const glowIntensity = interpolate(frame, [0,8,fps*0.4,durationInFrames-10,durationInFrames], [0,0.7,1,1,0], {extrapolateRight:"clamp"});
  /* Global fade in/out */
  const globalOp = interpolate(frame, [0,4,durationInFrames-6,durationInFrames], [0,1,1,0], {extrapolateRight:"clamp"});

  return (
    <AbsoluteFill style={{backgroundColor:"#1A1520",opacity:globalOp}}>
      {/* Warm orange center glow — like a light source the particles stream through */}
      <div style={{position:"absolute",left:"50%",top:"50%",width:600,height:500,transform:"translate(-50%,-50%)",background:"radial-gradient(ellipse, rgba(255,160,60,0.3) 0%, rgba(255,120,40,0.15) 25%, rgba(200,80,60,0.06) 50%, transparent 70%)",opacity:glowIntensity,filter:"blur(20px)"}} />
      <div style={{position:"absolute",left:"50%",top:"50%",width:350,height:300,transform:"translate(-50%,-50%)",background:"radial-gradient(circle, rgba(255,200,100,0.25) 0%, transparent 60%)",opacity:glowIntensity,filter:"blur(12px)"}} />

      {/* Bokeh particle field — streaming right to left like a blizzard */}
      {bokeh.map((p) => {
        const t = Math.max(0, frame - p.delay) / fps;
        if (t <= 0) return null;
        const px = p.startX - p.speed*t;
        const yNoise = noise2D("ay"+p.id, t*0.6, p.id*0.1)*40;
        const py = p.startY + Math.sin(t*1.2 + p.id)*p.yDrift*0.3 + yNoise;
        /* Fade in quickly, sustain, no fade-out (they exit left) */
        const fadeIn = interpolate(t, [0,0.15], [0,1], {extrapolateRight:"clamp"});
        /* Kill if off-screen left */
        if (px < -60) return null;
        const sizeOsc = p.size * (0.9 + 0.1*Math.sin(t*3+p.id));
        return <div key={p.id} style={{
          position:"absolute",
          left: px - sizeOsc/2,
          top: py - sizeOsc/2,
          width: sizeOsc,
          height: sizeOsc,
          borderRadius: "50%",
          backgroundColor: p.color,
          opacity: p.opacity * fadeIn,
          filter: `blur(${p.blur}px)`,
          boxShadow: `0 0 ${p.size*0.8}px ${p.color}88`,
        }} />;
      })}
    </AbsoluteFill>
  );
};

const SegParticleExplosion: React.FC = () => (
  <CameraMotionBlur samples={6} shutterAngle={160}>
    <SegParticleAvalancheInner />
  </CameraMotionBlur>
);

/* --- SEGMENT 2: GM Reveal --- */
/* --- Percentage ticker particles for GM reveal --- */
interface PctParticle {
  id: number; x: number; y: number; label: string; color: string;
  fontSize: number; opacity: number; noiseOffX: number; noiseOffY: number;
  driftAngle: number; driftSpeed: number;
}

function generatePctParticles(count: number, seed: number): PctParticle[] {
  const rng = seededRandom(seed);
  return Array.from({length: count}, (_, i) => {
    const r1 = rng(); const r2 = rng(); const r3 = rng();
    const r4 = rng(); const r5 = rng(); const r6 = rng(); const r7 = rng();
    const isPositive = r1 > 0.2;
    const value = (r2 * 25).toFixed(1);
    const label = isPositive ? `+${value}%` : `-${value}%`;
    const color = isPositive ? GM.greenStatus : GM.redStatus;
    // Sizes: 70% tiny 8-10, 22% medium 12-14, 8% large 16-18
    let fontSize: number;
    if (r3 < 0.70) fontSize = 8 + r4 * 2;
    else if (r3 < 0.92) fontSize = 12 + r4 * 2;
    else fontSize = 16 + r4 * 2;
    return {
      id: i, x: r5 * 1280, y: r6 * 720,
      label, color, fontSize,
      opacity: 0.2 + r7 * 0.6,
      noiseOffX: rng() * 1000, noiseOffY: rng() * 1000,
      driftAngle: rng() * Math.PI * 2,
      driftSpeed: 0.3 + rng() * 1.5,
    };
  });
}

const PctParticleField: React.FC<{frame: number; fps: number; particles: PctParticle[]}> = ({frame, fps, particles}) => (
  <>
    {particles.map((p) => {
      const t = frame / fps;
      const nx = noise2D("pctx"+p.id, t*0.4+p.noiseOffX, 0) * 30;
      const ny = noise2D("pcty"+p.id, 0, t*0.4+p.noiseOffY) * 30;
      const drift = t * p.driftSpeed * 18;
      const px = p.x + Math.cos(p.driftAngle) * drift + nx;
      const py = p.y + Math.sin(p.driftAngle) * drift * 0.5 - drift * 0.3 + ny;
      // wrap vertically so they don't all vanish
      const wrappedY = ((py % 820) + 820) % 820 - 50;
      const wrappedX = ((px % 1380) + 1380) % 1380 - 50;
      const fadeIn = interpolate(frame, [0, fps*0.4], [0, 1], {extrapolateRight:"clamp"});
      const fadeOut = interpolate(frame, [fps*1.2, fps*1.6], [1, 0], {extrapolateRight:"clamp"});
      const op = p.opacity * fadeIn * fadeOut;
      if (op <= 0.01) return null;
      return (
        <span key={p.id} style={{
          position:"absolute", left: wrappedX, top: wrappedY,
          fontSize: p.fontSize, fontFamily: GM.fontMono, fontWeight: 600,
          color: p.color, opacity: op, whiteSpace: "nowrap",
          userSelect: "none", pointerEvents: "none",
        }}>{p.label}</span>
      );
    })}
  </>
);

const GEMINI_LETTERS = "GM".split("");
const LETTER_ARC_ANGLES = [-0.9,0.3];
const LETTER_ARC_DIST = [60,55];

/* Burst particles — "+X%" text that EXPLODES from center when GM appears */
interface BurstPct { id: number; label: string; color: string; angle: number; dist: number; fontSize: number; delay: number; }
function generateBurstPcts(count: number, seed: number): BurstPct[] {
  const rng = seededRandom(seed);
  return Array.from({length: count}, (_, i) => {
    const r1 = rng();
    const r2 = rng();
    const r3 = rng();
    const r4 = rng();
    const isPos = r1 > 0.2;
    const val = (r2 * 25).toFixed(1);
    const label = isPos ? `+${val}%` : `-${val}%`;
    const color = isPos ? GM.greenStatus : GM.redStatus;
    const angle = (i / count) * Math.PI * 2 + (r3 - 0.5) * 0.6;
    const dist = 200 + r4 * 400;
    const fontSize = r3 < 0.6 ? 9 : r3 < 0.85 ? 12 : 16;
    const delay = Math.floor(r4 * 8);
    return { id: i, label, color, angle, dist, fontSize, delay };
  });
}

const SegGMReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pctParticles = useMemo(() => generatePctParticles(100, 99), []);
  const burstPcts = useMemo(() => generateBurstPcts(60, 42), []);

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      {/* Background floating +X% */}
      <div style={{opacity: interpolate(frame, [0,fps*2], [0.6,0], {extrapolateRight:"clamp"})}}>
        <PctParticleField frame={frame} fps={fps} particles={pctParticles} />
      </div>
      {/* Burst +X% particles exploding from center */}
      {burstPcts.map((bp) => {
        const burstStart = 4 + bp.delay; // starts just as GM appears
        const burstProg = interpolate(frame, [burstStart, burstStart + 25], [0, 1], {extrapolateLeft:"clamp", extrapolateRight:"clamp"});
        if (burstProg <= 0) return null;
        const eased = 1 - Math.pow(1 - burstProg, 2.5); // expo out
        const bx = 640 + Math.cos(bp.angle) * bp.dist * eased;
        const by = 360 + Math.sin(bp.angle) * bp.dist * eased;
        const bOp = interpolate(burstProg, [0, 0.15, 0.7, 1], [0, 1, 0.8, 0], {extrapolateRight:"clamp"});
        return (
          <span key={`burst-${bp.id}`} style={{
            position:"absolute", left: bx, top: by,
            fontSize: bp.fontSize, fontFamily: GM.fontMono, fontWeight: 700,
            color: bp.color, opacity: bOp, whiteSpace: "nowrap",
            transform: `translate(-50%,-50%) scale(${interpolate(burstProg, [0,0.3], [0.5,1], {extrapolateRight:"clamp"})})`,
          }}>{bp.label}</span>
        );
      })}
      {/* GM text */}
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",alignItems:"baseline",fontSize:72,fontFamily:GM.fontSans,fontWeight:400,letterSpacing:-1}}>
        {GEMINI_LETTERS.map((letter, i) => {
          const wob = organicWobble("gl"+i, frame, 1.5, 1, 0.018);
          const spr = spring({frame, fps, delay: i*3, config:{damping:12,stiffness:120,mass:0.8}});
          const arcX = interpolate(spr, [0,1], [Math.cos(LETTER_ARC_ANGLES[i])*LETTER_ARC_DIST[i], 0]);
          const arcY = interpolate(spr, [0,1], [Math.sin(LETTER_ARC_ANGLES[i])*LETTER_ARC_DIST[i], 0]);
          const sc = interpolate(spr, [0,1], [0.7,1]);
          const op = interpolate(spr, [0,0.3], [0,1], {extrapolateRight:"clamp"});
          return <span key={i} style={{display:"inline-block",background:`linear-gradient(135deg, ${BLUE} 0%, ${PURPLE} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",transform:`translate(${arcX+wob.x}px,${arcY+wob.y}px) scale(${sc})`,opacity:op}}>{letter}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 3: Desktop UI --- */
const SegDesktopUI: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const helloText = "Welcome back.";
  const howText = "What would you like to trade?";
  const helloChars = Math.floor(interpolate(frame, [fps*0.3,fps*0.8], [0,helloText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const howChars = Math.floor(interpolate(frame, [fps*0.9,fps*1.8], [0,howText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  /* 3D entrance: multi-keyframe interpolation matched to reference frames (0:17–0:20).
   *   Starts zoomed ~2.3x at ~22deg rotateY, decelerates to flat 1x.
   *   Reference shows gradual reveal: toolbar → greeting → cards → full view */
  const bRotY = interpolate(frame,
    [0, 10, 20, 35, 50, 65, 80, 95],
    [-22, -18, -14, -10, -7, -4, -2, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const bRotX = interpolate(frame,
    [0, 10, 20, 35, 50, 65, 80, 95],
    [8, 6.5, 5, 4, 3, 2, 1, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const bScale = interpolate(frame,
    [0, 10, 20, 35, 50, 65, 80, 95],
    [2.3, 2.0, 1.7, 1.4, 1.2, 1.1, 1.03, 1.0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const bOp = interpolate(frame, [0, 3], [0, 1], {extrapolateRight:"clamp"});
  const cSpr = [0,1,2,3].map(i => spring({frame, fps, delay: Math.floor(fps*1.5)+i*3, config:{damping:12,stiffness:100,mass:0.8}}));
  const inputOp = interpolate(frame, [fps*2.0,fps*2.5], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const discOp = interpolate(frame, [fps*1.5,fps*2.0], [0,0.6], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const cards = [
    {emoji:"\uD83D\uDCCA",title:"Show me top ITPs",sub:"View performance data"},
    {emoji:"\uD83D\uDCC8",title:"Trending Vision markets",sub:"See what's moving"},
    {emoji:"\uD83D\uDCBC",title:"Build a portfolio",sub:"Custom index creation"},
    {emoji:"\uD83D\uDD04",title:"Rebalance holdings",sub:"Optimize allocations"},
  ];

  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      <div style={{position:"absolute",width:"100%",height:"100%",background:`linear-gradient(135deg, rgba(230,247,240,0.3) 0%, rgba(0,163,108,0.08) 50%, rgba(0,138,90,0.1) 100%)`}} />
      {/* Perspective on PARENT div, preserve-3d on animated child */}
      <div style={{position:"absolute",left:"50%",top:"50%",width:780,height:460,perspective:800,transform:"translate(-50%,-50%)",opacity:bOp}}>
      <div style={{width:"100%",height:"100%",transformStyle:"preserve-3d",transform:`rotateY(${bRotY}deg) rotateX(${bRotX}deg) scale(${bScale})`,borderRadius:18,boxShadow:"0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)"}}>
        <div style={{width:"100%",height:"100%",backgroundColor:GM.bgPage,borderRadius:16,overflow:"hidden",position:"relative"}}>
          {/* Browser chrome — GM web app top bar */}
          <div style={{height:64,backgroundColor:GM.bgPage,borderBottom:`1px solid ${GM.borderLight}`,display:"flex",alignItems:"center",padding:"0 24px"}}>
            {/* Left: GM logo + brand name */}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <svg width="36" height="36" viewBox="0 0 102 102" fill="none">
                <rect width="102" height="102" fill="black"/>
                <rect x="15" y="48" width="15" height="6" rx="3" fill="white"/>
                <rect x="27" y="48" width="15" height="6" rx="3" fill="white"/>
                <rect x="38" y="48" width="15" height="6" rx="3" fill="white"/>
                <rect x="49" y="48" width="15" height="6" rx="3" fill="white"/>
                <rect x="61" y="48" width="9" height="6" rx="3" fill="white"/>
                <rect x="66" y="48" width="15" height="6" rx="3" fill="white"/>
                <rect x="78" y="48" width="9" height="6" rx="3" fill="white"/>
              </svg>
              <span style={{fontSize:22,fontFamily:GM.fontSans,fontWeight:900,color:GM.textPrimary,letterSpacing:"-0.03em"}}>General Market</span>
            </div>
            {/* Center nav */}
            <div style={{flex:1,display:"flex",justifyContent:"center",gap:32}}>
              {["Markets","Portfolio","Vision"].map(n => (
                <span key={n} style={{fontSize:14,fontFamily:GM.fontSans,fontWeight:600,color:GM.textPrimary}}>{n}</span>
              ))}
            </div>
            {/* Right: Connect Wallet */}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:"#22C55E"}} />
              <div style={{border:`2px solid ${GM.textPrimary}`,borderRadius:8,padding:"6px 16px",fontSize:13,fontFamily:GM.fontSans,fontWeight:600,color:GM.textPrimary}}>Connect Wallet</div>
            </div>
          </div>
          {/* Main content area */}
          <div style={{backgroundColor:GM.bgSurface,padding:"44px 60px 30px",display:"flex",flexDirection:"column",alignItems:"center",height:"calc(100% - 64px)",position:"relative"}}>
            <div style={{fontSize:48,fontFamily:GM.fontSans,fontWeight:900,color:GM.textPrimary,letterSpacing:"-0.035em",lineHeight:1.2,marginBottom:8,textAlign:"center"}}>
              {helloText.slice(0, helloChars)}
              {helloChars < helloText.length && <span style={{opacity: frame%20<10?1:0, color: BLUE}}>|</span>}
            </div>
            <div style={{fontSize:20,fontFamily:GM.fontSans,fontWeight:400,color:GM.textSecondary,lineHeight:1.2,marginBottom:32}}>{howText.slice(0, howChars)}</div>
            <div style={{display:"flex",gap:14}}>
              {cards.map((card, i) => {
                const cs = cSpr[i];
                return <div key={i} style={{width:155,backgroundColor:GM.bgPage,border:`1px solid ${GM.borderLight}`,borderRadius:6,padding:"18px 16px",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",transform:`translateY(${interpolate(cs,[0,1],[40,0])}px) scale(${interpolate(cs,[0,1],[0.9,1])})`,opacity:interpolate(cs,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
                  <div style={{fontSize:14,fontFamily:GM.fontSans,fontWeight:600,color:GM.textPrimary,lineHeight:1.3,marginBottom:4}}>{card.emoji} {card.title}</div>
                  <div style={{fontSize:12,fontFamily:GM.fontSans,fontWeight:400,color:GM.textMuted,lineHeight:1.3}}>{card.sub}</div>
                </div>;
              })}
            </div>
            {/* Input bar */}
            <div style={{position:"absolute",bottom:36,left:60,right:60,height:48,backgroundColor:GM.bgPage,border:`1px solid ${GM.borderMedium}`,borderRadius:12,display:"flex",alignItems:"center",padding:"0 20px",fontSize:14,color:GM.textMuted,fontFamily:GM.fontSans,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",opacity:inputOp}}>Enter a prompt here...</div>
            {/* Footer disclaimer */}
            <div style={{position:"absolute",bottom:14,left:0,right:0,textAlign:"center",fontSize:11,fontFamily:GM.fontSans,color:GM.textMuted,opacity:discOp}}>GM may display inaccurate info. Verify on-chain.</div>
          </div>
        </div>
      </div>
      </div>{/* close perspective parent */}
    </AbsoluteFill>
  );
};

/* --- SEGMENT 4: It's everything --- */
const SegItsEverything: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const wob = organicWobble("itsev", frame, 2, 1.5, 0.02);
  const containerOp = interpolate(frame, [0,6,durationInFrames-8,durationInFrames], [0,1,1,0], {extrapolateRight:"clamp"});
  const centerSpr = spring({frame, fps, delay:3, config:{damping:10,stiffness:100,mass:0.6}});
  const scrollY = interpolate(frame, [0,durationInFrames], [0,-40], {extrapolateRight:"clamp",easing:Easing.inOut(Easing.sin)})+wob.y;
  const scrollX = interpolate(frame, [0,durationInFrames], [0,-15], {extrapolateRight:"clamp"})+wob.x;
  /* Reference: large grid that EXTENDS PAST viewport edges. Center word huge (~60px bold).
     Surrounding copies overflow visible. Some copies have purple/pink gradient tint. */
  const gridRows = 7;
  const gridCols = 5;
  const rowSpacing = 80;
  const colSpacing = 360;
  return (
    <AbsoluteFill style={{backgroundColor:BG, overflow:"visible"}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translate(${scrollX}px,${scrollY}px) rotate(${wob.rot*0.2}deg)`,opacity:containerOp,overflow:"visible"}}>
        {Array.from({length:gridRows}, (_,row) => Array.from({length:gridCols}, (_,col) => {
          const cR = Math.floor(gridRows/2);
          const cC = Math.floor(gridCols/2);
          const isCenter = row===cR&&col===cC;
          const dist = Math.sqrt(Math.pow(row-cR,2)+Math.pow(col-cC,2));
          const op = isCenter?1:interpolate(dist,[0,1,2,3.5],[0.45,0.3,0.18,0.07],{extrapolateRight:"clamp"});
          const cW = organicWobble(`ie${row}${col}`, frame, 1+dist*0.4, 0.8+dist*0.3, 0.015);
          const cSpr2 = spring({frame, fps, delay: Math.floor(dist*2)+3, config:{damping:15,stiffness:120,mass:0.5}});
          const cY = isCenter?0:interpolate(cSpr2,[0,1],[20,0]);
          const cOp = isCenter?1:interpolate(cSpr2,[0,0.3],[0,1],{extrapolateRight:"clamp"});
          const cSc = isCenter?interpolate(centerSpr,[0,1],[0,1]):1;
          /* Gradient tint on some nearby copies — purple, pink */
          const hasGradient = isCenter || (dist <= 2 && (row+col)%2===0);
          const hasPurpleTint = !isCenter && !hasGradient && dist <= 2.5 && row%2===0;
          const base: React.CSSProperties = {position:"absolute",left:(col-cC)*colSpacing+cW.x,top:(row-cR)*rowSpacing+cW.y+cY,fontSize:isCenter?60:32,fontWeight:isCenter?700:400,fontFamily:GM.fontSans,opacity:op*cOp,whiteSpace:"nowrap",transform:isCenter?`scale(${cSc})`:`rotate(${cW.rot*0.3}deg)`};
          if (isCenter) return <div key={`${row}-${col}`} style={{...base,background:`linear-gradient(90deg, ${PINK}, ${PURPLE}, ${BLUE})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"Everything you need"}</div>;
          if (hasGradient) return <div key={`${row}-${col}`} style={{...base,background:`linear-gradient(90deg, ${PINK}88, ${PURPLE}66)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"Everything you need"}</div>;
          if (hasPurpleTint) return <div key={`${row}-${col}`} style={{...base,background:`linear-gradient(90deg, ${PURPLE}55, ${LAVENDER}44)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"Everything you need"}</div>;
          return <div key={`${row}-${col}`} style={{...base,color:"#9090A0"}}>{"Everything you need"}</div>;
        }))}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 5: Source logos orbiting "in one place" --- */
const ORBIT_ICONS: {icon:keyof typeof SourceLogos;name:string}[] = [
  {icon:"steam",name:"Steam"},{icon:"reddit",name:"Reddit"},{icon:"polymarket",name:"Polymarket"},
  {icon:"pumpfun",name:"Pump.fun"},{icon:"tmdb",name:"TMDB"},{icon:"twitch",name:"Twitch"},
  {icon:"db",name:"DB"},{icon:"crypto",name:"Crypto"},
];

const AppIcon: React.FC<{icon:string}> = ({icon}) => {
  const logo = SourceLogos[icon as keyof typeof SourceLogos];
  if (logo) return <div style={{color:GM.green}}>{logo(28)}</div>;
  return null;
};

const SegAppsFloat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const tYK = spring({frame, fps, delay:0, config:{damping:14,stiffness:100,mass:0.7}});
  const tAL = spring({frame, fps, delay: Math.floor(fps*0.5), config:{damping:14,stiffness:100,mass:0.7}});
  const exitOp = interpolate(frame, [durationInFrames-10,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  /* FIX 3: 3D tilted orbit — rotateX 35deg, 1.5s revolution, scale 1.4, slow drift right */
  const orbitRadius = 170;
  const orbitCX = 640;
  const orbitCY = 360;
  const revFrames = fps * 1.5; /* 1.5s revolution (was 3s) */
  const orbitScale = 1.4; /* zoomed in */
  /* Slow rightward drift: 0 → +40px over the segment */
  const driftX = interpolate(frame, [0, durationInFrames], [0, 40], {extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      {/* 3D tilted orbit container */}
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",transformStyle:"preserve-3d",perspective:800,transform:`translateX(${driftX}px)`}}>
        <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",transform:`rotateX(35deg) scale(${orbitScale})`,transformOrigin:"50% 50%"}}>
          {ORBIT_ICONS.map((app, i) => {
            const iSpr = spring({frame, fps, delay: i*2+1, config:{damping:10,stiffness:100,mass:0.6}});
            const baseAngle = (i / ORBIT_ICONS.length) * Math.PI * 2;
            const orbitAngle = baseAngle + (frame / revFrames) * Math.PI * 2;
            /* Depth-based scale: icons "closer" (lower sin) are bigger */
            const depthFactor = 0.7 + 0.3 * (1 + Math.sin(orbitAngle)) / 2;
            const ox = orbitCX + Math.cos(orbitAngle) * orbitRadius;
            const oy = orbitCY + Math.sin(orbitAngle) * orbitRadius;
            const aW = organicWobble("afw"+i, frame, 2, 1.5, 0.015);
            return <div key={i} style={{position:"absolute",left:ox+aW.x-26,top:oy+aW.y-26,width:52,height:52,borderRadius:12,backgroundColor:"white",transform:`scale(${interpolate(iSpr,[0,1],[0,depthFactor])})`,opacity:interpolate(iSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"}),display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden",zIndex:Math.round(depthFactor*10)}}>
              <AppIcon icon={app.icon} />
            </div>;
          })}
        </div>
      </div>
      {(() => {
        const tw = organicWobble("ykl", frame, 1.5, 1, 0.018);
        const heartSpr = spring({frame, fps, delay: Math.floor(fps*0.35), config:{damping:8,stiffness:120,mass:0.5}});
        return <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(calc(-50% + ${driftX*0.5}px),-50%) rotate(${tw.rot*0.15}deg)`,display:"flex",gap:10,alignItems:"center",fontSize:30,fontFamily:GM.fontSans,fontWeight:400,color:DARK}}>
          <span style={{display:"inline-block",transform:`translateY(${interpolate(tYK,[0,1],[18,0])}px)`,opacity:interpolate(tYK,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>in one</span>
          <span style={{display:"inline-block",color:BLUE,fontSize:18,transform:`translateY(${interpolate(heartSpr,[0,1],[12,0])}px) scale(${interpolate(heartSpr,[0,1],[0,1])})`,opacity:interpolate(heartSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>{"\u25C6"}</span>
          <span style={{display:"inline-block",transform:`translateY(${interpolate(tAL,[0,1],[18,0])}px)`,opacity:interpolate(tAL,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>place</span>
        </div>;
      })()}
    </AbsoluteFill>
  );
};

/* --- SEGMENT 6: Typing prompt --- */
const SegTypingPrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const wob = organicWobble("typr", frame, 1.5, 1, 0.015);
  const fullText = "Rebalance my ITP portfolio";
  const charCount = Math.floor(interpolate(frame, [0,durationInFrames*0.85], [0,fullText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const bs = spring({frame, fps, delay:0, config:{damping:12,stiffness:100,mass:0.8}});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  /* Box starts CENTERED, slides LEFT as text is typed. Typing progress drives the slide. */
  const typingProgress = charCount / fullText.length;
  const slideX = interpolate(typingProgress, [0, 1], [0, -180], {extrapolateRight:"clamp", easing: EASE_OUT_QUART});
  return (
    <AbsoluteFill style={{backgroundColor:"#FAFAFA",opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(calc(-50% + ${slideX}px),-50%) translateY(${interpolate(bs,[0,1],[25,0])+wob.y}px) scale(${interpolate(bs,[0,1],[0.96,1])}) rotate(${wob.rot*0.1}deg)`,width:780,opacity:interpolate(bs,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        <div style={{backgroundColor:"#EDECF2",borderRadius:28,padding:"22px 32px",fontSize:26,fontFamily:GM.fontSans,fontWeight:400,color:"#444",minHeight:36,lineHeight:1.4}}>
          {fullText.slice(0, charCount)}
          {charCount < fullText.length && <span style={{display:"inline-block",width:2,height:28,backgroundColor:"#666",marginLeft:1,opacity:frame%20<12?1:0,verticalAlign:"text-bottom"}} />}
        </div>
      </div>
      <div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",fontSize:11,fontFamily:GM.fontSans,color:"#B0B0B0",opacity:interpolate(frame,[fps*0.5,fps],[0,0.6],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART})}}>
        Sequences shortened and simulated. On-chain execution may vary.
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 7: GM Response Streaming --- */
const SegGMResponse: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const wob = organicWobble("gresp", frame, 1.2, 0.8, 0.012);
  const resp = "Your portfolio has two active ITPs to rebalance.\n\nThe first is the DeFi Blue Chip ITP, currently weighted 40% ETH, 30% LINK, 20% AAVE, 10% UNI.\nPerformance is +12.4% over 30 days. ETH has outperformed its target weight — recommend\nreducing to 35% and redistributing to AAVE (25%) for better risk-adjusted returns.\n\nThe second is the AI Narrative ITP, weighted 50% FET, 30% RNDR, 20% OCEAN.\nThe FET allocation has grown to 58% due to recent price action. Recommend rebalancing\nback to target weights to maintain diversification.";
  /* FIX 2: Left-to-right wipe via clip-path instead of char-by-char typing */
  const revealProg = interpolate(frame, [fps*0.2,durationInFrames*0.85], [0,100], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const cs = spring({frame, fps, delay:0, config:{damping:14,stiffness:80,mass:1.0}});
  const chSpr = spring({frame, fps, delay: Math.floor(fps*0.3), config:{damping:12,stiffness:120,mass:0.6}});
  const ecSpr = [0,1].map(i => spring({frame, fps, delay: Math.floor(durationInFrames*0.7)+i*3, config:{damping:14,stiffness:100,mass:0.7}}));
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  /* 3D tilt + zoom — gentle tilt for depth, centered in viewport.
     rotateY max -8° (subtle depth), rotateX max 3°, scale 1.0-1.2. */
  const tiltY = interpolate(frame,
    [0, 5, 12, 25, 35, 40],
    [-8, -8, -6, -3, -1, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltX = interpolate(frame,
    [0, 5, 12, 25, 35, 40],
    [3, 3, 2, 1, 0.5, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const zoomScale = interpolate(frame,
    [0, 5, 15, 30, 40],
    [1.15, 1.2, 1.12, 1.05, 1.0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const float3d = useFloat3D(frame, fps, TILT_PRESETS.desktopTilt);
  return (
    <AbsoluteFill style={{backgroundColor:"#FAFAFA",opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translateY(${interpolate(cs,[0,1],[35,0])+wob.y}px) perspective(800px) rotateY(${tiltY + float3d.rotateY}deg) rotateX(${tiltX + float3d.rotateX}deg) scale(${zoomScale})`,opacity:interpolate(cs,[0,0.3],[0,1],{extrapolateRight:"clamp"}),width:960,height:580,backgroundColor:GM.bgPage,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",overflow:"hidden",display:"flex",transformStyle:"preserve-3d"}}>
        <div style={{width:4,backgroundColor:PURPLE,flexShrink:0}} />
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{height:44,borderBottom:"1px solid #E8E8EC",display:"flex",alignItems:"center",padding:"0 20px",gap:12}}>
            <div style={{fontSize:16,color:"#666"}}>&#9776;</div>
            <div style={{fontSize:14,fontFamily:GM.fontSans,color:"#444",fontWeight:500}}>General Market <span style={{fontSize:10,color:GM.textMuted}}>&#9660;</span></div>
            <div style={{flex:1}} />
            {/* Actions button */}
            <div style={{fontSize:12,fontFamily:GM.fontSans,color:"#666",fontWeight:500,padding:"4px 12px",borderRadius:8,backgroundColor:GM.bgSurface,opacity:interpolate(frame,[fps*0.5,fps],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>Execute</div>
            {/* FIX 1: Speaker icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" style={{opacity:interpolate(frame,[fps*0.5,fps],[0,0.7],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),color:"#666",flexShrink:0}}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/>
            </svg>
            <div style={{width:28,height:28,borderRadius:"50%",backgroundColor:"#E8E8EC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#666"}}>+</div>
          </div>
          <div style={{flex:1,padding:"20px 28px",overflow:"hidden"}}>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg, #D4A574, #8B6F47)",flexShrink:0}} />
              <div style={{fontSize:13,fontFamily:GM.fontSans,color:"#444",fontStyle:"italic",paddingTop:4}}>Rebalance my ITP portfolio</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,marginLeft:38,transform:`scale(${interpolate(chSpr,[0,1],[0.8,1])})`,opacity:interpolate(chSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0L9 5L14 7L9 9L7 14L5 9L0 7L5 5Z" fill={BLUE}/></svg>
              <div style={{padding:"5px 12px",borderRadius:16,border:"1px solid #E0E0E4",fontSize:12,fontFamily:GM.fontSans,fontWeight:500,color:"#444",display:"flex",alignItems:"center",gap:5}}>On-Chain Data <span style={{fontSize:9,color:GM.textMuted}}>&#9660;</span></div>
            </div>
            {/* FIX 2: Left-to-right wipe reveal using clip-path */}
            <div style={{fontSize:13,fontFamily:GM.fontSans,color:"#333",lineHeight:1.7,whiteSpace:"pre-wrap",marginLeft:38,clipPath:`inset(0 ${100-revealProg}% 0 0)`}}>{resp}</div>
            <div style={{display:"flex",gap:12,marginTop:20,marginLeft:38}}>
              {[{title:"DeFi Blue Chip ITP",sub:"Rebalance recommended",color:BLUE},{title:"AI Narrative ITP",sub:"Weight drift detected",color:PINK}].map((card, ci) => {
                const e = ecSpr[ci];
                return <div key={ci} style={{flex:1,height:65,backgroundColor:"#F6F6FA",borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${card.color}`,transform:`translateY(${interpolate(e,[0,1],[15,0])}px)`,opacity:interpolate(e,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}><div style={{fontSize:11,fontWeight:600,color:"#333",fontFamily:GM.fontSans,marginBottom:4}}>{card.title}</div><div style={{fontSize:10,color:"#888",fontFamily:GM.fontSans}}>{card.sub}</div></div>;
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",fontSize:10,fontFamily:GM.fontSans,color:GM.textSecondary,opacity:interpolate(frame,[fps*0.5,fps],[0,0.5],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART})}}>Sequences shortened and simulated. On-chain execution may vary.</div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 8: And moooore — vertical market icons tree --- */
const MARKET_NODES: {label:string; color:string; side:"left"|"right"}[] = [
  {label:"Steam",      color:"#1B2838", side:"left"},
  {label:"Reddit",     color:"#FF4500", side:"right"},
  {label:"Crypto",     color:"#F7931A", side:"left"},
  {label:"Polymarket", color:"#4A90D9", side:"right"},
  {label:"Pump.fun",   color:"#00E676", side:"left"},
  {label:"TMDB",       color:"#01D277", side:"right"},
  {label:"Twitch",     color:"#9146FF", side:"left"},
  {label:"DB",         color:"#EC0016", side:"right"},
];

/* ── "And moooore" balls (original animation) + market tree overlay ── */
const GM_BALLS = [GM.green, GM.greenDark, GM.red, GM.greenStatus, GM.green, GM.redStatus, GM.greenDark, GM.greenStatus];
const MAX_BALLS = 22;

const SegAndMoreInner: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const stretchStart = Math.floor(fps * 0.45);
  const stretchRaw = frame - stretchStart;
  const stretch = stretchRaw > 0 ? interpolate(stretchRaw, [0,fps*0.8], [0,1], {extrapolateRight:"clamp",easing:Easing.bezier(0.22,0.1,0.25,1)}) : 0;
  const oCount = Math.floor(interpolate(stretch, [0,0.7], [1,MAX_BALLS], {extrapolateRight:"clamp"}));
  const ballProgress = stretch > 0.1 ? interpolate(stretch, [0.1,0.4], [0,1], {extrapolateRight:"clamp"}) : 0;
  const scrollX = interpolate(stretch, [0.05,1], [0,-200], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.2,0,0.3,1)});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  const aSpr = spring({frame, fps, delay:0, config:{damping:10,stiffness:100,mass:0.6}});
  const mOp = interpolate(frame, [fps*0.3,fps*0.55], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const aW = organicWobble("and8", frame, 2, 2.5, 0.015);

  /* Market lines overlay — fades in during second half */
  const treeOp = interpolate(frame, [fps*0.8, fps*1.2], [0, 0.85], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const lineStart = Math.floor(fps * 0.9);
  const lineProg = interpolate(frame, [lineStart, lineStart+20], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  /* Pick 8 evenly spaced ball indices from the chain */
  const LABEL_BALLS = MARKET_NODES.map((_, mi) => Math.floor((mi / (MARKET_NODES.length - 1)) * (MAX_BALLS - 1)));

  const renderBalls = () => Array.from({length:oCount}, (_,i) => {
    const bd = stretchStart+i*0.5;
    const damp = 6+(i%5)*1.4;
    const stiff = 120+(i%3)*30;
    const mass = 0.4+(i%4)*0.15;
    const bR = Math.max(0, frame-bd);
    const bT = Math.min(bR/(fps*0.5), 1);
    const om = Math.sqrt(stiff/mass);
    const z = damp/(2*Math.sqrt(stiff*mass));
    const bS = bT<=0?0:1-Math.exp(-z*om*bT/fps*15)*Math.cos(om*Math.sqrt(1-z*z)*bT/fps*15);
    const cS = Math.max(0,Math.min(1.3,bS));
    const sz = 26*Math.min(cS,1);
    const bOp = interpolate(cS,[0,0.4],[0,1],{extrapolateRight:"clamp"});
    const lOp = interpolate(ballProgress,[0,0.6],[1,0],{extrapolateRight:"clamp"});
    const sineAmp = interpolate(stretch,[0.15,0.6],[0,28],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
    const sineFreq = 0.35 + (i%3)*0.05;
    const sinePhase = i*0.42 + frame*0.06;
    const wY = Math.sin(sinePhase*sineFreq)*sineAmp*Math.min(cS,1);
    const wX = noise2D("bx"+i,frame*0.025,i)*3*Math.min(cS,1);
    const col = GM_BALLS[i%GM_BALLS.length];
    const sO = interpolate(cS,[0,0.3,0.6,1,1.3],[0.15,1.3,0.9,1,1.1],{extrapolateRight:"clamp"});
    const labelIdx = LABEL_BALLS.indexOf(i);
    const hasLine = labelIdx >= 0 && treeOp > 0.01;
    const goesUp = labelIdx % 2 === 0;
    const lineH = hasLine ? interpolate(lineProg, [0,1], [0, 80 + (labelIdx % 3) * 20], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}) : 0;
    const lineCol = hasLine ? MARKET_NODES[labelIdx].color : col;
    const lineLabel = hasLine ? MARKET_NODES[labelIdx].label : "";
    return <span key={i} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",position:"relative",width:28,height:Math.max(sz+2,30),transform:`translateY(${wY}px) translateX(${wX}px)`,flexShrink:0}}>
      {lOp>0.01&&<span style={{position:"absolute",opacity:lOp*Math.min(cS*3,1),color:col,fontSize:44}}>o</span>}
      {cS>0.01&&<div style={{width:sz,height:sz,borderRadius:"50%",backgroundColor:col,opacity:bOp,transform:`scale(${sO})`,boxShadow:cS>0.5?`0 2px 10px ${col}66, 0 0 16px ${col}33`:undefined}} />}
      {hasLine && <div style={{position:"absolute",left:"50%",width:1,backgroundColor:lineCol,opacity:treeOp,transform:"translateX(-50%)",...(goesUp?{bottom:"50%",height:lineH}:{top:"50%",height:lineH})}}>
        <div style={{position:"absolute",...(goesUp?{top:-16}:{bottom:-16}),left:"50%",transform:"translateX(-50%)",fontSize:10,fontWeight:700,fontFamily:GM.fontSans,color:lineCol,opacity:interpolate(lineProg,[0.5,1],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),whiteSpace:"nowrap"}}>{lineLabel}</div>
      </div>}
    </span>;
  });

  return (
    <AbsoluteFill style={{backgroundColor:BG_WARM,opacity:exitOp,overflow:"visible"}}>
      <div style={{position:"absolute",width:"100%",height:"100%",background:`radial-gradient(ellipse at 55% 40%, ${GM.green}09 0%, transparent 60%)`}} />
      {/* Original "m-ooo-re" animation */}
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translateX(${scrollX}px)`,display:"flex",alignItems:"center",flexWrap:"nowrap",gap:stretch>0.1?0:12,fontSize:44,fontFamily:GM.fontSans,fontWeight:400,whiteSpace:"nowrap",overflow:"visible"}}>
        <span style={{color:GM.textPrimary,transform:`translateY(${interpolate(aSpr,[0,1],[20,0])+aW.y}px) translateX(${aW.x}px)`,display:"inline-block",marginRight:4,opacity:interpolate(aSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})*interpolate(stretch,[0,0.15],[1,0],{extrapolateRight:"clamp"})}}>and 500k+</span>
        {stretch<=0.02 ? <span style={{color:GM.green,fontSize:44,opacity:mOp}}>more</span> : <>
          <span style={{color:GM.green,fontSize:44,display:"inline-block",opacity:mOp}}>m</span>
          {renderBalls()}
          <span style={{color:GM.green,fontSize:44,display:"inline-block",marginLeft:-4}}>re</span>
        </>}
      </div>
      {/* "91 markets" label — appears at end of line animation */}
      {treeOp > 0.01 && (
        <div style={{position:"absolute",bottom:80,left:"50%",transform:"translateX(-50%)",fontSize:15,fontWeight:700,fontFamily:GM.fontSans,color:GM.green,opacity:interpolate(lineProg,[0.6,1],[0,treeOp],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>91 markets</div>
      )}
    </AbsoluteFill>
  );
};

const SegAndMore: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stretchActive = frame > Math.floor(fps * 0.45);
  if (stretchActive) {
    return <CameraMotionBlur samples={6} shutterAngle={100}><SegAndMoreInner /></CameraMotionBlur>;
  }
  return <SegAndMoreInner />;
};

/* --- SEGMENT 9: Starting with the new GM protocol --- */
const STARTING_ROTATIONS = [-5, 8, 0, -10, 3, 0]; /* per-word rotation angles */
const SegStartingWith: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const words = ["Starting","with","the","new","GM","protocol"];
  const rng = useMemo(() => seededRandom(777), []);
  const scatterVectors = useMemo(() => words.map(() => ({x:(rng()-0.5)*600,y:(rng()-0.5)*440,rot:(rng()-0.5)*50})), []);
  const scatterPhase = frame > durationInFrames - fps*0.5;
  const scatterProg = scatterPhase ? interpolate(frame, [durationInFrames-fps*0.5,durationInFrames], [0,1], {extrapolateRight:"clamp",easing:EASE_IN_QUART}) : 0;
  const exitOp = interpolate(frame, [durationInFrames-5,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  /* FIX 3: light ray streaks behind text */
  const rayOp = interpolate(frame, [fps*0.3,fps*0.8,durationInFrames-fps*0.6,durationInFrames-fps*0.3], [0,0.35,0.35,0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      {/* FIX 3: Light ray streaks */}
      {[{x:480,y:340,w:380,rot:-3,h:2},{x:520,y:370,w:320,rot:5,h:1.5},{x:440,y:355,w:420,rot:-1,h:2.5}].map((ray,ri) => (
        <div key={ri} style={{position:"absolute",left:ray.x,top:ray.y,width:ray.w,height:ray.h,background:`linear-gradient(90deg, transparent 0%, ${LAVENDER}88 30%, ${BLUE}44 70%, transparent 100%)`,transform:`rotate(${ray.rot}deg)`,opacity:rayOp,filter:"blur(1px)"}} />
      ))}
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",gap:14,fontSize:40,fontFamily:GM.fontSans,fontWeight:400}}>
        {words.map((word, i) => {
          const wW = organicWobble(`sw${i}`, frame, 2, 1.5, 0.02);
          const wSpr = spring({frame, fps, delay: i*4, config:{damping:12,stiffness:100,mass:0.8}});
          const sv = scatterVectors[i];
          /* FIX 3: each word gets its own rotation angle */
          const baseRot = STARTING_ROTATIONS[i];
          const rotIn = interpolate(wSpr, [0,1], [baseRot*2, baseRot]);
          const finalRot = rotIn + scatterProg*sv.rot;
          /* "GM" gets brand green tint */
          const isGM = word === "GM";
          const wordColor = isGM ? BLUE : DARK;
          return <span key={i} style={{display:"inline-block",color:wordColor,transform:`translate(${wW.x+scatterProg*sv.x}px,${interpolate(wSpr,[0,1],[30,0])+wW.y+scatterProg*sv.y}px) rotate(${finalRot}deg) scale(${interpolate(scatterProg,[0,1],[1,0.6])})`,opacity:interpolate(wSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})*interpolate(scatterProg,[0,0.8],[1,0]),fontWeight:400}}>{word}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 10: Phone Mockup "Welcome to GM" ---
 * Reference (0:30–0:32.5): phone is ALWAYS massive, mostly head-on.
 *   0-15f:  entering, scale ~2.5x, slight -5deg tilt
 *   15-45f: settle, dezooms to ~2.0x, nearly flat
 *   45-72f: zoom RAMPS back up to 2.8x, still mostly head-on
 *   72-84f: 3.0x scale, tilt starts increasing to -15deg (dramatic tilt continues in next segment)
 */
const SegPhoneMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const tilt = useFloat3D(frame, fps, TILT_PRESETS.phoneFloat);

  /* Frame-by-frame FLIP from reference (0:32–0:35):
     Phone starts nearly flat at MASSIVE zoom (3x), then flips dramatically through
     a ~65deg rotateY arc — side edge clearly visible — before settling back as it
     shrinks and the "supercharge" text takes over. */
  /* Reference 0:31-0:34.5 mapped to 110 frames:
   * f0-15:   phone enters MASSIVE and nearly flat (fills viewport)
   * f15-30:  still massive, slight tilt building
   * f30-45:  MID FLIP — dramatic 40° Y rotation, side edge visible
   * f45-60:  PEAK FLIP — 65° Y, phone almost showing backface
   * f60-75:  recovery — rotates back, forward lean increases
   * f75-90:  settling — phone shrinks behind "supercharge" text
   * f90-110: phone fades, only text visible */
  /* 130-frame arc: massive flat → flip → flatten toward viewer → shrink behind text
   * f0-20:   massive flat entrance (fills viewport)
   * f20-40:  dramatic flip (side edge visible)
   * f40-60:  peak flip ~55°, then recovery
   * f60-80:  phone flattens TOWARD viewer (high rotateX), "supercharge" text arrives
   * f80-100: phone behind text, shrinking
   * f100-130: phone fades out, text only */
  const phoneScale = interpolate(frame,
    [0,   20,  40,  60,  80,  100, 130],
    [3.0, 3.0, 2.2, 1.5, 1.0, 0.7, 0.4],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltYDeg = interpolate(frame,
    [0,  20,  40,  55,  70,  90,  130],
    [-2, -8, -40, -55, -20, -8,   -5],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltXDeg = interpolate(frame,
    [0,  20,  40,  55,  70,  90,  130],
    [2,   3,   8,  15,  30,  35,   25],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltYRad = (tiltYDeg * Math.PI) / 180;
  const tiltXRad = (tiltXDeg * Math.PI) / 180;
  const pOp = interpolate(frame, [0, 3], [0, 1], {extrapolateLeft:"clamp", extrapolateRight:"clamp"});

  /* Text visible immediately — ref shows it already on screen at entrance */
  const hiSpr = spring({frame, fps, delay: 0, config:{damping:14,stiffness:100,mass:0.7}});
  const bdSpr = spring({frame, fps, delay: 4, config:{damping:14,stiffness:100,mass:0.7}});
  /* Phone fades over last 40 frames as "supercharge" text takes over */
  const exitOp = interpolate(frame, [durationInFrames-40,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});

  const phoneScreen = (
    <div style={{width:"100%",height:"100%",backgroundColor:GM.bgPage,fontFamily:GM.fontSans}}>
      {/* GM Header Bar */}
      <div style={{height:56,backgroundColor:GM.bgPage,borderBottom:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
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
          <div key={ti} style={{flex:1,textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:ti===1?600:500,color:ti===1?GM.textPrimary:GM.textSecondary,borderBottom:ti===1?`2px solid ${GM.textPrimary}`:"2px solid transparent",fontFamily:GM.fontSans}}>{tab}</div>
        ))}
      </div>
      {/* Portfolio Overview Content */}
      <div style={{padding:"16px 16px 0",transform:`translateY(${interpolate(hiSpr,[0,1],[20,0])}px)`,opacity:interpolate(hiSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",color:GM.textMuted,marginBottom:4}}>Portfolio</div>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:"-0.03em",color:GM.textPrimary,fontFamily:GM.fontMono}}>$12,847.32</div>
        <div style={{fontSize:13,color:GM.greenStatus,fontFamily:GM.fontMono,marginTop:2}}>+$847.32 (+7.05%)</div>
        {/* Mini area chart */}
        <svg width="100%" height={120} viewBox="0 0 280 120" style={{marginTop:8}}>
          <defs><linearGradient id="chartGrad03" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3}/><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02}/></linearGradient></defs>
          <path d="M0 90 Q30 85,60 70 Q90 55,120 60 Q150 50,180 35 Q210 25,240 30 Q260 28,280 20 L280 120 L0 120Z" fill="url(#chartGrad03)"/>
          <path d="M0 90 Q30 85,60 70 Q90 55,120 60 Q150 50,180 35 Q210 25,240 30 Q260 28,280 20" fill="none" stroke="#3B82F6" strokeWidth={2}/>
        </svg>
      </div>
      {/* Holdings List */}
      <div style={{transform:`translateY(${interpolate(bdSpr,[0,1],[15,0])}px)`,opacity:interpolate(bdSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
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
    </div>
  );

  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      <Phone3D
        rotateY={tiltYRad}
        rotateX={tiltXRad}
        scale={1}
        width={340}
        height={700}
        screenContent={phoneScreen}
        opacity={pOp}
        style={{transform:`scale(${phoneScale}) ${tilt.transform}`}}
      />
      <div style={{position:"absolute",bottom:20,left:30,fontSize:11,fontFamily:GM.fontSans,color:GM.textSecondary,opacity:interpolate(frame,[fps,fps*1.5],[0,0.5],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>The GM protocol is permissionless and available globally.</div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 11: Built to maximize your edge --- */
/* Per-letter color assignment for "maximize" —
   each letter gets an explicit color cycling every 2 frames + 1-2px position jitter */
const ELEC_COLORS = [BLUE, PURPLE, BLUE, GM.green, GM.greenDark, GM.green];
const SUPERCHARGE_LETTERS = "maximize".split("");
const SegSupercharge: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wCfg = [{text:"Built",accent:false,delay:0,fontSize:36,italic:false},{text:"to",accent:false,delay:5,fontSize:36,italic:false},{text:"maximize",accent:true,delay:10,fontSize:42,italic:true},{text:"your",accent:false,delay:18,fontSize:34,italic:true},{text:"edge",accent:false,delay:23,fontSize:38,italic:true}];
  /* Color cycle offset shifts every 2 frames */
  const colorShift = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",gap:12,alignItems:"baseline"}}>
        {wCfg.map((w, i) => {
          const sw = organicWobble(`sc${i}`, frame, 2, 1.5, 0.02);
          const spr = spring({frame, fps, delay: w.delay, config: w.accent?{damping:8,stiffness:80,mass:0.8}:{damping:12,stiffness:100,mass:0.7}});
          const wY = interpolate(spr, [0,1], [w.accent?35:25, 0]);
          const wS = w.accent?interpolate(spr,[0,1],[0.7,1]):interpolate(spr,[0,1],[0.95,1]);
          const wOp = interpolate(spr, [0,0.3], [0,1], {extrapolateRight:"clamp"});
          const base: React.CSSProperties = {display:"inline-block",fontSize:w.fontSize,fontFamily:GM.fontSans,fontWeight:w.accent?500:400,fontStyle:w.italic?"italic":"normal",transform:`translate(${sw.x}px,${wY+sw.y}px) scale(${wS})`,opacity:wOp};
          if (w.accent) {
            /* Per-letter colored spans with electrical jitter */
            return <span key={i} style={{...base, display:"inline-flex"}}>
              {SUPERCHARGE_LETTERS.map((ch, li) => {
                const letterColor = ELEC_COLORS[(li + colorShift) % ELEC_COLORS.length];
                /* 1-2px position jitter for electrical vibration feel */
                const jX = noise2D("scjx"+li, frame*0.15, li) * 1.5;
                const jY = noise2D("scjy"+li, li, frame*0.15) * 1.5;
                return <span key={li} style={{
                  color: letterColor,
                  display: "inline-block",
                  transform: `translate(${jX}px, ${jY}px)`,
                }}>{ch}</span>;
              })}
            </span>;
          }
          return <span key={i} style={{...base,color:DARK}}>{w.text}</span>;
        })}
      </div>
      {Array.from({length:20}, (_,i) => {
        const px = noise2D("sx"+i, frame/60, i)*500+640;
        const py = noise2D("sy"+i, i, frame/60)*300+360;
        const sz = 3+(i%4)*1.5;
        const cols = [PINK,PURPLE,BLUE,LAVENDER];
        const dOp = interpolate(frame, [fps*0.5,fps*0.8,fps*1.5,fps*2], [0,0.6,0.6,0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
        const dS = interpolate(frame, [fps*0.5,fps*0.8], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
        return <div key={i} style={{position:"absolute",left:px,top:py,width:sz,height:sz,borderRadius:"50%",backgroundColor:cols[i%cols.length],opacity:dOp,transform:`scale(${dS})`}} />;
      })}
    </AbsoluteFill>
  );
};

/* --- Phone Status Bar (reused across phone segments) --- */
const PhoneStatusBar: React.FC<{color?: string}> = ({color = "#333"}) => (
  <div style={{height:44,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 20px 0",fontSize:13,fontWeight:600,color}}>
    <span>9:30</span>
    <div style={{width:80,height:24,borderRadius:12,backgroundColor:"#000"}} />
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{fontSize:13,fontWeight:700}}>5G</span>
      <div style={{display:"flex",alignItems:"flex-end",gap:1.5,height:12}}>{[5,7,9,12].map((h,j)=><div key={j} style={{width:3,height:h,backgroundColor:color,borderRadius:1}} />)}</div>
      <div style={{width:20,height:10,border:`1.5px solid ${color}`,borderRadius:2,position:"relative",marginLeft:2}}><div style={{position:"absolute",inset:1.5,backgroundColor:color,borderRadius:0.5}} /><div style={{position:"absolute",right:-4,top:2,width:3,height:6,backgroundColor:color,borderRadius:"0 1px 1px 0"}} /></div>
    </div>
  </div>
);

/* --- Phone Home Screen (ref frame 14: moon wallpaper, dock, search bar) --- */
const PhoneHomeScreen: React.FC<{frame: number; fps: number}> = ({frame, fps}) => {
  const dockSpr = spring({frame, fps, delay: Math.floor(fps*0.8), config:{damping:14,stiffness:100,mass:0.7}});
  const searchSpr = spring({frame, fps, delay: Math.floor(fps*0.6), config:{damping:14,stiffness:100,mass:0.7}});
  return (
    <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
      {/* Wallpaper: moon on branch (warm beige background) */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, #E8DDD4 0%, #D4C8BD 40%, #C4B8AC 100%)"}}>
        {/* Moon circle */}
        <div style={{position:"absolute",top:100,right:60,width:100,height:100,borderRadius:"50%",background:"linear-gradient(135deg, #F5E6B8 0%, #E8D49B 60%, #D4BF7A 100%)",boxShadow:"0 0 30px rgba(245,230,184,0.4)"}} />
        {/* Branch silhouette */}
        <svg width="280" height="200" viewBox="0 0 280 200" style={{position:"absolute",top:60,right:10}}>
          <path d="M280 120 Q240 110, 200 100 Q170 95, 150 105 Q130 115, 100 100 Q80 90, 60 95 Q40 100, 20 90" stroke="#5C4A3A" strokeWidth="3" fill="none"/>
          <path d="M150 105 Q145 85, 155 70" stroke="#5C4A3A" strokeWidth="2" fill="none"/>
          <path d="M100 100 Q90 80, 95 65" stroke="#5C4A3A" strokeWidth="2" fill="none"/>
          <path d="M200 100 Q195 80, 205 68" stroke="#5C4A3A" strokeWidth="2" fill="none"/>
          {/* Small leaves */}
          <ellipse cx="155" cy="68" rx="4" ry="8" fill="#5C4A3A" transform="rotate(-20,155,68)"/>
          <ellipse cx="95" cy="63" rx="4" ry="8" fill="#5C4A3A" transform="rotate(15,95,63)"/>
          <ellipse cx="205" cy="66" rx="4" ry="8" fill="#5C4A3A" transform="rotate(-10,205,66)"/>
        </svg>
      </div>
      <PhoneStatusBar color="#444" />
      {/* GM Search Bar */}
      <div style={{position:"absolute",bottom:100,left:20,right:20,height:46,backgroundColor:"rgba(255,255,255,0.92)",borderRadius:24,display:"flex",alignItems:"center",padding:"0 14px",gap:10,boxShadow:"0 2px 8px rgba(0,0,0,0.08)",transform:`translateY(${interpolate(searchSpr,[0,1],[20,0])}px)`,opacity:interpolate(searchSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        {/* GM logo */}
        <div style={{width:22,height:22,borderRadius:4,background:`linear-gradient(135deg, ${GM.green}, ${GM.greenDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white"}}>GM</div>
        <span style={{flex:1,fontSize:13,color:GM.textSecondary,fontFamily:GM.fontSans}}>Search markets...</span>
        {/* Search icon */}
        <svg width="18" height="18" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" fill="none" stroke={GM.green} strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" stroke={GM.green} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      {/* Dock: Portfolio, Markets, GM logo, Wallet */}
      <div style={{position:"absolute",bottom:30,left:30,right:30,display:"flex",justifyContent:"space-around",alignItems:"center",transform:`translateY(${interpolate(dockSpr,[0,1],[30,0])}px)`,opacity:interpolate(dockSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        {/* Portfolio icon */}
        <div style={{width:48,height:48,borderRadius:12,backgroundColor:GM.green,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" fill="white"/></svg>
        </div>
        {/* Markets icon */}
        <div style={{width:48,height:48,borderRadius:12,backgroundColor:GM.greenDark,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill="white"/></svg>
        </div>
        {/* GM logo icon */}
        <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg, ${GM.green}, ${GM.greenDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"white",fontFamily:GM.fontSans}}>
          GM
        </div>
        {/* Wallet icon */}
        <div style={{width:48,height:48,borderRadius:12,backgroundColor:GM.bgSurface,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #E0E0E4"}}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M21 7H3c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-1 8H4V9h16v6zm-3-3.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" fill={GM.textPrimary}/></svg>
        </div>
      </div>
    </div>
  );
};

/* --- SEGMENT 12: Phone Good Morning — enters from bottom-right
 *   Reference timeline (extracted frame-by-frame):
 *     Frame 0:        scale=2.0, rotateY=-25deg, rotateX=10deg, translateX=300, translateY=200 — bottom-right
 *     Frame 15 (0.5s): scale=1.5, rotateY=-18deg, rotateX=7deg  — sliding in
 *     Frame 30 (1s):   scale=1.3, rotateY=-15deg, rotateX=5deg  — centered, full screen visible
 *     Frame 60+:       scale=1.1, rotateY=-8deg,  rotateX=3deg  — gentle float drift
 */
const SegPhoneGoodMorning: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const tilt = useFloat3D(frame, fps, TILT_PRESETS.phoneFloat);

  /* Frame-interpolated 3D entrance from bottom-right */
  const phoneScale = interpolate(frame,
    [0, 15, 30, 60],
    [2.0, 1.5, 1.3, 1.1],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltYDeg = interpolate(frame,
    [0, 15, 30, 60],
    [-25, -18, -15, -8],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltXDeg = interpolate(frame,
    [0, 15, 30, 60],
    [10, 7, 5, 3],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const phoneTx = interpolate(frame,
    [0, 15, 30, 60],
    [300, 150, 40, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const phoneTy = interpolate(frame,
    [0, 15, 30, 60],
    [200, 100, 30, 0],
    {extrapolateLeft:"clamp", extrapolateRight:"clamp"}
  );
  const tiltYRad = (tiltYDeg * Math.PI) / 180;
  const tiltXRad = (tiltXDeg * Math.PI) / 180;
  const pOp = interpolate(frame, [0, 3], [0, 1], {extrapolateLeft:"clamp", extrapolateRight:"clamp"});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});

  /* Screen: Good Morning Gemini content */
  const cSpr = [0,1,2].map(i => spring({frame, fps, delay: Math.floor(fps*0.5)+i*4, config:{damping:14,stiffness:100,mass:0.7}}));
  const inputSpr = spring({frame, fps, delay: Math.floor(fps*1.2), config:{damping:14,stiffness:100,mass:0.7}});

  const phoneScreen = (
    <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",backgroundColor:GM.bgPage,fontFamily:GM.fontSans}}>
      {/* GM Header Bar */}
      <div style={{height:56,backgroundColor:GM.bgPage,borderBottom:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px"}}>
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
          <div key={ti} style={{flex:1,textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:ti===0?600:500,color:ti===0?GM.textPrimary:GM.textSecondary,borderBottom:ti===0?`2px solid ${GM.textPrimary}`:"2px solid transparent",fontFamily:GM.fontSans}}>{tab}</div>
        ))}
      </div>
      {/* Section header */}
      <div style={{backgroundColor:GM.textPrimary,padding:"8px 16px"}}>
        <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",color:GM.textInverse}}>Crypto Markets &middot; 847 live</span>
      </div>
      {/* Market rows */}
      {[
        {symbol:"BTC/USD",price:"$67,432",change:"+2.4%",up:true},
        {symbol:"ETH/USD",price:"$3,891",change:"+1.8%",up:true},
        {symbol:"SOL/USD",price:"$142.50",change:"-0.7%",up:false},
      ].map((row,ri)=>{
        const s = cSpr[ri];
        return (
          <div key={ri} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${GM.borderLight}`,transform:`translateY(${interpolate(s,[0,1],[15,0])}px)`,opacity:interpolate(s,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,fontFamily:GM.fontMono,color:GM.textPrimary}}>{row.symbol}</div>
            </div>
            <div style={{fontSize:13,fontFamily:GM.fontMono,color:GM.textSecondary}}>{row.price}</div>
            <div style={{fontSize:12,fontFamily:GM.fontMono,color:row.up?GM.greenStatus:GM.redStatus,minWidth:48,textAlign:"right"}}>{row.change}</div>
            {/* Mini sparkline */}
            <svg width={40} height={20} viewBox="0 0 40 20">
              <path d={row.up?"M0 16 Q10 14,15 10 Q25 4,30 6 Q35 5,40 2":"M0 4 Q10 6,15 10 Q25 14,30 16 Q35 15,40 18"} fill="none" stroke={row.up?GM.greenStatus:GM.redStatus} strokeWidth={1.5}/>
            </svg>
          </div>
        );
      })}
      {/* Input bar at bottom */}
      <div style={{padding:"12px 16px",transform:`translateY(${interpolate(inputSpr,[0,1],[10,0])}px)`,opacity:interpolate(inputSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        <div style={{height:40,backgroundColor:"#F4F4F5",border:`1px solid ${GM.borderMedium}`,borderRadius:8,display:"flex",alignItems:"center",padding:"0 14px",fontSize:13,color:GM.textMuted,fontFamily:GM.fontSans}}>Search markets...</div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      <Phone3D
        rotateY={tiltYRad}
        rotateX={tiltXRad}
        scale={1}
        screenContent={phoneScreen}
        opacity={pOp}
        style={{transform:`translate(${phoneTx}px,${phoneTy}px) scale(${phoneScale}) ${tilt.transform}`}}
      />
    </AbsoluteFill>
  );
};

/* === MAIN SCENE 03 === */
export const Scene03: React.FC = () => {
  /* Segment timing aligned to reference (S03 starts at absolute frame 410):
   * Ref 0:14 = local 0:   particles
   * Ref 0:16 = local 60:  GM reveal
   * Ref 0:17 = local 90:  desktop Welcome back
   * Ref 0:20 = local 180: it's everything
   * Ref 0:22 = local 240: apps float
   * Ref 0:24 = local 300: typing prompt
   * Ref 0:26 = local 360: GM response
   * Ref 0:28 = local 420: and moooore
   * Ref 0:29 = local 450: starting with
   * Ref 0:31 = local 520: phone "Welcome to GM" (MASSIVE, then flip)
   * Ref 0:35 = local 630: built to maximize (END of S03)
   */
  const segments: {start:number;dur:number;Comp:React.FC}[] = [
    {start:0,dur:50,Comp:SegGMReveal},
    {start:45,dur:95,Comp:SegDesktopUI},
    {start:140,dur:55,Comp:SegItsEverything},
    {start:190,dur:65,Comp:SegAppsFloat},
    {start:250,dur:70,Comp:SegTypingPrompt},
    {start:315,dur:50,Comp:SegGMResponse},
    {start:360,dur:50,Comp:SegAndMore},
    {start:405,dur:70,Comp:SegStartingWith},
    {start:475,dur:120,Comp:SegPhoneMockup},
    {start:555,dur:80,Comp:SegSupercharge},
  ];
  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      {segments.map(({start,dur,Comp}, i) => (
        <Sequence key={i} from={start} durationInFrames={dur} name={`seg-${i}`}><Comp /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* Suppress noUnusedLocals for helpers preserved for future segments */
void cubicBez; void EASE_OUT_EXPO; void PhoneHomeScreen; void SegPhoneGoodMorning; void SegParticleExplosion;

export const scene03Meta = {
  id: "GMScene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 700,
};
