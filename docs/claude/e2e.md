# E2E testing efficiency

**TL;DR.** For suites > 20 tests, never run the full suite while debugging. Fix → run individual → verify → next failure.

## Run only what's failing

```bash
# One specific test
npx playwright test --config=e2e/playwright.config.ts e2e/tests/02-buy-itp.spec.ts

# By pattern
npx playwright test --grep "buy ITP|sell ITP"
```

## Rules

- Full suite is the **final** validation step, after all individual tests pass.
- Never run 176 tests to check 5 fixes.
- Time-to-end-of-dev is the priority. Skip tests we know work.

## Testnet E2E

- Run `./switch-env.sh testnet` **before** any testnet E2E session.
- All E2E config lives in `frontend/e2e/env.ts`. Helpers and specs import from there.
- ITP and Vision are separate Playwright projects running on 2 workers in parallel. ITP tests run serially (01 → 09 → 16–18); Vision tests run serially (10 → 15 → 19–21).
- Restart the system before a full E2E run. Stale L3 orders confuse issuers.
- Mock wallet uses Anvil auto-accept. No impersonation needed.
- USDC decimals: L3 = 18, Settlement (Arb) = 6.
- **Never skip tests on testnet. Adapt them instead.** No `test.skip(!IS_ANVIL)`. Create the required data programmatically.
