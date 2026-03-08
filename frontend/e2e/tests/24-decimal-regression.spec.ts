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
    test.setTimeout(120_000);

    // Wait for page to fully load with data
    await page.waitForTimeout(5_000);

    // Scan the entire visible body text for raw bigint values
    // A raw wei value looks like 100000000000000000000 (18+ digits without formatting)
    const bodyText = await page.evaluate(() => document.body.innerText);

    // Find all number sequences of 18+ digits that aren't inside code blocks
    const rawBigintPattern = /(?<!\.)(\d{18,})(?![\d.])/g;
    const matches = bodyText.match(rawBigintPattern) || [];

    // Filter out known safe patterns (timestamps, hex-like, addresses)
    const suspiciousMatches = matches.filter(m => {
      // Timestamps are ~13 digits, ignore
      if (m.length <= 15) return false;
      // All zeros is not a leak (placeholder)
      if (/^0+$/.test(m)) return false;
      return true;
    });

    if (suspiciousMatches.length > 0) {
      console.warn('Suspicious raw bigint values found:', suspiciousMatches.slice(0, 5));
    }
    expect(suspiciousMatches.length).toBe(0);
  });

  test('ITP NAV values are in sane range ($0.01–$1000)', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait for ITP cards to render
    const itpCards = page.locator('[id^="itp-card-"]');
    await expect(itpCards.first()).toBeVisible({ timeout: 30_000 });

    // Extract all displayed NAV values from the page
    // NAVs typically show as "$X.XX" in the UI
    const navTexts = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id^="itp-card-"]');
      const navs: string[] = [];
      elements.forEach(el => {
        // Look for dollar amounts in the card
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
    test.setTimeout(120_000);

    // Navigate to Vision (root page)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3_000);

    // Connect wallet
    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ });
    if (await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await connectBtn.click();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(3_000);
    }

    // Look for balance display
    const balanceText = page.getByText(/Balance:.*USDC/);
    if (await balanceText.isVisible({ timeout: 15_000 }).catch(() => false)) {
      const text = await balanceText.textContent();
      // Balance should NOT contain 18+ digit numbers
      const rawWei = text?.match(/\d{18,}/);
      expect(rawWei).toBeNull();
    }
  });

  test('lending TVL is under $10M (catches raw wei display)', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    // Navigate to index page (ITP listing with lending)
    await page.waitForTimeout(3_000);

    // Look for TVL display anywhere on the page
    const tvlElements = page.locator('text=/TVL|Total Value/i');
    if (await tvlElements.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      // Get the text near TVL labels
      const tvlContainer = tvlElements.first().locator('..');
      const text = await tvlContainer.textContent();

      // Extract dollar amounts
      const dollarMatch = text?.match(/\$[\d,.]+/);
      if (dollarMatch) {
        const value = parseFloat(dollarMatch[0].replace(/[$,]/g, ''));
        // TVL should be reasonable — raw wei would show as $100,000,000,033,200+
        expect(value).toBeLessThan(10_000_000);
      }
    }
  });
});
