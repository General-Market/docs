import puppeteer from 'puppeteer';

const url = process.argv[2];
const output = process.argv[3];
const zoom = parseFloat(process.argv[4] || '1.5');
const wait = parseInt(process.argv[5] || '0', 10);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: zoom });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
if (wait > 0) {
  console.log(`Waiting ${wait}ms for page to settle...`);
  await new Promise(r => setTimeout(r, wait));
}
await page.screenshot({ path: output, fullPage: true });
await browser.close();
console.log(`Screenshot saved to ${output} (zoom: ${zoom}x)`);
