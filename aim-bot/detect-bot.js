/**
 * Bot detection audit — checks all known automation signals
 * Run on VPS: cd /root/aim-bot && node detect-bot.js
 */
const WebSocket = require("ws");
const http = require("http");

const DEBUG_PORT = process.env.CDP_PORT || "36833";

async function main() {
  // Auto-detect page
  const pages = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });

  const target = pages.find(p => p.type === "page");
  if (!target) { console.error("No page found"); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = {};

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending[msg.id]) {
      pending[msg.id](msg);
      delete pending[msg.id];
    }
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  const send = (method, params = {}) => new Promise(r => {
    const id = ++msgId;
    pending[id] = r;
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result?.result?.value;
  };

  console.log("=== BOT DETECTION AUDIT ===\n");

  // 1. WebDriver flag
  const webdriver = await evalJS("navigator.webdriver");
  console.log(`1. navigator.webdriver: ${webdriver} ${webdriver ? "❌ DETECTED" : "✅ OK"}`);

  // 2. CDP artifacts in window
  const cdcKeys = await evalJS("JSON.stringify(Object.keys(window).filter(k => /cdc_|__cdc|__webdriver|__selenium|__driver/.test(k)))");
  console.log(`2. CDP/Selenium window keys: ${cdcKeys} ${cdcKeys !== "[]" ? "❌ DETECTED" : "✅ OK"}`);

  // 3. Chrome runtime (headless lacks this)
  const chromeRuntime = await evalJS("!!window.chrome?.runtime?.id");
  console.log(`3. chrome.runtime.id: ${chromeRuntime} (false = normal for non-extension page)`);

  // 4. Plugins count
  const plugins = await evalJS("navigator.plugins.length");
  console.log(`4. Plugins count: ${plugins} ${plugins === 0 ? "❌ SUSPICIOUS (headless)" : "✅ OK"}`);

  // 5. Outer dimensions (0 in headless)
  const outerH = await evalJS("window.outerHeight");
  const outerW = await evalJS("window.outerWidth");
  console.log(`5. outerHeight/Width: ${outerH}x${outerW} ${outerH === 0 ? "❌ HEADLESS" : "✅ OK"}`);

  // 6. Screen position
  const screenX = await evalJS("window.screenX");
  const screenY = await evalJS("window.screenY");
  console.log(`6. screenX/Y: ${screenX}, ${screenY}`);

  // 7. Notification permission
  const notifPerm = await evalJS("Notification.permission");
  console.log(`7. Notification.permission: ${notifPerm} (default = normal)`);

  // 8. WebGL vendor/renderer
  const webgl = await evalJS(`(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    if (!gl) return "no webgl";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "no debug ext";
    return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) + " | " + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  })()`);
  console.log(`8. WebGL: ${webgl}`);

  // 9. Screen resolution consistency
  const screenRes = await evalJS("JSON.stringify({screen: screen.width+'x'+screen.height, avail: screen.availWidth+'x'+screen.availHeight, inner: innerWidth+'x'+innerHeight, outer: outerWidth+'x'+outerHeight, dpr: devicePixelRatio})");
  console.log(`9. Screen info: ${screenRes}`);

  // 10. User agent
  const ua = await evalJS("navigator.userAgent");
  console.log(`10. User-Agent: ${ua}`);

  // 11. Platform
  const platform = await evalJS("navigator.platform");
  console.log(`11. Platform: ${platform}`);

  // 12. Hardware concurrency / device memory
  const hw = await evalJS("navigator.hardwareConcurrency");
  const mem = await evalJS("navigator.deviceMemory");
  console.log(`12. CPU cores: ${hw}, Device memory: ${mem}GB`);

  // 13. Connection type
  const conn = await evalJS("navigator.connection ? navigator.connection.effectiveType : 'N/A'");
  console.log(`13. Connection type: ${conn}`);

  // 14. isTrusted check — can CDP events pass isTrusted?
  const isTrustedTest = await evalJS(`new Promise(resolve => {
    const handler = (e) => {
      document.removeEventListener('click', handler);
      resolve(e.isTrusted);
    };
    document.addEventListener('click', handler);
    // We'll check this separately
    resolve('needs_click_test');
  })`);
  console.log(`14. isTrusted on CDP events: NEEDS MANUAL TEST (CDP Input.dispatch → isTrusted=true in Chrome, but some frameworks check)`);

  // 15. Permissions API weirdness
  const permCheck = await evalJS(`navigator.permissions.query({name: 'notifications'}).then(r => r.state).catch(e => e.message)`);
  console.log(`15. Permissions API notifications: ${permCheck}`);

  // 16. Canvas fingerprint consistency
  const canvasHash = await evalJS(`(() => {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText("BotDetect,1234", 2, 15);
    return c.toDataURL().length;
  })()`);
  console.log(`16. Canvas fingerprint data length: ${canvasHash} (should be >1000 for real browser)`);

  // 17. Timezone consistency
  const tz = await evalJS("Intl.DateTimeFormat().resolvedOptions().timeZone");
  console.log(`17. Timezone: ${tz}`);

  // 18. Language consistency
  const langs = await evalJS("JSON.stringify({language: navigator.language, languages: navigator.languages})");
  console.log(`18. Languages: ${langs}`);

  // 19. Do Not Track
  const dnt = await evalJS("navigator.doNotTrack");
  console.log(`19. DoNotTrack: ${dnt}`);

  // 20. Automation-specific properties
  const autoProps = await evalJS(`JSON.stringify({
    callPhantom: typeof window.callPhantom,
    phantom: typeof window._phantom,
    nightmare: typeof window.__nightmare,
    domAutomation: typeof window.domAutomation,
    domAutomationController: typeof window.domAutomationController,
    awesomium: typeof window.awesomium,
    cefSharp: typeof window.CefSharp,
    emit: typeof document.emit,
    spawn: typeof document.spawn
  })`);
  console.log(`20. Automation frameworks: ${autoProps}`);

  console.log("\n=== INPUT EVENT ANALYSIS ===\n");

  // 21. Check if Input.insertText creates synthetic events
  console.log("21. Input.insertText: Creates input/change events but they have NO KeyboardEvent");
  console.log("    Twitter likely monitors: keydown→keypress→input→keyup sequence");
  console.log("    insertText ONLY fires: input event (missing keydown/keypress/keyup)");
  console.log("    ❌ THIS IS A MAJOR RED FLAG");

  // 22. Check mouse event properties from CDP
  console.log("\n22. CDP Input.dispatchMouseEvent:");
  console.log("    - Creates events with isTrusted=true in Chrome ✅");
  console.log("    - BUT may lack certain properties like movementX/Y, offsetX/Y");
  console.log("    - screenX/screenY may not match real screen coordinates");

  // 23. Network patterns
  console.log("\n23. Network.setBlockedURLs:");
  console.log("    - Blocks requests BEFORE they start");
  console.log("    - Sites can detect missing resources via JS (check if analytics loaded)");
  console.log("    - Twitter loads analytics/telemetry scripts that report back");
  console.log("    ⚠️ POTENTIALLY DETECTABLE if Twitter checks for missing telemetry");

  console.log("\n=== CRITICAL ISSUES SUMMARY ===\n");
  console.log("🔴 Input.insertText - Missing keydown/keypress/keyup event sequence");
  console.log("🔴 No pre-login browsing ON twitter.com (scroll homepage before login)");
  console.log("🟡 Network.setBlockedURLs may block Twitter telemetry/analytics");
  console.log("🟡 CDP mouse events may lack some properties");
  console.log("🟡 Immediate login after warmup - no dwell time on x.com");

  ws.close();
  setTimeout(() => process.exit(0), 500);
}

main().catch(e => { console.error(e.message); process.exit(1); });
