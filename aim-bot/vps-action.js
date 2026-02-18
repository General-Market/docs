#!/usr/bin/env node
/**
 * vps-action.js — Execute a single action on the VPS and return screenshot
 *
 * Usage: node vps-action.js <command> [args...]
 *
 * Commands:
 *   screenshot                    - Take full screenshot
 *   crop <x> <y> <w> <h>         - Crop a region
 *   zoom <cx> <cy>               - Zoom at center point
 *   click <x> <y>                - Human-like click
 *   clickraw <x> <y>             - Raw xdotool click (for modals)
 *   key <keyname>                - Press a key
 *   scroll <up|down> [clicks]    - Scroll
 *   focus                        - Focus Chrome window
 *   title                        - Get active window title
 *   act-verify <json>            - Execute action + verify with screenshot
 *
 * All commands that take screenshots output the path.
 */

const sa = require("./screen-aware");

var args = process.argv.slice(2);
var cmd = args[0];

switch (cmd) {
  case "screenshot": {
    var path = sa.captureScreen();
    console.log(path);
    break;
  }
  case "crop": {
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);
    var w = parseInt(args[3]);
    var h = parseInt(args[4]);
    var out = args[5] || "/tmp/aim-region.png";
    var path = sa.captureRegion(x, y, w, h, out);
    console.log(path);
    break;
  }
  case "zoom": {
    var cx = parseInt(args[1]);
    var cy = parseInt(args[2]);
    var result = sa.captureWithZoom(cx, cy);
    console.log(JSON.stringify(result));
    break;
  }
  case "click": {
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);
    sa.clickAt(x, y);
    sa.sleepMs(200);
    var path = sa.captureScreen();
    console.log(path);
    break;
  }
  case "clickraw": {
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);
    sa.clickRaw(x, y);
    sa.sleepMs(200);
    var path = sa.captureScreen();
    console.log(path);
    break;
  }
  case "key": {
    sa.pressKey(args[1]);
    sa.sleepMs(200);
    var path = sa.captureScreen();
    console.log(path);
    break;
  }
  case "scroll": {
    sa.scroll(args[1] || "down", parseInt(args[2]) || 3);
    sa.sleepMs(200);
    var path = sa.captureScreen();
    console.log(path);
    break;
  }
  case "focus": {
    var ok = sa.focusChrome();
    console.log(ok ? "focused" : "not_found");
    break;
  }
  case "title": {
    console.log(sa.getWindowTitle());
    break;
  }
  case "mark": {
    // mark <x> <y> — take screenshot + crop, draw crosshair at (x,y), output both
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);
    var cropW = 400;
    var cropH = 300;
    var cropX = Math.max(0, Math.min(1920 - cropW, x - cropW / 2));
    var cropY = Math.max(0, Math.min(1200 - cropH, y - cropH / 2));
    var globalPath = sa.captureScreen();
    var focusPath = sa.captureRegion(cropX, cropY, cropW, cropH, "/tmp/aim-focus.png");
    var result = sa.markDual(globalPath, focusPath,
      { x: cropX, y: cropY, w: cropW, h: cropH }, x, y);
    console.log(JSON.stringify(result));
    break;
  }
  case "act-verify": {
    var action = JSON.parse(args[1]);
    var result = sa.executeAndVerify(action);
    console.log(JSON.stringify(result));
    break;
  }
  default:
    console.error("Unknown command: " + cmd);
    process.exit(1);
}
