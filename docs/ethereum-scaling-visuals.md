# Ethereum Scaling Roadmap — Visual Summary

10 ASCII diagrams covering the short-term and long-term Ethereum scaling roadmap,
from Glamsterdam gas repricings through ZK-EVM staged rollout.

---

## 1. The Big Picture

**THE POINT:** Five independent scaling initiatives converge over 3 years to 100x Ethereum's throughput while keeping solo staking viable.

```
 TODAY                                                  FUTURE (2028+)
 ~15 TPS                                               ~1,500 TPS (100x)
 ┌─┐                                                   ┌───────────────────────────────────────────────────────────┐
 │█│                                                   │███████████████████████████████████████████████████████████│
 └─┘                                                   └───────────────────────────────────────────────────────────┘
  ^                                                      ^
  one bar = 15 TPS                                       100 bars = 1,500 TPS


 HOW WE GET THERE (each arrow = "enables the next"):
 ═══════════════════════════════════════════════════════════════════════════════════

      2025 Glamsterdam            2026-2027                    2028+
      ─────────────────           ───────────                  ──────────
              │                        │                            │
              ▼                        ▼                            ▼
      ┌───────────────┐       ┌─────────────────┐        ┌────────────────┐
      │ ACCESS LISTS  │──────▶│                 │        │                │
      │ parallel exec │       │  RAISE GAS      │───────▶│  SOLO STAKER   │
      │ 3x faster     │──┐   │  LIMITS         │        │  STILL         │
      └───────────────┘  │   │  10-30x compute │   ┌───▶│  VALIDATES     │
                         │   └─────────────────┘   │    │                │
      ┌───────────────┐  │                         │    │  verify proof  │
      │ ePBS          │──┘   ┌─────────────────┐   │    │  + sample data │
      │ 10x verify    │      │  BLOBS + PeerDAS│   │    │  = enough      │
      │ time per slot │      │  ~8 MB/sec DA   │───┘    └────────────────┘
      └───────────────┘      │  sample, don't  │
                             │  download       │
      ┌───────────────┐      └─────────────────┘
      │ MULTIDIM. GAS │
      │ decouple exec │      ┌─────────────────┐
      │ from state    │─────▶│  ZK-EVM         │───────▶ no re-execution
      └───────────────┘      │  5% → 20% → 3/5 │        just check proof
                             └─────────────────┘
```

---

## 2. Short-Term: Parallel Block Verification

**THE POINT:** Blocks verify 3x faster by running non-conflicting transactions simultaneously, because access lists reveal which transactions touch which state.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  TODAY: SEQUENTIAL — 800ms to verify 8 transactions
 ═══════════════════════════════════════════════════════════════════════════════════

  Each transaction MIGHT read state that the previous one wrote.
  No way to know in advance. Must go one at a time.

  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  TIME ──────────────────────────────────────────────────────────────────▶  │
  │                                                                            │
  │  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐              │
  │  │ Tx1 ││ Tx2 ││ Tx3 ││ Tx4 ││ Tx5 ││ Tx6 ││ Tx7 ││ Tx8 │   800ms     │
  │  │100ms││100ms││100ms││100ms││100ms││100ms││100ms││100ms│   total     │
  │  └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘              │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════════
  WITH ACCESS LISTS: PARALLEL — 300ms for the same 8 transactions
 ═══════════════════════════════════════════════════════════════════════════════════

  Block header now declares what state each transaction touches.
  Validators build a conflict graph and run independent lanes in parallel.

  STEP 1 — Detect conflicts from access list:

  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  Tx1: [slot A, B]    ─ conflict group 1 ─┐                                │
  │  Tx3: [slot A, D]    ─ conflict group 1 ─┤                                │
  │  Tx7: [slot B, D]    ─ conflict group 1 ─┘                                │
  │                        (share slots A, B, D — must serialize)              │
  │                                                                            │
  │  Tx2: [slot C]       ─ conflict group 2 ─┐                                │
  │  Tx5: [slot C]       ─ conflict group 2 ─┘                                │
  │                        (share slot C — must serialize)                     │
  │                                                                            │
  │  Tx4: [slot E]       ─ independent                                        │
  │  Tx6: [slot F]       ─ independent                                        │
  │  Tx8: [slot G]       ─ independent                                        │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘

  STEP 2 — Assign conflict groups to parallel lanes:

  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  TIME ──────────────────────────────────────────────────────────────────▶  │
  │                                                                            │
  │  Lane 1:  ┌─────┐ ┌─────┐ ┌─────┐                                        │
  │           │ Tx1 │ │ Tx3 │ │ Tx7 │  (A → A,D → B,D chain)                 │
  │           └─────┘ └─────┘ └─────┘                                         │
  │                                                                            │
  │  Lane 2:  ┌─────┐ ┌─────┐                                                │
  │           │ Tx2 │ │ Tx5 │          (C → C chain)                           │
  │           └─────┘ └─────┘                                                  │
  │                                                                            │
  │  Lane 3:  ┌─────┐                                                         │
  │           │ Tx4 │                  (independent)                            │
  │           └─────┘                                                          │
  │                                                                            │
  │  Lane 4:  ┌─────┐                                                         │
  │           │ Tx6 │                  (independent)                            │
  │           └─────┘                                                          │
  │                                                                            │
  │  Lane 5:  ┌─────┐                                                         │
  │           │ Tx8 │                  (independent)                            │
  │           └─────┘                                                          │
  │           ├─────┤ ├─────┤ ├─────┤                                         │
  │           100ms   100ms   100ms                                            │
  │                                                                            │
  │   ┌──────────────────────────────────────────────────────────────────┐     │
  │   │  RESULT: 300ms total.  2.7x FASTER.  Same 8 transactions.      │     │
  │   │  Typical Ethereum blocks: ~2-4x speedup in practice.            │     │
  │   └──────────────────────────────────────────────────────────────────┘     │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Short-Term: ePBS Slot Utilization

**THE POINT:** Today, validators use only 2.5% of a 12-second slot for verification. ePBS creates a dedicated verification window — giving 10x more time to verify bigger blocks.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  TODAY: VALIDATOR TIME BUDGET IN A 12-SECOND SLOT
 ═══════════════════════════════════════════════════════════════════════════════════

  ◀──────────────────────────── 12 seconds ─────────────────────────────────▶

  ┌──────┬──────────────────────────────────────────────────────────────────┐
  │ VRFY │                                                                  │
  │~300ms│              WASTED / SAFETY MARGIN                              │
  │ 2.5% │              (97.5% of slot unused)                              │
  │      │                                                                  │
  │██████│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
  └──────┴──────────────────────────────────────────────────────────────────┘
          ▲
          │
          WHY so little? Proposer builds block, broadcasts it, validators
          must attest FAST. Any delay = missed attestation = penalty.
          Nobody dares use more time. Verification budget is tiny.

 ═══════════════════════════════════════════════════════════════════════════════════
  WITH ePBS: SPLIT ROLES, DEDICATED VERIFICATION WINDOW
 ═══════════════════════════════════════════════════════════════════════════════════

  ◀──────────────────────────── 12 seconds ─────────────────────────────────▶

  ┌──────────────────┬──────────────────┬───────────────────────────────────┐
  │                  │                  │                                   │
  │   BUILDER        │   PROPOSER       │   VERIFICATION WINDOW            │
  │   builds block   │   commits to     │                                  │
  │   (specialized)  │   block header   │   ████████████████████████████   │
  │                  │   (fast)         │   ~3-4 seconds safe to use       │
  │                  │                  │   = 10x more than today          │
  │                  │                  │                                   │
  └──────────────────┴──────────────────┴───────────────────────────────────┘
                                        ▲
                                        │
                                        Proposer COMMITTED to the block
                                        header already. Verification has
                                        its own protected time window.
                                        No attestation deadline pressure.

 ═══════════════════════════════════════════════════════════════════════════════════
  COMBINED IMPACT: ePBS + PARALLEL VERIFICATION
 ═══════════════════════════════════════════════════════════════════════════════════

  TODAY:   ~300ms budget, sequential execution
           ┌─┐
           │█│  = ~15 TPS
           └─┘

  FUTURE:  ~3,000ms budget (10x), 3 parallel lanes (3x) = 30x capacity
           ┌──────────────────────────────────┐
           │██████████████████████████████████│  = ~300-500 TPS
           └──────────────────────────────────┘

  ePBS (10x time) x parallel verify (3x speed) = ~30x more compute per slot
```

---

## 4. Multidimensional Gas: The Split

**THE POINT:** Ethereum's gas limit can't go up because raising it grows the permanent state trie. Solution: split gas into two independent dimensions so execution can scale without growing the chain's disk footprint.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  THE PROBLEM: ONE GAS DIMENSION COUPLES TWO UNRELATED THINGS
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  TODAY: one gas pool (~30M gas per block)                                │
  │                                                                          │
  │  EXECUTION (computation)        STATE GROWTH (disk, forever)             │
  │  ┌────────────────────────────────────────────────────────┐             │
  │  │ █████████████████████████████████████████████████████  │             │
  │  │          all in one pool — can't separate them          │             │
  │  └────────────────────────────────────────────────────────┘             │
  │                                                                          │
  │  Want more compute?  Must also accept more state growth.                │
  │  Want to cap state?  Must also cap compute.                             │
  │                                                                          │
  │  Ethereum state trie today: ~200 GB and growing 30-50 GB/year.          │
  │  At 10x gas limit: state would grow 300-500 GB/year. Unsustainable.     │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════════
  THE FIX: GLAMSTERDAM SPLITS GAS INTO TWO INDEPENDENT DIMENSIONS
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  DIMENSION 1: EXECUTION GAS              DIMENSION 2: STATE CREATION    │
  │  (computation, memory, calldata)          (new trie nodes only)          │
  │                                                                          │
  │  ┌──────────────────────────────┐        ┌────────────────────────────┐ │
  │  │ ████████████████████████████ │        │ ████████                   │ │
  │  │ limit: ~16M tx gas           │        │ limit: separate, tight     │ │
  │  │ CAN RAISE FREELY             │        │ STAYS BOUNDED              │ │
  │  └──────────────────────────────┘        └────────────────────────────┘ │
  │        │                                       │                        │
  │        │  Raise this → more TPS                │  This stays flat       │
  │        │  more computation per block            │  state grows slowly    │
  │        │  bigger contracts deployable            │  disk stays manageable │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CONCRETE TRAJECTORY:                                                    │
  │                                                                          │
  │  Execution gas limit (can grow):        State creation limit (stays):   │
  │                                                                          │
  │        ▲                                       ▲                        │
  │  300M  │                    ╱                   │                        │
  │        │                  ╱                     │                        │
  │  100M  │               ╱                   1M  │─────────────────────── │
  │        │            ╱                          │                        │
  │   30M  │─────────╱                             │                        │
  │        └──────────────────▶ time               └──────────────────▶     │
  │        2025  2026  2027  2028               2025  2026  2027  2028     │
  │                                                                          │
  │  30M → 300M (10x)  = 10x more compute         stays at ~1M             │
  │  State trie growth: unchanged.                                          │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. The Reservoir Mechanism + Call Invariants

**THE POINT:** Old contracts see one gas number. New contracts see N dimensions. The reservoir is a backwards-compatible bridge — it absorbs overflow from specialized dimensions and is what the `GAS` opcode returns.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  HOW IT WORKS: SPECIALIZED DIMENSIONS OVERFLOW INTO THE RESERVOIR
 ═══════════════════════════════════════════════════════════════════════════════════

  A call frame starts with gas in each dimension:

  STATE_CREATION      RESERVOIR (the "catch-all")
  ┌─────────────┐     ┌─────────────────────────┐
  │   100,000   │     │        100,000           │  <-- GAS opcode returns THIS
  └─────────────┘     └─────────────────────────┘

  Execute 3 SSTOREs (zero -> nonzero), each costs 55K state creation gas:

  -- SSTORE #1 ──────────────────────────────────────────────────────────────

  STATE_CREATION: 100K                   RESERVOIR: 100K
  ┌──────────────────────────────────┐   ┌──────────────────────────────────┐
  │█████████████████████████████████ │   │█████████████████████████████████ │
  └──────────────────────────────────┘   └──────────────────────────────────┘
            - 55K from specialized
  STATE_CREATION: 45K                    RESERVOIR: 100K (untouched)
  ┌██████████████░░░░░░░░░░░░░░░░░░─┐   ┌──────────────────────────────────┐
  │██████████████                    │   │█████████████████████████████████ │
  └──────────────────────────────────┘   └──────────────────────────────────┘

  -- SSTORE #2 ──────────────────────────────────────────────────────────────

  Need 55K, only 45K left in specialized.
  Drain specialized to 0, take remaining 10K from reservoir.

  STATE_CREATION: 0                      RESERVOIR: 90K
  ┌──────────────────────────────────┐   ┌────────────────────────────────┐
  │                                  │   │████████████████████████████    │
  └──────────────────────────────────┘   └────────────────────────────────┘
    ^^^ empty                              ^^^ absorbed 10K overflow

  -- SSTORE #3 ──────────────────────────────────────────────────────────────

  Specialized empty. ALL 55K from reservoir.

  STATE_CREATION: 0                      RESERVOIR: 35K
  ┌──────────────────────────────────┐   ┌──────────────────┐
  │                                  │   │███████████       │
  └──────────────────────────────────┘   └──────────────────┘
                                           ^^^ if this hits 0 = out of gas

 ═══════════════════════════════════════════════════════════════════════════════════
  CONSUMPTION RULE
 ═══════════════════════════════════════════════════════════════════════════════════

  1. Drain SPECIALIZED dimension first
  2. If specialized empty  -->  overflow into RESERVOIR
  3. If reservoir empty    -->  OUT OF GAS (revert)

 ═══════════════════════════════════════════════════════════════════════════════════
  HOW CALL PRESERVES BACKWARD COMPATIBILITY
 ═══════════════════════════════════════════════════════════════════════════════════

  Contract A calls Contract B with gas = 60,000:

  ┌── CONTRACT A (caller) ──────────────────────────────────────────────────┐
  │                                                                          │
  │  state_creation:  20,000                                                │
  │  reservoir:       80,000     <-- GAS opcode returns 80K                │
  │                                                                          │
  │  CALL(gas=60000, to=B)                                                  │
  │         │                                                                │
  │         │  passes: 60K from reservoir + ALL of state_creation (20K)     │
  │         │                                                                │
  │         ▼                                                                │
  │  ┌── CONTRACT B (callee) ────────────────────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  state_creation:  20,000  <-- all non-reservoir passed through    │  │
  │  │  reservoir:       60,000  <-- exactly the gas A specified         │  │
  │  │                                                                    │  │
  │  │  B can use 60K for ANY purpose. State creation overflows into     │  │
  │  │  reservoir seamlessly. B sees one gas number. Works.              │  │
  │  │                                                                    │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  │         │                                                                │
  │         │ B returns (used 40K reservoir, returned 10K state_creation)   │
  │         ▼                                                                │
  │  A's state after call:                                                  │
  │  state_creation:  10,000     <-- whatever B returned                   │
  │  reservoir:       20,000 + leftover   <-- A kept 20K + B's unused     │
  │                                                                          │
  │  GAS opcode: at least 80K - 60K = 20K                                  │
  │  Legacy pattern: remaining = GAS(); CALL(60K); assert(GAS() >= 20K)    │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TWO INVARIANTS THAT MAKE THIS WORK:                                    │
  │                                                                          │
  │  1. CALL with X gas  -->  callee gets X usable gas (from reservoir)    │
  │  2. GAS returns Y, CALL with X  -->  still have >= Y-X after           │
  │                                                                          │
  │  Old contracts see ONE gas number (reservoir).                          │
  │  Multi-dimensional accounting is invisible to them.                     │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Multidimensional Gas Roadmap

**THE POINT:** Gas evolves from one crude number to multiple floating-price dimensions — each EVM resource priced independently at market rate, so NFT mint storms don't make your simple transfer expensive.

```
 ═══════════════════════════════════════════════════════════════════════════════════

  STAGE 1: TODAY                     One pool, one price
 ─────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  GAS  (single dimension)                                             │
  │                                                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │ ████████████████████████████████████████████████████████████ │   │
  │  │ execution + storage + calldata + everything — one pool       │   │
  │  │ block cap: ~30M gas                                          │   │
  │  └──────────────────────────────────────────────────────────────┘   │
  │                                                                      │
  │  Problem: NFT mint (state-heavy) competes with simple transfer      │
  │  (compute-only) in the same pool. Both bid up the same base fee.    │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  STAGE 2: GLAMSTERDAM              Two dimensions, separate limits
 ─────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  EXECUTION + CALLDATA                  STATE CREATION                │
  │  ┌──────────────────────────────┐      ┌───────────────────────┐    │
  │  │ ████████████████████████████ │      │ ████████              │    │
  │  │ computation, memory, LOG     │      │ SSTORE 0->NZ, CREATE  │    │
  │  │ cap: ~16M tx (RAISABLE)     │      │ cap: tight (BOUNDED)  │    │
  │  └──────────────────────────────┘      └───────────────────────┘    │
  │       │                                      │                      │
  │       │    ┌─────────────────────────┐       │                      │
  │       └───▶│ RESERVOIR              │◀──────┘                      │
  │            │ backward-compat bridge │  overflow from specialized   │
  │            └─────────────────────────┘                              │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
  STAGE 3: FUTURE (2027+)          N dimensions, floating prices per resource
 ─────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  EXECUTION       CALLDATA        STATE CREATE     STATE ACCESS       │
  │  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐     │
  │  │ █████████ │   │ ██████    │   │ ██        │   │ █████     │     │
  │  │           │   │           │   │           │   │           │     │
  │  │ price:    │   │ price:    │   │ price:    │   │ price:    │     │
  │  │  8 gwei   │   │  3 gwei   │   │ 50 gwei   │   │ 12 gwei   │     │
  │  │  ▲▼ float │   │  ▲▼ float │   │  ▲▼ float │   │  ▲▼ float │     │
  │  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘     │
  │        │               │               │               │            │
  │        └───────────────┴───────┬───────┴───────────────┘            │
  │                                │                                     │
  │                          ┌─────▼─────┐                               │
  │                          │ RESERVOIR │  legacy bridge (GAS, CALL)    │
  │                          └───────────┘                               │
  │                                                                      │
  │  Each dimension: own EIP-1559-style base fee.                       │
  │  Scarce resource? Price rises. Abundant? Price drops.               │
  └──────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │  WHY IT MATTERS — CONCRETE EXAMPLE:                                  │
  │                                                                      │
  │  Today, during an NFT mint storm:                                   │
  │    Simple ETH transfer: 21K gas x 200 gwei = $12.00                 │
  │    (you pay more because NFT minters bid up the SAME base fee)      │
  │                                                                      │
  │  Future, with N-dimensional gas:                                    │
  │    NFT mints spike STATE CREATION price: 50 gwei → 500 gwei        │
  │    EXECUTION price (your transfer): stays at 8 gwei                 │
  │    Simple ETH transfer: 21K gas x 8 gwei = $0.50                   │
  │    (different dimension — your transfer barely affected)             │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Blobs + PeerDAS: Data Availability

**THE POINT:** Today every validator downloads all data and re-executes all transactions. Future: validators sample random blobs (PeerDAS) and check a ZK proof. Same security, 1000x less work per validator.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  TODAY: FULL DOWNLOAD + FULL RE-EXECUTION
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌── BLOCK PRODUCER ──────────────────────────────────────────────────────┐
  │  Builds block with all transactions + data                             │
  └───────────────────────────────┬────────────────────────────────────────┘
                                  │  broadcast ENTIRE block to network
                                  ▼
  ┌── EVERY VALIDATOR (all ~900K of them) ─────────────────────────────────┐
  │                                                                        │
  │  1. Download ALL block data             <-- bandwidth bottleneck      │
  │     ████████████████████████████████████████████████████████████       │
  │     (must get every byte — ~0.4 MB today)                             │
  │                                                                        │
  │  2. Re-execute ALL transactions         <-- computation bottleneck    │
  │     Tx1 → Tx2 → Tx3 → ... → TxN                                      │
  │     (repeat every calculation the producer already did)                │
  │                                                                        │
  │  3. Check: my state root == producer's state root?                    │
  │                                                                        │
  │  Both steps must fit within slot time.                                │
  │  Throughput limited to what the WEAKEST solo staker can handle.        │
  └────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════════
  FUTURE: BLOBS + PeerDAS + ZK PROOFS
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌── BLOCK PRODUCER ──────────────────────────────────────────────────────┐
  │                                                                        │
  │  ┌── EXECUTION HEADER ──┐     ┌── BLOB DATA ──────────────────────┐  │
  │  │  state root           │     │  ┌────┬────┬────┬────┬────┬────┐  │  │
  │  │  ZK-SNARK proof       │     │  │ b0 │ b1 │ b2 │ b3 │ b4 │... │  │  │
  │  │  (proves valid exec)  │     │  └────┴────┴────┴────┴────┴────┘  │  │
  │  │  tiny, cheap to check │     │  erasure coded + KZG commitments  │  │
  │  └──────────┬────────────┘     │  target: ~8 MB/sec (20x today)    │  │
  │             │                  └──────────────┬───────────────────┘  │
  └─────────────┼─────────────────────────────────┼─────────────────────┘
                │                                 │
                ▼                                 ▼
  ┌── VALIDATOR ───────────────────────────────────────────────────────────┐
  │                                                                        │
  │  Execution valid?                                                     │
  │  Old way:  re-execute 1000 txs  ████████████████████████████████████  │
  │  New way:  check one proof      ██                                    │
  │                                                                        │
  │  Data available?                                                      │
  │  Full blob data:    ████████████████████████████████  (~8 MB)         │
  │  This validator:    █░░░░█░░░░░░█░░░█░░░░░█░░░█░░░  (tiny sample)   │
  │  Erasure coding: enough random samples across validators              │
  │  = full data IS recoverable. No one downloads all.                    │
  │                                                                        │
  └────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TOTAL VALIDATOR WORK — BEFORE vs AFTER:                                │
  │                                                                          │
  │  TODAY:   ████████████████████████████████████████  (heavy)             │
  │  FUTURE:  ████                                     (minimal)            │
  │           check proof + sample blobs = solo staker friendly              │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. ZK-EVM Staged Rollout

**THE POINT:** ZK-EVM proving replaces re-execution but is too risky to flip on overnight. Solution: a cautious multi-year rollout where the ZK fraction grows from 5% to 100% as confidence increases — culminating in a multi-client 3-of-5 consensus requirement.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  ZK-EVM ADOPTION: THREE STAGES OVER FOUR YEARS
 ═══════════════════════════════════════════════════════════════════════════════════

  ◀─── 2026 ──────────────── 2027 ──────────────── 2028 ──── 2029+ ─────▶

  STAGE 1 (~5%)               STAGE 2 (~20%)              STAGE 3 (100%)
  ZK is OPTIONAL              gas limits raised            3-of-5 REQUIRED

  Validators:                 Validators:                  Validators:
  ┌──┐                        ┌──┐┌──┐┌──┐┌──┐            ┌──┐┌──┐┌──┐┌──┐┌──┐
  │ZK│ o o o o o o o o o      │ZK││ZK││ZK││ZK│ o o o o    │ZK││ZK││ZK││ZK││ZK│
  └──┘ (95% re-execute)       └──┘└──┘└──┘└──┘(80% trad)  └──┘└──┘└──┘└──┘└──┘

  ZK:  █░░░░░░░░░░░░░░░░░░   ████░░░░░░░░░░░░░░░░░░░░   ████████████████████
       5%                     20%                          100% — ALL use proofs

 ─────────────────────────────────────────────────────────────────────────────
  STAGE 1: ~5% (2026) — Prove the technology works
 ─────────────────────────────────────────────────────────────────────────────

  Block ──▶ ┌─────────────────┐ ──▶ ┌─────────────────┐
            │ ZK: prove block │     │ TRAD: re-execute │
            │ (OPTIONAL)      │     │ (authoritative)  │
            └────────┬────────┘     └────────┬────────┘
                     │                       │
                     ▼                       ▼
              ZK says valid?          re-exec says valid?
              disagree? --> no slashing (yet), just logged and studied

  Goal: build confidence. Find bugs before they matter.

 ─────────────────────────────────────────────────────────────────────────────
  STAGE 2: ~20% (2027) — Raise gas limits, market pressure toward ZK
 ─────────────────────────────────────────────────────────────────────────────

  Gas limit raised significantly. Re-execution becomes painful:

  Gas limit:   ████████████████████████████████  (raised 5-10x)
  ZK cost:     ████                              (verify proof — easy)
  Trad cost:   ██████████████████████████████    (re-execute — PAINFUL)

  Market pressure: validators WANT the ZK path to keep up.
  Multiple ZK-EVM implementations formally verified by now.

 ─────────────────────────────────────────────────────────────────────────────
  STAGE 3: MANDATORY (2028+) — 3-of-5 independent provers
 ─────────────────────────────────────────────────────────────────────────────

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ PROVER A │  │ PROVER B │  │ PROVER C │  │ PROVER D │  │ PROVER E │
  │ team a   │  │ team b   │  │ team g   │  │ team d   │  │ team e   │
  │ circuit X│  │ circuit Y│  │ circuit Z│  │ circuit W│  │ circuit V│
  │  [VALID] │  │  [VALID] │  │  [VALID] │  │   [---]  │  │   [---]  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘  └──────────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  3 of 5 AGREE   │ ──▶  block accepted
            │  (multi-client) │      no re-execution needed
            └──────────────────┘

  A bug in one prover can't fake consensus — need 3 independent agrees.
  Different teams, different circuits, different codebases.

 ─────────────────────────────────────────────────────────────────────────────
  PROOF GENERATION COST DROPS OVER TIME
 ─────────────────────────────────────────────────────────────────────────────

  Cost per   ▲
  proof ($)  │
             │
     $10.00  │  ████
             │  ██████
      $1.00  │    ████████
             │      ██████████
      $0.10  │          ██████████████
             │                ██████████████████████
      $0.01  │                                      ████████████████
             └──────────────────────────────────────────────────────▶ time
             2026      2027      2028      2029      2030      2031

  As proofs get cheaper: gas limits keep rising.
  End state: throughput limited by DATA (blobs), not computation.
  Execution is "free" to verify — just check proof.
  RISC-V VM changes further improve prover efficiency.
```

---

## 9. The Full Stack

**THE POINT:** Three scaling layers — execution, data, proofs — each solve one bottleneck and enable the next. Together they let Ethereum do 100x more work while solo stakers do LESS work to validate.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  THE ETHEREUM SCALING STACK
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌─ LAYER 1: EXECUTION SCALING ───────────────────────────────────────────────┐
  │ "Do more computation per block"                                            │
  │                                                                            │
  │  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────┐    │
  │  │  ACCESS LISTS   │  │  ePBS          │  │  MULTIDIMENSIONAL GAS   │    │
  │  │                 │  │                │  │                          │    │
  │  │  parallel       │  │  10x more      │  │  scale execution gas    │    │
  │  │  verification   │  │  verification  │  │  WITHOUT scaling state  │    │
  │  │  = 3x faster    │  │  time per slot │  │  reservoir = compat     │    │
  │  └────────┬────────┘  └───────┬────────┘  └──────────┬─────────────┘    │
  │           │                   │                       │                   │
  │           └───────────────────┼───────────────────────┘                   │
  │                               │                                           │
  │                               ▼                                           │
  │                ┌──────────────────────────────┐                           │
  │                │  30x HIGHER GAS LIMITS       │                           │
  │                │  more txs, bigger contracts   │                           │
  │                └──────────────┬───────────────┘                           │
  │                               │                                           │
  └───────────────────────────────┼───────────────────────────────────────────┘
                                  │
                   more execution --> more data produced
                                  │
  ┌─ LAYER 2: DATA SCALING ───────┼───────────────────────────────────────────┐
  │ "Handle more data without every node downloading everything"              │
  │                               │                                           │
  │                               ▼                                           │
  │     BLOCK DATA ──▶  ┌──────────────────────────────────┐                 │
  │                     │  BLOBS  (erasure coded, ~8 MB/s) │                 │
  │                     └──────────────┬───────────────────┘                 │
  │                                    │                                     │
  │                                    ▼                                     │
  │                     ┌──────────────────────────────────┐                 │
  │                     │  PeerDAS                         │                 │
  │                     │                                  │                 │
  │                     │  each validator:  █░░█░░░█░█     │                 │
  │                     │  whole network:   ████████████   │                 │
  │                     │  sample, don't download          │                 │
  │                     └──────────────┬───────────────────┘                 │
  │                                    │                                     │
  │                 data is available (proven by sampling)                    │
  │                                    │                                     │
  └────────────────────────────────────┼─────────────────────────────────────┘
                                       │
                   data available --> but who proves it's VALID?
                                       │
  ┌─ LAYER 3: PROOF SCALING ───────────┼─────────────────────────────────────┐
  │ "Prove correctness without re-executing"                                 │
  │                                    │                                     │
  │                                    ▼                                     │
  │     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
  │     │Prover A│ │Prover B│ │Prover C│ │Prover D│ │Prover E│             │
  │     └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘             │
  │         │          │          │          │          │                    │
  │         └──────────┴────┬─────┴──────────┴──────────┘                    │
  │                         │                                                │
  │                         ▼                                                │
  │              ┌─────────────────────┐                                     │
  │              │  3 of 5 agree      │                                     │
  │              │  --> block valid    │                                     │
  │              └─────────────────────┘                                     │
  │                         │                                                │
  └─────────────────────────┼────────────────────────────────────────────────┘
                            │
                            ▼
 ═══════════════════════════════════════════════════════════════════════════════════
  THE PAYOFF: WHAT A VALIDATOR DOES TO ACCEPT A BLOCK
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌── TODAY ──────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  Download:  ████████████████████████████████████████████████  (ALL data)  │
  │  Compute:   ████████████████████████████████████████████████  (ALL txs)  │
  │                                                                            │
  │  = heavy bandwidth + heavy compute                                        │
  │  = solo staking needs beefy server (16GB+ RAM, SSD, good internet)        │
  └────────────────────────────────────────────────────────────────────────────┘

  ┌── FUTURE ─────────────────────────────────────────────────────────────────┐
  │                                                                            │
  │  Download:  ██                                         (sample blobs)     │
  │  Compute:   █                                          (verify proof)     │
  │                                                                            │
  │  = minimal bandwidth + minimal compute                                    │
  │  = solo staking on a Raspberry Pi                                         │
  └────────────────────────────────────────────────────────────────────────────┘

  100x more throughput.  Solo stakers do LESS work.  That's the trick.
```

---

## 10. Why It All Matters

**THE POINT:** This isn't abstract protocol research. Every scaling improvement directly translates to cheaper transactions, more users, and more applications — on a chain that solo stakers can still verify.

```
 ═══════════════════════════════════════════════════════════════════════════════════
  THE NUMBERS: TODAY vs 2028+
 ═══════════════════════════════════════════════════════════════════════════════════

                          TODAY                          2028+
                          ─────                          ─────

  L1 TPS:                ~15                             ~1,500 (100x)
  ┌─┐                                                   ┌─────────────────────┐
  │█│                                                   │█████████████████████│
  └─┘                                                   └─────────────────────┘

  L1 gas/block:          ~30M                            ~1 BILLION (33x)
  ┌─┐                                                   ┌─────────────────────┐
  │█│                                                   │█████████████████████│
  └─┘                                                   └─────────────────────┘

  Blob DA:               ~0.4 MB/sec                     ~8 MB/sec (20x)
  ┌─┐                                                   ┌──────────────┐
  │█│                                                   │██████████████│
  └─┘                                                   └──────────────┘

  Validator download:    ALL block data                  tiny sample (PeerDAS)
  ████████████████████████████████████████               ██

  Validator compute:     re-execute ALL txs              verify one proof
  ████████████████████████████████████████               █

  Solo staker hardware:  16GB RAM server ($50/mo)        Raspberry Pi ($75 once)

 ═══════════════════════════════════════════════════════════════════════════════════
  HOW EACH PIECE CONTRIBUTES
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌───────────────────────────────────────────────────────────────────────────────┐
  │                                                                               │
  │  PROTOCOL CHANGE           MULTIPLIER      WHAT IT UNLOCKS                   │
  │  ───────────────           ──────────      ──────────────────                 │
  │                                                                               │
  │  Access Lists              3x speed    ──▶ parallel block verification       │
  │          +                                                                    │
  │  ePBS                      10x time    ──▶ safe verification window          │
  │          =                                     │                              │
  │                            30x compute         ▼                              │
  │                                         ┌──────────────┐                      │
  │                                         │ HIGHER GAS   │ CHEAPER L1 TXS      │
  │                                         │ LIMITS       │ more block space     │
  │                                         └──────┬───────┘ = lower gas price   │
  │                                                │                              │
  │  Multidimensional Gas      decouple    ──▶ raise exec gas without growing    │
  │                                            state trie. Bigger contracts.      │
  │                                            Complex DeFi, on-chain games,     │
  │                                            AI agents.                         │
  │                                                                               │
  │  Blobs + PeerDAS           20x data    ──▶ L2s get ~8 MB/sec DA             │
  │                                            L2 tx cost: $0.01 → $0.0001      │
  │                                            Rollup fees drop 100x             │
  │                                                                               │
  │  ZK-EVM (3-of-5)          no re-exec  ──▶ validators just check proof       │
  │                                            solo staking on Raspberry Pi      │
  │                                            = REAL decentralization            │
  │                                                                               │
  └───────────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════════
  THE PUNCHLINE
 ═══════════════════════════════════════════════════════════════════════════════════

  ┌───────────────────────────────────────────────────────────────────────────────┐
  │                                                                               │
  │   Today:  15 TPS, $0.50/tx, needs a server to validate                       │
  │                                                                               │
  │   2028+:  1,500 TPS, $0.005/tx, validate on a Raspberry Pi                  │
  │                                                                               │
  │   L2s:    $0.01/tx today  -->  $0.0001/tx (nearly free)                      │
  │                                                                               │
  │   All while preserving:                                                       │
  │     - Credible neutrality (no single operator)                               │
  │     - Censorship resistance (solo stakers can still validate)                │
  │     - Trustless verification (ZK proofs, not trusted committees)             │
  │                                                                               │
  │   100x throughput. Lower validator requirements. No compromises.              │
  │                                                                               │
  └───────────────────────────────────────────────────────────────────────────────┘
```
