#!/usr/bin/env node
// Generates blizzard wind + snow footstep WAV files for short-04

import { writeFileSync } from "fs";

const SAMPLE_RATE = 44100;
const DURATION = 25; // seconds (slightly longer than 24s video)
const NUM_SAMPLES = SAMPLE_RATE * DURATION;

// --- WAV file writer ---
function writeWav(filename, samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  writeFileSync(filename, buffer);
  console.log(`Written: ${filename} (${(dataSize / 1024).toFixed(0)} KB, ${DURATION}s)`);
}

// --- Simple IIR bandpass filter ---
function bandpass(samples, centerFreq, Q, sampleRate) {
  const w0 = (2 * Math.PI * centerFreq) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;

  const out = new Float64Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    out[i] = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x;
    y2 = y1; y1 = out[i];
  }
  return out;
}

// --- Low-pass filter ---
function lowpass(samples, cutoff, Q, sampleRate) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const b0 = (1 - cosw0) / 2;
  const b1 = 1 - cosw0;
  const b2 = (1 - cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  const out = new Float64Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    out[i] = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x;
    y2 = y1; y1 = out[i];
  }
  return out;
}

// ======================================================================
// 1. BLIZZARD WIND
// ======================================================================
console.log("Generating blizzard wind...");

// White noise
const noise = new Float64Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  noise[i] = Math.random() * 2 - 1;
}

// Layer 1: Low howling wind (200-600 Hz band)
let wind1 = bandpass(noise, 350, 0.6, SAMPLE_RATE);
wind1 = lowpass(wind1, 800, 0.7, SAMPLE_RATE);

// Layer 2: Mid whistle (600-1200 Hz)
const noise2 = new Float64Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) noise2[i] = Math.random() * 2 - 1;
let wind2 = bandpass(noise2, 900, 0.8, SAMPLE_RATE);

// Layer 3: High hiss (1500-4000 Hz) — snow/ice texture
const noise3 = new Float64Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) noise3[i] = Math.random() * 2 - 1;
let wind3 = bandpass(noise3, 2500, 0.5, SAMPLE_RATE);

// LFO modulation — wind gusts
const windOut = new Float64Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  // Slow gusting LFO
  const gust = 0.5 + 0.3 * Math.sin(t * 0.4) + 0.2 * Math.sin(t * 0.17 + 1.3);
  // Faster variation
  const variation = 0.8 + 0.2 * Math.sin(t * 1.7 + 0.5);

  windOut[i] =
    wind1[i] * 0.6 * gust +
    wind2[i] * 0.25 * variation * gust +
    wind3[i] * 0.15 * gust;
}

// Normalize
let maxWind = 0;
for (let i = 0; i < NUM_SAMPLES; i++) maxWind = Math.max(maxWind, Math.abs(windOut[i]));
for (let i = 0; i < NUM_SAMPLES; i++) windOut[i] = (windOut[i] / maxWind) * 0.85;

// Fade in/out (1s each)
const fadeLen = SAMPLE_RATE;
for (let i = 0; i < fadeLen; i++) {
  const f = i / fadeLen;
  windOut[i] *= f;
  windOut[NUM_SAMPLES - 1 - i] *= f;
}

writeWav("public/shorts/short-04/sfx-blizzard-wind.wav", windOut);

// ======================================================================
// 2. SNOW FOOTSTEPS
// ======================================================================
console.log("Generating snow footsteps...");

const footOut = new Float64Array(NUM_SAMPLES);

// Walk cycle: ~1.1 steps per second (matching CHARACTER_SPEED = 12 with walk animation)
const STEP_INTERVAL = 0.45; // seconds between steps
const STEP_DURATION = 0.15; // crunch duration
const START_DELAY = 1.0; // match walk start delay

for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  const walkTime = t - START_DELAY;

  if (walkTime < 0) continue;

  const stepPhase = walkTime % STEP_INTERVAL;

  if (stepPhase < STEP_DURATION) {
    // Snow crunch: filtered noise burst with envelope
    const env =
      (stepPhase < 0.02 ? stepPhase / 0.02 : 1.0) * // attack
      (1.0 - stepPhase / STEP_DURATION); // decay

    // Crunch noise (pink-ish, low-mid frequencies)
    const crunch =
      (Math.random() * 2 - 1) * 0.5 +
      Math.sin(stepPhase * 3000 + Math.random() * 0.5) * 0.3 +
      Math.sin(stepPhase * 800) * 0.2;

    footOut[i] = crunch * env * env * 0.7;
  }
}

// Low-pass filter the footsteps for a muffled snow crunch
const footFiltered = lowpass(footOut, 2000, 0.7, SAMPLE_RATE);

// Normalize
let maxFoot = 0;
for (let i = 0; i < NUM_SAMPLES; i++) maxFoot = Math.max(maxFoot, Math.abs(footFiltered[i]));
if (maxFoot > 0) {
  for (let i = 0; i < NUM_SAMPLES; i++) footFiltered[i] = (footFiltered[i] / maxFoot) * 0.75;
}

// Fade in/out
for (let i = 0; i < fadeLen; i++) {
  const f = i / fadeLen;
  footFiltered[i] *= f;
  footFiltered[NUM_SAMPLES - 1 - i] *= f;
}

writeWav("public/shorts/short-04/sfx-snow-footsteps.wav", footFiltered);

console.log("Done!");
