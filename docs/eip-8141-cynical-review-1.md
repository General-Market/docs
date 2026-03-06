# EIP-8141 Visual Diagrams — Cynical Technical Review

**Reviewer stance:** Destroy everything that doesn't earn its place. The gold standard is `batch-config-flow.md` — a document where every box contains real SQL queries, real function signatures, real data values, and real protection checklists. These diagrams must meet that bar or be scrapped.

---

## Diagram 1: EIP Evolution Timeline

**Score: 6/10**

**What's wrong:**

The timeline is the strongest conceptual diagram in the set, but it is fundamentally a *narrative* diagram, not a *technical* one. It tells a **story** (this EIP solved X but couldn't solve Y), which is valuable editorially. But compare it to the gold standard: `batch-config-flow.md` doesn't have a single box that says "Idea: do it WITHOUT a fork." It has `SELECT asset_id FROM market_assets WHERE source = 'crypto' AND is_active = true`. This diagram is all vibes, zero protocol internals.

The "MERGES EVERYTHING" table at the bottom (`from EIP-86 | from 4337 | from 3074 | from 7702`) is the most valuable part. But it's a one-liner table where each cell says things like "contract-originated tx" and "no-fork smart wallets." These are *marketing slogans*, not technical claims. What does EIP-8141 actually take from EIP-86? The idea that `tx.origin` is a contract? Show the mechanism — show how `ACCEPT(sender=contract)` replaces `tx.origin` checks.

**What's missing:**

- Concrete EIP numbers and what they *actually specified* at the protocol level (e.g., EIP-86 proposed a new tx type with `to == 0`; ERC-4337 introduced the `UserOperation` struct; EIP-3074 added `AUTH`/`AUTHCALL` opcodes; EIP-7702 added `SET_CODE_TX_TYPE`). None of these appear.
- The "COULDN'T" sections are hand-wavy. "Can't compose with native tx" — what does that mean concretely? Show the actual limitation.
- No cross-reference to the article is needed because the article itself is also hand-wavy on this section. That's a problem — neither the text nor the diagram goes deep.

**Concrete fix:**

Add a second sub-diagram: a table showing the *actual opcode/primitive* each EIP introduced, and how EIP-8141's `ACCEPT` opcode subsumes them. Something like:

```
EIP-86:   proposed tx where sender = contract        → 8141: ACCEPT(sender=contract)
EIP-3074: AUTH opcode + AUTHCALL opcode              → 8141: ACCEPT + CALLDATAREAD
ERC-4337: UserOperation { sender, calldata, paymaster } → 8141: Frame TX { frames[] }
EIP-7702: SET_CODE_TX_TYPE (delegate to contract)    → 8141: validation frame calls contract
```

**3D potential:** Medium. A timeline is inherently 1D. Making it 3D risks turning it into a gimmick — floating boxes on a rail. Could work if the "merges everything" part is visualized as streams converging, but the timeline spine itself is forced in 3D.

---

## Diagram 2: Frame Transaction Anatomy

**Score: 7/10**

**What's wrong:**

This is one of the better diagrams. The TX ENVELOPE with `type: FRAME_TX`, `nonce: (2D)`, `frame_count: N`, and the three frames with `to:`, `calldata:`, `gas_limit:` is concrete. The CALLDATAREAD cross-frame section with `CALLDATAREAD(frame=0, offset, len)` is exactly the kind of protocol-level detail we need.

However, it falls apart in two places:

1. The ACCEPT opcode section at the bottom says "ACCEPT(sender, gas_payer)" with a description, but doesn't show the *opcode semantics*. What does the EVM actually do when ACCEPT executes? Does it set a register? Write to transient storage? Modify the execution context? The article says: "authorize a sender and authorize a gas payer via the ACCEPT opcode." The diagram restates this without adding mechanism.

2. The "RULE" box ("Only ONE frame can call ACCEPT. First frame to ACCEPT wins.") is valuable but insufficient. What happens if two frames both call ACCEPT? Revert? Second is ignored? What if zero frames call ACCEPT? The article says validation must return ACCEPT — but what does "return" mean here? Is it a return value? An opcode side effect?

**What's missing:**

- The actual new tx type byte/format. The gold standard equivalent would show the RLP encoding or SSZ container.
- How `CALLDATAREAD` differs from existing `CALLDATACOPY`. Is it a new opcode? Is `frame` a parameter on the stack?
- The nonce section says "(2D — channel + sequence)" but doesn't explain the encoding. Is it `uint192 channel || uint64 sequence`? The article references RIP-7712 but doesn't detail the encoding. The diagram should.

**Concrete fix:**

Add a byte-level layout:

```
TX TYPE: 0x05 (FRAME_TX)
[nonce_channel: uint192][nonce_seq: uint64]
[max_fee_per_gas: uint256]
[frames: [
  { to: address, calldata: bytes, gas_limit: uint64 },
  ...
]]
```

And for the ACCEPT opcode:

```
ACCEPT: 0xAA (hypothetical)
Stack input: [sender_address, gas_payer_address]
Side effect: sets execution context for remaining frames
Constraint: reverts if called more than once per tx
```

**3D potential:** Good. Frames as physical containers (boxes/cylinders) with data flowing between them via CALLDATAREAD "pipes" is a natural 3D concept.

---

## Diagram 3: Validation + Execution Flow

**Score: 7/10**

**What's wrong:**

This is a legitimate process flow — data moves through stages, decisions are made, states change. The two-phase lifecycle (sandbox validation then real execution) is clearly shown. The "VALID → proceed" vs "REVERT → TX DROPS" branch is correct.

The problem: it's *too generic*. The validation phase shows "Execute validation frame → ACCEPT returned → VALID" but doesn't show what MAKES validation pass or fail. The article says: "a tx is only valid if it contains a validation frame that returns ACCEPT with the gas flag." The diagram shows this at a high level but doesn't show the actual node-level logic: does the node execute the validation frame in a sandbox EVM? What state is available during sandbox execution? Can the validation frame read storage? (The article says mempool rules restrict this — but this diagram doesn't connect to diagram 9.)

The execution phase is better — "Re-executes: check sigs → ACCEPT(sender=0xWallet, gas=0xPayer)" with the subsequent frames inheriting msg.sender is clear.

**What's missing:**

- Connection to the mempool safety rules (diagram 9). Validation in the mempool has RESTRICTIONS that validation in a block does not. This diagram should show the difference or at least reference it.
- What happens if validation passes at mempool time but fails at execution time (state changed between validation and inclusion)? The article mentions this implicitly ("safe for mempool" vs "not safe"). The diagram should show this race condition.
- Gas accounting. Who pays gas for the validation phase? The article is silent but the diagram says "gas not charged (never included)" for dropped txs. What about validation that passes but the tx later fails in execution? Is gas charged for the validation re-execution?

**Concrete fix:**

Add a "RACE CONDITION" branch between mempool validation and block execution:

```
Mempool validation passes (state S0)
    │
    ▼
Block inclusion (state may be S1 ≠ S0)
    │
    ├── Validation still passes? → execute
    └── Validation now fails? → tx included but reverts, gas charged
```

This is critical protocol behavior that the diagram currently omits.

**3D potential:** Good. A pipeline/conveyor belt metaphor works here — tx enters, goes through validation gate, either drops off or continues to execution stages.

---

## Diagram 4: Normal Tx: Multisig with Frame Auth

**Score: 8/10 — Best diagram in the set**

**What's wrong:**

This is the strongest diagram because it's *concrete*. It shows:
- Two signers (A and B) providing `sig_A` and `sig_B`
- Frame 0 calling `0xMultisigValidator` with specific calldata `[sig_A, sig_B, operation_hash]`
- The contract logic: `keccak256(CALLDATAREAD(frame=1))` to hash the operation being authorized
- Signature verification against the hash
- Threshold check: `count = 2 >= threshold = 2`
- ACCEPT with specific addresses
- Frame 1 calling `0xUSDC` with `transfer(recipient, 1000 USDC)`

This is exactly what the gold standard does — concrete values, real function signatures, step-by-step logic.

The comparison box at the bottom (ERC-4337 WAY vs EIP-8141 WAY) is sharp and adds value.

The only real flaw: `keccak256(CALLDATAREAD(frame=1))` — does CALLDATAREAD return the entire calldata of frame 1? Or does it take offset and length? The diagram in section 2 shows `CALLDATAREAD(frame=0, offset, len)` with explicit parameters, but here it's simplified to `CALLDATAREAD(frame=1)` without offset/len. Inconsistency.

**What's missing:**

- What if one signer signs the wrong hash? The diagram shows the happy path only. A small "FAIL" branch (sig_B invalid → ACCEPT never called → tx drops) would complete the picture.
- The article says "A multisig, an account with changeable keys, or a quantum-resistant signature scheme." The diagram only shows multisig. The quantum-resistant variant should at least be footnoted (same structure, different signature verification algorithm).

**Concrete fix:**

Minor. Fix the CALLDATAREAD inconsistency (add offset/len or explicitly say "reads entire calldata of frame 1"). Add a one-line failure branch.

**3D potential:** Excellent. Two signers handing keys/tokens to a validation box, which opens a gate to the execution box. Very physical, very intuitive.

---

## Diagram 5: New Account Deployment

**Score: 7/10**

**What's wrong:**

The three-frame structure (DEPLOY → VALIDATE → EXECUTE) is clear. The CREATE2 address derivation (`address = CREATE2(factory, salt, keccak256(initcode))`) is concrete. The cross-chain address consistency section with Ethereum/Arbitrum/Base all showing the same `0xNewWallet` is a nice touch.

The problem: the "BEFORE TX" section is good conceptual framing but doesn't show the MECHANICS of how the user knows the address before deployment. Specifically:
- Who computes the salt? The user? The wallet provider?
- What is the initcode? The diagram says "wallet contract" but doesn't explain what's in it (validation logic, key storage, upgrade mechanism).
- EIP-7997 is mentioned but not explained. What IS the deterministic factory? A predeploy at a fixed address? What address?

The validation in Frame 1 reads Frame 2's calldata via `CALLDATAREAD(frame=2)` — consistent with the pattern but again missing offset/len.

**What's missing:**

- The article says "If the account doesn't exist yet, prepend a deployment frame." Who does the prepending? The wallet SDK? The user manually? Is there a standard for constructing this three-frame tx?
- Gas accounting for deployment. Frame 0 deploys a contract — that's expensive. Who pays? The user hasn't ACCEPT'd yet (that happens in Frame 1). Does the protocol front the gas and charge the gas_payer set by ACCEPT retroactively?
- The factory address. EIP-7997 proposes a predeploy — at what address? The gold standard would show `0x7997...` or whatever the canonical address is.

**Concrete fix:**

Add gas flow arrows showing how gas is metered across frames when ACCEPT hasn't been called yet in Frame 0. This is a non-obvious protocol detail.

**3D potential:** Good. A "construction" metaphor — Frame 0 builds the house, Frame 1 hands over the key, Frame 2 walks in and does something. Very spatial.

---

## Diagram 6: Paymaster Gas Flow

**Score: 8/10**

**What's wrong:**

Another strong diagram. The three-frame structure is clear, the money state boxes are excellent (`0xUser: 500 RAI, 0 ETH` → `0xUser: 490 RAI, 0 ETH`), and the paymaster logic is step-by-step:
1. CALLDATAREAD(frame=0) to confirm approval
2. transferFrom to collect RAI
3. Check internal ETH/RAI pool price
4. ACCEPT with gas = 0xPaymaster

The "WHY THIS BEATS ERC-4337" comparison is sharp.

**Problems:**

1. Frame 0 says `msg.sender = 0xUser`, but who set that? ACCEPT hasn't been called yet (that happens in Frame 1). Is msg.sender available in Frame 0 before ACCEPT? If so, who IS msg.sender in pre-ACCEPT frames? This is a critical protocol question that the diagram glosses over.

2. The approval in Frame 0 (`approve(0xPaymaster, 10 RAI)`) requires msg.sender = 0xUser to be meaningful to the RAI contract. But again — how is msg.sender set before ACCEPT? Is there a separate mechanism for the "originating address" of a Frame TX?

3. "Check internal ETH/RAI pool price: 10 RAI = 0.005 ETH at current rate" — this implies the paymaster has a built-in AMM or oracle. The article says "the paymaster is an on-chain DEX." But is it really a DEX, or does it just have a price feed? This matters because a DEX implies liquidity provision, slippage, etc.

4. The paymaster in Frame 1 calls `CALLDATAREAD(frame=0)` to "confirm approval happened." But calldata doesn't confirm EXECUTION happened — it only confirms what the calldata SAYS. The approval might not have executed successfully. Does the paymaster need to check storage instead? Or is it guaranteed that Frame 0 executed successfully before Frame 1 starts?

**What's missing:**

- Frame execution ordering guarantees. If frames execute sequentially, Frame 1 can rely on Frame 0's state changes. But is this guaranteed by the protocol? The article doesn't explicitly say.
- What happens if the RAI/ETH price changes between tx construction and inclusion? Can the paymaster get frontrun? MEV implications?
- Edge case: what if the user's RAI balance drops to 489 before inclusion? Frame 0 approve works but Frame 1 transferFrom fails. What happens to gas?

**Concrete fix:**

Add a note clarifying frame execution order (sequential, each frame sees previous frames' state changes). Address the msg.sender-before-ACCEPT question — this is the single biggest technical gap across multiple diagrams.

**3D potential:** Excellent. Token flow (RAI going one direction, ETH going the other) with a DEX box in the middle is very visual. One of the best candidates for 3D.

---

## Diagram 7: ZK-SNARK Privacy Protocol

**Score: 7/10**

**What's wrong:**

The off-chain ZK proof generation section is well-structured: private inputs (deposit note, nullifier, Merkle path), public inputs (Merkle root, nullifier hash, recipient), output (proof pi). This is the right level of detail.

The on-chain section with the ZK paymaster is solid: verify proof, check nullifier not spent, mark as spent, ACCEPT.

**Problems:**

1. The diagram says "FRAME TX (2 frames — from UNSIGNED source, i.e., no EOA signature)". This is a MAJOR claim. Can a Frame TX really have no signature at all? The article says the ZK proof itself authenticates the tx, but what prevents replay? The nullifier prevents double-spending from the privacy pool, but what prevents someone from resubmitting the same Frame TX before it's confirmed? The diagram doesn't address this.

2. "sender = 0xZKPaymaster" in the ACCEPT call. This means the ZK paymaster is both the sender AND the gas payer. But then in Frame 1, `msg.sender = 0xZKPaymaster` calls `withdraw` on the privacy pool. Does the privacy pool authorize the ZK paymaster to withdraw? This assumes a specific trust relationship between the privacy pool and the paymaster that should be made explicit.

3. The "BEFORE vs AFTER" comparison is good but doesn't mention that the ZK paymaster contract needs its own ETH pool to fund gas. Where does this ETH come from? Who provides liquidity? This is a real operational concern that the diagram hand-waves.

**What's missing:**

- ZK circuit constraints. The article doesn't go deep here either, but a diagram could show the circuit structure: "prove membership in Merkle tree WITHOUT revealing which leaf."
- Specific ZK scheme. Groth16? PLONK? The article mentions ZK-SNARKs generically. The gas cost of verification depends heavily on the scheme.
- The replay protection mechanism for unsigned Frame TXs. This is a protocol-level concern.

**Concrete fix:**

Add a "WHO FUNDS THE PAYMASTER?" section showing the ETH pool lifecycle. Also address: who decides how much gas to pay? If the paymaster always pays, it's a DoS vector — anyone can submit garbage proofs that fail verification but still consume the paymaster's gas. Add a note about pre-verification checks.

**3D potential:** Good. The "proof generation" (off-chain, private) flowing into the "on-chain verification" (public, transparent) is a natural split. The anonymity set (Merkle tree of depositors) could be visualized as a crowd/forest where one entity is highlighted without being identified.

---

## Diagram 8: 2D-Nonce Privacy Architecture

**Score: 6/10**

**What's wrong:**

The 1D vs 2D nonce comparison is clear. The "PROBLEM" section showing serialized transactions (User A blocks User B blocks User C) is intuitive. The "SOLUTION" section showing independent channels is correct.

But this diagram is **conceptually thin**. It explains WHAT 2D nonces are but not HOW they work at the protocol level. Compare to the gold standard: `batch-config-flow.md` shows actual SQL queries, actual function signatures, actual data structures. This diagram shows `nonce = (channel, sequence)` and... that's it for the data model.

**Problems:**

1. The diagram doesn't explain how channels are assigned. Who picks channel 0 for User A? Is it deterministic (hash of user's nullifier)? Random? Does the user choose? This matters enormously for privacy — if channel assignment is predictable, it leaks information.

2. The nonce state storage: `channel 0: seq 0 → 1`. Where is this stored? In the privacy pool contract's storage? As a mapping? `mapping(uint192 => uint64) nonces`? The gold standard would show the Solidity storage layout.

3. The parallel submission flow is good but doesn't address the mempool implications. With 2D nonces, how does a node validate that `nonce=(1,0)` is valid without executing the entire contract? Does it need to read the contract's nonce state? That's an external state read — which diagram 9 says is restricted in the conservative mempool tier. There's a tension between diagrams 8 and 9 that neither addresses.

**What's missing:**

- Channel assignment mechanism
- Storage layout
- Privacy implications of channel choice (if User A always uses channel 0, that's linkable across transactions)
- Interaction with mempool validation rules (tension with diagram 9)
- RIP-7712 actual specification details (the diagram names the RIP but doesn't explain what it specifies beyond "2D nonces exist")

**Concrete fix:**

This diagram needs a second half showing the nonce validation logic:

```
Node receives tx with nonce=(channel=42, seq=3)
1. Read 0xPrivacyPool.nonces[42] → current_seq = 3? ✓
   (requires external state read!)
2. But this is an AGGRESSIVE TIER operation (external read)
3. Conservative tier: reject unless nonce is (channel, 0) — first tx in channel
```

This would connect diagrams 8 and 9 and reveal a real protocol tension.

**3D potential:** Medium. Parallel lanes is inherently a 2D concept (like highway lanes). Making it 3D adds depth for no reason. Could work if channels are stacked vertically, but it's not a natural 3D concept.

---

## Diagram 9: Mempool Safety Layers

**Score: 7/10**

**What's wrong:**

The classification tree (STATELESS → CONSERVATIVE, STAKED → AGGRESSIVE, UNBOUNDED → REJECTED) is the right structure. The two-tier comparison with specific rules and tx types accepted is useful.

The "GRADUATION OVER TIME" timeline at the bottom is a good addition — showing how conservative expands and aggressive shrinks, compared to Bitcoin's standard transactions.

**Problems:**

1. The classification criteria are vague. "STATELESS validation? (only reads own calldata, no external state)" — but what counts as "own calldata"? If the validation frame calls CALLDATAREAD(frame=1), is that "own calldata" or "external"? The diagram doesn't define the boundary.

2. "Bounded external reads (≤ N accounts)" — what is N? 10? 100? 1000? The gold standard would give the actual number or at least the range.

3. The diagram says staked paymasters go to the aggressive tier. But diagram 6 shows a paymaster that calls CALLDATAREAD and then does a transferFrom (which reads/writes external state). Would that paymaster be conservative or aggressive? The diagram doesn't provide enough specificity to classify the diagrams' own examples.

4. DoS protection: "Can't invalidate cheaply (no external dependency)" for conservative tier. This is the KEY insight but is stated as a one-liner. It deserves expansion — WHY can't conservative-tier txs be invalidated cheaply? Because validation only depends on calldata (which is immutable once submitted), so the only way to invalidate is to include a conflicting tx (which costs the attacker gas).

**What's missing:**

- Specific examples mapping the earlier diagrams' use cases to tiers. Diagram 4 (multisig) → conservative? Diagram 6 (paymaster) → aggressive? Diagram 7 (ZK privacy) → conservative (self-contained proof)?
- The actual proposed rate-limiting rules for the aggressive tier
- What "staking" means concretely — how much stake? Locked where? Slashed by whom?

**Concrete fix:**

Add a classification table at the bottom:

```
Diagram 4 (Multisig):     sigs in calldata, no external reads → CONSERVATIVE
Diagram 6 (Paymaster):    reads token balance (external) → AGGRESSIVE (needs stake)
Diagram 7 (ZK Privacy):   proof verification is pure computation → CONSERVATIVE
Diagram 8 (2D Nonces):    reads nonce storage (external) → AGGRESSIVE
```

This would tie the entire diagram set together.

**3D potential:** Poor. A classification tree is a 2D concept. Making it 3D would look like a sorting machine or funnel, which could work visually but doesn't add informational value. The "graduation over time" timeline is 1D. This is fundamentally a 2D diagram.

---

## Diagram 10: FOCIL + AA Integration

**Score: 7/10**

**What's wrong:**

The WITHOUT/WITH FOCIL comparison is the right structure. The "builder drops AA txs" scenario is realistic and compelling. The three FOCIL committee members each picking different txs from the mempool and producing inclusion lists is well-visualized.

The "TWO HALVES" summary at the bottom is excellent: "BUILDS the capabilities but can't guarantee use" vs "GUARANTEES the capabilities are actually usable." This is the right framing.

**Problems:**

1. The diagram shows FOCIL committee members as independent selectors, but doesn't explain WHY they'd include AA txs specifically. Do they see them in the mempool and add them because they're waiting? Is there an economic incentive? A protocol obligation? The article says FOCIL is about forced inclusion, but the diagram doesn't show the mechanism that compels committee members to add txs.

2. The "MUST include" claim for the builder is stated but not explained. What happens if the builder doesn't include a FOCIL-listed tx? Block rejected by attesters? Slash? The enforcement mechanism is missing.

3. How are FOCIL committee members selected? Random sample from validators? The diagram doesn't say. The article says "committee" but doesn't elaborate on selection.

4. The example txs (tx1-tx6) are useful but artificial. A real block has hundreds of txs. The diagram should note that the FOCIL list is a SUBSET of the mempool — the committee can't force-include everything, just enough to prevent systematic censorship.

**What's missing:**

- Committee selection mechanism
- Enforcement mechanism (what happens to non-compliant builders)
- Size constraints on inclusion lists
- Latency implications (committee members publish ILs with delay — can the builder see the ILs and front-run?)
- The article mentions this section is about FOCIL specifically, not EIP-8141. The diagram should make clear that FOCIL is a SEPARATE protocol improvement that synergizes with 8141.

**Concrete fix:**

Add an "ENFORCEMENT" section:

```
Builder produces block WITHOUT tx3 (despite FOCIL list including it)
    │
    ▼
Attesters check: is tx3 in any FOCIL committee member's IL?
    YES → was tx3 included in block?
        NO → block validity [rejected / penalty applied]
```

**3D potential:** Medium. The "funnel" metaphor (mempool → committee filter → builder → block) is a natural pipeline but not inherently spatial. The three committee members could be shown as gates/checkpoints in 3D, which would work.

---

## Summary

### Good Enough (minor fixes only)

| Diagram | Score | Verdict |
|---------|-------|---------|
| **4. Multisig Frame Auth** | 8/10 | Best diagram. Concrete, step-by-step, real values. Fix CALLDATAREAD inconsistency. |
| **6. Paymaster Gas Flow** | 8/10 | Strong. Money state boxes are excellent. Address msg.sender-before-ACCEPT question. |

### Need Major Rework

| Diagram | Score | Problem |
|---------|-------|---------|
| **2. Frame TX Anatomy** | 7/10 | Good structure but missing byte-level format and ACCEPT opcode semantics. |
| **3. Validation + Execution Flow** | 7/10 | Missing the race condition between mempool validation and block execution. |
| **5. New Account Deployment** | 7/10 | Missing gas accounting for pre-ACCEPT frames. |
| **7. ZK Privacy Protocol** | 7/10 | Missing replay protection for unsigned txs and paymaster funding model. |
| **9. Mempool Safety Layers** | 7/10 | Too vague. Needs to classify its own diagrams' examples into tiers. |
| **10. FOCIL + AA** | 7/10 | Missing enforcement mechanism. |

### Need Scrapping or Replacement

| Diagram | Score | Problem |
|---------|-------|---------|
| **1. EIP Evolution Timeline** | 6/10 | All vibes, no protocol internals. Either add opcode-level detail or accept it's editorial. |
| **8. 2D-Nonce Privacy** | 6/10 | Conceptually thin. Doesn't explain channel assignment, storage layout, or mempool tension. |

### Cross-Cutting Problems

1. **msg.sender before ACCEPT is never explained.** Diagrams 5 and 6 both show frames executing before ACCEPT is called, with msg.sender = 0xUser. How? This is the single biggest unanswered question across the entire set.

2. **Frame execution order is assumed but never stated.** Multiple diagrams rely on sequential frame execution (Frame 0 state changes visible to Frame 1) but none explicitly states this is guaranteed by the protocol.

3. **No diagram connects to another.** Diagram 9 (mempool safety) should classify the patterns shown in diagrams 4, 6, 7, and 8. It doesn't. Diagram 3 (validation flow) should reference diagram 9's tier rules. It doesn't. The 10 diagrams are islands, not a story.

4. **Concreteness gap vs gold standard.** `batch-config-flow.md` has SQL queries, keccak256 computations with actual parameters, function signatures with arguments, and timing values (600s, 450s, 90s). These diagrams have abstract descriptions ("verify sig_A against hash — valid signer?") where the gold standard would have `ecrecover(hash, v, r, s) == signers[0]`.

5. **Missing diagrams:**
   - **EOA compatibility.** The article has a section on putting existing EOAs into the 8141 framework. No diagram covers this. It's arguably more important than the timeline (diagram 1) because it affects every existing Ethereum user.
   - **Quantum resistance.** The article mentions post-quantum signature schemes working "out of the box." A diagram showing how a lattice-based signature replaces ecrecover in the validation frame — same structure, different algorithm — would be valuable and is missing entirely.
   - **Atomic operations.** The article mentions "approve + spend in a single transaction." This is covered briefly in diagrams 4 and 6 but deserves its own focused diagram showing multi-frame atomicity.

6. **Story arc:** The diagrams go: history → anatomy → lifecycle → use case → use case → use case → use case → use case → mempool → inclusion. This is roughly logical but the use cases (4-8) blend together without a clear escalation. The progression should be: simplest use case → slightly more complex → most complex. Currently, multisig (4) is simpler than paymaster (6), which is simpler than ZK privacy (7), which is related to but different from 2D nonces (8). This ordering works but the diagrams don't REFERENCE each other ("this builds on diagram 4 by adding a paymaster frame"). They're disconnected.

### Final Verdict

Two diagrams (4 and 6) are genuinely good. The rest are in the 6-7 range — structurally sound but lacking the concrete, protocol-level detail that separates a technical diagram from a concept sketch. The gold standard (`batch-config-flow.md`) is at a 9 or 10 — these diagrams are 2-3 points below it.

The single most important improvement across the entire set: **answer the msg.sender-before-ACCEPT question** and **connect the diagrams to each other** (especially diagrams 4/6/7/8 to diagram 9's mempool tiers).
