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
import { IS_ANVIL, FRONTEND_URL } from '../env';

test.describe('Decimal Regression Tests', () => {
  test('no 18+ digit numbers visible in document body (bigint leak check)', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Wait for ITP cards to load (they contain dollar amounts we want to scan)
    const itpCards = page.locator('[id^="itp-card-"]');
    const hasCards = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false);
    if (!hasCards) {
      test.skip(true, 'ITP cards did not load — data-node may be slow');
      return;
    }
    await page.waitForTimeout(2_000);

    // Scan the entire visible body text for raw bigint values
    const bodyText = await page.evaluate(() => document.body.innerText);

    // Find all number sequences of 18+ digits that aren't inside code blocks
    const rawBigintPattern = /(?<!\.)(\d{18,})(?![\d.])/g;
    const matches = bodyText.match(rawBigintPattern) || [];

    // Filter out known safe patterns (timestamps, hex-like, addresses)
    const suspiciousMatches = matches.filter(m => {
      if (m.length <= 15) return false;
      if (/^0+$/.test(m)) return false;
      return true;
    });

    if (suspiciousMatches.length > 0) {
      console.warn('Suspicious raw bigint values found:', suspiciousMatches.slice(0, 5));
    }
    expect(suspiciousMatches.length).toBe(0);
  });

  test('ITP NAV values are in sane range ($0.01–$1000)', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // walletPage already navigates to /index
    const itpCards = page.locator('[id^="itp-card-"]');
    const hasCards = await itpCards.first().isVisible({ timeout: 45_000 }).catch(() => false);
    if (!hasCards) {
      test.skip(true, 'ITP cards did not load');
      return;
    }

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
      if (!isNaN(value) && value > 0) {
        expect(value).toBeGreaterThan(0.01);
        expect(value).toBeLessThan(1000);
      }
    }
  });

  test('Vision balance shows formatted amount, not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Navigate to Vision (root page)
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch {
      test.skip(true, 'Vision page did not load');
      return;
    }
    await page.waitForTimeout(3_000);

    // Connect wallet
    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ });
    if (await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await connectBtn.click();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(3_000);
    }

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

    // walletPage already at /index — wait for data to load
    const itpCards = page.locator('[id^="itp-card-"]');
    const hasCards = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false);
    if (!hasCards) {
      test.skip(true, 'ITP cards did not load');
      return;
    }

    // Look for TVL display anywhere on the page
    const tvlElements = page.locator('text=/TVL|Total Value/i');
    if (await tvlElements.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      const tvlContainer = tvlElements.first().locator('..');
      const text = await tvlContainer.textContent();

      const dollarMatch = text?.match(/\$[\d,.]+/);
      if (dollarMatch) {
        const value = parseFloat(dollarMatch[0].replace(/[$,]/g, ''));
        expect(value).toBeLessThan(10_000_000);
      }
    }
  });
});
