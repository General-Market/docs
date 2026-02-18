/**
 * screen-aware.js — Screen state management and action verification
 *
 * Provides utilities for:
 * - Taking screenshots and preparing them for analysis
 * - Executing actions (clicks, keypresses) with verification
 * - Modal/popup dismissal helpers
 */

const { execSync } = require("child_process");
const fs = require("fs");
const screenshot = require("./screenshot");
const cursor = require("./cursor");

const DISPLAY = ":1";
const ENV = { ...process.env, DISPLAY };

function exec(cmd) {
  return execSync(cmd, { env: ENV, stdio: ["pipe", "pipe", "pipe"], timeout: 10000 });
}

function sleepMs(ms) {
  if (ms <= 0) return;
  const buf = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buf), 0, 0, Math.round(ms));
}

/**
 * Take a full screenshot and return its path
 */
function captureScreen() {
  return screenshot.captureFullScreen();
}

/**
 * Take a zoomed crop at center point
 */
function captureWithZoom(cx, cy) {
  return screenshot.captureZoomAt(cx, cy);
}

/**
 * Crop a specific region of the screen
 * Returns path to cropped image
 */
function captureRegion(x, y, w, h, outPath) {
  outPath = outPath || "/tmp/aim-region.png";
  exec("import -window root -crop " + w + "x" + h + "+" + x + "+" + y + " " + outPath);
  return outPath;
}

/**
 * Click at coordinates using human-like movement
 */
function clickAt(x, y) {
  cursor.clickHuman(x, y);
}

/**
 * Click at coordinates with raw xdotool (no human movement, for popups)
 */
function clickRaw(x, y) {
  exec("xdotool mousemove --sync " + x + " " + y);
  sleepMs(100);
  exec("xdotool mousedown 1");
  sleepMs(80);
  exec("xdotool mouseup 1");
}

/**
 * Press a key
 */
function pressKey(key) {
  exec("xdotool key " + key);
}

/**
 * Press multiple keys in sequence
 */
function pressKeys(keys) {
  for (var i = 0; i < keys.length; i++) {
    exec("xdotool key " + keys[i]);
    sleepMs(50);
  }
}

/**
 * Scroll up/down
 */
function scroll(direction, clicks) {
  var btn = direction === "up" ? 4 : 5;
  clicks = clicks || 3;
  for (var i = 0; i < clicks; i++) {
    exec("xdotool click " + btn);
    sleepMs(30);
  }
}

/**
 * Get the active window title
 */
function getWindowTitle() {
  try {
    return exec("xdotool getactivewindow getwindowname").toString().trim();
  } catch (e) {
    return "";
  }
}

/**
 * Focus the Chrome window
 */
function focusChrome() {
  try {
    var wid = exec("xdotool search --name Chrome | head -1").toString().trim();
    if (wid) {
      exec("xdotool windowactivate --sync " + wid);
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Execute an action based on structured command
 * action: { type: "click"|"clickRaw"|"key"|"scroll"|"wait", x?, y?, key?, direction?, ms? }
 */
function executeAction(action) {
  switch (action.type) {
    case "click":
      clickAt(action.x, action.y);
      break;
    case "clickRaw":
      clickRaw(action.x, action.y);
      break;
    case "key":
      pressKey(action.key);
      break;
    case "keys":
      pressKeys(action.keys);
      break;
    case "scroll":
      scroll(action.direction || "down", action.clicks || 3);
      break;
    case "wait":
      sleepMs(action.ms || 500);
      break;
    default:
      console.error("Unknown action type:", action.type);
  }
}

/**
 * Draw a red crosshair + circle marker on a screenshot at given coordinates.
 * Used for visual verification before clicking.
 * Returns path to the annotated image.
 */
function markPoint(imagePath, x, y, outPath) {
  outPath = outPath || "/tmp/aim-marked.png";
  var cmd = "convert " + imagePath +
    " -fill none -stroke red -strokewidth 3" +
    " -draw \"circle " + x + "," + y + " " + (x + 15) + "," + y + "\"" +
    " -draw \"line " + (x - 20) + "," + y + " " + (x + 20) + "," + y + "\"" +
    " -draw \"line " + x + "," + (y - 20) + " " + x + "," + (y + 20) + "\"" +
    " -fill red -pointsize 16 -annotate +" + (x + 18) + "+" + (y - 18) +
    " \"(" + x + "," + y + ")\"" +
    " " + outPath;
  exec(cmd);
  return outPath;
}

/**
 * Mark a point on both global and focused screenshots.
 * focusCrop: { x, y, w, h } — the crop region used for the focused screenshot
 * clickX, clickY: screen coordinates of the intended click
 */
function markDual(globalPath, focusPath, focusCrop, clickX, clickY) {
  // Mark on global screenshot
  var globalMarked = "/tmp/aim-marked-global.png";
  markPoint(globalPath, clickX, clickY, globalMarked);

  // Mark on focused screenshot (convert screen coords to crop-relative)
  var focusMarked = "/tmp/aim-marked-focus.png";
  var relX = clickX - focusCrop.x;
  var relY = clickY - focusCrop.y;
  markPoint(focusPath, relX, relY, focusMarked);

  return { global: globalMarked, focus: focusMarked };
}

/**
 * Take screenshot, execute action, take verification screenshot
 * Returns { before: path, after: path }
 */
function executeAndVerify(action) {
  var before = captureScreen();
  executeAction(action);
  sleepMs(300);
  var after = captureScreen();
  return { before: before, after: after };
}

module.exports = {
  captureScreen,
  captureWithZoom,
  captureRegion,
  clickAt,
  clickRaw,
  pressKey,
  pressKeys,
  scroll,
  getWindowTitle,
  focusChrome,
  executeAction,
  executeAndVerify,
  markPoint,
  markDual,
  sleepMs,
};
