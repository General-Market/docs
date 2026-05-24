// Capture source-article screenshots for the AntiCheatEdit article overlays.
//
// For each target: open the live URL (SEC.gov blocks headless, so those route
// through the Wayback Machine), dismiss consent, strip the archive banner,
// screenshot the top of the page, and record the bounding boxes of the key
// phrase(s) + the venue name as fractions of the image. Those fractions drive
// the yellow highlighter and green name-underline in the overlay (same
// machinery as AntiCheatRigged).
//
// Also writes <slug>.debug.png with the boxes drawn on, so alignment can be
// eyeballed without rendering the whole video.
//
// Run:  node 07_article_shots.mjs
import pw from "/Users/maxguillabert/Downloads/index/frontend/node_modules/playwright/index.js";
const { chromium } = pw;
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/maxguillabert/Downloads/index/video/public/anticheat-edit/articles";
const DATA_TS = "/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit/overlays/article-shots.ts";
const CHROME =
  "/Users/maxguillabert/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const VW = 1440, VH = 1120;

// url = canonical citation; fetchUrl = what we actually open.
// phrases = damning lines to strike yellow (in priority order); name = venue
// (green underline). Keep phrases short so they sit in one text node.
const TARGETS = [
  // ─── Strong regulator / news receipts (Wayback-routed where the origin
  //     blocks headless or throws a cookie wall) ───────────────────────────
  {
    slug: "listing-frontrun",
    url: "https://www.sec.gov/news/press-release/2022-127",
    fetchUrl: "https://web.archive.org/web/2023/https://www.sec.gov/news/press-release/2022-127",
    name: "Coinbase",
    phrases: ["Insider Trading", "insider trading scheme", "tipping"],
  },
  {
    slug: "order-flow-vis",
    url: "https://www.sec.gov/news/press-release/2023-101",
    fetchUrl: "https://web.archive.org/web/2023/https://www.sec.gov/news/press-release/2023-101",
    name: "Binance",
    phrases: ["manipulative", "Sigma Chain", "commingled"],
  },
  {
    slug: "pfof",
    url: "https://www.sec.gov/newsroom/press-releases/2020-321",
    fetchUrl: "https://web.archive.org/web/2022/https://www.sec.gov/news/press-release/2020-321",
    name: "Robinhood",
    phrases: ["payment for order flow", "best execution", "misleading"],
  },
  {
    slug: "jito-mev",
    url: "https://www.helius.dev/blog/solana-mev-an-introduction",
    fetchUrl: "https://web.archive.org/web/2024/https://www.helius.dev/blog/solana-mev-an-introduction",
    name: "Solana",
    phrases: ["sandwich", "MEV", "extract", "front-run"],
  },
  {
    slug: "adl-visibility",
    url: "https://www.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle",
    fetchUrl:
      "https://web.archive.org/web/2025/https://www.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle",
    name: "Hyperliquid",
    phrases: ["delists", "validators", "vault"],
  },
  {
    slug: "polymarket",
    url: "https://www.cftc.gov/PressRoom/PressReleases/8478-22",
    name: "Polymarket",
    phrases: ["binary options", "unregistered", "$1.4 million"],
  },
  // ─── Program / docs receipts (the privilege, stated by the venue) ────────
  {
    slug: "maker-rebate",
    url: "https://www.binance.com/en/blog/markets/introducing-the-new-and-improved-spot-liquidity-provider-program-421499824684903432",
    fetchUrl:
      "https://web.archive.org/web/2024/https://www.binance.com/en/blog/markets/introducing-the-new-and-improved-spot-liquidity-provider-program-421499824684903432",
    name: "Binance",
    phrases: ["Liquidity Provider", "rebate", "maker"],
  },
  {
    slug: "vip-fee-tier",
    url: "https://www.binance.com/en/fee/trading",
    fetchUrl: "https://web.archive.org/web/2024/https://www.binance.com/en/fee/trading",
    name: "Binance",
    phrases: ["VIP", "Maker", "Taker"],
  },
  {
    slug: "matching",
    url: "https://developers.binance.com/docs/binance-spot-api-docs/faqs/order_amend_keep_priority",
    name: "Binance",
    phrases: ["Order Amend Keep Priority", "priority", "queue"],
  },
  {
    slug: "funding",
    url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding",
    name: "Hyperliquid",
    phrases: ["funding", "cap", "interest"],
  },
  {
    slug: "long-list",
    url: "https://generalmarket.io/anticheat-flags",
    name: "",
    phrases: [],
  },
  // ─── More receipts — fill the mechanisms that had no proof flash ─────────
  {
    // M1 Colocation — the venue sells the rack next to its matching engine.
    slug: "colocation",
    url: "https://www.cmegroup.com/trading/colocation/co-location-services.html",
    fetchUrl:
      "https://web.archive.org/web/2024/https://www.cmegroup.com/trading/colocation/co-location-services.html",
    name: "CME Group",
    phrases: ["Co-Location", "low-latency", "matching engine"],
  },
  {
    // M3 Maxing out — the venue pays the maker to keep its advantage.
    slug: "maxing-out",
    url: "https://www.bybit.com/en/help-center/article/Introduction-to-the-Market-Maker-Incentive-Program",
    fetchUrl:
      "https://web.archive.org/web/2024/https://www.bybit.com/en/help-center/article/Introduction-to-the-Market-Maker-Incentive-Program",
    name: "Bybit",
    phrases: ["Market Maker Incentive", "rebate", "exclusive"],
  },
  {
    // M9 Cancellation priority — "Last Look": reject the trade that would lose.
    slug: "last-look",
    url: "https://www.dfs.ny.gov/reports_and_publications/press_releases/pr1511181",
    fetchUrl:
      "https://web.archive.org/web/2023/https://www.dfs.ny.gov/reports_and_publications/press_releases/pr1511181",
    name: "Barclays",
    phrases: ["Last Look", "rejected", "unprofitable"],
  },
  {
    // M10 API rate limits — the ceiling is the wall; the maker gets a higher one.
    slug: "api-rate",
    url: "https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits",
    name: "Binance",
    phrases: ["REQUEST_WEIGHT", "rate limit", "IP ban"],
  },
  {
    // Outro — one more case: oracle manipulation drained $110M.
    slug: "mango",
    url: "https://www.cftc.gov/PressRoom/PressReleases/8647-23",
    fetchUrl: "https://web.archive.org/web/2023/https://www.cftc.gov/PressRoom/PressReleases/8647-23",
    name: "Mango Markets",
    phrases: ["manipulative", "misappropriate", "oracle"],
  },
  // ─── Our own site — b-roll, not receipts. No yellow strike: nothing to
  //     incriminate here. Clean top-of-page reveals, shown when the talk turns
  //     to "we made a blog", "with general market…", and the Discord CTA. ────
  {
    slug: "gm-home",
    url: "https://generalmarket.io",
    name: "",
    phrases: [],
  },
  {
    slug: "gm-flags",
    url: "https://generalmarket.io/anticheat-flags",
    name: "",
    phrases: [],
  },
];

// In-page: best box for a phrase, in viewport coords. Prefer an occurrence
// inside a heading/paragraph and within the captured region [0, vh).
function measure(args) {
  const { needle, vh, headingFirst } = args;
  const low = needle.toLowerCase();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let node;
  while ((node = walk.nextNode())) {
    const txt = node.textContent;
    const i = txt.toLowerCase().indexOf(low);
    if (i < 0) continue;
    const rg = document.createRange();
    rg.setStart(node, i);
    rg.setEnd(node, Math.min(txt.length, i + needle.length));
    const r = rg.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    if (r.top < 0 || r.top > vh - 8) continue; // must be inside the shot
    const tag = (node.parentElement?.closest("h1,h2,h3,p,article,main,li")?.tagName) || "";
    const heading = /^H[1-3]$/.test(node.parentElement?.closest("h1,h2,h3")?.tagName || "");
    hits.push({ x: r.left, y: r.top, w: r.width, h: r.height, heading, top: r.top, tag });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => {
    if (headingFirst && a.heading !== b.heading) return a.heading ? -1 : 1;
    return a.top - b.top; // otherwise topmost
  });
  const h = hits[0];
  return { x: h.x, y: h.y, w: h.w, h: h.h };
}

async function dismiss(page) {
  for (const t of ["Accept all", "Accept All", "Accept", "I Agree", "Agree", "Got it", "OK", "Continue", "Allow all"]) {
    try {
      const b = page.getByRole("button", { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 300 })) { await b.click({ timeout: 700 }); await page.waitForTimeout(200); }
    } catch {}
  }
}

const toFrac = (r) => r && { x: r.x / VW, y: r.y / VH, w: r.w / VW, h: r.h / VH };

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  // Optional slug filter: `node 07_article_shots.mjs jito-mev pfof` re-captures
  // only those, reusing the existing manifest for the rest (so a fix to one
  // shot doesn't risk re-flaking the others).
  const ONLY = process.argv.slice(2);
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "manifest.json"), "utf8")); } catch {}
  const prevBySlug = Object.fromEntries(prev.map((e) => [e.slug, e]));

  const manifest = [];
  for (const t of TARGETS) {
    if (ONLY.length && !ONLY.includes(t.slug)) {
      if (prevBySlug[t.slug]) { manifest.push(prevBySlug[t.slug]); console.log(`skip ${t.slug} (kept)`); }
      continue;
    }
    const entry = { slug: t.slug, name: t.name, url: t.url, image: `anticheat-edit/articles/${t.slug}.png`, highlights: [], status: "ok" };
    try {
      const page = await ctx.newPage();
      await page.goto(t.fetchUrl || t.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      await dismiss(page);
      await page.evaluate(() => {
        document.querySelectorAll('[id^="wm-ipp"]').forEach((e) => e.remove());
        window.scrollTo(0, 0);
      }).catch(() => {});
      await page.waitForTimeout(300);

      for (const p of t.phrases) {
        const r = await page.evaluate(measure, { needle: p, vh: VH, headingFirst: true }).catch(() => null);
        const f = toFrac(r);
        if (f) entry.highlights.push({ phrase: p, ...f });
      }
      if (t.name) {
        const nr = await page.evaluate(measure, { needle: t.name, vh: VH, headingFirst: true }).catch(() => null);
        const nf = toFrac(nr);
        if (nf) entry.nameBox = nf;
      }

      await page.screenshot({ path: path.join(OUT_DIR, `${t.slug}.png`), clip: { x: 0, y: 0, width: VW, height: VH } });

      // Debug overlay: draw the boxes on the live page, screenshot again.
      await page.evaluate((args) => {
        const [boxes, name, vw, vh] = args;
        const o = document.createElement("div");
        o.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;z-index:2147483647;pointer-events:none`;
        const add = (b, color) => {
          const d = document.createElement("div");
          d.style.cssText = `position:absolute;left:${b.x * vw}px;top:${b.y * vh}px;width:${b.w * vw}px;height:${b.h * vh}px;background:${color};opacity:.45;outline:2px solid red`;
          o.appendChild(d);
        };
        for (const b of boxes) add(b, "yellow");
        if (name) add(name, "lime");
        document.body.appendChild(o);
      }, [entry.highlights, entry.nameBox, VW, VH]).catch(() => {});
      await page.screenshot({ path: path.join(OUT_DIR, `${t.slug}.debug.png`), clip: { x: 0, y: 0, width: VW, height: VH } });

      console.log(`OK   ${t.slug}: ${entry.highlights.length} highlight(s)${entry.nameBox ? " + name" : ""}`);
      await page.close();
    } catch (e) {
      entry.status = "fail: " + (e.message || e).slice(0, 120);
      console.log(`FAIL ${t.slug}: ${entry.status}`);
    }
    manifest.push(entry);
  }
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const ok = manifest.filter((e) => e.status === "ok");
  const ts =
    `// AUTO-GENERATED by scripts/talking-head-edit/07_article_shots.mjs — do not edit by hand.\n` +
    `// Highlight + name boxes are fractions of the captured screenshot.\n` +
    `export type ArticleBox = { x: number; y: number; w: number; h: number };\n` +
    `export type ArticleShot = {\n  slug: string;\n  name: string;\n  image: string;\n  highlights: ArticleBox[];\n  nameBox?: ArticleBox;\n};\n\n` +
    `export const ARTICLE_SHOTS: ArticleShot[] = ${JSON.stringify(
      ok.map((e) => ({
        slug: e.slug,
        name: e.name,
        image: e.image,
        highlights: e.highlights.map(({ x, y, w, h }) => ({ x, y, w, h })),
        ...(e.nameBox ? { nameBox: e.nameBox } : {}),
      })),
      null,
      2,
    )};\n`;
  fs.writeFileSync(DATA_TS, ts);
  await browser.close();
  console.log(`\nmanifest -> ${OUT_DIR}/manifest.json\ndata     -> ${DATA_TS}`);
};
main();
