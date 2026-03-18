/**
 * Centralized UI selectors for E2E tests.
 * Since the codebase doesn't use data-testid attributes, we target
 * elements by role, text content, and CSS hierarchy.
 */
import { type Page, type Locator, expect } from '@playwright/test';

// ── Wallet ──────────────────────────────────────────────────

export function connectWalletButton(page: Page): Locator {
  return page.getByRole('button', { name: /Connect Wallet|Log\s?In|Login on Base|Sign Up/ });
}

/**
 * Ensures the wallet is connected. Handles both auto-connect (via seeded
 * wagmi localStorage) and manual connect (clicking the Connect button).
 */
export async function ensureWalletConnected(page: Page, address: string): Promise<void> {
  // Dismiss "Welcome to General Market" dialog if present (blocks pointer events)
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  const truncated = address.slice(0, 6) + '...' + address.slice(-4);
  const addrBtn = page.getByRole('button', { name: truncated });

  // Check if already auto-connected (longer timeout on testnet — SSR + hydration + wallet connect)
  const autoConnected = await addrBtn.isVisible({ timeout: 15_000 }).catch(() => false);
  if (autoConnected) return;

  // Fall back to manual connect
  const connectBtn = connectWalletButton(page);
  const connectVisible = await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!connectVisible) {
    // Neither button found — wallet may be mid-connect. Wait for address to appear.
    await expect(addrBtn).toBeVisible({ timeout: 30_000 });
    return;
  }
  // Click may race with auto-connect (button detaches as wallet connects).
  // If click fails, just wait for the address to appear.
  try {
    await connectBtn.click({ timeout: 10_000 });
  } catch {
    // Button was detached — wallet likely auto-connected during click attempt
  }
  await page.mouse.move(0, 0);
  await expect(addrBtn).toBeVisible({ timeout: 30_000 });
}

// ── ITP Listing (table-based) ────────────────────────────────

/**
 * Each ITP is a <tr> row with id="itp-card-{itpId}" inside the product table.
 * Important: the page also has a sr-only section with <article> elements (SEO).
 * We scope to <tr> elements inside <table> to avoid matching sr-only content.
 */
export function itpCard(page: Page): Locator {
  return page.locator('table tr[id^="itp-card-"]');
}

/** Nth ITP row (0-indexed). Defaults to first. */
export function itpRow(page: Page, index = 0): Locator {
  return itpCard(page).nth(index);
}

export function buyButton(page: Page, rowIndex = 0): Locator {
  // "Buy" text link/button inside a table row — WalletActionButton renders <button>
  return itpRow(page, rowIndex).getByRole('button', { name: 'Buy', exact: true });
}

export function sellButton(page: Page, rowIndex = 0): Locator {
  return itpRow(page, rowIndex).getByRole('button', { name: 'Sell', exact: true });
}

export function borrowButtonOnCard(page: Page): Locator {
  // Borrow button may not be on the first row — find any row that has one
  return itpCard(page).getByRole('button', { name: 'Borrow', exact: true }).first();
}

// ── Modal ───────────────────────────────────────────────────

export function modalContainer(page: Page): Locator {
  return page.locator('.bg-card.border.border-border-light.rounded-xl');
}

// ── Buy Modal ───────────────────────────────────────────────

export const buyModal = {
  /** Modal heading — "Buy {itpName}" */
  heading(page: Page): Locator {
    return page.getByRole('heading', { name: /^Buy\s/ });
  },

  amountInput(page: Page): Locator {
    // Placeholder is "e.g., 100" (i18n key: amount placeholder)
    return page.locator('input[placeholder="e.g., 100"]');
  },

  limitPriceInput(page: Page): Locator {
    // Limit price input — placeholder varies: "Set limit price" | "0 (no limit)" | "Computing price..."
    return page.locator('input[placeholder="Set limit price"], input[placeholder="0 (no limit)"], input[placeholder="Computing price..."]');
  },

  mintTestUsdcButton(page: Page): Locator {
    return page.getByRole('button', { name: /Mint 10,000 Test USDC/ });
  },

  mintedBadge(page: Page): Locator {
    return page.getByText('Minted!');
  },

  submitButton(page: Page): Locator {
    // Text cycles: "Approve & Buy" | "Buy ITP" | wallet-pending states
    return page.getByRole('button', { name: /Approve & Buy|Buy ITP/ });
  },

  orderSubmittedBanner(page: Page): Locator {
    return page.getByRole('button', { name: 'Buy More' });
  },

  buyMoreButton(page: Page): Locator {
    return page.getByRole('button', { name: 'Buy More' });
  },

  /** Balance display above the amount input: "Balance: 1,234.56 USDC" */
  balanceText(page: Page): Locator {
    return page.getByText(/Balance:\s*[\d,.]+\s*USDC/);
  },

  slippageButton(page: Page, label: string): Locator {
    return modalContainer(page).getByRole('button', { name: label, exact: true });
  },

  closeButton(page: Page): Locator {
    return modalContainer(page).locator('button:has-text("×")');
  },
};

// ── Sell Modal ──────────────────────────────────────────────

export const sellModal = {
  sharesInput(page: Page): Locator {
    return page.locator('input[placeholder="e.g., 10"]');
  },

  maxButton(page: Page): Locator {
    return page.getByRole('button', { name: 'MAX' });
  },

  submitButton(page: Page): Locator {
    return page.getByRole('button', { name: /Approve & Sell|Sell Shares/ });
  },

  orderSubmittedBanner(page: Page): Locator {
    return page.getByRole('button', { name: 'Sell More' });
  },

  closeButton(page: Page): Locator {
    return page.locator('button:has-text("×")');
  },
};

// ── Lending Section (sidebar nav → section#lend → VaultModal inline) ──

/** Navigate to Lending section via sidebar or mobile nav */
export async function navigateToLending(page: Page): Promise<boolean> {
  // Desktop sidebar
  const sidebarBtn = page.locator('aside button', { hasText: 'Lending' });
  if (await sidebarBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sidebarBtn.click();
    await page.waitForTimeout(1_000);
    return await page.getByRole('heading', { name: 'Lend' }).isVisible({ timeout: 10_000 }).catch(() => false);
  }
  // Mobile bottom nav
  const mobileBtn = page.locator('nav button', { hasText: 'Lending' });
  if (await mobileBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mobileBtn.click();
    await page.waitForTimeout(1_000);
    return await page.getByRole('heading', { name: 'Lend' }).isVisible({ timeout: 10_000 }).catch(() => false);
  }
  return false;
}

/** Scoped locator for the lending section */
export function lendSection(page: Page): Locator {
  return page.locator('#lend');
}

/**
 * Lending section action helpers — targets the inline VaultModal.
 * The VaultModal has two panels (Supply / Borrow) with action buttons
 * that toggle inline forms (Deposit, Withdraw, Borrow USDC, Repay).
 */
export const lendingSection = {
  depositButton(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Deposit', exact: true });
  },
  withdrawButton(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Withdraw', exact: true });
  },
  borrowUsdcButton(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Borrow USDC', exact: true });
  },
  repayButton(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Repay', exact: true });
  },
  amountInput(page: Page): Locator {
    return lendSection(page).locator('input[type="number"]').first();
  },
  submitDeposit(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: /Approve & Deposit|Deposit USDC/ });
  },
  submitBorrow(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: /Borrow USDC/ }).last();
  },
  submitRepay(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: /Approve & Repay|Repay Debt/ });
  },
  successDeposit(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Deposited!' });
  },
  successBorrow(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Borrowed!' });
  },
  successRepay(page: Page): Locator {
    return lendSection(page).getByRole('button', { name: 'Repaid!' });
  },
};

// ── Lending Modal (deprecated — kept for backward compat) ────

export const lendingModal = {
  borrowTab(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: 'Borrow', exact: true });
  },

  repayTab(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: 'Repay', exact: true });
  },

  deposit: {
    container(page: Page): Locator {
      return page.locator('h2:has-text("Deposit Collateral")').locator('..');
    },
    amountInput(page: Page): Locator {
      return this.container(page).locator('input[type="number"]');
    },
    maxButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'MAX' });
    },
    submitButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: /Approve & Deposit|Deposit Collateral|Deposited!/ });
    },
    successText(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'Deposited!' });
    },
  },

  borrow: {
    container(page: Page): Locator {
      return page.locator('h2:has-text("Borrow USDC")').locator('..');
    },
    amountInput(page: Page): Locator {
      return this.container(page).locator('input[type="number"]');
    },
    maxButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'MAX' });
    },
    submitButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: /Borrow USDC|Borrowed!/ });
    },
    successText(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'Borrowed!' });
    },
  },

  repay: {
    container(page: Page): Locator {
      return page.locator('h2:has-text("Repay Debt")').locator('..');
    },
    amountInput(page: Page): Locator {
      return this.container(page).locator('input[type="number"]');
    },
    maxButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'MAX' });
    },
    submitButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: /Approve & Repay|Repay Debt|Repaid!/ });
    },
    successText(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'Repaid!' });
    },
  },

  withdraw: {
    container(page: Page): Locator {
      return page.locator('h2:has-text("Withdraw Collateral")').locator('..');
    },
    amountInput(page: Page): Locator {
      return this.container(page).locator('input[type="number"]');
    },
    maxButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'MAX' });
    },
    submitButton(page: Page): Locator {
      return this.container(page).getByRole('button', { name: /Withdraw Collateral|Withdrawn!/ });
    },
    successText(page: Page): Locator {
      return this.container(page).getByRole('button', { name: 'Withdrawn!' });
    },
  },

  closeButton(page: Page): Locator {
    return modalContainer(page).locator('button:has-text("×")');
  },
};

// ── Vision Sources ─────────────────────────────────────────

/** Source cards on the browse page (data-testid on SourceCard root) */
export function sourceCard(page: Page): Locator {
  return page.locator('[data-testid="source-card"]');
}

/** Category filter pills (All, Finance, Economic, etc.) */
export function categoryPill(page: Page, label: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${label}\\s+\\d+$`) });
}

/** Stats bar on browse page (black bar with Sources/Assets/Categories counts) */
export function sourcesSectionBar(page: Page): Locator {
  return page.locator('.bg-black.text-white').filter({ hasText: 'Sources' });
}

/** Source detail back link ("< Sources") */
export function sourcesBackLink(page: Page): Locator {
  return page.getByText('Sources', { exact: false }).locator('visible=true').first();
}

/** Source detail hero section (contains source name as h1) */
export function sourceHeroTitle(page: Page): Locator {
  return page.locator('h1');
}

/** Markets section bar on detail page (.section-bar class) */
export function marketsSectionBar(page: Page): Locator {
  return page.locator('.section-bar').filter({ hasText: 'Markets' });
}

/** Markets search input on detail page */
export function marketsSearchInput(page: Page): Locator {
  return page.locator('input[placeholder="Search markets..."]');
}

/** Enter Batch panel heading — BatchEntryPanel uses "Set predictions for next tick" */
export function enterBatchHeading(page: Page): Locator {
  return page.getByText(/Set predictions|Enter Batch/i).first();
}

/** Enter Batch submit button */
export function enterBatchButton(page: Page): Locator {
  return page.getByRole('button', { name: /Enter Batch/ });
}

/** Quick stake amount buttons ($1, $5, $10, $50, $100) */
export function quickStakeButton(page: Page, amount: string): Locator {
  return page.getByRole('button', { name: amount, exact: true });
}

/** Stake input field */
export function stakeInput(page: Page): Locator {
  return page.locator('input[placeholder="0.00"]');
}

/** Strategy button (Momentum Follower, Contrarian) */
export function strategyButton(page: Page, strategyName: string): Locator {
  return page.locator('button').filter({ hasText: strategyName });
}
