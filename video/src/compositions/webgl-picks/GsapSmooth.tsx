// Source: https://codepen.io/GreenSock/pen/OPPjMQV
//
// GSAP "free for all!" confetti celebration — ported to Remotion.
// Original: SVG viewBox 0 0 2058 871. All path data copied verbatim.
// Timeline: 1s delay, "explode" label at 1s, "flight" label at 1.3s.
// 22 confetti pieces, SplitText chars, CustomBounce poly, Physics2D confetti,
// MotionPath plane, DrawSVG paths, sprinkle/wiggle/spin/hand reveals.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

// ── Timing ────────────────────────────────────────────────────────────────────
// Original: gsap.timeline({ delay: 1 }), labels "explode" at 1, "flight" at 1.3
// Absolute seconds: delay=1, so explode = 1+1 = 2s, flight = 1+1.3 = 2.3s
// We map into 600 frames @ 60fps (10s). Keep original absolute timing.

const DELAY = 1.0;
const EXPLODE = DELAY + 1.0; // 2.0s
const FLIGHT = DELAY + 1.3; // 2.3s

// ── Easing ────────────────────────────────────────────────────────────────────

function backOut(t: number, overshoot = 1.70158): number {
  const c = t - 1;
  return c * c * ((overshoot + 1) * c + overshoot) + 1;
}

function backOutStrong(t: number): number {
  return backOut(t, 4);
}

function elasticOut(t: number, amp = 1, per = 0.3): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = (per / (2 * Math.PI)) * Math.asin(1 / amp);
  return amp * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / per) + 1;
}

function expoOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function sineInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function customBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { const a = t - 1.5 / 2.75; return 7.5625 * a * a + 0.75; }
  if (t < 2.5 / 2.75) { const a = t - 2.25 / 2.75; return 7.5625 * a * a + 0.9375; }
  const a = t - 2.625 / 2.75;
  return 7.5625 * a * a + 0.984375;
}

// CustomBounce "myBounce" { strength: 0.6, squash: 3 }
function customBounceSquash(t: number): number {
  const b = customBounce(t);
  return 1 + (1 - b) * 0.4 * Math.sin(t * Math.PI * 6);
}

// ── Seeded random ─────────────────────────────────────────────────────────────

function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rr(seed: number, min: number, max: number): number {
  return min + srand(seed) * (max - min);
}

// ── Progress helper ───────────────────────────────────────────────────────────

function prog(frame: number, fps: number, startSec: number, durSec: number): number {
  const s = startSec * fps;
  const d = durSec * fps;
  if (d === 0) return frame >= s ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - s) / d));
}

// ── Coordinate mapping: original SVG 2058x871 → 1920x1080 ────────────────────

const OW = 2058;
const OH = 871;

function mx(x: number): number { return (x / OW) * 1920; }
function my(y: number): number { return (y / OH) * 1080; }

// ── SVG: Starburst (#bang) ────────────────────────────────────────────────────
// Original: two paths with same d, one with linear gradient, one with noise pattern overlay.
// GSAP: from("#bang, #spin", { duration: 0.7, scale: 0, rotation: -60, ease: "back.out(4)" }, "explode+=.1")

const BANG_PATH = "M833.956 626.101L747.149 801.943C745.505 805.265 749.467 808.518 752.373 806.239L932.942 664.473C934.689 663.099 937.25 663.708 938.201 665.725L981.674 758.526C983.006 761.361 987.106 761.117 988.092 758.143L1032.59 623.926C1033.4 621.474 1036.49 620.743 1038.31 622.569L1166.26 751.22C1169.02 754.003 1173.56 750.733 1171.79 747.202L1087.08 576.839C1085.69 574.073 1088.34 570.995 1091.26 571.986L1216.42 613.942C1219.88 615.107 1222.55 610.776 1219.97 608.184L1087.3 474.785C1085.49 472.959 1086.21 469.845 1088.65 469.027L1210.09 428.324C1213.81 427.072 1212.93 421.54 1209 421.54H1089.81C1087.04 421.54 1085.4 418.444 1086.94 416.13L1174.11 284.645C1176.08 281.67 1172.86 278 1169.68 279.6L988.922 370.47C987.036 371.409 984.753 370.47 984.096 368.452L939.654 234.374C938.599 231.209 934.136 231.209 933.098 234.374L889.158 366.921C888.345 369.374 885.248 370.104 883.432 368.278L798.528 282.905C796.019 280.383 791.833 282.818 792.732 286.262L825.998 411.382C826.777 414.304 823.75 416.757 821.068 415.382L662.071 333.176C658.56 331.367 655.256 335.924 658.041 338.725L785.432 466.818C787.248 468.645 786.522 471.758 784.083 472.576L662.642 513.279C658.923 514.532 659.805 520.063 663.732 520.063H787.629C790.431 520.063 792.075 523.229 790.466 525.542L697.414 659.22C695.493 661.968 698.175 665.586 701.34 664.508L829.752 621.265C832.676 620.273 835.323 623.335 833.956 626.118V626.101Z";

const BangShape: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOutStrong(p);
  const scale = interpolate(ep, [0, 1], [0, 1]);
  const rot = interpolate(ep, [0, 1], [-60, 0]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        transform: `scale(${scale}) rotate(${rot}deg)`,
        transformOrigin: `${mx(937)}px ${my(520)}px`,
      }}
    >
      <defs>
        <linearGradient id="bangGrad" x1="341.328" y1="165.489" x2="1348.16" y2="553.463" gradientUnits="userSpaceOnUse">
          <stop offset="0.427083" stopColor="#FF8709" />
          <stop offset="0.791667" stopColor="#F7BDF8" />
        </linearGradient>
      </defs>
      <path d={BANG_PATH} fill="url(#bangGrad)" transform={`scale(${1920/OW}, ${1080/OH})`} />
    </svg>
  );
};

// ── SVG: Wiggle shape (#wiggle) ───────────────────────────────────────────────
// GSAP: from("#wiggle", { duration: 0.7, scale: 0, rotation: 60, ease: "back.out(4)" }, "explode+=.4")

const WIGGLE_PATH = "M890.757 732.409C873.509 732.409 860.512 731.11 849.85 728.297C819.605 720.346 810.296 700.231 807.443 688.947C803.899 674.95 804.562 653.594 827.861 631.243C835.873 623.566 846.55 615.514 861.463 605.933C885.771 590.32 917.861 572.903 951.823 554.448C971.001 544.03 991.981 532.645 1011.78 521.346C1004.27 522.226 996.592 523.15 988.797 524.088C935.252 530.509 874.576 537.782 822.66 537.782C798.308 537.782 779.49 535.891 765.124 532.01C734.288 523.669 722.689 505.488 718.41 491.708C714.894 480.438 712.17 457.913 733.381 433.671C740.254 425.807 749.36 417.986 761.219 409.79C762.631 408.809 765.095 407.15 768.438 404.899C773.928 401.19 782.069 395.693 791.824 388.983L760.556 352.649L793.899 323.847C795.037 322.866 821.997 299.649 853.855 278.74C873.826 265.638 891.91 255.97 907.616 250.011C936.592 239.001 961.347 239.347 981.189 251.006C996.866 260.227 1006.56 276.489 1007.13 294.497C1008.09 325.319 984.892 354.496 918.509 406.01C899.1 421.074 878.812 435.764 861.017 448.274C898.956 445.994 940.497 441.002 978.307 436.471C1016.04 431.94 1051.68 427.669 1079.4 426.558C1096.55 425.879 1109.59 426.399 1120.44 428.231C1149.42 433.094 1162.38 448.318 1168.16 460.236C1175.44 475.243 1175.11 492.415 1167.24 508.576C1163.1 517.061 1156.75 525.545 1147.83 534.477C1120.03 562.312 1065.06 593.235 1009.37 623.566C1051.52 609.324 1078.59 592.86 1079.07 592.571L1078.97 592.643L1125.61 667.519C1121.37 670.174 1020.25 732.395 890.771 732.395L890.757 732.409Z";

const WiggleShape: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOutStrong(p);
  const scale = interpolate(ep, [0, 1], [0, 1]);
  const rot = interpolate(ep, [0, 1], [60, 0]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        transform: `scale(${scale}) rotate(${rot}deg)`,
        transformOrigin: `${mx(940)}px ${my(490)}px`,
      }}
    >
      <defs>
        <linearGradient id="wiggleGrad" x1="695.52" y1="382.901" x2="1221.75" y2="474.027" gradientUnits="userSpaceOnUse">
          <stop offset="0.0242443" stopColor="#0A157A" />
          <stop offset="0.93898" stopColor="#9D95FF" />
        </linearGradient>
      </defs>
      <path d={WIGGLE_PATH} fill="url(#wiggleGrad)" transform={`scale(${1920/OW}, ${1080/OH})`} />
    </svg>
  );
};

// ── SVG: Spin shape (#spin) ───────────────────────────────────────────────────
// GSAP: same as bang — from("#bang, #spin", { duration: 0.7, scale: 0, rotation: -60, ease: "back.out(4)" }, "explode+=.1")

const SPIN_PATH = "M1122.34 375.405C1122.45 375.008 1122.25 374.601 1121.87 374.451C1101.02 366.065 1089.13 344.311 1094.88 323.286C1100.64 302.26 1122.05 289.271 1144.38 292.258C1144.78 292.312 1145.17 292.06 1145.28 291.663L1153.28 262.468C1153.4 262.013 1153.12 261.547 1152.66 261.462C1112.31 253.932 1072.68 276.799 1062.29 314.709C1051.9 352.62 1074.53 391.867 1113.29 405.168C1113.74 405.32 1114.22 405.057 1114.35 404.602L1122.35 375.408L1122.34 375.405Z";

const SpinShape: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOutStrong(p);
  const scale = interpolate(ep, [0, 1], [0, 1]);
  const rot = interpolate(ep, [0, 1], [-60, 0]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        transform: `scale(${scale}) rotate(${rot}deg)`,
        transformOrigin: `${mx(1107)}px ${my(333)}px`,
      }}
    >
      <defs>
        <linearGradient id="spinGrad" x1="1215.64" y1="306.624" x2="1025.13" y2="256.799" gradientUnits="userSpaceOnUse">
          <stop offset="0.26957" stopColor="#FEC5FB" />
          <stop offset="0.838196" stopColor="#00BAE2" />
        </linearGradient>
      </defs>
      <path d={SPIN_PATH} fill="url(#spinGrad)" transform={`scale(${1920/OW}, ${1080/OH})`} />
    </svg>
  );
};

// ── SVG: FFD icon (#ffd) ──────────────────────────────────────────────────────
// GSAP: from("#ffd", { xPercent: -800, opacity: 0, ease: "back.out" }, "explode")

const FFD_PATH = "M906.652 763.429C906.652 760.441 910.072 758.744 912.451 760.552L947.419 787.123C949.322 788.569 949.322 791.431 947.419 792.877L912.451 819.447C910.072 821.255 906.653 819.559 906.652 816.571V797.522L877.799 819.447C875.42 821.255 872 819.559 872 816.571V763.429C872 760.441 875.42 758.744 877.799 760.552L906.652 782.476V763.429Z";

const FFDIcon: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOut(p);
  const xPct = interpolate(ep, [0, 1], [-800, 0]);
  const opacity = interpolate(p, [0, 0.3, 1], [0, 1, 1]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        transform: `translateX(${xPct}%)`,
        opacity,
      }}
    >
      <path d={FFD_PATH} fill="#05F34A" transform={`scale(${1920/OW}, ${1080/OH})`} />
    </svg>
  );
};

// ── SVG: Drawn paths (DrawSVG) ────────────────────────────────────────────────
// #path (pink curve): from("#path", { duration: 0.5, drawSVG: 0 }, "explode")
// #path_2 (green squiggle): from("#path_2", { duration: 0.8, drawSVG: 0 }, "flight")

const PATH_1 = "M538.5 556.481C565.165 497.803 621.326 446.333 685.817 449.897C742.695 453.011 791.23 499.923 807.851 554.295C822.28 601.485 806.483 665.329 758.267 675.637C710.051 685.944 669.808 635.984 657.212 588.396C638.16 517.04 652.243 437.987 694.679 377.68C737.115 317.374 806.881 277.006 880.5 270.501";
const PATH_2 = "M973.861 226.794C1015.92 240.459 1041.39 136.212 1005.93 135.899C977.513 135.649 990.28 214.204 1046.61 229.17C1089.82 240.65 1168.88 147.886 1092.89 84.6262C1022.57 26.0944 1052.01 288.336 1197.12 209.704";

const DrawnPath: React.FC<{
  d: string;
  stroke: string;
  strokeWidth: number;
  p: number;
}> = ({ d, stroke, strokeWidth, p }) => {
  if (p <= 0) return null;
  const len = 2000;
  const offset = interpolate(p, [0, 1], [len, 0]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
      }}
    >
      <path
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeMiterlimit={10}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={len}
        strokeDashoffset={offset}
        transform={`scale(${1920/OW}, ${1080/OH})`}
      />
    </svg>
  );
};

// ── SVG: Sprinkles ────────────────────────────────────────────────────────────
// Original: 9 sprinkle paths + 2 circles, all with class="sprinkle"
// GSAP: from(".sprinkle", { scale: 0, rotation: 360, transformOrigin: "center center", ease: "back.out" }, "explode")

interface Sprinkle {
  type: "path" | "circle";
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
}

const SPRINKLES: Sprinkle[] = [
  { type: "path", d: "M733.022 222.569L709.927 203.163C709.819 203.073 709.659 203.087 709.569 203.194L690.163 226.289C690.073 226.397 690.087 226.556 690.194 226.647L713.29 246.052C713.397 246.143 713.557 246.129 713.647 246.021L733.053 222.926C733.143 222.819 733.129 222.659 733.022 222.569Z", fill: "#397DFF" },
  { type: "circle", cx: 783.75, cy: 239.751, r: 17.25, fill: "#FAF005" },
  { type: "circle", cx: 1207.5, cy: 336.501, r: 28.5, fill: "#FAF005" },
  { type: "path", d: "M1172.43 119.19C1161.04 107.84 1141.32 122.2 1150.1 137.037", stroke: "#FF783E", strokeWidth: 12, strokeLinecap: "round", strokeLinejoin: "round" },
  { type: "path", d: "M1178.57 43.2882C1173.21 45.868 1172.18 51.6629 1174.14 56.9067C1177.71 66.5265 1181.31 76.1267 1184.88 85.7464C1186.82 90.9677 1194.09 92.8281 1198.6 90.646C1203.96 88.0661 1204.99 82.2714 1203.03 77.0275C1199.46 67.4078 1195.86 57.8074 1192.29 48.1877C1190.35 42.9664 1183.08 41.106 1178.57 43.2882Z", fill: "#BAA5F5", stroke: "black", strokeWidth: 3 },
  { type: "path", d: "M1209.36 520.058C1200.77 520.837 1192.24 522.07 1183.8 523.845C1177.31 525.218 1179.8 535.21 1186.31 533.855C1193.88 532.265 1201.5 531.082 1209.21 530.374C1215.74 529.778 1215.98 519.458 1209.36 520.058Z", fill: "#BAA5F5", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M816.237 177.713C818.964 185.892 822.12 193.912 825.782 201.719C828.608 207.725 837.761 203.006 834.952 196.986C831.668 189.98 828.767 182.829 826.312 175.491C824.233 169.269 814.133 171.4 816.237 177.713Z", fill: "#BAA5F5", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M946.737 711.212C949.464 719.39 952.62 727.411 956.282 735.218C959.108 741.223 968.261 736.505 965.452 730.485C962.168 723.479 959.267 716.328 956.812 708.99C954.733 702.768 944.633 704.899 946.737 711.212Z", fill: "#B82C6F", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M823.961 771.534C820.994 776.919 818.34 782.573 816.071 788.532C814.331 793.123 821.749 798.298 823.506 793.714C825.543 788.368 827.863 783.26 830.521 778.421C832.776 774.321 826.252 767.377 823.961 771.534Z", fill: "#FF783E", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M1155.56 507.934C1152.64 507.082 1150.25 508.853 1149.16 511.444C1147.18 516.21 1145.2 520.99 1143.2 525.751C1142.12 528.327 1144.25 531.431 1146.71 532.149C1149.63 533.001 1152.02 531.229 1153.11 528.638C1155.09 523.873 1157.07 519.107 1159.07 514.331C1160.15 511.755 1158.02 508.651 1155.56 507.934Z", fill: "#FF783E", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M816.771 232.868C816.612 235.909 818.885 237.83 821.654 238.29C826.748 239.127 831.856 239.965 836.948 240.817C839.703 241.276 842.237 238.494 842.371 235.933C842.53 232.892 840.257 230.971 837.487 230.511C832.394 229.674 827.3 228.837 822.193 227.984C819.438 227.525 816.905 230.306 816.771 232.868Z", fill: "#FF783E", stroke: "#1B1E1A", strokeWidth: 1.5 },
  { type: "path", d: "M1155.78 596.226L1147.07 574.282C1146.03 571.668 1142.31 571.051 1140.07 572.243C1137.37 573.689 1137.01 576.679 1138.03 579.241C1140.95 586.559 1143.84 593.872 1146.74 601.186C1147.78 603.8 1151.51 604.417 1153.74 603.225C1156.45 601.778 1156.8 598.789 1155.78 596.226Z", fill: "#A6CFE7", stroke: "#1B1E1A", strokeWidth: 1.5 },
];

const SprinklesLayer: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOut(p);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        transform: `scale(${interpolate(ep, [0, 1], [0, 1])}) rotate(${interpolate(ep, [0, 1], [360, 0])}deg)`,
      }}
    >
      <g transform={`scale(${1920/OW}, ${1080/OH})`}>
        {SPRINKLES.map((s, i) => {
          const stP = Math.max(0, Math.min(1, (p - i * 0.03) / Math.max(0.01, 1 - SPRINKLES.length * 0.03)));
          const sEp = backOut(Math.max(0, Math.min(1, stP)));
          const sc = interpolate(sEp, [0, 1], [0, 1]);
          const rt = interpolate(sEp, [0, 1], [360, 0]);

          if (s.type === "circle") {
            return (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill={s.fill}
                style={{
                  transform: `rotate(${rt}deg) scale(${sc})`,
                  transformOrigin: `${s.cx}px ${s.cy}px`,
                }}
              />
            );
          }
          return (
            <path
              key={i}
              d={s.d}
              fill={s.fill || "none"}
              stroke={s.stroke || "none"}
              strokeWidth={s.strokeWidth || 0}
              strokeMiterlimit={10}
              strokeLinecap={(s.strokeLinecap as any) || undefined}
              strokeLinejoin={(s.strokeLinejoin as any) || undefined}
              style={{
                transform: `rotate(${rt}deg) scale(${sc})`,
                transformOrigin: "center center",
                transformBox: "fill-box",
              }}
            />
          );
        })}
      </g>
    </svg>
  );
};

// ── SVG: Plane (#plane) ───────────────────────────────────────────────────────
// GSAP: set("#plane", { opacity: 0 }) initially
// set("#plane", { opacity: 1 }, "flight")
// from("#plane", { duration: 1, ease: "sine.inOut", scale: 0.2, motionPath: { path, align: "#path_2", autoRotate: 180, start: 1, end: 0 } }, "flight")
// to(".innerplane", { duration: 0.2, opacity: 0 }, 2) — relative to timeline start+delay, so absolute = 1+2 = 3s

const PLANE_PATHS = {
  body: "M1458.41 132.072L1228.95 216.095L1253.19 163.85L1292.99 154.093L1458.41 132.072Z",
  wing1: "M1265.31 137.726L1458.42 132.071L1273.13 159.068L1265.31 137.726Z",
  wing2: "M1265.31 137.725L1295.61 102.015L1458.42 132.071L1265.31 137.725Z",
  inner1: "M1286.78 195.303L1452.45 134.639L1293.52 213.708L1286.78 195.303Z",
  inner2: "M1446.47 137.211L1293.72 213.209L1287.24 195.519L1446.47 137.211ZM1458.42 132.07L1286.32 195.088L1293.32 214.21L1458.42 132.07Z",
};

// Motion path keypoints extracted from original motionPath.path, mapped to screen coords
const PLANE_MOTION: Array<{ x: number; y: number }> = [
  { x: mx(973.861), y: my(226.794) },
  { x: mx(1005.93), y: my(135.899) },
  { x: mx(1046.61), y: my(229.17) },
  { x: mx(1092.89), y: my(84.626) },
  { x: mx(1197.12), y: my(209.704) },
  { x: mx(1468), y: my(74) },
];

const PlaneLayer: React.FC<{ p: number; fadeP: number }> = ({ p, fadeP }) => {
  if (p <= 0) return null;

  // Original: start: 1, end: 0 — plane moves backwards along path
  const ep = sineInOut(p);
  const t = 1 - ep; // reverse
  const seg = t * (PLANE_MOTION.length - 1);
  const idx = Math.min(Math.floor(seg), PLANE_MOTION.length - 2);
  const frac = seg - idx;

  const cx = PLANE_MOTION[idx].x + (PLANE_MOTION[idx + 1].x - PLANE_MOTION[idx].x) * frac;
  const cy = PLANE_MOTION[idx].y + (PLANE_MOTION[idx + 1].y - PLANE_MOTION[idx].y) * frac;

  // autoRotate: compute angle from direction
  const dx = PLANE_MOTION[Math.min(idx + 1, PLANE_MOTION.length - 1)].x - PLANE_MOTION[idx].x;
  const dy = PLANE_MOTION[Math.min(idx + 1, PLANE_MOTION.length - 1)].y - PLANE_MOTION[idx].y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 180; // autoRotate: 180

  const scale = interpolate(ep, [0, 1], [0.2, 1]);
  const innerOpacity = fadeP > 0 ? interpolate(fadeP, [0, 1], [1, 0]) : 1;

  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px) scale(${scale}) rotate(${angle}deg)`,
        transformOrigin: "0 0",
        opacity: innerOpacity,
      }}
    >
      <g transform="translate(-1370, -170)">
        <path d={PLANE_PATHS.inner1} fill="#05F34A" />
        <path d={PLANE_PATHS.inner2} fill="#F5F9EA" />
        <path d={PLANE_PATHS.body} fill="#05F34A" stroke="#1B1E1A" strokeWidth={3} />
        <path d={PLANE_PATHS.wing1} fill="#05F34A" stroke="#1B1E1A" strokeWidth={3} />
        <path d={PLANE_PATHS.wing2} fill="#05F34A" stroke="#1B1E1A" strokeWidth={3} />
      </g>
    </g>
  );
};

// ── SVG: Hand (#hand) ─────────────────────────────────────────────────────────
// GSAP: from("#hand", { opacity: 0, duration: 0.2, yPercent: 100 }, 1.3) — absolute: 2.3s
// GSAP: from("#hand", { duration: 0.4, rotation: "+=30", ease: "myWiggle", transformOrigin: "center center" }, 1.5) — absolute: 2.5s
// CustomWiggle "myWiggle" { wiggles: 6 }

const HAND_PATH = "M1162.52 666.144L1176.06 718.388C1177.72 724.799 1178.06 731.516 1176.85 738.115C1176.09 742.292 1174.65 746.79 1172.06 750.769C1172.76 751.621 1173.29 752.621 1173.58 753.738L1175.28 760.084C1176.48 764.609 1173.51 769.333 1168.64 770.633L1117.65 784.237C1112.77 785.537 1107.84 782.921 1106.63 778.396L1104.94 772.05C1104.59 770.737 1104.59 769.402 1104.89 768.145C1098.39 765.431 1093.48 760.261 1091.36 752.35C1091.36 752.35 1090.43 748.786 1089.73 746.166L1064.68 740.226C1058.44 738.717 1053.8 735.175 1054.22 729.35C1054.56 724.65 1056.69 721.15 1061.3 719.919C1061.31 719.916 1061.32 719.914 1061.34 719.91C1062.94 719.485 1064.63 719.486 1066.26 719.826L1083.68 723.457L1083.9 723.462C1083.77 723.132 1071.39 676.788 1071.39 676.788C1069.9 671.215 1073.37 665.234 1079.35 663.543C1082.43 662.673 1085.53 663.068 1088.05 664.403C1090.51 665.709 1092.41 667.918 1093.16 670.718L1101.74 701.364L1106.88 720.624C1107.2 721.82 1107.73 722.905 1108.42 723.86C1109.35 725.147 1110.58 726.191 1111.99 726.941C1114.46 728.247 1117.49 728.654 1120.5 727.85C1122.6 727.29 1124.42 726.216 1125.83 724.819C1128.47 722.2 1129.69 718.45 1128.72 714.799C1129.46 717.598 1131.36 719.807 1133.83 721.117C1134.6 721.523 1135.42 721.844 1136.29 722.07C1136.63 722.16 1136.98 722.231 1137.34 722.285L1137.34 722.284C1137.83 722.367 1138.33 722.416 1138.84 722.429C1139.98 722.469 1141.16 722.34 1142.34 722.024L1142.53 721.975C1142.65 721.939 1142.77 721.904 1142.89 721.863L1142.91 721.856C1143.06 721.809 1143.21 721.756 1143.36 721.703C1143.41 721.687 1143.46 721.669 1143.51 721.647C1143.59 721.618 1143.67 721.583 1143.76 721.548C1143.89 721.504 1144.01 721.451 1144.13 721.392C1144.15 721.391 1144.16 721.388 1144.17 721.379C1144.33 721.309 1144.49 721.237 1144.65 721.152C1149.27 718.847 1151.85 713.819 1150.56 708.974L1140.75 672.215C1139.27 666.641 1142.74 660.663 1148.71 658.97C1151.79 658.1 1154.9 658.494 1157.42 659.829C1159.88 661.135 1161.78 663.344 1162.53 666.146L1162.52 666.144Z";

const HAND_DETAIL_PATHS = [
  "M1150.49 708.729L1150.56 708.975C1151.85 713.82 1149.27 718.847 1144.65 721.152C1149.3 718.795 1151.79 713.605 1150.49 708.729Z",
  "M1083.9 723.464C1083.9 723.464 1083.51 722.576 1083.48 722.132C1083.48 722.132 1083.77 723.133 1083.9 723.464Z",
  "M1145.42 689.713L1150.56 708.972C1151.85 713.817 1149.27 718.844 1144.65 721.15C1144.49 721.232 1144.33 721.308 1144.16 721.377C1144.15 721.387 1144.14 721.389 1144.13 721.389C1144 721.449 1143.88 721.501 1143.75 721.546C1143.67 721.587 1143.59 721.616 1143.51 721.645C1143.46 721.664 1143.4 721.682 1143.36 721.701C1143.21 721.757 1143.06 721.807 1142.91 721.854L1142.88 721.861C1142.7 721.918 1142.52 721.973 1142.34 722.021L1142.34 722.022C1141.16 722.337 1139.98 722.467 1138.83 722.427C1138.33 722.414 1137.83 722.365 1137.34 722.285L1137.34 722.285C1136.98 722.225 1136.63 722.154 1136.29 722.068C1135.42 721.844 1134.6 721.521 1133.82 721.114C1131.36 719.805 1129.46 717.596 1128.71 714.797C1129.69 718.448 1128.46 722.199 1125.82 724.817C1124.41 726.214 1122.6 727.288 1120.5 727.848C1117.49 728.652 1114.45 728.245 1111.99 726.939C1110.58 726.188 1109.35 725.142 1108.42 723.858C1107.73 722.903 1107.2 721.818 1106.88 720.621L1101.74 701.362L1145.42 689.71L1145.42 689.713Z",
  "M1145.42 689.713L1150.56 708.972C1151.85 713.817 1149.27 718.844 1144.65 721.15C1144.49 721.232 1144.33 721.308 1144.16 721.377C1144.15 721.387 1144.14 721.389 1144.13 721.389C1144 721.449 1143.88 721.501 1143.75 721.546C1143.67 721.587 1143.59 721.616 1143.51 721.645C1143.46 721.664 1143.4 721.682 1143.36 721.701C1143.21 721.757 1143.06 721.807 1142.91 721.854L1142.88 721.861C1142.7 721.918 1142.52 721.973 1142.34 722.021L1142.34 722.022C1141.16 722.337 1139.98 722.467 1138.83 722.427C1138.33 722.413 1137.83 722.365 1137.34 722.285L1137.34 722.285C1136.98 722.225 1136.63 722.154 1136.29 722.068C1135.42 721.844 1134.6 721.521 1133.82 721.114C1131.36 719.805 1129.46 717.596 1128.71 714.797L1123.57 695.537C1122.08 689.938 1125.76 684.094 1131.79 682.486C1134.8 681.68 1137.84 682.087 1140.3 683.394C1142.77 684.703 1144.67 686.912 1145.41 689.711L1145.42 689.713Z",
  "M1096.4 727.669C1096.4 727.669 1132.72 709.703 1142.25 745.402",
  "M1122.34 690.885L1128.72 714.799C1129.69 718.45 1128.46 722.201 1125.83 724.819C1124.42 726.216 1122.6 727.291 1120.5 727.85C1117.49 728.655 1114.46 728.247 1111.99 726.942C1110.58 726.191 1109.35 725.144 1108.42 723.86C1107.73 722.905 1107.2 721.82 1106.88 720.624L1100.5 696.71C1099.01 691.111 1102.69 685.267 1108.72 683.659C1111.73 682.854 1114.76 683.262 1117.23 684.567C1119.69 685.877 1121.59 688.086 1122.34 690.885Z",
];

const HandLayer: React.FC<{ enterP: number; wiggleP: number }> = ({ enterP, wiggleP }) => {
  if (enterP <= 0) return null;
  const opacity = interpolate(enterP, [0, 1], [0, 1]);
  const yPct = interpolate(enterP, [0, 1], [100, 0]);
  // CustomWiggle: 6 wiggles, damped sine
  const wiggle = wiggleP > 0 ? 30 * Math.sin(wiggleP * Math.PI * 12) * (1 - wiggleP) : 0;

  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        opacity,
      }}
    >
      <g transform={`scale(${1920/OW}, ${1080/OH})`}>
        <g
          style={{
            transform: `translateY(${yPct}%) rotate(${wiggle}deg)`,
            transformOrigin: "1120px 780px",
          }}
        >
          <path d={HAND_PATH} fill="#FFFCE1" stroke="black" strokeWidth={4} strokeMiterlimit={10} />
          {HAND_DETAIL_PATHS.map((dp, i) => (
            <path key={i} d={dp} fill={i === 4 ? "none" : "#FFFCE1"} stroke="black" strokeWidth={4} strokeMiterlimit={10} />
          ))}
        </g>
      </g>
    </svg>
  );
};

// ── 3D Polyhedron (#main) ─────────────────────────────────────────────────────
// Original: <image href="https://assets.codepen.io/16327/3D-poly.png" x="758" y="320" width="344" height="370" />
// GSAP: from("#main", { duration: 2, opacity: 0, y: -2000, ease: "myBounce" }, 0.5)
// GSAP: to("#main", { duration: 2, scaleX: 1.4, scaleY: 0.6, ease: "myBounce-squash", transformOrigin: "center bottom" }, 0.5)
// Using gradient placeholder since we can't load the PNG

const HeroPoly: React.FC<{ bounceP: number; squashP: number }> = ({ bounceP, squashP }) => {
  if (bounceP <= 0) return null;

  const y = interpolate(customBounce(bounceP), [0, 1], [-2000, 0]);
  const opacity = interpolate(bounceP, [0, 0.02, 1], [0, 1, 1]);
  // squash: scaleX goes to 1.4, scaleY to 0.6
  const sq = customBounceSquash(squashP);
  const scaleX = 1 + (sq - 1) * 0.4;
  const scaleY = 1 - (sq - 1) * 0.4;

  return (
    <div
      style={{
        position: "absolute",
        left: mx(758),
        top: my(320),
        width: mx(344) * (OW / 1920),
        height: my(370) * (OH / 1080),
        transform: `translateY(${y * (1080 / OH)}px) scaleX(${scaleX}) scaleY(${scaleY})`,
        transformOrigin: "center bottom",
        opacity,
      }}
    >
      <svg viewBox="0 0 344 370" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="polyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF8709" />
            <stop offset="30%" stopColor="#F7BDF8" />
            <stop offset="70%" stopColor="#BAA5F5" />
            <stop offset="100%" stopColor="#9D95FF" />
          </linearGradient>
          <linearGradient id="polyGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#05F34A" />
            <stop offset="100%" stopColor="#00BAE2" />
          </linearGradient>
          <linearGradient id="polyGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9D95FF" />
            <stop offset="100%" stopColor="#FF8709" />
          </linearGradient>
        </defs>
        {/* Icosahedron-like polyhedron */}
        <polygon points="172,15 305,95 320,245 255,345 89,345 24,245 39,95" fill="url(#polyGrad1)" />
        <polygon points="172,15 305,95 172,175 39,95" fill="url(#polyGrad2)" opacity={0.6} />
        <polygon points="305,95 320,245 172,175" fill="url(#polyGrad3)" opacity={0.3} />
        <polygon points="39,95 24,245 172,175" fill="#F7BDF8" opacity={0.2} />
        <line x1={172} y1={175} x2={172} y2={345} stroke="#1B1E1A" strokeWidth={1.5} opacity={0.3} />
        <line x1={172} y1={175} x2={320} y2={245} stroke="#1B1E1A" strokeWidth={1.5} opacity={0.25} />
        <line x1={172} y1={175} x2={24} y2={245} stroke="#1B1E1A" strokeWidth={1.5} opacity={0.25} />
        <line x1={172} y1={15} x2={172} y2={175} stroke="#1B1E1A" strokeWidth={1} opacity={0.15} />
        <polygon points="172,15 305,95 320,245 255,345 89,345 24,245 39,95" fill="none" stroke="#1B1E1A" strokeWidth={2} opacity={0.4} />
      </svg>
    </div>
  );
};

// ── Rotated box element ───────────────────────────────────────────────────────
// Original: <rect id="box" x="539" y="469.42" width="87.0018" height="80.7347" transform="rotate(-83.3705 539 469.42)" fill="url(#pattern)" />
// It's a textured box — we'll render it as a subtle colored rect

const BoxElement: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const ep = backOut(p);
  const scale = interpolate(ep, [0, 1], [0, 1]);
  const rot = interpolate(ep, [0, 1], [360, 0]);
  return (
    <svg
      viewBox="0 0 2058 871"
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
      }}
    >
      <g transform={`scale(${1920/OW}, ${1080/OH})`}>
        <rect
          x={539}
          y={469.42}
          width={87.0018}
          height={80.7347}
          transform="rotate(-83.3705 539 469.42)"
          fill="#4a4a4a"
          opacity={0.4}
          style={{
            transform: `scale(${scale}) rotate(${rot}deg)`,
            transformOrigin: "539px 469px",
          }}
        />
      </g>
    </svg>
  );
};

// ── Confetti ──────────────────────────────────────────────────────────────────
// Original: 22 images (11 unique x2). Physics2D: velocity "random(800, 2000)", angle "random(150, 360)", gravity 3000
// Since we can't use external PNGs, we render colored shapes matching the confetti aesthetic

const CONFETTI_COLORS = [
  "#FF8709", "#F7BDF8", "#05F34A", "#397DFF", "#FAF005", "#FEC5FB",
  "#BAA5F5", "#FF783E", "#A6CFE7", "#B82C6F", "#00BAE2", "#9D95FF",
];

const CONFETTI_SHAPES = ["circle", "star", "diamond", "rect", "triangle", "ring",
  "cone", "spiral", "lightning", "flower", "keyframe"] as const;

interface ConfettiPiece {
  color: string;
  shape: string;
  vx: number;
  vy: number;
  rotEnd: number;
  initScale: number;
  size: number;
}

function genConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = rr(i * 7 + 1, 150, 360);
    const angleRad = (angleDeg * Math.PI) / 180;
    const speed = rr(i * 3 + 2, 800, 2000);
    return {
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
      vx: speed * Math.cos(angleRad),
      vy: speed * Math.sin(angleRad),
      rotEnd: rr(i * 11, -360, 360),
      initScale: rr(i * 13, 0.1, 1),
      size: rr(i * 17, 18, 36),
    };
  });
}

const CONFETTI = genConfetti(22);
const CONFETTI_GRAVITY = 3000;

const ConfettiShape: React.FC<{ shape: string; color: string; size: number }> = ({ shape, color, size }) => {
  const s = size;
  switch (shape) {
    case "circle":
      return <div style={{ width: s, height: s, borderRadius: "50%", background: color }} />;
    case "star":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="10,0 12.5,7.5 20,7.5 14,12.5 16,20 10,15 4,20 6,12.5 0,7.5 7.5,7.5" fill={color} />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="10,0 20,10 10,20 0,10" fill={color} />
        </svg>
      );
    case "rect":
      return <div style={{ width: s, height: s * 0.5, borderRadius: 3, background: color }} />;
    case "triangle":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="10,0 20,20 0,20" fill={color} />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <circle cx={10} cy={10} r={8} fill="none" stroke={color} strokeWidth={3} />
        </svg>
      );
    case "cone":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="10,0 18,20 2,20" fill={color} />
          <ellipse cx={10} cy={20} rx={8} ry={3} fill={color} opacity={0.6} />
        </svg>
      );
    case "spiral":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <path d="M10,10 C10,6 14,6 14,10 C14,14 6,14 6,10 C6,4 16,4 16,10 C16,16 4,16 4,10" fill="none" stroke={color} strokeWidth={2} />
        </svg>
      );
    case "lightning":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="12,0 6,9 10,9 8,20 14,11 10,11" fill={color} />
        </svg>
      );
    case "flower":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <circle cx={10} cy={6} r={4} fill={color} />
          <circle cx={14} cy={10} r={4} fill={color} />
          <circle cx={10} cy={14} r={4} fill={color} />
          <circle cx={6} cy={10} r={4} fill={color} />
          <circle cx={10} cy={10} r={3} fill={color} opacity={0.8} />
        </svg>
      );
    case "keyframe":
      return (
        <svg viewBox="0 0 20 20" width={s} height={s}>
          <polygon points="10,2 18,10 10,18 2,10" fill="none" stroke={color} strokeWidth={2} />
          <circle cx={10} cy={10} r={3} fill={color} />
        </svg>
      );
    default:
      return <div style={{ width: s, height: s, borderRadius: "50%", background: color }} />;
  }
};

const ConfettiField: React.FC<{ p: number; durSec: number }> = ({ p, durSec }) => {
  if (p <= 0) return null;
  const t = p * durSec;
  const cx = 960; // center x
  const cy = 540; // center y

  return (
    <>
      {CONFETTI.map((pc, i) => {
        const x = cx + pc.vx * t;
        const y = cy + pc.vy * t + 0.5 * CONFETTI_GRAVITY * t * t;
        const rotation = interpolate(p, [0, 1], [0, pc.rotEnd]);
        const scale = interpolate(p, [0, 1], [pc.initScale, rr(i * 19, 0.5, 1)]);
        const opacity = interpolate(p, [0, 0.7, 1], [1, 1, 0], { extrapolateRight: "clamp" });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `rotate(${rotation}deg) scale(${scale})`,
              opacity,
              pointerEvents: "none",
            }}
          >
            <ConfettiShape shape={pc.shape} color={pc.color} size={pc.size} />
          </div>
        );
      })}
    </>
  );
};

// ── Animated text (SplitText replacement) ─────────────────────────────────────
// Original: SplitText with { type: "words, chars", mask: "words" }
// GSAP: from([free.chars, all.chars], { duration: 0.7, y: "random([-500, 500])", rotation: "random([-30, 30])", ease: "expo.out", stagger: { from: "random", amount: 0.3 } })

const AnimText: React.FC<{
  text: string;
  charProgress: (i: number) => number;
  style?: React.CSSProperties;
}> = ({ text, charProgress, style }) => (
  <span style={{ display: "inline-flex", overflow: "visible", ...style }}>
    {text.split("").map((char, i) => {
      const p = charProgress(i);
      const seed = i * 73 + text.charCodeAt(0);
      const fromY = srand(seed) > 0.5 ? -500 : 500;
      const fromRot = rr(seed + 1, -30, 30);
      const y = interpolate(p, [0, 1], [fromY, 0]);
      const rot = interpolate(p, [0, 1], [fromRot, 0]);
      const op = interpolate(p, [0, 0.15, 1], [0, 1, 1]);
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            transform: `translateY(${y}px) rotate(${rot}deg)`,
            opacity: op,
            whiteSpace: char === " " ? "pre" : undefined,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      );
    })}
  </span>
);

// ── Main composition ──────────────────────────────────────────────────────────

export const GsapSmooth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Text: from([free.chars, all.chars], { duration: 0.7, stagger: { amount: 0.3 } }) at timeline t=0 → absolute DELAY
  const textP = prog(frame, fps, DELAY, 0.7 + 0.3); // total span = duration + stagger
  const staggerAmount = 0.3;

  // Poly bounce: from("#main", { duration: 2, y: -2000, ease: "myBounce" }, 0.5) → absolute DELAY + 0.5
  const polyP = prog(frame, fps, DELAY + 0.5, 2);

  // Text slide: to("#free", { duration: 2, xPercent: -20, ease: "elastic.out(1,0.3)" }, "explode")
  const freeSlideP = prog(frame, fps, EXPLODE, 2);
  const allSlideP = prog(frame, fps, EXPLODE, 2);

  // Bang + spin: from("#bang, #spin", { duration: 0.7, ease: "back.out(4)" }, "explode+=.1")
  const bangP = prog(frame, fps, EXPLODE + 0.1, 0.7);

  // Wiggle: from("#wiggle", { duration: 0.7, ease: "back.out(4)" }, "explode+=.4")
  const wiggleP = prog(frame, fps, EXPLODE + 0.4, 0.7);

  // DrawSVG #path: from("#path", { duration: 0.5, drawSVG: 0 }, "explode")
  const drawPath1P = prog(frame, fps, EXPLODE, 0.5);

  // DrawSVG #path_2: from("#path_2", { duration: 0.8, drawSVG: 0 }, "flight")
  const drawPath2P = prog(frame, fps, FLIGHT, 0.8);

  // Sprinkles: from(".sprinkle", { scale: 0, rotation: 360, ease: "back.out" }, "explode")
  const sprinklesP = prog(frame, fps, EXPLODE, 0.7);

  // Box: same timing as sprinkles
  const boxP = sprinklesP;

  // FFD: from("#ffd", { xPercent: -800, opacity: 0, ease: "back.out" }, "explode")
  const ffdP = prog(frame, fps, EXPLODE, 0.7);

  // Confetti: set + to at "explode+=.2", duration 2
  const confettiP = prog(frame, fps, EXPLODE + 0.2, 2);

  // Plane: set("#plane", { opacity: 1 }, "flight")
  // from("#plane", { duration: 1, ease: "sine.inOut", scale: 0.2, motionPath: {...} }, "flight")
  const planeP = prog(frame, fps, FLIGHT, 1);
  // to(".innerplane", { duration: 0.2, opacity: 0 }, 2) — relative to delay: absolute = DELAY + 2
  const planeFadeP = prog(frame, fps, DELAY + 2, 0.2);

  // Hand: from("#hand", { opacity: 0, duration: 0.2, yPercent: 100 }, 1.3) → absolute DELAY + 1.3
  const handEnterP = prog(frame, fps, DELAY + 1.3, 0.2);
  // from("#hand", { duration: 0.4, rotation: "+=30", ease: "myWiggle" }, 1.5) → absolute DELAY + 1.5
  const handWiggleP = prog(frame, fps, DELAY + 1.5, 0.4);

  // Text slide positions
  const freeX = interpolate(elasticOut(freeSlideP), [0, 1], [0, -20]);
  const allX = interpolate(elasticOut(allSlideP), [0, 1], [0, 50]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e100f",
        overflow: "hidden",
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#FFFCE1",
      }}
    >
      {/* Drawn paths (behind everything) */}
      <DrawnPath d={PATH_1} stroke="#FEC5FB" strokeWidth={12} p={drawPath1P} />
      <DrawnPath d={PATH_2} stroke="#0AE448" strokeWidth={3} p={drawPath2P} />

      {/* Box element */}
      <BoxElement p={boxP} />

      {/* Starburst */}
      <BangShape p={bangP} />

      {/* Wiggle shape */}
      <WiggleShape p={wiggleP} />

      {/* Spin shape */}
      <SpinShape p={bangP} />

      {/* Sprinkles */}
      <SprinklesLayer p={sprinklesP} />

      {/* FFD icon */}
      <FFDIcon p={ffdP} />

      {/* 3D polyhedron */}
      <HeroPoly bounceP={polyP} squashP={polyP} />

      {/* "free " text — original: #free { left: 10%, top: 45%, font-size: 8vw } */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "45%",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -2,
          transform: `translateX(${freeX}%)`,
          lineHeight: 1,
        }}
      >
        <AnimText
          text="free "
          charProgress={(i) => {
            const charStagger = srand(i * 31 + 7) * staggerAmount;
            const dur = 0.7;
            const total = dur + staggerAmount;
            const cp = Math.max(0, Math.min(1, (textP * total - charStagger) / dur));
            return expoOut(cp);
          }}
        />
      </div>

      {/* "for all" text — original: #all { left: 41%, top: 45% } */}
      <div
        style={{
          position: "absolute",
          left: "41%",
          top: "45%",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -2,
          transform: `translateX(${allX}%)`,
          lineHeight: 1,
        }}
      >
        <AnimText
          text="for all"
          charProgress={(i) => {
            const charStagger = srand(i * 53 + 13) * staggerAmount;
            const dur = 0.7;
            const total = dur + staggerAmount;
            const cp = Math.max(0, Math.min(1, (textP * total - charStagger) / dur));
            return expoOut(cp);
          }}
        />
      </div>

      {/* Confetti */}
      <ConfettiField p={confettiP} durSec={2} />

      {/* Plane (rendered inside an SVG overlay so we can use SVG transforms) */}
      <svg
        viewBox="0 0 1920 1080"
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <PlaneLayer p={planeP} fadeP={planeFadeP} />
      </svg>

      {/* Hand */}
      <HandLayer enterP={handEnterP} wiggleP={handWiggleP} />
    </AbsoluteFill>
  );
};
