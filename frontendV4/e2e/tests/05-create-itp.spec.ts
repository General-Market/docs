import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { connectWalletButton, itpCard } from '../helpers/selectors';
import { pollUntil, getItpStateL3, getItpCountL3 } from '../helpers/backend-api';

test.describe('Create ITP', () => {
  test('create ITP via frontend, issuer relays to L3', async ({ walletPage: page }) => {
    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing to load (at least the deploy-script ITP)
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Record current ITP count on L3 before creating
    const itpCountBefore = await getItpCountL3();

    // 4. Expand "Create ITP" section
    const createSection = page.locator('#create-itp');
    await createSection.getByRole('button', { name: /Create ITP/ }).click();
    await expect(createSection.locator('input[placeholder="e.g., DeFi Blue Chips"]')).toBeVisible({ timeout: 5_000 });

    // 5. Fill in name and symbol
    await createSection.locator('input[placeholder="e.g., DeFi Blue Chips"]').fill('E2E Test');
    await createSection.locator('input[placeholder="e.g., DEFI"]').fill('E2ET');

    // 6. Select 3 assets from the available list
    const assetButtons = createSection.locator('button:has-text("+ ")');
    const assetCount = await assetButtons.count();
    expect(assetCount).toBeGreaterThanOrEqual(3);

    await assetButtons.nth(0).click();
    await assetButtons.nth(0).click(); // After first is added, next one shifts to nth(0)
    await assetButtons.nth(0).click();

    // 7. Distribute weights evenly
    await createSection.getByText('Distribute Evenly').click();

    // Verify weights sum to 100%
    await expect(createSection.getByText('100%')).toBeVisible({ timeout: 3_000 });

    // 8. Wait for submit button to be enabled (prices must be fetched first)
    const submitBtn = createSection.getByRole('button', { name: 'Create ITP Request' });
    await expect(submitBtn).toBeEnabled({ timeout: 30_000 });

    // 9. Submit
    await submitBtn.click();

    // 10. Wait for wallet confirmation (mock wallet auto-accepts)
    //     Button text changes to "Confirming..." then success banner appears
    await expect(createSection.getByText('ITP Request Created!')).toBeVisible({ timeout: 60_000 });

    // 11. Wait for the issuer to process the request and the new ITP to appear on L3
    //     The issuer creates on L3, then completes on Arb (BridgedITP ERC20 deployed).
    await pollUntil(
      async () => {
        try {
          return await getItpCountL3();
        } catch {
          return itpCountBefore;
        }
      },
      (count) => count > itpCountBefore,
      90_000, // 90s timeout — issuer polls every ~5s
      3_000,
    );

    // Verify the new ITP has assets
    const newItpNum = (await getItpCountL3());
    const newItpId = '0x' + newItpNum.toString(16).padStart(64, '0');
    const newState = await getItpStateL3(newItpId);
    expect(newState.assets.length).toBeGreaterThan(0);

    // 12. Refresh and verify the new ITP appears in the listing
    //     The listing is paginated (2 per page), so we can't rely on card count.
    //     Instead, reload until the $E2ET symbol appears (may be on page 2+).
    await expect(async () => {
      await page.reload();
      await expect(itpCard(page).first()).toBeVisible({ timeout: 10_000 });
      // Check if $E2ET is visible — may need to paginate
      const visible = await page.getByText('$E2ET').first().isVisible().catch(() => false);
      if (!visible) {
        // Click "next page" buttons until we find it or run out of pages
        const nextBtn = page.locator('button:has-text("→")').last();
        while (await nextBtn.isEnabled().catch(() => false)) {
          await nextBtn.click();
          const found = await page.getByText('$E2ET').first().isVisible().catch(() => false);
          if (found) return;
        }
        throw new Error('$E2ET not found on any page');
      }
    }).toPass({ timeout: 60_000, intervals: [5_000] });

    await expect(page.getByText('$E2ET').first()).toBeVisible();
  });
});
