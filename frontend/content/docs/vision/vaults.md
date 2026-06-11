---
title: Managed vaults
navTitle: Vaults
description: Deposit USDC, a manager plays the rounds, and you hold shares of the results.
order: 9
group: Your money
mode: explanation
---

```gmplain
A vault is a pot of money played by one manager. You put USDC in and receive shares; the manager makes the predictions with the pooled money; wins and losses change what each share is worth. You can ask for your money back at any time — it comes out as soon as the vault has idle cash, in the order people asked.
```

```gmsummary
What is a vault? :: An on-chain fund per source, traded only by its manager
How do I deposit? :: Request, then claim shares at the current share price
How do I get my money out? :: Request a redeem; instant if idle cash, else a FIFO queue
How is this different from playing myself? :: You delegate the picks and pay a performance fee
What can the manager do — and not do? :: Trade your pooled USDC; never withdraw it to themselves
Where do I see vaults in the app? :: On each source's page, with performance and history
```

## What is a vault?

A vault is an on-chain fund that plays Vision rounds with pooled depositor money. Each data source has its own vaults. A vault is a real contract — an *ERC-7540 async vault*, meaning deposits and withdrawals are requests that get fulfilled, not instant swaps — deployed as a lightweight clone from a shared factory.

The vault joins blocks exactly like any player: same `joinBatchDirect`, same parimutuel scoring, same 0.05% protocol fee on profit. The differences are who decides and who holds what:

- Only the **manager** can join blocks and set the vault's predictions.
- Depositors hold **shares** — an ERC-20 token whose value tracks the vault's assets.
- A built-in cap stops the manager from putting more than 5% of the vault's assets into a single block.

## How do I deposit?

In two steps: you request, then you claim. `requestDeposit` moves your USDC into the vault; `claimDeposit` mints your shares at the share price at claim time. Shares are minted in proportion to vault assets, so you buy in at the current value — neither diluting existing depositors nor being diluted by them.

In the app this is one flow: the deposit panel sends the approval, the request, and the claim for you.

**L3 USDC has 18 decimals.** Vault shares use 18 decimals too. A fresh vault starts at a share price of 1 share per 1 USDC.

**Testnet only.**

## How do I get my money out?

You request a redeem, and the vault pays you from its idle cash — immediately if it can, queued if it cannot.

- `requestRedeem` locks your shares in the vault.
- If the vault's idle USDC covers your shares' value, they are burned at once and the USDC is immediately claimable.
- If the money is deployed in active rounds, your request joins a **FIFO queue** — first to ask, first to be paid. Each time a round settles and capital returns, the vault sweeps the queue in order, fulfilling each request whole until the idle cash no longer covers the next one. The order is strict: a large request at the head waits until it can be paid in full, and everyone behind it waits too.
- `claimRedeem` transfers your USDC to your wallet.

There is no third party in the withdrawal path: the queue lives on the vault contract, and fulfilment is mechanical — share price at fulfilment time, in queue order.

```gmnote
The queue is swept every time a round the vault joined settles and capital returns. If a joined block never settles, anyone may call refundStuckBatch after the grace window to pull the deposit back and trigger the same sweep. How long a queued redeem waits depends on how much of the vault's cash the manager keeps deployed.
```

## How is this different from playing myself?

| | Playing yourself | Depositing in a vault |
|---|---|---|
| Who predicts | you | the manager |
| What you hold | a position in one block | shares in a pooled fund |
| When money moves | per round — join and settle | on request — deposit and redeem |
| Protocol fee | 0.05% of profit | 0.05% of profit (paid by the vault) |
| Extra fee | none | the vault's performance fee |
| Skill required | yours, every tick | none — you choose a manager instead |

The performance fee is the manager's compensation: set at vault creation, capped at 50%, and charged only on profits above the vault's **high-water mark** — the best share price the vault has ever reached. The manager earns nothing for recovering past losses, only for new highs. The fee is paid by minting the manager new shares, and each vault displays its rate in the app.

## What can the manager do — and not do?

The manager trades; the contract holds the money. The manager can join blocks with pooled USDC (within the 5%-per-block cap), set and update the vault's predictions, and earn the performance fee. The manager cannot withdraw depositor funds to themselves — the vault has no such function. USDC leaves the vault by exactly two roads: into the Vision contract to join a block, or out to a depositor claiming a redeem.

**Manager risk is real.** The structural protections do not protect you from bad predictions. A manager who predicts poorly loses depositor money round after round, exactly as a losing player loses their own. Choose managers by their record, and read [Risks and recovery](/docs/vision/risks) (~3 min).

## Where do I see vaults in the app?

On each source's page. Sources with at least one funded vault show a vault view with its assets, share price history, round-by-round results, and the deposit and redeem panel.

```gm-shot
A source's vault page showing share price history, round results, and the deposit panel.
```

Protocol-level mechanics and the vault API endpoints live in [Vault contract and endpoints](/docs/developers/vision-api/vaults) (~4 min).

```gmseealso
[{"title": "How payouts work", "href": "/docs/vision/payouts"}, {"title": "Risks and recovery", "href": "/docs/vision/risks"}, {"title": "Vault contract and endpoints (API)", "href": "/docs/developers/vision-api/vaults"}]
```

Next: [Read the leaderboard](/docs/vision/leaderboard) (~2 min)
