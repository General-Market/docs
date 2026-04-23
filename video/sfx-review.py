#!/usr/bin/env python3
"""SFX Library Reviewer — local server.

Start:  python3 video/sfx-review.py
Open:   http://localhost:8765
State saved to: video/public/sfx/sfx-review.json
"""
import http.server, json, os, socketserver, urllib.parse, webbrowser

SFX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "sfx")
STATE_FILE = os.path.join(SFX_DIR, "sfx-review.json")
PORT = 8765

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}

def save_state(data):
    with open(STATE_FILE, "w") as f:
        json.dump(data, f, indent=2)

def scan_sfx():
    return sorted([f for f in os.listdir(SFX_DIR) if f.endswith(".mp3")])

HTML = r"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SFX Library Review</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; padding-bottom: 70px; }
h1 { font-size: 18px; color: #fff; margin-bottom: 4px; }
.stats { font-size: 13px; color: #888; margin-bottom: 16px; }
.controls { display: flex; gap: 8px; margin-bottom: 16px; position: sticky; top: 0; background: #0a0a0a; padding: 10px 0; z-index: 10; border-bottom: 1px solid #222; flex-wrap: wrap; }
.controls button { padding: 6px 14px; border: 1px solid #333; border-radius: 6px; background: #1a1a1a; color: #ccc; cursor: pointer; font-size: 13px; }
.controls button:hover { background: #252525; }
.controls button.active { background: #2563eb; border-color: #3b82f6; color: #fff; }
.search { padding: 6px 12px; border: 1px solid #333; border-radius: 6px; background: #1a1a1a; color: #e0e0e0; font-size: 13px; width: 200px; }
.saved-toast { position: fixed; top: 16px; right: 16px; background: #22c55e; color: #000; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; opacity: 0; transition: opacity 0.3s; z-index: 100; pointer-events: none; }
.saved-toast.show { opacity: 1; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 6px; }
.sfx { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: #141414; border: 1px solid #222; transition: all 0.15s; }
.sfx:hover { background: #1a1a1a; border-color: #333; }
.sfx.whitelisted { border-color: #22c55e50; background: #22c55e0c; }
.sfx.blacklisted { border-color: #ef444450; background: #ef44440c; opacity: 0.45; }
.sfx.playing { border-color: #3b82f6; background: #2563eb18; }
.sfx.focused { outline: 2px solid #3b82f680; outline-offset: -2px; }
.play-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #444; background: #222; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; }
.play-btn:hover { background: #333; }
.sfx.playing .play-btn { background: #2563eb; border-color: #3b82f6; }
.name { flex: 1; font-size: 12px; font-family: 'SF Mono', 'Menlo', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: 4px; flex-shrink: 0; }
.wl, .bl { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #333; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; }
.wl:hover, .wl.on { background: #22c55e30; border-color: #22c55e; }
.bl:hover, .bl.on { background: #ef444430; border-color: #ef4444; }
.bar { position: fixed; bottom: 0; left: 0; right: 0; background: #111; border-top: 1px solid #333; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
.bar button { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
.bar .del-btn { background: #ef4444; color: #fff; }
.bar .del-btn:hover { background: #dc2626; }
.category { grid-column: 1 / -1; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-top: 14px; padding-bottom: 4px; border-bottom: 1px solid #1a1a1a; }
.keys { font-size: 11px; color: #555; margin-left: auto; }
kbd { background: #222; border: 1px solid #444; border-radius: 3px; padding: 1px 5px; font-size: 11px; font-family: monospace; }
</style>
</head>
<body>
<h1>SFX Library Review</h1>
<div class="stats" id="stats">Loading...</div>
<div class="controls">
  <button class="active" data-filter="all" onclick="setFilter('all',this)">All</button>
  <button data-filter="unmarked" onclick="setFilter('unmarked',this)">Unmarked</button>
  <button data-filter="whitelisted" onclick="setFilter('whitelisted',this)">Whitelisted</button>
  <button data-filter="blacklisted" onclick="setFilter('blacklisted',this)">Blacklisted</button>
  <input class="search" placeholder="Search..." oninput="render()" id="search">
  <span class="keys"><kbd>j</kbd>/<kbd>k</kbd> navigate &nbsp; <kbd>w</kbd> whitelist &nbsp; <kbd>x</kbd> blacklist &nbsp; <kbd>space</kbd> play/pause</span>
</div>
<div class="saved-toast" id="toast">Saved</div>
<div class="grid" id="grid"></div>
<div class="bar">
  <span id="summary"></span>
  <div style="display:flex;gap:8px;">
    <button class="del-btn" onclick="deleteBlacklisted()">Delete Blacklisted</button>
  </div>
</div>

<script>
let files = [];
let state = {};
let currentAudio = null;
let currentIdx = -1;
let filter = 'all';

async function init() {
  const [fRes, sRes] = await Promise.all([
    fetch('/api/files').then(r => r.json()),
    fetch('/api/state').then(r => r.json())
  ]);
  files = fRes;
  state = sRes;
  render();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg || 'Saved';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1200);
}

async function saveState() {
  await fetch('/api/state', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(state) });
  toast();
}

function categorize(name) {
  const rules = [
    [/^text-/, 'Text / Typography'],
    [/^(whoosh-|transition-)/, 'Transitions'],
    [/^(block-|cube-)/, '3D Objects'],
    [/^(pop-|burst-|radiate-)/, 'Data / Numbers'],
    [/^(shape-|swoosh-)/, 'Shapes'],
    [/^(impact-|glide-)/, 'Motion / Impact'],
    [/^(bass-|ripple-|riser-|buildup-|stinger-|boom-|reverse-)/, 'Cinematic'],
    [/^(reveal-|tagline-|outro-)/, 'Branding'],
    [/^(click-|beep-|ui-|notification-|cursor-|scroll-)/, 'UI'],
    [/^glitch-/, 'Glitch'],
    [/^swipe-/, 'Swipe'],
    [/^(slam-|punch-)/, 'Slam / Punch'],
    [/^(typing-|phone-)/, 'Device'],
    [/^shimmer-/, 'Shimmer'],
    [/^(cash-|coins-|money-|stock-|metric-|chart-|data-)/, 'Money / Data'],
    [/^(crowd-|wind-|static-|heartbeat|ambient-|env-)/, 'Ambient / Environment'],
    [/^(boing-|fail-|record-|descending-|comedy-)/, 'Comedy'],
    [/^(magic-|energy-|sci-fi-)/, 'Magic / Energy / Sci-Fi'],
    [/^(dramatic-|horror-)/, 'Dramatic / Horror'],
    [/^(human-|animal-)/, 'Human / Animal'],
    [/^(metal-|object-|tool-|balloon-)/, 'Objects / Tools'],
    [/^(nature-|vehicle-)/, 'Nature / Vehicle'],
    [/^(instrument-|deploy-|code-)/, 'Misc'],
  ];
  for (const [re, cat] of rules) { if (re.test(name)) return cat; }
  return 'Other';
}

function getVisible() {
  const q = document.getElementById('search').value.toLowerCase();
  return files.filter(f => {
    const n = f.replace('.mp3','');
    if (q && !n.includes(q)) return false;
    if (filter === 'whitelisted') return state[n] === 'white';
    if (filter === 'blacklisted') return state[n] === 'black';
    if (filter === 'unmarked') return !state[n];
    return true;
  });
}

function render() {
  const grid = document.getElementById('grid');
  const visible = getVisible();

  const groups = {};
  visible.forEach(f => {
    const n = f.replace('.mp3','');
    const cat = categorize(n);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  });

  let html = '';
  Object.keys(groups).sort().forEach(cat => {
    html += `<div class="category">${cat} (${groups[cat].length})</div>`;
    groups[cat].forEach(f => {
      const n = f.replace('.mp3','');
      const s = state[n] || '';
      const cls = (s === 'white' ? 'whitelisted' : s === 'black' ? 'blacklisted' : '');
      html += `<div class="sfx ${cls}" data-file="${f}" data-name="${n}">
        <button class="play-btn" onclick="playClick(this)">▶</button>
        <span class="name" title="${n}">${n}</span>
        <div class="actions">
          <button class="wl ${s==='white'?'on':''}" onclick="mark('${n}','white')" title="Keep (w)">✓</button>
          <button class="bl ${s==='black'?'on':''}" onclick="mark('${n}','black')" title="Remove (x)">✕</button>
        </div>
      </div>`;
    });
  });

  grid.innerHTML = html;
  updateSummary();

  // Re-highlight current
  if (currentIdx >= 0) {
    const items = document.querySelectorAll('.sfx');
    if (items[currentIdx]) items[currentIdx].classList.add('focused');
  }
}

function playFile(file, btn) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    document.querySelectorAll('.sfx.playing').forEach(el => {
      el.classList.remove('playing');
      el.querySelector('.play-btn').textContent = '▶';
    });
  }

  const row = btn.closest('.sfx');
  currentAudio = new Audio('/sfx/' + file);
  row.classList.add('playing');
  btn.textContent = '◼';
  currentAudio.play();
  currentAudio.onended = () => {
    row.classList.remove('playing');
    btn.textContent = '▶';
    currentAudio = null;
    // Auto-advance
  };
}

function playClick(btn) {
  const row = btn.closest('.sfx');
  const file = row.dataset.file;
  const items = [...document.querySelectorAll('.sfx')];
  const idx = items.indexOf(row);

  if (currentIdx === idx && currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    row.classList.remove('playing');
    btn.textContent = '▶';
    currentAudio = null;
    return;
  }

  document.querySelectorAll('.sfx.focused').forEach(el => el.classList.remove('focused'));
  currentIdx = idx;
  row.classList.add('focused');
  playFile(file, btn);
}

function mark(name, type) {
  if (state[name] === type) delete state[name];
  else state[name] = type;
  saveState();
  render();
}

function setFilter(f, btn) {
  filter = f;
  document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentIdx = -1;
  render();
}

function updateSummary() {
  const w = Object.values(state).filter(v => v === 'white').length;
  const b = Object.values(state).filter(v => v === 'black').length;
  document.getElementById('summary').textContent = `${w} kept · ${b} removed · ${files.length - w - b} unmarked`;
  document.getElementById('stats').textContent = `${files.length} SFX · state saved to sfx-review.json`;
}

async function deleteBlacklisted() {
  const bl = Object.entries(state).filter(([k,v]) => v === 'black').map(([k]) => k);
  if (!bl.length) { alert('Nothing blacklisted'); return; }
  if (!confirm(`Permanently delete ${bl.length} blacklisted SFX files?`)) return;

  const res = await fetch('/api/delete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(bl) });
  const data = await res.json();
  toast(`Deleted ${data.deleted} files`);
  // Remove from state
  bl.forEach(n => delete state[n]);
  await saveState();
  // Refresh file list
  files = await fetch('/api/files').then(r => r.json());
  render();
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const items = [...document.querySelectorAll('.sfx')];
  if (!items.length) return;

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    currentIdx = Math.min(currentIdx + 1, items.length - 1);
    document.querySelectorAll('.sfx.focused').forEach(el => el.classList.remove('focused'));
    items[currentIdx].classList.add('focused');
    items[currentIdx].querySelector('.play-btn').click();
    items[currentIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    currentIdx = Math.max(currentIdx - 1, 0);
    document.querySelectorAll('.sfx.focused').forEach(el => el.classList.remove('focused'));
    items[currentIdx].classList.add('focused');
    items[currentIdx].querySelector('.play-btn').click();
    items[currentIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (currentIdx >= 0 && items[currentIdx]) {
      items[currentIdx].querySelector('.play-btn').click();
    }
  }
  if (e.key === 'w' && currentIdx >= 0) {
    mark(items[currentIdx].dataset.name, 'white');
  }
  if (e.key === 'x' && currentIdx >= 0) {
    mark(items[currentIdx].dataset.name, 'black');
  }
});

init();
</script>
</body>
</html>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), "public"), **kwargs)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif self.path == "/api/files":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(scan_sfx()).encode())
        elif self.path == "/api/state":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(load_state()).encode())
        else:
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        if self.path == "/api/state":
            data = json.loads(body)
            save_state(data)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == "/api/delete":
            names = json.loads(body)
            deleted = 0
            for name in names:
                fp = os.path.join(SFX_DIR, name + ".mp3")
                if os.path.exists(fp):
                    os.remove(fp)
                    deleted += 1
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"deleted": deleted}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # silent


if __name__ == "__main__":
    # Kill any existing server on this port
    os.system(f"lsof -ti:{PORT} | xargs kill -9 2>/dev/null")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"SFX Reviewer running at http://localhost:{PORT}")
        print(f"State file: {STATE_FILE}")
        print("Press Ctrl+C to stop.\n")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
