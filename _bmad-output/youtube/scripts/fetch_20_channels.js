#!/usr/bin/env node
/**
 * Fetch 50 latest Shorts transcripts for 20 new storytelling channels.
 * Uses InnerTube ANDROID API for caption URLs + corsproxy.io for fetching.
 * Outputs per-channel .md files to ../channels/
 *
 * Usage: node fetch_20_channels.js [startIdx] [endIdx]
 *
 * Rate limiting: 1.5s between InnerTube calls, 2s between proxy fetches.
 * Retry: 1 retry after 5s pause on no-caption (catches rate limit false negatives).
 * Channels ordered: narration-heavy first, visual-only last.
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const CHANNELS_DIR = path.join(SCRIPT_DIR, '..', 'channels');
const TRANSCRIPT_DIR = path.join(SCRIPT_DIR, 'transcripts');
fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
fs.mkdirSync(CHANNELS_DIR, { recursive: true });

const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const PROXY_BASE = 'https://corsproxy.io/?';

// Rate limit config
const INNERTUBE_DELAY = 1500;
const PROXY_DELAY = 2500;
const RETRY_DELAY = 5000;
const MAX_RETRIES = 1;

// Channels ordered by likelihood of having narration transcripts
// (narration-heavy first, visual-only last)
const CHANNELS = [
  // Tier 1: Pure narrators (nearly every short has spoken word)
  { name: 'MrBallen', handle: '@MrBallen', slug: 'mrballen' },
  { name: 'The Infographics Show', handle: '@TheInfographicsShow', slug: 'the-infographics-show' },
  { name: 'Bright Side', handle: '@BRIGHTSIDE', slug: 'bright-side' },
  { name: 'TED-Ed', handle: '@TEDEd', slug: 'ted-ed' },
  { name: 'RealLifeLore', handle: '@RealLifeLore', slug: 'reallifelore' },
  { name: 'Johnny Harris', handle: '@johnnyharris', slug: 'johnny-harris' },
  { name: 'Brew', handle: '@Brew', slug: 'brew' },
  { name: 'ColdFusion', handle: '@ColdFusion', slug: 'coldfusion' },
  { name: 'Aperture', handle: '@Aperture', slug: 'aperture' },
  { name: 'Daily Dose of Internet', handle: '@DailyDoseOfInternet', slug: 'daily-dose-of-internet' },
  // Tier 2: Mixed narration + visual
  { name: 'Dhar Mann', handle: '@DharMann', slug: 'dhar-mann' },
  { name: 'Business Insider', handle: '@BusinessInsider', slug: 'business-insider' },
  { name: 'Insider', handle: '@Insider', slug: 'insider' },
  { name: 'Lemmino', handle: '@LEMMiNO', slug: 'lemmino' },
  { name: 'Alan Chikin Chow', handle: '@AlanChinkinChow', slug: 'alan-chikin-chow' },
  { name: 'Mark Rober', handle: '@MarkRober', slug: 'mark-rober' },
  { name: 'Ryan Trahan', handle: '@RyanTrahan', slug: 'ryan-trahan' },
  // Tier 3: Mostly visual (likely few/no captions)
  { name: 'MrBeast', handle: '@MrBeast', slug: 'mrbeast' },
  { name: 'Daniel LaBelle', handle: '@DanielLaBelle', slug: 'daniel-labelle' },
  { name: 'Zach King', handle: '@ZachKing', slug: 'zach-king' },
];

const startIdx = parseInt(process.argv[2]) || 0;
const endIdx = parseInt(process.argv[3]) || CHANNELS.length;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
        ...(options.headers || {})
      }
    };
    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function getShortsList(handle) {
  try {
    const SEP = '|||';
    const cmd = `yt-dlp --flat-playlist --print "%(id)s${SEP}%(title)s${SEP}%(view_count)s" --playlist-end 50 "https://www.youtube.com/${handle}/shorts" 2>/dev/null`;
    const output = execSync(cmd, { timeout: 60000, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(SEP);
      const id = parts[0];
      const views = parseInt(parts[2]) || 0;
      const title = parts[1] || 'Untitled';
      return { id, title, views };
    });
  } catch (e) {
    console.error(`  yt-dlp failed: ${e.message.split('\n')[0]}`);
    return [];
  }
}

async function getCaptionUrl(videoId) {
  const body = JSON.stringify({
    videoId,
    context: {
      client: { clientName: 'ANDROID', clientVersion: '19.09.37', hl: 'en', gl: 'US' }
    }
  });
  try {
    const resp = await fetchUrl(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
      { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }
    );
    if (resp.status !== 200) return null;
    const data = JSON.parse(resp.data);
    if (!data.captions || !data.captions.playerCaptionsTracklistRenderer) return null;
    const tracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!tracks || tracks.length === 0) return null;
    const en = tracks.find(t => t.languageCode === 'en') || tracks[0];
    return en.baseUrl;
  } catch (e) {
    return null;
  }
}

async function fetchTranscriptXml(capUrl) {
  const proxyUrl = PROXY_BASE + encodeURIComponent(capUrl);
  const resp = await fetchUrl(proxyUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (resp.status !== 200 || resp.data.length < 10) return null;
  return parseXml(resp.data);
}

async function fetchTranscript(videoId) {
  const cachePath = path.join(TRANSCRIPT_DIR, `${videoId}.txt`);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 10) {
      return { text: fs.readFileSync(cachePath, 'utf-8'), cached: true };
    }
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY);
    await sleep(INNERTUBE_DELAY);

    const capUrl = await getCaptionUrl(videoId);
    if (!capUrl) {
      if (attempt < MAX_RETRIES) continue;
      return { text: null, error: 'No captions' };
    }

    try {
      await sleep(PROXY_DELAY);
      const text = await fetchTranscriptXml(capUrl);
      if (!text || text.length < 5) {
        return { text: null, error: 'Empty transcript' };
      }
      fs.writeFileSync(cachePath, text);
      return { text, cached: false };
    } catch (e) {
      if (attempt < MAX_RETRIES) continue;
      return { text: null, error: e.message };
    }
  }
  return { text: null, error: 'Failed after retries' };
}

function parseXml(xml) {
  let segs = [...xml.matchAll(/<s[^>]*>(.*?)<\/s>/g)];
  if (segs.length > 0) {
    return cleanText(segs.map(m => m[1].trim()).filter(Boolean).join(' '));
  }
  segs = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
  if (segs.length > 0) {
    return cleanText(segs.map(m => m[1].trim()).filter(Boolean).join(' '));
  }
  return '';
}

function cleanText(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function formatViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(n);
}

async function processChannel(channel) {
  const { name, handle, slug } = channel;
  const ts = new Date().toLocaleTimeString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${ts}] ${name} (${handle})`);
  console.log('='.repeat(60));

  console.log(`  Listing 50 latest shorts...`);
  const shorts = getShortsList(handle);
  if (shorts.length === 0) {
    console.log(`  ERROR: No shorts found`);
    return { name, ok: 0, fail: 0, noCaption: 0, total: 0 };
  }
  console.log(`  Found ${shorts.length} shorts`);

  let ok = 0, fail = 0, noCaption = 0, cached = 0;
  const results = [];
  let consecutiveNoCap = 0;

  for (let i = 0; i < shorts.length; i++) {
    const short = shorts[i];
    const result = await fetchTranscript(short.id);

    if (result.text) {
      ok++;
      consecutiveNoCap = 0;
      if (result.cached) {
        cached++;
        console.log(`  CACHED [${ok}/${shorts.length}]: ${short.title.substring(0, 55)}`);
      } else {
        console.log(`  OK [${ok}/${shorts.length}]: ${short.title.substring(0, 55)} (${result.text.length}ch)`);
      }
      results.push({ ...short, text: result.text });
    } else {
      if (result.error === 'No captions' || result.error === 'No captions after retry' || result.error === 'Failed after retries') {
        noCaption++;
        consecutiveNoCap++;
        console.log(`  NO-CAP [${i+1}/${shorts.length}]: ${short.title.substring(0, 55)}`);
      } else {
        fail++;
        consecutiveNoCap = 0;
        console.log(`  FAIL [${i+1}/${shorts.length}]: ${short.title.substring(0, 55)} (${result.error})`);
      }
      results.push({ ...short, text: null, error: result.error });

      // If 10 consecutive no-captions, this channel likely has no spoken content
      if (consecutiveNoCap >= 10) {
        console.log(`  SKIPPING remaining — ${consecutiveNoCap} consecutive NO-CAP (likely visual-only channel)`);
        for (let j = i + 1; j < shorts.length; j++) {
          noCaption++;
          results.push({ ...shorts[j], text: null, error: 'Skipped (visual-only channel)' });
        }
        break;
      }
    }
  }

  // Build markdown
  let md = `# ${name} Shorts - Last 50 Scripts\n\n`;
  md += `50 YouTube Shorts transcripts from ${handle}, ordered by most recent.\n`;
  md += `Successfully fetched: ${ok}/${shorts.length} (${noCaption} no captions, ${fail} errors)\n\n---\n\n`;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    md += `## ${i + 1}. ${r.title}\n`;
    md += `**Channel:** ${name} | **Views:** ${formatViews(r.views)} | **ID:** ${r.id}\n`;
    md += `**Link:** https://youtube.com/shorts/${r.id}\n\n`;
    md += `### Script:\n`;
    md += r.text ? `${r.text}\n` : `_No transcript available (${r.error})_\n`;
    md += `\n---\n\n`;
  }

  const outPath = path.join(CHANNELS_DIR, `${slug}-shorts.md`);
  fs.writeFileSync(outPath, md);
  console.log(`  -> Saved: ${outPath}`);
  console.log(`  TOTAL: ${ok} OK (${cached} cached), ${noCaption} no captions, ${fail} failed`);

  return { name, ok, fail, noCaption, total: shorts.length, cached };
}

async function main() {
  const subset = CHANNELS.slice(startIdx, endIdx);
  console.log(`Fetching transcripts for ${subset.length} channels (idx ${startIdx}-${endIdx - 1})...`);
  console.log(`Cache: ${TRANSCRIPT_DIR}`);
  console.log(`Output: ${CHANNELS_DIR}\n`);

  const summaries = [];
  for (const channel of subset) {
    const summary = await processChannel(channel);
    summaries.push(summary);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  let totalOk = 0, totalFail = 0, totalNoCap = 0;
  for (const s of summaries) {
    totalOk += s.ok;
    totalFail += s.fail;
    totalNoCap += (s.noCaption || 0);
    const pct = s.total > 0 ? Math.round(100 * s.ok / s.total) : 0;
    console.log(`  ${s.name.padEnd(25)} ${String(s.ok).padStart(2)}/${s.total} OK (${pct}%), ${s.noCaption || 0} no-cap, ${s.fail} fail`);
  }
  console.log(`\nGRAND TOTAL: ${totalOk} transcripts, ${totalNoCap} no captions, ${totalFail} errors`);
}

main().catch(e => console.error('Fatal:', e));
