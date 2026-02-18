#!/usr/bin/env node
/**
 * sector-overlay.js — Grid overlay with readable cell labels
 *
 * Uses letter-number system (A1, B2, etc.) like a spreadsheet.
 * Large readable labels. Dense grid for precision.
 */

const { execSync } = require("child_process");

const SCREEN_W = 1920;
const SCREEN_H = 1200;

function exec(cmd) {
  return execSync(cmd, { stdio: ["pipe", "pipe", "pipe"], timeout: 20000 });
}

/**
 * Generate column letter (A-Z, then AA, AB...)
 */
function colLetter(c) {
  if (c < 26) return String.fromCharCode(65 + c);
  return String.fromCharCode(65 + Math.floor(c / 26) - 1) + String.fromCharCode(65 + (c % 26));
}

/**
 * Add grid with big readable cell IDs + coordinate tick marks.
 *
 * Default: 12x8 grid = 160px x 150px cells
 * Each cell gets a label like "A1" in big text + pixel range below
 */
function addSectors(inputPath, outputPath, cols, rows) {
  cols = cols || 12;
  rows = rows || 8;

  var cellW = Math.floor(SCREEN_W / cols);
  var cellH = Math.floor(SCREEN_H / rows);

  var cmd = "convert " + inputPath;

  // Grid lines - visible but not overpowering
  cmd += " -fill none -stroke 'rgba(255,50,50,0.5)' -strokewidth 1";
  for (var c = 0; c <= cols; c++) {
    var x = Math.min(c * cellW, SCREEN_W - 1);
    cmd += " -draw 'line " + x + ",0 " + x + "," + (SCREEN_H - 1) + "'";
  }
  for (var r = 0; r <= rows; r++) {
    var y = Math.min(r * cellH, SCREEN_H - 1);
    cmd += " -draw 'line 0," + y + " " + (SCREEN_W - 1) + "," + y + "'";
  }

  // Cell labels - BIG readable text
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cx = c * cellW + cellW / 2;
      var cy = r * cellH + cellH / 2;

      var cellId = colLetter(c) + (r + 1);
      var x1 = c * cellW;
      var y1 = r * cellH;

      // Background pill for label
      var bgW = 32;
      var bgH = 18;
      cmd += " -fill 'rgba(0,0,0,0.55)' -stroke none";
      cmd += " -draw 'roundrectangle " + (cx - bgW) + "," + (cy - bgH) + " " + (cx + bgW) + "," + (cy + bgH) + " 4,4'";

      // Big cell ID
      cmd += " -fill 'rgba(255,255,0,1)' -stroke none -pointsize 22 -gravity NorthWest";
      var labelW = cellId.length * 13;
      cmd += " -annotate +" + (cx - labelW / 2) + "+" + (cy - 12) + " '" + cellId + "'";

      // Small coordinate below
      cmd += " -fill 'rgba(200,200,255,0.9)' -pointsize 9";
      var coordStr = x1 + "," + y1;
      var coordW = coordStr.length * 5;
      cmd += " -annotate +" + (cx - coordW / 2) + "+" + (cy + 6) + " '" + coordStr + "'";
    }
  }

  // Edge tick marks with pixel values (every cell boundary)
  cmd += " -fill 'rgba(255,255,100,1)' -stroke none -pointsize 11";
  // Top edge
  for (var c = 0; c <= cols; c++) {
    var x = c * cellW;
    cmd += " -annotate +" + (x + 2) + "+10 '" + x + "'";
  }
  // Left edge
  for (var r = 0; r <= rows; r++) {
    var y = r * cellH;
    if (y + 11 < SCREEN_H) {
      cmd += " -annotate +2+" + (y + 11) + " '" + y + "'";
    }
  }

  cmd += " " + outputPath;
  exec(cmd);

  // Return cell mapping for coordinate calculation
  var cells = {};
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var id = colLetter(c) + (r + 1);
      cells[id] = {
        x1: c * cellW,
        y1: r * cellH,
        x2: (c + 1) * cellW,
        y2: (r + 1) * cellH,
        cx: c * cellW + cellW / 2,
        cy: r * cellH + cellH / 2
      };
    }
  }
  return { path: outputPath, cells: cells, cellW: cellW, cellH: cellH };
}

/**
 * Sub-sector: zoom into a cell, subdivide with coordinates
 */
function addSubSectors(inputPath, outputPath, cellId, cols, rows) {
  cols = cols || 12;
  rows = rows || 8;

  var cellW = Math.floor(SCREEN_W / cols);
  var cellH = Math.floor(SCREEN_H / rows);

  // Parse cell ID like "F3" -> col=5, row=2
  var col = 0;
  var rowStr = "";
  for (var i = 0; i < cellId.length; i++) {
    var ch = cellId.charCodeAt(i);
    if (ch >= 65 && ch <= 90) {
      col = col * 26 + (ch - 64);
    } else {
      rowStr = cellId.substring(i);
      break;
    }
  }
  col -= 1; // 0-indexed
  var row = parseInt(rowStr) - 1;

  var x1 = col * cellW;
  var y1 = row * cellH;

  // Crop and scale 3x for more detail
  var scale = 3;
  exec("convert " + inputPath +
    " -crop " + cellW + "x" + cellH + "+" + x1 + "+" + y1 +
    " -resize " + (cellW * scale) + "x" + (cellH * scale) +
    " /tmp/aim-sector-crop.png");

  var sw = cellW * scale;
  var sh = cellH * scale;

  // Sub-grid: 4x4 within the cell
  var subC = 4, subR = 4;
  var subW = Math.floor(sw / subC);
  var subH = Math.floor(sh / subR);

  var cmd = "convert /tmp/aim-sector-crop.png";
  cmd += " -fill none -stroke 'rgba(0,255,0,0.6)' -strokewidth 1";

  for (var c = 0; c <= subC; c++) {
    var x = Math.min(c * subW, sw - 1);
    cmd += " -draw 'line " + x + ",0 " + x + "," + (sh - 1) + "'";
  }
  for (var r = 0; r <= subR; r++) {
    var y = Math.min(r * subH, sh - 1);
    cmd += " -draw 'line 0," + y + " " + (sw - 1) + "," + y + "'";
  }

  // Labels: screen coordinates at each intersection
  cmd += " -font Courier -pointsize 14 -fill 'rgba(0,255,0,1)' -stroke 'rgba(0,0,0,0.5)' -strokewidth 1";
  for (var r = 0; r <= subR; r++) {
    for (var c = 0; c <= subC; c++) {
      var screenX = Math.round(x1 + (c * subW) / scale);
      var screenY = Math.round(y1 + (r * subH) / scale);
      var lx = c * subW + 3;
      var ly = r * subH + 14;
      if (lx + 80 > sw) lx = c * subW - 80;
      if (ly > sh - 4) ly = r * subH - 4;
      cmd += " -annotate +" + lx + "+" + ly + " '" + screenX + "," + screenY + "'";
    }
  }

  cmd += " " + outputPath;
  exec(cmd);

  return {
    path: outputPath,
    cellId: cellId,
    screenRegion: { x1: x1, y1: y1, x2: x1 + cellW, y2: y1 + cellH }
  };
}

// CLI
if (require.main === module) {
  var args = process.argv.slice(2);
  var input = args[0] || "/tmp/aim-screen.png";
  var output = args[1] || "/tmp/aim-sectors.png";

  if (args[2] === "sub") {
    var cellId = args[3] || "A1";
    var result = addSubSectors(input, output, cellId);
    console.log("Sub-grid for cell " + cellId + " saved to: " + output);
    console.log("Region: " + JSON.stringify(result.screenRegion));
  } else {
    var cols = 12;
    var rows = 8;
    if (args[2]) {
      var parts = args[2].split("x");
      cols = parseInt(parts[0]);
      rows = parseInt(parts[1]);
    }
    var result = addSectors(input, output, cols, rows);
    console.log(cols + "x" + rows + " grid (" + colLetter(0) + "1-" + colLetter(cols - 1) + rows + ") saved to: " + output);
  }
}

module.exports = { addSectors, addSubSectors, colLetter };
