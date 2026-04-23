# Solana Rent Costs — First Bettor

Audience: frontend engineers writing the pre-flight balance check.

Solana charges rent to keep accounts alive. The first bettor pays to instantiate the market. Everyone else arrives to a table already set.

## What the first bettor pays

Lazy instantiation — `place_bet` creates the `Market` PDA, the vault `TokenAccount`, and the caller's `Position` PDA in a single transaction. Rent is computed from `account_size * rent.lamports_per_byte_year * 2.0` (the two-year exemption floor).

| Account | Size source | Approx. rent |
|---|---|---|
| `Market` PDA | `Market::LEN` in `src/state.rs` | ~0.002 SOL |
| `Position` PDA (caller's) | `Position::LEN` in `src/state.rs` | ~0.001 SOL |
| Vault `TokenAccount` | SPL Token account = 165 bytes | ~0.00204 SOL |
| User USDC ATA (if missing) | SPL Token account = 165 bytes | ~0.00204 SOL |

Cross-reference `Market::LEN` and `Position::LEN` at `/programs-solana/prediction-market/programs/prediction-market/src/state.rs`. The numbers above are current as of writing. They will drift when struct layouts change.

**Estimated total: ~0.01 SOL.** With fee headroom, assume ~0.012 SOL.

## What subsequent bettors pay

The market exists. The vault exists. They pay rent for their own `Position` PDA only — roughly 0.001 SOL. If their USDC ATA is missing, add ~0.00204 SOL.

## Frontend guidance

Before calling `place_bet`, check SOL balance:

```ts
const lamports = await connection.getBalance(user);
const THRESHOLD = 0.02 * LAMPORTS_PER_SOL; // 20_000_000
if (lamports < THRESHOLD) {
  throw new InsufficientSolError(
    'Creating a market requires ~0.012 SOL for rent. You have ' +
      (lamports / LAMPORTS_PER_SOL).toFixed(4) + ' SOL.'
  );
}
```

**Recommended threshold: 0.02 SOL.** Generous, to absorb rent, transaction fee, and ATA creation. All consumers agree on this number so the UX does not fracture.

Display a clear, specific error when the check fails. Do not let the user sign a transaction that will revert on chain.

## Why the contract does not subsidize

Subsidizing rent means the program holds SOL. Holding SOL means admin keys that can drain it. Admin keys that can drain SOL are a liability we chose not to carry.

See plan H2 scope note. An admin-funded faucet is a deployment-time concern — operational, not protocol. The contract stays clean.
