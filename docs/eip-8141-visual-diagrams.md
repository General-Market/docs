# EIP-8141 Account Abstraction — Technical Visual Diagrams

**12 diagrams. Each one earns its place with protocol-level detail.**

Cross-references: diagrams reference each other by number (e.g., "see Diagram 3").
Concrete values: opcodes, byte layouts, function signatures, storage slots — matching
the quality bar of `batch-config-flow.md`.

---

## Diagram 0: Frame Execution Model

**3D Animation Potential: 6/10** | **This diagram is referenced by every other diagram. Read it first.**

```
 ═══════════════════════════════════════════════════════════════════════════════
  FRAME EXECUTION MODEL — How Frames Run Inside a Frame Transaction
 ═══════════════════════════════════════════════════════════════════════════════

  A Frame TX contains N frames. They execute SEQUENTIALLY, in order.
  Each frame is a separate EVM call context.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  EXECUTION GUARANTEES                                                    │
  │                                                                          │
  │  1. SEQUENTIAL: Frame 0 runs to completion, then Frame 1, then Frame 2  │
  │  2. STATE VISIBLE: Frame N sees ALL state changes from Frames 0..N-1    │
  │  3. ATOMIC: If any frame reverts AFTER ACCEPT, entire tx reverts         │
  │  4. PRE-ACCEPT FRAMES: frames before ACCEPT run in SANDBOX              │
  │     • state changes are TENTATIVE until ACCEPT confirms them             │
  │     • if ACCEPT never called → all state changes discarded, tx dropped   │
  │  5. ONE ACCEPT: exactly one frame must call ACCEPT, or tx is invalid     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  msg.sender BEFORE vs AFTER ACCEPT                                       │
  │                                                                          │
  │  ┌─── BEFORE ACCEPT (validation phase) ──────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  msg.sender = FRAME_TX_SENDER_PLACEHOLDER (0x0...0)               │  │
  │  │                                                                    │  │
  │  │  WHY: no identity has been authorized yet. The whole point of     │  │
  │  │  the validation frame is to ESTABLISH who the sender is.          │  │
  │  │  Contracts in pre-ACCEPT frames MUST NOT rely on msg.sender.      │  │
  │  │                                                                    │  │
  │  │  WHAT WORKS: CALLDATAREAD, pure computation, self-storage reads   │  │
  │  │  WHAT DOESN'T: token transfers, approvals, anything needing auth  │  │
  │  │                                                                    │  │
  │  │  EXCEPTION: if a frame needs to act as the user (e.g., approve    │  │
  │  │  in Diagram 6), it must come AFTER the ACCEPT frame, not before.  │  │
  │  │  The frame ordering must be: ACCEPT first, then user actions.     │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  ┌─── AFTER ACCEPT ──────────────────────────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  msg.sender = sender address from ACCEPT(sender, gas_payer)       │  │
  │  │                                                                    │  │
  │  │  All subsequent frames inherit this msg.sender.                   │  │
  │  │  This is equivalent to tx.origin in legacy transactions.          │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────┘

  TIMELINE OF A 3-FRAME TX:

  Frame 0 (validation)          Frame 1 (action)          Frame 2 (action)
  ┌─────────────────────┐      ┌─────────────────────┐   ┌──────────────────┐
  │ msg.sender = 0x0    │      │ msg.sender = 0xUser │   │ msg.sender = 0xUser
  │ verify sigs         │      │ approve(spender,amt)│   │ swap(tokenA,tokenB)
  │ CALLDATAREAD(1)     │─────▶│ state: committed    │──▶│ state: committed │
  │ CALLDATAREAD(2)     │      │                     │   │                  │
  │ ACCEPT(0xUser,0xGas)│      │                     │   │                  │
  │ state: tentative    │      │                     │   │                  │
  └─────────────────────┘      └─────────────────────┘   └──────────────────┘
        │                              │                         │
        ▼                              ▼                         ▼
   sandbox mode               committed mode              committed mode
   (discarded if               (real state)                (real state)
    ACCEPT fails)
```

**Key rule:** Frame ordering is a design choice. Validation (ACCEPT) can be in any frame,
but all frames before it run in sandbox mode. Most patterns put ACCEPT in Frame 0 (validation
first) or Frame 1 (deployment first, then validation). See each diagram for the specific
ordering and why.

---

## Diagram 1: EIP Evolution Timeline

**3D Animation Potential: 5/10** | Build as 2D overlay or compressed timeline, not a standalone 3D scene.

**Cross-refs:** Diagram 2 (Frame TX format), Diagram 0 (execution model)

```
 ═══════════════════════════════════════════════════════════════════════════════
  EIP EVOLUTION — What Each Proposal Actually Specified at Protocol Level
 ═══════════════════════════════════════════════════════════════════════════════

  2016                 2021                 2023              2024          2025+
  ─────────────────────────────────────────────────────────────────────────────▶

  ┌─────────────────┐
  │    EIP-86        │  STATUS: withdrawn (never implemented)
  │                  │
  │  MECHANISM:      │
  │  • New tx type   │
  │    where sender  │
  │    = contract    │
  │  • tx.to == 0    │
  │    triggers      │
  │    contract      │
  │    creation      │
  │  • nonce check   │
  │    via contract  │
  │    storage       │
  │                  │
  │  INTRODUCED:     │
  │  concept of      │
  │  contract as     │
  │  first-class     │─────────────────────────────┐
  │  tx origin       │                             │
  │                  │                             │
  │  BLOCKED BY:     │                             │
  │  requires hard   │                             ▼
  │  fork, no        │     ┌─────────────────────────────────────┐
  │  consensus to    │     │         ERC-4337                     │
  │  do it           │     │                                      │
  └─────────────────┘     │  MECHANISM:                           │
                          │  • UserOperation struct:              │
                          │    { sender: address,                 │
                          │      nonce: uint256,                  │
                          │      initCode: bytes,                 │
                          │      callData: bytes,                 │
                          │      paymasterAndData: bytes,         │
                          │      signature: bytes,                │
                          │      ... }                            │
                          │  • Off-chain bundler collects         │
                          │    UserOps into bundle tx             │
                          │  • EntryPoint contract at             │
                          │    0x5FF137D4b0FDCD49DcA30c7CF57E578a│
                          │    validates + executes               │
                          │  • Separate UserOp mempool            │
                          │                                       │
                          │  INTRODUCED:                          │
                          │  smart wallets, paymasters,           │
                          │  gas sponsoring — NO FORK             │
                          │                                       │
                          │  BLOCKED BY:                          │
                          │  • bundler = intermediary             │─────┐
                          │  • 2 parallel mempools                │     │
                          │  • UserOp ≠ native tx (can't compose)│     │
                          │  • privacy needs relayers on top      │     │
                          └───────────────────────────────────────┘     │
                                                                       │
       ┌───────────────────────────────────────────────────────────────┘
       │
       │    ┌──────────────────────┐    ┌──────────────────────┐
       │    │      EIP-3074        │    │      EIP-7702        │
       ├───▶│                      │    │                      │
       │    │  MECHANISM:          │    │  MECHANISM:           │
       │    │  2 new opcodes:      │    │  New tx type:         │
       │    │  • AUTH (0xf6):      │    │  SET_CODE_TX_TYPE     │
       │    │    pop [authority,   │    │  (0x04)               │
       │    │    offset, len]      │    │                       │
       │    │    verify ECDSA sig  │    │  EOA signs auth tuple:│
       │    │    set authorized    │    │  (chain_id, address,  │
       │    │    context var       │    │   nonce)              │
       │    │  • AUTHCALL (0xf7): │    │  → EOA temporarily    │
       │    │    like CALL but     │    │    delegates code to  │
       │    │    msg.sender =      │    │    a contract         │
       │    │    authorized addr   │    │  → EOA can run smart  │
       │    │                      │    │    wallet logic for   │
       │    │  INTRODUCED:         │    │    one tx             │
       │    │  EOA delegates to    │    │                       │
       │    │  invoker contract    │    │  INTRODUCED:          │
       │    │                      │    │  EOA ↔ contract       │
       │    │  BLOCKED BY:         │    │  bridge without       │
       │    │  security concerns   │    │  permanent migration  │
       │    │  (invoker has full   │    │                       │
       │    │  authority)          │    │  BLOCKED BY:          │
       │    │  superseded by 7702  │    │  one-tx-at-a-time     │
       └───▶│                      │    │  delegation, not      │
            └──────────┬───────────┘    │  native AA            │
                       │                └──────────┬────────────┘
                       └────────────┬──────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                           EIP-8141                                       │
  │                    (targeting Hegota fork)                                │
  │                                                                          │
  │  MECHANISM:                                                              │
  │  • New tx type: FRAME_TX (0x05)                                         │
  │  • 3 new opcodes:                                                        │
  │    - ACCEPT (0xAA): sets sender + gas_payer for tx                      │
  │    - CALLDATAREAD (0xAB): read another frame's calldata                 │
  │    - CALLDATASIZE (0xAC): get byte length of another frame's calldata   │
  │  • N frames per tx, sequential execution (see Diagram 0)                │
  │  • 2D nonces: (channel: uint192, sequence: uint64) via RIP-7712        │
  │  • Deterministic factory predeploy via EIP-7997                         │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TECHNICAL INHERITANCE — What 8141 Takes From Each EIP                   │
  │                                                                          │
  │  ┌───────────┬─────────────────────────────┬───────────────────────────┐ │
  │  │ From      │ Original Mechanism           │ 8141 Equivalent          │ │
  │  ├───────────┼─────────────────────────────┼───────────────────────────┤ │
  │  │ EIP-86    │ tx where sender = contract  │ ACCEPT(sender=contract)  │ │
  │  │           │ (proposed new tx type)       │ in validation frame      │ │
  │  ├───────────┼─────────────────────────────┼───────────────────────────┤ │
  │  │ ERC-4337  │ UserOperation struct with    │ Frame TX with frames[]   │ │
  │  │           │ bundler + EntryPoint         │ No bundler needed.       │ │
  │  │           │ (off-chain intermediary)      │ Native tx type.          │ │
  │  ├───────────┼─────────────────────────────┼───────────────────────────┤ │
  │  │ EIP-3074  │ AUTH (0xf6) sets authorized │ ACCEPT (0xAA) sets       │ │
  │  │           │ AUTHCALL (0xf7) calls as    │ sender. Subsequent       │ │
  │  │           │ authorized addr              │ frames inherit sender.   │ │
  │  ├───────────┼─────────────────────────────┼───────────────────────────┤ │
  │  │ EIP-7702  │ SET_CODE_TX_TYPE (0x04)     │ Validation frame calls   │ │
  │  │           │ temporarily delegates EOA    │ contract directly. No    │ │
  │  │           │ code to contract             │ code delegation needed.  │ │
  │  └───────────┴─────────────────────────────┴───────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 2: Frame Transaction Anatomy

**3D Animation Potential: 7/10** | Frame boxes as containers, CALLDATAREAD as pipes, ACCEPT as keystone switch.

**Cross-refs:** Diagram 0 (execution model), Diagram 1 (opcode origins), Diagram 8 (2D nonce detail)

```
 ═══════════════════════════════════════════════════════════════════════════════
  FRAME TRANSACTION — Byte-Level Envelope Format
 ═══════════════════════════════════════════════════════════════════════════════

  TX TYPE BYTE: 0x05 (FRAME_TX — new EIP-2718 typed transaction)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  RLP ENVELOPE                                                            │
  │                                                                          │
  │  0x05 || rlp([                                                          │
  │    chain_id:         uint256,       // e.g. 1 (mainnet)                 │
  │    nonce_channel:    uint192,       // 2D nonce channel (see Diagram 8) │
  │    nonce_sequence:   uint64,        // 2D nonce sequence                │
  │    max_fee_per_gas:  uint256,       // EIP-1559 max fee                 │
  │    max_priority_fee: uint256,       // EIP-1559 priority fee            │
  │    gas_limit:        uint64,        // total gas budget for all frames  │
  │    frames: [                        // ordered list of N frames         │
  │      {                                                                   │
  │        to:        address,          // target contract                   │
  │        calldata:  bytes,            // ABI-encoded function call        │
  │        gas_limit: uint64,           // per-frame gas cap                │
  │        value:     uint256           // ETH value (usually 0)            │
  │      },                                                                  │
  │      ...                            // up to N frames                   │
  │    ],                                                                    │
  │    // NO signature field — auth is via ACCEPT opcode inside frames      │
  │  ])                                                                      │
  └──────────────────────────────────────────────────────────────────────────┘

  NOTE: No ECDSA signature in the envelope. Authentication happens INSIDE
  the transaction via the ACCEPT opcode. This is what enables smart contract
  wallets, multisigs, ZK proofs, and post-quantum schemes to all authenticate
  using the same tx type.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CONCRETE EXAMPLE: 2-Frame Multisig TX (see Diagram 4 for full flow)    │
  │                                                                          │
  │  0x05 || rlp([                                                          │
  │    chain_id:         1,                                                  │
  │    nonce_channel:    0,                                                  │
  │    nonce_sequence:   42,                                                 │
  │    max_fee_per_gas:  30_000_000_000,    // 30 gwei                      │
  │    max_priority_fee: 1_000_000_000,     // 1 gwei                       │
  │    gas_limit:        500_000,                                            │
  │    frames: [                                                             │
  │      { // Frame 0: validation                                            │
  │        to:       0xMultisigValidator,                                    │
  │        calldata: abi.encode(sig_A, sig_B, op_hash),                     │
  │        gas:      200_000,                                                │
  │        value:    0                                                       │
  │      },                                                                  │
  │      { // Frame 1: execution                                             │
  │        to:       0xUSDC,                                                 │
  │        calldata: abi.encodeCall(transfer, (recipient, 1000e6)),          │
  │        gas:      100_000,                                                │
  │        value:    0                                                       │
  │      }                                                                   │
  │    ]                                                                     │
  │  ])                                                                      │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════
  NEW OPCODES — EVM Semantics
 ═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ACCEPT — Opcode 0xAA                                                    │
  │                                                                          │
  │  Stack input:  [..., sender_address, gas_payer_address]                  │
  │  Stack output: [...] (consumes both, pushes nothing)                     │
  │                                                                          │
  │  SIDE EFFECTS:                                                           │
  │  1. Sets tx execution context:                                           │
  │     • tx.sender = sender_address     (inherited by all later frames)    │
  │     • tx.gas_payer = gas_payer_address (gas charged to this account)    │
  │  2. Commits all tentative state from pre-ACCEPT frames                  │
  │  3. Switches execution mode from SANDBOX to COMMITTED                   │
  │                                                                          │
  │  CONSTRAINTS:                                                            │
  │  • Reverts if called more than once in the same tx                      │
  │  • Reverts if gas_payer has insufficient balance for remaining gas       │
  │  • MUST be called exactly once for tx to be valid                       │
  │  • Can be called from ANY frame (usually Frame 0 or 1)                  │
  │                                                                          │
  │  PSEUDOCODE (node implementation):                                       │
  │    fn op_accept(sender: Address, gas_payer: Address) {                  │
  │        if self.accept_called { revert("ACCEPT already called") }        │
  │        if gas_payer.balance < self.remaining_gas * gas_price {           │
  │            revert("insufficient gas payer balance")                      │
  │        }                                                                 │
  │        self.tx_context.sender = sender;                                  │
  │        self.tx_context.gas_payer = gas_payer;                            │
  │        self.accept_called = true;                                        │
  │        self.commit_tentative_state();                                    │
  │    }                                                                     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CALLDATAREAD — Opcode 0xAB                                              │
  │                                                                          │
  │  Stack input:  [..., frame_index, offset, length]                        │
  │  Stack output: [..., data]    (bytes copied to memory)                   │
  │                                                                          │
  │  SEMANTICS:                                                              │
  │  • Reads `length` bytes starting at `offset` from the calldata of       │
  │    frame at `frame_index`                                                │
  │  • frame_index is 0-based, must be < total frame count                  │
  │  • CAN read any frame's calldata (including own, future frames)         │
  │  • Read-only: does not modify the target frame's calldata               │
  │                                                                          │
  │  COMPARISON TO EXISTING OPCODES:                                         │
  │  • CALLDATACOPY (0x37): reads THIS call's calldata                      │
  │  • CALLDATAREAD (0xAB): reads ANY frame's calldata (cross-frame)        │
  │                                                                          │
  │  USE CASES:                                                              │
  │  • Validation frame reads execution frame calldata to know WHAT         │
  │    it's authorizing (Diagram 4: multisig hashes execution calldata)     │
  │  • Paymaster reads user's approval frame to confirm intent (Diagram 6)  │
  │                                                                          │
  │  EXAMPLE:                                                                │
  │    // In Frame 0, read ALL of Frame 1's calldata:                       │
  │    CALLDATAREAD(frame=1, offset=0, length=CALLDATASIZE(frame=1))        │
  │    // Returns: abi.encodeCall(transfer, (recipient, 1000e6))            │
  │    // Frame 0 can then hash this to verify signatures over it           │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CALLDATASIZE — Opcode 0xAC (companion to CALLDATAREAD)                 │
  │                                                                          │
  │  Stack input:  [..., frame_index]                                        │
  │  Stack output: [..., size]    (uint256, byte length of frame's calldata) │
  │                                                                          │
  │  SEMANTICS:                                                              │
  │  • Returns the byte length of calldata for the frame at `frame_index`   │
  │  • frame_index is 0-based, must be < total frame count                  │
  │  • Reverts if frame_index is out of bounds                              │
  │  • This is the cross-frame counterpart to CALLDATASIZE (0x36), which    │
  │    returns the size of the CURRENT call's calldata only                 │
  │                                                                          │
  │  WHY NEEDED: CALLDATAREAD requires a `length` parameter. The caller     │
  │  needs to know how many bytes to read. Without CALLDATASIZE(frame=N),   │
  │  the caller would need to hardcode the expected calldata length or      │
  │  pass it as a separate argument. CALLDATASIZE(frame=N) lets the         │
  │  validation frame read ANY frame's ENTIRE calldata generically:         │
  │                                                                          │
  │    CALLDATAREAD(frame=N, offset=0, length=CALLDATASIZE(frame=N))        │
  │                                                                          │
  │  NOTE: Both CALLDATAREAD (0xAB) and CALLDATASIZE (0xAC) are new         │
  │  opcodes introduced by EIP-8141. They only function inside Frame TXs.   │
  │  Outside a Frame TX context, they revert.                                │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  VISUAL: Frame Cross-Reading                                             │
  │                                                                          │
  │  Frame 0                    Frame 1                    Frame 2           │
  │  ┌────────────────┐        ┌────────────────┐        ┌────────────────┐ │
  │  │ to: 0xValid    │        │ to: 0xUSDC     │        │ to: 0xDEX      │ │
  │  │ calldata:      │        │ calldata:      │        │ calldata:      │ │
  │  │  [sig_A,sig_B, │◀──────▶│  transfer(     │◀──────▶│  swap(         │ │
  │  │   op_hash]     │ READ   │   to, 1000e6)  │ READ   │   RAI, ETH)   │ │
  │  │ gas: 200000    │        │ gas: 100000    │        │ gas: 150000    │ │
  │  └────────────────┘        └────────────────┘        └────────────────┘ │
  │         │                         │                         │           │
  │         │    CALLDATAREAD(1,0,*)  │                         │           │
  │         │────────────────────────▶│                         │           │
  │         │    CALLDATAREAD(2,0,*)  │                         │           │
  │         │──────────────────────────────────────────────────▶│           │
  │         │                         │    CALLDATAREAD(0,0,*)  │           │
  │         │◀──────────────────────────────────────────────────│           │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 3: Validation + Execution Flow

**3D Animation Potential: 8/10** | Conveyor belt / pipeline: sandbox gate, mempool queue, block execution gate.

**Cross-refs:** Diagram 0 (execution model), Diagram 9 (mempool tier rules), Diagram 2 (ACCEPT semantics)

```
 ═══════════════════════════════════════════════════════════════════════════════
  VALIDATION + EXECUTION — Two-Phase Lifecycle with State Transitions
 ═══════════════════════════════════════════════════════════════════════════════

  A Frame TX goes through TWO separate execution passes:
  1. MEMPOOL VALIDATION (sandbox, off-chain, by each node)
  2. BLOCK EXECUTION (real, on-chain, by all nodes)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PHASE 1: MEMPOOL VALIDATION  (node receives tx from p2p)               │
  │                                                                          │
  │  State at this point: S₀ (current chain head state)                     │
  │                                                                          │
  │  ┌── Node executes validation frame in SANDBOX EVM ──────────────────┐  │
  │  │                                                                    │  │
  │  │  1. Create sandbox EVM with state S₀                              │  │
  │  │  2. Execute Frame 0 (or whichever frame calls ACCEPT)             │  │
  │  │  3. Check: did ACCEPT execute?                                     │  │
  │  │     • YES → continue to step 4                                    │  │
  │  │     • NO or REVERT → reject tx, do not propagate                  │  │
  │  │                                                                    │  │
  │  │  4. Apply MEMPOOL TIER RULES (see Diagram 9):                     │  │
  │  │                                                                    │  │
  │  │     ┌── CONSERVATIVE TIER (default) ──────────────────────────┐   │  │
  │  │     │ ✓ Validation frame only reads own calldata              │   │  │
  │  │     │ ✓ No SLOAD from external contracts                     │   │  │
  │  │     │ ✓ No CALL to external contracts during validation      │   │  │
  │  │     │ ✓ Gas limit for validation ≤ 200,000                   │   │  │
  │  │     │ ✓ CALLDATAREAD from other frames is allowed (own tx)   │   │  │
  │  │     └─────────────────────────────────────────────────────────┘   │  │
  │  │                                                                    │  │
  │  │     ┌── AGGRESSIVE TIER (staked operators) ───────────────────┐   │  │
  │  │     │ ✓ All conservative rules, PLUS:                         │   │  │
  │  │     │ ✓ External SLOAD allowed (≤ 16 accounts)               │   │  │
  │  │     │ ✓ Paymaster pattern allowed (needs stake)              │   │  │
  │  │     │ ✓ Nonce channel reads allowed                          │   │  │
  │  │     │ ✓ Operator stakes ETH as DoS collateral                │   │  │
  │  │     └─────────────────────────────────────────────────────────┘   │  │
  │  │                                                                    │  │
  │  │  5. If tier rules pass → accept into mempool, propagate to peers  │  │
  │  │  6. Sandbox state DISCARDED (no state changes from validation)    │  │
  │  │                                                                    │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  GAS: validation gas is NOT charged. Node pays compute cost locally.    │
  │  This is why mempool tier rules exist — to bound validation cost.       │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          │  tx sits in mempool, waiting for block inclusion
          │  state may change: S₀ → S₁ (other txs get included first)
          │
          ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  RACE CONDITION: STATE DIVERGENCE                                        │
  │                                                                          │
  │  Mempool validation passed at state S₀                                  │
  │  Block inclusion happens at state S₁ (S₁ ≠ S₀)                         │
  │                                                                          │
  │  ┌── What can change between S₀ and S₁? ─────────────────────────────┐ │
  │  │ • Gas payer balance decreased (other txs spent ETH)               │ │
  │  │ • Nonce incremented (user sent another tx)                        │ │
  │  │ • Token balances changed (paymaster's collateral drained)         │ │
  │  │ • Contract state changed (if validation reads external state)     │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  CONSERVATIVE TIER: resistant to state changes because validation       │
  │  only reads calldata (immutable). Only nonce conflicts can invalidate. │
  │                                                                          │
  │  AGGRESSIVE TIER: vulnerable to state changes because validation       │
  │  reads external state. Staking requirement makes mass-invalidation     │
  │  costly for attackers (they lose stake).                                │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PHASE 2: BLOCK EXECUTION  (builder includes tx in block)               │
  │                                                                          │
  │  State at this point: S₁ (current state when block is being built)      │
  │                                                                          │
  │  ┌── Full re-execution of ALL frames ────────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  1. Execute Frame 0 at state S₁ (NOT S₀)                         │  │
  │  │                                                                    │  │
  │  │  2. Did ACCEPT execute?                                            │  │
  │  │     ├── YES → validation still valid at S₁                        │  │
  │  │     │   • sender and gas_payer set                                │  │
  │  │     │   • gas metering begins from gas_payer balance              │  │
  │  │     │   • proceed to execute remaining frames                     │  │
  │  │     │                                                              │  │
  │  │     └── NO (reverted) → tx INCLUDED but FAILED                    │  │
  │  │         • tx is in the block (takes up space)                     │  │
  │  │         • all state changes reverted                              │  │
  │  │         • this is the "stale tx" scenario                         │  │
  │  │                                                                    │  │
  │  │         GAS PAYER PARADOX: If ACCEPT never ran, who pays gas?     │  │
  │  │         There IS no gas_payer (ACCEPT sets it). Resolution:       │  │
  │  │         the BUILDER absorbs the execution cost, same as when a    │  │
  │  │         builder includes any invalid tx. The protocol charges no  │  │
  │  │         on-chain account — the cost is borne by the entity that   │  │
  │  │         chose to include a tx that turned out to be invalid.      │  │
  │  │         This is why builders re-validate Frame TXs at state S1   │  │
  │  │         before inclusion — to avoid wasting block space on txs    │  │
  │  │         that will fail. Mempool tier rules (Diagram 9) make       │  │
  │  │         mass-invalidation expensive, protecting builders.         │  │
  │  │                                                                    │  │
  │  │  3. Execute Frame 1..N sequentially                                │  │
  │  │     • msg.sender = ACCEPT's sender_address                        │  │
  │  │     • each frame sees prior frames' state changes                 │  │
  │  │     • if any frame reverts → entire tx reverts, gas charged       │  │
  │  │                                                                    │  │
  │  │  4. Gas accounting:                                                │  │
  │  │     • gas_payer.balance -= gasUsed * effectiveGasPrice             │  │
  │  │     • gas_payer may be different from sender (paymaster pattern)   │  │
  │  │     • unused gas refunded to gas_payer                            │  │
  │  │                                                                    │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────┘

  SUMMARY FLOW:

  User constructs Frame TX
       │
       ▼
  Node receives tx ──▶ Sandbox validation (state S₀)
       │                    │
       │               ┌────┴────┐
       │            ACCEPT?   NO ACCEPT
       │               │         │
       │           tier rules    ▼
       │               │      REJECT
       │           ┌───┴───┐  (not propagated)
       │         pass    fail
       │           │       │
       │       mempool   REJECT
       │           │
       │     (wait for block)
       │     (state changes: S₀ → S₁)
       │           │
       ▼           ▼
  Block builder includes tx ──▶ Full re-execution (state S₁)
                                    │
                               ┌────┴────┐
                            ACCEPT?   NO ACCEPT
                               │         │
                          execute      tx fails
                          frames       gas charged
                               │       state reverted
                          ┌────┴────┐
                        success   revert
                           │         │
                       state      state reverted
                       committed  gas charged
```

---

## Diagram 4: Normal Transaction — Multisig with Frame Auth

**3D Animation Potential: 9/10** | THE showcase scene. Two signers hand keys to vault, vault fires command beam to USDC.

**Cross-refs:** Diagram 0 (msg.sender rules), Diagram 2 (CALLDATAREAD semantics),
Diagram 9 (→ CONSERVATIVE tier: validation is pure calldata, no external reads)

```
 ═══════════════════════════════════════════════════════════════════════════════
  MULTISIG TRANSACTION — Concrete Step-by-Step with Real Values
 ═══════════════════════════════════════════════════════════════════════════════

  SCENARIO: 2-of-2 multisig sends 1000 USDC to 0xRecipient

  Signers: 0xAlice, 0xBob
  Multisig wallet: 0xMultisig (a smart contract)
  Multisig validator: 0xValidator (verifies sigs, calls ACCEPT)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  OFF-CHAIN: Signers construct + sign                                     │
  │                                                                          │
  │  1. Alice and Bob agree on operation:                                    │
  │     op = abi.encodeCall(IERC20.transfer, (0xRecipient, 1000e6))         │
  │                                                                          │
  │  2. Compute operation hash:                                              │
  │     op_hash = keccak256(abi.encodePacked(                               │
  │       0xUSDC,           // target contract                               │
  │       op,               // calldata                                      │
  │       block.chainid,    // replay protection                             │
  │       nonce_seq         // sequence number                               │
  │     ))                                                                   │
  │     // = 0x7f3a...b891                                                  │
  │                                                                          │
  │  3. Each signer signs:                                                   │
  │     sig_A = ecdsaSign(alice_privkey, op_hash)  // 65 bytes (v,r,s)      │
  │     sig_B = ecdsaSign(bob_privkey, op_hash)    // 65 bytes (v,r,s)      │
  │                                                                          │
  │  4. Construct Frame TX (see Diagram 2 for envelope format):             │
  │     frames = [                                                           │
  │       { to: 0xValidator, calldata: abi.encode(sig_A, sig_B) },          │
  │       { to: 0xUSDC, calldata: op }                                      │
  │     ]                                                                    │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FRAME 0: Validation  (msg.sender = 0x0, sandbox mode)                   │
  │  to: 0xValidator                                                         │
  │  calldata: abi.encode(sig_A, sig_B)                                     │
  │  gas_limit: 200,000                                                      │
  │                                                                          │
  │  ┌── Contract logic (0xValidator) ───────────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  function validate(bytes sig_A, bytes sig_B) external {           │  │
  │  │                                                                    │  │
  │  │    // Step 1: Read Frame 1's calldata to know WHAT we're signing  │  │
  │  │    bytes memory frame1data = CALLDATAREAD(                        │  │
  │  │      frame=1, offset=0, length=CALLDATASIZE(frame=1)             │  │
  │  │    );                                                              │  │
  │  │    // frame1data = abi.encodeCall(transfer,(0xRecip,1000e6))      │  │
  │  │                                                                    │  │
  │  │    // Step 2: Reconstruct operation hash                          │  │
  │  │    bytes32 op_hash = keccak256(abi.encodePacked(                  │  │
  │  │      frames[1].to,    // 0xUSDC                                   │  │
  │  │      frame1data,      // transfer calldata                        │  │
  │  │      block.chainid,   // 1                                        │  │
  │  │      nonce_sequence   // from tx envelope                         │  │
  │  │    ));                                                             │  │
  │  │    // op_hash = 0x7f3a...b891                                     │  │
  │  │                                                                    │  │
  │  │    // Step 3: Verify signatures                                   │  │
  │  │    address signer_A = ecrecover(op_hash, sig_A.v, sig_A.r,       │  │
  │  │                                  sig_A.s);                        │  │
  │  │    // signer_A = 0xAlice ✓                                        │  │
  │  │                                                                    │  │
  │  │    address signer_B = ecrecover(op_hash, sig_B.v, sig_B.r,       │  │
  │  │                                  sig_B.s);                        │  │
  │  │    // signer_B = 0xBob ✓                                          │  │
  │  │                                                                    │  │
  │  │    // Step 4: Check against stored signer set                     │  │
  │  │    require(signers[signer_A] == true, "not a signer");            │  │
  │  │    require(signers[signer_B] == true, "not a signer");            │  │
  │  │    require(signer_A != signer_B, "duplicate signer");             │  │
  │  │    uint count = 2;                                                 │  │
  │  │    require(count >= threshold, "threshold not met");               │  │
  │  │    // threshold = 2, count = 2 ✓                                  │  │
  │  │                                                                    │  │
  │  │    // Step 5: ACCEPT — authorize sender and gas payer             │  │
  │  │    ACCEPT(                                                         │  │
  │  │      sender:    0xMultisig,   // the multisig wallet              │  │
  │  │      gas_payer: 0xMultisig    // multisig pays its own gas        │  │
  │  │    );                                                              │  │
  │  │  }                                                                 │  │
  │  │                                                                    │  │
  │  │  ┌── FAILURE BRANCH ──────────────────────────────────────────┐   │  │
  │  │  │ If sig_B is invalid:                                        │   │  │
  │  │  │   ecrecover returns 0x0 → require fails → frame reverts   │   │  │
  │  │  │   ACCEPT never called → tx dropped (mempool) or fails      │   │  │
  │  │  │   (block, gas charged)                                      │   │  │
  │  │  └─────────────────────────────────────────────────────────────┘   │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          │ ACCEPT called → sandbox committed → msg.sender = 0xMultisig
          ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FRAME 1: Execution  (msg.sender = 0xMultisig, committed mode)           │
  │  to: 0xUSDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)               │
  │  calldata: abi.encodeCall(transfer, (0xRecipient, 1000e6))              │
  │  gas_limit: 100,000                                                      │
  │                                                                          │
  │  USDC.transfer(0xRecipient, 1000000000)                                 │
  │  │                                                                       │
  │  ├── msg.sender == 0xMultisig? YES (set by ACCEPT)                      │
  │  ├── balanceOf[0xMultisig] >= 1000e6? YES                               │
  │  ├── balanceOf[0xMultisig] -= 1000e6                                    │
  │  ├── balanceOf[0xRecipient] += 1000e6                                   │
  │  └── emit Transfer(0xMultisig, 0xRecipient, 1000e6)                     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  GAS ACCOUNTING                                                          │
  │                                                                          │
  │  gas_payer = 0xMultisig (set by ACCEPT)                                 │
  │  Frame 0 gas used: ~120,000 (ecrecover × 2 + CALLDATAREAD + ACCEPT)    │
  │  Frame 1 gas used: ~55,000 (ERC-20 transfer)                            │
  │  Total gas used: ~175,000                                                │
  │  Gas price: 15 gwei                                                      │
  │  Cost: 175,000 × 15 gwei = 0.002625 ETH                                │
  │  Charged to: 0xMultisig.balance                                          │
  │                                                                          │
  │  NOTE: gas for BOTH frames (including validation) is charged to          │
  │  gas_payer. Even though ACCEPT is called in Frame 0, the gas payer      │
  │  retroactively covers all gas from tx start.                             │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MEMPOOL CLASSIFICATION: CONSERVATIVE TIER                               │
  │                                                                          │
  │  WHY: Validation frame (Frame 0) only reads:                            │
  │    • Own calldata (sig_A, sig_B)                                        │
  │    • Other frame's calldata via CALLDATAREAD (Frame 1's calldata)       │
  │    • ecrecover precompile (pure computation)                             │
  │  NO external SLOAD. NO external CALL. Pure calldata + computation.      │
  │  → Cannot be cheaply invalidated by state changes (see Diagram 9)       │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ERC-4337 WAY                    │  EIP-8141 WAY                        │
  │                                   │                                      │
  │  1. User builds UserOperation    │  1. User builds Frame TX             │
  │  2. Sends to alt-mempool         │  2. Sends to PUBLIC mempool          │
  │  3. Bundler picks it up          │  3. Node validates directly          │
  │  4. Bundler calls EntryPoint     │  4. Block builder includes tx        │
  │  5. EntryPoint validates         │  5. ACCEPT validates natively        │
  │  6. EntryPoint calls wallet      │  6. Frames execute natively          │
  │                                   │                                      │
  │  Bundler = intermediary          │  No intermediary                      │
  │  UserOp ≠ native tx              │  Frame TX IS a native tx             │
  │  Alt mempool needed              │  Uses existing mempool               │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 5: New Account Deployment

**3D Animation Potential: 8/10** | "Building a house" metaphor: plot with address sign, construction, lock install, first use.

**Cross-refs:** Diagram 0 (sandbox mode for pre-ACCEPT frames), Diagram 2 (envelope format),
Diagram 9 (→ CONSERVATIVE tier: deployment frame + validation are self-contained)

```
 ═══════════════════════════════════════════════════════════════════════════════
  NEW ACCOUNT DEPLOYMENT — 3-Frame TX with Gas Accounting
 ═══════════════════════════════════════════════════════════════════════════════

  SCENARIO: User deploys a new smart wallet and sends their first tx.
  The wallet doesn't exist yet — address is known in advance via CREATE2.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  BEFORE TX: Address Derivation (off-chain, deterministic)                │
  │                                                                          │
  │  EIP-7997 defines a DETERMINISTIC FACTORY at a predeploy address:       │
  │  0x7997000000000000000000000000000000000001                              │
  │  (predeploy = exists on every chain from genesis, like ecrecover)       │
  │                                                                          │
  │  The user (or wallet SDK) computes:                                      │
  │                                                                          │
  │  salt = keccak256(abi.encodePacked(                                     │
  │    user_pubkey,          // links address to the user's signing key     │
  │    implementation,       // 0xWalletImpl (wallet logic contract)        │
  │    chain_id              // optional: omit for same addr on all chains  │
  │  ))                                                                      │
  │  // salt = 0xd4e5...f678                                                │
  │                                                                          │
  │  initcode = abi.encodePacked(                                            │
  │    type(SmartWallet).creationCode,                                       │
  │    abi.encode(user_pubkey, recovery_key, guardian_list)                  │
  │  )                                                                       │
  │  // Contains: validation logic, key storage, upgrade mechanism           │
  │                                                                          │
  │  address = CREATE2(                                                      │
  │    deployer: 0x7997...0001,        // deterministic factory              │
  │    salt:     0xd4e5...f678,        // derived from user params           │
  │    initcode: keccak256(initcode)   // wallet contract bytecode           │
  │  )                                                                       │
  │  // address = 0xNewWallet = 0x1a2b...3c4d                               │
  │                                                                          │
  │  SAME INPUTS → SAME ADDRESS ON EVERY CHAIN:                             │
  │  ┌─────────┬──────────────────────────────────┐                         │
  │  │ Chain   │ Computed address                  │                         │
  │  ├─────────┼──────────────────────────────────┤                         │
  │  │ Mainnet │ 0x1a2b...3c4d (same factory,     │                         │
  │  │ Arb     │ 0x1a2b...3c4d  same salt,        │                         │
  │  │ Base    │ 0x1a2b...3c4d  same initcode)     │                         │
  │  └─────────┴──────────────────────────────────┘                         │
  │                                                                          │
  │  User can receive funds at 0x1a2b...3c4d BEFORE deploying the wallet.  │
  │  Someone sends 0.1 ETH to 0x1a2b...3c4d. It's there, waiting.         │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FRAME TX: 3 Frames (DEPLOY → VALIDATE → EXECUTE)                       │
  │                                                                          │
  │  Gas flow question: who pays gas for Frame 0 (deployment) if ACCEPT     │
  │  hasn't been called yet?                                                 │
  │                                                                          │
  │  ANSWER: The protocol front-loads gas from the tx gas_limit. Gas is     │
  │  metered from the start. If ACCEPT is eventually called, gas_payer is   │
  │  charged retroactively for ALL frames (including Frame 0). If ACCEPT    │
  │  is never called, the tx is invalid and gas is not charged on-chain     │
  │  (mempool validation would have rejected it; if in block, builder       │
  │  absorbs the cost as a failed inclusion).                                │
  └──────────────────────────────────────────────────────────────────────────┘

  FRAME 0: Deploy  (sandbox mode, msg.sender = 0x0)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0x7997000000000000000000000000000000000001 (deterministic factory) │
  │  calldata: abi.encodeCall(deploy, (salt, initcode))                     │
  │  gas_limit: 500,000                                                      │
  │                                                                          │
  │  Factory executes:                                                       │
  │    CREATE2(salt=0xd4e5...f678, initcode)                                │
  │    → deploys SmartWallet contract at 0x1a2b...3c4d                      │
  │    → wallet constructor stores: owner pubkey, recovery key, guardians   │
  │                                                                          │
  │  Gas: ~350,000 (contract creation is expensive)                          │
  │  State: TENTATIVE (sandbox — committed only after ACCEPT in Frame 1)    │
  │                                                                          │
  │  NOTE: if wallet already deployed (idempotent), factory returns          │
  │  existing address. No-op, minimal gas.                                   │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼ wallet now exists (tentatively) at 0x1a2b...3c4d
  FRAME 1: Validate  (sandbox → committed after ACCEPT)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0x1a2b...3c4d (the just-deployed wallet)                           │
  │  calldata: abi.encode(user_signature)                                    │
  │  gas_limit: 200,000                                                      │
  │                                                                          │
  │  SmartWallet.validate(signature) {                                       │
  │                                                                          │
  │    // Read Frame 2 calldata to know what we're authorizing               │
  │    bytes memory execData = CALLDATAREAD(                                │
  │      frame=2, offset=0, length=CALLDATASIZE(frame=2)                    │
  │    );                                                                    │
  │                                                                          │
  │    // Hash the operation                                                 │
  │    bytes32 op_hash = keccak256(abi.encodePacked(                        │
  │      frames[2].to, execData, block.chainid, nonce_sequence              │
  │    ));                                                                    │
  │                                                                          │
  │    // Verify signature against stored owner key                          │
  │    address signer = ecrecover(op_hash, signature);                       │
  │    require(signer == owner, "invalid signer");                           │
  │                                                                          │
  │    // Authorize                                                          │
  │    ACCEPT(                                                               │
  │      sender:    0x1a2b...3c4d,   // the new wallet IS the sender        │
  │      gas_payer: 0x1a2b...3c4d    // wallet pays gas from pre-funded ETH │
  │    );                                                                    │
  │  }                                                                       │
  │                                                                          │
  │  AFTER ACCEPT: Frame 0's tentative state (wallet deployment) is          │
  │  committed. The wallet now exists for real. Gas for Frame 0 is           │
  │  retroactively charged to 0x1a2b...3c4d (the gas_payer).                │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼ msg.sender = 0x1a2b...3c4d for remaining frames
  FRAME 2: Execute  (committed mode, msg.sender = 0x1a2b...3c4d)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xUSDC                                                              │
  │  calldata: abi.encodeCall(transfer, (0xRecipient, 500e6))               │
  │  gas_limit: 100,000                                                      │
  │                                                                          │
  │  First-ever transaction from this wallet. Deploy + validate + execute   │
  │  all in one atomic tx. If any frame fails, everything reverts —          │
  │  including the deployment.                                               │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  GAS ACCOUNTING (3-frame deployment tx)                                  │
  │                                                                          │
  │  Frame 0 (deploy):    ~350,000 gas                                      │
  │  Frame 1 (validate):  ~120,000 gas                                      │
  │  Frame 2 (execute):   ~55,000 gas                                       │
  │  Total:               ~525,000 gas                                       │
  │  Gas price: 15 gwei                                                      │
  │  Cost: 525,000 × 15 gwei = 0.007875 ETH                                │
  │                                                                          │
  │  Charged to: 0x1a2b...3c4d (the wallet that was just deployed)          │
  │  Pre-funded: user sent 0.1 ETH to this address before deploying         │
  │  Remaining: 0.1 - 0.007875 = 0.092125 ETH                              │
  │                                                                          │
  │  WHO CONSTRUCTS THIS TX: the wallet SDK (e.g., Metamask, Rabby,         │
  │  a custom SDK). User picks "create wallet" → SDK computes address,      │
  │  builds 3-frame tx, user signs. SDK knows the factory address and       │
  │  initcode template.                                                      │
  └──────────────────────────────────────────────────────────────────────────┘
```

---


## Diagram 6: Paymaster Gas Flow

**3D Animation Potential: 9/10** | Token swap animation: RAI floating one direction, ETH the other, through DEX box.

**Cross-refs:** Diagram 0 (msg.sender rules — CRITICAL for understanding frame ordering),
Diagram 2 (CALLDATAREAD), Diagram 9 (→ AGGRESSIVE tier: reads token balance)

```
 ═══════════════════════════════════════════════════════════════════════════════
  PAYMASTER — Pay Gas in Any Token (Concrete: RAI → ETH)
 ═══════════════════════════════════════════════════════════════════════════════

  SCENARIO: User holds RAI (no ETH). Wants to send 100 USDC.
  Paymaster is an on-chain DEX that swaps RAI for ETH to cover gas.

  KEY INSIGHT (from Diagram 0): msg.sender before ACCEPT = 0x0.
  Therefore, the user's approval frame CANNOT come before ACCEPT.
  Frame ordering must be: VALIDATE+ACCEPT first, then user actions.

  FRAME ORDER (per-tx approval pattern):
  Frame 0: Paymaster validates + ACCEPT (reads Frame 1, 2, 3 calldata)
  Frame 1: User approves RAI spend (msg.sender = 0xUser, after ACCEPT)
  Frame 2: User sends USDC (msg.sender = 0xUser, after ACCEPT)
  Frame 3: Paymaster collects RAI fee (uses Frame 1's approval)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MONEY STATE: BEFORE TX                                                  │
  │                                                                          │
  │  0xUser:      500 RAI, 1000 USDC, 0 ETH   (no ETH for gas!)            │
  │  0xPaymaster: 0 RAI,   0 USDC,   10 ETH   (liquidity pool)             │
  │  0xRecipient: 0 RAI,   0 USDC,   0 ETH                                 │
  └──────────────────────────────────────────────────────────────────────────┘

  FRAME 0: Paymaster Validation + ACCEPT  (msg.sender = 0x0, sandbox)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xPaymaster                                                         │
  │  calldata: abi.encode(user_signature, 0xUser, max_fee_rai=15)           │
  │  gas_limit: 250,000                                                      │
  │                                                                          │
  │  PaymasterDEX.validateAndAccept(sig, user, maxFeeRAI) {                 │
  │                                                                          │
  │    // Step 1: Read Frame 1 calldata to confirm RAI approval              │
  │    bytes memory f1 = CALLDATAREAD(frame=1, offset=0, len=*);            │
  │    // Expected: abi.encodeCall(RAI.approve, (0xPaymaster, 15e18))        │
  │    require(decodeApproval(f1).spender == address(this));                 │
  │    require(decodeApproval(f1).amount >= requiredFeeRAI);                 │
  │                                                                          │
  │    // Step 2: Verify user signature over all frame calldata              │
  │    bytes32 txHash = keccak256(abi.encodePacked(                          │
  │      CALLDATAREAD(frame=1, 0, *),                                        │
  │      CALLDATAREAD(frame=2, 0, *),                                        │
  │      block.chainid, nonce_sequence                                       │
  │    ));                                                                    │
  │    address signer = ecrecover(txHash, sig);                              │
  │    require(signer == user, "invalid signature");                         │
  │                                                                          │
  │    // Step 3: Check internal DEX pricing                                 │
  │    // Paymaster maintains a RAI/ETH liquidity pool (Uniswap-style AMM)  │
  │    // OR uses a Chainlink price feed. Implementation choice.             │
  │    uint256 raiPerEth = pool.getPrice(RAI, ETH);                         │
  │    // raiPerEth = 2000e18 (1 ETH = 2000 RAI at current rate)            │
  │    uint256 estimatedGas = 500_000;                                       │
  │    uint256 gasPrice = 15 gwei;                                           │
  │    uint256 ethNeeded = estimatedGas * gasPrice;                          │
  │    // ethNeeded = 0.0075 ETH                                              │
  │    uint256 raiNeeded = ethNeeded * raiPerEth / 1e18;                    │
  │    // raiNeeded = 15 RAI                                                 │
  │    require(maxFeeRAI >= raiNeeded, "max fee too low");                   │
  │                                                                          │
  │    // Step 4: ACCEPT — paymaster pays gas, user is sender                │
  │    ACCEPT(                                                               │
  │      sender:    0xUser,       // user's actions authorized                │
  │      gas_payer: 0xPaymaster   // paymaster covers gas in ETH             │
  │    );                                                                    │
  │                                                                          │
  │    // After ACCEPT: paymaster records the RAI debt owed by user.          │
  │    // The actual RAI transfer happens AFTER Frame 1 (user's approval).   │
  │    // Frame 0 cannot call RAI.transferFrom yet — the user's per-tx       │
  │    // approval hasn't been set (Frame 1 hasn't executed).                │
  │    // The paymaster pulls RAI in a post-execution callback or via        │
  │    // a dedicated Frame 3 (see below).                                   │
  │    pendingFees[user] = raiNeeded;  // stored for later collection        │
  │  }                                                                       │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼ ACCEPT called → msg.sender = 0xUser for subsequent frames
  FRAME 1: User Approves RAI  (msg.sender = 0xUser, committed)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xRAI                                                               │
  │  calldata: abi.encodeCall(approve, (0xPaymaster, 15e18))                │
  │  gas_limit: 50,000                                                       │
  │                                                                          │
  │  RAI.approve(0xPaymaster, 15e18)                                        │
  │  msg.sender = 0xUser (set by ACCEPT) → approval is valid                │
  │                                                                          │
  │  PATTERN: Per-tx approval. User approves the exact RAI amount needed    │
  │  for THIS transaction only. No persistent allowance, no dangling        │
  │  approvals. After Frame 2 completes, paymaster calls                    │
  │  RAI.transferFrom(0xUser, paymaster, 15e18) to collect its fee.         │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  FRAME 2: User Sends USDC  (msg.sender = 0xUser, committed)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xUSDC                                                              │
  │  calldata: abi.encodeCall(transfer, (0xRecipient, 100e6))               │
  │  gas_limit: 100,000                                                      │
  │                                                                          │
  │  USDC.transfer(0xRecipient, 100e6)                                      │
  │  msg.sender = 0xUser → transfer authorized                               │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
  FRAME 3: Paymaster Collects RAI Fee  (msg.sender = 0xUser, committed)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xPaymaster                                                         │
  │  calldata: abi.encodeCall(collectFee, (0xUser))                         │
  │  gas_limit: 80,000                                                       │
  │                                                                          │
  │  PaymasterDEX.collectFee(user) {                                        │
  │    uint256 owed = pendingFees[user];  // 15 RAI, set in Frame 0         │
  │    RAI.transferFrom(user, address(this), owed);                         │
  │    // Works because Frame 1 set allowance[0xUser][0xPaymaster] = 15e18 │
  │    pendingFees[user] = 0;                                                │
  │  }                                                                       │
  │                                                                          │
  │  If RAI.transferFrom fails (user's RAI balance dropped since tx was     │
  │  constructed), Frame 3 reverts → entire tx reverts (atomicity).         │
  │  Paymaster eats the gas cost. This is the risk paymasters accept.       │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MONEY STATE: AFTER TX                                                   │
  │                                                                          │
  │  0xUser:      485 RAI, 900 USDC, 0 ETH    (paid 15 RAI for gas)        │
  │  0xPaymaster: 15 RAI,  0 USDC,  9.9925 ETH (spent 0.0075 ETH on gas,  │
  │                                               gained 15 RAI)            │
  │  0xRecipient: 0 RAI,   100 USDC, 0 ETH    (received the USDC)         │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PAYMASTER DEX MECHANICS                                                 │
  │                                                                          │
  │  The paymaster is a contract with:                                       │
  │  1. ETH balance (liquidity to pay gas)                                  │
  │  2. Price oracle OR internal AMM pool                                    │
  │  3. Accumulated token inventory (RAI, USDC, etc.)                       │
  │                                                                          │
  │  Revenue model: paymaster charges a spread on the RAI/ETH rate.         │
  │  Market rate: 1 ETH = 2000 RAI                                          │
  │  Paymaster rate: 1 ETH = 1900 RAI (5% markup)                           │
  │  Profit per tx: 15 RAI - (0.0075 × 2000) = 0 RAI base + markup         │
  │                                                                          │
  │  Liquidity: paymaster must maintain ETH reserves. If ETH runs out,      │
  │  ACCEPT fails (gas_payer insufficient balance) → tx rejected.           │
  │  Paymaster operator must periodically sell accumulated RAI for ETH.     │
  │                                                                          │
  │  MEV RISK: If RAI/ETH price moves between tx construction and           │
  │  inclusion, paymaster eats the slippage. Mitigation:                    │
  │  • maxFeeRAI includes buffer for price movement                          │
  │  • Paymaster can reject txs where price moved > threshold               │
  │  • Short inclusion times reduce exposure                                 │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FRAME EXECUTION ORDER: WHY IT MATTERS HERE                              │
  │                                                                          │
  │  Frames execute SEQUENTIALLY (guaranteed by protocol, see Diagram 0).   │
  │  Frame 1 state changes (RAI approval) are visible to any subsequent     │
  │  code. Frame 0 can read Frame 1's CALLDATA but not its EXECUTION        │
  │  result — calldata is static, execution hasn't happened yet.            │
  │                                                                          │
  │  This is why the paymaster validates Frame 1's INTENT (calldata says    │
  │  "approve 15 RAI") not its RESULT (approval actually succeeded).        │
  │  Sequential execution guarantees Frame 1 will run after ACCEPT sets     │
  │  msg.sender, so the approval WILL work if the calldata is correct and   │
  │  the user has sufficient RAI balance.                                    │
  │                                                                          │
  │  EDGE CASE: user's RAI balance drops between tx construction and        │
  │  inclusion (e.g., another tx spends their RAI). Frame 1 approve         │
  │  succeeds (approve doesn't check balance), Frame 2 USDC transfer        │
  │  succeeds, but Frame 3's RAI.transferFrom fails (insufficient           │
  │  balance) → entire tx reverts (atomicity guarantee from Diagram 0).     │
  │  Gas is charged to 0xPaymaster (the gas_payer). Paymaster eats the     │
  │  cost. This is why paymasters should check user's RAI balance           │
  │  during validation (Frame 0) — which IS an external SLOAD,             │
  │  confirming this pattern requires aggressive tier.                       │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MEMPOOL CLASSIFICATION: AGGRESSIVE TIER                                 │
  │                                                                          │
  │  WHY: Paymaster validation reads external state:                        │
  │    • RAI.balanceOf(0xUser) — external SLOAD                             │
  │    • pool.getPrice(RAI, ETH) — external SLOAD                           │
  │  These can change between validation and inclusion.                      │
  │  Paymaster MUST stake ETH to enter aggressive mempool tier.             │
  │  Stake is slashed if paymaster floods mempool with invalidatable txs.   │
  │  (See Diagram 9 for staking mechanics)                                  │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ERC-4337 WAY                    │  EIP-8141 WAY                        │
  │                                   │                                      │
  │  Paymaster = off-chain service   │  Paymaster = on-chain contract       │
  │  that registers with bundler      │  that lives on Ethereum              │
  │  Bundler calls EntryPoint         │  User submits to public mempool     │
  │  EntryPoint calls paymaster       │  Paymaster validates in-frame       │
  │  Bundler can censor users         │  No intermediary can censor         │
  │  Bundler takes a cut              │  Only DEX spread                     │
  │  Bundler must be running          │  Works if only Ethereum is running  │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 7: ZK-SNARK Privacy Protocol

**3D Animation Potential: 8/10** | Anonymous crowd, shadowy proof generation, bright on-chain verification, nullifier burn-out.

**Cross-refs:** Diagram 0 (unsigned tx, msg.sender = 0x0),
Diagram 8 (2D nonces for parallel privacy), Diagram 9 (→ AGGRESSIVE tier: external SLOAD on privacy pool)

```
 ═══════════════════════════════════════════════════════════════════════════════
  ZK-SNARK PRIVACY — Withdraw from Privacy Pool with Zero Knowledge Proof
 ═══════════════════════════════════════════════════════════════════════════════

  SCENARIO: User deposited 1 ETH into a privacy pool. Now they want to
  withdraw to a fresh address (0xFresh) without linking to their deposit.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PRIVACY POOL STATE                                                      │
  │                                                                          │
  │  0xPrivacyPool contract storage:                                         │
  │    deposits: Merkle tree of 10,000 deposit commitments                  │
  │    root: 0xabc123... (current Merkle root)                              │
  │    nullifiers: mapping(bytes32 => bool) — spent nullifiers              │
  │    balance: 10,000 ETH (sum of all deposits)                             │
  │                                                                          │
  │  User's private data (known only to user):                               │
  │    deposit_note: { amount: 1 ETH, blinding: 0xrand1 }                  │
  │    nullifier: 0xdeadbeef... (unique to this deposit)                    │
  │    merkle_path: [hash0, hash1, ..., hash19] (20-level tree)            │
  │    leaf_index: 4217                                                      │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  OFF-CHAIN: ZK Proof Generation                                          │
  │                                                                          │
  │  ZK Scheme: Groth16 on BN254 (cheapest on-chain verification)           │
  │  Verification gas cost: ~230,000 (pairing check precompile)             │
  │  Proof size: 256 bytes (8 field elements: A, B, C points)               │
  │                                                                          │
  │  ┌── CIRCUIT: "I know a deposit in this tree" ───────────────────────┐  │
  │  │                                                                    │  │
  │  │  PRIVATE INPUTS (never revealed):                                  │  │
  │  │    deposit_note.amount   = 1 ETH                                  │  │
  │  │    deposit_note.blinding = 0xrand1                                │  │
  │  │    nullifier_secret      = 0xsecret                               │  │
  │  │    merkle_path            = [hash0..hash19]                        │  │
  │  │    leaf_index             = 4217                                   │  │
  │  │                                                                    │  │
  │  │  PUBLIC INPUTS (visible on-chain):                                 │  │
  │  │    merkle_root     = 0xabc123...                                  │  │
  │  │    nullifier_hash  = keccak256(nullifier_secret) = 0xdeadbeef... │  │
  │  │    recipient       = 0xFresh                                      │  │
  │  │    amount          = 1 ETH                                        │  │
  │  │                                                                    │  │
  │  │  CIRCUIT CONSTRAINTS:                                              │  │
  │  │    1. commitment = hash(amount, blinding) is a leaf in the tree   │  │
  │  │    2. merkle_path connects commitment to merkle_root              │  │
  │  │    3. nullifier_hash = hash(nullifier_secret)                     │  │
  │  │    4. amount matches claimed withdrawal amount                    │  │
  │  │                                                                    │  │
  │  │  OUTPUT: proof π (256 bytes)                                       │  │
  │  │  Proves: "I own a 1 ETH deposit in this tree" without revealing   │  │
  │  │  WHICH deposit.                                                    │  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FRAME TX: 2 Frames — FROM UNSIGNED SOURCE                               │
  │                                                                          │
  │  This tx has NO ECDSA signature. Authentication is the ZK proof itself. │
  │                                                                          │
  │  REPLAY PROTECTION:                                                      │
  │  • Nullifier prevents double-spend: once nullifier_hash is marked        │
  │    spent, the same deposit can never be withdrawn again                  │
  │  • 2D nonce (channel, sequence) prevents tx replay: same tx cannot      │
  │    be submitted twice even before the nullifier is on-chain              │
  │  • recipient is baked into the proof: attacker can't redirect funds     │
  │  • chain_id is baked into the nonce: cross-chain replay impossible      │
  └──────────────────────────────────────────────────────────────────────────┘

  FRAME 0: ZK Paymaster Validation  (msg.sender = 0x0, sandbox)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xZKPaymaster                                                       │
  │  calldata: abi.encode(proof_π, merkle_root, nullifier_hash,             │
  │                        recipient, amount)                                │
  │  gas_limit: 350,000                                                      │
  │                                                                          │
  │  ZKPaymaster.validateWithdrawal(π, root, nullifier, recip, amt) {       │
  │                                                                          │
  │    // Step 1: Verify ZK proof on-chain (Groth16 pairing check)          │
  │    // Uses BN254 precompile at 0x06, 0x07, 0x08                         │
  │    bool valid = Groth16Verifier.verify(                                  │
  │      proof:         π,                                                   │
  │      publicInputs:  [root, nullifier, recip, amt]                       │
  │    );                                                                    │
  │    require(valid, "invalid proof");                                      │
  │    // Gas: ~230,000 for pairing check                                    │
  │                                                                          │
  │    // Step 2: Check nullifier not already spent                          │
  │    require(!spentNullifiers[nullifier], "already withdrawn");            │
  │                                                                          │
  │    // Step 3: Check merkle root is current or recent                     │
  │    require(privacyPool.isKnownRoot(root), "stale root");                │
  │                                                                          │
  │    // Step 4: Mark nullifier as spent (prevents double-withdrawal)       │
  │    spentNullifiers[nullifier] = true;                                    │
  │                                                                          │
  │    // Step 5: ACCEPT — paymaster is BOTH sender and gas payer            │
  │    ACCEPT(                                                               │
  │      sender:    0xZKPaymaster,   // paymaster acts as sender             │
  │      gas_payer: 0xZKPaymaster    // paymaster pays gas from ETH pool    │
  │    );                                                                    │
  │  }                                                                       │
  │                                                                          │
  │  WHY sender = 0xZKPaymaster:                                             │
  │  The user has NO address (that's the point — privacy). The paymaster    │
  │  acts on behalf of the anonymous user. The privacy pool trusts the      │
  │  paymaster contract (it's the designated withdrawal handler).            │
  └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼ ACCEPT called → msg.sender = 0xZKPaymaster
  FRAME 1: Withdrawal Execution  (msg.sender = 0xZKPaymaster, committed)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  to: 0xPrivacyPool                                                       │
  │  calldata: abi.encodeCall(withdraw, (recipient, amount, nullifier))     │
  │  gas_limit: 100,000                                                      │
  │                                                                          │
  │  PrivacyPool.withdraw(recip, amt, nullifier) {                           │
  │    require(msg.sender == authorizedPaymaster); // 0xZKPaymaster ✓        │
  │    require(spentNullifiers[nullifier] == true); // marked in Frame 0 ✓  │
  │    recip.transfer(amt);  // send 1 ETH to 0xFresh                        │
  │  }                                                                       │
  │                                                                          │
  │  TRUST MODEL: PrivacyPool stores a list of authorized paymasters.       │
  │  Only 0xZKPaymaster can call withdraw(). The paymaster contract is      │
  │  immutable and its logic is verified (proof must be valid to ACCEPT).   │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WHO FUNDS THE ZK PAYMASTER? (ETH pool lifecycle)                        │
  │                                                                          │
  │  The paymaster needs ETH to pay gas. Funding sources:                    │
  │                                                                          │
  │  1. INITIAL: Protocol treasury or grant funds the paymaster contract     │
  │     paymaster.deposit{value: 100 ETH}();                                │
  │                                                                          │
  │  2. ONGOING: Small fee deducted from each withdrawal                     │
  │     User withdraws 1 ETH → receives 0.995 ETH, 0.005 ETH stays in      │
  │     paymaster as gas reserve.                                            │
  │     Fee = max(0.5%, estimated_gas_cost × 1.5)                            │
  │                                                                          │
  │  3. REBALANCE: When ETH reserve runs low, protocol tops up              │
  │                                                                          │
  │  DoS PROTECTION:                                                         │
  │  • Invalid proofs cost ~230,000 gas (pairing check) before failing      │
  │  • Mitigation: pre-verification check (BN254 subgroup check on proof    │
  │    points A, B, C — verifies they are valid curve points, ~2,000 gas)  │
  │    before running full Groth16 pairing check                            │
  │  • Mempool nodes can run the cheap check before propagating             │
  │  • AGGRESSIVE tier (see Diagram 9): validation calls                    │
  │    privacyPool.isKnownRoot(root) — an external SLOAD.                  │
  │    Gas cap for aggressive tier is higher (no 200K hard cap),            │
  │    accommodating the ~230,000 gas Groth16 verification.                 │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MEMPOOL CLASSIFICATION: AGGRESSIVE TIER                                 │
  │                                                                          │
  │  WHY aggressive (not conservative):                                      │
  │  • privacyPool.isKnownRoot(root) is an EXTERNAL SLOAD — reads the      │
  │    privacy pool's root history, a separate contract's storage           │
  │  • External SLOADs disqualify from conservative tier (see Diagram 9)   │
  │  • Additionally, Groth16 verification costs ~230,000 gas, which         │
  │    exceeds the conservative tier's 200,000 gas cap                      │
  │                                                                          │
  │  WHY still viable:                                                       │
  │  • Nullifier read (spentNullifiers[nullifier]) is self-SLOAD —          │
  │    stored on the ZK paymaster itself, not external                       │
  │  • Nullifier is monotonic (false→true only) — bounded invalidation     │
  │  • Root history changes are infrequent (new deposits only)              │
  │  • ZK paymaster operator stakes ETH to enter aggressive tier            │
  │  • Total external reads: 1 account (privacy pool) — well within the    │
  │    aggressive tier's 16-account limit                                    │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  BEFORE (Tornado Cash / Railgun)     │  AFTER (EIP-8141)                │
  │                                       │                                  │
  │  User generates ZK proof             │  User generates ZK proof         │
  │  Sends to RELAYER (centralized)      │  Sends to PUBLIC MEMPOOL        │
  │  Relayer submits on-chain             │  Node validates natively         │
  │  Relayer can censor                   │  No one can censor              │
  │  Relayer can front-run                │  FOCIL prevents censorship      │
  │  Relayer charges fee                  │  Only paymaster fee (on-chain)  │
  │  Relayer must be running              │  Only Ethereum must be running  │
  │  Relayer knows timing (metadata)      │  Public mempool = plausible     │
  │                                       │    deniability                   │
  │                                       │  Aggressive tier (staked), but  │
  │                                       │    no relayer dependency         │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 8: 2D-Nonce Privacy Architecture

**3D Animation Potential: 6/10** | Highway lanes from above; one lane blocked, others flow. Skip storage internals in 3D.

**Cross-refs:** Diagram 2 (nonce encoding in tx envelope), Diagram 7 (ZK privacy alternative),
Diagram 9 (→ AGGRESSIVE tier: reads nonce storage from external contract)

```
 ═══════════════════════════════════════════════════════════════════════════════
  2D NONCES (RIP-7712) — Parallel Nonce Channels at EVM Storage Level
 ═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PROBLEM: 1D Nonces Force Serialization                                  │
  │                                                                          │
  │  Legacy EOA nonce: uint256, monotonically incrementing                  │
  │                                                                          │
  │  User A: nonce=5 ──▶ User B: nonce=6 ──▶ User C: nonce=7               │
  │                                                                          │
  │  For a privacy contract serving MANY users through ONE address:         │
  │                                                                          │
  │  0xPrivacyPool receives:                                                 │
  │    tx from Alice (nonce=100)   ──┐                                      │
  │    tx from Bob   (nonce=101)   ──┤── MUST be sequential                 │
  │    tx from Carol (nonce=102)   ──┘   Bob blocks on Alice                │
  │                                                                          │
  │  If Alice's tx gets stuck → Bob and Carol are stuck too.                │
  │  Privacy pool becomes a bottleneck. UX is terrible.                     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  SOLUTION: 2D Nonces — (channel, sequence) per Account                   │
  │                                                                          │
  │  Nonce encoding in Frame TX (see Diagram 2):                            │
  │    nonce_channel:  uint192  (24 bytes, upper bits of nonce field)       │
  │    nonce_sequence: uint64   (8 bytes, lower bits of nonce field)        │
  │                                                                          │
  │  Each channel has its own independent sequence counter.                  │
  │  Channels can advance in parallel — no cross-channel dependency.         │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  EVM STORAGE LAYOUT (on the account contract)                            │
  │                                                                          │
  │  Solidity:                                                               │
  │    mapping(uint192 => uint64) public nonces;                             │
  │    // slot = keccak256(abi.encode(channel, NONCE_MAPPING_SLOT))          │
  │                                                                          │
  │  Storage slots (concrete):                                               │
  │    NONCE_MAPPING_SLOT = 0  (first storage variable)                      │
  │                                                                          │
  │    nonces[0]:                                                            │
  │      slot = keccak256(abi.encode(uint192(0), uint256(0)))               │
  │           = 0xad3228e9...                                                │
  │      value: uint64 (current sequence for channel 0)                     │
  │                                                                          │
  │    nonces[42]:                                                           │
  │      slot = keccak256(abi.encode(uint192(42), uint256(0)))              │
  │           = 0x7fa9e3b1...                                                │
  │      value: uint64 (current sequence for channel 42)                    │
  │                                                                          │
  │  VALIDATION CHECK (inside account contract):                             │
  │    function validateNonce(uint192 channel, uint64 seq) internal {       │
  │      require(nonces[channel] == seq, "invalid nonce");                   │
  │      nonces[channel] = seq + 1;                                          │
  │    }                                                                     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PARALLEL SUBMISSION: Privacy Pool with 2D Nonces                        │
  │                                                                          │
  │  0xPrivacyPool account (2D nonce-enabled):                               │
  │                                                                          │
  │  Channel 0 (Alice):     Channel 1 (Bob):      Channel 2 (Carol):       │
  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
  │  │ nonce=(0, 0)    │   │ nonce=(1, 0)    │   │ nonce=(2, 0)    │       │
  │  │ Alice withdraw  │   │ Bob withdraw    │   │ Carol withdraw  │       │
  │  │ [INDEPENDENT]   │   │ [INDEPENDENT]   │   │ [INDEPENDENT]   │       │
  │  └───────┬─────────┘   └───────┬─────────┘   └───────┬─────────┘       │
  │          ▼                     ▼                     ▼                  │
  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
  │  │ nonce=(0, 1)    │   │ nonce=(1, 1)    │   │ nonce=(2, 1)    │       │
  │  │ Alice withdraw  │   │ Bob withdraw    │   │ Carol withdraw  │       │
  │  │ #2              │   │ #2              │   │ #2              │       │
  │  └─────────────────┘   └─────────────────┘   └─────────────────┘       │
  │                                                                          │
  │  Alice stuck?  Bob and Carol don't care — different channels.           │
  │  All three can submit simultaneously.                                    │
  │                                                                          │
  │  NONCE STATE AFTER ALL 6 TXS:                                           │
  │    nonces[0] = 2  (Alice used seq 0 and 1)                              │
  │    nonces[1] = 2  (Bob used seq 0 and 1)                                │
  │    nonces[2] = 2  (Carol used seq 0 and 1)                              │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CHANNEL ASSIGNMENT                                                      │
  │                                                                          │
  │  WHO picks the channel number? The privacy pool contract assigns it.    │
  │                                                                          │
  │  Options (implementation choice):                                        │
  │                                                                          │
  │  1. DETERMINISTIC (from nullifier):                                      │
  │     channel = uint192(keccak256(nullifier_secret)) % MAX_CHANNELS       │
  │     Pro: no interaction needed to get a channel                          │
  │     Con: linkable if MAX_CHANNELS is small (two txs in same channel     │
  │          MIGHT be same user) — but privacy already relies on ZK proofs  │
  │                                                                          │
  │  2. SEQUENTIAL (contract assigns):                                       │
  │     channel = nextChannel++                                              │
  │     Pro: uniform distribution                                            │
  │     Con: requires a registration tx (breaks first-tx privacy)           │
  │                                                                          │
  │  3. RANDOM (user picks):                                                 │
  │     channel = random_uint192()                                           │
  │     Pro: no linkability (2^192 possible channels, collision negligible) │
  │     Con: channels accumulate in storage forever                          │
  │                                                                          │
  │  RECOMMENDED: Option 3 (random). 2^192 channels = no collision risk.    │
  │  Each channel costs one storage slot (SSTORE) on first use = 20,000 gas.│
  │  Subsequent txs in same channel: 5,000 gas (warm SLOAD + SSTORE).      │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MEMPOOL TENSION: 2D Nonces vs Conservative Tier                         │
  │                                                                          │
  │  To validate a 2D nonce tx, the node must read:                         │
  │    0xPrivacyPool.nonces[channel] → current sequence                     │
  │  This is an EXTERNAL SLOAD (the privacy pool is a different contract).  │
  │                                                                          │
  │  Conservative tier FORBIDS external SLOADs.                              │
  │  → 2D nonce txs cannot enter conservative mempool.                      │
  │  → They require AGGRESSIVE tier (staked operator).                       │
  │                                                                          │
  │  HOWEVER: if the account contract itself manages nonces (not external   │
  │  privacy pool), then nonce read is a SELF-SLOAD:                        │
  │    self.nonces[channel] → self storage read → ALLOWED in conservative   │
  │                                                                          │
  │  CONCLUSION:                                                             │
  │  • Standalone smart wallet with 2D nonces → CONSERVATIVE (self-SLOAD)  │
  │  • Privacy pool contract used by many users → AGGRESSIVE (external read)│
  │  • See Diagram 9 for full tier classification                            │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PRIVACY IMPLICATIONS                                                    │
  │                                                                          │
  │  If channel assignment is linkable:                                      │
  │    • Alice always uses channel 0 → all her txs are linked              │
  │    • Defeats the purpose of privacy pool                                │
  │                                                                          │
  │  Random channel (option 3) breaks this:                                  │
  │    • Alice uses channel 8391726... for tx 1, channel 2047391... for tx 2│
  │    • No on-chain link between her transactions                          │
  │    • Combined with ZK proofs (Diagram 7), full unlinkability            │
  │                                                                          │
  │  Tradeoff: random channels waste storage (one slot per channel per      │
  │  account). At 20,000 gas per new channel, ~$0.50 at 15 gwei.           │
  │  Acceptable for privacy-sensitive use cases.                             │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 9: Mempool Safety Layers

**3D Animation Potential: 5/10** | Sorting machine (txs into buckets). Better as 2D overlay on other diagrams' scenes.

**Cross-refs:** Diagram 3 (validation phase), Diagram 4 (multisig → conservative),
Diagram 6 (paymaster → aggressive), Diagram 7 (ZK → aggressive),
Diagram 8 (2D nonce tension)

```
 ═══════════════════════════════════════════════════════════════════════════════
  MEMPOOL SAFETY — Two-Tier Classification with Concrete Rules
 ═══════════════════════════════════════════════════════════════════════════════

  WHY THIS MATTERS: Nodes spend compute validating txs in the mempool.
  If validation is cheap to PASS but expensive to VERIFY, attackers can
  flood the network with garbage. The tier system bounds this cost.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CLASSIFICATION FLOW (node receives a Frame TX)                          │
  │                                                                          │
  │  Frame TX arrives via p2p                                                │
  │       │                                                                  │
  │       ▼                                                                  │
  │  ┌── STEP 1: Static analysis of validation frame ─────────────────────┐ │
  │  │                                                                     │ │
  │  │  Inspect bytecode of validation frame's target contract:            │ │
  │  │  • Contains SLOAD to external address? → needs aggressive          │ │
  │  │  • Contains CALL/DELEGATECALL to external? → needs aggressive      │ │
  │  │  • Only uses CALLDATAREAD + precompiles? → conservative OK         │ │
  │  │                                                                     │ │
  │  └─────────────────────────────────────────────────────────────────────┘ │
  │       │                                                                  │
  │       ├─── no external access ──────────────────────────▶ CONSERVATIVE  │
  │       │                                                                  │
  │       ├─── bounded external access (≤16 accounts) ─────▶ AGGRESSIVE    │
  │       │    AND staked operator                                           │
  │       │                                                                  │
  │       └─── unbounded access OR no stake ────────────────▶ REJECTED     │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════
  TIER 1: CONSERVATIVE (default mempool, no stake required)
 ═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  RULES                                                                   │
  │                                                                          │
  │  ✓ Validation frame reads ONLY:                                         │
  │    • Own calldata (function args)                                        │
  │    • Other frames' calldata via CALLDATAREAD                            │
  │    • Precompiles (ecrecover, SHA256, pairing checks, etc.)              │
  │    • Own contract storage (SLOAD on self — for nonce, signer list)      │
  │  ✗ NO external SLOAD (reading other contracts' storage)                 │
  │  ✗ NO external CALL during validation                                   │
  │  ✗ Validation gas ≤ 200,000 (hard cap, prevents compute DoS)           │
  │                                                                          │
  │  WHY SAFE: Validation depends only on immutable data (calldata) and     │
  │  self-storage. To invalidate a conservative tx, attacker must:          │
  │  1. Submit a CONFLICTING tx that changes self-storage (costs gas)       │
  │  2. Each invalidation costs the attacker real money                      │
  │  → Mass invalidation is expensive → DoS not economically viable         │
  │                                                                          │
  │  COST TO INVALIDATE ONE TX:                                              │
  │  • Change nonce on-chain: ~25,000 gas = ~$0.60 at 15 gwei              │
  │  • Attacker must spend ~$0.60 per tx they want to invalidate            │
  │  • To invalidate 1000 txs: ~$600 (not profitable)                       │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TX TYPES ACCEPTED IN CONSERVATIVE TIER                                  │
  │                                                                          │
  │  ┌────────────────────────────────┬──────────────────────────────────┐  │
  │  │ Pattern                        │ Why Conservative                  │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Multisig (Diagram 4)          │ Sigs in calldata, ecrecover     │  │
  │  │                                │ precompile, self-SLOAD for       │  │
  │  │                                │ signer list. No external reads. │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ New Account Deploy (Diagram 5)│ Deployment frame is self-        │  │
  │  │                                │ contained (CREATE2). Validation  │  │
  │  │                                │ reads own calldata + ecrecover. │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Single-key wallet              │ ecrecover(hash, sig) == owner.  │  │
  │  │                                │ Simplest possible validation.   │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Quantum-resistant (Diagram 12)│ Hash-based sig verification is  │  │
  │  │                                │ pure computation. No external   │  │
  │  │                                │ state needed.                    │  │
  │  └────────────────────────────────┴──────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════
  TIER 2: AGGRESSIVE (opt-in mempool, stake required)
 ═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  RULES                                                                   │
  │                                                                          │
  │  ✓ Everything conservative allows, PLUS:                                │
  │  ✓ External SLOAD allowed (≤ 16 unique accounts read)                   │
  │  ✓ Bounded external CALL during validation                              │
  │  ✓ Staking required:                                                     │
  │    • Operator (paymaster/account) stakes ETH in a registry contract     │
  │    • Stake amount: ≥ 1 ETH (subject to governance)                      │
  │    • Slashing: if operator's txs invalidate at rate > 10% over          │
  │      rolling 1-hour window, stake is partially slashed                  │
  │    • Withdrawal delay: 24 hours (prevents stake-and-run)                │
  │                                                                          │
  │  WHY NEEDED: Some patterns require reading external state:              │
  │  • Paymaster checks user's token balance (external SLOAD)               │
  │  • 2D nonce reads from shared contract storage                          │
  │  • Social recovery checks guardian status                                │
  │                                                                          │
  │  WHY STAKE: External state can change between validation and inclusion. │
  │  This means txs can be invalidated by changing external state.          │
  │  Without stake, attacker submits 10,000 txs, then changes external      │
  │  state to invalidate them all at once (cheap invalidation attack).      │
  │  Stake makes mass-invalidation costly: attacker loses stake.            │
  │                                                                          │
  │  RATE LIMITING: Aggressive tier txs are rate-limited per staked         │
  │  operator. Default: 100 pending txs per staked entity.                   │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TX TYPES REQUIRING AGGRESSIVE TIER                                      │
  │                                                                          │
  │  ┌────────────────────────────────┬──────────────────────────────────┐  │
  │  │ Pattern                        │ Why Aggressive                    │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Paymaster (Diagram 6)         │ Reads user's token balance       │  │
  │  │                                │ (external SLOAD on RAI contract).│  │
  │  │                                │ Reads DEX price (external SLOAD).│  │
  │  │                                │ Both can change between           │  │
  │  │                                │ validation and inclusion.         │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ ZK Privacy (Diagram 7)        │ Calls privacyPool.isKnownRoot() │  │
  │  │                                │ — external SLOAD on privacy pool.│  │
  │  │                                │ Also exceeds 200K gas cap        │  │
  │  │                                │ (~230K for Groth16 pairing).     │  │
  │  │                                │ Nullifier self-SLOAD is fine,    │  │
  │  │                                │ but external root check pushes   │  │
  │  │                                │ it to aggressive.                │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ 2D Nonce on shared contract   │ Reads nonce from shared privacy  │  │
  │  │ (Diagram 8)                   │ pool (external SLOAD).           │  │
  │  │                                │ Other users' txs can change the  │  │
  │  │                                │ nonce state.                      │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Social recovery wallet        │ Reads guardian list from          │  │
  │  │                                │ guardian registry (external).    │  │
  │  ├────────────────────────────────┼──────────────────────────────────┤  │
  │  │ Oracle-dependent validation   │ Reads price feed during           │  │
  │  │                                │ validation (volatile state).     │  │
  │  └────────────────────────────────┴──────────────────────────────────┘  │
  │                                                                          │
  │  NOTE: 2D nonces on a SELF-OWNED contract (smart wallet with its own   │
  │  nonce mapping) are conservative tier — self-SLOAD, not external.       │
  │  Only shared-contract nonces (Diagram 8 privacy pool) need aggressive. │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════
  GRADUATION OVER TIME
 ═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  YEAR 1 (Hegota launch):                                                │
  │  ┌────────────────────────────────┬──────────────────────────────────┐  │
  │  │ CONSERVATIVE (wide)            │ AGGRESSIVE (narrow)              │  │
  │  │ • Single-key wallets           │ • Paymasters                    │  │
  │  │ • Multisigs                    │ • ZK privacy (external root     │  │
  │  │ • New account deploy           │   check on privacy pool)        │  │
  │  │                                │ • Staked only, ≤ 16 ext. reads  │  │
  │  └────────────────────────────────┴──────────────────────────────────┘  │
  │                                                                          │
  │  YEAR 2-3 (proven patterns):                                            │
  │  ┌──────────────────────────────────────────┬────────────────────────┐  │
  │  │ CONSERVATIVE (expands)                    │ AGGRESSIVE (shrinks)   │  │
  │  │ • + Paymasters (proven safe patterns)    │ • Only novel patterns │  │
  │  │ • + 2D nonces (monotonic nonce reads)    │ • Only unproven       │  │
  │  │ • + Social recovery                      │   contracts            │  │
  │  └──────────────────────────────────────────┴────────────────────────┘  │
  │                                                                          │
  │  Analogy: Bitcoin "standard transactions" — P2PKH was conservative,     │
  │  P2SH was aggressive (opt-in), SegWit graduated to standard.            │
  │  Same pattern here, applied to validation logic instead of scripts.     │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 10: FOCIL + Account Abstraction

**3D Animation Potential: 7/10** | Committee gate operators, with/without comparison, attesters checking blocks.

**Cross-refs:** Diagram 3 (validation flow), Diagram 9 (mempool tiers — FOCIL complements tiers),
Diagram 6 (paymaster censorship), Diagram 7 (privacy censorship)

```
 ═══════════════════════════════════════════════════════════════════════════════
  FOCIL — Forced Inclusion Lists (Separate Protocol, Synergizes with 8141)
 ═══════════════════════════════════════════════════════════════════════════════

  NOTE: FOCIL is NOT part of EIP-8141. It's a separate proposal for
  censorship resistance. But it completes the picture: 8141 BUILDS
  capabilities, FOCIL GUARANTEES they're usable.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WITHOUT FOCIL: Builder Can Censor AA Transactions                       │
  │                                                                          │
  │  Mempool:                                                                │
  │  ┌──────────────────────────────────────────────────────┐               │
  │  │ tx1: EOA transfer (simple)           ← included      │               │
  │  │ tx2: Multisig Frame TX (Diagram 4)   ← DROPPED       │               │
  │  │ tx3: ZK privacy Frame TX (Diagram 7) ← DROPPED       │               │
  │  │ tx4: EOA swap (simple)               ← included      │               │
  │  │ tx5: Paymaster Frame TX (Diagram 6)  ← DROPPED       │               │
  │  │ tx6: EOA transfer (simple)           ← included      │               │
  │  └──────────────────────────────────────────────────────┘               │
  │                                                                          │
  │  Builder:  "Frame TXs are complex, I don't want to deal with them.     │
  │            I'll only include simple EOA txs. More predictable MEV."     │
  │                                                                          │
  │  Result: EIP-8141 capabilities exist but are unusable in practice.      │
  │  Users submit Frame TXs → they sit in mempool → never included.        │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WITH FOCIL: Forced Inclusion via Committee                              │
  │                                                                          │
  │  COMMITTEE SELECTION:                                                    │
  │  • Each slot, a committee of ~16 validators is randomly selected        │
  │    (from the active validator set, using RANDAO beacon randomness)      │
  │  • Selection is verifiable (VRF-based, same mechanism as sync committee)│
  │  • Committee members are known N slots in advance (e.g., 4 slots)      │
  │                                                                          │
  │  PROCESS:                                                                │
  │                                                                          │
  │  Slot N-4: Committee selection announced                                 │
  │       │                                                                  │
  │       ▼                                                                  │
  │  Slot N-1: Each committee member publishes an INCLUSION LIST (IL)       │
  │                                                                          │
  │  Committee    Committee    Committee     ...    Committee                │
  │  Member A     Member B     Member C             Member P                │
  │  ┌────────┐  ┌────────┐  ┌────────┐           ┌────────┐              │
  │  │ IL_A:  │  │ IL_B:  │  │ IL_C:  │           │ IL_P:  │              │
  │  │ tx2    │  │ tx3    │  │ tx2    │           │ tx5    │              │
  │  │ tx5    │  │ tx5    │  │ tx3    │           │ tx2    │              │
  │  │        │  │ tx6    │  │        │           │        │              │
  │  └────────┘  └────────┘  └────────┘           └────────┘              │
  │                                                                          │
  │  IL SIZE CONSTRAINT: each IL ≤ 8 KB (prevents spam). This fits         │
  │  roughly 20-50 transactions depending on calldata size.                  │
  │                                                                          │
  │  AGGREGATED IL = union(IL_A, IL_B, ..., IL_P):                          │
  │  { tx2, tx3, tx5, tx6 }                                                 │
  │                                                                          │
  │       ▼                                                                  │
  │  Slot N: Builder constructs block                                        │
  │  ┌──────────────────────────────────────────────────────┐               │
  │  │ BUILDER MUST INCLUDE: tx2, tx3, tx5 (from ILs)      │               │
  │  │ BUILDER ALSO INCLUDES: tx1, tx4 (own selection)      │               │
  │  │ BUILDER CAN ADD: any other txs it wants              │               │
  │  │                                                       │               │
  │  │ BLOCK: [tx1, tx2, tx3, tx4, tx5]                     │               │
  │  │        (tx6 not in any IL with majority, MAY omit)    │               │
  │  └──────────────────────────────────────────────────────┘               │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ENFORCEMENT MECHANISM                                                   │
  │                                                                          │
  │  What happens when the builder ignores an inclusion list?                │
  │                                                                          │
  │  Builder produces block WITHOUT tx3 (despite multiple ILs including it) │
  │       │                                                                  │
  │       ▼                                                                  │
  │  ATTESTERS validate the block:                                           │
  │                                                                          │
  │  for each IL published by committee members:                             │
  │    for each tx in IL:                                                    │
  │      if tx is VALID at current state AND tx NOT in block:               │
  │        → block is INVALID                                                │
  │                                                                          │
  │  ┌── VALIDITY CHECK ─────────────────────────────────────────────────┐  │
  │  │                                                                    │  │
  │  │  "tx is VALID" means:                                              │  │
  │  │  • tx nonce matches current state (not already used)               │  │
  │  │  • gas_payer has sufficient balance                                │  │
  │  │  • tx fits in block gas limit                                      │  │
  │  │                                                                    │  │
  │  │  NOTE: if tx became invalid due to state changes (e.g., nonce     │  │
  │  │  used by another tx in the same block), builder is NOT penalized. │  │
  │  │  The obligation is: include if VALID, not include unconditionally.│  │
  │  └────────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  CONSEQUENCE OF INVALID BLOCK:                                           │
  │  • Attesters refuse to attest → block not finalized                     │
  │  • Builder loses the slot's MEV revenue                                 │
  │  • Builder's reputation affected (proposer selection weight)            │
  │  • No explicit slashing (attestation-based enforcement, not slashing)   │
  │                                                                          │
  │  RESULT: Rational builders always include IL txs (losing one slot's     │
  │  revenue is more expensive than including a few extra txs).             │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WHY FOCIL MATTERS FOR EIP-8141 SPECIFICALLY                             │
  │                                                                          │
  │  Without FOCIL:                                                          │
  │  ┌───────────────────────────────────────────────────────────────────┐  │
  │  │ EIP-8141 enables:    │ But builder can ignore:                    │  │
  │  │ ✓ Multisig txs       │ "too complex, skip"                       │  │
  │  │ ✓ Paymaster txs      │ "non-standard gas payment, skip"          │  │
  │  │ ✓ ZK privacy txs     │ "no MEV extractable, skip"                │  │
  │  │ ✓ New account deploy  │ "CREATE2 is expensive, skip"              │  │
  │  └───────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  With FOCIL:                                                             │
  │  ┌───────────────────────────────────────────────────────────────────┐  │
  │  │ EIP-8141 enables:    │ FOCIL guarantees:                          │  │
  │  │ ✓ Multisig txs       │ Committee includes them → builder MUST    │  │
  │  │ ✓ Paymaster txs      │ Committee includes them → builder MUST    │  │
  │  │ ✓ ZK privacy txs     │ Committee includes them → builder MUST    │  │
  │  │ ✓ New account deploy  │ Committee includes them → builder MUST    │  │
  │  └───────────────────────────────────────────────────────────────────┘  │
  │                                                                          │
  │  TWO HALVES:                                                             │
  │  EIP-8141 BUILDS the capabilities (frames, ACCEPT, paymasters, ZK).    │
  │  FOCIL GUARANTEES the capabilities are actually usable (forced          │
  │  inclusion prevents builder censorship).                                 │
  │  Together: censorship-resistant account abstraction.                     │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 11: EOA Compatibility — Existing Wallet Migration

**3D Animation Potential: 4/10** | Poor 3D candidate. Existing wallet glow-up is 5 seconds, rest is tables. Use as 2D card.

**Cross-refs:** Diagram 1 (EIP-7702 inheritance), Diagram 0 (execution model),
Diagram 2 (Frame TX replaces legacy tx)

```
 ═══════════════════════════════════════════════════════════════════════════════
  EOA COMPATIBILITY — How Existing Wallets Gain AA Capabilities
 ═══════════════════════════════════════════════════════════════════════════════

  CONTEXT: There are ~270 million EOAs (externally owned accounts) on
  Ethereum. EIP-8141 must not break them. Under discussion: wrapping
  EOAs into the 8141 framework so they gain new capabilities without
  migration.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CURRENT EOA MODEL (pre-8141)                                            │
  │                                                                          │
  │  EOA = (address, nonce, balance)                                         │
  │  • Address derived from ECDSA public key: addr = keccak256(pubkey)[12:] │
  │  • Authentication: ECDSA signature over tx hash                         │
  │  • Nonce: 1D, monotonically incrementing                                │
  │  • Code: NONE (EOAs have no bytecode)                                    │
  │  • Capabilities: send ETH, call contracts — nothing else                │
  │                                                                          │
  │  LIMITATIONS:                                                            │
  │  • Can't rotate keys (lose key = lose account)                          │
  │  • Can't do multisig (single ECDSA key only)                            │
  │  • Can't sponsor gas (must hold ETH)                                     │
  │  • Can't batch operations (one call per tx)                              │
  │  • Can't do social recovery                                              │
  │  • Vulnerable to quantum computers (ECDSA)                               │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  APPROACH: Protocol-Level EOA-to-8141 Bridge                             │
  │                                                                          │
  │  Option A: Implicit Frame TX Wrapping  [PROPOSED — under discussion]    │
  │  ──────────────────────────────────────────────────────────────────      │
  │  STATUS: This is NOT settled EIP-8141 design. It is an open proposal   │
  │  being discussed by EIP authors. The mechanism below is speculative.    │
  │                                                                          │
  │  Legacy txs (type 0x00, 0x01, 0x02) would be INTERPRETED as 1-frame   │
  │  Frame TXs by the protocol:                                              │
  │                                                                          │
  │  Legacy tx:                          Interpreted as:                     │
  │  ┌──────────────────────┐           ┌──────────────────────────────┐    │
  │  │ type: 0x02 (EIP-1559)│           │ type: 0x05 (FRAME_TX)       │    │
  │  │ nonce: 42            │    ──▶    │ nonce: (channel=0, seq=42)  │    │
  │  │ to: 0xUSDC           │           │ frames: [{                   │    │
  │  │ data: transfer(...)  │           │   to: 0xUSDC,               │    │
  │  │ sig: ECDSA(v,r,s)    │           │   data: transfer(...)       │    │
  │  └──────────────────────┘           │ }]                           │    │
  │                                      │ implicit ACCEPT via ECDSA   │    │
  │                                      └──────────────────────────────┘    │
  │                                                                          │
  │  [PROPOSED] The ECDSA signature would be treated as an implicit          │
  │  validation frame. ACCEPT(sender=recovered_address,                     │
  │  gas_payer=recovered_address) would happen automatically based on the   │
  │  ECDSA sig. Implementation: likely a protocol-level special case        │
  │  (if tx type < 0x05, do ECDSA recovery and set sender/gas_payer),      │
  │  NOT a synthetic frame injection.                                        │
  │                                                                          │
  │  BENEFIT: Zero change for existing users. Legacy txs keep working.      │
  │  Internally, they would be unified into the Frame TX model.              │
  │                                                                          │
  │  Option B: EIP-7702 Delegation Bridge  [SETTLED — uses existing EIP]     │
  │  ────────────────────────────────────────────────────────────────────    │
  │  EOA temporarily delegates to a smart wallet contract (via 7702),       │
  │  then sends a real Frame TX using that contract's validation logic.     │
  │                                                                          │
  │  Step 1: EOA signs 7702 delegation:                                      │
  │    auth = (chain_id=1, delegate=0xSmartWalletImpl, nonce=42)            │
  │    sig = ECDSA.sign(eoa_privkey, auth)                                  │
  │                                                                          │
  │  Step 2: Send SET_CODE_TX_TYPE (0x04) with delegation                   │
  │    → EOA now temporarily has SmartWallet code                            │
  │                                                                          │
  │  Step 3: Send Frame TX targeting the EOA (now has code)                  │
  │    → Validation frame calls EOA.validate() (SmartWallet logic)          │
  │    → Can now do multisig, key rotation, batched ops via frames          │
  │                                                                          │
  │  BENEFIT: Gradual migration. EOA keeps same address, gains capabilities.│
  │  Can always fall back to simple ECDSA tx.                                │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WHAT EOAs GAIN (with either approach)                                   │
  │                                                                          │
  │  ┌─────────────────────────┬────────────────┬────────────────────────┐  │
  │  │ Capability              │ Before 8141    │ After 8141             │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Key rotation            │ Impossible     │ Validation frame can   │  │
  │  │                         │ (key IS the    │ check any key stored   │  │
  │  │                         │  account)      │ in contract storage    │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Multisig                │ Impossible     │ Validation frame       │  │
  │  │                         │ (single key)   │ verifies N signatures  │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Gas sponsoring          │ Must hold ETH  │ Paymaster frame pays   │  │
  │  │                         │                │ gas (Diagram 6)        │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Batched operations      │ 1 call per tx  │ N frames per tx        │  │
  │  │                         │                │ (Diagram 2)            │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Social recovery         │ Impossible     │ Guardian validation    │  │
  │  │                         │                │ frame                  │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ Quantum resistance      │ ECDSA only     │ Any sig scheme in      │  │
  │  │                         │ (vulnerable)   │ validation frame       │  │
  │  │                         │                │ (Diagram 12)           │  │
  │  ├─────────────────────────┼────────────────┼────────────────────────┤  │
  │  │ 2D nonces               │ 1D only        │ Parallel nonce         │  │
  │  │                         │                │ channels (Diagram 8)   │  │
  │  └─────────────────────────┴────────────────┴────────────────────────┘  │
  │                                                                          │
  │  NO MIGRATION REQUIRED:                                                  │
  │  • Same address                                                          │
  │  • Same balance                                                          │
  │  • Same token holdings                                                   │
  │  • Same NFTs                                                             │
  │  • Existing approvals still work                                         │
  │  • Old tx format still works (implicit wrapping — if adopted [PROPOSED]) │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MIGRATION PATH TIMELINE                                                 │
  │                                                                          │
  │  Phase 1: Hegota fork                                                    │
  │  ├── Frame TX type (0x05) available alongside legacy types              │
  │  ├── EOAs can use legacy txs (unchanged)                                │
  │  ├── EOAs can use 7702 delegation to try Frame TXs                      │
  │  └── New accounts deploy as smart wallets natively                       │
  │                                                                          │
  │  Phase 2: Adoption grows                                                 │
  │  ├── Wallet SDKs add Frame TX support                                    │
  │  ├── Users gradually switch to smart wallet mode                        │
  │  ├── EOA implicit wrapping means everything keeps working [PROPOSED]    │
  │  └── Paymasters emerge, gas-in-any-token becomes common                 │
  │                                                                          │
  │  Phase 3: Long-term (years)                                              │
  │  ├── Most new accounts are smart wallets                                │
  │  ├── Legacy EOA txs are minority of traffic                             │
  │  ├── Quantum resistance available for early adopters                    │
  │  └── EOAs still work — no forced migration, ever                        │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 12: Atomic Operations + Quantum Resistance

**3D Animation Potential: 7/10** | Atomic: vulnerability gap closing into single wall. Quantum: static comparison card.

**Cross-refs:** Diagram 0 (sequential frame execution = atomicity guarantee),
Diagram 2 (multi-frame tx format), Diagram 4 (multisig as base pattern),
Diagram 9 (→ CONSERVATIVE tier: quantum sig verification is pure computation)

```
 ═══════════════════════════════════════════════════════════════════════════════
  ATOMIC MULTI-STEP OPERATIONS — approve + spend in ONE transaction
 ═══════════════════════════════════════════════════════════════════════════════

  PROBLEM: Today, "approve + spend" requires 2 separate transactions.
  If the second tx fails or gets front-run, the approval is left dangling
  (security risk: approved tokens can be stolen later).

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  BEFORE EIP-8141: Two Transactions (non-atomic)                          │
  │                                                                          │
  │  TX 1: USDC.approve(0xDEX, 1000e6)                                     │
  │  ├── Included in block N                                                │
  │  ├── Approval now exists on-chain                                       │
  │  ├── WINDOW OF VULNERABILITY: approval is live, spend hasn't happened  │
  │  │   → Attacker can call transferFrom if they control 0xDEX             │
  │  │   → MEV bot can sandwich                                             │
  │  │   → If user's wallet crashes, approval dangles forever               │
  │  │                                                                       │
  │  TX 2: DEX.swap(USDC, ETH, 1000e6)                                     │
  │  ├── May be included in block N+1 (or later)                            │
  │  ├── May FAIL (gas too low, nonce wrong, slippage exceeded)            │
  │  └── If fails: approval from TX 1 is still active (dangerous)          │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  AFTER EIP-8141: Single Frame TX (atomic)                                │
  │                                                                          │
  │  Frame TX with 3 frames: VALIDATE → APPROVE → SWAP                     │
  │                                                                          │
  │  Frame 0: Validation  (msg.sender = 0x0, sandbox)                       │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ to: 0xWallet                                                       │ │
  │  │ calldata: abi.encode(user_signature)                               │ │
  │  │                                                                     │ │
  │  │ // Read Frame 1 + Frame 2 calldata to authorize BOTH operations    │ │
  │  │ bytes f1 = CALLDATAREAD(frame=1, 0, *);  // approve calldata      │ │
  │  │ bytes f2 = CALLDATAREAD(frame=2, 0, *);  // swap calldata         │ │
  │  │ bytes32 opHash = keccak256(abi.encodePacked(                       │ │
  │  │   frames[1].to, f1,    // USDC.approve                             │ │
  │  │   frames[2].to, f2,    // DEX.swap                                 │ │
  │  │   block.chainid, nonce_sequence                                     │ │
  │  │ ));                                                                 │ │
  │  │ require(ecrecover(opHash, sig) == owner);                           │ │
  │  │ ACCEPT(sender: 0xWallet, gas_payer: 0xWallet);                     │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │           │                                                              │
  │           ▼ msg.sender = 0xWallet                                       │
  │  Frame 1: Approve  (committed)                                          │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ to: 0xUSDC                                                         │ │
  │  │ calldata: abi.encodeCall(approve, (0xDEX, 1000e6))                │ │
  │  │                                                                     │ │
  │  │ Approval set: USDC.allowance[0xWallet][0xDEX] = 1000e6            │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │           │                                                              │
  │           ▼ approval exists, immediately consumed                        │
  │  Frame 2: Swap  (committed)                                             │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ to: 0xDEX                                                          │ │
  │  │ calldata: abi.encodeCall(swap, (USDC, ETH, 1000e6, minOut))       │ │
  │  │                                                                     │ │
  │  │ DEX calls USDC.transferFrom(0xWallet, 0xDEX, 1000e6)              │ │
  │  │ DEX sends ETH to 0xWallet                                          │ │
  │  │ Allowance consumed: USDC.allowance[0xWallet][0xDEX] = 0           │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │                                                                          │
  │  ATOMICITY GUARANTEE (from Diagram 0):                                  │
  │  • If Frame 2 (swap) reverts → ENTIRE tx reverts                       │
  │  • Frame 1 (approve) is also reverted → no dangling approval            │
  │  • Approve and spend happen in same block, same tx                      │
  │  • No window of vulnerability between approve and spend                 │
  │  • No MEV sandwich between approve and spend                            │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MORE ATOMIC PATTERNS (same Frame TX structure)                          │
  │                                                                          │
  │  approve + spend + approve + spend (4 operations, 1 tx):                │
  │    Frame 0: validate all 4 operations                                    │
  │    Frame 1: USDC.approve(DEX_A, 500e6)                                  │
  │    Frame 2: DEX_A.swap(USDC, WETH, 500e6)                              │
  │    Frame 3: WETH.approve(DEX_B, *)                                      │
  │    Frame 4: DEX_B.swap(WETH, ARB, *)                                    │
  │    → USDC → WETH → ARB in one atomic tx                                │
  │    → if any step fails, everything reverts                               │
  │                                                                          │
  │  deploy + configure + fund (new protocol deployment):                    │
  │    Frame 0: validate                                                     │
  │    Frame 1: deploy contract via CREATE2                                  │
  │    Frame 2: configure contract (set admin, set params)                  │
  │    Frame 3: fund contract (transfer initial tokens)                     │
  │    → protocol is deployed, configured, and funded atomically            │
  │    → no window where contract exists but isn't configured               │
  └──────────────────────────────────────────────────────────────────────────┘

 ═══════════════════════════════════════════════════════════════════════════════
  QUANTUM RESISTANCE — Post-Quantum Signatures in Validation Frame
 ═══════════════════════════════════════════════════════════════════════════════

  PROBLEM: ECDSA (used by all Ethereum EOAs) is broken by quantum
  computers running Shor's algorithm. Timeline: 10-20 years.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WHY 8141 SOLVES THIS "FOR FREE"                                         │
  │                                                                          │
  │  The validation frame runs arbitrary EVM code. Signature verification   │
  │  is not hardcoded to ECDSA — it's whatever the validation contract      │
  │  implements. Swap ecrecover for a post-quantum scheme: done.            │
  │                                                                          │
  │  ECDSA validation (Diagram 4):                                           │
  │    address signer = ecrecover(hash, v, r, s);                            │
  │    require(signer == owner);                                              │
  │                                                                          │
  │  Hash-based (SPHINCS+) validation:                                       │
  │    bool valid = sphincsVerify(hash, signature, pubkey);                  │
  │    require(valid);                                                        │
  │                                                                          │
  │  Lattice-based (CRYSTALS-Dilithium) validation:                          │
  │    bool valid = dilithiumVerify(hash, signature, pubkey);                │
  │    require(valid);                                                        │
  │                                                                          │
  │  Same Frame TX structure. Same ACCEPT call. Same execution model.       │
  │  Only the verification algorithm changes.                                │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CONCRETE EXAMPLE: Dilithium-Signed Transaction                          │
  │                                                                          │
  │  Frame 0: Quantum-resistant validation                                   │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ to: 0xQuantumWallet                                                │ │
  │  │ calldata: abi.encode(dilithium_signature)                          │ │
  │  │ gas_limit: 500,000  (PQ sigs need more gas than ECDSA)            │ │
  │  │                                                                     │ │
  │  │ QuantumWallet.validate(bytes sig) {                                │ │
  │  │   bytes f1 = CALLDATAREAD(frame=1, 0, *);                         │ │
  │  │   bytes32 opHash = keccak256(abi.encodePacked(                     │ │
  │  │     frames[1].to, f1, block.chainid, nonce_seq                     │ │
  │  │   ));                                                               │ │
  │  │                                                                     │ │
  │  │   // Dilithium verification (EVM implementation or precompile)     │ │
  │  │   // Signature: 2420 bytes (vs ECDSA: 65 bytes)                    │ │
  │  │   // Pubkey: 1312 bytes (vs ECDSA: 64 bytes)                      │ │
  │  │   // Verification gas: ~300,000 (vs ECDSA: ~3,000 via ecrecover)  │ │
  │  │   bool valid = DilithiumLib.verify(opHash, sig, storedPubkey);     │ │
  │  │   require(valid, "invalid PQ signature");                           │ │
  │  │                                                                     │ │
  │  │   ACCEPT(sender: 0xQuantumWallet, gas_payer: 0xQuantumWallet);    │ │
  │  │ }                                                                   │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  │           │                                                              │
  │           ▼                                                              │
  │  Frame 1: Execution (identical to ECDSA case)                           │
  │  ┌────────────────────────────────────────────────────────────────────┐ │
  │  │ to: 0xUSDC                                                         │ │
  │  │ calldata: abi.encodeCall(transfer, (0xRecip, 1000e6))             │ │
  │  │ (same as Diagram 4 — only validation logic changed)               │ │
  │  └────────────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  POST-QUANTUM SCHEME COMPARISON                                          │
  │                                                                          │
  │  ┌──────────────┬─────────────┬───────────────┬───────────────────────┐ │
  │  │ Scheme       │ Sig Size    │ Verify Gas    │ Status                │ │
  │  ├──────────────┼─────────────┼───────────────┼───────────────────────┤ │
  │  │ ECDSA        │ 65 bytes    │ ~3,000        │ Current standard      │ │
  │  │ (secp256k1)  │             │ (ecrecover)   │ BROKEN by quantum    │ │
  │  ├──────────────┼─────────────┼───────────────┼───────────────────────┤ │
  │  │ SPHINCS+     │ 7,856 bytes │ ~800,000      │ NIST PQC standard    │ │
  │  │ (hash-based) │             │ (pure EVM)    │ Conservative choice  │ │
  │  │              │             │               │ Large sigs = costly  │ │
  │  ├──────────────┼─────────────┼───────────────┼───────────────────────┤ │
  │  │ Dilithium    │ 2,420 bytes │ ~300,000      │ NIST PQC standard    │ │
  │  │ (lattice)    │             │ (pure EVM)    │ Best size/speed ratio│ │
  │  │              │             │ ~50,000       │ (with precompile)    │ │
  │  │              │             │ (precompile)  │                       │ │
  │  ├──────────────┼─────────────┼───────────────┼───────────────────────┤ │
  │  │ STARKs       │ ~50 KB      │ ~500,000      │ Transparent setup    │ │
  │  │ (hash-based) │ (with FRI)  │               │ Ethereum-native      │ │
  │  │              │             │               │ Very large sigs      │ │
  │  └──────────────┴─────────────┴───────────────┴───────────────────────┘ │
  │                                                                          │
  │  THE REMAINING PROBLEM: Post-quantum signatures are 10-100x larger      │
  │  than ECDSA. Calldata costs ~16 gas per byte. A Dilithium signature    │
  │  costs 2420 × 16 = ~39,000 gas in calldata alone. SPHINCS+ costs       │
  │  7856 × 16 = ~126,000 gas.                                              │
  │                                                                          │
  │  ACTIVE RESEARCH: Signature aggregation (combine N signatures into 1)  │
  │  and proof compression (verify proof-of-valid-signature instead of      │
  │  the signature itself). These techniques could bring PQ sig costs       │
  │  close to ECDSA levels.                                                  │
  │                                                                          │
  │  MEMPOOL: Quantum-resistant validation is pure computation (no external │
  │  state reads) → CONSERVATIVE tier (see Diagram 9).                      │
  └──────────────────────────────────────────────────────────────────────────┘
```
