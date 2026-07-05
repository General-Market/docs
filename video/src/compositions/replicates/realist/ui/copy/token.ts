// ═══════════════════════════════════════════════════════════════════
// PUMPWHEEL TOKEN PAGE — every visible string, number and color.
// Measured from the reference plates (public/realist-assets/footage):
//   LOADING variant  → f0350 / f0385   (frames 333–391)
//   LIVE variant     → f0500 / f0900   (frames 418–2112)
// Values that change over time live in ../timeline-token.ts.
// Edit copy here; geometry lives in TokenPage.tsx.
// ═══════════════════════════════════════════════════════════════════

// ─── COLORS (probed from plates with 8×8 patch averages) ───────────
export const COLORS = {
  // page / panel surfaces
  navBg: "#191C23", //          top nav bar (f0900 p{400,15})
  panelBg: "#1A1D24", //        header / ticker / bottom-tabs surface
  railBg: "#1A1D26", //         right rail surface
  chartToolbarBg: "#181B22", // chart toolbar row
  chartBg: "#131A22", //        chart plot interior (f0900 y600 x60)
  popupBg: "#181B22", //        trade popup body (f0500 p{300,450})
  popupBorder: "#262A32",
  cardBg: "#1E2128", //         token-info stat cards
  inputBg: "#25252B", //        AMOUNT input (f0900)
  cellBg: "#1C1F26", //         rail preset cells
  dockBg: "#191B25", //         bottom-right docked panel
  toastBg: "#181B22", //         toast fill probed f0910 (24,27,34) — r3, was #26282F
  toastBorder: "#272B33", //     no bright border line exists on the plates (r3)
  divider: "#232833",
  scrollThumb: "#414852",
  // accents
  teal: "#38D5CA", //           solid buy tab / big button (f0900 rgb 53,213,201)
  tealText: "#4FD1C5", //       teal value text
  tealDim: "#1E4D48", //        teal preset pill borders
  pos: "#3ED6C5", //            positive numbers
  neg: "#EE508D", //            negative numbers / pink dot (f0500 rgb 238,80,141)
  negDim: "#4A2338", //         red preset pill borders
  purple: "#5F58B0", //         active P3 / PRESET 3 / dock filter
  purpleText: "#6E64BB", //     Instant Trade chip text
  // r4 purple unification — probed f0500/f0900/f1050 (see rounds/work/r4/popup/notes.md).
  // Deposit fill re-measured on three plates (top rows #6A5FE0/#695FE4/#665EDC,
  // bottom rows #5C52C5/#6259CF/#6258D1) → slight vertical falloff; the old
  // flat #444294 was far too dark. The label is DARK navy ink, not white.
  depositTop: "#685EE0", //     Deposit pill fill, top (3-plate mean)
  depositBot: "#6157CD", //     Deposit pill fill, bottom (3-plate mean)
  depositInk: "#161652", //     Deposit label ink (f0500 darkest glyph core)
  chipBg: "#393B47", //         ticker item chips (f0500)
  searchBg: "#3D3F4C", //       nav search field
  solPillBg: "#34363F", //      nav SOL dropdown (re-probed f0500 p{1408,28})
  tickerBg: "#1F222B", //       ticker strip bg, lighter than panelBg (f0500 p{330,73})
  circleBtnBg: "#303338", //    nav star/bell circular buttons (f0500 p{1570,15})
  walletChipBg: "#26292E", //   nav wallet chip (f0500 p{1700,27})
  mcWhite: "#DFE2E7", //        big MC figure is near-white on every plate (f0500 p{370,112})
  verbGreen: "#63B6A2", //      toast card "bought"/"bought more" verb (f0430 p{950,29})
  warnAmber: "#D8AB2C", //      partial-toast amber dot (f1650 p{784,268})
  checkTeal: "#17A296", //      s4/tc toast check circle (f0500 x851-858 y80 scan)
  yellow: "#D8C05C", //         loading "Select P1…" message (f0350)
  loadTealBtn: "#268068", //    loading "Gas preset not selected" button
  gold: "#C9A227", //           trophy chip / gas icons
  // text
  textHi: "#E9ECF3",
  text: "#C6C9D2",
  textMid: "#8B8E97",
  textDim: "#5E626E",
  tickerSol: "#B9B8C4", //      "13.010101 SOL" — brighter than the LABEL on the plates (r3 probe #CECDD5 core)
  tickerLabel: "#7A7D84", //    ticker item label ("STAR $9.99K") is DIM, not white (r3 probe)
  // r3 small-text ink (probed at glyph size off f0900 — JPEG stroke bleed
  // makes 11-13px text far dimmer than the big-glyph colors above; the
  // plates are the target, so small text adopts the measured cores)
  dimLabel: "#6E717C", //       11px rail labels (Bought/Sold/…, grid labels)
  dimTeal: "#649B97", //        13px teal values (s24 buys/net, pos bought/pnl)
  dimPink: "#87536C", //        13px pink values (s24 sells, pos sold)
  dimWhite: "#7A7E8A", //       13px white values (s24 vol, pos holding, counts)
  tiTeal: "#74AFAA", //         token-info grid teal values (slightly brighter)
  tiPink: "#82576D", //         token-info grid pink values
  sand: "#B0A290", //           gas/tip icons + values + warn triangles (washed gold)
  sandVal: "#A3958C", //        popup settings gas/tip VALUES (dimmer than the icons, r4 probe)
  settingsGrey: "#747680", //   popup settings 50%/Off/pre-warn tip — dimmer than textMid (r4)
  railPreset: "#ACAFB6", //     rail preset cell numbers
  // r3 popup probes (r4: pill TEXT re-probed on the sharper f1050 — greener)
  popupPillBuyRing: "#37444A", //  buy pill ring (grey-teal, was #1E4D48)
  popupPillSellRing: "#3A2F3D", // sell pill ring (grey-mauve, was #4A2338)
  popupPillBuyText: "#70ADA7", //  f0500 #71B0A8 / f1050 #6FA9A5
  popupPillSellText: "#96647F", // f0500 #925D77 / f1050 #9A6C87
  // r4 mid-purple family — anchored on HODLER (cleanest 44px glyph run, f0500):
  // text #645EA6, chip bg #29294D. P3 (#615C92/#262545), DRILLIFY (#6E69AC),
  // rail PRESET 3 (#6E68A6/#28274A) all probe within JPEG noise of the anchor.
  tabActiveText: "#645EA6", //  HODLER/DRILLIFY/P3/PRESET-3 purple text family
  tabActiveBg: "#29294D", //    purple-navy chip bg family
  tabActiveBorder: "#2E3252",
  tabIdleText: "#818294",
  sellInit: "#B27590", //       "Sell Init." pink (r4 core probe, was #A86C88)
  footTeal: "#7CB2B1", //       popup footer bought/pnl
  footPink: "#9B6885", //       popup footer sold
  footWhite: "#8B8F99", //      popup footer holding
  solChipBg: "#33353C", //      popup Buy-row SOL chip
  solChipText: "#D6D9E0",
  usdcBlue: "#5581B5", //       USDC disc blend (official #2775CA washed by JPEG)
  // ≡ bars = Solana glyph, vertical teal→blue→purple gradient
  // (r4 re-probe, popup footer icons rows y704/707/711 on f0500+f1050:
  // top #51727E/#516F85, mid #3C5E74/#3F5A7E, bot #5E6E90/#5B6796)
  barsTop: "#51707F",
  barsMid: "#3E5D75",
  barsBot: "#5C6B93",
  ohlcPos: "#3ED6C5",
  ohlcNeg: "#E85D86",
  onTeal: "#0B1418", //         text on solid teal buttons
  pnlPillBg: "#395C5C", //      header +% pill behind green text
  loadPageBg: "#101319", //     loading chart area before the flash
  blueFlash: "#053BA5", //      solid blue chart flash, measured f0378 center
} as const;

// ─── FONT ────────────────────────────────────────────────────────────
// Inter (400/500/600/700). Verified against plate glyphs: single-storey
// "g" (Strategy), flat-top "1" without base serif (13.010101), open "a"
// — consistent with Inter; no plate glyph contradicts it.

// ═══════════════════════════════════════════════════════════════════
// LIVE VARIANT (Axiom Pro), frames 418–2112
// ═══════════════════════════════════════════════════════════════════

export const NAV = {
  brand: "AXIOM",
  brandSuffix: "Pro",
  links: [
    "Discover",
    "Pulse",
    "Trackers",
    "Perpetuals",
    "Yield",
    "Vision",
    "Portfolio",
    "Rewards",
  ],
  searchPlaceholder: "Search by token or CA...",
  searchHint: "/",
  solLabel: "SOL",
  deposit: "Deposit",
  zeroChip: "0",
} as const;

// Ticker strip below nav — verified static (identical f0500/f1000/f1600).
// icon: "spax" | "neta" use sprites; "dark" renders a dark rounded square.
export const TICKER = {
  items: [
    { icon: "dark", label: "MARS $3.99K", sol: "13.010101 SOL" },
    { icon: "spax", label: "SPAX $6.42K", sol: "13.010101 SOL" },
    { icon: "dark", label: "XXX $6.38K", sol: "13.010101 SOL" },
    { icon: "dark", label: "STAR $9.99K", sol: "13.010101 SOL" },
    { icon: "dark", label: "X $261K", sol: "13.010101 SOL" },
    { icon: "dark", label: "X $108K", sol: "13.010101 SOL" },
    { icon: "dark", label: "X $5.45K", sol: "13.010101 SOL" },
    { icon: "neta", label: "NETA... $24.6K", sol: "13.010101 SOL" },
  ],
} as const;

export const HEADER = {
  name: "Pumpwheel",
  subtitle: "The Pumpfun Flywheel",
  cols: {
    price: "Price",
    liquidity: "Liquidity",
    supply: "Supply",
    fees: "Global Fees Paid",
  },
  supplyValue: "1B",
  trophyCount: "19",
  sharePnl: "Share PnL",
  alert: "Alert",
  // right-corner 24h block lives in the rail (RAIL.stats24 labels)
} as const;

export const CHART_TOOLBAR = {
  timeframes: ["1s", "5s", "15s", "3m", "30m"], // "1s" active (teal)
  indicators: "Indicators",
  displayOptions: "Display Options",
  showAllBubbles: "Show All Bubbles",
  usdSol: { active: "USD", inactive: "/SOL" },
  mcPrice: { active: "MarketCap", inactive: "/Price" },
  layoutName: "Axion", // top-right text field label (best guess vs plate)
  save: "Save",
} as const;

export const OHLC = {
  // "The Pumpfun Flywheel/USD on Pump V1 · 1s · axiom.trade" + green dot
  symbolLine: "The Pumpfun Flywheel/USD on Pump V1 · 1s · axiom.trade",
  o: "O",
  h: "H",
  l: "L",
  c: "C",
} as const;

export const CHART_FOOT = {
  ranges: ["3m", "1m", "5d", "1d"],
  utcSuffix: " (UTC)",
  pct: "%",
  log: "log",
  auto: "auto", // highlighted blue
  tvLogo: "TV",
} as const;

export const POPUP = {
  tabs: ["HODLER", "J7DEV", "DRILLIFY"], // HODLER active
  presetsLabels: ["P1", "P2", "P3"], // P3 active (purple)
  walletCount: "4",
  buy: "Buy",
  sol: "SOL",
  usdc: "USDC",
  // teal buy preset amounts (two rows)
  buyPresets: [
    ["0.1", "2", "3", "5"],
    ["7", "12", "20", "30"],
  ],
  // settings row under buy presets: "% 50% ⛽0.0₃2⚠ 🍬0.01 ∅ Off | Adv."
  buySettings: { pct: "50%", gas: ["0.0", "3", "2"], tip: "0.01", off: "Off", adv: "Adv." },
  sell: "Sell",
  sellModePct: "%",
  sellModeSol: "SOL",
  // red sell presets — first rows until f822, second from f823 (measured flip)
  sellPresetsA: [
    ["13.37%", "22%", "33%", "100%"],
    ["2.6%", "4.7%", "10%", "50%"],
  ],
  sellPresetsB: [
    ["1", "3", "5", "10"],
    ["0.5", "2", "15", "20"],
  ],
  // settings row 2: "% 40% ⛽0.0₃5⚠ 🍬0.0₃5⚠ ∅ Off | Sell Init."
  sellSettings: { pct: "40%", gas: ["0.0", "3", "5"], tip: ["0.0", "3", "5"], off: "Off", init: "Sell Init." },
  pumpwheelShort: "Pumpwh...",
} as const;

export const RAIL = {
  stats24: { vol: "24h Vol", buys: "Buys", sells: "Sells", net: "Net Vol." },
  buyTab: "Buy",
  sellTab: "Sell",
  orderTabs: ["Market", "Limit", "Adv."], // Market active
  amountLabel: "AMOUNT",
  amountValue: "0.0",
  presets: ["0.1", "2", "3", "5"],
  settings: { pct: "50%", gas: ["0.0", "3", "2"], tip: "0.01", off: "Off" },
  advCheckbox: "Advanced Trading Strategy",
  buyButton: "Buy Pumpwheel",
  statLabels: { bought: "Bought", sold: "Sold", holding: "Holding", pnl: "PnL" },
  presetTabs: ["PRESET 1", "PRESET 2", "PRESET 3"], // PRESET 3 active
  tokenInfo: "Token Info",
  gridLabels: [
    "Top 10 H.",
    "Dev H.",
    "Snipers H.",
    "Insiders",
    "Bundlers",
    "LP Burned",
  ],
  countLabels: ["Holders", "Pro Traders", "Dex Paid"],
  dexPaidValue: "Unpaid", // pink, constant across all samples
  ca: "CA: Bs2RsPYeUMi5kPz...f4jD",
  da: "DA: qxiHLqkTTcZd...eMvg",
  deployerRow: { addr: "4UqU...1P2U", sol: "4.30", age: "10mo" },
  similar: "Similar Tokens",
  similarSort: "MC",
} as const;

// Migrating-phase rail/bottom content (plates f0420-f0438; f0418 is live,
// button flips purple→teal between f0435 and f0439).
export const MIGRATE = {
  fromF: 420,
  untilF: 438,
  devTokensCountFromF: 439, // "Dev Tokens" count appears with the live flip
  snipeBg: "#6B5EEA", //       purple button bg (f0420 p{1700,447}; r4 f0425 re-probe #6A5FE9 ✓)
  snipeText: "#0D0D50", //     purple button label ink (r4 probemin f0425; #23227A was too light)
  snipeLabel: "Snipe PUMPWHEEL",
  message: [
    "This pair is currently migrating. This is",
    "usually instant, so if you see this message,",
    "you should refresh the page.",
  ],
  reusedLabel: "Reused Image Tokens", // dusty-red link above Similar Tokens
  reusedColor: "#A85F63", //           (f0420 only; absent from f0500 on)
} as const;

// PRESET 3 pill — r4 re-probe f0500 (bg #29284A/#26263F, text core mid
// #6A65A0): both sit inside the mid-purple family → unified onto it.
// The old #403C6F/#A6A0EE were far brighter than the plate.
export const PRESET3_STYLE = { bg: COLORS.tabActiveBg, text: COLORS.tabActiveText } as const;

export const BOTTOM = {
  tabs: ["Trades", "Positions", "Orders", "Holders", "Top Traders", "Dev Tokens"],
  devTokensCount: "2005",
  instantTrade: "Instant Trade",
  tradesPanelRow: ["Trades Panel", "DEV", "TRACKED", "YOU"], // mostly hidden behind dock
  tableHead: { age: "Age", time: "Time", type: "Type", mc: "MC", amount: "Amount", totalSol: "Total SOL" },
} as const;

export const DOCK = {
  user: "Jason",
  tabs: ["Manager", "Trades", "Monitor"], // Trades active; Trades+Monitor carry red dots
  preset: "P3",
  bolt: "13.010",
  tableHead: ["Name", "Token", "Amount", "$MC"],
} as const;

// Toast texts by kind (see timeline-token.ts for the schedule DSL).
export const TOASTS = {
  attempting: (s: number) => `Attempting transaction (${s}s)`,
  succeeded4: "All 4 transactions succeeded",
  confirmed: "Transaction confirmed!",
  partial: (n: number) => `1/${n} transactions succeeded: Transaction confirmed!`,
  missing: (n: number) => `${n} wallets missing token balances`,
  // Wide toasts — both ends run past the sampled crop; middles are exact,
  // ends are best guesses. // UNREADABLE (ends)
  failConsumed:
    "0/4 transactions succeeded: Transaction failed and priority fees were consumed",
  failInsufficient:
    "All transactions failed and priority fees were consumed: Insufficient input amount",
  failTimeout:
    "Transactions failed or timed out, try increasing priority fee/bribe/slippage",
  failTimeout2:
    "0/4 transactions succeeded: Transaction timed out, try increasing priority fee",
  // Wide band toast, read EXACTLY off plate f1590 (left/right halves @300%):
  failAllInput:
    "All transactions failed and priority fees were consumed: Transaction failed and priority fees were consumed: Insufficient input tokens",
  notEnough:
    "Error getting tokens to sell: Not enough tokens to sell for 5 SOL",
  // buy/sell notification cards: "<name> <verb> <token>" + "≡<amt> at <mc> MC"
  cardAt: "at",
  cardMcSuffix: "MC",
} as const;

// ═══════════════════════════════════════════════════════════════════
// LOADING VARIANT (Trenches UI), frames 333–391
// ═══════════════════════════════════════════════════════════════════

export const LOAD_NAV = {
  links: ["Trenches", "Trending", "Portfolio", "Track", "Rewards"],
  pasteCa: "Paste CA",
  searchPlaceholder: "Search by name or CA...",
  searchHint: "/",
} as const;

export const LOAD_HEADER = {
  name: "Pumpwheel/SOL",
  subtitle: "The Pumpfun Flywheel",
  viewsInit: "5",
  fundChip: "Fund",
  cols: {
    price: "Price",
    liquidity: "Liquidity",
    supply: "Supply",
    fees: "Total Fees Paid",
    curve: "B. Curve",
  },
  supplyValue: "1B",
  feesValue: "0.034", // appears with liquidity at ~f381
} as const;

export const LOAD_DIALOG = {
  tabs: ["HODLER", "J7DEV", "DRILLIFY"],
  walletsSelected: "4 Wallets Selected",
  buy: "Buy",
  sell: "Sell",
  market: "Market",
  total: "Total",
  totalUnit: "SOL",
  totalZero: "0",
  presets: ["0.1", "2", "3", "5"],
  exitStrategy: "Exit Strategy",
  selectPreset: "Select P1, P2 or P3 preset above", // yellow, ↑ prefix
  gasButton: "Gas preset not selected", // dim teal pill
  statCols: ["5M", "1H", "6H", "24H"],
  statDash: "-",
  statZero: "0.0%", // from ~f381
  tokenData: "Token Data & Security",
  // stat cards by phase (see timeline LOAD tables for values)
  cardLabels10: [
    "Top 10 H.",
    "Dev holding",
    "Snipers",
    "Insiders H.",
    "Bundles H.",
    "Burned Liq.",
    "Fresh buys",
    "Fresh holding",
    "Mint Auth.",
    "Freeze Auth.",
  ],
  cardLabels4: ["Top 10 H.", "Dev holding", "Bundles H.", "Fresh holding"],
  snipersBadge: "1",
  no: "No",
  ca: "CA: Bs2RsPYeUMi5kPzHtey...f4jD",
  da: "DA: qxiHLqkTTcZddWs48P6...eMvg",
  similar: "Similar Tokens",
  similarSort: "VOL",
} as const;

export const LOAD_POPUP = {
  tabs: ["HODLER", "J7DEV", "DRILLIFY"],
  tooltip: "Edit button values", // visible over J7DEV until ~f370
  walletCount: "4",
  presetsLabels: ["P1", "P2", "P3"], // P3 active
  buy: "Buy",
  buyPresets: [
    ["0.1", "2", "3", "5"],
    ["7", "12", "20", "30"],
  ],
  buySettings: { gas: "0.005", tip: "0.005", pct: "100%", shield: "On" },
  sell: "Sell %",
  sellPresets: [
    ["13.3%", "22%", "33%", "100%"],
    ["2.6%", "2.7%", "10%", "50%"],
  ],
  sellSettings: { gas: "0.003", tip: "0.003", pct: "100%", off: "Off", init: "Sell Init." },
  pumpwheel: "Pumpwheel",
} as const;

export const LOAD_TOASTS = {
  executing: "Executing orders",
  completed: "Orders completed",
  buyLine: "Buy", // + [pumpwheel icon] + "Pumpwheel  for 8 SOL"
  buyToken: "Pumpwheel",
  buyAmount: "for 8 SOL",
  waiting: "Waiting",
  success: "Success",
  error: "Error",
  // counts: 4 wallets in flight; flip to success when the order completes
  walletTotal: "4",
  zero: "0",
} as const;

// Padre chart flash inside the loading screen (plates f0378-f0391).
export const LOAD_PADRE = {
  timeframes: ["1s", "5s", "15s", "1m"], // "1s" active (blue)
  indicators: "Indicators",
  priceMcap: { prefix: "Price / ", active: "MCap" },
  display: "Display",
  layout: "Default ▾",
  symbolLine: "Pumpwheel/SOL · trade.padre.gg",
  ohlc: { o: "19.1K", h: "32.3K", l: "19.1K", c: "32.3K", d: "13.3K", dp: "+69.56%" },
  migration: "Migration ─ ─",
  avgFill: "Avg. Fill Price",
  avgFillChip: "6K",
  priceChip: "34.3K",
  highChip: "High 32.3K",
  lastChip: "32.3K",
  lowChip: "Low 2.57K",
  timeLabels: ["15:03", "15:03:14"],
  footRanges: "1h 3d 1m ⏱",
  footClock: "15:02:52 (UTC) · % log ",
  footAuto: "auto",
} as const;

export const LOAD_BOTTOM = {
  tabs: ["Trades", "Positions", "Orders", "Holders", "Top Traders", "Dev Tokens"],
  devTokensCount: "2015",
  instantTrade: "Instant trade", // teal filled pill (lowercase t on plate)
  feedLive: "Feed is live",
  filter: "Filter:",
  filters: ["All", "Mine", "Dev", "KOL", "Tracked"], // All active
  tableHead: {
    age: "Age",
    tipPrio: "Tip & Prio",
    side: "Side",
    mcap: "MCap",
    amount: "Amount",
    totalUsd: "Total USD",
    totalSol: "Total SOL",
    maker: "Maker",
  },
} as const;
