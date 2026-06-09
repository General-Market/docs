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
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #e8e8ed; vertical-align: top; }
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
    .preview { color: #6e6e73; font-size: 14px; margin-top: 5px; max-width: 560px; }
    .byline { margin-top: 7px; color: #6e6e73; font-size: 14px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .metricNum { font-size: 18px; font-weight: 700; color: #1d1d1f; }
    .muted { color: #86868b; font-size: 13px; }
    .empty { background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; padding: 24px; color: #6e6e73; }
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
      if (state.mode === "engagement") renderEngagementTable(sortedQueue(state.queue));
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
      content.innerHTML = '<div class="tableWrap"><table><thead><tr>' +
        '<th>Rank</th><th>Candidate</th><th>Source tweet</th><th>Draft reply</th>' +
        engagementSortHeader("score", "Score") +
        engagementSortHeader("engRate", "Eng rate") +
        engagementSortHeader("followers", "Followers") +
        engagementSortHeader("botRisk", "Bot risk") +
        '<th>Target post</th>' +
        '</tr></thead><tbody>' +
        queue.map((row, i) => '<tr>' +
          '<td class="rank">#' + (i + 1) + '</td>' +
          '<td class="personCell"><a class="title" href="https://x.com/' + escapeHtml(row.handle) + '" target="_blank" rel="noreferrer">@' + escapeHtml(row.handle) + '</a><div class="muted">' + escapeHtml(row.name || "") + '</div></td>' +
          '<td class="articleCell"><a class="title" href="' + escapeHtml(row.tweet_url || "") + '" target="_blank" rel="noreferrer">open tweet</a><div class="preview">' + escapeHtml(row.text || "") + '</div><div class="byline">' + escapeHtml(relativeAge(row.created_at)) + ' | ' + escapeHtml(sourceLabel(row)) + ' | ' + escapeHtml(row.created_at || "") + '</div></td>' +
          '<td class="articleCell">' + escapeHtml(row.reply_draft || row.reply_angle || "") + '</td>' +
          '<td class="num"><span class="metricNum">' + fmt.format(Math.round(row.rank_score || 0)) + '</span></td>' +
          '<td class="num"><span class="metricNum">' + formatPercent(row.engagement_rate || 0) + '</span><div class="muted">' + fmt.format(row.engagement || 0) + ' eng</div></td>' +
          '<td class="num">' + fmt.format(row.followers || 0) + '</td>' +
          '<td class="num">' + fmt.format(row.bot_risk || 0) + '<div class="muted">' + escapeHtml((row.bot_risk_reasons || []).join(" | ") || "clean") + '</div></td>' +
          '<td><a href="' + escapeHtml(row.target_tweet_url || "") + '" target="_blank" rel="noreferrer">target</a><div class="muted">' + escapeHtml(row.around_reply_to ? "replying to @" + row.around_reply_to : row.source || "") + '</div></td>' +
        '</tr>').join("") + '</tbody></table></div>';
      content.querySelectorAll("[data-engagement-rank]").forEach((button) => {
        button.addEventListener("click", () => {
          state.engagementRankBy = button.getAttribute("data-engagement-rank");
          document.getElementById("engRankSelect").value = state.engagementRankBy;
          renderEngagementTable(sortedQueue(state.queue));
        });
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
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`X Research Ops: http://${displayHost}:${port}`);
});
