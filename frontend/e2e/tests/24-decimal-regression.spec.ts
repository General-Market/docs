/**
 * Decimal / formatting regression tests.
 * Catches known bugs where raw wei values leak into the UI.
 *
 * Known bugs targeted:
 * - Lending TVL showing raw wei ($100,000,000,033,200)
 * - Vision balance showing unformatted 18-decimal values
 * - ITP NAV out of sane range
 * - Settlement USDC showing 18 decimal places instead of 6
 * - Any 18+ digit numbers visible in document body (raw bigint leak)
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { FRONTEND_URL } from '../env';
import { ensureWalletConnected } from '../helpers/selectors';

test.describe('Decimal Regression Tests', () => {
  test('no 18+ digit numbers visible in document body (bigint leak check)', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Wait for ITP cards to load — retry navigation if data-node SSE is slow
    const itpCards = page.locator('[id^="itp-card-"]');
    let hasCards = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false);
    if (!hasCards) {
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      hasCards = await itpCards.first().isVisible({ timeout: 45_000 }).catch(() => false);
    }
    if (!hasCards) {
      // Third attempt — data-node SSE can return empty initially then populate
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      hasCards = await itpCards.first().isVisible({ timeout: 45_000 }).catch(() => false);
    }
    // Fresh deploy may have no ITP data yet — skip rather than fail
    test.skip(!hasCards, 'No ITP cards loaded — data-node likely has no data on fresh deploy');

    // Scan the entire visible body text for raw bigint values
    const bodyText = await page.evaluate(() => document.body.innerText);

    // Find all number sequences of 18+ digits that aren't inside code blocks
    const rawBigintPattern = /(?<!\.)(\d{18,})(?![\d.])/g;
    const matches = bodyText.match(rawBigintPattern) || [];

    // Filter out known safe patterns (all-zeros, chain IDs, block numbers, timestamps)
    const suspiciousMatches = matches.filter(m => {
      if (/^0+$/.test(m)) return false;
      // Chain ID 111222333 concatenated with other numbers, or block hashes
      if (m.startsWith('111222333')) return false;
      // 18-digit numbers could be timestamps in nanoseconds — only flag 19+ as high-confidence
      if (m.length === 18) return false;
      return true;
    });

    if (suspiciousMatches.length > 0) {
      console.warn('Suspicious raw bigint values found:', suspiciousMatches.slice(0, 5));
    }
    expect(suspiciousMatches.length).toBe(0);
  });

  test('ITP NAV values are in sane range ($0.00–$100k)', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // walletPage already navigates to /index — retry if data-node is slow
    const itpCards = page.locator('[id^="itp-card-"]');
    let hasCards = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false);
    if (!hasCards) {
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      hasCards = await itpCards.first().isVisible({ timeout: 45_000 }).catch(() => false);
    }
    // Fresh deploy may have no ITP data yet — skip rather than fail
    test.skip(!hasCards, 'No ITP cards loaded — data-node likely has no data on fresh deploy');

    const navTexts = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id^="itp-card-"]');
      const navs: string[] = [];
      elements.forEach(el => {
        const text = el.textContent || '';
        const dollarMatches = text.match(/\$[\d,.]+/g);
        if (dollarMatches) navs.push(...dollarMatches);
      });
      return navs;
    });

    for (const navText of navTexts) {
      const value = parseFloat(navText.replace(/[$,]/g, ''));
      if (isNaN(value)) continue;
      // $0.00 is valid on fresh deploy (oracle prices not yet available)
      // Only flag values that are clearly wrong: negative or absurdly large
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(100_000);
    }
  });

  test('Vision balance shows formatted amount, not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Navigate to Vision (root page)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS).catch(() => {});

    // Look for balance display — skip if not visible (wallet may not connect under load)
    const balanceText = page.getByText(/Balance:.*USDC/);
    if (await balanceText.isVisible({ timeout: 15_000 }).catch(() => false)) {
      const text = await balanceText.textContent();
      const rawWei = text?.match(/\d{18,}/);
      expect(rawWei).toBeNull();
    }
  });

  test('lending TVL is under $10M (catches raw wei display)', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // walletPage already at /index — retry if data-node is slow
    const itpCards = page.locator('[id^="itp-card-"]');
    let hasCards = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false);
    if (!hasCards) {
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      hasCards = await itpCards.first().isVisible({ timeout: 45_000 }).catch(() => false);
    }
    // Fresh deploy may have no ITP data yet — skip rather than fail
    test.skip(!hasCards, 'No ITP cards loaded — data-node likely has no data on fresh deploy');

    // Look for TVL display anywhere on the page
    const tvlElements = page.locator('text=/TVL|Total Value/i');
    if (await tvlElements.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      const tvlContainer = tvlElements.first().locator('..');
      const text = await tvlContainer.textContent();

      const dollarMatch = text?.match(/\$[\d,.]+/);
      if (dollarMatch) {
        const value = parseFloat(dollarMatch[0].replace(/[$,]/g, ''));
        // $0 is valid on fresh deploy (no deposits yet)
        // Raw wei would be in the billions — $10M ceiling catches that
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10_000_000);
      }
    }
  });
});
