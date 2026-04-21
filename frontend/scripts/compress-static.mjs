#!/usr/bin/env node
// Pre-compress .next/static/* with gzip and brotli so nginx's gzip_static/brotli_static
// serve the cached artifacts instead of compressing per request.
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const ROOT = '.next/static';
const EXT = new Set(['.js', '.css', '.json', '.svg', '.map', '.ico', '.txt', '.webmanifest']);
const MIN_SIZE = 1024;

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...await walk(p));
    else if (EXT.has(extname(name)) && s.size >= MIN_SIZE) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let gz = 0, br = 0, skipped = 0, savedGz = 0, savedBr = 0;

await Promise.all(files.map(async (path) => {
  const raw = await readFile(path);
  const [gzipped, brotlied] = await Promise.all([
    Promise.resolve(gzipSync(raw, { level: 9 })),
    Promise.resolve(brotliCompressSync(raw, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
    })),
  ]);
  if (gzipped.length < raw.length) {
    await writeFile(`${path}.gz`, gzipped);
    gz++; savedGz += raw.length - gzipped.length;
  }
  if (brotlied.length < raw.length) {
    await writeFile(`${path}.br`, brotlied);
    br++; savedBr += raw.length - brotlied.length;
  }
  if (gzipped.length >= raw.length && brotlied.length >= raw.length) skipped++;
}));

const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(`[compress-static] ${files.length} files · ${gz} gzipped (-${mb(savedGz)} MB) · ${br} brotlied (-${mb(savedBr)} MB) · ${skipped} skipped`);
