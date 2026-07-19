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
