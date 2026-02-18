#!/usr/bin/env node
/**
 * Fetch YouTube transcripts using ANDROID InnerTube API + CORS proxy.
 * Bypasses IP ban on timedtext API by routing through corsproxy.io.
 * Caches transcripts in ./transcripts/{id}.txt
 * Generates per-channel scripts markdown files.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const TRANSCRIPT_DIR = path.join(SCRIPT_DIR, 'transcripts');
fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const PROXY_BASE = 'https://corsproxy.io/?';

const CHANNELS = {
  "Economics Explained": [
    ["DmMmnSIQmx8", "Is German Precision Manufacturing Over?"],
    ["gP-Fm4YdGN4", "Indonesia Could Overtake The USA By 2050"],
    ["C5Qk5TRnX7U", "Why Does Everybody Keep Borrowing Money From China?"],
    ["rT5iXZQFKjw", "Is It Good For The Rich To Spend Now?"],
    ["qmd5EdhPNwQ", "Why is lithium important?"],
    ["QHPwv0D6Rko", "The Billion $ Gambler"],
    ["0AC15rUxJOc", "Should we be worried about Zimbabwe's lithium ban?"],
    ["knwYdobnRLo", "How ban on exports can solve Zimbabwe's issues"],
    ["-9vJeGPyZJQ", "The Poorest Countries Will Be Hit Hardest"],
    ["AaUheN1r5M8", "The state of Zimbabwe's mining industry"],
    ["S8RvEra6CwM", "Are We Heading into a Geopolitical Crisis?"],
    ["bhXMXPiMPPY", "Will the lithium export ban benefit Zimbabwe?"],
    ["mOGb9CKrS0g", "Deglobalization will make everybody poorer"],
    ["VsGMefP62tU", "What are the Economic Consequences of ChatGPT?"],
    ["E9eWfPIwU1c", "Unsustainable Borrowing in the USA?"],
    ["7FkgGHG8TlE", "Are we Heading into World War III?"],
    ["XjRI0i2KC08", "The Most Unstable Decade"],
    ["hKnLF1MufdE", "90% of Qatar's Residents Aren't Citizens?"],
    ["W5fiw1cdzGY", "How Did Trump DEAL with China?"],
    ["cNqur5nbl4g", "What is the Korean Wave?"],
    ["RNnoalfjLMY", "The Economic Crisis in Pakistan"],
    ["y-bUxG3_cSY", "Is Wealth Determined By Weather?"],
    ["g6JgHUnpMCQ", "Pt 3: The Aftermath of the Adani Scandal"],
    ["8DQ59A5YbUQ", "The Largest Scam Ever Pt 2: Adani's Response"],
    ["WAH5ATbwYoI", "The Adani Scandal Is Unreal"],
    ["8B3rvgbSqwg", "The Economics Of Dating"],
    ["5YTBlv96qx4", "Craziest Bull Run Ever?"],
    ["0G5O85rUN0M", "Will Russian Sanctions Spark Global Recession?"],
    ["Y9qvaN4Nq28", "Climate Change Is Costing Us Billions"],
    ["xlFHjORyXdQ", "The Rise of Virtual Influencers"],
    ["_1VjdkpEO38", "Is Anyone Saving For Retirement?"],
    ["-5XusYbqSwI", "Is Breakfast Propaganda?"],
    ["zl_TCJv9XgU", "Who was Adam Smith"],
    ["k715EmSnR2U", "The Worst Economic Contraction Ever"],
    ["yc4WRVTf_4k", "Who was Karl Marx"],
    ["3sFR3ahIl1U", "The Financial Crisis in Venezuela"],
    ["GTECeK3lxr4", "Should the US Worry About Stagflation"],
    ["vIYRM2QqaOA", "Who was Milton Friedman?"],
    ["eYvnivxTZAs", "The Cost of Stalin's 5 Year Plans"],
    ["gyaimoDOX6w", "Will The Rich Only Get Richer?"],
    ["4KffbPc2Iw4", "Chat GPT & The Economic Impact of AI"],
    ["GQeat9EzYc0", "How France Lost Everything"],
    ["mNWdPTp9mX4", "The Largest IMF Bailout In History"],
    ["vbWM7l_QQqo", "Who Was Alfred Marshall?"],
    ["F7Jtq5-A2Ls", "Will the Metaverse Actually Increase Productivity?"],
    ["7yfairi9yBc", "Robot Landlords Are Buying Up Houses!"],
    ["f4FJPCzM09Y", "The global economy depends on a company no one has heard of!"],
    ["lamKzoRGuwc", "The First Financial Bubbles Ever?"],
    ["kMPfNJeSupw", "What Does Ovulation Have To Do with Economics?"],
    ["-m7_qd6MFy4", "When Rome Fought Inflation With Delusion"],
  ],
  "MagnatesMedia": [
    ["N6IWoMOSPEU", "The Fugitive CEO Who Escaped In A Box"],
    ["3EaFIzdWnm8", "The Richest Family In Italy"],
    ["LrE_IznjvUY", "Is This Genius Or Crazy?"],
    ["jJ-BUyhNStk", "Why Post-It Notes Were a FAILURE"],
    ["PiOD0C61UiQ", "YouTube Is Like An Online Game"],
    ["xxO81tbylKs", "Crazy Richard Branson Airline Story"],
    ["tnakppz0QNk", "Why is it called a Ponzi Scheme?"],
    ["rJyqYxeQtY0", "Quibi: A Spectacular Disaster"],
    ["OXOB8ld1Uv4", "The Weird TRUTH About Michelin Stars"],
    ["d4hypdMl3G4", "If you think you've made a bad choice"],
    ["14S5zSomshc", "10k steps a day is a LIE"],
    ["a_Pzv7CAtGs", "Entrepreneur Morning Routines Are INSANE"],
    ["6XDIYVT_aUY", "The Dumbest App Ever"],
    ["kAROFCaSY1g", "Why Does Coke Spend So Much On Ads?"],
    ["BO59DylB49A", "The airline that trolls its customers"],
    ["Sqh94ds2VW8", "Hooters Girl Controversy"],
    ["2H8QZEktqgY", "The Dirty Truth of Buying From Amazon"],
    ["v5iV7Qyb17A", "The Dark Truth of PayPal"],
    ["ammQ5a9ZZZg", "How Many Billionaires Are There REALLY?"],
    ["A1zK48vHp3k", "Funny Pricing Tactic"],
    ["LtFIEyWkSO0", "This Game RUINED His Life (Flappy Bird)"],
    ["OPNiWN467yI", "The Disturbing History of Fanta"],
    ["6VQCGzXMTL8", "Masa Son: The Craziest Billionaire"],
    ["SfxfjwE8zKo", "How Cereal SAVED Airbnb"],
    ["bZf7rEF-gUQ", "Why Christmas in Japan = KFC"],
    ["zpqqZifhFQQ", "How This Book Saved Amazon From Bankruptcy"],
    ["Bb3hIogNaGc", "MrBeast Explains The YouTube Algorithm In 46 Seconds"],
    ["m-bZTnCJ-Yc", "What Makes Videos Go Viral on Social Media?"],
    ["dddajUeIm1U", "Entrepreneurship: Expectations vs Reality"],
  ],
  "Fireship": [
    ["fwBIZRq-vzY", "5 life-changing Linux tips"],
    ["oRBvLbdMKM0", "This rubber duck can debug your code"],
    ["WbF2bLbAUik", "Big O explained with a deck of cards"],
    ["tUjjsqRp3mg", "CrowdStrike attacks a clown website"],
    ["ZRjmGq1gAEQ", "Does your code suck? JavaScript Variables"],
    ["X8LglXSG53A", "How god programmed birds probably"],
    ["gGWQfV1FCis", "Real HTML programmers debug in 3D"],
    ["aXcuz6fn8_w", "The untold history of web development"],
    ["7bmsDg4BaKw", "My browser, my paste"],
    ["0xnuhmqRvVQ", "Yo mama so FAT32"],
    ["H1sXIUbpRCU", "A Day in the Life of a Proompt Engineer"],
    ["91IPJ6LFmto", "AI-search engine for developers has emerged"],
    ["WrxnpxKarxU", "Meet SAM - Meta's latest AI model"],
    ["-J7EWBYipqI", "the PATH var of righteousness"],
    ["6V-eRPPLSy0", "how big is a yottabyte?"],
    ["Z8omJ59hNfY", "real eyes realize AI lies"],
    ["1CDfTpD8dxo", "my code will never stop never stopping"],
    ["5_t_I_4OuwQ", "get a grip on grep"],
    ["U_QNznf2FZA", "JPG vs PNG vs WEBP vs GIF vs SVG"],
    ["K7iRfOs-aUw", "Database Sharting Explained"],
    ["8B20fRB78nA", "7 killer website features"],
    ["UA7NSpzG98s", "client got faded, I got paid"],
    ["9BvBRXkJA58", "my code works... why?"],
    ["UwrZkg6JOOU", "r u even turing complete?"],
    ["ZIv4hb_Swug", "Web 1.0-beta"],
    ["BThr1pb77Fo", "WTF is a Bezier Curve?"],
    ["o0v41bhlpi0", "i quit using console.log in prod"],
    ["mi6DoxNEN6w", "WTF is an Abstract Syntax Tree?"],
    ["SlBOpNLFUC0", "It works on localhost"],
    ["TqnC96-nXAA", "Awesome User Avatars Made Easy"],
    ["BQBMbwfC6TY", "This weird skill helps you learn to code faster"],
    ["OAuZGexox5s", "Quick overview of CSS"],
    ["B1t4Fjlomi8", "Why do computers use RGB for colors, not RBY?"],
    ["XQMVOoPZLYs", "Is your memory leaking?"],
    ["5JqzCjg4YRU", "TypeScript is Literal Magic"],
    ["ZtyMdRzvi0w", "God Tier HTML Programming"],
    ["s9F8pu5KfyM", "Why do computers suck at math?"],
    ["ITogH7lJTyE", "Async Await try-catch hell"],
    ["JMWNYfPIF2U", "Fullstack Development Iceberg"],
    ["epH4QvLUXlY", "I've become my own Arch Enemy"],
    ["kt0bfw4YkFk", "TODO: Write Good Code Comments"],
    ["LuWdeuPMHps", "Easy Hand-Drawn SVG Animation"],
    ["njdJeu95p6s", "Top 3 Ways to Center a DIV with CSS"],
    ["qOSH2pYg6m8", "Delete node_modules like a Pro"],
    ["ecl-eCbYFPM", "Reverse Engineer CSS Animations"],
    ["nvlizC6koSc", "4 Steps to Become a Developer"],
    ["WpgZKBtW_t8", "VS Code Path Trick w/ JavaScript"],
    ["pL7h1tUzrBs", "7 Linux Things You Say WRONG"],
  ],
  "Veritasium": [
    ["Bt3boxwRF84", "World's Largest Spiderweb"],
    ["w2TLv30F6UU", "How They Prevented The Citicorp Disaster"],
    ["itSkBESLZeY", "What happens if you cut the green rope?"],
    ["fkxoaD47-Vo", "You're Only 6 Steps Away From Anyone On Earth"],
    ["nMqWWO6p7-c", "Strange pattern down the east coast of America"],
    ["Bb0uDpvitoE", "I Turned My Phone Into A Microscope"],
    ["gGtuw7Rejtk", "How Strong Is Super Glue?"],
    ["HVySQLuxLkI", "Seeing Inside A Thermite Reaction"],
    ["tWRyiCP17do", "Why didn't this skateboard stunt start from the top?"],
    ["h830G5mkTF4", "How To Solve a Quadratic Equation"],
    ["kh9OmFBg8qI", "How To See Atoms"],
    ["S7xvqDUPoJo", "Renting A Helicopter To Settle A Physics Debate"],
    ["q6WlXhtVvkg", "How to solve any maze"],
    ["b8XVCsXyIZs", "What Happens When You Spin a Football?"],
    ["OW9Mq3wrEqY", "How aerogel can make the ocean drinkable"],
    ["zQ2ZJuUJeyo", "Can you swim in shade balls?"],
    ["y2y8ME02lX4", "Testing the US Military's worst idea"],
    ["UKfnXd3x-rw", "The blue LED was almost impossible to make"],
    ["za_HO2E3JEU", "Why do all animals jump to about the same height?"],
    ["49NikeBCzWo", "Why did light bulb lifetimes get shorter?"],
    ["Jqz_YuyXKJI", "There are 96 million black balls on this lake"],
    ["zeZddwimLc8", "Why do planes fly so high?"],
    ["4LYlMqBXTJI", "Why we put spiders on soccer balls"],
    ["ZC98ZK6Ivug", "Can you solve this SAT question?"],
    ["DCiPrr-dQyw", "Can you solve the prisoner's riddle?"],
    ["mqo1lQL59VI", "This Is The Perfect Bowling Strategy"],
    ["pgGrQjYcm5A", "Explaining Pi With Pizza"],
    ["NKG0pRwTC5A", "How Dishwashers Actually Work"],
    ["0MX-5BDeEnA", "The BEST way to tie your shoelaces"],
    ["ORxKf1FN3ro", "The real science of black holes"],
    ["nhW0FLEqUkk", "What Do You Hear?"],
    ["WKvAsz3RoRE", "This phone trick is IMPOSSIBLE"],
    ["8fNFd2Xswjs", "The most dangerous problem in math"],
    ["scliyWrN7mk", "How bikes actually work"],
    ["2FLqOI9jw-E", "I call this the No You Don't Law"],
    ["sE-RUu9ClsU", "Congress is about to make a huge mistake for astronomy"],
    ["dAik8EeDyEI", "I buried myself in concrete to explain how it works"],
    ["ov_7HT8bbX4", "World's strongest magnet!"],
    ["QAWnEVa9vmw", "I waterproofed myself with aerogel!"],
    ["w7yFikRD_iQ", "The illusion only some can see"],
    ["LCQu8EXiDAA", "The Damaged Chernobyl Reactor"],
    ["LY6xeFpBeMQ", "Microwaving grapes makes plasma"],
    ["uDeQB9OkoXY", "World's Roundest Object"],
    ["Ko02mUWhItA", "Raindrops aren't shaped like raindrops"],
    ["rmxh8Nty_eo", "The stickiest non-sticky material"],
    ["Tmy7VYhZEKQ", "The ring on a chain trick"],
    ["n8WxkqMRgS4", "Falling ladders - why does this happen?"],
    ["P_MSlxczd94", "Indestructible coating?!"],
    ["QiVgJPVKRGI", "What's in a candle flame?"],
    ["NdWFCygzr8k", "Why do we launch rockets from Florida?"],
  ],
  "PolyMatter": [
    ["3KEi3lUXVoU", "This is Not Target"],
  ],
};

// Also include Zack D. Films (already have transcripts cached for these)
// We'll just check cache for these

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const method = options.method || 'GET';
    const u = new URL(url);

    const reqOpts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
        ...(options.headers || {})
      }
    };

    const req = proto.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getSignedCaptionUrl(videoId) {
  const body = JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        hl: 'en',
        gl: 'US',
      }
    }
  });

  const resp = await fetchUrl(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }
  );

  if (resp.status !== 200) return null;
  const data = JSON.parse(resp.data);
  if (!data.captions || !data.captions.playerCaptionsTracklistRenderer) return null;
  const tracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;
  if (!tracks || tracks.length === 0) return null;
  return tracks[0].baseUrl;
}

function parseTimedTextXml(xml) {
  // Format 3: <p> elements with <s> children
  const segments = [];
  const pMatches = [...xml.matchAll(/<p\s[^>]*?(?:a="1"[^>]*)?\/?>/g)];

  // Simple approach: extract all <s> text content
  const sMatches = [...xml.matchAll(/<s[^>]*>(.*?)<\/s>/g)];
  if (sMatches.length > 0) {
    for (const m of sMatches) {
      const text = m[1].trim();
      if (text) segments.push(text);
    }
  }

  // Fallback: <text> elements (format 1)
  if (segments.length === 0) {
    const textMatches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
    for (const m of textMatches) {
      const text = m[1].trim();
      if (text) segments.push(text);
    }
  }

  let result = segments.join(' ');
  // Unescape HTML entities
  result = result
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}

async function fetchTranscript(videoId) {
  // Check cache first
  const cachePath = path.join(TRANSCRIPT_DIR, `${videoId}.txt`);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 10) {
      return { text: fs.readFileSync(cachePath, 'utf-8'), cached: true };
    }
  }

  // Get signed caption URL
  const capUrl = await getSignedCaptionUrl(videoId);
  if (!capUrl) return { text: null, error: 'No captions available' };

  // Fetch via proxy
  const proxyUrl = PROXY_BASE + encodeURIComponent(capUrl);
  const resp = await fetchUrl(proxyUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });

  if (resp.status !== 200 || resp.data.length < 10) {
    return { text: null, error: `HTTP ${resp.status}` };
  }

  const text = parseTimedTextXml(resp.data);
  if (!text || text.length < 5) {
    return { text: null, error: 'Empty transcript' };
  }

  // Save to cache
  fs.writeFileSync(cachePath, text);
  return { text, cached: false };
}

async function main() {
  const totalVideos = Object.values(CHANNELS).reduce((sum, arr) => sum + arr.length, 0);
  let ok = 0, fail = 0, cached = 0;

  for (const [channel, shorts] of Object.entries(CHANNELS)) {
    console.log(`\n=== ${channel} (${shorts.length} shorts) ===`);
    const results = {};

    for (let i = 0; i < shorts.length; i++) {
      const [vidId, title] = shorts[i];

      try {
        const result = await fetchTranscript(vidId);
        if (result.text) {
          results[vidId] = result.text;
          ok++;
          if (result.cached) {
            cached++;
            console.log(`  CACHED [${ok}/${totalVideos}]: ${title}`);
          } else {
            console.log(`  OK [${ok}/${totalVideos}]: ${title} (${result.text.length} chars)`);
            // Rate limit: 3s between proxy requests
            await sleep(3000);
          }
        } else {
          fail++;
          results[vidId] = `ERROR: ${result.error}`;
          console.log(`  FAIL: ${title}: ${result.error}`);
          await sleep(1000);
        }
      } catch (e) {
        fail++;
        results[vidId] = `ERROR: ${e.message}`;
        console.log(`  FAIL: ${title}: ${e.message}`);
        await sleep(1000);
      }
    }

    // Build per-channel scripts markdown
    const slug = channel.toLowerCase().replace(/\s+/g, '-');
    let md = `# ${channel} Shorts Scripts\n\n`;
    md += `${shorts.length} shorts transcripts.\n\n---\n\n`;

    for (let i = 0; i < shorts.length; i++) {
      const [vidId, title] = shorts[i];
      const text = results[vidId] || 'N/A';
      md += `## ${i + 1}. ${title}\n`;
      md += `**Channel:** ${channel} | **ID:** ${vidId}\n`;
      md += `**Link:** https://youtube.com/shorts/${vidId}\n\n`;
      md += `### Script:\n${text}\n\n---\n\n`;
    }

    const outPath = path.join(SCRIPT_DIR, `${slug}-shorts-scripts.md`);
    fs.writeFileSync(outPath, md);
    console.log(`  -> Saved ${outPath}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${ok}/${totalVideos} OK (${cached} cached), ${fail} failed`);
}

main().catch(e => console.error('Fatal:', e));
