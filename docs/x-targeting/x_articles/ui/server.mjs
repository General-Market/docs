import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function listIndex() {
  const dates = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return dates.map((date) => {
    const dateDir = path.join(root, date);
    const niches = fs
      .readdirSync(dateDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
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

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>X Article Radar</title>
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
    .shell { max-width: 1068px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 40px; line-height: 1.1; font-weight: 700; letter-spacing: 0; }
    .sub { margin-top: 8px; color: #6e6e73; font-size: 17px; max-width: 734px; }
    .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    select, .linkButton {
      height: 38px;
      border: 1px solid #d2d2d7;
      background: #fff;
      color: #1d1d1f;
      border-radius: 8px;
      padding: 0 12px;
    }
    .linkButton { display: inline-flex; align-items: center; cursor: pointer; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .metric { background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; padding: 14px 16px; }
    .metric .label { color: #86868b; font-size: 12px; text-transform: uppercase; letter-spacing: .012em; }
    .metric .value { margin-top: 4px; font-size: 24px; line-height: 1.1666; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 13px 14px; border-bottom: 1px solid #e8e8ed; vertical-align: top; }
    th { color: #6e6e73; font-size: 12px; text-transform: uppercase; letter-spacing: .012em; background: #fbfbfd; }
    tr:last-child td { border-bottom: 0; }
    .rank { color: #86868b; width: 48px; }
    .title { font-weight: 600; line-height: 1.2105; }
    .preview { color: #6e6e73; font-size: 14px; margin-top: 5px; max-width: 560px; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .empty { background: #fff; border: 1px solid #e8e8ed; border-radius: 8px; padding: 24px; color: #6e6e73; }
    @media (max-width: 760px) {
      header { align-items: stretch; flex-direction: column; }
      .summary { grid-template-columns: 1fr; }
      table, thead, tbody, th, td, tr { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid #e8e8ed; padding: 12px 0; }
      td { border: 0; padding: 6px 14px; }
      .rank { width: auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>X Article Radar</h1>
        <div class="sub">Native X Articles grouped by date and niche. Click the title to open the Article on X.</div>
      </div>
      <div class="controls">
        <select id="dateSelect" aria-label="Date"></select>
        <select id="nicheSelect" aria-label="Niche"></select>
        <a class="linkButton" id="jsonLink" href="#" target="_blank" rel="noreferrer">JSON</a>
      </div>
    </header>
    <section class="summary">
      <div class="metric"><div class="label">Articles</div><div class="value" id="countMetric">0</div></div>
      <div class="metric"><div class="label">Top engagement</div><div class="value" id="engMetric">0</div></div>
      <div class="metric"><div class="label">Niche</div><div class="value" id="nicheMetric">-</div></div>
    </section>
    <section id="content"></section>
  </main>
  <script>
    const state = { index: [], date: "", niche: "" };
    const fmt = new Intl.NumberFormat();

    async function loadIndex() {
      state.index = await fetch("/api/index").then((r) => r.json());
      const firstDate = state.index[0];
      state.date = firstDate?.date || "";
      state.niche = firstDate?.niches?.[0]?.niche || "";
      renderControls();
      await loadArticles();
    }

    function renderControls() {
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
        renderControls();
        await loadArticles();
      };
      nicheSelect.onchange = async () => {
        state.niche = nicheSelect.value;
        await loadArticles();
      };
    }

    async function loadArticles() {
      if (!state.date || !state.niche) {
        document.getElementById("content").innerHTML = '<div class="empty">No article files found.</div>';
        return;
      }
      const url = "/api/articles?date=" + encodeURIComponent(state.date) + "&niche=" + encodeURIComponent(state.niche);
      const data = await fetch(url).then((r) => r.json());
      const articles = data.articles || [];
      document.getElementById("jsonLink").href = url;
      document.getElementById("countMetric").textContent = fmt.format(articles.length);
      document.getElementById("engMetric").textContent = fmt.format(articles[0]?.engagement || 0);
      document.getElementById("nicheMetric").textContent = state.niche;
      renderTable(articles);
    }

    function renderTable(articles) {
      const content = document.getElementById("content");
      if (!articles.length) {
        content.innerHTML = '<div class="empty">No articles for this date and niche.</div>';
        return;
      }
      content.innerHTML = '<table><thead><tr><th>#</th><th>Article</th><th>Author</th><th>Eng</th><th>Views</th><th>Score</th></tr></thead><tbody>' +
        articles.map((a, i) => '<tr>' +
          '<td class="rank">' + (i + 1) + '</td>' +
          '<td><a class="title" href="' + escapeHtml(a.article_url || a.tweet_url) + '" target="_blank" rel="noreferrer">' + escapeHtml(a.title || "Untitled") + '</a><div class="preview">' + escapeHtml(a.preview_text || "") + '</div></td>' +
          '<td><a href="https://x.com/' + escapeHtml(a.author) + '" target="_blank" rel="noreferrer">@' + escapeHtml(a.author) + '</a></td>' +
          '<td class="num">' + fmt.format(a.engagement || 0) + '</td>' +
          '<td class="num">' + fmt.format(a.views || 0) + '</td>' +
          '<td class="num">' + fmt.format(Math.round(a.score || 0)) + '</td>' +
        '</tr>').join("") +
        '</tbody></table>';
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    loadIndex();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/index") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(listIndex()));
    return;
  }
  if (url.pathname === "/api/articles") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(getArticles(url)));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`X Article Radar: http://${displayHost}:${port}`);
});
