/**
 * screenshot.js — Fast screenshot capture pipeline for aim training bot
 *
 * Benchmark results on this VPS (Ubuntu 24.04, Xvfb :1, 1920x1200):
 *   scrot -> PNG:      ~190ms  (best for direct PNG output)
 *   import -> BMP:     ~145ms  (fastest raw capture, use for crop pipelines)
 *   import -> BMP+PNG: ~280ms  (too slow for direct PNG)
 *   xwd + convert:     ~320ms  (slowest)
 *
 * Strategy:
 *   - captureFullScreen: scrot -> PNG (~190ms, under 200ms target)
 *   - crop/zoom: import -> BMP (~145ms) then convert crop+zoom -> PNG (~80ms)
 *   - All files written to /tmp for speed
 */

const { execSync } = require('child_process');
const fs = require('fs');

const DISPLAY = ':1';
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1200;
const DEFAULT_ZOOM_RADIUS = 150;

const FULL_BMP_PATH = '/tmp/aim-screen.bmp';
const FULL_PNG_PATH = '/tmp/aim-screen.png';
const ZOOM_PATH = '/tmp/aim-zoom.png';

const ENV = Object.assign({}, process.env, { DISPLAY: DISPLAY });

/**
 * Execute a shell command with DISPLAY set.
 */
function exec(cmd) {
  return execSync(cmd, {
    env: ENV,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000,
  });
}

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * captureFullScreen()
 *
 * Takes a full screenshot of display :1.
 * Uses scrot for direct PNG output (~190ms, fastest path to PNG).
 * Saves to /tmp/aim-screen.png
 * Target: < 200ms
 *
 * @returns {string} Absolute path to the PNG screenshot
 */
function captureFullScreen() {
  try {
    // Primary: scrot is fastest for direct-to-PNG (~190ms)
    exec('scrot -o ' + FULL_PNG_PATH);
  } catch (e) {
    // Fallback: import -> BMP -> convert -> PNG
    try {
      exec('import -window root ' + FULL_BMP_PATH);
      exec('convert ' + FULL_BMP_PATH + ' -define png:compression-level=1 ' + FULL_PNG_PATH);
    } catch (e2) {
      throw new Error('All screenshot methods failed. scrot: ' + e.message + ', import: ' + e2.message);
    }
  }

  return FULL_PNG_PATH;
}

/**
 * captureZoomed(centerX, centerY, radius)
 *
 * Captures full screen, crops a (radius*2 x radius*2) region centered at
 * (centerX, centerY), then scales 2x for precision.
 *
 * Uses import->BMP for fast raw capture (~145ms), then convert for
 * crop+zoom+PNG in one pass (~80ms). Total: ~225ms.
 *
 * @param {number} centerX - X coordinate of the center point
 * @param {number} centerY - Y coordinate of the center point
 * @param {number} [radius=150] - Half-width of crop region (default 150: 300x300 crop -> 600x600 output)
 * @returns {string} Absolute path to the zoomed screenshot
 */
function captureZoomed(centerX, centerY, radius) {
  if (radius === undefined) radius = DEFAULT_ZOOM_RADIUS;

  // Use import->BMP for fast raw capture; crop+zoom via convert
  var source;
  try {
    exec('import -window root ' + FULL_BMP_PATH);
    source = FULL_BMP_PATH;
  } catch (e) {
    // Fallback: scrot to PNG, then crop from that
    exec('scrot -o ' + FULL_PNG_PATH);
    source = FULL_PNG_PATH;
  }

  return _cropAndZoom(source, centerX, centerY, radius);
}

/**
 * Internal: crop and zoom from an existing screenshot file.
 */
function _cropAndZoom(sourcePath, centerX, centerY, radius) {
  if (radius === undefined) radius = DEFAULT_ZOOM_RADIUS;

  var diameter = radius * 2;

  // Calculate crop origin, clamping to screen bounds
  var cropX = clamp(Math.round(centerX - radius), 0, SCREEN_WIDTH - diameter);
  var cropY = clamp(Math.round(centerY - radius), 0, SCREEN_HEIGHT - diameter);

  var cropW = diameter;
  var cropH = diameter;
  var outW = cropW * 2;
  var outH = cropH * 2;

  var cmd = 'convert ' + sourcePath +
    ' -crop ' + cropW + 'x' + cropH + '+' + cropX + '+' + cropY +
    ' -resize ' + outW + 'x' + outH +
    ' -define png:compression-level=1 ' + ZOOM_PATH;

  exec(cmd);

  return ZOOM_PATH;
}

/**
 * captureForAim()
 *
 * Combined capture: takes full screenshot for initial detection.
 * Returns zoomPath as null (to be populated later after target detection).
 *
 * @returns {{ fullPath: string, zoomPath: string|null }}
 */
function captureForAim() {
  var fullPath = captureFullScreen();
  return {
    fullPath: fullPath,
    zoomPath: null,
  };
}

/**
 * captureZoomAt(centerX, centerY)
 *
 * Quick capture: takes full screenshot and immediately crops+zooms
 * around the specified coordinate. Optimized pipeline:
 *   1. import -> BMP (raw capture, ~145ms)
 *   2. convert BMP -> crop+zoom -> PNG (zoom output, ~80ms)
 *   3. convert BMP -> PNG (full output, ~130ms) — runs after zoom
 *
 * Total: ~355ms for both outputs. For just the zoom, ~225ms.
 *
 * @param {number} centerX - X coordinate to zoom into
 * @param {number} centerY - Y coordinate to zoom into
 * @returns {{ fullPath: string, zoomPath: string }}
 */
function captureZoomAt(centerX, centerY) {
  // Capture full screen to BMP (fast raw capture)
  var source;
  try {
    exec('import -window root ' + FULL_BMP_PATH);
    source = FULL_BMP_PATH;
  } catch (e) {
    exec('scrot -o ' + FULL_PNG_PATH);
    source = FULL_PNG_PATH;
  }

  // Crop and zoom first (higher priority)
  var zoomPath = _cropAndZoom(source, centerX, centerY, DEFAULT_ZOOM_RADIUS);

  // Also produce full PNG
  if (source === FULL_BMP_PATH) {
    exec('convert ' + FULL_BMP_PATH + ' -define png:compression-level=1 ' + FULL_PNG_PATH);
  }

  return {
    fullPath: FULL_PNG_PATH,
    zoomPath: zoomPath,
  };
}

/**
 * benchmark()
 *
 * Benchmarks all screenshot methods and prints results.
 */
function benchmark() {
  console.log('=== Screenshot Pipeline Benchmark ===\n');

  var methods = [
    {
      name: 'scrot -> PNG (primary for captureFullScreen)',
      fn: function() { exec('scrot -o ' + FULL_PNG_PATH); },
    },
    {
      name: 'import -> BMP (primary raw capture)',
      fn: function() { exec('import -window root ' + FULL_BMP_PATH); },
    },
    {
      name: 'import -> BMP + convert -> PNG (full pipeline)',
      fn: function() {
        exec('import -window root ' + FULL_BMP_PATH);
        exec('convert ' + FULL_BMP_PATH + ' -define png:compression-level=1 ' + FULL_PNG_PATH);
      },
    },
    {
      name: 'import -> BMP + crop+zoom -> PNG (zoom pipeline)',
      fn: function() {
        exec('import -window root ' + FULL_BMP_PATH);
        exec('convert ' + FULL_BMP_PATH + ' -crop 300x300+810+450 -resize 600x600 -define png:compression-level=1 ' + ZOOM_PATH);
      },
    },
  ];

  for (var m = 0; m < methods.length; m++) {
    var method = methods[m];
    var times = [];
    for (var i = 0; i < 3; i++) {
      var start = Date.now();
      method.fn();
      times.push(Date.now() - start);
    }
    var sum = 0;
    for (var j = 0; j < times.length; j++) sum += times[j];
    var avg = Math.round(sum / times.length);
    var min = Math.min.apply(null, times);
    var max = Math.max.apply(null, times);
    console.log('  ' + method.name);
    console.log('    runs: ' + times.map(function(t) { return t + 'ms'; }).join(', ') +
      '  avg: ' + avg + 'ms  min: ' + min + 'ms  max: ' + max + 'ms\n');
  }
}

module.exports = {
  captureFullScreen: captureFullScreen,
  captureZoomed: captureZoomed,
  captureForAim: captureForAim,
  captureZoomAt: captureZoomAt,
  benchmark: benchmark,
  FULL_BMP_PATH: FULL_BMP_PATH,
  FULL_PNG_PATH: FULL_PNG_PATH,
  ZOOM_PATH: ZOOM_PATH,
  DEFAULT_ZOOM_RADIUS: DEFAULT_ZOOM_RADIUS,
};

// Run tests if executed directly
if (require.main === module) {
  console.log('Screenshot Pipeline - Test & Benchmark\n');
  console.log('Display: ' + DISPLAY);
  console.log('Screen: ' + SCREEN_WIDTH + 'x' + SCREEN_HEIGHT + '\n');

  // Test 1: Full screenshot
  console.log('--- Test 1: captureFullScreen() ---');
  var t1 = Date.now();
  var fullPath = captureFullScreen();
  var d1 = Date.now() - t1;
  var fullStats = fs.statSync(fullPath);
  console.log('  Path: ' + fullPath);
  console.log('  Time: ' + d1 + 'ms');
  console.log('  Size: ' + (fullStats.size / 1024).toFixed(1) + ' KB');
  console.log('  Result: ' + (d1 < 200 ? 'PASS (< 200ms)' : d1 < 250 ? 'OK (< 250ms)' : 'SLOW (>= 250ms)') + '\n');

  // Test 2: Zoomed screenshot at center
  console.log('--- Test 2: captureZoomed(960, 600) ---');
  var t2 = Date.now();
  var zoomResult = captureZoomed(960, 600);
  var d2 = Date.now() - t2;
  var zoomStats = fs.statSync(zoomResult);
  console.log('  Path: ' + zoomResult);
  console.log('  Time: ' + d2 + 'ms');
  console.log('  Size: ' + (zoomStats.size / 1024).toFixed(1) + ' KB');
  console.log('  Result: ' + (d2 < 300 ? 'PASS (< 300ms)' : 'SLOW (>= 300ms)') + '\n');

  // Test 3: captureForAim
  console.log('--- Test 3: captureForAim() ---');
  var t3 = Date.now();
  var aimResult = captureForAim();
  var d3 = Date.now() - t3;
  console.log('  fullPath: ' + aimResult.fullPath);
  console.log('  zoomPath: ' + aimResult.zoomPath);
  console.log('  Time: ' + d3 + 'ms\n');

  // Test 4: captureZoomAt
  console.log('--- Test 4: captureZoomAt(960, 600) ---');
  var t4 = Date.now();
  var zoomAtResult = captureZoomAt(960, 600);
  var d4 = Date.now() - t4;
  console.log('  fullPath: ' + zoomAtResult.fullPath);
  console.log('  zoomPath: ' + zoomAtResult.zoomPath);
  console.log('  Time: ' + d4 + 'ms\n');

  // Verify files exist
  console.log('--- File Verification ---');
  var checkPaths = [FULL_PNG_PATH, ZOOM_PATH, FULL_BMP_PATH];
  for (var k = 0; k < checkPaths.length; k++) {
    var p = checkPaths[k];
    var exists = fs.existsSync(p);
    var size = exists ? fs.statSync(p).size : 0;
    console.log('  ' + p + ': ' + (exists ? 'EXISTS' : 'MISSING') + ' (' + (size / 1024).toFixed(1) + ' KB)');
  }

  console.log('\n--- Full Benchmark (3 runs each) ---');
  benchmark();
}
