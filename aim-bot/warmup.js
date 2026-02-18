/**
 * Twitter Warmup & Login Orchestrator
 *
 * CDP-based Node.js script that:
 * 1. Verifies proxy IP quality
 * 2. Browses adult sites to build browsing fingerprint (video blocked)
 * 3. Logs into Twitter with human-like interactions
 *
 * Usage:
 *   node warmup.js                → full warmup + login
 *   node warmup.js --skip-warmup  → login only (skip porn browsing)
 *   node warmup.js --warmup-only  → warmup only (no Twitter login)
 *   node warmup.js --check-only   → audit fingerprint consistency, no login
 *
 * Requires: ws (npm), cdp-helper.js patterns
 * Env: CDP_PORT (default 36833)
 */

const WebSocket = require("ws");
const fs = require("fs");
const { execSync } = require("child_process");
const http = require("http");

// ─── Config ──────────────────────────────────────────────────────────────────

const DEBUG_PORT = process.env.CDP_PORT || "36833";
const TWITTER_USER = "BickmoreKe26313";
const TWITTER_PASS = "v88VrDNa";
const TWITTER_EMAIL = "krysyasuek9495@hotmail.com";
const TOTP_SECRET = "A4BNLWQDHFHO27RV";

const BLOCKED_URLS = [
  "*.mp4", "*.webm", "*.m3u8", "*.ts", "*.flv",
  "*video-delivery*", "*phncdn.com/videos/*",
  "*cdn13.com/videos/*", "*xvideos-cdn.com/videos/*",
  "*.woff2", "*.ttf",
];

const WARMUP_SITES = [
  { name: "Pornhub", url: "https://www.pornhub.com", thumbSelector: "a.videoPreviewBg, a.linkVideoThumb, li.videoBox a", likeSelector: ".voteUp, .like-btn, [data-action=like]" },
  { name: "XVideos", url: "https://www.xvideos.com", thumbSelector: ".thumb-under a, .mozaique .thumb a, a[href*='/video']", likeSelector: ".vote-action-good, #video-vote-like" },
  { name: "XHamster", url: "https://xhamster.com", thumbSelector: "a.video-thumb__image-container, a.thumb-image-container, a[href*='/videos/']", likeSelector: ".rb-new__like, [data-action=like]" },
  { name: "RedTube", url: "https://www.redtube.com", thumbSelector: "a.videoThumb, .thumbnail a, a[href*='/']", likeSelector: ".like-btn, .voteUp" },
  { name: "SpankBang", url: "https://spankbang.com", thumbSelector: "a.thumb, .video-item a, a[href*='/video/']", likeSelector: ".like, .btn-like" },
  { name: "Eporner", url: "https://www.eporner.com", thumbSelector: ".mb a, a[href*='/hd-porn/']", likeSelector: ".like-btn, .thumbs-up" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Map a character to its CDP key event properties
function charToKeyInfo(char) {
  const lower = char.toLowerCase();
  const shiftKey = char !== lower && char.toUpperCase() === char && /[A-Z]/.test(char);

  // Letters
  if (/^[a-zA-Z]$/.test(char)) {
    const code = `Key${lower.toUpperCase()}`;
    const keyCode = lower.toUpperCase().charCodeAt(0); // A=65, B=66, ...
    return { key: char, code, keyCode, shiftKey };
  }

  // Digits and their shift symbols
  const digitShiftMap = {
    "0": { code: "Digit0", keyCode: 48 }, ")": { code: "Digit0", keyCode: 48 },
    "1": { code: "Digit1", keyCode: 49 }, "!": { code: "Digit1", keyCode: 49 },
    "2": { code: "Digit2", keyCode: 50 }, "@": { code: "Digit2", keyCode: 50 },
    "3": { code: "Digit3", keyCode: 51 }, "#": { code: "Digit3", keyCode: 51 },
    "4": { code: "Digit4", keyCode: 52 }, "$": { code: "Digit4", keyCode: 52 },
    "5": { code: "Digit5", keyCode: 53 }, "%": { code: "Digit5", keyCode: 53 },
    "6": { code: "Digit6", keyCode: 54 }, "^": { code: "Digit6", keyCode: 54 },
    "7": { code: "Digit7", keyCode: 55 }, "&": { code: "Digit7", keyCode: 55 },
    "8": { code: "Digit8", keyCode: 56 }, "*": { code: "Digit8", keyCode: 56 },
    "9": { code: "Digit9", keyCode: 57 }, "(": { code: "Digit9", keyCode: 57 },
  };
  if (digitShiftMap[char]) {
    const isShift = !/[0-9]/.test(char);
    return { key: char, ...digitShiftMap[char], shiftKey: isShift };
  }

  // Common punctuation
  const punctMap = {
    " ": { code: "Space", keyCode: 32, shift: false },
    ".": { code: "Period", keyCode: 190, shift: false },
    ",": { code: "Comma", keyCode: 188, shift: false },
    ";": { code: "Semicolon", keyCode: 186, shift: false },
    ":": { code: "Semicolon", keyCode: 186, shift: true },
    "'": { code: "Quote", keyCode: 222, shift: false },
    "\"": { code: "Quote", keyCode: 222, shift: true },
    "-": { code: "Minus", keyCode: 189, shift: false },
    "_": { code: "Minus", keyCode: 189, shift: true },
    "=": { code: "Equal", keyCode: 187, shift: false },
    "+": { code: "Equal", keyCode: 187, shift: true },
    "/": { code: "Slash", keyCode: 191, shift: false },
    "?": { code: "Slash", keyCode: 191, shift: true },
    "\\": { code: "Backslash", keyCode: 220, shift: false },
    "|": { code: "Backslash", keyCode: 220, shift: true },
    "[": { code: "BracketLeft", keyCode: 219, shift: false },
    "{": { code: "BracketLeft", keyCode: 219, shift: true },
    "]": { code: "BracketRight", keyCode: 221, shift: false },
    "}": { code: "BracketRight", keyCode: 221, shift: true },
    "`": { code: "Backquote", keyCode: 192, shift: false },
    "~": { code: "Backquote", keyCode: 192, shift: true },
    "<": { code: "Comma", keyCode: 188, shift: true },
    ">": { code: "Period", keyCode: 190, shift: true },
  };
  if (punctMap[char]) {
    return { key: char, code: punctMap[char].code, keyCode: punctMap[char].keyCode, shiftKey: punctMap[char].shift };
  }

  // Fallback: use charCode
  return { key: char, code: "", keyCode: char.charCodeAt(0), shiftKey: false };
}

function log(phase, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), phase, msg, ...data };
  console.log(JSON.stringify(entry));
}

function runShell(cmd) {
  try { return execSync(cmd, { timeout: 10000 }).toString().trim(); } catch { return ""; }
}

// ─── CDP Client ──────────────────────────────────────────────────────────────

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = {};
    this.bytesReceived = 0;
    this.networkRequests = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        // Track network data
        if (msg.method === "Network.dataReceived") {
          this.bytesReceived += msg.params?.dataLength || 0;
        }
        if (msg.method === "Network.requestWillBeSent") {
          this.networkRequests++;
        }
        if (msg.id && this.pending[msg.id]) {
          this.pending[msg.id](msg);
          delete this.pending[msg.id];
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      const timer = setTimeout(() => {
        delete this.pending[id];
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      this.pending[id] = (msg) => {
        clearTimeout(timer);
        resolve(msg);
      };
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.ws.close(); }

  // ── High-level actions ──

  async enableNetwork() {
    await this.send("Network.enable");
    log("setup", "Network enabled");
  }

  async setWarmupBlocks() {
    await this.send("Network.setBlockedURLs", { urls: BLOCKED_URLS });
    log("setup", "Video/font URL blocks set for warmup");
  }

  async clearBlockedURLs() {
    await this.send("Network.setBlockedURLs", { urls: [] });
    log("setup", "URL blocks cleared for Twitter");
  }

  async navigate(url) {
    const start = Date.now();
    await this.send("Page.navigate", { url });
    // Wait for load
    await sleep(3000);
    // Check readyState
    for (let i = 0; i < 10; i++) {
      const r = await this.eval("document.readyState");
      if (r === "complete" || r === "interactive") break;
      await sleep(1000);
    }
    log("nav", `Navigated to ${url}`, { duration_ms: Date.now() - start });
  }

  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true
    });
    if (r.result?.exceptionDetails) {
      return null;
    }
    return r.result?.result?.value;
  }

  async screenshot(path = "/tmp/cdp-screenshot.jpg") {
    const r = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
    fs.writeFileSync(path, Buffer.from(r.result.data, "base64"));
    return path;
  }

  async waitFor(selector, timeoutMs = 10000) {
    const esc = selector.replace(/'/g, "\\'");
    const polls = Math.ceil(timeoutMs / 500);
    for (let i = 0; i < polls; i++) {
      const found = await this.eval(`!!document.querySelector('${esc}')`);
      if (found) return true;
      await sleep(500);
    }
    return false;
  }

  async getRect(selector) {
    const esc = selector.replace(/'/g, "\\'");
    const json = await this.eval(`(() => {
      const el = document.querySelector('${esc}');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
    })()`);
    return json ? JSON.parse(json) : null;
  }

  async getRectByText(role, text) {
    const json = await this.eval(`(() => {
      const els = document.querySelectorAll('[role="${role}"]');
      const el = Array.from(els).find(e => e.textContent.trim() === '${text}');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
    })()`);
    return json ? JSON.parse(json) : null;
  }

  // Get a random clickable thumbnail element's coordinates
  async getRandomThumb(selector) {
    const esc = selector.replace(/'/g, "\\'");
    const json = await this.eval(`(() => {
      const els = document.querySelectorAll('${esc}');
      if (!els.length) return null;
      // Pick one from the visible middle portion
      const visible = Array.from(els).filter(e => {
        const r = e.getBoundingClientRect();
        return r.top > 100 && r.top < window.innerHeight - 100 && r.width > 20;
      });
      if (!visible.length) return null;
      const el = visible[Math.floor(Math.random() * visible.length)];
      const r = el.getBoundingClientRect();
      return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
    })()`);
    return json ? JSON.parse(json) : null;
  }

  // ── Mouse + input (human-like via CDP) ──

  async moveMouse(x, y) {
    // Bezier-ish movement with intermediate points
    const steps = randInt(5, 10);
    const startX = x + rand(-80, 80);
    const startY = y + rand(-60, 60);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Ease in-out
      const et = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cx = startX + (x - startX) * et + rand(-2, 2);
      const cy = startY + (y - startY) * et + rand(-2, 2);
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Math.round(cx),
        y: Math.round(cy),
        modifiers: 0,
        timestamp: Date.now() / 1000,
        pointerType: "mouse",
      });
      await sleep(rand(12, 35));
    }
  }

  async click(x, y) {
    await this.moveMouse(x, y);
    await sleep(rand(50, 180));

    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed", x, y, button: "left", clickCount: 1,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });
    await sleep(rand(50, 130));
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased", x, y, button: "left", clickCount: 1,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });
    await sleep(rand(100, 300));
  }

  async clickRect(rect) {
    if (!rect) return false;
    const x = Math.round(rect.x + rect.w / 2 + rand(-3, 3));
    const y = Math.round(rect.y + rect.h / 2 + rand(-3, 3));
    await this.click(x, y);
    return true;
  }

  async clickSelector(selector) {
    const rect = await this.getRect(selector);
    if (!rect) { log("click", `Selector not found: ${selector}`); return false; }
    return this.clickRect(rect);
  }

  async insertText(text) {
    await this.send("Input.insertText", { text });
    await sleep(rand(100, 300));
  }

  // Human-like typing: dispatches keyDown→char→keyUp per character with realistic timing
  async typeHuman(text) {
    // Initial delay before starting to type (focus → typing gap)
    await sleep(rand(300, 800));

    let shiftHeld = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const { key, code, keyCode, shiftKey } = charToKeyInfo(char);
      const modifiers = shiftKey ? 8 : 0; // 8 = Shift modifier

      // Press Shift if needed (and not already held)
      if (shiftKey && !shiftHeld) {
        await this.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 8, timestamp: Date.now() / 1000,
        });
        await sleep(rand(30, 70));
        shiftHeld = true;
      }

      // keyDown (no text — text only on char event to avoid double input)
      const tsDown = Date.now() / 1000;
      await this.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: tsDown,
      });

      // Small intra-key delay (real keyboards have ~2-8ms between events)
      await sleep(rand(2, 8));

      // char event (carries the actual text)
      await this.send("Input.dispatchKeyEvent", {
        type: "char",
        key: char, text: char, unmodifiedText: shiftKey ? char.toLowerCase() : char,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });

      // Key hold duration: 5-20ms (how long a real finger stays on the key)
      await sleep(rand(5, 20));

      // keyUp
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });

      // Release Shift if held and next char doesn't need it
      const nextNeedsShift = i + 1 < text.length && charToKeyInfo(text[i + 1]).shiftKey;
      if (shiftHeld && !nextNeedsShift) {
        await sleep(rand(10, 40));
        await this.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 0, timestamp: Date.now() / 1000,
        });
        shiftHeld = false;
      }

      // Inter-keystroke delay: mostly 60-150ms, 10% chance of 200-500ms "thinking" pause
      if (Math.random() < 0.1) {
        await sleep(rand(200, 500));
      } else {
        await sleep(rand(60, 150));
      }
    }

    // Safety: release Shift if still held
    if (shiftHeld) {
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Shift", code: "ShiftLeft",
        windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
        modifiers: 0, timestamp: Date.now() / 1000,
      });
    }
  }

  async scroll(dy) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: randInt(300, 600), y: randInt(300, 500),
      deltaX: 0, deltaY: dy,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });
    await sleep(rand(300, 800));
  }

  async humanScroll(times = 2) {
    for (let i = 0; i < times; i++) {
      await this.scroll(randInt(200, 500));
      await sleep(rand(2000, 5000));
    }
  }

  getStats() {
    return { bytes_received: this.bytesReceived, network_requests: this.networkRequests };
  }
}

// ─── Phase 2: Proxy Check ────────────────────────────────────────────────────

async function checkProxy(cdp) {
  log("proxy", "Checking proxy IP...");
  await cdp.navigate("https://httpbin.org/ip");
  await sleep(2000);
  const body = await cdp.eval("document.body.innerText");
  let ip = null;
  try {
    ip = JSON.parse(body).origin;
  } catch {
    log("proxy", "Could not parse IP response", { body });
    return null;
  }
  log("proxy", `Detected IP: ${ip}`);

  // Check IP quality
  await cdp.navigate(`https://ipinfo.io/${ip}/json`);
  await sleep(2000);
  const info = await cdp.eval("document.body.innerText");
  try {
    const data = JSON.parse(info);
    log("proxy", "IP info", {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country,
      org: data.org,
      type: data.company?.type || "unknown"
    });

    // Warn if datacenter
    const org = (data.org || "").toLowerCase();
    if (org.includes("hosting") || org.includes("datacenter") || org.includes("server") || org.includes("cloud")) {
      log("proxy", "WARNING: IP appears to be datacenter/hosting", { org: data.org });
    }
    return data;
  } catch {
    log("proxy", "Could not parse IP info", { info });
    return null;
  }
}

// ─── Fingerprint Audit ──────────────────────────────────────────────────────

async function auditFingerprint(cdp, proxyInfo) {
  const tz = await cdp.eval("Intl.DateTimeFormat().resolvedOptions().timeZone");
  const cores = await cdp.eval("navigator.hardwareConcurrency");
  const mem = await cdp.eval("navigator.deviceMemory");
  const platform = await cdp.eval("navigator.platform");
  const lang = await cdp.eval("navigator.language");
  const webglVendor = await cdp.eval(`(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null;
    } catch { return null; }
  })()`);

  const ipRegion = proxyInfo?.region || "";
  const ipCity = proxyInfo?.city || "";

  log("audit", "Fingerprint check", { tz, cores, mem, platform, lang, webglVendor, ipRegion, ipCity });

  // Timezone vs IP region heuristic checks
  const tzRegionMap = {
    "America/Chicago": ["TX", "IL", "MN", "WI", "MO", "KS", "NE", "IA", "OK", "LA", "AR", "MS", "AL", "TN"],
    "America/New_York": ["NY", "NJ", "PA", "CT", "MA", "FL", "GA", "NC", "SC", "VA", "MD", "OH", "MI", "IN"],
    "America/Denver": ["CO", "UT", "MT", "WY", "NM", "AZ"],
    "America/Los_Angeles": ["CA", "WA", "OR", "NV"],
    "America/Indiana/Indianapolis": ["IN"],
    "America/Indianapolis": ["IN"],
  };

  if (tz && ipRegion && tzRegionMap[tz]) {
    const expectedStates = tzRegionMap[tz];
    // ipRegion is often a state name or abbreviation
    const regionUpper = ipRegion.toUpperCase();
    const stateMatch = expectedStates.some(s => regionUpper.includes(s));
    if (!stateMatch) {
      log("audit", "WARNING: Timezone/IP region mismatch — fix in AdsPower profile", {
        browserTz: tz,
        ipRegion,
        expectedStates: expectedStates.join(","),
      });
    }
  }

  if (cores > 12 && mem <= 4) {
    log("audit", "WARNING: CPU cores/memory mismatch (unrealistic combo) — fix in AdsPower profile", { cores, mem });
  }

  if (cores > 16) {
    log("audit", "WARNING: Very high CPU core count looks like a server — fix in AdsPower profile", { cores });
  }
}

// ─── Phase 3: Warmup Browsing ────────────────────────────────────────────────

async function browseSite(cdp, site, options = {}) {
  const { clickThumbs = true, doLike = false, dwellRange = [20, 40] } = options;

  log("warmup", `Navigating to ${site.name}...`);
  await cdp.navigate(site.url);
  await sleep(rand(6000, 12000)); // "Reading" homepage

  // Handle age gates / cookie popups
  const ageGateHandled = await handlePopups(cdp);
  if (ageGateHandled) {
    await sleep(rand(2000, 4000));
  }

  // Scroll homepage
  await cdp.humanScroll(randInt(2, 3));

  if (clickThumbs) {
    // Click a thumbnail
    const thumb = await cdp.getRandomThumb(site.thumbSelector);
    if (thumb) {
      log("warmup", `Clicking thumbnail on ${site.name}`, { x: thumb.x, y: thumb.y });
      await cdp.clickRect(thumb);
      await sleep(rand(3000, 6000)); // Wait for page to load

      // Handle popups on video page too
      await handlePopups(cdp);

      // Dwell on video page (video blocked, but page loads)
      const dwell = rand(dwellRange[0] * 1000, dwellRange[1] * 1000);
      log("warmup", `Dwelling on video page ${Math.round(dwell / 1000)}s`);
      await sleep(dwell);

      // Scroll down (comments section)
      await cdp.humanScroll(randInt(2, 3));
      await sleep(rand(3000, 8000));

      // Like if requested
      if (doLike) {
        const likeRect = await cdp.getRect(site.likeSelector);
        if (likeRect) {
          log("warmup", `Clicking like on ${site.name}`);
          await cdp.clickRect(likeRect);
          await sleep(rand(3000, 8000));
        } else {
          log("warmup", `Like button not found on ${site.name}`);
        }
      }
    } else {
      log("warmup", `No thumbnail found on ${site.name}, just scrolling`);
      await cdp.humanScroll(2);
      await sleep(rand(5000, 10000));
    }
  }
}

async function handlePopups(cdp) {
  // Common age gate / cookie consent selectors
  const popupSelectors = [
    // Age gates
    'button:has-text("Enter")', '[id*="age"] button', 'a[href*="enter"]',
    'button[class*="enter"]', '#enterBtn', '.enter-btn',
    // Cookie consent
    'button[id*="accept"]', 'button[class*="accept"]', '.cookie-notice button',
    '#onetrust-accept-btn-handler', '.cc-btn.cc-allow',
  ];

  // Try JS-based popup dismissal
  const dismissed = await cdp.eval(`(() => {
    // Age gate "Enter" / "I agree" buttons
    const btns = document.querySelectorAll('button, a.btn, a[role="button"], input[type="button"]');
    for (const b of btns) {
      const txt = (b.textContent || b.value || '').trim().toLowerCase();
      if (txt === 'enter' || txt === 'i agree' || txt === 'i am 18+' || txt === 'i am over 18' ||
          txt === 'accept' || txt === 'accept all' || txt === 'agree' || txt === 'yes, i am over 18' ||
          txt === 'accept & continue' || txt === "i'm over 18") {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,text:txt});
        }
      }
    }
    return null;
  })()`);

  if (dismissed) {
    const rect = JSON.parse(dismissed);
    log("warmup", `Dismissing popup: "${rect.text}"`);
    await cdp.clickRect(rect);
    return true;
  }
  return false;
}

async function warmupPhase(cdp, durationMinutes = 8) {
  const warmupStart = Date.now();
  const targetMs = durationMinutes * 60 * 1000;
  log("warmup", `Starting warmup browsing phase (target: ${durationMinutes} min)`);

  let siteIndex = 0;
  let round = 0;

  while (Date.now() - warmupStart < targetMs) {
    round++;
    // Shuffle and cycle through sites
    const sites = shuffle(WARMUP_SITES);
    const site = sites[siteIndex % sites.length];
    siteIndex++;

    const elapsed = Math.round((Date.now() - warmupStart) / 1000);
    const remaining = Math.round((targetMs - (Date.now() - warmupStart)) / 1000);
    log("warmup", `Round ${round}: ${site.name} (${elapsed}s elapsed, ${remaining}s remaining)`);

    try {
      await browseSite(cdp, site, {
        clickThumbs: true,
        doLike: Math.random() < 0.3,
        dwellRange: [30, 60]
      });
    } catch (e) {
      log("warmup", `Error browsing ${site.name}, skipping`, { error: e.message });
      await sleep(rand(3000, 6000));
    }

    // Check time budget before inter-site pause
    if (Date.now() - warmupStart >= targetMs) break;

    // Inter-site pause: 10-30s
    await sleep(rand(10000, 30000));
  }

  // Cool-down: idle on last page
  log("warmup", "Cool-down: idling on last page...");
  await cdp.humanScroll(1);
  await sleep(rand(10000, 20000));

  const totalMin = ((Date.now() - warmupStart) / 60000).toFixed(1);
  log("warmup", `Warmup browsing complete (${totalMin} min, ${round} sites)`, cdp.getStats());
}

// ─── Phase 4: Twitter Login ──────────────────────────────────────────────────

async function twitterLogin(cdp) {
  log("twitter", "Starting Twitter login");

  // Navigate to x.com
  await cdp.navigate("https://x.com");
  await sleep(rand(3000, 5000));

  // Screenshot to verify state
  await cdp.screenshot("/tmp/warmup-twitter-landing.jpg");

  // Check if already logged in
  const isHome = await cdp.eval("window.location.pathname === '/home'");
  if (isHome) {
    log("twitter", "Already logged in!");
    return { success: true, reason: "already_logged_in" };
  }

  // Pre-login dwell: browse the landing page like a human (Fix 3)
  log("twitter", "Pre-login dwell: reading landing page...");

  // 1. Read the landing page (5-8s)
  await sleep(rand(5000, 8000));

  // 2. Scroll down 2-3 times with pauses (read trending topics)
  const scrollTimes = randInt(2, 3);
  for (let i = 0; i < scrollTimes; i++) {
    await cdp.scroll(randInt(250, 450));
    await sleep(rand(3000, 5000));
  }

  // 3. Scroll back up once
  await cdp.scroll(-randInt(300, 500));
  await sleep(rand(2000, 4000));

  // 4. Hover over a trending topic / visible link (move mouse, dwell, move away)
  const trendRect = await cdp.eval(`(() => {
    const links = document.querySelectorAll('a[href*="explore"], a[href*="search"], [data-testid="trend"] a, div[data-testid] a');
    const visible = Array.from(links).filter(e => {
      const r = e.getBoundingClientRect();
      return r.top > 50 && r.top < window.innerHeight - 50 && r.width > 20;
    });
    if (!visible.length) return null;
    const el = visible[Math.floor(Math.random() * visible.length)];
    const r = el.getBoundingClientRect();
    return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2});
  })()`);

  if (trendRect) {
    const tr = JSON.parse(trendRect);
    await cdp.moveMouse(tr.x, tr.y);
    await sleep(rand(2000, 3000)); // dwell on trending topic
    // Move mouse away
    await cdp.moveMouse(tr.x + rand(100, 200), tr.y + rand(-80, 80));
  }

  // 5. Final pause before clicking sign in
  await sleep(rand(3000, 5000));

  log("twitter", "Pre-login dwell complete, looking for Sign In...");

  // Find and click "Sign in" link
  log("twitter", "Looking for Sign In button...");
  const signInRect = await cdp.eval(`(() => {
    // Try multiple selectors for sign-in
    const selectors = [
      'a[href="/login"]',
      'a[href*="login"]',
      'a[data-testid="loginButton"]',
      '[data-testid="loginButton"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
      }
    }
    // Fallback: find by text
    const links = document.querySelectorAll('a, [role="link"]');
    for (const l of links) {
      const txt = l.textContent.trim().toLowerCase();
      if (txt === 'sign in' || txt === 'log in') {
        const r = l.getBoundingClientRect();
        if (r.width > 0) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
      }
    }
    return null;
  })()`);

  if (!signInRect) {
    log("twitter", "ERROR: Could not find Sign In button");
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "no_sign_in_button" };
  }

  const siRect = JSON.parse(signInRect);
  await sleep(rand(1000, 3000));
  await cdp.clickRect(siRect);
  log("twitter", "Clicked Sign In");

  // Wait for login dialog
  await sleep(rand(2000, 4000));

  // Step 1: Enter username
  log("twitter", "Entering username...");
  const usernameFound = await cdp.waitFor('input[autocomplete="username"], input[name="text"]', 10000);
  if (!usernameFound) {
    log("twitter", "ERROR: Username input not found");
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "no_username_input" };
  }

  await sleep(rand(800, 2000));
  await cdp.clickSelector('input[autocomplete="username"], input[name="text"]');
  await sleep(rand(300, 600));
  await cdp.typeHuman(TWITTER_USER);
  await sleep(rand(400, 800));

  // Verify input value
  const typedUser = await cdp.eval(`(() => {
    const i = document.querySelector('input[autocomplete="username"]') || document.querySelector('input[name="text"]');
    return i ? i.value : null;
  })()`);
  log("twitter", `Username entered: ${typedUser}`);

  if (typedUser !== TWITTER_USER) {
    log("twitter", "ERROR: Username mismatch", { expected: TWITTER_USER, got: typedUser });
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "username_mismatch" };
  }

  // Click "Next"
  await sleep(rand(500, 1500));
  const nextRect = await cdp.getRectByText("button", "Next");
  if (nextRect) {
    await cdp.clickRect(nextRect);
    log("twitter", "Clicked Next");
  } else {
    log("twitter", "WARNING: Next button not found, trying Enter key");
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
    });
    await sleep(50);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
    });
  }

  await sleep(rand(3000, 5000));
  await cdp.screenshot("/tmp/warmup-twitter-step2.jpg");

  // Check for error banners FIRST (Twitter may have rejected the login)
  const errorBanner = await cdp.eval(`(() => {
    // Look for error toasts / banners
    const alerts = document.querySelectorAll('[role="alert"], [data-testid="toast"], div[class*="Banner"]');
    for (const a of alerts) {
      const txt = a.textContent.trim();
      if (txt.length > 5) return txt;
    }
    // Also check for the specific "Could not log in" text anywhere
    const all = document.body.innerText;
    const match = all.match(/Could not log in[^.]*\\./);
    if (match) return match[0];
    return null;
  })()`);

  if (errorBanner) {
    log("twitter", "ERROR: Twitter rejected login", { error: errorBanner });
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "login_rejected", error: errorBanner };
  }

  // Step 2: Detect what Twitter is asking for
  // IMPORTANT: distinguish real email verify from the initial sign-in dialog bouncing back
  const step2State = await cdp.eval(`(() => {
    // Check if we're back on the initial sign-in page (has "Sign in to X" heading + username placeholder)
    const headings = document.querySelectorAll('h1, h2, span[role="heading"]');
    for (const h of headings) {
      const txt = h.textContent.trim().toLowerCase();
      if (txt.includes('sign in to') || txt === 'sign in') {
        // Still on initial sign-in — login failed silently
        return 'bounced_to_signin';
      }
    }

    const pwInput = document.querySelector('input[type="password"], input[name="password"]');
    if (pwInput) return 'password';

    // For email verify, look for the specific ocf input OR a text input WITHOUT the username autocomplete
    const ocfInput = document.querySelector('input[data-testid="ocfEnterTextTextInput"]');
    if (ocfInput) return 'email_verify';

    // Check for text input that is NOT the username field
    const textInputs = document.querySelectorAll('input[name="text"]');
    for (const inp of textInputs) {
      if (inp.getAttribute('autocomplete') === 'username') continue; // skip username field
      // Check surrounding context for verify/email hints
      const labels = document.querySelectorAll('span, label');
      for (const l of labels) {
        const txt = l.textContent.toLowerCase();
        if (txt.includes('verify your identity') || txt.includes('enter your phone') ||
            txt.includes('enter your email') || txt.includes('confirm your')) {
          return 'email_verify';
        }
      }
      return 'unknown_text_input';
    }

    const captcha = document.querySelector('iframe[src*="captcha"], iframe[src*="arkose"]');
    if (captcha) return 'captcha';
    return 'unknown';
  })()`);

  log("twitter", `Step 2 state: ${step2State}`);

  // Abort if bounced back
  if (step2State === "bounced_to_signin") {
    log("twitter", "ERROR: Login bounced back to sign-in page");
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "bounced_to_signin" };
  }

  // Handle email verification if needed
  if (step2State === "email_verify" || step2State === "unknown_text_input") {
    log("twitter", "Email/phone verification requested");
    const verifyInput = await cdp.getRect('input[data-testid="ocfEnterTextTextInput"], input[name="text"]');
    if (verifyInput) {
      await sleep(rand(800, 1500));
      await cdp.clickRect(verifyInput);
      await sleep(rand(300, 600));
      await cdp.typeHuman(TWITTER_EMAIL);
      await sleep(rand(500, 1000));

      // Click Next/Verify
      const verifyNext = await cdp.getRectByText("button", "Next");
      if (verifyNext) {
        await cdp.clickRect(verifyNext);
      } else {
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
        });
        await sleep(50);
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
        });
      }
      await sleep(rand(3000, 5000));
    }
  }

  // Step 3: Enter password
  log("twitter", "Looking for password input...");
  const pwFound = await cdp.waitFor('input[type="password"], input[name="password"]', 10000);
  if (!pwFound) {
    log("twitter", "ERROR: Password input not found after verification");
    await cdp.screenshot("/tmp/warmup-twitter-error.jpg");
    return { success: false, reason: "no_password_input" };
  }

  await sleep(rand(800, 2000));
  await cdp.clickSelector('input[type="password"], input[name="password"]');
  await sleep(rand(300, 600));
  await cdp.typeHuman(TWITTER_PASS);
  await sleep(rand(500, 1000));

  // Click "Log in"
  const loginRect = await cdp.eval(`(() => {
    const btns = document.querySelectorAll('[role="button"], button');
    const loginBtn = Array.from(btns).find(b => {
      const txt = b.textContent.trim().toLowerCase();
      return txt === 'log in' || txt === 'login';
    });
    if (!loginBtn) return null;
    const r = loginBtn.getBoundingClientRect();
    return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
  })()`);

  if (loginRect) {
    const lr = JSON.parse(loginRect);
    await sleep(rand(500, 1500));
    await cdp.clickRect(lr);
    log("twitter", "Clicked Log In");
  } else {
    log("twitter", "Log in button not found, pressing Enter");
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
    });
    await sleep(50);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
    });
  }

  // Wait for login to complete
  await sleep(rand(5000, 8000));
  await cdp.screenshot("/tmp/warmup-twitter-postlogin.jpg");

  // Check if we're on the home feed
  const url = await cdp.eval("window.location.href");
  const isLoggedIn = await cdp.eval(`(() => {
    return window.location.pathname === '/home' ||
           !!document.querySelector('[data-testid="primaryColumn"]') ||
           !!document.querySelector('[aria-label="Home timeline"]');
  })()`);

  if (isLoggedIn) {
    log("twitter", "LOGIN SUCCESS!", { url });
    return { success: true, reason: "logged_in", url };
  }

  // Check for 2FA
  const needs2fa = await cdp.eval(`(() => {
    const inputs = document.querySelectorAll('input');
    const labels = document.querySelectorAll('span, label, h1, h2');
    for (const l of labels) {
      const txt = l.textContent.toLowerCase();
      if (txt.includes('authentication') || txt.includes('verification code') || txt.includes('two-factor')) return true;
    }
    return false;
  })()`);

  if (needs2fa) {
    log("twitter", "2FA required - computing TOTP...");
    const totp = computeTOTP(TOTP_SECRET);
    if (totp) {
      const codeInput = await cdp.getRect('input[name="text"], input[type="text"], input[data-testid="ocfEnterTextTextInput"]');
      if (codeInput) {
        await sleep(rand(1000, 2000));
        await cdp.clickRect(codeInput);
        await sleep(rand(300, 500));
        await cdp.typeHuman(totp);
        await sleep(rand(500, 1000));

        // Click verify/next
        const verifyBtn = await cdp.getRectByText("button", "Next") || await cdp.getRectByText("button", "Verify");
        if (verifyBtn) {
          await cdp.clickRect(verifyBtn);
        } else {
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
          });
          await sleep(50);
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13
          });
        }
        await sleep(rand(5000, 8000));

        const finalUrl = await cdp.eval("window.location.href");
        const finalCheck = await cdp.eval("window.location.pathname === '/home'");
        if (finalCheck) {
          log("twitter", "LOGIN SUCCESS after 2FA!", { url: finalUrl });
          return { success: true, reason: "logged_in_2fa", url: finalUrl };
        }
      }
    }
  }

  // Check for errors
  const errorText = await cdp.eval(`(() => {
    const errs = document.querySelectorAll('[role="alert"], [data-testid*="error"], .css-1dbjc4n [dir="ltr"]');
    for (const e of errs) {
      const txt = e.textContent.trim();
      if (txt.length > 5 && txt.length < 200) return txt;
    }
    return null;
  })()`);

  if (errorText) {
    log("twitter", "ERROR during login", { error: errorText, url });
    return { success: false, reason: "login_error", error: errorText };
  }

  log("twitter", "Login status unclear", { url });
  await cdp.screenshot("/tmp/warmup-twitter-unclear.jpg");
  return { success: false, reason: "unclear_state", url };
}

// ─── TOTP ────────────────────────────────────────────────────────────────────

function computeTOTP(secret) {
  try {
    // Base32 decode
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const c of secret.toUpperCase()) {
      const val = base32chars.indexOf(c);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    const keyBytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      keyBytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    // Time counter
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    // HMAC-SHA1 (using Node crypto)
    const crypto = require("crypto");
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeUInt32BE(0, 0);
    counterBuf.writeUInt32BE(counter, 4);

    const hmac = crypto.createHmac("sha1", Buffer.from(keyBytes));
    hmac.update(counterBuf);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, "0");
  } catch (e) {
    log("totp", "TOTP computation failed", { error: e.message });
    return null;
  }
}

// ─── Auto-detect CDP WebSocket ───────────────────────────────────────────────

async function autoDetectPageWs() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        const pages = JSON.parse(data);
        const twitter = pages.find(p => p.type === "page" && (p.url.includes("x.com") || p.url.includes("twitter")));
        const first = pages.find(p => p.type === "page");
        const target = twitter || first;
        if (target) resolve(target.webSocketDebuggerUrl);
        else reject(new Error("No browser page found. Is AdsPower running?"));
      });
    }).on("error", reject);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const skipWarmup = args.includes("--skip-warmup");
  const warmupOnly = args.includes("--warmup-only");
  const checkOnly = args.includes("--check-only");
  const longWarmup = args.includes("--long-warmup");
  // --warmup-minutes=N allows exact duration
  const warmupMinArg = args.find(a => a.startsWith("--warmup-minutes="));
  const warmupMinutes = warmupMinArg ? parseInt(warmupMinArg.split("=")[1]) : (longWarmup ? 30 : 8);

  log("main", "Twitter Warmup & Login starting", {
    skipWarmup, warmupOnly,
    pid: process.pid,
    time: new Date().toISOString()
  });

  // Record bandwidth start
  runShell("bash /root/aim-bot/measure-bandwidth.sh start");

  // Verify idle-cursor is running
  const idlePid = runShell("cat /tmp/idle-cursor.pid 2>/dev/null");
  if (idlePid) {
    const alive = runShell(`kill -0 ${idlePid} 2>&1 && echo alive`);
    if (alive.includes("alive")) {
      log("main", `Idle cursor daemon running (PID ${idlePid})`);
    } else {
      log("main", "Idle cursor daemon not running, starting it...");
      runShell("cd /root/aim-bot && nohup node idle-cursor.js > /tmp/idle-cursor.log 2>&1 &");
      await sleep(1000);
    }
  } else {
    log("main", "Idle cursor daemon not running, starting it...");
    runShell("cd /root/aim-bot && nohup node idle-cursor.js > /tmp/idle-cursor.log 2>&1 &");
    await sleep(1000);
  }

  // Connect to browser
  const wsUrl = await autoDetectPageWs();
  log("main", `Connected to browser: ${wsUrl}`);

  const cdp = new CDP(wsUrl);
  await cdp.connect();
  await cdp.enableNetwork();

  try {
    // Phase 2: Proxy check
    const proxyInfo = await checkProxy(cdp);
    const proxyBw = runShell("bash /root/aim-bot/measure-bandwidth.sh stop proxy_check");
    log("bandwidth", "Proxy check", { report: proxyBw });

    // Fingerprint audit (runs after proxy check so we have IP info)
    await auditFingerprint(cdp, proxyInfo);

    // --check-only: audit fingerprint and exit
    if (checkOnly) {
      log("main", "Check-only mode — exiting after fingerprint audit");
      return;
    }

    // Phase 3: Warmup browsing
    if (!skipWarmup) {
      await cdp.setWarmupBlocks(); // block video/font only during warmup
      runShell("bash /root/aim-bot/measure-bandwidth.sh start");
      await warmupPhase(cdp, warmupMinutes);
      const warmupBw = runShell("bash /root/aim-bot/measure-bandwidth.sh stop warmup");
      log("bandwidth", "Warmup phase", { report: warmupBw });
    }

    // Phase 4: Twitter login
    if (!warmupOnly) {
      // Clear URL blocks before Twitter (Fix 2)
      await cdp.clearBlockedURLs();

      // Referrer chain break: navigate to neutral page (Fix 4)
      if (!skipWarmup) {
        log("main", "Breaking referrer chain via Google...");
        await cdp.navigate("https://www.google.com");
        await sleep(rand(3000, 5000));
        await cdp.humanScroll(1);
        await sleep(rand(2000, 4000));
      }

      runShell("bash /root/aim-bot/measure-bandwidth.sh start");
      const result = await twitterLogin(cdp);
      const loginBw = runShell("bash /root/aim-bot/measure-bandwidth.sh stop twitter_login");
      log("bandwidth", "Twitter login", { report: loginBw });
      log("result", "Login result", result);

      if (!result.success) {
        log("result", "FAILED - see screenshots in /tmp/warmup-twitter-*.jpg");
        process.exitCode = 1;
      }
    }

    // Final stats
    log("stats", "Session complete", {
      ...cdp.getStats(),
      duration_ms: Date.now() - startTime
    });

  } finally {
    cdp.close();
  }
}

const startTime = Date.now();
main().catch(e => {
  log("fatal", e.message, { stack: e.stack });
  process.exit(1);
});

// Safety timeout: kill after 45 minutes (extended for long warmup sessions)
setTimeout(() => {
  log("fatal", "Global timeout (45 min) — shutting down");
  process.exit(1);
}, 45 * 60 * 1000);
