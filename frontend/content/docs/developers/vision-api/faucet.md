---
title: Faucet
navTitle: Faucet
description: POST /api/faucet and POST /api/bot/faucet — request, response, cooldowns, and the waitlist gate.
order: 10
group: Vision API
mode: reference
method: POST
---

```gmplain
The faucet gives you play money. You send it your wallet address; it mints testnet USDC to you and sends a little gas so you can transact. There are two doors: one for people using the app, one for bots that claim once a day. Both refuse strangers — your address has to be on the waitlist first.
```

```gmsummary
Which faucet? :: Manual faucet for top-ups; bot faucet is one fixed daily claim
POST /api/faucet :: Default 100 USDC + 1 GM, capped at 10,000, 30-second cooldown
POST /api/bot/faucet :: Fixed 100 USDC + 1 GM, one claim per day
```

**Testnet only.** Faucet money is not real money, and nothing on the L3 is.

**L3 USDC has 18 decimals.** A "100 USDC" grant is `100 × 1e18` on-chain. 0.1 USDC = 1e17.

**Both faucets are waitlist-gated by default.** An address that is not whitelisted gets `403 WAITLIST_REQUIRED` — this also breaks any unattended auto-faucet call a bot makes with a fresh key.

## Which faucet?

Two endpoints mint the same testnet money with different throttles.

| | `POST /api/faucet` | `POST /api/bot/faucet` |
|---|---|---|
| Grant | amount you ask for (default 100 USDC); above 10,000 is clamped to 10,000 | fixed 100 USDC |
| Gas | 1 GM | 1 GM |
| Cooldown | 30 s per address | 24 h per IP **and** per address |
| Waitlist gate | yes | yes |
| Meant for | the app UI, manual top-ups | bots claiming once a day |

## POST /api/faucet

Mints testnet L3 USDC to an address and drips 1 GM of gas.

```gm-try
{"method": "POST", "path": "/api/faucet", "params": [], "body": {"address": "0x9a3f…c21b", "amount": "100", "scope": "vision"}, "response": {"success": true, "to": "0x9a3f…c21b", "scope": "vision", "vision": {"usdc": {"hash": "0x5e0c…", "amount": "100 USDC"}, "gas": {"hash": "0x77b1…", "amount": "1 GM"}}}}
```

Request body:

| Field | Type | Meaning |
|---|---|---|
| `address` | string, required | 0x + 40 hex chars |
| `amount` | string or number, optional | USDC to mint; default 100; values above 10,000 are clamped, not rejected; 0, negative, or non-numeric → `400` |
| `scope` | string, optional | `vision` (default), `itp`, or `both` |

- The `vision` leg mints `amount` L3 USDC (18 decimals) and sends 1 GM gas. The gas drip is skipped with `{"error": "Deployer low on GM"}` when the faucet wallet runs low.
- `itp` and `both` mint Settlement-chain USDC (6 decimals) plus 0.5 S gas — admin and E2E tooling only; the UI never uses them. Why the decimals differ: [Settlement and the bridge](/docs/index/settlement-and-bridge) (~5 min).
- Each leg reports independently. A failed leg still returns `200` with `{"error": …}` in that leg's slot — check inside `vision.usdc` and `vision.gas`, not just the status code.

Errors:

| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "Invalid address"}` / `{"error": "Invalid amount"}` | address fails the hex check, or amount ≤ 0 |
| 403 | `{"error": "WAITLIST_REQUIRED", "waitlistUrl": "…"}` | address not whitelisted — the gate is on by default |
| 429 | `{"error": "COOLDOWN", "retryAfter": N}` + `Retry-After` header | same address claimed within the last 30 s |
| 500 | `{"error": "…"}` | whitelist check or transaction failed |

## POST /api/bot/faucet

Drips a fixed 100 L3 USDC + 1 GM to a bot wallet — one claim per IP and per address every 24 hours.

```gm-try
{"method": "POST", "path": "/api/bot/faucet", "params": [], "body": {"address": "0x9a3f…c21b"}, "response": {"success": true, "to": "0x9a3f…c21b", "ip": "203.0.113.7", "retry_after_seconds": 86400, "usdc": {"hash": "0x5e0c…", "amount": "100 USDC"}, "l3Gas": {"hash": "0x77b1…", "amount": "1 GM"}}}
```

- Body is `{"address": "0x…"}` — no amount, no scope. The grant is fixed.
- The same waitlist gate applies (`403 WAITLIST_REQUIRED`).
- **The 24 h lock is recorded before the mint.** A claim that fails mid-mint still burns the window.
- The gas drip can fail independently: `l3Gas` then carries `{"error": …}` while `usdc` succeeded.

Errors:

| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "Invalid address"}` | malformed address |
| 403 | `{"error": "WAITLIST_REQUIRED", "waitlistUrl": "…"}` | address not whitelisted |
| 429 | `{"error": "Rate limit: this IP already claimed. Try again in Xh"}` (or `this address already claimed`) | IP or address claimed within 24 h — each has its own 429 message |
| 503 | `{"error": "Rate limiter unavailable — …"}` | the throttle backend is down; production fails closed rather than dripping unmetered |
| 500 | `{"error": "…"}` | mint failed |

```gmseealso
[{"title": "Connect a wallet and get test USDC", "href": "/docs/get-started/connect-and-fund"}, {"title": "Run the reference bot in 5 minutes", "href": "/docs/bots/quickstart"}]
```

Next: [Prices and DTFs](/docs/developers/index-api/markets) (~4 min)
