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

/* --- bezier / motion helpers --- */
function cubicBez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

function quadBez(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u*u*p0 + 2*u*t*p1 + t*t*p2;
}

function decel(t: number, rate = 3.0): number {
  return 1 - Math.exp(-t * rate);
}

function organicWobble(seed: string, frame: number, ax = 3, ay = 2, speed = 0.02) {
  return {
    x: noise2D(seed + "wx", frame * speed, 0) * ax,
    y: noise2D(seed + "wy", 0, frame * speed) * ay,
    rot: noise2D(seed + "wr", frame * speed * 0.7, 0.5) * 1.5,
  };
}

/* --- palette --- */
const PINK = "#E8458B";
const PURPLE = "#7B61FF";
const BLUE = "#4285F4";
const CORAL = "#F28B82";
const LAVENDER = "#C4B5FD";
const BG = "#F0EFF5";
const BG_WARM = "#F5F0EE";
const DARK = "#1A1A2E";

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
const EASE_ELASTIC_APPROX = Easing.bezier(0.68, -0.55, 0.27, 1.55);

const Sparkle: React.FC<{x: number; y: number; size: number; color: string; opacity: number; rotation: number}> = ({x, y, size, color, opacity, rotation}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{position: "absolute", left: x - size/2, top: y - size/2, opacity, transform: `rotate(${rotation}deg)`}}>
    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" fill={color}/>
  </svg>
);

interface Particle {
  id: number; x: number; y: number; cpOffX: number; cpOffY: number;
  endX: number; endY: number; size: number; color: string; speed: number;
  angle: number; noiseOffsetX: number; noiseOffsetY: number; delay: number;
  shape: "circle"|"diamond"|"star";
}

function generateParticles(count: number, seed: number): Particle[] {
  const rng = seededRandom(seed);
  const colors = [PINK, PURPLE, BLUE, CORAL, LAVENDER, "#A78BFA", "#F472B6", "#60A5FA"];
  const shapes: Particle["shape"][] = ["circle","circle","circle","diamond","star"];
  return Array.from({length: count}, (_, i) => {
    const angle = (rng() - 0.3) * Math.PI * 0.8;
    const dist = 80 + rng() * 280;
    const perpAngle = angle + (rng() > 0.5 ? Math.PI/2 : -Math.PI/2);
    const cpDist = 40 + rng() * 120;
    return {
      id: i, x: 500 + rng()*280, y: 300 + (rng()-0.5)*120,
      cpOffX: Math.cos(perpAngle)*cpDist + Math.cos(angle)*dist*0.5,
      cpOffY: Math.sin(perpAngle)*cpDist + Math.sin(angle)*dist*0.5,
      endX: Math.cos(angle)*dist, endY: Math.sin(angle)*dist,
      size: 2 + rng()*10, color: colors[Math.floor(rng()*colors.length)],
      speed: 0.5 + rng()*3, angle,
      noiseOffsetX: rng()*1000, noiseOffsetY: rng()*1000,
      delay: rng()*15, shape: shapes[Math.floor(rng()*shapes.length)],
    };
  });
}

const ParticleField: React.FC<{frame: number; fps: number; particles: Particle[]; phase: "explode"|"swirl"|"converge"|"scatter"}> = ({frame, fps, particles, phase}) => (
  <>
    {particles.map((p) => {
      const rawT = Math.max(0, frame - p.delay) / fps;
      const noiseX = noise2D("px"+p.id, rawT*0.8+p.noiseOffsetX, 0)*40;
      const noiseY = noise2D("py"+p.id, 0, rawT*0.8+p.noiseOffsetY)*40;
      const wob = organicWobble("p"+p.id, frame, 2.5, 2, 0.025);
      let px: number, py: number, opacity: number, scale: number;

      if (phase === "explode") {
        const tNorm = Math.min(rawT/1.2, 1);
        const d = decel(tNorm*3, 2.8);
        px = quadBez(d, p.x, p.x+p.cpOffX, p.x+p.endX)+noiseX+wob.x;
        py = quadBez(d, p.y, p.y+p.cpOffY, p.y+p.endY)+noiseY+wob.y;
        opacity = interpolate(tNorm, [0,0.04,0.5,0.85,1], [0,1,0.9,0.4,0], {extrapolateRight:"clamp"});
        scale = interpolate(tNorm, [0,0.1,0.6,1], [0.15,1.1,0.7,0.15], {extrapolateRight:"clamp"});
      } else if (phase === "swirl") {
        const sA = p.angle + rawT*2;
        const dist = 50 + p.speed*rawT*40;
        px = 640+Math.cos(sA)*dist+noiseX*0.5+wob.x;
        py = 360+Math.sin(sA)*dist+noiseY*0.5+wob.y;
        opacity = interpolate(rawT, [0,0.3,2,2.5], [1,0.8,0.6,0], {extrapolateRight:"clamp"});
        scale = 0.7 + Math.sin(rawT*3)*0.3;
      } else if (phase === "converge") {
        const startX = p.x+Math.cos(p.angle)*300+noiseX;
        const startY = p.y+Math.sin(p.angle)*200+noiseY;
        const prog = interpolate(rawT, [0,1.5], [0,1], {extrapolateRight:"clamp", easing: Easing.bezier(0.25,0.46,0.45,0.94)});
        const midX = (startX+640)/2+p.cpOffX*0.5;
        const midY = (startY+360)/2+p.cpOffY*0.5;
        px = quadBez(prog, startX, midX, 640)+wob.x;
        py = quadBez(prog, startY, midY, 360)+wob.y;
        opacity = interpolate(rawT, [0,0.2,1.2,1.5], [0,1,1,0], {extrapolateRight:"clamp"});
        scale = interpolate(prog, [0,0.5,1], [1,0.8,0.2], {extrapolateRight:"clamp"});
      } else {
        const tNorm = Math.min(rawT/0.8, 1);
        const d = decel(tNorm*2.5, 2.0);
        const dist = p.speed*200;
        px = quadBez(d, p.x, p.x+p.cpOffX*0.7, p.x+Math.cos(p.angle)*dist)+noiseX*2+wob.x;
        py = quadBez(d, p.y, p.y+p.cpOffY*0.7, p.y+Math.sin(p.angle)*dist)+noiseY*2+wob.y;
        opacity = interpolate(rawT, [0,0.1,0.5,1], [1,0.8,0.4,0], {extrapolateRight:"clamp"});
        scale = interpolate(rawT, [0,0.5], [1,0], {extrapolateRight:"clamp"});
      }
      if (opacity <= 0) return null;
      const s = p.size*scale;
      return <div key={p.id} style={{position:"absolute",left:px-s/2,top:py-s/2,width:s,height:s,opacity,borderRadius:p.shape==="circle"?"50%":p.shape==="diamond"?"2px":"50%",backgroundColor:p.color,transform:p.shape==="diamond"?`rotate(${45+wob.rot}deg)`:p.shape==="star"?`rotate(${rawT*60+wob.rot}deg)`:`rotate(${wob.rot}deg)`}} />;
    })}
  </>
);

/* --- SEGMENT 1: Particle Explosion --- */
const SegParticleExplosion: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const particles = useMemo(() => generateParticles(120, 42), []);
  const wob = organicWobble("pexp", frame, 4, 3, 0.025);
  const glowOp = interpolate(frame, [0,9,11,fps*1.5], [0,0.8,0.8,0], {extrapolateRight:"clamp"});
  const phase: "explode"|"swirl" = frame < fps*0.8 ? "explode" : "swirl";
  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position:"absolute",left:"50%",top:"50%",width:400,height:400,transform:`translate(calc(-50% + ${wob.x}px), calc(-50% + ${wob.y}px))`,background:"radial-gradient(circle, rgba(123,97,255,0.15) 0%, transparent 70%)",opacity:glowOp}} />
      <ParticleField frame={frame} fps={fps} particles={particles} phase={phase} />
    </AbsoluteFill>
  );
};

/* --- SEGMENT 2: Gemini Reveal --- */
const GEMINI_LETTERS = "Gemini".split("");
const LETTER_ARC_ANGLES = [-0.9,-0.4,0.3,-0.6,0.7,-0.2];
const LETTER_ARC_DIST = [60,45,55,50,65,40];

const SegGeminiReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const particles = useMemo(() => generateParticles(60, 99), []);
  const spRot = interpolate(frame, [0, fps*2], [0, 360]);
  const spMainOp = interpolate(frame, [fps*0.3,fps*0.6,fps*1.2,fps*1.5], [0,1,1,0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const spMainS = interpolate(frame, [fps*0.3,fps*0.6], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_ELASTIC_APPROX});
  const spSecOp = interpolate(frame, [fps*0.5,fps*0.7,fps*1.2,fps*1.5], [0,1,1,0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const spSecS = interpolate(frame, [fps*0.5,fps*0.7], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const spTerOp = interpolate(frame, [fps*0.6,fps*0.8,fps*1.2,fps*1.5], [0,1,1,0], {extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const spTerS = interpolate(frame, [fps*0.6,fps*0.8], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{opacity: interpolate(frame, [0,fps*2], [0.5,0], {extrapolateRight:"clamp"})}}>
        <ParticleField frame={frame} fps={fps} particles={particles} phase="scatter" />
      </div>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",alignItems:"baseline",fontSize:72,fontFamily:"'Google Sans','Product Sans',sans-serif",fontWeight:400,letterSpacing:-1}}>
        {GEMINI_LETTERS.map((letter, i) => {
          const wob = organicWobble("gl"+i, frame, 1.5, 1, 0.018);
          const spr = spring({frame, fps, delay: i*3, config:{damping:12,stiffness:120,mass:0.8}});
          const arcX = interpolate(spr, [0,1], [Math.cos(LETTER_ARC_ANGLES[i])*LETTER_ARC_DIST[i], 0]);
          const arcY = interpolate(spr, [0,1], [Math.sin(LETTER_ARC_ANGLES[i])*LETTER_ARC_DIST[i], 0]);
          const sc = interpolate(spr, [0,1], [0.7,1]);
          const op = interpolate(spr, [0,0.3], [0,1], {extrapolateRight:"clamp"});
          return <span key={i} style={{display:"inline-block",background:`linear-gradient(90deg, ${BLUE} 0%, ${PURPLE} 45%, ${PINK} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",transform:`translate(${arcX+wob.x}px,${arcY+wob.y}px) scale(${sc})`,opacity:op}}>{letter}</span>;
        })}
      </div>
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",opacity:spMainOp,transform:`scale(${spMainS})`}}><Sparkle x={640} y={300} size={36} color={PURPLE} opacity={1} rotation={spRot}/></div>
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",opacity:spSecOp,transform:`scale(${spSecS})`}}><Sparkle x={700} y={310} size={20} color={BLUE} opacity={1} rotation={-spRot*0.6}/></div>
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"100%",opacity:spTerOp,transform:`scale(${spTerS})`}}><Sparkle x={720} y={340} size={12} color={PINK} opacity={1} rotation={spRot*1.2}/></div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 3: Desktop UI --- */
const SegDesktopUI: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const helloText = "Hello, Lisa.";
  const howText = "How can I help you today?";
  const helloChars = Math.floor(interpolate(frame, [fps*0.3,fps*0.8], [0,helloText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const howChars = Math.floor(interpolate(frame, [fps*0.9,fps*1.8], [0,howText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const bs = spring({frame, fps, delay:0, config:{damping:14,stiffness:80,mass:1.0}});
  const bY = interpolate(bs, [0,1], [55,0]);
  const bSc = interpolate(bs, [0,1], [1.12,1]);
  const bRx = interpolate(bs, [0,1], [8,0]);
  const bOp = interpolate(bs, [0,0.3], [0,1], {extrapolateRight:"clamp"});
  const cSpr = [0,1,2,3].map(i => spring({frame, fps, delay: Math.floor(fps*1.5)+i*3, config:{damping:12,stiffness:100,mass:0.8}}));
  const inputOp = interpolate(frame, [fps*2.0,fps*2.5], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const discOp = interpolate(frame, [fps*1.5,fps*2.0], [0,0.6], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const cards = [{text:"Help me find YouTube videos to care for a plant",icon:"youtube"},{text:"Brainstorm presentation ideas about a topic",icon:"compass"},{text:"What are some tips to improve public speaking skills for beginners?",icon:"mic"},{text:"Come up with a product name for a new app",icon:"pen"}];

  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      <div style={{position:"absolute",width:"100%",height:"100%",background:`linear-gradient(135deg, rgba(196,181,253,0.15) 0%, rgba(232,69,139,0.08) 50%, rgba(66,133,244,0.1) 100%)`}} />
      <div style={{position:"absolute",left:"50%",top:"50%",width:904,height:524,transform:`translate(-50%,-50%) translateY(${bY}px) scale(${bSc}) perspective(1200px) rotateX(${bRx}deg)`,opacity:bOp,borderRadius:18,background:`linear-gradient(135deg, ${LAVENDER}88, ${PINK}44, ${BLUE}66, ${PURPLE}44)`,padding:2}}>
        <div style={{width:"100%",height:"100%",backgroundColor:"#FFFFFF",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",overflow:"hidden",position:"relative"}}>
          <div style={{height:48,borderBottom:"1px solid #E8E8EC",display:"flex",alignItems:"center",padding:"0 20px",gap:16}}>
            <div style={{fontSize:18,color:"#666"}}>&#9776;</div>
            <div style={{fontSize:16,fontFamily:"'Google Sans',sans-serif",color:"#444",fontWeight:500}}>Gemini <span style={{fontSize:10,color:"#999"}}>&#9660;</span></div>
            <div style={{flex:1}} />
            <div style={{width:32,height:32,borderRadius:"50%",backgroundColor:"#E8E8EC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#666"}}>+</div>
          </div>
          <div style={{padding:"50px 60px 30px",display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
            <div style={{fontSize:38,fontFamily:"'Google Sans',sans-serif",fontWeight:400,background:`linear-gradient(135deg, ${BLUE}, ${PURPLE}, ${PINK})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1.2,marginBottom:8}}>
              {helloText.slice(0, helloChars)}
              {helloChars < helloText.length && <span style={{opacity: frame%20<10?1:0, WebkitTextFillColor: BLUE}}>|</span>}
            </div>
            <div style={{fontSize:34,fontFamily:"'Google Sans',sans-serif",fontWeight:400,color:"#B0B0B8",lineHeight:1.2,marginBottom:40}}>{howText.slice(0, howChars)}</div>
            <div style={{display:"flex",gap:14}}>
              {cards.map((card, i) => {
                const cs = cSpr[i];
                return <div key={i} style={{width:165,height:100,backgroundColor:"#F6F6FA",borderRadius:12,padding:"14px 12px",fontSize:12,fontFamily:"'Google Sans',sans-serif",color:"#444",lineHeight:1.35,position:"relative",transform:`translateY(${interpolate(cs,[0,1],[40,0])}px) scale(${interpolate(cs,[0,1],[0.9,1])})`,opacity:interpolate(cs,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
                  {card.text}
                  <div style={{position:"absolute",bottom:10,left:12,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {card.icon==="youtube"&&<div style={{width:26,height:18,borderRadius:5,backgroundColor:"#FF0000",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:0,height:0,borderLeft:"8px solid white",borderTop:"5px solid transparent",borderBottom:"5px solid transparent"}} /></div>}
                    {card.icon==="compass"&&<div style={{width:24,height:24,borderRadius:"50%",backgroundColor:"#E8E8EC",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:12,height:12,borderRadius:"50%",border:"2px solid #666"}} /></div>}
                    {card.icon==="mic"&&<div style={{width:24,height:24,borderRadius:"50%",backgroundColor:`${PURPLE}22`,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:8,height:14,borderRadius:4,backgroundColor:PURPLE}} /></div>}
                    {card.icon==="pen"&&<div style={{width:24,height:24,borderRadius:"50%",backgroundColor:`${BLUE}22`,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:3,height:14,backgroundColor:BLUE,borderRadius:1,transform:"rotate(-45deg)"}} /></div>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          <div style={{position:"absolute",bottom:20,left:40,right:40,height:44,backgroundColor:"#F2F2F6",borderRadius:22,display:"flex",alignItems:"center",padding:"0 20px",fontSize:13,color:"#AAA",fontFamily:"'Google Sans',sans-serif",opacity:inputOp}}>Enter a prompt here</div>
        </div>
      </div>
      <div style={{position:"absolute",bottom:24,left:40,fontSize:11,fontFamily:"'Google Sans',sans-serif",color:"#B0B0B8",opacity:discOp}}>Sequences shortened and simulated.</div>
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
  /* Reference: ~5 rows x 3 cols, large text, center has gradient, nearby have subtle tints */
  const gridRows = 5;
  const gridCols = 3;
  const rowSpacing = 70;
  const colSpacing = 350;
  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translate(${scrollX}px,${scrollY}px) rotate(${wob.rot*0.2}deg)`,opacity:containerOp}}>
        {Array.from({length:gridRows}, (_,row) => Array.from({length:gridCols}, (_,col) => {
          const cR = Math.floor(gridRows/2);
          const cC = Math.floor(gridCols/2);
          const isCenter = row===cR&&col===cC;
          const dist = Math.sqrt(Math.pow(row-cR,2)+Math.pow(col-cC,2));
          const op = isCenter?1:interpolate(dist,[0,1,2.5],[0.5,0.25,0.08],{extrapolateRight:"clamp"});
          const cW = organicWobble(`ie${row}${col}`, frame, 1+dist*0.4, 0.8+dist*0.3, 0.015);
          const cSpr = spring({frame, fps, delay: Math.floor(dist*2)+3, config:{damping:15,stiffness:120,mass:0.5}});
          const cY = isCenter?0:interpolate(cSpr,[0,1],[20,0]);
          const cOp = isCenter?1:interpolate(cSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"});
          const cSc = isCenter?interpolate(centerSpr,[0,1],[0,1]):1;
          const hasGradient = isCenter || (dist <= 1.5 && (row+col)%2===0);
          const base: React.CSSProperties = {position:"absolute",left:(col-cC)*colSpacing+cW.x,top:(row-cR)*rowSpacing+cW.y+cY,fontSize:isCenter?48:30,fontWeight:isCenter?600:400,fontFamily:"'Google Sans',sans-serif",opacity:op*cOp,whiteSpace:"nowrap",transform:isCenter?`scale(${cSc})`:`rotate(${cW.rot*0.3}deg)`};
          if (isCenter) return <div key={`${row}-${col}`} style={{...base,background:`linear-gradient(90deg, ${PINK}, ${PURPLE}, ${BLUE})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"It\u2019s everything"}</div>;
          if (hasGradient) return <div key={`${row}-${col}`} style={{...base,background:`linear-gradient(90deg, ${PINK}66, ${PURPLE}44, ${BLUE}66)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"It\u2019s everything"}</div>;
          return <div key={`${row}-${col}`} style={{...base,color:"#9090A0"}}>{"It\u2019s everything"}</div>;
        }))}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 5: Google App Icons + "you know and love" --- */
const SegAppsFloat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const apps = [{name:"Sheets",x:240,y:170,icon:"grid"},{name:"Docs",x:370,y:140,icon:"doc"},{name:"Maps",x:540,y:155,icon:"pin"},{name:"Gmail",x:680,y:140,icon:"mail"},{name:"Drive",x:200,y:420,icon:"triangle"},{name:"YouTube",x:290,y:510,icon:"play"},{name:"Travel",x:700,y:350,icon:"plane"}];
  const tYK = spring({frame, fps, delay:0, config:{damping:14,stiffness:100,mass:0.7}});
  const tAL = spring({frame, fps, delay: Math.floor(fps*0.5), config:{damping:14,stiffness:100,mass:0.7}});
  const exitOp = interpolate(frame, [durationInFrames-10,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      {apps.map((app, i) => {
        const iSpr = spring({frame, fps, delay: i*2+1, config:{damping:10,stiffness:100,mass:0.6}});
        const fY = noise2D("app"+i, frame/35, 0)*14;
        const fX = noise2D("appx"+i, 0, frame/45)*10;
        const aW = organicWobble("afw"+i, frame, 3, 2.5, 0.02);
        return <div key={i} style={{position:"absolute",left:app.x+fX+aW.x,top:app.y+fY+aW.y,width:52,height:52,borderRadius:app.icon==="plane"?"50%":12,backgroundColor:app.icon==="plane"?"#E8F0FE":"white",transform:`rotate(${aW.rot*0.4}deg) scale(${interpolate(iSpr,[0,1],[0,1])})`,opacity:interpolate(iSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"}),display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(0,0,0,0.08)",overflow:"hidden"}}>
          {app.icon==="pin"&&<svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/><circle cx="12" cy="9" r="2.5" fill="#B31412"/><path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84L12 9V2z" fill="#34A853"/></svg>}
          {app.icon==="mail"&&<svg width="28" height="20" viewBox="0 0 28 20"><rect x="0" y="0" width="28" height="20" rx="2" fill="white" stroke="#D5D5D5" strokeWidth="0.5"/><path d="M0 2L14 12L28 2" stroke="#EA4335" strokeWidth="2.5" fill="none"/><path d="M0 2L14 12" stroke="#34A853" strokeWidth="2.5" fill="none" opacity="0.7"/><path d="M28 2L14 12" stroke="#FBBC04" strokeWidth="2.5" fill="none" opacity="0.7"/></svg>}
          {app.icon==="plane"&&<svg width="24" height="24" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#4285F4"/></svg>}
          {app.icon==="doc"&&<svg width="24" height="30" viewBox="0 0 24 30"><rect x="0" y="0" width="24" height="30" rx="2" fill="#4285F4"/><rect x="5" y="8" width="14" height="2" rx="1" fill="white"/><rect x="5" y="13" width="14" height="2" rx="1" fill="white"/><rect x="5" y="18" width="10" height="2" rx="1" fill="white"/></svg>}
          {app.icon==="play"&&<div style={{width:36,height:26,borderRadius:6,backgroundColor:"#FF0000",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:0,height:0,borderLeft:"10px solid white",borderTop:"6px solid transparent",borderBottom:"6px solid transparent"}} /></div>}
          {app.icon==="grid"&&<svg width="28" height="28" viewBox="0 0 28 28"><rect x="0" y="0" width="28" height="28" rx="4" fill="#34A853"/><rect x="6" y="6" width="6" height="6" rx="1" fill="white"/><rect x="16" y="6" width="6" height="6" rx="1" fill="white"/><rect x="6" y="16" width="6" height="6" rx="1" fill="white"/><rect x="16" y="16" width="6" height="6" rx="1" fill="white"/></svg>}
          {app.icon==="triangle"&&<svg width="30" height="26" viewBox="0 0 30 26"><path d="M15 0L30 26H0Z" fill="#FBBC04"/><path d="M15 0L0 26H15Z" fill="#34A853"/><path d="M15 0L30 26H15Z" fill="#4285F4"/></svg>}
        </div>;
      })}
      {(() => {
        const tw = organicWobble("ykl", frame, 1.5, 1, 0.018);
        return <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) rotate(${tw.rot*0.15}deg)`,display:"flex",gap:12,fontSize:30,fontFamily:"'Google Sans',sans-serif",fontWeight:400,color:DARK}}>
          <span style={{display:"inline-block",transform:`translateY(${interpolate(tYK,[0,1],[18,0])}px)`,opacity:interpolate(tYK,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>you know</span>
          <span style={{display:"inline-block",transform:`translateY(${interpolate(tAL,[0,1],[18,0])}px)`,opacity:interpolate(tAL,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>and love</span>
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
  const fullText = "Summarize my recent emails from Harper Elementary School";
  const charCount = Math.floor(interpolate(frame, [0,durationInFrames*0.85], [0,fullText.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const bs = spring({frame, fps, delay:0, config:{damping:12,stiffness:100,mass:0.8}});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:"#FAFAFA",opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translateY(${interpolate(bs,[0,1],[25,0])+wob.y}px) scale(${interpolate(bs,[0,1],[0.96,1])}) rotate(${wob.rot*0.1}deg)`,width:780,opacity:interpolate(bs,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
        <div style={{backgroundColor:"#EDECF2",borderRadius:28,padding:"22px 32px",fontSize:26,fontFamily:"'Google Sans',sans-serif",fontWeight:400,color:"#444",minHeight:36,lineHeight:1.4}}>
          {fullText.slice(0, charCount)}
          {charCount < fullText.length && <span style={{display:"inline-block",width:2,height:28,backgroundColor:"#666",marginLeft:1,opacity:frame%20<12?1:0,verticalAlign:"text-bottom"}} />}
        </div>
      </div>
      <div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",fontSize:11,fontFamily:"'Google Sans',sans-serif",color:"#B0B0B0",opacity:interpolate(frame,[fps*0.5,fps],[0,0.6],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART})}}>
        Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 7: Gemini Response Streaming --- */
const SegGeminiResponse: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const wob = organicWobble("gresp", frame, 1.2, 0.8, 0.012);
  const resp = "You have two recent emails from Harper Elementary.\n\nThe first email is the Harper Elementary School Newsletter for October 2025. It includes information\nabout upcoming events, such as Crazy Hat Day on October 8th and the Fall Festival on October 23rd.\nit also mentions a teacher appreciation event.\n\nThe second email is a call for parent volunteers. It asks parents to sign up by October 15th if they are\ninterested in volunteering...";
  const respChars = Math.floor(interpolate(frame, [fps*0.2,durationInFrames*0.85], [0,resp.length], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}));
  const cs = spring({frame, fps, delay:0, config:{damping:14,stiffness:80,mass:1.0}});
  const chSpr = spring({frame, fps, delay: Math.floor(fps*0.3), config:{damping:12,stiffness:120,mass:0.6}});
  const ecSpr = [0,1].map(i => spring({frame, fps, delay: Math.floor(durationInFrames*0.7)+i*3, config:{damping:14,stiffness:100,mass:0.7}}));
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:"#FAFAFA",opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translateY(${interpolate(cs,[0,1],[35,0])+wob.y}px) scale(${interpolate(cs,[0,1],[0.92,1])})`,opacity:interpolate(cs,[0,0.3],[0,1],{extrapolateRight:"clamp"}),perspective:1200,width:960,height:580,backgroundColor:"#FFFFFF",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",overflow:"hidden",display:"flex"}}>
        <div style={{width:4,backgroundColor:PURPLE,flexShrink:0}} />
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{height:44,borderBottom:"1px solid #E8E8EC",display:"flex",alignItems:"center",padding:"0 20px",gap:12}}>
            <div style={{fontSize:16,color:"#666"}}>&#9776;</div>
            <div style={{fontSize:14,fontFamily:"'Google Sans',sans-serif",color:"#444",fontWeight:500}}>Gemini <span style={{fontSize:10,color:"#999"}}>&#9660;</span></div>
            <div style={{flex:1}} />
            <div style={{fontSize:12,fontFamily:"'Google Sans',sans-serif",color:"#888",opacity:interpolate(frame,[fps*2,fps*3],[0,0.6],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>Drafts</div>
            <div style={{width:28,height:28,borderRadius:"50%",backgroundColor:"#E8E8EC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#666"}}>+</div>
          </div>
          <div style={{flex:1,padding:"20px 28px",overflow:"hidden"}}>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg, #D4A574, #8B6F47)",flexShrink:0}} />
              <div style={{fontSize:13,fontFamily:"'Google Sans',sans-serif",color:"#444",fontStyle:"italic",paddingTop:4}}>Summarize my recent emails from Harper Elementary School</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,marginLeft:38,transform:`scale(${interpolate(chSpr,[0,1],[0.8,1])})`,opacity:interpolate(chSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0L9 5L14 7L9 9L7 14L5 9L0 7L5 5Z" fill={BLUE}/></svg>
              <div style={{padding:"5px 12px",borderRadius:16,border:"1px solid #E0E0E4",fontSize:12,fontFamily:"'Google Sans',sans-serif",fontWeight:500,color:"#444",display:"flex",alignItems:"center",gap:5}}>Google Workspace <span style={{fontSize:9,color:"#999"}}>&#9660;</span></div>
            </div>
            <div style={{fontSize:13,fontFamily:"'Google Sans',sans-serif",color:"#333",lineHeight:1.7,whiteSpace:"pre-wrap",marginLeft:38}}>{resp.slice(0, respChars)}</div>
            <div style={{display:"flex",gap:12,marginTop:20,marginLeft:38}}>
              {[{title:"Harper Elementary Newsletter",sub:"Harper Elementary",color:BLUE},{title:"Calling for Parent Volunteers",sub:"Harper Elementary",color:PINK}].map((card, ci) => {
                const e = ecSpr[ci];
                return <div key={ci} style={{flex:1,height:65,backgroundColor:"#F6F6FA",borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${card.color}`,transform:`translateY(${interpolate(e,[0,1],[15,0])}px)`,opacity:interpolate(e,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}><div style={{fontSize:11,fontWeight:600,color:"#333",fontFamily:"'Google Sans',sans-serif",marginBottom:4}}>{card.title}</div><div style={{fontSize:10,color:"#888",fontFamily:"'Google Sans',sans-serif"}}>{card.sub}</div></div>;
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",fontSize:10,fontFamily:"'Google Sans',sans-serif",color:"#B0B0B0",opacity:interpolate(frame,[fps*0.5,fps],[0,0.5],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART})}}>Sequences shortened and simulated. With Google Workspace extension enabled. Check the responses for accuracy. Availability varies by country.</div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 8: And moooore --- */
const GEMINI_BALLS = ["#4285F4","#EA4335","#FBBC04","#34A853","#7B61FF"];
const MAX_BALLS = 18;

const SegAndMore: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const stretchStart = fps;
  const stretchRaw = frame - stretchStart;
  const stretch = stretchRaw > 0 ? interpolate(stretchRaw, [0,fps*2], [0,1], {extrapolateRight:"clamp",easing:Easing.bezier(0.22,0.1,0.25,1)}) : 0;
  const oCount = Math.floor(interpolate(stretch, [0,0.8], [1,MAX_BALLS], {extrapolateRight:"clamp"}));
  const ballProgress = stretch > 0.15 ? interpolate(stretch, [0.15,0.5], [0,1], {extrapolateRight:"clamp"}) : 0;
  const scrollX = interpolate(stretch, [0.1,1], [0,-420], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.bezier(0.2,0,0.3,1)});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  const aSpr = spring({frame, fps, delay:0, config:{damping:10,stiffness:100,mass:0.6}});
  const mOp = interpolate(frame, [fps*0.5,fps*0.9], [0,1], {extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:EASE_OUT_QUART});
  const aW = organicWobble("and8", frame, 2, 2.5, 0.015);

  const renderBalls = () => Array.from({length:oCount}, (_,i) => {
    const bd = stretchStart+i*2.2;
    const damp = 6+(i%5)*1.4;
    const stiff = 120+(i%3)*30;
    const mass = 0.4+(i%4)*0.15;
    const bR = Math.max(0, frame-bd);
    const bT = Math.min(bR/(fps*0.5), 1);
    const om = Math.sqrt(stiff/mass);
    const z = damp/(2*Math.sqrt(stiff*mass));
    const bS = bT<=0?0:1-Math.exp(-z*om*bT/fps*15)*Math.cos(om*Math.sqrt(1-z*z)*bT/fps*15);
    const cS = Math.max(0,Math.min(1.3,bS));
    const sz = 28*Math.min(cS,1);
    const bOp = interpolate(cS,[0,0.4],[0,1],{extrapolateRight:"clamp"});
    const lOp = interpolate(ballProgress,[0,0.6],[1,0],{extrapolateRight:"clamp"});
    const wA = interpolate(stretch,[0.2,0.5],[0,18],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
    const wY = Math.sin(frame*(0.11+(i%4)*0.025)+i*0.55+(i%3)*0.35)*wA*Math.min(cS,1);
    const wX = noise2D("bx"+i,frame*0.025,i)*3*Math.min(cS,1);
    const col = GEMINI_BALLS[i%GEMINI_BALLS.length];
    const sO = interpolate(cS,[0,0.3,0.6,1,1.3],[0.15,1.3,0.9,1,1.1],{extrapolateRight:"clamp"});
    return <span key={i} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",position:"relative",width:Math.max(sz+2,14),height:Math.max(sz+2,30),transform:`translateY(${wY}px) translateX(${wX}px)`}}>
      {lOp>0.01&&<span style={{position:"absolute",opacity:lOp*Math.min(cS*3,1),color:BLUE,fontSize:44}}>o</span>}
      {cS>0.01&&<div style={{width:sz,height:sz,borderRadius:"50%",backgroundColor:col,opacity:bOp,transform:`scale(${sO})`,boxShadow:cS>0.5?`0 2px 8px ${col}44`:undefined}} />}
    </span>;
  });

  return (
    <AbsoluteFill style={{backgroundColor:BG_WARM,opacity:exitOp}}>
      <div style={{position:"absolute",width:"100%",height:"100%",background:"radial-gradient(ellipse at 55% 40%, rgba(232,69,139,0.035) 0%, rgba(196,181,253,0.025) 35%, transparent 60%)"}} />
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translateX(${scrollX}px)`,display:"flex",alignItems:"center",flexWrap:"nowrap",gap:stretch>0.1?1:12,fontSize:44,fontFamily:"'Google Sans',sans-serif",fontWeight:400,whiteSpace:"nowrap"}}>
        <span style={{color:DARK,transform:`translateY(${interpolate(aSpr,[0,1],[20,0])+aW.y}px) translateX(${aW.x}px)`,display:"inline-block",marginRight:4,opacity:interpolate(aSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>And</span>
        {stretch<=0.02 ? <span style={{color:BLUE,fontSize:44,opacity:mOp}}>more</span> : <>
          <span style={{color:BLUE,fontSize:44,display:"inline-block",opacity:mOp}}>m</span>
          {renderBalls()}
          <span style={{color:BLUE,fontSize:44,display:"inline-block",marginLeft:-6}}>re</span>
        </>}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 9: Starting with the new Gemini app --- */
const SegStartingWith: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const words = ["Starting","with","the","new","Gemini","app"];
  const rng = useMemo(() => seededRandom(777), []);
  const scatterVectors = useMemo(() => words.map(() => ({x:(rng()-0.5)*600,y:(rng()-0.5)*440,rot:(rng()-0.5)*50})), []);
  const scatterPhase = frame > durationInFrames - fps*0.5;
  const scatterProg = scatterPhase ? interpolate(frame, [durationInFrames-fps*0.5,durationInFrames], [0,1], {extrapolateRight:"clamp",easing:EASE_IN_QUART}) : 0;
  const exitOp = interpolate(frame, [durationInFrames-5,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",gap:14,fontSize:40,fontFamily:"'Google Sans',sans-serif",fontWeight:400}}>
        {words.map((word, i) => {
          const wW = organicWobble(`sw${i}`, frame, 2, 1.5, 0.02);
          const wSpr = spring({frame, fps, delay: i*4, config:{damping:12,stiffness:100,mass:0.8}});
          const sv = scatterVectors[i];
          return <span key={i} style={{display:"inline-block",color:DARK,transform:`translate(${wW.x+scatterProg*sv.x}px,${interpolate(wSpr,[0,1],[30,0])+wW.y+scatterProg*sv.y}px) rotate(${scatterProg*sv.rot}deg) scale(${interpolate(scatterProg,[0,1],[1,0.6])})`,opacity:interpolate(wSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})*interpolate(scatterProg,[0,0.8],[1,0]),fontWeight:400}}>{word}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 10: Phone Mockup --- */
const SegPhoneMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const pW = organicWobble("ph10", frame, 2.5, 2, 0.018);
  /* Phone enters from below-right, moderate speed */
  const eP = interpolate(frame, [0,fps*1.5], [0,1], {extrapolateRight:"clamp",easing:EASE_OUT_EXPO});
  const pX = cubicBez(eP, 150, 120, 30, 0);
  const pY = cubicBez(eP, 550, 380, 60, 0);
  const pR = interpolate(eP, [0,1], [6,0]);
  const pS = interpolate(eP, [0,1], [0.75,1]);
  const pOp = interpolate(eP, [0,0.05], [0,1], {extrapolateRight:"clamp"});
  const sF = frame - fps*1.5;
  const sB = sF>0 ? interpolate(sF, [0,4,13], [0,-8,0], {extrapolateRight:"clamp"}) : 0;
  const hiSpr = spring({frame, fps, delay: Math.floor(fps*0.6), config:{damping:14,stiffness:100,mass:0.7}});
  const bdSpr = spring({frame, fps, delay: fps, config:{damping:14,stiffness:100,mass:0.7}});
  const exitOp = interpolate(frame, [durationInFrames-8,durationInFrames], [1,0], {extrapolateRight:"clamp",extrapolateLeft:"clamp"});
  return (
    <AbsoluteFill style={{backgroundColor:BG,opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translate(${pX+pW.x}px,${pY+sB+pW.y}px) rotate(${pR}deg) scale(${pS})`,opacity:pOp,width:320,height:620,backgroundColor:"#FFFFFF",borderRadius:40,border:"3px solid #1A1A2E",overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)"}}>
        <div style={{height:44,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 20px 0",fontSize:13,fontWeight:600,color:"#333"}}>
          <span>9:30</span>
          <div style={{width:80,height:24,borderRadius:12,backgroundColor:"#000"}} />
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:13,fontWeight:700}}>5G</span>
            <div style={{display:"flex",alignItems:"flex-end",gap:1.5,height:12}}>{[5,7,9,12].map((h,j)=><div key={j} style={{width:3,height:h,backgroundColor:"#333",borderRadius:1}} />)}</div>
            <div style={{width:20,height:10,border:"1.5px solid #333",borderRadius:2,position:"relative",marginLeft:2}}><div style={{position:"absolute",inset:1.5,backgroundColor:"#333",borderRadius:0.5}} /><div style={{position:"absolute",right:-4,top:2,width:3,height:6,backgroundColor:"#333",borderRadius:"0 1px 1px 0"}} /></div>
          </div>
        </div>
        <div style={{padding:"30px 24px"}}>
          <div style={{transform:`translateY(${interpolate(hiSpr,[0,1],[20,0])}px)`,opacity:interpolate(hiSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
            <span style={{fontSize:36,fontWeight:700,fontFamily:"'Google Sans',sans-serif",color:PURPLE}}>Hi</span>{" "}
            <span style={{fontSize:36,fontWeight:700,fontFamily:"'Google Sans',sans-serif",color:DARK}}>{"I'm "}</span>
            <span style={{fontSize:36,fontWeight:700,fontFamily:"'Google Sans',sans-serif",background:`linear-gradient(135deg, ${PINK}, ${PURPLE})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Gemini,</span>
          </div>
          <div style={{marginTop:8,transform:`translateY(${interpolate(bdSpr,[0,1],[15,0])}px)`,opacity:interpolate(bdSpr,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
            <div style={{fontSize:32,fontWeight:700,fontFamily:"'Google Sans',sans-serif",color:DARK,lineHeight:1.2}}>an experimental<br/>AI assistant on<br/>your phone.</div>
            <div style={{marginTop:24,fontSize:16,fontFamily:"'Google Sans',sans-serif",color:"#666",lineHeight:1.5}}>I can help you write, plan, learn, and more.</div>
          </div>
        </div>
        <div style={{position:"absolute",top:58,right:20,width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg, #D4A574, #8B6F47)",border:"2px solid #DDD"}} />
      </div>
      <div style={{position:"absolute",bottom:20,left:30,fontSize:11,fontFamily:"'Google Sans',sans-serif",color:"#B0B0B8",opacity:interpolate(frame,[fps,fps*1.5],[0,0.5],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>The Gemini mobile app is available for select devices, languages and locations.</div>
    </AbsoluteFill>
  );
};

/* --- SEGMENT 11: Designed to supercharge your ideas --- */
const SegSupercharge: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wCfg = [{text:"Designed",accent:false,delay:0,fontSize:36,italic:false},{text:"to",accent:false,delay:5,fontSize:36,italic:false},{text:"supercharge",accent:true,delay:10,fontSize:42,italic:true},{text:"your",accent:false,delay:18,fontSize:34,italic:true},{text:"ideas",accent:false,delay:23,fontSize:38,italic:true}];
  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",display:"flex",gap:12,alignItems:"baseline"}}>
        {wCfg.map((w, i) => {
          const sw = organicWobble(`sc${i}`, frame, 2, 1.5, 0.02);
          const spr = spring({frame, fps, delay: w.delay, config: w.accent?{damping:8,stiffness:80,mass:0.8}:{damping:12,stiffness:100,mass:0.7}});
          const wY = interpolate(spr, [0,1], [w.accent?35:25, 0]);
          const wS = w.accent?interpolate(spr,[0,1],[0.7,1]):interpolate(spr,[0,1],[0.95,1]);
          const wOp = interpolate(spr, [0,0.3], [0,1], {extrapolateRight:"clamp"});
          const base: React.CSSProperties = {display:"inline-block",fontSize:w.fontSize,fontFamily:"'Google Sans',sans-serif",fontWeight:w.accent?500:400,fontStyle:w.italic?"italic":"normal",transform:`translate(${sw.x}px,${wY+sw.y}px) scale(${wS})`,opacity:wOp};
          if (w.accent) return <span key={i} style={{...base,background:`linear-gradient(90deg, ${PINK} 0%, ${PURPLE} 50%, ${BLUE} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{w.text}</span>;
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

/* --- SEGMENT 12: Phone Good Morning + Camera/Dog --- */
const SegPhoneGoodMorning: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const pW = organicWobble("ph12", frame, 2, 1.5, 0.018);
  const camT = frame>durationInFrames*0.5 ? interpolate(frame, [durationInFrames*0.5,durationInFrames*0.6], [0,1], {extrapolateRight:"clamp"}) : 0;
  /* No fade-out: hard cut to Scene04 preserves phone continuity */
  const exitOp = 1;
  const eP = interpolate(frame, [0,fps], [0,1], {extrapolateRight:"clamp",easing:EASE_OUT_EXPO});
  const pX = cubicBez(eP, 200, 150, 30, -30);
  const pY = cubicBez(eP, 350, 250, 30, -20);
  const pR = interpolate(eP, [0,1], [12,5]);
  const pS = interpolate(eP, [0,0.3,1], [0.6,0.78,0.85], {extrapolateRight:"clamp"});
  const pOp = interpolate(eP, [0,0.1], [0,1], {extrapolateRight:"clamp"});
  const sF = frame-fps;
  const sB = sF>0 ? interpolate(sF, [0,3,10], [0,-6,0], {extrapolateRight:"clamp"}) : 0;
  const cSpr = [0,1,2].map(i => spring({frame, fps, delay: Math.floor(fps*0.3)+i*6, config:{damping:14,stiffness:100,mass:0.7}}));
  return (
    <AbsoluteFill style={{backgroundColor:"#FAFAFA",opacity:exitOp}}>
      <div style={{position:"absolute",left:"50%",top:"50%",transform:`translate(-50%,-50%) translate(${pX+pW.x}px,${pY+sB+pW.y}px) rotate(${pR}deg) scale(${pS})`,opacity:pOp,width:320,height:620,borderRadius:40,border:"6px solid #1A1A2E",overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)"}}>
        <div style={{position:"absolute",inset:0,backgroundColor:"#FFFFFF",opacity:1-camT,padding:"60px 24px 24px"}}>
          <div style={{fontSize:28,fontFamily:"'Google Sans',sans-serif",fontWeight:500,background:`linear-gradient(135deg, ${BLUE}, ${PURPLE})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:24}}>Good morning</div>
          {[0,1,2].map(ci => {
            const s = cSpr[ci];
            return <div key={ci} style={{height:60,backgroundColor:"#F4F4F8",borderRadius:12,marginBottom:10,padding:"12px 16px",fontSize:12,fontFamily:"'Google Sans',sans-serif",color:"#666",transform:`translateY(${interpolate(s,[0,1],[15,0])}px)`,opacity:interpolate(s,[0,0.3],[0,1],{extrapolateRight:"clamp"})}}>
              {ci===0&&"Find videos on how to care for a plant"}
              {ci===1&&"Summarize your travel reservations for July"}
              {ci===2&&"Create a playlist for a road trip"}
            </div>;
          })}
          <div style={{position:"absolute",bottom:24,left:24,right:24}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:12,color:"#999"}}><span>Chats</span><span>&#9998;</span></div>
            <div style={{height:44,backgroundColor:"#EDEDF1",borderRadius:22,display:"flex",alignItems:"center",padding:"0 16px",fontSize:13,color:"#AAA"}}>Type, talk, or share a photo</div>
          </div>
        </div>
        <div style={{position:"absolute",inset:0,backgroundColor:"#1A1A2E",opacity:camT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:"100%",height:"75%",background:"linear-gradient(180deg, #87CEEB 0%, #90B86C 30%, #78A55A 50%, #8B7355 70%, #C4A67A 100%)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            <div style={{width:120,height:100,borderRadius:"40% 40% 20% 20%",backgroundColor:"#D4A574",position:"relative"}}>
              <div style={{position:"absolute",top:-12,left:8,width:24,height:20,borderRadius:"50% 50% 0 0",backgroundColor:"#C4956A",transform:"rotate(-15deg)"}} />
              <div style={{position:"absolute",top:-12,right:8,width:24,height:20,borderRadius:"50% 50% 0 0",backgroundColor:"#C4956A",transform:"rotate(15deg)"}} />
              <div style={{position:"absolute",top:20,left:28,width:8,height:8,borderRadius:"50%",backgroundColor:"#333"}} />
              <div style={{position:"absolute",top:20,right:28,width:8,height:8,borderRadius:"50%",backgroundColor:"#333"}} />
              <div style={{position:"absolute",top:38,left:"50%",transform:"translateX(-50%)",width:12,height:8,borderRadius:"50%",backgroundColor:"#333"}} />
            </div>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:30}}>
            <div style={{width:54,height:54,borderRadius:"50%",border:"3px solid white",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:44,height:44,borderRadius:"50%",backgroundColor:"rgba(255,255,255,0.9)"}} /></div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* === MAIN SCENE 03 === */
export const Scene03: React.FC = () => {
  const segments: {start:number;dur:number;Comp:React.FC}[] = [
    {start:0,dur:50,Comp:SegParticleExplosion},
    {start:45,dur:50,Comp:SegGeminiReveal},
    {start:90,dur:95,Comp:SegDesktopUI},
    {start:185,dur:30,Comp:SegItsEverything},
    {start:208,dur:55,Comp:SegAppsFloat},
    {start:255,dur:80,Comp:SegTypingPrompt},
    {start:330,dur:40,Comp:SegGeminiResponse},
    {start:365,dur:55,Comp:SegAndMore},
    {start:416,dur:62,Comp:SegStartingWith},
    {start:476,dur:84,Comp:SegPhoneMockup},
    {start:555,dur:85,Comp:SegSupercharge},
    {start:635,dur:110,Comp:SegPhoneGoodMorning},
  ];
  return (
    <AbsoluteFill style={{backgroundColor:BG}}>
      {segments.map(({start,dur,Comp}, i) => (
        <Sequence key={i} from={start} durationInFrames={dur} name={`seg-${i}`}><Comp /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const scene03Meta = {
  id: "OFScene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 745,
};
