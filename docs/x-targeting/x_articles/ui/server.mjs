import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const xTargetingRoot = path.resolve(__dirname, "../..");
const engagementRoot = path.join(xTargetingRoot, "engagement_queue");
const repoRoot = path.resolve(xTargetingRoot, "../..");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const defaultEngagementTargets = ["100xgemfinder", "chinadegen"];
let refreshInFlight = null;

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function safeReadDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
}

function listIndex() {
  const dates = safeReadDirs(root)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return dates.map((date) => {
    const dateDir = path.join(root, date);
    const niches = safeReadDirs(dateDir)
      .map((entry) => {
        const file = path.join(dateDir, entry.name, "articles.jsonl");
        const articles = readJsonl(file);
        return {
          niche: entry.name,
          count: articles.length,
          top: articles[0] || null,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => a.niche.localeCompare(b.niche));
    return { date, niches };
  });
}

function getArticles(url) {
  const date = url.searchParams.get("date");
  const niche = url.searchParams.get("niche");
  if (!date || !niche || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-z0-9-]+$/.test(niche)) {
    return { error: "invalid date or niche" };
  }
  const file = path.join(root, date, niche, "articles.jsonl");
  return {
    date,
    niche,
    articles: readJsonl(file),
  };
}

function listEngagementIndex() {
  const dates = safeReadDirs(engagementRoot)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return dates.map((date) => {
    const dateDir = path.join(engagementRoot, date);
    const targets = safeReadDirs(dateDir)
      .map((entry) => {
        const file = path.join(dateDir, entry.name, "queue.jsonl");
        const rows = readJsonl(file);
        return {
          target: entry.name,
          count: rows.length,
          top: rows[0] || null,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => a.target.localeCompare(b.target));
    return { date, targets };
  });
}

function getEngagementQueue(url) {
  const date = url.searchParams.get("date");
  const target = url.searchParams.get("target");
  if (!date || !target || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_]+$/.test(target)) {
    return { error: "invalid date or target" };
  }
  const file = path.join(engagementRoot, date, target.toLowerCase(), "queue.jsonl");
  return {
    date,
    target: target.toLowerCase(),
    queue: readJsonl(file),
  };
}

function safeTarget(value) {
  const fallback = defaultEngagementTargets[0];
  const target = (value || fallback).replace(/^@/, "").toLowerCase();
  if (!/^[a-zA-Z0-9_]+$/.test(target)) return fallback;
  return target;
}

function refreshEngagementQueue(targetValue) {
  if (refreshInFlight) return refreshInFlight;
  const target = safeTarget(targetValue);
  const script = path.join(engagementRoot, "run_daily.sh");
  refreshInFlight = new Promise((resolve) => {
    const child = spawn("bash", [script], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ROOT_DIR: repoRoot,
        X_ENGAGEMENT_TARGET: target,
        X_ENGAGEMENT_MAX_BOT_RISK: target === "chinadegen" ? "0" : (process.env.X_ENGAGEMENT_MAX_BOT_RISK || "2"),
      },
    });
    let output = "";
    const append = (chunk) => {
      output = (output + chunk.toString()).slice(-12000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      resolve({ ok: false, code: 1, output: error.message });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, code, output });
    });
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// ─────────────────────────── codex reply drafts (network on, same login family-chat uses)
const CODEX_BIN = process.env.CODEX_BIN || "codex";
const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.5";
const CODEX_HOME = process.env.CODEX_HOME || "/opt/docsai/.codex";
const CODEX_HOME_DIR = process.env.CODEX_HOME_DIR || "/opt/docsai";
const DRAFT_TIMEOUT_MS = Number(process.env.DRAFT_TIMEOUT_MS || 90000);
const DRAFT_KILL_GRACE_MS = 4000;
const MAX_CONCURRENT_DRAFTS = Number(process.env.MAX_CONCURRENT_DRAFTS || 2);
const codexScratch = path.join(__dirname, ".codex-scratch");
const replyPromptFile = path.join(engagementRoot, "reply_prompt.md");
const trackPromptFile = path.join(engagementRoot, "track_prompt.md");
const CLASSIFY_TIMEOUT_MS = Number(process.env.CLASSIFY_TIMEOUT_MS || 120000);
const codexPath = (process.env.PATH || "") + ":/usr/local/bin:/usr/bin:/bin:/opt/docsai/.local/bin";
try { fs.mkdirSync(codexScratch, { recursive: true }); } catch {}

function tweetIdFromUrl(url) {
  const m = /status\/(\d+)/.exec(String(url || ""));
  if (m) return m[1];
  return String(url || "").replace(/[^a-zA-Z0-9]/g, "").slice(-32);
}

function engagementDir(date, target) {
  return path.join(engagementRoot, date, target.toLowerCase());
}

function readDrafts(date, target) {
  return readJsonl(path.join(engagementDir(date, target), "drafts.jsonl"));
}

function draftsMap(date, target) {
  const map = {};
  for (const row of readDrafts(date, target)) {
    if (row && row.tweet_id) map[row.tweet_id] = row; // last write wins
  }
  return map;
}

function appendDraft(date, target, record) {
  const dir = engagementDir(date, target);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "drafts.jsonl"), JSON.stringify(record) + "\n");
}

function findQueueRow(date, target, tweetId) {
  const rows = readJsonl(path.join(engagementDir(date, target), "queue.jsonl"));
  return rows.find((row) => tweetIdFromUrl(row.tweet_url) === tweetId) || null;
}

function buildDraftPrompt(row) {
  let rules = "";
  try { rules = fs.readFileSync(replyPromptFile, "utf8").trim(); } catch {}
  const metrics = [];
  if (row.views) metrics.push(row.views + " views");
  if (row.engagement_rate) metrics.push(row.engagement_rate + "% engagement rate");
  if (row.likes) metrics.push(row.likes + " likes");
  if (row.replies) metrics.push(row.replies + " replies");
  if (row.followers) metrics.push(row.followers + " followers");
  const hasCJK = /[㐀-䶿一-鿿]/.test(row.text || "");
  const replyLang = (row.lang === "zh" || hasCJK) ? "Chinese" : (row.lang === "en" ? "English" : "");
  const lines = [
    rules,
    "",
    "## This tweet",
    "",
    replyLang ? "Reply language: " + replyLang + " — the source tweet is " + replyLang + ", so write the reply in " + replyLang + "." : "",
    "Author: @" + (row.handle || "") + (row.name ? " (" + row.name + ")" : ""),
    metrics.length ? "Metrics: " + metrics.join(", ") : "",
    row.reply_angle ? "Suggested angle: " + row.reply_angle : "",
    row.data_hook ? "Graph context: " + row.data_hook : "",
    "",
    "Tweet text:",
    row.text || "(no text)",
    "",
    "Write the reply now. Reply text only.",
  ].filter((line) => line !== "");
  return lines.join("\n");
}

let draftCounter = 0;
function runCodex(prompt, useWeb, timeoutMs) {
  return new Promise((resolve) => {
    const ansFile = path.join(codexScratch, ".codex-" + Date.now().toString(36) + "-" + (draftCounter++) + ".txt");
    const args = [
      "exec",
      "-m",
      CODEX_MODEL,
      "--skip-git-repo-check",
      "--sandbox",
      "workspace-write",
    ];
    if (useWeb) {
      args.push("-c", "sandbox_workspace_write.network_access=true", "-c", "tools.web_search=true");
    }
    args.push("-o", ansFile, "-C", codexScratch);
    const child = spawn(CODEX_BIN, args, {
      cwd: codexScratch,
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: codexPath, HOME: CODEX_HOME_DIR, CODEX_HOME },
    });
    child.stdin.on("error", () => {});
    child.stdin.write(prompt);
    child.stdin.end();
    let timedOut = false;
    let tail = "";
    const swallow = (chunk) => { tail = (tail + chunk.toString()).slice(-2000); };
    child.stdout.on("data", swallow);
    child.stderr.on("data", swallow);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, DRAFT_KILL_GRACE_MS).unref();
    }, timeoutMs || DRAFT_TIMEOUT_MS);
    timer.unref();
    child.on("error", () => { clearTimeout(timer); resolve({ ok: false, reason: "spawn" }); });
    child.on("close", () => {
      clearTimeout(timer);
      let answer = "";
      try { answer = fs.readFileSync(ansFile, "utf8").trim(); } catch {}
      try { fs.unlinkSync(ansFile); } catch {}
      if (timedOut) return resolve({ ok: false, reason: "timeout" });
      if (!answer) return resolve({ ok: false, reason: "empty" });
      resolve({ ok: true, answer });
    });
  });
}

let activeDrafts = 0;
const draftWaiters = [];
function acquireDraftSlot() {
  if (activeDrafts < MAX_CONCURRENT_DRAFTS) { activeDrafts++; return Promise.resolve(); }
  return new Promise((res) => draftWaiters.push(res));
}
function releaseDraftSlot() {
  activeDrafts = Math.max(0, activeDrafts - 1);
  const next = draftWaiters.shift();
  if (next) { activeDrafts++; next(); }
}

const draftInFlight = new Map();
function draftReply(date, target, tweetId, force) {
  const key = date + "|" + target + "|" + tweetId;
  if (!force) {
    const cached = draftsMap(date, target)[tweetId];
    if (cached) return Promise.resolve({ ok: true, draft: cached.draft, cached: true });
  }
  if (draftInFlight.has(key)) return draftInFlight.get(key);
  const job = (async () => {
    const row = findQueueRow(date, target, tweetId);
    if (!row) return { ok: false, reason: "not_found" };
    await acquireDraftSlot();
    try {
      const result = await runCodex(buildDraftPrompt(row), true);
      if (!result.ok) return { ok: false, reason: result.reason };
      appendDraft(date, target, { tweet_id: tweetId, draft: result.answer, created_at: new Date().toISOString(), model: CODEX_MODEL });
      return { ok: true, draft: result.answer, cached: false };
    } finally {
      releaseDraftSlot();
    }
  })();
  draftInFlight.set(key, job);
  return job.finally(() => draftInFlight.delete(key));
}

// ─────────────────────────── AI track filter (one batched codex call, no web)
function trackMap(date, target) {
  const map = {};
  for (const row of readJsonl(path.join(engagementDir(date, target), "track.jsonl"))) {
    if (row && row.tweet_id) map[row.tweet_id] = row;
  }
  return map;
}

function writeTrack(date, target, records) {
  const dir = engagementDir(date, target);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "track.jsonl"), records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

function buildClassifyPrompt(items) {
  let rules = "";
  try { rules = fs.readFileSync(trackPromptFile, "utf8").trim(); } catch {}
  const list = items.map((it, i) => (i + 1) + ". @" + it.handle + ": " + String(it.text || "(no text)").replace(/\s+/g, " ").slice(0, 280)).join("\n");
  return rules + "\n\n## Tweets\n\n" + list + "\n\nReturn the JSON array now.";
}

function parseClassify(answer, items) {
  const txt = String(answer || "");
  const a = txt.indexOf("[");
  const b = txt.lastIndexOf("]");
  if (a === -1 || b === -1 || b < a) return null;
  let arr;
  try { arr = JSON.parse(txt.slice(a, b + 1)); } catch { return null; }
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const entry of arr) {
    const idx = Number(entry && entry.i);
    if (!idx || idx < 1 || idx > items.length) continue;
    const it = items[idx - 1];
    out.push({
      tweet_id: it.tweet_id,
      on_track: !!(entry.on_track),
      score: Math.max(0, Math.min(100, Math.round(Number(entry.score) || 0))),
      reason: String(entry.reason || "").slice(0, 80),
    });
  }
  return out.length ? out : null;
}

const classifyInFlight = new Map();
function classifyQueue(date, target) {
  const key = date + "|" + target;
  if (classifyInFlight.has(key)) return classifyInFlight.get(key);
  const job = (async () => {
    const rows = readJsonl(path.join(engagementDir(date, target), "queue.jsonl"));
    const items = rows
      .map((r) => ({ tweet_id: tweetIdFromUrl(r.tweet_url), text: r.text || "", handle: r.handle || "" }))
      .filter((x) => x.tweet_id);
    if (!items.length) return { ok: false, reason: "empty_queue" };
    await acquireDraftSlot();
    let result;
    try {
      result = await runCodex(buildClassifyPrompt(items), false, CLASSIFY_TIMEOUT_MS);
    } finally {
      releaseDraftSlot();
    }
    if (!result.ok) return { ok: false, reason: result.reason };
    const parsed = parseClassify(result.answer, items);
    if (!parsed) return { ok: false, reason: "parse" };
    const stamped = parsed.map((p) => ({ ...p, classified_at: new Date().toISOString() }));
    writeTrack(date, target, stamped);
    const map = {};
    for (const r of stamped) map[r.tweet_id] = r;
    return { ok: true, track: map };
  })();
  classifyInFlight.set(key, job);
  return job.finally(() => classifyInFlight.delete(key));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>X Research Ops</title>
  <style>
    :root {
      color: #1d1d1f;
      background: #f5f5f7;
      font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-size: 17px; line-height: 1.2857; letter-spacing: 0; }
    button, select { font: inherit; }
    a { color: #0071e3; text-decoration: none; }
    a:hover { color: #0066cc; text-decoration: underline; }
    .shell { max-width: 1440px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 40px; line-height: 1.1; font-weight: 700; letter-spacing: 0; }
    .sub { margin-top: 8px; color: #6e6e73; font-size: 17px; max-width: 734px; }
    .topActions { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .tab {
      display: inline-flex;
      align-items: center;
      border: 1px solid #d2d2d7;
      background: #fff;
      color: #1d1d1f;
      border-radius: 8px;
      cursor: pointer;
      height: 38px;
      padding: 0 14px;
      text-decoration: none;
    }
    .tab:hover { text-decoration: none; }
    .tab.active { background: #1d1d1f; border-color: #1d1d1f; color: #fff; }
    .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    select {
      height: 38px;
      border: 1px solid #d2d2d7;
      background: #fff;
      color: #1d1d1f;
      border-radius: 8px;
      padding: 0 12px;
    }
    .refreshButton {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      border: 1px solid #0071e3;
      background: #0071e3;
      color: #fff;
      border-radius: 8px;
      padding: 0 14px;
      cursor: pointer;
    }
    .refreshButton:disabled { cursor: wait; opacity: .72; }
    .spinner {
      display: none;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,.48);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    .refreshButton.loading .spinner { display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .refreshStatus { color: #6e6e73; font-size: 13px; }
    .hidden { display: none; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .metric { background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; padding: 14px 16px; }
    .metric .label { color: #86868b; font-size: 12px; text-transform: uppercase; letter-spacing: .012em; }
    .metric .value { margin-top: 4px; font-size: 24px; line-height: 1.1666; font-weight: 700; }
    .tableWrap { overflow-x: auto; border: 1px solid #e8e8ed; border-radius: 8px; background: #fff; }
    table { width: 100%; min-width: 1180px; border-collapse: collapse; }
    th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid #e8e8ed; vertical-align: top; }
    th { color: #6e6e73; font-size: 12px; text-transform: uppercase; letter-spacing: .012em; background: #fbfbfd; white-space: nowrap; }
    .sortHead {
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      letter-spacing: inherit;
      padding: 0;
      text-align: left;
      text-transform: inherit;
    }
    .sortHead.active { color: #1d1d1f; }
    .sortHead.active::after { content: " desc"; color: #86868b; text-transform: none; }
    tr:last-child td { border-bottom: 0; }
    .rank { color: #86868b; width: 52px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .articleCell { min-width: 360px; max-width: 560px; }
    .personCell { min-width: 240px; }
    .title { font-weight: 600; line-height: 1.2105; }
    .preview { color: #6e6e73; font-size: 13px; margin-top: 4px; max-width: 560px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .byline { margin-top: 7px; color: #6e6e73; font-size: 14px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .metricNum { font-size: 18px; font-weight: 700; color: #1d1d1f; }
    .muted { color: #86868b; font-size: 13px; }
    .empty { background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; padding: 24px; color: #6e6e73; }
    .replyBtn {
      height: 34px;
      border: 1px solid #0071e3;
      background: #0071e3;
      color: #fff;
      border-radius: 8px;
      padding: 0 16px;
      cursor: pointer;
      white-space: nowrap;
      font-weight: 500;
    }
    .replyBtn:hover { background: #0066cc; }
    .replyBtn:disabled { opacity: .6; cursor: wait; }
    .replyBtn.flash { background: #1f8b4c; border-color: #1f8b4c; }
    .draftRow > td { background: #fbfbfd; }
    .draftBox { display: flex; flex-direction: column; gap: 10px; max-width: 680px; }
    textarea.draftText {
      width: 100%;
      min-height: 46px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      padding: 10px 12px;
      font: inherit;
      line-height: 1.4;
      resize: vertical;
      color: #1d1d1f;
    }
    textarea.draftText:focus { outline: none; border-color: #0071e3; box-shadow: 0 0 0 3px rgba(0,113,227,.18); }
    .draftMeta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .charCount { font-variant-numeric: tabular-nums; color: #86868b; font-size: 13px; }
    .charCount.over { color: #e30000; font-weight: 600; }
    .draftAction {
      height: 32px;
      border: 1px solid #d2d2d7;
      background: #fff;
      color: #1d1d1f;
      border-radius: 8px;
      padding: 0 14px;
      cursor: pointer;
    }
    .draftAction:hover { background: #f5f5f7; }
    .draftStatus { font-size: 13px; color: #6e6e73; }
    .trackChip { display: inline-block; margin-top: 5px; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; white-space: nowrap; }
    .trackChip.trackOn { background: #e6f4ea; color: #1f8b4c; }
    .trackChip.trackOff { background: #f0f0f2; color: #86868b; }
    @media (max-width: 760px) {
      header, .topActions { align-items: stretch; flex-direction: column; }
      .summary { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1 id="pageTitle">X Article Radar</h1>
        <div class="sub" id="pageSub">Native X Articles grouped by date and niche. Click the title to open the Article on X.</div>
      </div>
    </header>
    <section class="topActions">
      <div class="tabs">
        <a class="tab active" id="articleTab" href="/">Article Radar</a>
        <a class="tab" id="engagementTab" href="/engagement">Engagement Queue</a>
      </div>
      <div class="controls" id="articleControls">
        <select id="dateSelect" aria-label="Date"></select>
        <select id="nicheSelect" aria-label="Niche"></select>
        <select id="rankSelect" aria-label="Rank articles by">
          <option value="lift">Rank by: Vs creator avg</option>
          <option value="followers">Rank by: Views / 1k followers</option>
          <option value="engRate">Rank by: Engagement rate</option>
          <option value="views">Rank by: Article views</option>
          <option value="score">Rank by: Raw score</option>
        </select>
      </div>
      <div class="controls hidden" id="engagementControls">
        <select id="engDateSelect" aria-label="Engagement date"></select>
        <select id="targetSelect" aria-label="Target account"></select>
        <select id="engRankSelect" aria-label="Rank engagement by">
          <option value="score">Rank by: Score</option>
          <option value="engRate">Rank by: Engagement rate</option>
          <option value="followers">Rank by: Followers</option>
          <option value="botRisk">Rank by: Lowest bot risk</option>
        </select>
        <button class="refreshButton" id="refreshEngagementButton" type="button"><span class="spinner"></span><span id="refreshEngagementText">Refresh today</span></button>
        <span class="refreshStatus" id="refreshStatus"></span>
        <button class="refreshButton" id="aiFilterButton" type="button"><span class="spinner"></span><span id="aiFilterText">AI filter</span></button>
        <span class="refreshStatus" id="aiFilterStatus"></span>
        <button class="refreshButton" id="draftAllButton" type="button"><span class="spinner"></span><span id="draftAllText">Draft all</span></button>
        <span class="refreshStatus" id="draftAllStatus"></span>
      </div>
    </section>
    <section class="summary">
      <div class="metric"><div class="label" id="metricOneLabel">Articles</div><div class="value" id="metricOne">0</div></div>
      <div class="metric"><div class="label" id="metricTwoLabel">Top outlier</div><div class="value" id="metricTwo">0x</div></div>
      <div class="metric"><div class="label" id="metricThreeLabel">Niche</div><div class="value" id="metricThree">-</div></div>
    </section>
    <section id="content"></section>
  </main>
  <script>
    const defaultTargets = ["100xgemfinder", "chinadegen"];
    const initialParams = new URLSearchParams(window.location.search);
    const state = {
      mode: window.location.pathname.startsWith("/engagement") ? "engagement" : "articles",
      index: [],
      date: "",
      niche: "",
      articleRankBy: "lift",
      articles: [],
      engagementIndex: [],
      engagementDate: "",
      target: normalizeTarget(initialParams.get("target")) || "",
      engagementRankBy: "score",
      queue: [],
      drafts: {},
      track: {},
      trackOnly: false,
    };
    const fmt = new Intl.NumberFormat();

    async function boot() {
      await Promise.all([loadArticleIndex(), loadEngagementIndex()]);
      bindRefresh();
      renderMode();
    }

    async function loadArticleIndex() {
      state.index = await fetch("/api/index").then((r) => r.json());
      const firstDate = state.index[0];
      state.date = firstDate?.date || "";
      state.niche = firstDate?.niches?.[0]?.niche || "";
      renderArticleControls();
      await loadArticles();
    }

    async function loadEngagementIndex() {
      state.engagementIndex = await fetch("/api/engagement/index").then((r) => r.json());
      const firstDate = state.engagementIndex[0];
      state.engagementDate = state.engagementDate || firstDate?.date || "";
      const dateEntry = state.engagementIndex.find((d) => d.date === state.engagementDate) || firstDate;
      const availableTargets = [...defaultTargets, ...(dateEntry?.targets || []).map((t) => t.target)];
      if (!state.target || !availableTargets.includes(state.target)) {
        state.target = dateEntry?.targets?.[0]?.target || defaultTargets[0] || "";
      }
      renderEngagementControls();
      await loadEngagementQueue();
    }

    function renderMode() {
      const isEngagement = state.mode === "engagement";
      document.getElementById("articleTab").classList.toggle("active", !isEngagement);
      document.getElementById("engagementTab").classList.toggle("active", isEngagement);
      document.getElementById("articleControls").classList.toggle("hidden", isEngagement);
      document.getElementById("engagementControls").classList.toggle("hidden", !isEngagement);
      document.getElementById("pageTitle").textContent = isEngagement ? "Engagement Queue" : "X Article Radar";
      document.getElementById("pageSub").textContent = isEngagement
        ? "Recent data-led replies from the selected target graph."
        : "Native X Articles grouped by date and niche. Click the title to open the Article on X.";
      if (isEngagement) renderEngagementTable(sortedQueue(state.queue));
      else renderArticleTable(sortedArticles(state.articles));
    }

    function renderArticleControls() {
      const dateSelect = document.getElementById("dateSelect");
      dateSelect.innerHTML = state.index.map((d) => '<option value="' + d.date + '">' + d.date + '</option>').join("");
      dateSelect.value = state.date;
      const dateEntry = state.index.find((d) => d.date === state.date);
      const nicheSelect = document.getElementById("nicheSelect");
      nicheSelect.innerHTML = (dateEntry?.niches || []).map((n) => '<option value="' + n.niche + '">' + n.niche + ' (' + n.count + ')</option>').join("");
      nicheSelect.value = state.niche;
      dateSelect.onchange = async () => {
        state.date = dateSelect.value;
        const next = state.index.find((d) => d.date === state.date);
        state.niche = next?.niches?.[0]?.niche || "";
        renderArticleControls();
        await loadArticles();
      };
      nicheSelect.onchange = async () => {
        state.niche = nicheSelect.value;
        await loadArticles();
      };
      const rankSelect = document.getElementById("rankSelect");
      rankSelect.value = state.articleRankBy;
      rankSelect.onchange = () => {
        state.articleRankBy = rankSelect.value;
        renderArticleTable(sortedArticles(state.articles));
      };
    }

    function renderEngagementControls() {
      const dateSelect = document.getElementById("engDateSelect");
      dateSelect.innerHTML = state.engagementIndex.map((d) => '<option value="' + d.date + '">' + d.date + '</option>').join("");
      dateSelect.value = state.engagementDate;
      const dateEntry = state.engagementIndex.find((d) => d.date === state.engagementDate);
      const targetSelect = document.getElementById("targetSelect");
      const targetMap = new Map(defaultTargets.map((target) => [target, { target, count: 0 }]));
      for (const target of (dateEntry?.targets || [])) targetMap.set(target.target, target);
      const targets = [...targetMap.values()];
      targetSelect.innerHTML = targets.map((t) => '<option value="' + t.target + '">@' + t.target + ' (' + t.count + ')</option>').join("");
      targetSelect.value = state.target;
      dateSelect.onchange = async () => {
        state.engagementDate = dateSelect.value;
        const next = state.engagementIndex.find((d) => d.date === state.engagementDate);
        const nextTargets = [...defaultTargets, ...(next?.targets || []).map((t) => t.target)];
        if (!nextTargets.includes(state.target)) state.target = next?.targets?.[0]?.target || defaultTargets[0] || "";
        renderEngagementControls();
        await loadEngagementQueue();
      };
      targetSelect.onchange = async () => {
        state.target = targetSelect.value;
        updateEngagementUrl();
        await loadEngagementQueue();
      };
      const rankSelect = document.getElementById("engRankSelect");
      rankSelect.value = state.engagementRankBy;
      rankSelect.onchange = () => {
        state.engagementRankBy = rankSelect.value;
        renderEngagementTable(sortedQueue(state.queue));
      };
    }

    function bindRefresh() {
      const button = document.getElementById("refreshEngagementButton");
      const text = document.getElementById("refreshEngagementText");
      const status = document.getElementById("refreshStatus");
      button.onclick = async () => {
        button.disabled = true;
        button.classList.add("loading");
        text.textContent = "Refreshing";
        status.textContent = "Checking today's queue for @" + state.target;
        try {
          const result = await fetch("/api/engagement/refresh?target=" + encodeURIComponent(state.target), { method: "POST" }).then((r) => r.json());
          status.textContent = result.ok ? "Done" : "Refresh failed";
          await loadEngagementIndex();
          state.mode = "engagement";
          renderMode();
        } catch (error) {
          status.textContent = "Refresh failed";
        } finally {
          button.disabled = false;
          button.classList.remove("loading");
          text.textContent = "Refresh today";
        }
      };
      const draftAllButton = document.getElementById("draftAllButton");
      if (draftAllButton) draftAllButton.onclick = () => draftAll();
      const aiFilterButton = document.getElementById("aiFilterButton");
      if (aiFilterButton) aiFilterButton.onclick = () => aiFilter();
    }

    async function loadArticles() {
      if (!state.date || !state.niche) {
        if (state.mode === "articles") document.getElementById("content").innerHTML = '<div class="empty">No article files found.</div>';
        return;
      }
      const url = "/api/articles?date=" + encodeURIComponent(state.date) + "&niche=" + encodeURIComponent(state.niche);
      const data = await fetch(url).then((r) => r.json());
      state.articles = data.articles || [];
      if (state.mode === "articles") renderArticleTable(sortedArticles(state.articles));
    }

    async function loadEngagementQueue() {
      if (!state.engagementDate || !state.target) {
        if (state.mode === "engagement") document.getElementById("content").innerHTML = '<div class="empty">No engagement queue found.</div>';
        return;
      }
      const url = "/api/engagement/queue?date=" + encodeURIComponent(state.engagementDate) + "&target=" + encodeURIComponent(state.target);
      const data = await fetch(url).then((r) => r.json());
      state.queue = data.queue || [];
      const qs = "date=" + encodeURIComponent(state.engagementDate) + "&target=" + encodeURIComponent(state.target);
      state.drafts = await fetch("/api/engagement/drafts?" + qs).then((r) => r.json()).catch(() => ({}));
      state.track = await fetch("/api/engagement/track?" + qs).then((r) => r.json()).catch(() => ({}));
      state.trackOnly = false;
      if (state.mode === "engagement") { renderEngagementTable(sortedQueue(state.queue)); updateAiFilterButton(); }
    }

    function sortedArticles(articles) {
      const rankers = {
        lift: (a) => Number(a.views_vs_author_avg || 0),
        followers: (a) => Number(a.views_per_1k_followers || 0),
        engRate: (a) => articleEngagementRate(a),
        views: (a) => Number(a.views || 0),
        score: (a) => Number(a.score || 0),
      };
      const ranker = rankers[state.articleRankBy] || rankers.lift;
      return [...articles].sort((a, b) => {
        const primary = ranker(b) - ranker(a);
        if (primary) return primary;
        return Number(b.score || 0) - Number(a.score || 0);
      });
    }

    function sortedQueue(queue) {
      const rankers = {
        score: (a) => Number(a.rank_score || 0),
        engRate: (a) => Number(a.engagement_rate || 0),
        followers: (a) => Number(a.followers || 0),
        botRisk: (a) => -Number(a.bot_risk || 0),
      };
      const ranker = rankers[state.engagementRankBy] || rankers.score;
      return [...queue].sort((a, b) => {
        const primary = ranker(b) - ranker(a);
        if (primary) return primary;
        return Number(b.rank_score || 0) - Number(a.rank_score || 0);
      });
    }

    function normalizeTarget(value) {
      const target = String(value || "").replace(/^@/, "").toLowerCase();
      return /^[a-zA-Z0-9_]+$/.test(target) ? target : "";
    }

    function updateEngagementUrl() {
      if (state.mode !== "engagement" || !state.target) return;
      const next = "/engagement?target=" + encodeURIComponent(state.target);
      window.history.replaceState({}, "", next);
    }

    function renderArticleTable(articles) {
      setMetrics("Articles", fmt.format(articles.length), "Top outlier", formatLift(articles[0]?.views_vs_author_avg || 0), "Niche", state.niche || "-");
      const content = document.getElementById("content");
      if (!articles.length) {
        content.innerHTML = '<div class="empty">No articles for this date and niche.</div>';
        return;
      }
      content.innerHTML = '<div class="tableWrap"><table><thead><tr>' +
        '<th>Rank</th><th>Article tweet</th><th>Author</th>' +
        articleSortHeader("lift", "Vs creator avg") +
        articleSortHeader("followers", "Views / 1k followers") +
        articleSortHeader("views", "Article views") +
        articleSortHeader("engRate", "Eng rate") +
        articleSortHeader("score", "Raw score") +
        '</tr></thead><tbody>' +
        articles.map((a, i) => '<tr>' +
          '<td class="rank">#' + (i + 1) + '</td>' +
          '<td class="articleCell"><a class="title" href="' + escapeHtml(a.article_url || a.tweet_url) + '" target="_blank" rel="noreferrer">' + escapeHtml(a.title || "Untitled") + '</a><div class="preview">' + escapeHtml(a.preview_text || "") + '</div><div class="byline"><a href="' + escapeHtml(a.tweet_url || a.article_url) + '" target="_blank" rel="noreferrer">tweet</a></div></td>' +
          '<td><a href="https://x.com/' + escapeHtml(a.author) + '" target="_blank" rel="noreferrer">@' + escapeHtml(a.author) + '</a><div class="muted">' + fmt.format(a.author_followers || 0) + ' followers</div></td>' +
          '<td class="num"><span class="metricNum">' + formatLift(a.views_vs_author_avg || 0) + '</span></td>' +
          '<td class="num"><span class="metricNum">' + fmt.format(Math.round(a.views_per_1k_followers || 0)) + '</span></td>' +
          '<td class="num">' + fmt.format(a.views || 0) + '</td>' +
          '<td class="num"><span class="metricNum">' + formatPercent(articleEngagementRate(a)) + '</span></td>' +
          '<td class="num">' + fmt.format(Math.round(a.score || 0)) + '</td>' +
        '</tr>').join("") + '</tbody></table></div>';
      content.querySelectorAll("[data-article-rank]").forEach((button) => {
        button.addEventListener("click", () => {
          state.articleRankBy = button.getAttribute("data-article-rank");
          document.getElementById("rankSelect").value = state.articleRankBy;
          renderArticleTable(sortedArticles(state.articles));
        });
      });
    }

    function renderEngagementTable(queue) {
      const top = queue[0] || {};
      const aroundCount = queue.filter((row) => row.source === "around").length;
      setMetrics("Recent replies", fmt.format(queue.length), "Around graph", fmt.format(aroundCount), "Seed", state.target ? "@" + state.target : "-");
      const content = document.getElementById("content");
      if (!queue.length) {
        content.innerHTML = '<div class="empty">No engagement queue for this date and target.</div>';
        return;
      }
      const visible = state.trackOnly
        ? queue.filter((row) => { const t = state.track[tweetIdFromUrl(row.tweet_url)]; return t && t.on_track; })
        : queue;
      if (!visible.length) {
        content.innerHTML = '<div class="empty">No on-track candidates here. Click “Show all” to see every row.</div>';
        return;
      }
      content.innerHTML = '<div class="tableWrap"><table><thead><tr>' +
        '<th>Rank</th><th>Candidate</th><th>Source tweet</th>' +
        engagementSortHeader("score", "Score") +
        engagementSortHeader("engRate", "Eng rate") +
        engagementSortHeader("followers", "Followers") +
        engagementSortHeader("botRisk", "Bot risk") +
        '<th>Target post</th>' +
        '<th>Reply</th>' +
        '</tr></thead><tbody>' +
        visible.map((row, i) => { const tweetId = tweetIdFromUrl(row.tweet_url); const hasDraft = !!state.drafts[tweetId]; return '<tr data-tweet-id="' + escapeHtml(tweetId) + '">' +
          '<td class="rank">#' + (i + 1) + '</td>' +
          '<td class="personCell"><a class="title" href="https://x.com/' + escapeHtml(row.handle) + '" target="_blank" rel="noreferrer">@' + escapeHtml(row.handle) + '</a><div class="muted">' + escapeHtml(row.name || "") + '</div>' + trackBadge(tweetId) + '</td>' +
          '<td class="articleCell"><a class="title" href="' + escapeHtml(row.tweet_url || "") + '" target="_blank" rel="noreferrer">open tweet</a><div class="preview">' + escapeHtml(row.text || "") + '</div><div class="byline">' + escapeHtml(relativeAge(row.created_at)) + ' | ' + escapeHtml(sourceLabel(row)) + '</div></td>' +
          '<td class="num"><span class="metricNum">' + fmt.format(Math.round(row.rank_score || 0)) + '</span></td>' +
          '<td class="num"><span class="metricNum">' + formatPercent(row.engagement_rate || 0) + '</span><div class="muted">' + fmt.format(row.engagement || 0) + ' eng</div></td>' +
          '<td class="num">' + fmt.format(row.followers || 0) + '</td>' +
          '<td class="num">' + fmt.format(row.bot_risk || 0) + '<div class="muted">' + escapeHtml((row.bot_risk_reasons || []).join(" | ") || "clean") + '</div></td>' +
          '<td><a href="' + escapeHtml(row.target_tweet_url || "") + '" target="_blank" rel="noreferrer">target</a><div class="muted">' + escapeHtml(row.around_reply_to ? "replying to @" + row.around_reply_to : row.source || "") + '</div></td>' +
          '<td>' + (tweetId ? '<button class="replyBtn" data-reply-id="' + escapeHtml(tweetId) + '">' + (hasDraft ? 'Copy &amp; open' : 'Draft') + '</button>' : '<span class="muted">-</span>') + '</td>' +
        '</tr>' +
        (tweetId ? '<tr class="draftRow' + (hasDraft ? '' : ' hidden') + '" data-draft-row="' + escapeHtml(tweetId) + '"><td colspan="9">' + (hasDraft ? draftBoxHtml(state.drafts[tweetId].draft, "saved draft") : '') + '</td></tr>' : ''); }).join("") + '</tbody></table></div>';
      content.querySelectorAll("[data-engagement-rank]").forEach((button) => {
        button.addEventListener("click", () => {
          state.engagementRankBy = button.getAttribute("data-engagement-rank");
          document.getElementById("engRankSelect").value = state.engagementRankBy;
          renderEngagementTable(sortedQueue(state.queue));
        });
      });
      content.querySelectorAll(".replyBtn").forEach((button) => {
        button.addEventListener("click", () => onReplyClick(button.getAttribute("data-reply-id")));
      });
      visible.forEach((row) => {
        const id = tweetIdFromUrl(row.tweet_url);
        if (id && state.drafts[id]) {
          const cell = draftRowCell(id).cell;
          if (cell && cell.querySelector(".draftText")) wireDraftBox(cell, id);
        }
      });
    }

    function setMetrics(labelOne, valueOne, labelTwo, valueTwo, labelThree, valueThree) {
      document.getElementById("metricOneLabel").textContent = labelOne;
      document.getElementById("metricOne").textContent = valueOne;
      document.getElementById("metricTwoLabel").textContent = labelTwo;
      document.getElementById("metricTwo").textContent = valueTwo;
      document.getElementById("metricThreeLabel").textContent = labelThree;
      document.getElementById("metricThree").textContent = valueThree;
    }

    function sourceLabel(row) {
      if (row.source === "around" && row.seed_handle) return "around @" + row.seed_handle;
      return row.source || "";
    }

    function relativeAge(value) {
      const ts = Date.parse(value || "");
      if (!Number.isFinite(ts)) return "-";
      const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
      if (minutes < 60) return minutes + "m ago";
      const hours = Math.round(minutes / 60);
      if (hours < 48) return hours + "h ago";
      return Math.round(hours / 24) + "d ago";
    }

    function articleSortHeader(rankBy, label) {
      const active = state.articleRankBy === rankBy ? " active" : "";
      return '<th><button class="sortHead' + active + '" data-article-rank="' + rankBy + '">' + escapeHtml(label) + '</button></th>';
    }

    function engagementSortHeader(rankBy, label) {
      const active = state.engagementRankBy === rankBy ? " active" : "";
      return '<th><button class="sortHead' + active + '" data-engagement-rank="' + rankBy + '">' + escapeHtml(label) + '</button></th>';
    }

    function formatLift(value) {
      const n = Number(value || 0);
      return n ? n.toFixed(n >= 10 ? 1 : 2) + 'x' : '-';
    }

    function articleEngagementRate(article) {
      const views = Number(article.views || 0);
      if (!views) return 0;
      return Number(article.engagement || 0) / views * 100;
    }

    function formatPercent(value) {
      const n = Number(value || 0);
      return n ? n.toFixed(n >= 10 ? 1 : 2) + '%' : '-';
    }

    function tweetIdFromUrl(url) {
      const m = /status\/(\d+)/.exec(String(url || ""));
      if (m) return m[1];
      return String(url || "").replace(/[^a-zA-Z0-9]/g, "").slice(-32);
    }

    function queueRowByTweetId(tweetId) {
      return state.queue.find((row) => tweetIdFromUrl(row.tweet_url) === tweetId) || null;
    }

    function trackBadge(tweetId) {
      const t = state.track[tweetId];
      if (!t) return "";
      const cls = t.on_track ? "trackOn" : "trackOff";
      const label = (t.on_track ? "✓ on-track " : "✗ off ") + (t.score || 0);
      return '<div class="trackChip ' + cls + '" title="' + escapeHtml(t.reason || "") + '">' + label + '</div>';
    }

    function updateAiFilterButton() {
      const text = document.getElementById("aiFilterText");
      const status = document.getElementById("aiFilterStatus");
      if (!text) return;
      const ids = Object.keys(state.track || {});
      if (!ids.length) { text.textContent = "AI filter"; if (status) status.textContent = ""; return; }
      const on = ids.filter((id) => state.track[id].on_track).length;
      text.textContent = state.trackOnly ? "Show all" : "AI filter";
      if (status) status.textContent = on + "/" + ids.length + " on-track";
    }

    async function aiFilter() {
      const button = document.getElementById("aiFilterButton");
      const text = document.getElementById("aiFilterText");
      const status = document.getElementById("aiFilterStatus");
      if (Object.keys(state.track || {}).length > 0) {
        state.trackOnly = !state.trackOnly;
        renderEngagementTable(sortedQueue(state.queue));
        updateAiFilterButton();
        return;
      }
      button.disabled = true; button.classList.add("loading"); text.textContent = "Filtering";
      status.textContent = "codex is reading the queue (~20–40s)";
      try {
        const res = await fetch("/api/engagement/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: state.engagementDate, target: state.target }),
        }).then((r) => r.json());
        button.disabled = false; button.classList.remove("loading");
        if (res && res.ok) {
          state.track = res.track;
          state.trackOnly = true;
          renderEngagementTable(sortedQueue(state.queue));
          updateAiFilterButton();
        } else {
          text.textContent = "AI filter";
          status.textContent = "filter failed (" + ((res && res.reason) || "error") + ")";
        }
      } catch (e) {
        button.disabled = false; button.classList.remove("loading");
        text.textContent = "AI filter";
        status.textContent = "filter failed";
      }
    }

    async function draftAll() {
      const button = document.getElementById("draftAllButton");
      const text = document.getElementById("draftAllText");
      const status = document.getElementById("draftAllStatus");
      const ids = sortedQueue(state.queue)
        .filter((row) => !state.trackOnly || (state.track[tweetIdFromUrl(row.tweet_url)] || {}).on_track)
        .map((row) => tweetIdFromUrl(row.tweet_url)).filter(Boolean);
      const todo = ids.filter((id) => !state.drafts[id]);
      if (!todo.length) { status.textContent = "all rows already drafted"; return; }
      button.disabled = true; button.classList.add("loading"); text.textContent = "Drafting";
      let done = 0;
      const total = todo.length;
      const shared = todo.slice();
      const worker = async () => {
        while (shared.length) {
          const id = shared.shift();
          await generateDraft(id, false);
          done += 1;
          status.textContent = "drafted " + done + "/" + total;
        }
      };
      await Promise.all([worker(), worker()]); // matches server concurrency cap (2)
      button.disabled = false; button.classList.remove("loading"); text.textContent = "Draft all";
      status.textContent = "done — " + total + " drafted";
    }

    function autoGrow(ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    }

    function draftBoxHtml(text, statusText) {
      return '<div class="draftBox">' +
        '<textarea class="draftText">' + escapeHtml(text || "") + '</textarea>' +
        '<div class="draftMeta">' +
          '<span class="charCount"></span>' +
          '<button class="draftAction draftRegen">Regenerate</button>' +
          '<span class="draftStatus muted">' + escapeHtml(statusText || "") + '</span>' +
        '</div>' +
      '</div>';
    }

    function draftRowCell(tweetId) {
      const rowEl = document.querySelector('[data-draft-row="' + tweetId + '"]');
      return { rowEl: rowEl, cell: rowEl ? rowEl.firstElementChild : null };
    }

    function wireDraftBox(cell, tweetId) {
      const ta = cell.querySelector(".draftText");
      const count = cell.querySelector(".charCount");
      if (!ta) return;
      const update = () => {
        const n = ta.value.length;
        count.textContent = n + "/280";
        count.classList.toggle("over", n > 280);
        autoGrow(ta);
        if (state.drafts[tweetId]) state.drafts[tweetId].draft = ta.value;
      };
      ta.addEventListener("input", update);
      update();
      const regen = cell.querySelector(".draftRegen");
      if (regen) regen.addEventListener("click", () => generateDraft(tweetId, true));
    }

    function setReplyButton(tweetId, mode) {
      const button = document.querySelector('.replyBtn[data-reply-id="' + tweetId + '"]');
      if (!button) return;
      button.classList.remove("flash");
      if (mode === "writing") { button.disabled = true; button.innerHTML = "Writing…"; }
      else if (mode === "ready") { button.disabled = false; button.innerHTML = "Copy &amp; open"; }
      else { button.disabled = false; button.innerHTML = "Draft"; }
    }

    function setDraftRowStatus(tweetId, text) {
      const cell = draftRowCell(tweetId).cell;
      if (!cell) return;
      let status = cell.querySelector(".draftStatus");
      if (!status) {
        cell.innerHTML = '<div class="draftBox"><div class="draftMeta"><span class="draftStatus muted"></span></div></div>';
        status = cell.querySelector(".draftStatus");
      }
      status.textContent = text;
    }

    function showDraft(tweetId, text, statusText) {
      const ref = draftRowCell(tweetId);
      if (!ref.cell) return;
      ref.rowEl.classList.remove("hidden");
      ref.cell.innerHTML = draftBoxHtml(text, statusText);
      wireDraftBox(ref.cell, tweetId);
      setReplyButton(tweetId, state.drafts[tweetId] ? "ready" : "draft");
    }

    async function generateDraft(tweetId, force) {
      const ref = draftRowCell(tweetId);
      if (ref.rowEl) ref.rowEl.classList.remove("hidden");
      setReplyButton(tweetId, "writing");
      setDraftRowStatus(tweetId, force ? "regenerating — codex is searching the web (~10–30s)" : "writing — codex is searching the web (~10–30s)");
      try {
        const res = await fetch("/api/engagement/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: state.engagementDate, target: state.target, tweet_id: tweetId, force: !!force }),
        }).then((r) => r.json());
        if (res && res.ok) {
          state.drafts[tweetId] = { tweet_id: tweetId, draft: res.draft };
          showDraft(tweetId, res.draft, res.cached ? "saved draft" : "drafted");
        } else {
          showDraft(tweetId, "", "draft failed (" + ((res && res.reason) || "error") + ") — edit or Regenerate");
        }
      } catch (e) {
        showDraft(tweetId, "", "draft failed — edit or Regenerate");
      }
    }

    function onReplyClick(tweetId) {
      if (state.drafts[tweetId]) copyAndOpen(tweetId);
      else generateDraft(tweetId, false);
    }

    function copyToClipboard(text, ta) {
      // 1. Secure context (https): the async Clipboard API.
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      }
      // 2. Plain HTTP: select a REAL, visible textarea and execCommand. Off-screen /
      //    opacity:0 elements silently fail to copy in Safari, so prefer the draft box.
      let copied = false;
      if (ta) {
        ta.focus();
        ta.select();
        try { ta.setSelectionRange(0, ta.value.length); } catch (e) {}
        try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
      }
      // 3. Last resort: a 1px on-screen textarea (removed immediately).
      if (!copied) {
        const tmp = document.createElement("textarea");
        tmp.value = text;
        tmp.style.position = "fixed";
        tmp.style.left = "0";
        tmp.style.top = "0";
        tmp.style.width = "1px";
        tmp.style.height = "1px";
        tmp.style.opacity = "0.01";
        document.body.appendChild(tmp);
        tmp.focus();
        tmp.select();
        try { tmp.setSelectionRange(0, text.length); } catch (e) {}
        try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
        document.body.removeChild(tmp);
      }
      return copied;
    }

    function copyAndOpen(tweetId) {
      const cell = draftRowCell(tweetId).cell;
      const ta = cell ? cell.querySelector(".draftText") : null;
      const text = ta ? ta.value : (state.drafts[tweetId] ? state.drafts[tweetId].draft : "");
      const copied = copyToClipboard(text, ta);          // copy first, while focused
      const row = queueRowByTweetId(tweetId);
      if (row && row.tweet_url) window.open(row.tweet_url, "_blank");  // then open the tweet
      const button = document.querySelector('.replyBtn[data-reply-id="' + tweetId + '"]');
      if (button) {
        button.classList.add("flash");
        button.innerHTML = copied ? "Copied ✓" : "Select &amp; ⌘C";
        setTimeout(() => { button.classList.remove("flash"); button.innerHTML = "Copy &amp; open"; }, 1500);
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    boot();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/index" || url.pathname === "/api/article/index") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(listIndex()));
    return;
  }
  if (url.pathname === "/api/articles") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(getArticles(url)));
    return;
  }
  if (url.pathname === "/api/engagement/index") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(listEngagementIndex()));
    return;
  }
  if (url.pathname === "/api/engagement/queue") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(getEngagementQueue(url)));
    return;
  }
  if (url.pathname === "/api/engagement/refresh") {
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const result = await refreshEngagementQueue(url.searchParams.get("target"));
    res.writeHead(result.ok ? 200 : 500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
    return;
  }
  if (url.pathname === "/api/engagement/drafts") {
    const date = url.searchParams.get("date");
    const target = url.searchParams.get("target");
    if (!date || !target || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_]+$/.test(target)) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "invalid date or target" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(draftsMap(date, target.toLowerCase())));
    return;
  }
  if (url.pathname === "/api/engagement/draft") {
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const body = await readJsonBody(req);
    const date = String(body.date || "");
    const target = String(body.target || "").replace(/^@/, "").toLowerCase();
    const tweetId = String(body.tweet_id || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_]+$/.test(target) || !/^[a-zA-Z0-9]+$/.test(tweetId)) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "invalid date, target, or tweet_id" }));
      return;
    }
    const result = await draftReply(date, target, tweetId, !!body.force);
    const status = result.ok ? 200 : result.reason === "not_found" ? 404 : 500;
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
    return;
  }
  if (url.pathname === "/api/engagement/track") {
    const date = url.searchParams.get("date");
    const target = url.searchParams.get("target");
    if (!date || !target || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_]+$/.test(target)) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "invalid date or target" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(trackMap(date, target.toLowerCase())));
    return;
  }
  if (url.pathname === "/api/engagement/classify") {
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const body = await readJsonBody(req);
    const date = String(body.date || "");
    const target = String(body.target || "").replace(/^@/, "").toLowerCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_]+$/.test(target)) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "invalid date or target" }));
      return;
    }
    const result = await classifyQueue(date, target);
    res.writeHead(result.ok ? 200 : 500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, must-revalidate" });
  res.end(html);
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`X Research Ops: http://${displayHost}:${port}`);
});
