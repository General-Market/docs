// LSEG World-Check On Demand replicate — measured data.
// All values sampled from public/lseg-replicate/refs/* with ImageMagick.
// Colors (measured): royal plate #001BFD (open/checklist), tile royal #0C29FD,
// navy #010D99 / panel #010D94, cyan tile #57C9E1, light-blue tile #7AC5D9,
// dot-panel bg #0129F2, blue text on white #041BDD, "Now" glyph #CCD3FC.

export const COLORS = {
  royal: "#001BFD",
  royalTile: "#0C29FD",
  royalChecklist: "#001BF4",
  navy: "#010D99",
  navyPanel: "#010D94",
  cyanTile: "#57C9E1",
  lightBlueTile: "#7AC5D9",
  dotPanelBg: "#0129F2",
  dotPanelBg2: "#3A5DFF",
  blueText: "#041BDD",
  nowText: "#CCD3FC",
  white: "#FFFFFF",
} as const;

// Font note: LSEG's brand face is proprietary (Proxima Nova-like geometric
// humanist). Closest locally available: Avenir Next. The LSEG logotype serif
// is a custom flared serif; Georgia is the closest system substitute.
export const SANS = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", serif';

// Dotted world map, sampled from refs/f050.png on a 32.375px grid,
// origin x=27.4 y=208.85, dot 25x25. '#' = royal dot, 'C' = cyan dot.
export const MAP_GRID = [
  "................####.#####..#.....#...##...................",
  ".............#.###.######...##.....#...##..................",
  "............##.#.#..#####........####.#####.#..............",
  ".......###.########..####.....##..#.#############..........",
  ".......#############.#####...######################........",
  ".......#########..##.##.....##.##################..........",
  ".......#...#########......###################.##...........",
  "............#########......##################.#............",
  "............#######........#.##...#C########.#.............",
  "............######........#....##############..............",
  ".............###.#........#################................",
  "..............##.##......#...#C###..######.................",
  "..............C.#.#......#.#.#.#.#..##.##.#................",
  ".................####.....C#######...#.#...................",
  ".................###.##.....#####.......###.##.............",
  ".................######......####...........#..............",
  "..................#####......###.#........####.............",
  "...................###.......####........######............",
  "...................##........##..........#####..#..........",
  "..................##........................##..#..........",
  "..................##...........................#...........",
  "..................#........................................",
];
export const MAP_ORIGIN = { x: 27.4, y: 208.85 };
export const MAP_PITCH = 32.375;
export const MAP_DOT = 25;

// ————— Round 1 measured tables (all values tracked from refall frames) —————
// Key tables are [absFrame, value] pairs, linearly interpolated.
export type Keys = Array<[number, number]>;

// S2: typed line. Cap-measured: text left x349, cap-top y534, em ~84,
// white #FFF on the baked bright-royal glass pane. Types ~1.15 chars/f from f104.
export const S2_TEXT = { x: 349, top: 511, size: 84 } as const;
// S2 strip scroll (whole layout translateX), phase-correlated cum from f126.
export const S2_SCROLL: Keys = [
  [126, 0], [128, -18], [130, -44], [132, -80], [134, -126], [136, -183],
  [138, -253], [140, -337], [142, -435], [144, -551], [146, -686], [148, -843],
  [150, -1026], [152, -1237], [154, -1483], [156, -1769], [158, -2105],
  [160, -2498], [162, -2959], [164, -3488], [166, -4062],
];

// S3a: the whole photo strip ARRIVES from the right and keeps creeping left
// until the cut at f220 (offsets rel f218; conveyor never fully stops).
export const S3A_ARRIVE: Keys = [
  [166, 1760], [168, 1218], [170, 820], [172, 644], [174, 577], [176, 521],
  [178, 473], [180, 431], [182, 393], [184, 358], [186, 326], [188, 296],
  [190, 268], [192, 242], [194, 217], [196, 194], [198, 172], [200, 151],
  [202, 131], [204, 112], [206, 94], [208, 77], [210, 60], [212, 45],
  [214, 29], [216, 15], [218, 0], [220, -14],
];

// S3b: ONE pan group [office | developer], group coords = screen at f380.
// Template-tracked content dx (score 1.0 rows only; <280 extrapolated +40/f).
export const S3B_GROUP_DX: Keys = [
  [262, -1665], [280, -945], [284, -783], [288, -651], [292, -544],
  [296, -457], [300, -386], [304, -330], [308, -285], [312, -251],
  [316, -225], [320, -202], [324, -180], [328, -160], [332, -142],
  [336, -127], [340, -113], [344, -102], [348, -93], [352, -85],
  [356, -77], [360, -68], [364, -57], [368, -46], [372, -32], [376, -17],
  [380, 0], [384, 18], [388, 38], [392, 58], [396, 80], [400, 103],
  [404, 127], [408, 151], [412, 176], [416, 201], [420, 226], [424, 251],
  [428, 276], [433, 308],
];
// Reveal edges (royal-bar tracked f274-287, extrapolated to exits).
export const DEV_EDGE: Keys = [
  [262, 0], [268, 470], [274, 942], [278, 1118], [282, 1262], [287, 1407],
  [295, 1650], [304, 1920],
];
export const PHONE_EDGE: Keys = [
  [262, 0], [268, 470], [274, 952], [278, 1177], [282, 1355], [287, 1527],
  [296, 1920],
];
// Tower rail: matched x1472@f228, +9px/f rightward.
export const TOWER = { x0: 1472, f0: 228, v: 9 } as const;
// "now you can" band (white-run scan): rect x643 y476 633x108, grows f377-393,
// gone under the earth crossfade by f433. Text #051EEE starts x676.
export const BAND = { x: 643, y: 476, w: 633, h: 108, grow0: 377, grow1: 393, hide: 433 } as const;
// Earth crossfade alpha ramp (measured f427.5 -> f433); title rides in with it.
export const EARTH_XFADE = { f0: 427.5, f1: 433 } as const;
// Earth full-bleed title: centered, cap-box y487-573 at full scale.
export const EARTH_TITLE = { top: 489, size: 74 } as const;

// S4 earth tile [absFrame, x, w, bottomY] (dark-rect tracked; h = w/1.763).
export const EARTH_TILE: Array<[number, number, number, number]> = [
  [476, 0, 1920, 1092], [478, 312, 1299, 905], [480, 343, 1237, 887],
  [482, 364, 1194, 875], [484, 382, 1159, 865], [486, 396, 1130, 857],
  [488, 409, 1105, 849], [490, 420, 1083, 839], [492, 429, 1064, 827],
  [494, 437, 1048, 812], [496, 445, 1033, 794], [498, 451, 1021, 771],
  [500, 456, 1010, 744], [502, 461, 1000, 708], [504, 465, 992, 668],
  [506, 468, 985, 610], [508, 472, 979, 544], [510, 474, 975, 440],
  [512, 476, 942, 324], [514, 477, 930, 180], [516, 478, 920, 20],
];
// S4 center column offset c (skyline/boardroom template tracks; 0 = settled).
export const S4_C: Keys = [
  [478, 1583], [494, 1575], [496, 1567], [498, 1540], [500, 1511],
  [502, 1475], [504, 1431], [506, 1377], [508, 1307], [510, 1213],
  [512, 1085], [514, 910], [516, 740], [518, 580], [520, 438], [522, 335],
  [524, 256], [526, 199], [528, 152], [530, 115], [532, 85], [534, 62],
  [536, 42], [538, 28], [540, 17], [542, 9], [544, 4], [546, 0], [614, 0],
];
// S4 side columns offset s (hex/royal-edge template track; 0 = f560 layout;
// the sides NEVER settle - still +96 by f612).
export const S4_S: Keys = [
  [478, -560], [490, -480], [506, -400], [508, -390], [510, -362],
  [512, -336], [514, -311], [516, -289], [518, -268], [520, -248],
  [522, -229], [524, -211], [526, -194], [528, -178], [530, -163],
  [532, -148], [534, -134], [536, -121], [538, -108], [540, -95],
  [542, -84], [544, -73], [546, -62], [548, -52], [550, -42], [552, -33],
  [554, -24], [556, -16], [558, -8], [560, 0], [564, 14], [568, 26],
  [572, 38], [576, 48], [580, 57], [584, 64], [588, 71], [592, 76],
  [596, 81], [600, 85], [604, 89], [608, 92], [612, 96], [614, 97],
];
// S4 exit: skyline tile scales about its center (961.5, 539) then hard cut.
export const SKY_EXPAND: Keys = [
  [590, 1], [596, 1.008], [600, 1.017], [604, 1.033], [608, 1.06],
  [610, 1.081], [612, 1.108], [613, 1.127], [614, 1.127],
];
// S4 layouts, f560-settled screen coords (edge-scanned).
export const S4_LEFT = {
  hex: { x: 0, y: 0, w: 478, h: 496 },
  royal: { x: 0, y: 496, w: 478, h: 340 },
  gherkin: { x: 0, y: 836, w: 478, h: 535 },
  solar: { x: 0, y: 1180, w: 478, h: 260 },
} as const;
export const S4_RIGHT = {
  container: { x: 1443, y: 0, w: 477, h: 164 },
  cyan: { x: 1443, y: 164, w: 477, h: 408 },
  microphones: { x: 1443, y: 572, w: 477, h: 408 },
  dot: { x: 1443, y: 980, w: 477, h: 500 },
} as const;
export const S4_CENTER = {
  boardroom: { x: 478, y: -835, w: 965, h: 553 },
  creditCard: { x: 957, y: 0, w: 486, h: 264 },
  skyline: { x: 478, y: 264, w: 964, h: 548 },
} as const;
// Skyline tile title (white-pixel bbox f560): centered on tile, cap-box y504-562.
export const SKY_TITLE = { top: 506, size: 80 } as const;

// S3a per-panel parallax (template-tracked; offsets rel comp mounts).
export const S3A_EYECHEV: Keys = [
  [166, 1400], [168, 789], [172, 199], [176, 71], [180, -22], [184, -91],
  [188, -151], [192, -203], [196, -249], [200, -291], [204, -329],
  [208, -364], [212, -396], [216, -426], [220, -448],
];
export const S3A_TAB: Keys = [
  [184, 400], [188, 160], [192, 120], [196, 74], [200, 30], [204, -9],
  [208, -45], [212, -78], [216, -108], [220, -138],
];
