#!/usr/bin/env node
// Turn the day's selection into a ready-to-post bundle:
//   1. search for the most-engaged last-hour tweet about the winner (pick_tweet.py)
//   2. render that category's WinnersReel to an mp4
//   3. write post.txt — headline, winner, quote target, suggested caption
//   4. fire a macOS notification
//
//   node scripts/winners-daily/build-bundle.mjs
//
// Reads selection.json (written by fetch-flows.mjs). Output lands in
// ~/Downloads/winners-daily/YYYY-MM-DD/.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(HERE, "..", "..");
const SELECTION = join(HERE, "selection.json");

const fmtUSD = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const signedUSD = (v) => `${v >= 0 ? "+" : "−"}${fmtUSD(Math.abs(v))}`;
const today = () => new Date().toISOString().slice(0, 10);

async function main() {
  if (!existsSync(SELECTION)) throw new Error("selection.json missing — run fetch-flows.mjs first");
  const sel = JSON.parse(await readFile(SELECTION, "utf8"));
  const w = sel.winner;
  const top = w.top;
  const pct = top.pct;
  const deltaUsd = top.now - top.prior;

  const outDir = join(homedir(), "Downloads", "winners-daily", today());
  await mkdir(outDir, { recursive: true });
  const slug = w.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const mp4 = join(outDir, `${slug}-winners-${today()}.mp4`);
  const tweetJson = join(outDir, "tweet.json");

  // 1 — tweet search (never fatal)
  console.log(`→ searching last-hour tweets for ${top.name} ($${top.symbol ?? "?"}) …`);
  const py = spawnSync("python3", [
    join(HERE, "pick_tweet.py"),
    "--name", top.name,
    ...(top.symbol ? ["--symbol", String(top.symbol)] : []),
    "--out", tweetJson,
    "--window-min", "60",
  ], { stdio: "inherit" });
  if (py.status !== 0) console.warn("  (tweet search exited non-zero — continuing without a quote target)");

  let tweet = null, tweetCost = 0, tweetReason = "tweet search did not run";
  if (existsSync(tweetJson)) {
    const tj = JSON.parse(await readFile(tweetJson, "utf8"));
    tweet = tj.tweet; tweetCost = tj.cost_usd ?? 0; tweetReason = tj.reason ?? "";
  }

  // 2 — render the reel (inherit stdio; never pipe remotion stdout — it detaches a
  //     runaway bundler that copies all of public/ and fills the disk)
  console.log(`→ rendering ${w.compositionId} → ${mp4}`);
  const r = spawnSync("npx", ["remotion", "render", "src/index.ts", w.compositionId, mp4],
    { cwd: VIDEO, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`remotion render failed (exit ${r.status})`);

  // 3 — post.txt
  const others = sel.ranking
    .filter((x) => x.compositionId !== w.compositionId)
    .map((x) => `${x.category} ${x.topName} +${x.topPct}%`)
    .join("  ·  ");

  const caption =
    `${top.name} led ${w.category} this week — TVL up ${pct.toFixed(1)}% in seven days ` +
    `while most of the field sat still. The market keeps its own scoreboard.`;

  const quoteBlock = tweet
    ? `Quote-tweet this (most-engaged in the last hour):\n` +
      `  ${tweet.url}\n` +
      `  @${tweet.author} · ♥${tweet.likes} ↺${tweet.retweets} 💬${tweet.replies}\n` +
      `  "${(tweet.text || "").replace(/\s+/g, " ").slice(0, 160)}"`
    : `No tweet about ${top.name} in the last hour (${tweetReason}).\n` +
      `  Post the reel on its own, or write your own quote.`;

  const post =
`${w.category.toUpperCase()} — biggest 7-day mover   ·   ${sel.asof}

  ${top.name}   +${pct.toFixed(1)}%
  ${fmtUSD(top.now)} TVL   ·   ${signedUSD(deltaUsd)} in 7 days

Reel:  ${mp4.split("/").pop()}

${quoteBlock}

Suggested caption:
  ${caption}

Other movers today:  ${others || "—"}

Data: DefiLlama /protocols (free), 7-day TVL change.  Tweet search cost: $${tweetCost}.
`;
  const postPath = join(outDir, "post.txt");
  await writeFile(postPath, post);
  console.log(`\n${post}`);
  console.log(`Wrote ${postPath}`);

  // 4 — notification
  const note = `${w.category}: ${top.name} +${pct.toFixed(1)}% — reel ready`;
  spawnSync("osascript", ["-e",
    `display notification ${JSON.stringify("Drop the mp4 onto Twitter. Folder: " + outDir)} with title ${JSON.stringify("Winners reel")} subtitle ${JSON.stringify(note)}`,
  ]);

  console.log(`\n▶ Bundle ready: ${outDir}`);
}

main().catch((e) => { console.error("build-bundle failed:", e.message); process.exit(1); });
