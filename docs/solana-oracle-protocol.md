# Solana Oracle Protocol

The canonical signing spec for the prediction-market oracle. Audience: daemon operators and anyone building an alternate oracle client.

Everything here is fixed. The contract verifies these bytes exactly — drift and your signatures will be rejected without explanation.

## Decimal convention

All on-chain prices are `u128 = native_price * 10^18`.

The data-node is responsible for normalization. A feed with native 8-decimal prices scales up by 10^10. A feed already in 18 decimals ships as-is. Contract math assumes this invariant without verification — there is no decimal oracle, only a convention that cannot be violated.

Mismatched decimals become silent bankruptcies. Normalize once, at ingestion.

## Payload byte layouts

Two shapes, domain-tagged to prevent replay between `close_market` and `resolve_market`.

### Close — 29 bytes

| Offset | Length | Field | Encoding |
|---|---|---|---|
| 0 | 4 | `source_id` | `u32` LE |
| 4 | 8 | `close_time` | `i64` LE |
| 12 | 16 | `baseline_price` | `u128` LE |
| 28 | 1 | `TAG_CLOSE` | `0x01` |

### Resolve — 29 bytes

| Offset | Length | Field | Encoding |
|---|---|---|---|
| 0 | 4 | `source_id` | `u32` LE |
| 4 | 8 | `settlement_time` | `i64` LE |
| 12 | 16 | `final_price` | `u128` LE |
| 28 | 1 | `TAG_RESOLVE` | `0x02` |

Reference: `/programs-solana/prediction-market/programs/prediction-market/src/oracle.rs` — functions `build_close_payload`, `build_resolve_payload`, constants `TAG_CLOSE = 1`, `TAG_RESOLVE = 2`, `PAYLOAD_LEN = 29`. If the program's encoding ever changes, this doc is wrong — amend it.

## Signing

Ed25519 over the 29-byte payload. No hashing first. No length prefix. No envelope.

Solana keypairs ARE ed25519 keypairs. The signer pubkey is the first 32 bytes of the keypair seed — the same pubkey that appears in `OracleConfig.active_signers`. No translation layer, no derivation path.

The signature is submitted via Solana's native ed25519 precompile. The program reads the `Instructions` sysvar and asserts that position `i` in the transaction is a precompile call that verified `sigs[i]` over the expected payload using a pubkey from the active signer set.

## Multi-sig

The contract accepts `Vec<[u8; 64]>` — N raw 64-byte signatures. No `SigEntry` wrapper, no per-signature pubkey (the precompile instruction carries it).

Rules:

- `sigs.len() >= OracleConfig.active_threshold`
- Every signer pubkey must appear in `OracleConfig.active_signers`
- No duplicate signers within a single verification
- Every signature must match the same `expected` payload

Violating any of these returns `ErrorCode::BadSignature` or `ErrorCode::ThresholdNotMet`. The contract does not tell you which signer failed — it tells you the aggregate failed. Debug off-chain.

## Domain tags

`TAG_CLOSE = 0x01` and `TAG_RESOLVE = 0x02` occupy the final byte of each payload. They exist so a `close_market` signature cannot be replayed as a `resolve_market` signature. The rest of the payload could collide — the tag ensures the two instructions cannot share a signature.

Never reuse a tag byte. Never omit it. The program will reject an unsigned or wrongly-tagged payload without commentary.

## SDK pin

The program pins `solana-program = "=1.18.26"` in `Cargo.toml`. This is deliberate.

The `Ed25519Offsets` struct mirrors the runtime's precompile layout — 14 bytes, little-endian offsets, packed. A `const _: () = assert!(core::mem::size_of::<Ed25519Offsets>() == 14);` at compile time catches most drift. CI additionally hashes the byte layout on every build to catch upstream changes the compiler would silently accept.

If Solana revs the precompile format, every oracle client breaks simultaneously. The pin is not laziness — it is the fence around the abyss.
