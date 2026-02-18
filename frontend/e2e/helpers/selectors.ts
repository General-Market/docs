/**
 * Centralized UI selectors for E2E tests.
 * Since the codebase doesn't use data-testid attributes, we target
 * elements by role, text content, and CSS hierarchy.
 */
import { type Page, type Locator } from '@playwright/test';

// ── Wallet ──────────────────────────────────────────────────

export function connectWalletButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Connect Wallet' });
}

export function disconnectButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Disconnect' });
}

export function switchNetworkButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Switch to Index Arbitrum' });
}

// ── ITP Listing ─────────────────────────────────────────────

export function itpCard(page: Page): Locator {
  // ITP cards are inside the listing grid
  return page.locator('.bg-terminal-dark.border.border-white\\/10.rounded-lg.p-4');
}

export function buyButton(page: Page): Locator {
  // The "Buy" button on an ITP card (accent background, small)
  return itpCard(page).first().getByRole('button', { name: 'Buy', exact: true });
}

export function sellButton(page: Page): Locator {
  return itpCard(page).first().getByRole('button', { name: 'Sell', exact: true });
}

export function borrowButtonOnCard(page: Page): Locator {
  return itpCard(page).first().getByRole('button', { name: 'Borrow', exact: true });
}

export function rebalanceButton(page: Page): Locator {
  return itpCard(page).first().getByRole('button', { name: 'Rebalance', exact: true });
}

// ── Modal backdrop ──────────────────────────────────────────

export function modalBackdrop(page: Page): Locator {
  return page.locator('.fixed.inset-0.bg-black\\/80');
}

export function modalContainer(page: Page): Locator {
  return page.locator('.bg-terminal.border.border-white\\/20.rounded-lg');
}

// ── Buy Modal ───────────────────────────────────────────────

export const buyModal = {
  amountInput(page: Page): Locator {
    return modalContainer(page).locator('input[placeholder="e.g., 100"]');
  },

  limitPriceInput(page: Page): Locator {
    // The second number input in the modal (Max Price)
    return modalContainer(page).locator('input[type="number"]').nth(1);
  },

  mintTestUsdcButton(page: Page): Locator {
    return page.getByRole('button', { name: /Mint 10,000 Test USDC/ });
  },

  mintedBadge(page: Page): Locator {
    return page.getByText('Minted!');
  },

  submitButton(page: Page): Locator {
    // The main submit button — text varies by state
    return modalContainer(page).getByRole('button', { name: /Approve & Buy|Buy ITP/ });
  },

  orderSubmittedBanner(page: Page): Locator {
    return page.getByText('Order Submitted');
  },

  buyMoreButton(page: Page): Locator {
    return page.getByRole('button', { name: 'Buy More' });
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
    return modalContainer(page).locator('input[placeholder="e.g., 10"]');
  },

  maxButton(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: 'Max', exact: true });
  },

  submitButton(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: /Approve & Sell|Sell Shares/ });
  },

  orderSubmittedBanner(page: Page): Locator {
    return page.getByText('Cross-Chain Sell Order Submitted');
  },

  closeButton(page: Page): Locator {
    return modalContainer(page).locator('button:has-text("×")');
  },
};

// ── Lending Modal ───────────────────────────────────────────

export const lendingModal = {
  borrowTab(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: 'Borrow', exact: true });
  },

  repayTab(page: Page): Locator {
    return modalContainer(page).getByRole('button', { name: 'Repay', exact: true });
  },

  // Deposit Collateral section
  // Each lending component has: <div class="bg-terminal-dark..."><h2>Section Title</h2>...
  // We target the h2 then go up ONE level to the component root div.
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

  // Borrow USDC section
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

  // Repay Debt section
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

  // Withdraw Collateral section
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
