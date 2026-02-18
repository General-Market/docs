#!/usr/bin/env node
/**
 * aim-loop.js — Full automated aim game orchestrator
 *
 * All commands produce gridded screenshots by default.
 * Supports zoom for precision and text reading.
 *
 * Commands:
 *   scan           - Full screenshot + grid + zoom on Remaining text
 *   zoom <cell>    - Sub-sector zoom into a specific cell (e.g. "F3")
 *   zoomxy <x> <y> - Zoom around a point (400x300 crop, 2x scale)
 *   click <x> <y>  - Click + verify (post-click grid + zoom Remaining)
 *   mark <x> <y>   - Mark point on grid + focused crop
 *   start          - Click the start target (center of game area)
 */

const sa = require("./screen-aware");
const sectors = require("./sector-overlay");
const screenshot = require("./screenshot");
const { execSync } = require("child_process");

const GRID_COLS = 12;
const GRID_ROWS = 8;

var args = process.argv.slice(2);
var cmd = args[0];

/**
 * Apply grid to a screenshot
 */
function applyGrid(path, outPath) {
  outPath = outPath || "/tmp/aim-grid.png";
  sectors.addSectors(path, outPath, GRID_COLS, GRID_ROWS);
  return outPath;
}

/**
 * Zoom into the "Remaining" text area to read the count.
 * The game header with "Remaining XX" is in the blue area at the top.
 */
function zoomRemaining(path) {
  // The "Remaining" text is at the top of the blue game area
  // Blue area starts around y=155, text is centered at ~y=180
  var outPath = "/tmp/aim-remaining.png";
  execSync("convert " + path +
    " -crop 400x50+560+165" +
    " -resize 800x100" +
    " " + outPath,
    { stdio: ["pipe", "pipe", "pipe"], timeout: 5000 }
  );
  return outPath;
}

/**
 * Zoom into an arbitrary area (crop + 2x scale)
 */
function zoomArea(path, cx, cy, w, h, outPath) {
  w = w || 400;
  h = h || 300;
  outPath = outPath || "/tmp/aim-zoom.png";
  var cropX = Math.max(0, Math.min(1920 - w, cx - w / 2));
  var cropY = Math.max(0, Math.min(1200 - h, cy - h / 2));
  execSync("convert " + path +
    " -crop " + w + "x" + h + "+" + cropX + "+" + cropY +
    " -resize " + (w * 2) + "x" + (h * 2) +
    " " + outPath,
    { stdio: ["pipe", "pipe", "pipe"], timeout: 5000 }
  );
  return outPath;
}

switch (cmd) {
  case "scan": {
    // Full analysis: screenshot + grid + zoom remaining
    var path = sa.captureScreen();
    var gridPath = applyGrid(path);
    var remPath = zoomRemaining(path);
    console.log(JSON.stringify({
      screenshot: path,
      grid: gridPath,
      remaining_zoom: remPath
    }));
    break;
  }

  case "zoom": {
    // Sub-sector zoom into a cell ID (e.g. "F3")
    var cellId = args[1] || "A1";
    var path = sa.captureScreen();
    var result = sectors.addSubSectors(path, "/tmp/aim-subsectors.png", cellId, GRID_COLS, GRID_ROWS);
    console.log(JSON.stringify({
      subsectors: "/tmp/aim-subsectors.png",
      cell: cellId,
      region: result.screenRegion
    }));
    break;
  }

  case "zoomxy": {
    // Zoom around a specific point
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);
    var path = sa.captureScreen();
    var zoomPath = zoomArea(path, x, y);
    console.log(JSON.stringify({
      screenshot: path,
      zoom: zoomPath,
      center: { x: x, y: y }
    }));
    break;
  }

  case "click": {
    // Click + full verification scan
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);

    // Click with human movement
    sa.clickAt(x, y);
    sa.sleepMs(200);

    // Post-click scan
    var path = sa.captureScreen();
    var gridPath = applyGrid(path);
    var remPath = zoomRemaining(path);

    // Also zoom into where we clicked to see what happened
    var clickZoom = zoomArea(path, x, y, 300, 300, "/tmp/aim-click-zoom.png");

    console.log(JSON.stringify({
      clicked: { x: x, y: y },
      screenshot: path,
      grid: gridPath,
      remaining_zoom: remPath,
      click_zoom: clickZoom
    }));
    break;
  }

  case "mark": {
    // Mark a point with grid overlay + focused crop
    var x = parseInt(args[1]);
    var y = parseInt(args[2]);

    var path = sa.captureScreen();

    // Mark on screenshot then apply grid
    sa.markPoint(path, x, y, "/tmp/aim-marked.png");
    var gridPath = applyGrid("/tmp/aim-marked.png", "/tmp/aim-marked-grid.png");

    // Focused crop with mark (no grid, for detail)
    var cropW = 400, cropH = 300;
    var cropX = Math.max(0, Math.min(1520, x - cropW / 2));
    var cropY = Math.max(0, Math.min(900, y - cropH / 2));
    sa.captureRegion(cropX, cropY, cropW, cropH, "/tmp/aim-focus.png");
    sa.markPoint("/tmp/aim-focus.png", x - cropX, y - cropY, "/tmp/aim-marked-focus.png");

    console.log(JSON.stringify({
      grid: gridPath,
      focus: "/tmp/aim-marked-focus.png",
      point: { x: x, y: y }
    }));
    break;
  }

  case "start": {
    // Click center of game area to start
    sa.clickAt(950, 500);
    sa.sleepMs(500);
    var path = sa.captureScreen();
    var gridPath = applyGrid(path);
    var remPath = zoomRemaining(path);
    console.log(JSON.stringify({
      screenshot: path,
      grid: gridPath,
      remaining_zoom: remPath
    }));
    break;
  }

  default:
    console.error("Commands: scan, zoom <cell>, zoomxy <x> <y>, click <x> <y>, mark <x> <y>, start");
    process.exit(1);
}
