#!/usr/bin/env node
/* Download every imageUrl in the sources.json so Remotion renders against
   local files instead of flaky third-party CDNs. Rewrites imageUrl in place
   to point at staticFile-resolvable paths under public/scene-images/. */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_PATH = path.resolve(
  __dirname,
  '../src/compositions/replicates/rainbows-pitch/data/sources.json',
);
const OUT_DIR = path.resolve(__dirname, '../public/scene-images');

function extFromContentType(ct, fallback) {
  if (!ct) return fallback;
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('svg')) return 'svg';
  return fallback;
}

async function downloadOne(url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  let extGuess = path.extname(new URL(url).pathname).replace('.', '').toLowerCase();
  if (!extGuess || extGuess.length > 5) extGuess = 'jpg';
  // Quick HEAD to lock in content-type
  let r;
  try {
    r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 RainbowsPitchPrefetch/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { ok: false, err: err.message };
  }
  if (!r.ok) return { ok: false, err: `HTTP ${r.status}` };
  const ext = extFromContentType(r.headers.get('content-type'), extGuess);
  const filename = `${hash}.${ext}`;
  const target = path.join(OUT_DIR, filename);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(target, buf);
  return { ok: true, localPath: `scene-images/${filename}`, bytes: buf.length };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const data = JSON.parse(await fs.readFile(JSON_PATH, 'utf8'));
  const dl = new Map(); // url → result
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [src, payload] of Object.entries(data.sources)) {
    for (const m of payload.topMarkets ?? []) {
      const url = m.imageUrl;
      if (!url) continue;
      if (url.startsWith('scene-images/')) {
        skipped++;
        continue;
      }
      if (!dl.has(url)) {
        process.stdout.write(`  ${src}/${m.symbol}…`);
        const res = await downloadOne(url);
        dl.set(url, res);
        if (res.ok) {
          downloaded++;
          console.log(` ✓ ${res.bytes}B → ${res.localPath}`);
        } else {
          failed++;
          console.log(` ✗ ${res.err}`);
        }
      }
      const res = dl.get(url);
      m.imageUrl = res?.ok ? res.localPath : null;
    }
  }

  await fs.writeFile(JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`\nDownloaded ${downloaded}, kept-local ${skipped}, failed ${failed}.`);
  console.log(`Updated ${JSON_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
