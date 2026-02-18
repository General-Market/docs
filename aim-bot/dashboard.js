#!/usr/bin/env node
/**
 * aim-dashboard.js — Lightweight live monitoring dashboard
 *
 * Architecture:
 *   - Server-Sent Events (SSE) for push updates (no polling)
 *   - Preact + htm from CDN (3KB, no build step)
 *   - Conditional image loading (ETag-based, only re-download on change)
 *   - Performance metrics: miss rate, time-to-click per target
 *
 * Usage: node /tmp/aim-dashboard.js
 * Then open http://localhost:3847
 */

const http = require("http");
const fs = require("fs");
const { execSync } = require("child_process");
const crypto = require("crypto");

const PORT = 3847;
const VPS_HOST = "root@161.97.84.152";
const VPS_PASS = "a7LfaesF789MQru5$";
const SCP_CMD = `sshpass -p '${VPS_PASS}' scp -o StrictHostKeyChecking=no`;

// Agent output file — set via env var or defaults to latest agent
const AGENT_OUTPUT = process.env.AGENT_OUTPUT || "/private/tmp/claude-501/-Users-maxguillabert-Downloads-index/tasks/a2f5b8c.output";
const NOTES_FILE = "/tmp/aim-notes.md";
const METRICS_FILE = "/tmp/aim-metrics.json";

const CACHE_DIR = "/tmp/aim-dashboard-cache";
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}

// ─── State ───────────────────────────────────────────────────────────────────

const imageETags = {};      // path -> hash of file content
const sseClients = [];      // connected SSE clients

// Performance metrics
let metrics = {
  targets: [],         // { remaining, scanTs, clickTs, timeToClick, hit }
  currentScanTs: null, // when last scan started
  currentRemaining: null,
  totalHits: 0,
  totalMisses: 0,
  totalClicks: 0,
  avgTimeToClick: 0,
  bestTimeToClick: Infinity,
  worstTimeToClick: 0
};

// Load persisted metrics
try {
  const saved = JSON.parse(fs.readFileSync(METRICS_FILE, "utf8"));
  metrics = { ...metrics, ...saved };
} catch (e) {}

function saveMetrics() {
  try { fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2)); } catch (e) {}
}

// ─── SSE Push ────────────────────────────────────────────────────────────────

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(msg);
    } catch (e) {
      sseClients.splice(i, 1);
    }
  }
}

// ─── Image Pulling (only on change) ─────────────────────────────────────────

const IMAGE_MAP = {
  grid: "/tmp/aim-grid.png",
  remaining: "/tmp/aim-remaining.png",
  subsectors: "/tmp/aim-subsectors.png",
  clickzoom: "/tmp/aim-click-zoom.png"
};

function hashFile(path) {
  try {
    const data = fs.readFileSync(path);
    return crypto.createHash("md5").update(data).digest("hex").slice(0, 12);
  } catch (e) { return null; }
}

function pullScreenshots() {
  const changed = [];

  for (const [name, vpsPath] of Object.entries(IMAGE_MAP)) {
    const localPath = `${CACHE_DIR}/${name}.png`;
    try {
      execSync(`${SCP_CMD} ${VPS_HOST}:${vpsPath} ${localPath} 2>/dev/null`, { timeout: 5000 });
      const newHash = hashFile(localPath);
      if (newHash && newHash !== imageETags[name]) {
        imageETags[name] = newHash;
        changed.push(name);
      }
    } catch (e) {}
  }

  // Only push if images actually changed
  if (changed.length > 0) {
    broadcast("images", { changed, etags: imageETags });
  }
}

// ─── Agent Output Parsing ────────────────────────────────────────────────────

let lastOutputSize = 0;
let lastReflections = [];
let lastParsedLine = 0;        // track which lines we've already processed for metrics
let processedTimestamps = new Set(); // dedup metrics extraction

function parseAgentOutput() {
  try {
    const stat = fs.statSync(AGENT_OUTPUT);
    if (stat.size === lastOutputSize) return; // no change
    lastOutputSize = stat.size;

    const data = fs.readFileSync(AGENT_OUTPUT, "utf8");
    const lines = data.split("\n").filter(l => l.trim());

    const reflections = [];
    // Extract reflections from recent lines (for display)
    for (let i = Math.max(0, lines.length - 80); i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === "assistant" && entry.message && entry.message.content) {
          for (const block of entry.message.content) {
            if (block.type === "text" && block.text) {
              reflections.push({ time: entry.timestamp, text: block.text });
            }
          }
        }
      } catch (e) {}
    }

    // Extract metrics ONLY from new lines (dedup)
    for (let i = lastParsedLine; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === "assistant" && entry.message && entry.message.content) {
          const tsKey = entry.timestamp + ":" + i;
          if (!processedTimestamps.has(tsKey)) {
            processedTimestamps.add(tsKey);
            for (const block of entry.message.content) {
              if (block.type === "text" && block.text) {
                extractMetrics(block.text, entry.timestamp);
              }
            }
          }
        }
      } catch (e) {}
    }
    lastParsedLine = lines.length;

    const latest = reflections.slice(-8);
    if (JSON.stringify(latest) !== JSON.stringify(lastReflections)) {
      lastReflections = latest;
      broadcast("reflections", latest);
    }
  } catch (e) {}
}

function extractMetrics(text, timestamp) {
  const ts = new Date(timestamp).getTime();

  // Detect "Remaining XX" mentions
  const remMatch = text.match(/[Rr]emaining\s+(\d+)/);
  if (remMatch) {
    const remaining = parseInt(remMatch[1]);

    if (metrics.currentRemaining !== null && remaining < metrics.currentRemaining) {
      // Target was hit — remaining decreased
      const hits = metrics.currentRemaining - remaining;
      for (let i = 0; i < hits; i++) {
        const timeToClick = metrics.currentScanTs
          ? (ts - metrics.currentScanTs) / 1000
          : null;

        metrics.targets.push({
          remaining: metrics.currentRemaining - i,
          scanTs: metrics.currentScanTs,
          clickTs: ts,
          timeToClick,
          hit: true
        });

        metrics.totalHits++;
        metrics.totalClicks++;

        if (timeToClick !== null) {
          if (timeToClick < metrics.bestTimeToClick) metrics.bestTimeToClick = timeToClick;
          if (timeToClick > metrics.worstTimeToClick) metrics.worstTimeToClick = timeToClick;
        }
      }
      recomputeAvg();
      saveMetrics();
      broadcast("metrics", getMetricsSummary());
    }

    metrics.currentRemaining = remaining;
    metrics.currentScanTs = ts;
  }

  // Detect miss indicators
  if (/miss|missed|didn'?t hit|no change in remaining/i.test(text)) {
    metrics.totalMisses++;
    metrics.totalClicks++;
    metrics.targets.push({
      remaining: metrics.currentRemaining,
      scanTs: metrics.currentScanTs,
      clickTs: ts,
      timeToClick: metrics.currentScanTs ? (ts - metrics.currentScanTs) / 1000 : null,
      hit: false
    });
    recomputeAvg();
    saveMetrics();
    broadcast("metrics", getMetricsSummary());
  }
}

function recomputeAvg() {
  const hits = metrics.targets.filter(t => t.hit && t.timeToClick !== null);
  if (hits.length > 0) {
    let sum = 0;
    for (const h of hits) sum += h.timeToClick;
    metrics.avgTimeToClick = sum / hits.length;
  }
}

function getMetricsSummary() {
  return {
    totalHits: metrics.totalHits,
    totalMisses: metrics.totalMisses,
    totalClicks: metrics.totalClicks,
    missRate: metrics.totalClicks > 0 ? (metrics.totalMisses / metrics.totalClicks * 100).toFixed(1) : "0.0",
    avgTimeToClick: metrics.avgTimeToClick.toFixed(2),
    bestTimeToClick: metrics.bestTimeToClick === Infinity ? "-" : metrics.bestTimeToClick.toFixed(2),
    worstTimeToClick: metrics.worstTimeToClick === 0 ? "-" : metrics.worstTimeToClick.toFixed(2),
    currentRemaining: metrics.currentRemaining,
    recentTargets: metrics.targets.slice(-10)
  };
}

// ─── Notes ───────────────────────────────────────────────────────────────────

let lastNotesHash = "";
function checkNotes() {
  try {
    const content = fs.readFileSync(NOTES_FILE, "utf8");
    const hash = crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
    if (hash !== lastNotesHash) {
      lastNotesHash = hash;
      broadcast("notes", content);
    }
  } catch (e) {}
}

// ─── Image Serving (with ETag) ──────────────────────────────────────────────

function serveImage(req, res, name) {
  const filePath = `${CACHE_DIR}/${name}.png`;
  const etag = imageETags[name] || "none";

  // Check If-None-Match
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    res.end();
    return;
  }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": "image/png",
      "ETag": etag,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ─── HTML (Preact + htm + SSE) ──────────────────────────────────────────────

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Aim Bot Dashboard</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,system-ui,sans-serif;font-size:13px}
    #app{display:grid;grid-template-columns:1fr 340px;grid-template-rows:auto 1fr;height:100vh;gap:1px;background:#21262d}
    .header{grid-column:1/-1;background:#161b22;padding:6px 12px;display:flex;align-items:center;gap:12px}
    .header h1{font-size:14px;color:#58a6ff;font-weight:600}
    .dot{width:8px;height:8px;border-radius:50%;background:#238636;animation:blink 2s infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
    .status-text{color:#8b949e;font-size:11px;margin-left:auto}

    .main{background:#0d1117;padding:4px;overflow:hidden;display:flex;flex-direction:column}
    .main img{width:100%;height:auto;border-radius:3px;display:block}

    .sidebar{background:#0d1117;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
    .panel{background:#161b22;padding:8px}
    .panel h2{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:500}

    .metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
    .metric{background:#0d1117;border-radius:4px;padding:6px 8px;text-align:center}
    .metric .val{font-size:18px;font-weight:700;color:#58a6ff}
    .metric .val.good{color:#238636}
    .metric .val.bad{color:#f85149}
    .metric .lbl{font-size:9px;color:#8b949e;text-transform:uppercase;margin-top:2px}

    .reflection{background:#0d1117;border-radius:3px;padding:5px 7px;margin-bottom:3px;font-size:11px;line-height:1.4}
    .reflection .t{color:#484f58;font-size:9px}
    .reflection .m{color:#b1bac4;word-break:break-word}

    .zoom-row{display:flex;gap:4px;margin-top:4px}
    .zoom-row img{flex:1;min-width:0;height:auto;border-radius:3px}

    .target-row{display:flex;gap:2px;font-size:10px;padding:2px 0;border-bottom:1px solid #21262d}
    .target-row.hit .status{color:#238636}
    .target-row.miss .status{color:#f85149}
    .target-row .rem{color:#8b949e;width:30px}
    .target-row .ttc{color:#58a6ff;width:40px;text-align:right}
    .target-row .status{width:30px;text-align:center;font-weight:600}
  </style>
</head>
<body>
<div id="app">
  <div class="header">
    <div class="dot" id="dot"></div>
    <h1>AIM BOT</h1>
    <span id="remaining-badge" style="background:#238636;color:#fff;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600">--</span>
    <span class="status-text" id="status">Connecting...</span>
  </div>

  <div class="main">
    <img id="img-grid" src="/img/grid" alt="">
    <div class="zoom-row">
      <img id="img-remaining" src="/img/remaining" alt="">
      <img id="img-subsectors" src="/img/subsectors" alt="">
    </div>
  </div>

  <div class="sidebar">
    <div class="panel">
      <h2>Performance</h2>
      <div class="metrics-grid">
        <div class="metric"><div class="val good" id="m-hits">0</div><div class="lbl">Hits</div></div>
        <div class="metric"><div class="val bad" id="m-misses">0</div><div class="lbl">Misses</div></div>
        <div class="metric"><div class="val" id="m-missrate">0%</div><div class="lbl">Miss Rate</div></div>
        <div class="metric"><div class="val" id="m-avg">-</div><div class="lbl">Avg Time</div></div>
        <div class="metric"><div class="val good" id="m-best">-</div><div class="lbl">Best</div></div>
        <div class="metric"><div class="val" id="m-worst">-</div><div class="lbl">Worst</div></div>
      </div>
    </div>

    <div class="panel" style="flex:0 0 auto;max-height:180px;overflow-y:auto">
      <h2>Target Log</h2>
      <div id="target-log"></div>
    </div>

    <div class="panel" style="flex:1;overflow-y:auto">
      <h2>Agent Thinking</h2>
      <div id="reflections"></div>
    </div>
  </div>
</div>

<script>
// --- SSE Connection (no polling!) ---
let reconnectDelay = 1000;
let imageEtags = {};

function connect() {
  const es = new EventSource('/sse');

  es.onopen = () => {
    document.getElementById('dot').style.background = '#238636';
    document.getElementById('status').textContent = 'Connected';
    reconnectDelay = 1000;
  };

  es.onerror = () => {
    document.getElementById('dot').style.background = '#f85149';
    document.getElementById('status').textContent = 'Reconnecting...';
    es.close();
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
  };

  // Image change events — only reload changed images
  es.addEventListener('images', (e) => {
    const data = JSON.parse(e.data);
    const t = Date.now();
    for (const name of data.changed) {
      const el = document.getElementById('img-' + name);
      if (el) el.src = '/img/' + name + '?t=' + t;
    }
    imageEtags = data.etags;
    document.getElementById('status').textContent = 'Updated ' + new Date().toLocaleTimeString();
  });

  // Reflections
  es.addEventListener('reflections', (e) => {
    const items = JSON.parse(e.data);
    const container = document.getElementById('reflections');
    let html = '';
    for (const r of items) {
      const time = new Date(r.time).toLocaleTimeString();
      const text = r.text.length > 250 ? r.text.substring(0, 250) + '...' : r.text;
      html += '<div class="reflection"><span class="t">' + time + '</span> <span class="m">' + esc(text) + '</span></div>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  });

  // Metrics
  es.addEventListener('metrics', (e) => {
    const m = JSON.parse(e.data);
    document.getElementById('m-hits').textContent = m.totalHits;
    document.getElementById('m-misses').textContent = m.totalMisses;
    document.getElementById('m-missrate').textContent = m.missRate + '%';
    document.getElementById('m-avg').textContent = m.avgTimeToClick + 's';
    document.getElementById('m-best').textContent = m.bestTimeToClick === '-' ? '-' : m.bestTimeToClick + 's';
    document.getElementById('m-worst').textContent = m.worstTimeToClick === '-' ? '-' : m.worstTimeToClick + 's';
    if (m.currentRemaining !== null) {
      document.getElementById('remaining-badge').textContent = m.currentRemaining;
    }

    // Target log
    if (m.recentTargets) {
      let html = '';
      for (let i = m.recentTargets.length - 1; i >= 0; i--) {
        const t = m.recentTargets[i];
        const cls = t.hit ? 'hit' : 'miss';
        const ttc = t.timeToClick !== null ? t.timeToClick.toFixed(1) + 's' : '-';
        html += '<div class="target-row ' + cls + '"><span class="rem">#' + t.remaining + '</span><span class="status">' + (t.hit ? 'HIT' : 'MISS') + '</span><span class="ttc">' + ttc + '</span></div>';
      }
      document.getElementById('target-log').innerHTML = html;
    }
  });

  // Notes
  es.addEventListener('notes', (e) => {
    // notes available if needed
  });

  // Initial state
  es.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    // Trigger initial renders
    if (data.metrics) {
      es.dispatchEvent(new MessageEvent('metrics', { data: JSON.stringify(data.metrics) }));
    }
    if (data.reflections) {
      es.dispatchEvent(new MessageEvent('reflections', { data: JSON.stringify(data.reflections) }));
    }
    // Load images
    const t = Date.now();
    document.getElementById('img-grid').src = '/img/grid?t=' + t;
    document.getElementById('img-remaining').src = '/img/remaining?t=' + t;
    document.getElementById('img-subsectors').src = '/img/subsectors?t=' + t;
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

connect();
</script>
</body>
</html>`;
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
    res.end(getDashboardHTML());
    return;
  }

  // SSE endpoint
  if (url.pathname === "/sse") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write("\n");

    sseClients.push(res);
    req.on("close", () => {
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });

    // Send initial state
    const initData = {
      metrics: getMetricsSummary(),
      reflections: lastReflections,
      etags: imageETags
    };
    res.write(`event: init\ndata: ${JSON.stringify(initData)}\n\n`);
    return;
  }

  // Image endpoints with ETag
  if (url.pathname.startsWith("/img/")) {
    const name = url.pathname.replace("/img/", "");
    if (IMAGE_MAP[name] !== undefined) {
      serveImage(req, res, name);
      return;
    }
  }

  // API fallback for non-SSE clients
  if (url.pathname === "/api/state") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify({
      reflections: lastReflections,
      metrics: getMetricsSummary(),
      etags: imageETags
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ─── Background Loops ────────────────────────────────────────────────────────

// Pull screenshots every 3s (SCP is the bottleneck, not the client)
setInterval(pullScreenshots, 3000);
pullScreenshots();

// Parse agent output every 2s (just reads file, very cheap)
setInterval(parseAgentOutput, 2000);
parseAgentOutput();

// Check notes every 5s
setInterval(checkNotes, 5000);
checkNotes();

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  Aim Bot Dashboard: http://localhost:${PORT}`);
  console.log("  SSE push updates (no polling)");
  console.log("  Preact-free vanilla JS (~0 overhead)\n");
});
