/**
 * CDP Helper for AdsPower SunBrowser
 * Human-like browser interaction via Chrome DevTools Protocol
 *
 * Usage:
 *   node cdp-helper.js screenshot           → /tmp/cdp-screenshot.jpg
 *   node cdp-helper.js click X Y            → click at page coordinates
 *   node cdp-helper.js type "text"          → type text (human-like per-char events)
 *   node cdp-helper.js key Enter|Tab|...    → press special key
 *   node cdp-helper.js navigate "url"       → navigate to URL
 *   node cdp-helper.js scroll dy            → scroll by dy pixels
 *   node cdp-helper.js getsize              → get page dimensions
 *   node cdp-helper.js eval "js expression" → evaluate JS, return value
 *   node cdp-helper.js waitfor "selector" [timeout_ms] → wait for DOM element
 */

const WebSocket = require("ws");
const fs = require("fs");

const WS_URL = process.env.CDP_WS || "";
const PAGE_ID = process.env.CDP_PAGE || "";
const DEBUG_PORT = process.env.CDP_PORT || "36833";

// Build WebSocket URL
function getWsUrl() {
  if (WS_URL) return WS_URL;
  if (PAGE_ID) return `ws://127.0.0.1:${DEBUG_PORT}/devtools/page/${PAGE_ID}`;
  // Auto-detect: fetch /json and find the x.com page
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
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

  return { key: char, code: "", keyCode: char.charCodeAt(0), shiftKey: false };
}

class CDPClient {
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
    return new Promise((resolve) => {
      const id = ++this.msgId;
      this.pending[id] = resolve;
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }

  // Take screenshot
  async screenshot(outPath = "/tmp/cdp-screenshot.jpg") {
    const result = await this.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 70
    });
    fs.writeFileSync(outPath, Buffer.from(result.result.data, "base64"));
    console.log(JSON.stringify({ ok: true, path: outPath }));
  }

  // Human-like mouse move + click
  async click(x, y) {
    // Move to position with small intermediate steps (human-like)
    const steps = Math.floor(randBetween(3, 6));
    const startX = x + randBetween(-50, 50);
    const startY = y + randBetween(-50, 50);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = startX + (x - startX) * t + randBetween(-2, 2);
      const cy = startY + (y - startY) * t + randBetween(-2, 2);
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Math.round(cx),
        y: Math.round(cy),
        modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
      });
      await sleep(randBetween(15, 40));
    }

    // Small pause before click (human reaction)
    await sleep(randBetween(50, 150));

    // Mouse down
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x, y, button: "left", clickCount: 1,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });

    // Hold briefly
    await sleep(randBetween(50, 120));

    // Mouse up
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x, y, button: "left", clickCount: 1,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });

    await sleep(randBetween(100, 300));
    console.log(JSON.stringify({ ok: true, clicked: { x, y } }));
  }

  // Human-like typing: dispatches keyDown→char→keyUp per character with Shift handling
  async type(text) {
    await sleep(randBetween(300, 800)); // focus → typing gap

    let shiftHeld = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const { key, code, keyCode, shiftKey } = charToKeyInfo(char);
      const modifiers = shiftKey ? 8 : 0;

      // Press Shift if needed
      if (shiftKey && !shiftHeld) {
        await this.send("Input.dispatchKeyEvent", {
          type: "keyDown", key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 8, timestamp: Date.now() / 1000,
        });
        await sleep(randBetween(30, 70));
        shiftHeld = true;
      }

      await this.send("Input.dispatchKeyEvent", {
        type: "keyDown", key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });
      await sleep(randBetween(2, 8));
      await this.send("Input.dispatchKeyEvent", {
        type: "char", key: char, text: char,
        unmodifiedText: shiftKey ? char.toLowerCase() : char,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });
      await sleep(randBetween(5, 20));
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp", key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        modifiers, timestamp: Date.now() / 1000,
      });

      // Release Shift if next char doesn't need it
      const nextNeedsShift = i + 1 < text.length && charToKeyInfo(text[i + 1]).shiftKey;
      if (shiftHeld && !nextNeedsShift) {
        await sleep(randBetween(10, 40));
        await this.send("Input.dispatchKeyEvent", {
          type: "keyUp", key: "Shift", code: "ShiftLeft",
          windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
          modifiers: 0, timestamp: Date.now() / 1000,
        });
        shiftHeld = false;
      }

      if (Math.random() < 0.1) {
        await sleep(randBetween(200, 500));
      } else {
        await sleep(randBetween(60, 150));
      }
    }

    if (shiftHeld) {
      await this.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Shift", code: "ShiftLeft",
        windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
        modifiers: 0, timestamp: Date.now() / 1000,
      });
    }

    console.log(JSON.stringify({ ok: true, typed: text.length + " chars" }));
  }

  // Press special key (Enter, Tab, etc.)
  async pressKey(key, code, keyCode) {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown", key, code, windowsVirtualKeyCode: keyCode
    });
    await sleep(randBetween(30, 80));
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp", key, code, windowsVirtualKeyCode: keyCode
    });
    await sleep(randBetween(100, 300));
    console.log(JSON.stringify({ ok: true, pressed: key }));
  }

  // Navigate
  async navigate(url) {
    const result = await this.send("Page.navigate", { url });
    await sleep(2000); // Wait for page load
    console.log(JSON.stringify({ ok: true, navigated: url }));
  }

  // Scroll
  async scroll(deltaY) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 400, y: 400,
      deltaX: 0, deltaY,
      modifiers: 0, timestamp: Date.now() / 1000, pointerType: "mouse",
    });
    await sleep(randBetween(200, 500));
    console.log(JSON.stringify({ ok: true, scrolled: deltaY }));
  }

  // Get page layout metrics
  async getSize() {
    const result = await this.send("Page.getLayoutMetrics");
    const vp = result.result.cssVisualViewport || result.result.visualViewport;
    console.log(JSON.stringify({ ok: true, width: vp.clientWidth, height: vp.clientHeight }));
  }

  // Evaluate JavaScript expression and return result
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true
    });
    const val = result.result?.result?.value;
    const err = result.result?.exceptionDetails?.exception?.description;
    if (err) {
      console.log(JSON.stringify({ ok: false, error: err }));
    } else {
      console.log(JSON.stringify({ ok: true, value: val }));
    }
  }

  // Wait for a DOM selector to appear (polls with timeout)
  async waitFor(selector, timeoutMs = 10000) {
    const pollInterval = 500;
    const maxAttempts = Math.ceil(timeoutMs / pollInterval);
    const escaped = selector.replace(/'/g, "\\'");

    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.send("Runtime.evaluate", {
        expression: `!!document.querySelector('${escaped}')`,
        returnByValue: true
      });
      if (result.result?.result?.value === true) {
        console.log(JSON.stringify({ ok: true, found: selector, attempts: i + 1 }));
        return;
      }
      await sleep(pollInterval);
    }
    console.log(JSON.stringify({ ok: false, error: `Timeout waiting for "${selector}" after ${timeoutMs}ms` }));
  }
}

async function autoDetectPageWs() {
  const http = require("http");
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        const pages = JSON.parse(data);
        // Find the x.com or twitter page, or first page
        const twitter = pages.find(p => p.type === "page" && (p.url.includes("x.com") || p.url.includes("twitter")));
        const first = pages.find(p => p.type === "page");
        const target = twitter || first;
        if (target) resolve(target.webSocketDebuggerUrl);
        else reject(new Error("No page found"));
      });
    }).on("error", reject);
  });
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  let wsUrl = getWsUrl();
  if (!wsUrl) wsUrl = await autoDetectPageWs();

  const client = new CDPClient(wsUrl);
  await client.connect();

  switch (cmd) {
    case "screenshot":
    case "ss":
      await client.screenshot(args[0] || "/tmp/cdp-screenshot.jpg");
      break;
    case "click":
      await client.click(parseInt(args[0]), parseInt(args[1]));
      break;
    case "type":
      await client.type(args[0]);
      break;
    case "key":
      // key Enter 13, key Tab 9
      const keyMap = {
        "Enter": ["Enter", "Enter", 13],
        "Tab": ["Tab", "Tab", 9],
        "Escape": ["Escape", "Escape", 27],
        "Backspace": ["Backspace", "Backspace", 8]
      };
      const km = keyMap[args[0]] || [args[0], args[0], parseInt(args[1] || "0")];
      await client.pressKey(km[0], km[1], km[2]);
      break;
    case "navigate":
    case "nav":
      await client.navigate(args[0]);
      break;
    case "scroll":
      await client.scroll(parseInt(args[0]));
      break;
    case "getsize":
    case "size":
      await client.getSize();
      break;
    case "eval":
      await client.eval(args[0]);
      break;
    case "waitfor":
      await client.waitFor(args[0], parseInt(args[1] || "10000"));
      break;
    default:
      console.error("Usage: node cdp-helper.js [screenshot|click|type|key|navigate|scroll|getsize|eval|waitfor]");
  }

  client.close();
  setTimeout(() => process.exit(0), 500);
}

main().catch(e => { console.error(e.message); process.exit(1); });
