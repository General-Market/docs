#!/usr/bin/env node
// Fetch protocol logos from DefiLlama into the reel logo folder.
//
//   node scripts/fetch-defillama-logos.mjs tornado-cash railgun zama ...
//
// Each argument is a DefiLlama slug AND the row id you'll use in the dataset.
// Files land at public/defi-flows/logos/<slug>.jpg. Already-present logos are
// skipped unless you pass --force. Pass --dir <path> to target another folder
// (e.g. lending-curators/logos).

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");
const UA = { "User-Agent": "Mozilla/5.0" };

const args = process.argv.slice(2);
const force = args.includes("--force");
const dirIdx = args.indexOf("--dir");
const subdir = dirIdx >= 0 ? args[dirIdx + 1] : "defi-flows/logos";
const dirValIdx = dirIdx >= 0 ? dirIdx + 1 : -1;
const slugs = args.filter((a, i) => !a.startsWith("--") && i !== dirValIdx);

if (slugs.length === 0) {
  console.error("usage: node scripts/fetch-defillama-logos.mjs <slug>... [--dir <subdir>] [--force]");
  process.exit(1);
}

const outDir = join(PUBLIC, subdir);
await mkdir(outDir, { recursive: true });

const exists = async (p) => {
  try { await access(p); return true; } catch { return false; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
const failed = [];
for (const slug of slugs) {
  const out = join(outDir, `${slug}.jpg`);
  if (!force && (await exists(out))) { console.log(`· ${slug} (already present)`); ok++; continue; }
  let logo = "";
  for (let attempt = 0; attempt < 4 && !logo; attempt++) {
    try {
      const r = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`, { headers: UA });
      if (r.ok) logo = (await r.json()).logo || "";
    } catch { /* retry */ }
    if (!logo) await sleep(700);
  }
  if (!logo) { console.log(`✗ ${slug} (no logo)`); failed.push(slug); continue; }
  try {
    const img = await fetch(logo, { headers: UA });
    const buf = Buffer.from(await img.arrayBuffer());
    await writeFile(out, buf);
    console.log(`✓ ${slug}  (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.log(`✗ ${slug} (download failed: ${e.message})`);
    failed.push(slug);
  }
  await sleep(300);
}

console.log(`\n${ok}/${slugs.length} into public/${subdir}` + (failed.length ? `  ·  failed: ${failed.join(", ")}` : ""));
process.exit(failed.length ? 1 : 0);
