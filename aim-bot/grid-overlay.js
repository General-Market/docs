#!/usr/bin/env node
/**
 * grid-overlay.js — Add coordinate grid overlay to screenshots
 *
 * Implements the GridGPT technique: overlays a numbered grid on screenshots
 * so vision models can reference grid cells for precise coordinate mapping.
 *
 * Usage: node grid-overlay.js [input] [output] [gridSize]
 *   input:    path to screenshot (default: /tmp/aim-screen.png)
 *   output:   path to output (default: /tmp/aim-grid.png)
 *   gridSize: NxM grid (default: 12x8)
 */

const { execSync } = require("child_process");

const SCREEN_W = 1920;
const SCREEN_H = 1200;

function exec(cmd) {
  return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 });
}

/**
 * Add a coordinate grid overlay to a screenshot.
 * Grid lines are drawn with labels showing pixel coordinates.
 * Also adds tick marks every 100px.
 *
 * @param {string} inputPath - path to input screenshot
 * @param {string} outputPath - path to output with grid
 * @param {number} cols - number of grid columns (default 12)
 * @param {number} rows - number of grid rows (default 8)
 */
function addGrid(inputPath, outputPath, cols, rows) {
  cols = cols || 12;
  rows = rows || 8;
  inputPath = inputPath || "/tmp/aim-screen.png";
  outputPath = outputPath || "/tmp/aim-grid.png";

  var cellW = Math.floor(SCREEN_W / cols);
  var cellH = Math.floor(SCREEN_H / rows);

  var drawCmds = [];

  // Draw vertical grid lines
  for (var c = 0; c <= cols; c++) {
    var x = Math.min(c * cellW, SCREEN_W - 1);
    drawCmds.push("line " + x + ",0 " + x + "," + (SCREEN_H - 1));
  }

  // Draw horizontal grid lines
  for (var r = 0; r <= rows; r++) {
    var y = Math.min(r * cellH, SCREEN_H - 1);
    drawCmds.push("line 0," + y + " " + (SCREEN_W - 1) + "," + y);
  }

  // Build the ImageMagick command
  var cmd = "convert " + inputPath;

  // Draw grid lines (semi-transparent red)
  cmd += " -fill none -stroke 'rgba(255,0,0,0.4)' -strokewidth 1";
  for (var d = 0; d < drawCmds.length; d++) {
    cmd += " -draw '" + drawCmds[d] + "'";
  }

  // Add cell labels with coordinates
  cmd += " -fill 'rgba(255,255,0,0.9)' -stroke 'rgba(0,0,0,0.7)' -strokewidth 1 -pointsize 14 -font Courier";
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cx = c * cellW + 3;
      var cy = r * cellH + 14;
      var label = c * cellW + "," + r * cellH;
      cmd += " -annotate +" + cx + "+" + cy + " '" + label + "'";
    }
  }

  // Add pixel-scale tick marks along edges (every 200px)
  cmd += " -fill 'rgba(255,255,0,1)' -stroke none -pointsize 11";
  for (var px = 0; px < SCREEN_W; px += 200) {
    cmd += " -annotate +" + px + "+11 '" + px + "'";
    cmd += " -annotate +" + px + "+" + (SCREEN_H - 2) + " '" + px + "'";
  }
  for (var py = 0; py < SCREEN_H; py += 200) {
    cmd += " -annotate +2+" + (py + 11) + " '" + py + "'";
  }

  cmd += " " + outputPath;
  exec(cmd);
  return outputPath;
}

/**
 * Add grid overlay + downscale to 1024x768 (Anthropic recommended)
 */
function addGridDownscaled(inputPath, outputPath, cols, rows) {
  var gridPath = "/tmp/aim-grid-full.png";
  addGrid(inputPath, gridPath, cols, rows);
  outputPath = outputPath || "/tmp/aim-grid-sm.png";
  exec("convert " + gridPath + " -resize 1024x768! " + outputPath);
  return outputPath;
}

// CLI
if (require.main === module) {
  var args = process.argv.slice(2);
  var input = args[0] || "/tmp/aim-screen.png";
  var output = args[1] || "/tmp/aim-grid.png";
  var gridSize = (args[2] || "12x8").split("x");
  var cols = parseInt(gridSize[0]);
  var rows = parseInt(gridSize[1]);

  console.log("Adding " + cols + "x" + rows + " grid to " + input);
  addGrid(input, output, cols, rows);
  console.log("Grid overlay saved to: " + output);

  // Also create downscaled version
  var smPath = addGridDownscaled(input, "/tmp/aim-grid-sm.png", cols, rows);
  console.log("Downscaled (1024x768) saved to: " + smPath);
}

module.exports = { addGrid, addGridDownscaled };
