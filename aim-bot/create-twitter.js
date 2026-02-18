/**
 * Twitter Account Creator
 *
 * Creates a new Twitter/X account using:
 * - AdsPower browser via CDP (human-like interactions from warmup.js patterns)
 * - Instantly API email accounts for email verification
 *
 * Usage:
 *   node create-twitter.js
 *
 * Env: CDP_PORT (default 36833)
 *
 * Prerequisites: browser must already be open (via AdsPower API or warmup.js)
 */

const WebSocket = require("ws");
const fs = require("fs");
const http = require("http");
const https = require("https");

// ─── Config ──────────────────────────────────────────────────────────────────

const DEBUG_PORT = process.env.CDP_PORT || "36833";
const INSTANTLY_API_KEY = "YWNlY2YzY2UtZjM2OS00ZDhiLWIxZDctM2I0YjE0NTcxMzUzOk92b2xhZVJ6VWJyZg==";
const INSTANTLY_API = "https://api.instantly.ai/api/v2";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }

function log(phase, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), phase, msg, ...data };
  console.log(JSON.stringify(entry));
}

// Map a character to its CDP key event properties
function charToKeyInfo(char) {
  const lower = char.toLowerCase();
  const shiftKey = char !== lower && char.toUpperCase() === char && /[A-Z]/.test(char);

  if (/^[a-zA-Z]$/.test(char)) {
    const code = `Key${lower.toUpperCase()}`;
    const keyCode = lower.toUpperCase().charCodeAt(0);
    return { key: char, code, keyCode, shiftKey };
  }

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

  const punctMap = {
    " ": { code: "Space", keyCode: 32, shift: false },
    ".": { code: "Period", keyCode: 190, shift: false },
    ",": { code: "Comma", keyCode: 188, shift: false },
    "-": { code: "Minus", keyCode: 189, shift: false },
    "_": { code: "Minus", keyCode: 189, shift: true },
    "@": { code: "Digit2", keyCode: 50, shift: true },
  };
  if (punctMap[char]) {
    return { key: char, code: punctMap[char].code, keyCode: punctMap[char].keyCode, shiftKey: punctMap[char].shift };
  }

  return { key: char, code: "", keyCode: char.charCodeAt(0), shiftKey: false };
}

// ─── CDP Client (minimal, from warmup.js) ───────────────────────────────────

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = {};
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
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

  async navigate(url) {
    const start = Date.now();
    await this.send("Page.navigate", { url });
    await sleep(3000);
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
    if (r.result?.exceptionDetails) return null;
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

  async moveMouse(x, y) {
    const steps = randInt(5, 10);
    const startX = x + rand(-80, 80);
    const startY = y + rand(-60, 60);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const et = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cx = startX + (x - startX) * et + rand(-2, 2);
      const cy = startY + (y - startY) * et + rand(-2, 2);
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved", x: Math.round(cx), y: Math.round(cy),
        modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
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

  async typeHuman(text) {
    await sleep(rand(300, 800));
    let shiftHeld = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const { key, code, keyCode, shiftKey } = charToKeyInfo(char);
      const modifiers = shiftKey ? 8 : 0;

      if (shiftKey && !shiftHeld) {
        await this.send("Input.dispatchKeyEvent", {
          type: "keyDown", key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 8, timestamp: Date.now() / 1000,
        });
        await sleep(rand(30, 70));
        shiftHeld = true;
      }

      const tsDown = Date.now() / 1000;
      await this.send("Input.dispatchKeyEvent", {
        type: "keyDown", key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: tsDown,
      });
      await sleep(rand(2, 8));
      await this.send("Input.dispatchKeyEvent", {
        type: "char", key: char, text: char,
        unmodifiedText: shiftKey ? char.toLowerCase() : char,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });
      await sleep(rand(5, 20));
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp", key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });

      const nextNeedsShift = i + 1 < text.length && charToKeyInfo(text[i + 1]).shiftKey;
      if (shiftHeld && !nextNeedsShift) {
        await sleep(rand(10, 40));
        await this.send("Input.dispatchKeyEvent", {
          type: "keyUp", key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 0, timestamp: Date.now() / 1000,
        });
        shiftHeld = false;
      }

      if (Math.random() < 0.1) {
        await sleep(rand(200, 500));
      } else {
        await sleep(rand(60, 150));
      }
    }
    if (shiftHeld) {
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Shift", code: "ShiftLeft",
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

  async pressKey(key, code, keyCode) {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown", key, code, windowsVirtualKeyCode: keyCode
    });
    await sleep(rand(30, 80));
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp", key, code, windowsVirtualKeyCode: keyCode
    });
    await sleep(rand(100, 300));
  }
}

// ─── Instantly API email ─────────────────────────────────────────────────────

// Use native fetch (Node 22+) or fallback to curl via child_process
async function httpRequest(url, options = {}) {
  const method = options.method || "GET";
  const headers = { "Accept": "application/json", "Content-Type": "application/json", ...options.headers };

  // Try native fetch first (available in Node 18+)
  try {
    const fetchOpts = { method, headers };
    if (options.body) fetchOpts.body = JSON.stringify(options.body);
    const res = await fetch(url, fetchOpts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  } catch (e) {
    // Fallback to curl
    const { execSync } = require("child_process");
    const headerFlags = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(" ");
    const bodyFlag = options.body ? `-d '${JSON.stringify(options.body)}'` : "";
    const cmd = `curl -s -m 15 -X ${method} ${headerFlags} ${bodyFlag} "${url}" 2>/dev/null`;
    const out = execSync(cmd, { encoding: "utf8", timeout: 20000 });
    let data;
    try { data = JSON.parse(out); } catch { data = out; }
    return { status: 200, data };
  }
}

async function getInstantlyEmail() {
  log("email", "Fetching email accounts from Instantly API...");

  const res = await httpRequest(`${INSTANTLY_API}/accounts`, {
    headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
  });

  const items = res.data?.items;
  if (!items || items.length === 0) {
    throw new Error("No email accounts found in Instantly API");
  }

  // Pick a random account
  const account = items[Math.floor(Math.random() * items.length)];
  const address = account.email;

  log("email", `Picked Instantly email: ${address} (from ${items.length} accounts)`);
  return { address, type: "instantly" };
}

async function waitForInstantlyCode(emailAddress, startTimestamp, timeoutMs = 180000) {
  const start = Date.now();
  const pollInterval = 8000;

  log("email", `Waiting for verification code on ${emailAddress} (emails after ${startTimestamp})...`);

  while (Date.now() - start < timeoutMs) {
    const elapsed = Math.round((Date.now() - start) / 1000);
    log("email", `Polling Instantly inbox... (${elapsed}s / ${timeoutMs / 1000}s)`);

    try {
      const res = await httpRequest(
        `${INSTANTLY_API}/emails?eaccount=${encodeURIComponent(emailAddress)}&limit=20`,
        { headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` } }
      );

      const items = res.data?.items;
      if (items && items.length > 0) {
        for (const email of items) {
          const fromAddr = (email.from_address_email || "").toLowerCase();
          const subject = (email.subject || "").toLowerCase();
          const emailTs = email.timestamp_email;

          // Skip emails older than our signup start
          if (emailTs && new Date(emailTs) <= new Date(startTimestamp)) {
            continue;
          }

          // Check if it's from Twitter/X
          const isFromTwitter = fromAddr.includes("x.com") || fromAddr.includes("twitter");
          const isVerificationSubject = subject.includes("verification") || subject.includes("confirm") || subject.includes("code");

          if (isFromTwitter || isVerificationSubject) {
            log("email", `Found candidate email: from=${fromAddr}, subject=${subject}`);

            // Extract 6-digit code from body
            const bodyText = email.body?.text || email.body?.html || "";
            const match = bodyText.match(/\b(\d{6})\b/);
            if (match) {
              log("email", `Verification code found: ${match[1]}`);
              return match[1];
            }
            log("email", "Matching email found but no 6-digit code in body, continuing...");
          }
        }
      }
    } catch (e) {
      log("email", `Poll error: ${e.message}`);
    }

    await sleep(pollInterval);
  }

  throw new Error("Timeout waiting for verification email from Instantly");
}

// ─── Random identity ────────────────────────────────────────────────────────

function generateIdentity() {
  const firstNames = [
    "James", "Robert", "Michael", "David", "Richard", "Thomas", "Charles", "Daniel",
    "Matthew", "Anthony", "Mark", "Steven", "Andrew", "Joshua", "Kenneth",
    "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan",
    "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra",
  ];
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
    "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson",
  ];

  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  const name = `${first} ${last}`;

  // Birth date: 1985-2002 range
  const year = randInt(1985, 2002);
  const month = randInt(1, 12);
  const day = randInt(1, 28);

  // Generate a password
  const passChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  let password = "";
  for (let i = 0; i < 14; i++) password += passChars[Math.floor(Math.random() * passChars.length)];

  return { name, first, last, year, month, day, password };
}

// ─── Auto-detect CDP WebSocket ──────────────────────────────────────────────

async function autoDetectPageWs() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        const pages = JSON.parse(data);
        const first = pages.find(p => p.type === "page");
        if (first) resolve(first.webSocketDebuggerUrl);
        else reject(new Error("No browser page found. Is AdsPower running?"));
      });
    }).on("error", reject);
  });
}

// ─── Signup Flow ────────────────────────────────────────────────────────────

async function twitterSignup(cdp, identity, emailInfo) {
  const signupStartTime = new Date().toISOString();
  log("signup", "Starting Twitter account creation", { name: identity.name, email: emailInfo.address });

  // Navigate to x.com
  await cdp.navigate("https://x.com");
  await sleep(rand(3000, 5000));
  await cdp.screenshot("/tmp/create-twitter-landing.jpg");

  // Pre-signup dwell — browse the landing page
  log("signup", "Browsing landing page...");
  await sleep(rand(5000, 8000));
  await cdp.scroll(randInt(200, 400));
  await sleep(rand(3000, 5000));
  await cdp.scroll(-randInt(200, 300));
  await sleep(rand(2000, 4000));

  // Find and click "Create account"
  log("signup", "Looking for Create account button...");
  const createRect = await cdp.eval(`(() => {
    const links = document.querySelectorAll('a, [role="link"], [role="button"], button');
    for (const l of links) {
      const txt = l.textContent.trim().toLowerCase();
      if (txt === 'create account' || txt === 'sign up' || txt === 'create an account') {
        const r = l.getBoundingClientRect();
        if (r.width > 0) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,text:txt});
      }
    }
    return null;
  })()`);

  if (!createRect) {
    log("signup", "ERROR: Could not find Create Account button");
    await cdp.screenshot("/tmp/create-twitter-error.jpg");
    return { success: false, reason: "no_create_button" };
  }

  const caRect = JSON.parse(createRect);
  log("signup", `Found: "${caRect.text}"`);
  await sleep(rand(1000, 2000));
  await cdp.clickRect(caRect);
  await sleep(rand(3000, 5000));
  await cdp.screenshot("/tmp/create-twitter-step1.jpg");

  // Step 1: Fill in Name
  log("signup", "Entering name...");
  const nameInput = await cdp.waitFor('input[name="name"]', 10000);
  if (!nameInput) {
    log("signup", "ERROR: Name input not found");
    await cdp.screenshot("/tmp/create-twitter-error.jpg");
    return { success: false, reason: "no_name_input" };
  }
  await sleep(rand(800, 1500));
  await cdp.clickSelector('input[name="name"]');
  await sleep(rand(300, 600));
  await cdp.typeHuman(identity.name);
  await sleep(rand(500, 1000));

  // Check if there's an "email" tab vs "phone" tab — click "Use email instead" if needed
  const useEmailLink = await cdp.eval(`(() => {
    const links = document.querySelectorAll('a, span, [role="link"]');
    for (const l of links) {
      const txt = l.textContent.trim().toLowerCase();
      if (txt.includes('use email instead') || txt.includes('use email')) {
        const r = l.getBoundingClientRect();
        if (r.width > 0) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
      }
    }
    return null;
  })()`);

  if (useEmailLink) {
    const emailLink = JSON.parse(useEmailLink);
    log("signup", "Clicking 'Use email instead'");
    await sleep(rand(500, 1000));
    await cdp.clickRect(emailLink);
    await sleep(rand(1000, 2000));
  }

  // Fill email
  log("signup", "Entering email...");
  const emailInput = await cdp.getRect('input[name="email"], input[type="email"], input[autocomplete="email"]');
  if (emailInput) {
    await cdp.clickRect(emailInput);
    await sleep(rand(300, 600));
    await cdp.typeHuman(emailInfo.address);
    await sleep(rand(500, 1000));
  } else {
    log("signup", "WARNING: Email input not found, trying generic text input");
    // Might be a phone/email combined field
    const textInput = await cdp.getRect('input[name="text"], input[type="text"]');
    if (textInput) {
      await cdp.clickRect(textInput);
      await sleep(rand(300, 600));
      await cdp.typeHuman(emailInfo.address);
      await sleep(rand(500, 1000));
    }
  }

  // Fill Date of Birth using Twitter's SELECTOR_1/2/3 IDs
  log("signup", "Setting date of birth...");
  await sleep(rand(500, 1000));

  // Helper: set a <select> value by clicking it, then setting value + dispatching events
  async function setSelect(cdp, selectorId, value) {
    const rect = await cdp.getRect(`select#${selectorId}`);
    if (rect) {
      await cdp.clickRect(rect);
      await sleep(rand(300, 500));
    }
    const set = await cdp.eval(`(() => {
      const s = document.getElementById('${selectorId}');
      if (!s) return false;
      s.value = '${value}';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      // Also trigger React's synthetic handler
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      nativeInputValueSetter.call(s, '${value}');
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return s.value === '${value}';
    })()`);
    log("signup", `Set ${selectorId} to ${value}: ${set}`);
    await sleep(rand(300, 600));
    // Click elsewhere to close dropdown
    await cdp.click(400, 300);
    await sleep(rand(200, 400));
  }

  // Identify which SELECTOR_N is which by option count
  const selectInfo = await cdp.eval(`JSON.stringify(Array.from(document.querySelectorAll('select')).map(s => ({id:s.id, opts:s.options.length})))`);
  const selects = selectInfo ? JSON.parse(selectInfo) : [];
  log("signup", "Found selects", { selects });

  // Month: 13 options (blank + 12 months), Day: 29-32 options, Year: 50+ options
  const monthSel = selects.find(s => s.opts >= 12 && s.opts <= 14);
  const daySel = selects.find(s => s.opts >= 29 && s.opts <= 32);
  const yearSel = selects.find(s => s.opts > 50);

  if (monthSel) await setSelect(cdp, monthSel.id, String(identity.month));
  await sleep(rand(300, 600));
  if (daySel) await setSelect(cdp, daySel.id, String(identity.day));
  await sleep(rand(300, 600));
  if (yearSel) await setSelect(cdp, yearSel.id, String(identity.year));
  await sleep(rand(300, 600));

  await cdp.screenshot("/tmp/create-twitter-step1-filled.jpg");
  await sleep(rand(1000, 2000));

  // Verify email was entered before proceeding
  const enteredEmail = await cdp.eval(`(() => {
    const inputs = document.querySelectorAll('input[name="email"], input[type="email"], input[autocomplete="email"]');
    for (const i of inputs) { if (i.value) return i.value; }
    return null;
  })()`);
  log("signup", "Email field value", { entered: enteredEmail });
  if (!enteredEmail) {
    log("signup", "WARNING: Email field appears empty, retrying...");
    const emailInput2 = await cdp.getRect('input[name="email"], input[type="email"]');
    if (emailInput2) {
      await cdp.clickRect(emailInput2);
      await sleep(rand(300, 600));
      await cdp.typeHuman(emailInfo.address);
      await sleep(rand(500, 1000));
    }
  }

  // Click through multi-step signup screens (Next -> Customize -> Sign up)
  for (let step = 1; step <= 6; step++) {
    await cdp.screenshot(`/tmp/create-twitter-step${step}.jpg`);

    // Detect what screen we're on by checking page content
    // NOTE: pass stepNum into the eval to avoid ReferenceError on browser-side
    const pageState = await cdp.eval(`(() => {
      try {
        const stepNum = ${step};
        const body = document.body.innerText.toLowerCase();
        // Check for error screens
        if (body.includes('oops') || body.includes('something went wrong') || body.includes('try again later')) return 'error';
        // Check for verification code screen
        if (body.includes('sent you a code') || body.includes('verification code') || body.includes('enter the code')) return 'verification';
        // Check for password screen
        if (document.querySelector('input[type="password"]')) return 'password';
        // Check for "Customize your experience" screen
        if (body.includes('customize your experience') || body.includes('track where you see')) return 'customize';
        // Check for create account / confirm screen (has "Sign up" button)
        const btns = document.querySelectorAll('[role="button"]');
        for (const b of btns) {
          const txt = b.textContent.trim().toLowerCase();
          if (txt === 'sign up') return 'confirm';
        }
        // Check for "Use email instead" (means we cycled back to step 1)
        if (body.includes('use email instead') && stepNum > 1) return 'cycled_back';
        // Check for next button
        for (const b of btns) {
          if (b.textContent.trim().toLowerCase() === 'next') return 'has_next';
        }
        return 'unknown';
      } catch (e) {
        return 'eval_error:' + e.message;
      }
    })()`);

    log("signup", `Step ${step}: Page state = ${pageState}`);

    if (pageState === 'verification') {
      log("signup", "Reached verification code screen");
      break;
    }
    if (pageState === 'password') {
      log("signup", "Reached password screen");
      break;
    }
    if (pageState === 'cycled_back') {
      log("signup", "ERROR: Form cycled back to start — likely bot detected or email rejected");
      await cdp.screenshot("/tmp/create-twitter-cycled.jpg");
      return { success: false, reason: "form_cycled_back" };
    }
    if (pageState === 'error') {
      log("signup", "ERROR: Twitter showed an error message");
      await cdp.screenshot("/tmp/create-twitter-error.jpg");
      const errorBody = await cdp.eval("document.body.innerText.substring(0, 500)");
      log("signup", "Error page text", { text: errorBody });
      return { success: false, reason: "twitter_error" };
    }

    // Find the primary action button
    const actionBtn = await cdp.eval(`(() => {
      const btns = document.querySelectorAll('[role="button"], button');
      // Prefer "Sign up" over "Next"
      for (const txt of ['sign up', 'next']) {
        for (const b of btns) {
          if (b.textContent.trim().toLowerCase() === txt) {
            const r = b.getBoundingClientRect();
            if (r.width > 50 && r.height > 20) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,text:b.textContent.trim().toLowerCase()});
          }
        }
      }
      return null;
    })()`);

    if (!actionBtn) {
      log("signup", `Step ${step}: No action button found`);
      const errText = await cdp.eval(`(() => {
        const alerts = document.querySelectorAll('[role="alert"]');
        for (const a of alerts) { const t = a.textContent.trim(); if (t.length > 3) return t; }
        return null;
      })()`);
      if (errText) log("signup", "Error on page", { error: errText });
      break;
    }

    const btn = JSON.parse(actionBtn);
    log("signup", `Step ${step}: Clicking "${btn.text}"`);
    await sleep(rand(1000, 2500));
    await cdp.clickRect(btn);
    await sleep(rand(4000, 6000));
  }

  await cdp.screenshot("/tmp/create-twitter-pre-verify.jpg");

  // Step 4: Email verification — Twitter sends a 6-digit code
  log("signup", "Waiting for verification code input...");
  const codeInput = await cdp.waitFor('input[name="verification_code"], input[data-testid="ocfEnterTextTextInput"], input[name="text"], input[type="text"]', 15000);

  if (!codeInput) {
    log("signup", "ERROR: Verification code input not found");
    await cdp.screenshot("/tmp/create-twitter-error.jpg");

    // Check for errors
    const errorText = await cdp.eval(`(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      for (const a of alerts) { if (a.textContent.trim().length > 3) return a.textContent.trim(); }
      return null;
    })()`);
    if (errorText) log("signup", "Error on page", { error: errorText });

    return { success: false, reason: "no_verification_input" };
  }

  // Wait for verification email via Instantly API polling
  let code;
  try {
    code = await waitForInstantlyCode(emailInfo.address, signupStartTime, 180000);
  } catch (e) {
    log("signup", "ERROR: " + e.message);
    await cdp.screenshot("/tmp/create-twitter-error.jpg");
    return { success: false, reason: "verification_timeout" };
  }

  // Enter verification code
  log("signup", `Entering verification code: ${code}`);
  await sleep(rand(1000, 2000));
  await cdp.clickSelector('input[data-testid="ocfEnterTextTextInput"], input[name="verification_code"], input[name="text"]');
  await sleep(rand(300, 600));
  await cdp.typeHuman(code);
  await sleep(rand(500, 1000));

  // Click Next/Verify
  const verifyNext = await cdp.getRectByText("button", "Next");
  if (verifyNext) {
    await cdp.clickRect(verifyNext);
  } else {
    await cdp.pressKey("Enter", "Enter", 13);
  }
  await sleep(rand(3000, 5000));
  await cdp.screenshot("/tmp/create-twitter-step5.jpg");

  // Step 5: Set password
  log("signup", "Looking for password input...");
  const pwInput = await cdp.waitFor('input[type="password"], input[name="password"]', 10000);
  if (pwInput) {
    await sleep(rand(800, 1500));
    await cdp.clickSelector('input[type="password"], input[name="password"]');
    await sleep(rand(300, 600));
    await cdp.typeHuman(identity.password);
    await sleep(rand(500, 1000));

    // Click Next
    const pwNext = await cdp.getRectByText("button", "Next");
    if (pwNext) {
      await cdp.clickRect(pwNext);
    } else {
      await cdp.pressKey("Enter", "Enter", 13);
    }
    await sleep(rand(3000, 5000));
  }

  await cdp.screenshot("/tmp/create-twitter-step6.jpg");

  // Step 6: Profile setup (avatar, bio) — skip for now
  log("signup", "Checking for profile setup screens...");

  // Skip avatar upload
  for (let skip = 0; skip < 5; skip++) {
    const skipBtn = await cdp.eval(`(() => {
      const btns = document.querySelectorAll('[role="button"], button, a');
      for (const b of btns) {
        const txt = b.textContent.trim().toLowerCase();
        if (txt === 'skip for now' || txt === 'skip' || txt === 'not now') {
          const r = b.getBoundingClientRect();
          if (r.width > 0) return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});
        }
      }
      return null;
    })()`);

    if (skipBtn) {
      log("signup", "Skipping setup step");
      await sleep(rand(1000, 2000));
      await cdp.clickRect(JSON.parse(skipBtn));
      await sleep(rand(2000, 4000));
    } else {
      break;
    }
  }

  // Check final state
  await sleep(rand(3000, 5000));
  const finalUrl = await cdp.eval("window.location.href");
  await cdp.screenshot("/tmp/create-twitter-final.jpg");

  const isHome = await cdp.eval(`
    window.location.pathname === '/home' ||
    !!document.querySelector('[data-testid="primaryColumn"]') ||
    !!document.querySelector('[aria-label="Home timeline"]')
  `);

  const username = await cdp.eval(`(() => {
    const meta = document.querySelector('meta[property="al:android:url"]');
    if (meta) { const m = meta.content.match(/user\\?screen_name=(.+)/); if (m) return m[1]; }
    const link = document.querySelector('a[href*="/settings/screen_name"]');
    if (link) return link.textContent.replace('@', '');
    return null;
  })()`);

  if (isHome) {
    log("signup", "ACCOUNT CREATED SUCCESSFULLY!", {
      url: finalUrl,
      username,
      email: emailInfo.address,
      password: identity.password,
      name: identity.name,
    });

    // Save credentials to file
    const creds = {
      username,
      email: emailInfo.address,
      twitterPassword: identity.password,
      name: identity.name,
      dob: `${identity.year}-${identity.month}-${identity.day}`,
      created: new Date().toISOString(),
    };
    fs.writeFileSync("/tmp/twitter-account.json", JSON.stringify(creds, null, 2));
    log("signup", "Credentials saved to /tmp/twitter-account.json");

    return { success: true, ...creds };
  }

  log("signup", "Account creation unclear state", { url: finalUrl });
  return { success: false, reason: "unclear_state", url: finalUrl };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log("main", "Twitter Account Creator starting");

  // Connect to browser
  const wsUrl = await autoDetectPageWs();
  log("main", `Connected to browser: ${wsUrl}`);

  const cdp = new CDP(wsUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Override timezone to match proxy IP region (Pacific for Oregon/Washington proxies)
  try {
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
    log("main", "Timezone overridden to America/Los_Angeles");
  } catch (e) {
    log("main", "WARNING: Failed to override timezone", { error: e.message });
  }

  try {
    // Generate identity
    const identity = generateIdentity();
    log("main", "Identity generated", { name: identity.name, dob: `${identity.year}-${identity.month}-${identity.day}` });

    // Step 1: Get email from Instantly API
    const emailInfo = await getInstantlyEmail();
    log("main", `Email ready: ${emailInfo.address}`);

    // Step 2: Referrer break — browse Google briefly before heading to Twitter
    log("main", "Referrer break: visiting Google...");
    await cdp.navigate("https://www.google.com");
    await sleep(rand(3000, 5000));
    await cdp.scroll(randInt(150, 350));
    await sleep(rand(2000, 4000));

    // Step 3: Twitter signup
    const result = await twitterSignup(cdp, identity, emailInfo);
    log("result", "Signup result", result);

    if (!result.success) {
      process.exitCode = 1;
    }
  } finally {
    cdp.close();
  }
}

main().catch(e => {
  log("fatal", e.message, { stack: e.stack });
  process.exit(1);
});

// Safety timeout — 20 min (email verification + Twitter signup)
setTimeout(() => {
  log("fatal", "Global timeout (20 min) — shutting down");
  process.exit(1);
}, 20 * 60 * 1000);
