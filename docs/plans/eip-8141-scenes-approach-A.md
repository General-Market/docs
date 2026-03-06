# EIP-8141 3D Scene Design -- Approach A: Layered Pipeline

**Date**: 2026-03-03
**Method**: 6-stage Layered Pipeline (Munzner -> Lakoff/Tversky -> Bertin -> McCloud/Tufte -> Bruner/Victor/Distill -> Mayer/Tufte)
**Scope**: 8 scenes for the EIP-8141 (Frame Transactions) article
**Constraint**: Design only. No code.

---

## Stage 1: Concept Decomposition (Munzner's What-Why-How)

For each concept in the article, I classify what the reader needs to see, why they need it, and what type of abstraction it represents.

### Concept 1: Normal TX vs Frame TX (structural difference)

| Dimension | Answer |
|-----------|--------|
| **What** | Two transaction structures side by side. Left: 1 sender, 1 signature, 1 action. Right: N frames, 0 signatures in envelope, auth via ACCEPT inside. |
| **Why** | The reader needs a baseline. Without seeing what they already know (normal TX), the new thing (Frame TX) has no contrast. This is the entry point. |
| **How** | Spatial comparison. Two objects next to each other, differing in structure. |
| **Classification** | **Comparative** -- the entire point is A vs B juxtaposition. |

### Concept 2: Frame TX internal mechanics (ACCEPT gate, sandbox-to-committed)

| Dimension | Answer |
|-----------|--------|
| **What** | An envelope containing ordered frames. Frame 0 runs in sandbox mode (untrusted). It calls ACCEPT. Everything after ACCEPT runs in committed mode (trusted). CALLDATAREAD lets frames inspect each other. |
| **Why** | The reader needs to understand the single most important mechanism: ACCEPT is a threshold that flips the execution context from untrusted to trusted. |
| **How** | Temporal sequence with a mode transition. Left-to-right progression through a gate. |
| **Classification** | **Temporal + Causal** -- time flows left to right, and the gate CAUSES the mode shift. |

### Concept 3: Multisig authentication (two signers, one vault, CALLDATAREAD)

| Dimension | Answer |
|-----------|--------|
| **What** | Alice and Bob each provide a signature. Frame 0 (validator) checks both signatures, uses CALLDATAREAD to inspect what Frame 1 will do, then calls ACCEPT. Frame 1 executes the transfer. |
| **Why** | This is the simplest non-trivial use case. It proves Frame TXs can do N-of-M auth in one transaction without a bundler. |
| **How** | Causal flow. Inputs (signatures) cause verification, which causes approval, which causes execution. |
| **Classification** | **Causal** -- a chain of causes and effects with a branching success/failure outcome. |

### Concept 4: Paymaster gas abstraction (pay gas in any token)

| Dimension | Answer |
|-----------|--------|
| **What** | User has RAI tokens but no ETH. Paymaster contract covers gas in ETH, then collects RAI as its fee. The paymaster uses CALLDATAREAD to verify the user's intent before agreeing to pay. |
| **Why** | "Pay gas in any token" is the most relatable improvement for non-technical readers. Everyone understands "I have this currency but the system wants that currency." |
| **How** | Exchange/flow. Two different resources move in opposite directions through a mediator. |
| **Classification** | **Causal + Quantitative** -- the paymaster's decision (cause) enables the user's action (effect), and specific token quantities flow. |

### Concept 5: Account deployment (wallet doesn't exist yet)

| Dimension | Answer |
|-----------|--------|
| **What** | Frame 0 deploys the wallet via a factory (CREATE2). Frame 1 validates against the just-deployed wallet. Frame 2 executes the user's first action. Funds can be pre-sent to the address before the wallet exists (deterministic addressing). |
| **Why** | This demonstrates that Frame TXs can bootstrap a wallet from nothing in a single transaction. The "address exists before the wallet" insight is counterintuitive and memorable. |
| **How** | Temporal sequence with construction. Empty plot -> building -> usage. |
| **Classification** | **Temporal** -- three phases that MUST happen in order (deploy, validate, execute). |

### Concept 6: ZK privacy (no relayer needed)

| Dimension | Answer |
|-----------|--------|
| **What** | A deposit goes into an anonymous pool. Later, a ZK proof proves membership without revealing which deposit. Frame 0 (ZK paymaster) verifies the proof and pays gas. Frame 1 executes the withdrawal to a fresh address. No link between deposit and withdrawal. No relayer. |
| **Why** | This is the "killer app" argument: Frame TXs eliminate the trusted relayer that every privacy protocol currently needs. |
| **How** | Negation visual. The core insight is a BROKEN link -- something that does NOT exist. |
| **Classification** | **Causal + Spatial** -- the broken link is spatial (two addresses with no connection), and the mechanism (ZK proof -> ACCEPT -> withdrawal) is causal. |

### Concept 7: FOCIL anti-censorship (committee forces inclusion)

| Dimension | Answer |
|-----------|--------|
| **What** | Without FOCIL: a block builder can drop Frame TXs (too complex, too different). With FOCIL: a committee of validators creates inclusion lists that force the builder to include valid transactions. |
| **Why** | Addresses the natural reader objection: "What if the network just ignores these new transactions?" |
| **How** | Before/after comparison. Same scenario, different outcomes. |
| **Classification** | **Comparative** -- with vs without protection. |

### Concept 8: Atomic batch operations (no sandwich attack gap)

| Dimension | Answer |
|-----------|--------|
| **What** | Currently: approve and swap are two separate transactions with a vulnerability gap between them (an attacker can sandwich). With Frame TX: approve and swap are frames in one atomic transaction. No gap. |
| **Why** | Emotional close. People have lost money to sandwich attacks. The "gap closes" metaphor resolves the article on a concrete safety improvement. |
| **How** | Before/after with a spatial gap that closes. |
| **Classification** | **Comparative + Spatial** -- the gap is literally a space between two objects that collapses. |

---

## Stage 2: Metaphor Selection (Lakoff/Johnson + Tversky's Correspondence)

For each concept, I find a physical experience the reader already knows, then verify structural correspondence.

### Scene 1: Normal TX vs Frame TX

**Metaphor: Postcard vs Sealed Package with Compartments**

A normal transaction is a postcard -- flat, single-purpose, signature on the back, everyone can read it, one sender, one message. A Frame TX is a sealed package with internal compartments -- the package has no signature on the outside (authentication is inside compartment 0), compartments can reference each other, and a customs gate (ACCEPT) must be passed before the contents reach their destination.

**Tversky check**: Both concepts are STRUCTURAL (how something is organized). A postcard and a package are structural objects. The metaphor maps: single surface -> single-action TX; compartments -> frames; no external label -> no signature in envelope; customs inspection -> ACCEPT. The form (structural comparison) matches the concept (structural comparison). PASS.

**Lakoff/Johnson check**: We understand TRANSACTIONS AS CONTAINERS. This is the "conduit metaphor" -- messages are objects, communication is sending objects. The postcard/package extends this to "simple container vs complex container." People already think this way about mail. PASS.

### Scene 2: Frame TX Mechanics (ACCEPT gate)

**Metaphor: Airlock**

A spacecraft airlock has two modes: outer door open (vacuum, dangerous, untrusted) and inner door open (pressurized, safe, trusted). You cannot have both doors open at once. The moment you seal the outer door and pressurize (ACCEPT) is the threshold that flips the environment from hostile to safe.

Frame 0 runs in the "vacuum" side. ACCEPT seals the outer door. Frames 1+ run in the "pressurized" side.

**Tversky check**: The concept is TEMPORAL with a MODE TRANSITION. An airlock is temporal (you go through it in sequence) with a mode transition (pressure state flips). The form matches. PASS.

**Lakoff/Johnson check**: "TRUST IS CONTAINMENT" -- we understand being inside a safe boundary as being trusted. The airlock literalizes this: outside is untrusted, inside is trusted, and the gate is the moment of passage. PASS.

**Rejected alternative**: "Traffic light" (red/green) -- too simple, doesn't convey the environmental mode change. A traffic light allows or blocks; an airlock transforms the environment. The concept needs transformation, not permission.

### Scene 3: Multisig Authentication

**Metaphor: Bank Vault with Two-Key Lock**

Two key-holders (Alice and Bob) each insert their key. The vault mechanism won't turn unless both keys are present. Before opening, the vault's inspection window lets the operator see what's inside the next room (CALLDATAREAD -- the vault reads ahead). Only then does the vault door open (ACCEPT) and the contents (the USDC transfer) proceed.

**Tversky check**: The concept is CAUSAL (inputs cause verification cause action). A two-key vault is causal (both keys required -> door opens -> contents accessible). The inspection window maps to CALLDATAREAD (looking ahead before committing). PASS.

**Lakoff/Johnson check**: "AUTHORIZATION IS UNLOCKING" -- universally understood. Two keys for extra security is a known banking concept. PASS.

### Scene 4: Paymaster Gas Abstraction

**Metaphor: Currency Exchange Booth at an Airport**

You arrive at a foreign country (Ethereum) with only your home currency (RAI). The airport exchange booth (paymaster) accepts your RAI and gives you local currency (ETH) to pay for the taxi (gas). The booth checks your documents first (CALLDATAREAD -- inspects your intended transaction) before agreeing to the exchange.

**Tversky check**: The concept is an EXCHANGE with a GATEKEEPER. A currency booth is an exchange with a gatekeeper (they verify before converting). Quantities flow in both directions through a mediator. PASS.

**Lakoff/Johnson check**: "PAYMENT IS EXCHANGE" and "FOREIGN CURRENCY IS BARRIER." Everyone who has traveled internationally understands being stuck with the wrong currency. PASS.

**Rejected alternative**: "Translator" metaphor -- structurally weak because translation doesn't involve resource exchange. The concept requires bidirectional flow of different resources, not transformation of one thing into the same thing in a different language.

### Scene 5: Account Deployment

**Metaphor: Buying a Plot with a Known Address Before Building the House**

You own a plot of land at 42 Elm Street. The address is printed on the map. Packages can be delivered there. But no house exists yet. In one visit, a construction crew (Frame 0: factory deploy) builds the house, a locksmith (Frame 1: validation) installs the door lock, and you (Frame 2) walk in and make your first phone call. The address was always real; the house just didn't exist until now.

**Tversky check**: The concept is TEMPORAL (three sequential phases of construction). A building sequence is temporal. The "address before house" maps to "funds at address before wallet." PASS.

**Lakoff/Johnson check**: "ACCOUNTS ARE PLACES" and "DEPLOYMENT IS CONSTRUCTION." Addresses-as-locations is already how people think about blockchain accounts. PASS.

### Scene 6: ZK Privacy (No Relayer)

**Metaphor: Anonymous Ballot Box**

You put your ballot (deposit) into a sealed box along with hundreds of others. Later, you prove you put a ballot in (ZK proof) without revealing WHICH ballot was yours. A clerk (ZK paymaster / Frame 0) verifies the proof and stamps your withdrawal slip. You collect your winnings (Frame 1: withdrawal) from a separate window. No one can trace the withdrawal back to your deposit. Critically: the clerk is inside the system (a frame), not a separate trusted person you have to hire (no relayer).

**Tversky check**: The concept is about BROKEN CORRESPONDENCE -- the visual must show a non-link. A ballot box creates anonymity through mixing. The ZK proof proves membership without identity. The "no relayer" insight maps to "the clerk is behind the same counter, not a separate person in the parking lot." PASS.

**Lakoff/Johnson check**: "PRIVACY IS MIXING" and "TRUST IS PROXIMITY." An internal clerk (frame) vs an external middleman (relayer) maps to proximity-as-trust. PASS.

### Scene 7: FOCIL Anti-Censorship

**Metaphor: Bouncer at a Club vs Fire Marshal**

Without FOCIL: the bouncer (block builder) decides who gets in. If they don't like your outfit (Frame TX complexity), they turn you away. With FOCIL: a fire marshal (committee) inspects the line and says "these people have valid tickets -- they MUST be admitted." The bouncer can still arrange people inside the club, but cannot refuse entry to anyone the marshal has approved.

**Tversky check**: The concept is COMPARATIVE (two scenarios differing in one variable: presence of oversight). A before/after authority comparison. PASS.

**Lakoff/Johnson check**: "INCLUSION IS ENTRY" and "AUTHORITY IS HIERARCHY." The two-authority structure (builder vs committee) maps to bouncer vs marshal -- one is overridden by the other. PASS.

### Scene 8: Atomic Batch Operations

**Metaphor: Revolving Door vs Two Separate Doors**

Two separate doors with a sidewalk between them: you exit door 1 (approve), walk across the exposed sidewalk (vulnerability gap -- an attacker can intercept you), and enter door 2 (swap). A revolving door: you step in, the door rotates, and you step out. There is no exposed sidewalk. No gap. No interception point.

**Tversky check**: The concept is SPATIAL (a gap exists or doesn't exist). A physical gap between doors is spatial. The revolving door eliminates the gap. PASS.

**Lakoff/Johnson check**: "VULNERABILITY IS EXPOSURE" and "ATOMICITY IS ENCLOSURE." Being between two doors (exposed) vs inside a revolving door (enclosed) maps perfectly to non-atomic vs atomic operations. PASS.

**Rejected alternative**: "Dominos" -- structurally wrong because dominos suggest sequential dependency, not the presence/absence of a gap. The concept is about the GAP, not the sequence.

---

## Stage 3: Visual Encoding (Bertin's 7 Visual Variables)

For each scene, I assign exactly one meaning to each visual variable used. No overloading.

### Global Variable Assignments (consistent across all 8 scenes)

| Variable | Meaning | Specifics |
|----------|---------|-----------|
| **Position (x-axis)** | Time / sequence progression | Left = earlier, right = later. Frames execute left to right. |
| **Position (y-axis)** | Authority level | Higher = more authority / trusted. ACCEPT gate elevates. |
| **Color hue** | Role identity | Blue = data/transaction. Purple = authentication/cryptography. Green = success/committed. Red = danger/attack/untrusted. Amber = cross-frame reads (CALLDATAREAD). Indigo = gas/payment. |
| **Value (lightness)** | Mode state | Dark/saturated = committed/real. Light/desaturated = sandbox/tentative. The airlock flip from light to dark at ACCEPT. |
| **Size** | Importance / quantity | Larger objects carry more weight in the scene. The ACCEPT gate is the largest element in Scene 2. Signature cubes are small. The vault is large. |
| **Shape** | Object type | RoundedBox = frame container. Sphere = token/value unit. Cylinder = signature/key. Torus = ACCEPT ring. Wireframe box = envelope. Tube = flow path. |
| **Texture/surface** | Transparency = certainty | Opaque = certain/committed. Translucent/wireframe = tentative/envelope/container. |
| **Orientation** | NOT USED | Reserving orientation to avoid overload. All objects face the camera or sit flat. |

### Per-Scene Variable Maps

**Scene 1 (Normal vs Frame TX):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Left vs right position | Position (x) | Old vs new |
| Small blue box (normal TX) | Shape + color | Single transaction = compact container + data blue |
| Purple cylinder below normal TX | Shape + color | ECDSA signature = key shape + auth purple |
| Large wireframe box (Frame TX envelope) | Texture (wireframe) | Container, not content |
| Three RoundedBoxes inside envelope | Shape + position | Three frames, left-to-right order |
| Frame 0 is purple tint | Color | Auth frame |
| Frames 1-2 are blue tint | Color | Data/execution frames |
| Red X below envelope | Color | No signature in envelope |
| Green arch between F0 and F1 | Color + position | ACCEPT gate at the boundary |

No variable carries two meanings. PASS.

**Scene 2 (ACCEPT Gate / Airlock):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Left zone (light/desaturated) | Value (lightness) | Sandbox / untrusted |
| Right zone (dark/saturated) | Value (lightness) | Committed / trusted |
| Gate in the center | Position (x) + size | ACCEPT is the midpoint, visually dominant |
| Cube color transition (desaturated -> saturated) | Value | Mode state change |
| Amber arc (CALLDATAREAD) | Color | Cross-frame data read |
| Frame containers left-to-right | Position (x) | Execution order |

**Scene 3 (Multisig):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Two purple cylinders (Alice, Bob keys) | Shape + color | Two signatures |
| Central vault (large RoundedBox) | Size + shape | Validator = important + container |
| Green torus (ACCEPT ring) | Shape + color | Approval event |
| Amber arc from vault to F1 cube | Color | CALLDATAREAD |
| Blue sphere moving to recipient | Shape + color | Value transfer = spherical token + data blue |

**Scene 4 (Paymaster):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Amber discs (RAI tokens) | Color | User's currency |
| Green spheres (ETH) | Color | Network currency |
| Indigo hexagonal prism (paymaster) | Color + shape | Payment mediator = unique shape + indigo |
| Amber arc (CALLDATAREAD) | Color | Paymaster reads user's intent |
| Flow direction (amber left-to-right, green right-to-left) | Position (x) trajectory | Bidirectional exchange |

**Scene 5 (Account Deploy):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Empty platform with address sign | Position + size | Plot of land (address exists) |
| Small coins on empty platform | Shape (sphere) | Pre-funded value waiting |
| Construction beam (Frame 0) | Color (blue) | Deploy action |
| Lock installation (Frame 1) | Color (purple) | Auth setup |
| User action (Frame 2) | Color (green) | First committed action |
| Three sequential phases left-to-right | Position (x) | Temporal order |

**Scene 6 (ZK Privacy):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Blue sphere (deposit address) | Color | Known identity |
| Green sphere (fresh address) | Color | New identity |
| Red dashed line with X between them | Color + texture (dashed) | Broken link = danger + uncertainty |
| Purple cube (ZK proof) | Color + shape | Cryptographic proof |
| Frame TX wireframe box | Texture (wireframe) | Transaction container |
| Two RoundedBoxes inside (F0, F1) | Shape + position | ZK paymaster frame + withdrawal frame |
| Amber arc (CALLDATAREAD) | Color | Paymaster reads withdrawal data |

**Scene 7 (FOCIL):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Left zone (without FOCIL) | Position (x) | "Before" state |
| Right zone (with FOCIL) | Position (x) | "After" state |
| Red X blocking blue cubes (left) | Color | Censorship |
| Green shield (right) | Color + shape | FOCIL protection |
| Blue cubes = Frame TXs | Color | Transaction data |
| Gray cubes = EOA txs | Value (gray = neutral) | Regular transactions (not targeted) |

**Scene 8 (Atomic Batch):**

| Visual Element | Variable Used | Meaning Encoded |
|----------------|--------------|-----------------|
| Top zone (before: two separate TXs) | Position (y) | "Before" state |
| Bottom zone (after: one Frame TX) | Position (y) | "After" state |
| Red gap between TX1 and TX2 (top) | Color + position gap | Vulnerability window |
| Red arrow (attacker) dropping into gap | Color + shape | Attack vector |
| Single wireframe envelope (bottom) with 3 frames | Texture + shape | Atomic container |
| No gap in bottom | Absence of position gap | No vulnerability |

Every scene: each visual variable carries at most one meaning. No overloading detected across any scene. PASS.

---

## Stage 4: Scene Composition (McCloud's 6 Transitions + Tufte)

### Transition Type Selection Per Scene

| Scene | McCloud Transition | Justification |
|-------|-------------------|---------------|
| 1: Normal vs Frame | **Subject-to-subject** | Two subjects (TX types) presented for comparison. Reader's eye moves between them. |
| 2: ACCEPT Gate | **Action-to-action** | Sequential actions: frame executes -> CALLDATAREAD -> ACCEPT fires -> mode flips. Each step is a discrete action. |
| 3: Multisig | **Action-to-action** | Alice signs -> Bob signs -> vault checks -> CALLDATAREAD -> ACCEPT -> transfer. Causal chain of actions. |
| 4: Paymaster | **Action-to-action** | User shows tokens -> paymaster inspects -> paymaster pays gas -> user acts -> paymaster collects fee. |
| 5: Account Deploy | **Moment-to-moment** | Three phases of the same location: empty plot -> construction happening -> house built. Each is a moment in a continuous process at one location. |
| 6: ZK Privacy | **Aspect-to-aspect** | The scene shows multiple aspects of the same situation simultaneously: the broken link, the ZK proof flow, the frame structure. Reader wanders between aspects rather than following a single narrative. The key insight (no link) is spatial, not temporal. |
| 7: FOCIL | **Scene-to-scene** | Two different scenarios (without FOCIL / with FOCIL). The reader must make a conceptual leap between two alternate realities. |
| 8: Atomic Batch | **Scene-to-scene** | Before (two TXs, gap) and after (one TX, no gap). Two realities separated by a conceptual shift. |

### Tufte Data-Ink Audit

For each scene, I identify elements that carry information vs elements that are purely decorative. Decorative elements get cut.

**Scene 1:**
- KEEP: Both TX structures, ACCEPT gate, "No Sig" X mark, labels "Normal TX" and "Frame TX."
- CUT: Flow arrow particles on the normal TX side. They are decorative -- the arrow itself conveys direction. Particles add motion but no information.
- CUT: Auto-rotate orbit. Adds nothing to a comparison scene. Lock the camera in the optimal comparison angle.
- RESULT: ~30 objects (down from 40 in the original proposal).

**Scene 2:**
- KEEP: Envelope wireframe, frame containers, ACCEPT gate, color zones (light/dark), CALLDATAREAD amber arc, cube traveling through.
- CUT: Ambient dust particles. Pure decoration.
- CUT: Platform border decorations. The color zones themselves communicate sandbox/committed.
- REDUCE: Flow particles from 12 to 6. The tube geometry already shows the path.
- RESULT: ~45 objects.

**Scene 3:**
- KEEP: Alice/Bob signature nodes, vault, ACCEPT ring, CALLDATAREAD arc, Frame 1 execution block, transfer beam.
- CUT: Lock icon on vault. The vault shape itself communicates "secure container." The lock is redundant.
- CUT: Third signature position (empty). Two signers are sufficient to demonstrate N-of-M.
- RESULT: ~65 objects.

**Scene 4:**
- KEEP: User node with RAI tokens, paymaster hexagonal prism with ETH reserve, CALLDATAREAD arc, bidirectional token flow, ACCEPT ring.
- CUT: Recipient node. The scene is about gas payment, not about what the user's action does. Remove the "what happens after gas is paid" sub-flow entirely.
- CUT: Multiple CALLDATAREAD arcs. One arc is sufficient. The original proposal had three (one per frame). One communicates the concept.
- RESULT: ~45 objects.

**Scene 5:**
- KEEP: Empty platform with address sign, pre-funded coins, construction beam, lock installation, user action.
- CUT: Cross-chain ghost platforms. This was already removed in the revised proposal. Confirm: cross-chain belongs in article text, not the 3D scene.
- CUT: Gas accounting visualization. Implementation detail, not visual concept.
- RESULT: ~40 objects.

**Scene 6:**
- KEEP: Two addresses (deposit, fresh), broken-link red line, Frame TX envelope with F0 and F1, ZK proof cube, ACCEPT ring, CALLDATAREAD arc, "No relayer" comparison.
- CUT: Pool animation (25 crowd instances). The pool is a concept, not a thing to animate. Replace with a single opaque cylinder labeled "Privacy Pool" with a deposit count.
- CUT: Phase labels that overlap. The final review flagged 13+ labels. Reduce to 6 maximum on screen at any time.
- RESULT: ~50 objects (down from 75).

**Scene 7:**
- KEEP: Left side (red X blocking blue cubes), right side (green shield, all cubes enter block).
- CUT: Committee node circle (16 nodes). The committee is not the point; the EFFECT of the committee is the point. Replace 16 nodes with one shield icon.
- CUT: Attester/builder/mempool actor breakdown. Too many actors for a 3-second read.
- RESULT: ~35 objects.

**Scene 8:**
- KEEP: Two-TX gap (top) with attacker arrow, single Frame TX (bottom) with no gap.
- CUT: The approval/swap detail labels inside frames. The concept is "gap vs no gap," not "approve then swap." The frame contents are secondary.
- RESULT: ~40 objects.

**Total across 8 scenes: ~350 objects** (down from ~448 in the revised proposal, ~940 in the original). Maximum simultaneous render: ~130 (3 adjacent scenes, ~35-65 each).

---

## Stage 5: Interaction Design (Bruner + Bret Victor + Distill)

### Bruner's Progression: Enactive -> Iconic -> Symbolic

For each scene, I design the reader's cognitive path from DOING to SEEING to NAMING.

**Scene 1 (Normal vs Frame TX):**
- **Enactive**: On first load, only the left side (Normal TX) is visible. The reader sees something familiar. After 2 seconds, the right side (Frame TX) fades in. The reader can orbit to examine each side. The physical act of comparing (eyes moving left-right) IS the learning.
- **Iconic**: The difference is visible: small simple thing vs large complex thing. Padlock on the left, empty space where a padlock would be on the right. The visual image carries the concept.
- **Symbolic**: Labels arrive last. "1 sender, 1 sig, 1 action" on the left. "N frames, auth inside" on the right. The words name what the reader has already seen.

**Scene 2 (ACCEPT Gate):**
- **Enactive**: The reader watches a cube travel left-to-right through the scene. This is movement they track with their eyes. The physical tracking IS engagement. When the cube hits the gate, the environment CHANGES (light zone -> dark zone). The reader experiences the transition.
- **Iconic**: The color shift from desaturated to saturated is the image that sticks. "Before the gate: washed out. After the gate: vivid." This visual contrast encodes the concept without words.
- **Symbolic**: Labels: "Sandbox" (before gate), "ACCEPT" (at gate), "Committed" (after gate). Naming the zones the reader has already experienced.

**Scene 3 (Multisig):**
- **Enactive**: Two keys arrive, vault opens, transfer happens. The reader tracks the causal chain. Optional interaction: hover over the vault to see it highlight the CALLDATAREAD arc ("the vault is reading ahead").
- **Iconic**: Two keys + locked vault = "both required." This image is immediately understood.
- **Symbolic**: Labels: "Alice," "Bob," "ACCEPT," "Transfer." Words confirm what the icons showed.

**Scene 4 (Paymaster):**
- **Enactive**: The reader sees RAI tokens leave the user and ETH leave the paymaster. Two flows crossing in opposite directions. The physical crossing IS the exchange concept.
- **Iconic**: Two different-colored token streams crossing through a central node. The image of exchange.
- **Symbolic**: Labels: "RAI," "ETH," "Paymaster pays gas." Naming the currencies and the mechanism.

**Scene 5 (Account Deploy):**
- **Enactive**: Empty platform -> building appears -> user walks in. The reader watches construction. The temporal sequence IS understanding.
- **Iconic**: Empty lot with an address sign + coins waiting = "the address is real before the building exists."
- **Symbolic**: "Frame 0: Deploy," "Frame 1: Validate," "Frame 2: Execute."

**Scene 6 (ZK Privacy):**
- **Enactive**: Reader sees two addresses. A dashed red line with an X connects them. The X immediately communicates "no connection." The reader experiences the absence of a link as the primary sensation.
- **Iconic**: Broken line between two nodes = "can't trace." The most important image in the entire article.
- **Symbolic**: "NO LINK," "ZK proof," "No relayer needed."

**Scene 7 (FOCIL):**
- **Enactive**: Left side: cubes approach a gate, some get blocked (red X). Right side: all cubes pass through (green shield). The reader's frustration at blocked cubes (left) resolves into satisfaction at full passage (right).
- **Iconic**: Red X vs green checkmark. Blocked vs free.
- **Symbolic**: "Without FOCIL," "With FOCIL."

**Scene 8 (Atomic Batch):**
- **Enactive**: Top: two boxes with a GAP between them. A red arrow drops into the gap (attack). The reader viscerally sees the danger. Bottom: one box, no gap. The red arrow bounces off. Relief.
- **Iconic**: Gap = danger. No gap = safety. The spatial absence is the concept.
- **Symbolic**: "Vulnerability window," "Atomic: no gap."

### Bret Victor: Direct Manipulation + Small Parts First

Each scene follows a "small part first, then combine" structure:

1. The FIRST visual element appears alone (1-2 seconds of screen time for just that one thing).
2. The SECOND element appears and relates to the first.
3. Additional elements build until the full scene is complete.

This prevents cognitive overload from seeing everything at once.

Specific application: Scene 2 starts with JUST the cube. Then the gate appears. Then the zones color. Then CALLDATAREAD arcs in. Each addition is incremental. The reader never faces a fully-assembled scene they have to decode all at once.

### Distill's 5 Affordances

| Affordance | How Applied |
|------------|------------|
| **Connect** | CALLDATAREAD arcs visually connect frames across scenes. The amber color is consistent everywhere, so the reader learns "amber = one frame reading another" in Scene 2 and recognizes it instantly in Scenes 3, 4, and 6. |
| **Play** | Orbit controls on every scene. The reader can rotate to examine from different angles. Not every reader will, but the option exists. |
| **Reflect** | Each scene has a 1-2 second "hold" at the end of the animation loop where the full picture is visible and stable. This is reflection time -- the reader can study the complete state before it loops. |
| **Personalize** | Not applicable at this scope. Future: let readers input their own token names into the paymaster scene. |
| **Reduce cognitive load** | Progressive reveal (Victor). Maximum 5 labels at a time (Tufte). Consistent color vocabulary (Bertin). No decorative elements (Tufte data-ink). |

---

## Stage 6: Editing Pass (Mayer + Tufte)

### Mayer's Coherence Principle: Cut irrelevant visuals

| Scene | Element Cut | Reason |
|-------|-----------|--------|
| 1 | Flow particles on normal TX arrow | Motion without information. The arrow already shows direction. |
| 1 | Auto-rotate orbit | Comparison needs stillness, not motion. Lock the camera. |
| 2 | Ambient dust particles | Decoration. Zero data. |
| 3 | Empty third-signer position | Only two signers are needed to prove N-of-M. A third empty slot raises questions instead of answering them. |
| 4 | Recipient node and transfer sub-flow | Scene is about gas abstraction, not about the user's action. Showing the recipient distracts from the gas story. |
| 4 | Second and third CALLDATAREAD arcs | One arc communicates "paymaster reads user's intent." Three arcs communicate "there are exactly three frames," which is an implementation detail, not a concept. |
| 5 | Cross-chain ghost platforms | Article text handles cross-chain. The 3D scene handles the deploy sequence. |
| 5 | Gas accounting numbers | Implementation detail. Belongs in article text. |
| 6 | 25-instance anonymous crowd | Replace with one opaque cylinder. The crowd is decoration; the broken-link line is the concept. |
| 6 | 7 of 13 labels (down to 6 max) | Label overlap degrades readability. |
| 7 | 16-node committee circle | Replace with one shield. The committee's structure is not the point; its effect (forced inclusion) is. |
| 8 | Frame content labels (approve, swap) | The concept is "gap vs no gap." What's inside the frames is secondary. |

### Mayer's Signaling Principle: Guide attention

| Scene | Signaling Device | What It Guides Toward |
|-------|-----------------|----------------------|
| 1 | Right side fades in AFTER left side is established (2s delay) | "Look at what you know first, then compare to the new thing." |
| 2 | Gate is the LARGEST object in the scene, positioned at exact center | "This is the most important element." |
| 2 | Color saturation shift happens in a 0.5s burst, not a gradual fade | "The mode change is sudden and decisive, not gradual." |
| 3 | ACCEPT torus ring expands from 0 to full size in 0.3s | "This is the moment of approval." |
| 4 | RAI and ETH streams cross at the paymaster node | "The exchange happens HERE, at the mediator." |
| 6 | Red dashed "NO LINK" line is the FIRST thing visible (before any animation starts) | "The punchline is the starting point. Everything else explains how you got here." |
| 7 | Red X on left side pulses once per loop | "Pay attention to the censorship." |
| 8 | Red attacker arrow arrives with a visual "impact" flash | "This is the threat." |

### Mayer's Segmenting Principle: Break into user-paced steps

All scenes use auto-playing animation loops (the article is scroll-based, not click-based). But segmenting is still applied through TEMPORAL GROUPING within each loop:

| Scene | Loop Length | Segments |
|-------|-----------|----------|
| 1 | 8s | [0-2s] Left side alone. [2-4s] Right side fades in. [4-6s] ACCEPT animation plays on right. [6-8s] Both sides hold for comparison. |
| 2 | 10s | [0-3s] Cube appears and travels toward gate. [3-4s] CALLDATAREAD arc fires. [4-6s] Cube hits gate, environment flips. [6-8s] Cube continues to committed zone. [8-10s] Hold. |
| 3 | 10s | [0-2s] Alice and Bob keys arrive. [2-4s] Vault checks. CALLDATAREAD arc. [4-6s] ACCEPT fires. [6-8s] Transfer beam. [8-10s] Hold. |
| 4 | 10s | [0-3s] User shows RAI, paymaster shows ETH. [3-5s] CALLDATAREAD. Paymaster checks. [5-8s] ETH flows from paymaster (gas paid), user acts, RAI flows to paymaster. [8-10s] Hold. |
| 5 | 10s | [0-3s] Empty plot with address sign and pre-funded coins. [3-5s] Construction beam (deploy). [5-7s] Lock installs (validate + ACCEPT). [7-9s] User enters (execute). [9-10s] Hold. |
| 6 | 10s | [0-2s] Two addresses with broken-link line (static, this is the anchor). [2-5s] ZK proof enters Frame 0. CALLDATAREAD arc. ACCEPT fires. [5-8s] Withdrawal beam to fresh address. [8-10s] "No relayer" comparison text. Hold. |
| 7 | 8s | [0-4s] Left side: cubes blocked, red X pulses. [4-6s] Right side: shield appears, all cubes pass. [6-8s] Both sides hold. |
| 8 | 8s | [0-3s] Top: two TXs with gap. Attacker arrow drops in. [3-5s] Bottom: single Frame TX, no gap. Arrow bounces off. [5-8s] Both visible. Hold. |

Every scene ends with a 2-second hold. This is the reflection moment (Distill) and the segmenting boundary (Mayer).

### Mayer's Spatial Contiguity Principle: Labels next to what they describe

| Scene | Label | Placement Rule |
|-------|-------|---------------|
| All | Frame labels ("Frame 0," "Frame 1") | ABOVE the frame container, centered, 0.2 units above top face. Never to the side. Never below. |
| All | ACCEPT label | AT the ACCEPT gate position, slightly above the torus/arch. Never floating free. |
| All | CALLDATAREAD label | ON the amber arc, at its midpoint. Never detached from the arc. |
| 1 | "Normal TX" / "Frame TX" titles | ABOVE each platform, not at the scene top or bottom. |
| 6 | "NO LINK" label | ON the dashed red line between the two addresses. Exactly centered on the line. |
| 8 | "Vulnerability window" label | INSIDE the red gap between the two TX boxes (top). Not above or below the gap. |

### Tufte: Final Data-Ink Ratio Check

| Scene | Total visual elements | Elements carrying information | Data-ink ratio |
|-------|----------------------|------------------------------|---------------|
| 1 | ~30 | ~28 (2 platform borders are structural, not data) | 93% |
| 2 | ~45 | ~40 (5 flow particles are motion-emphasis, not data) | 89% |
| 3 | ~65 | ~58 (7 flow particles) | 89% |
| 4 | ~45 | ~40 | 89% |
| 5 | ~40 | ~36 | 90% |
| 6 | ~50 | ~46 | 92% |
| 7 | ~35 | ~33 | 94% |
| 8 | ~40 | ~38 | 95% |

All scenes above 85% data-ink ratio. Acceptable. The remaining decorative elements (flow particles) serve as motion cues that help the reader track directionality, which is an arguable data function.

---

## Final Scene Specifications

### Scene 1: NormalVsFrame3D -- "What's Different?"

**Concept type**: Comparative (structural)
**Metaphor**: Postcard vs sealed package with compartments
**McCloud transition**: Subject-to-subject
**Camera**: Fixed isometric at [0, 5, 8], FOV 34. No auto-rotate. Orbit controls with constrained range.
**Loop**: 8 seconds (4 segments)
**Object budget**: ~30
**Max simultaneous labels**: 4

**Key visual moments**:
1. [0-2s] Left side alone: blue cube, purple padlock, arrow to green endpoint. "Normal TX" label. Reader establishes baseline.
2. [2-4s] Right side fades in: wireframe envelope, 3 frame containers (F0 purple, F1-F2 blue), red X where signature would be. "Frame TX" label.
3. [4-6s] Small cube emerges from F0, passes through green ACCEPT arch between F0 and F1, continues through frames. "ACCEPT" label at arch.
4. [6-8s] Both sides hold. Left shows simple straight-line path. Right shows multi-step path through gate. Contrast is static and clear.

**Encoding**:
- Left is structurally SIMPLE (one box, one arrow, one endpoint). Right is structurally COMPLEX (envelope, compartments, gate). The structural difference IS the meaning. No additional encoding needed.
- Padlock on left, missing padlock (red X) on right. Presence vs absence encodes "signature in envelope vs no signature in envelope."

**What Tufte would say**: The scene is clean. Two objects, one comparison. The ACCEPT animation in segment 3 is the only motion, and it carries maximum information (authentication moved from outside to inside). No chartjunk.

---

### Scene 2: FrameOverview3D -- "How It Works"

**Concept type**: Temporal + causal (mode transition)
**Metaphor**: Airlock -- vacuum/untrusted to pressurized/trusted
**McCloud transition**: Action-to-action
**Camera**: [0, 5, 8], FOV 34. Slow auto-rotate 0.3.
**Loop**: 10 seconds (5 segments)
**Object budget**: ~45
**Max simultaneous labels**: 5

**Key visual moments**:
1. [0-3s] Envelope wireframe visible. Three frame containers inside (F0 purple, F1 blue, F2 blue). ACCEPT gate (green arch) between F0 and F1. Left zone (F0 side) is DESATURATED -- washed-out colors. Right zone is SATURATED. A cube sits in F0, visually muted.
2. [3-4s] Amber CALLDATAREAD arc fires from F0 toward F1 (sparks flow FROM F1 back TO F0 -- data flows to the reader). "CALLDATAREAD" label at arc midpoint. This happens BEFORE ACCEPT -- the validation frame reads the execution frame's data to decide whether to approve.
3. [4-6s] Cube approaches ACCEPT gate. Gate torus expands from scale 0 to 1 in 0.3s. Flash. The entire left zone snaps from desaturated to saturated in 0.5s. The cube's own lightness shifts. The environment changes, not just the object.
4. [6-8s] Cube proceeds through F1 and F2. "msg.sender = 0xUser" label appears on the committed side. The cube's passage through F1 and F2 is smooth and unobstructed -- committed mode means the frames execute with the sender's authority.
5. [8-10s] Hold. Full scene visible. Labels: "Sandbox" (left of gate), "ACCEPT" (at gate), "Committed" (right of gate).

**Critical implementation note**: CALLDATAREAD happens at [3-4s], BEFORE ACCEPT at [4-6s]. This matches the actual protocol: Frame 0 reads Frame 1's calldata during validation, THEN calls ACCEPT. The original proposal had this backwards (CALLDATAREAD after ACCEPT). This was flagged in the final review and must be enforced.

**Encoding**:
- Value (lightness) carries the sandbox/committed distinction. This is the single most important visual encoding in the entire article.
- Position (x) carries time. Left = earlier, right = later.
- The gate is the LARGEST non-envelope element (size signals importance).

---

### Scene 3: MultisigAuth3D -- "Multisig in One Transaction"

**Concept type**: Causal (input -> verification -> output chain)
**Metaphor**: Two-key bank vault with inspection window
**McCloud transition**: Action-to-action
**Camera**: [0, 4, 7], FOV 36. Auto-rotate 0.3.
**Loop**: 10 seconds (5 segments)
**Object budget**: ~65 (highest count -- justified by being the "showcase" scene)
**Max simultaneous labels**: 5

**Key visual moments**:
1. [0-2s] Alice (purple sphere, left) and Bob (purple sphere, right) each emit a small purple cylinder (signature key) that floats toward the central vault (large RoundedBox, labeled "Frame 0 / Validate"). The vault has a visible seam (the lock).
2. [2-4s] Both keys arrive at the vault. "Signature verified: Alice" and "Signature verified: Bob" labels flash briefly at the vault. An amber CALLDATAREAD arc extends from the vault toward the "Frame 1 / Execute" block (the vault reads what Frame 1 will do before approving). "CALLDATAREAD" label at arc midpoint.
3. [4-6s] Green ACCEPT torus expands at the vault. The vault seam "opens" (the two halves separate slightly). This is the emotional peak -- both conditions met, vault unlocks.
4. [6-8s] A blue beam extends from the vault through to the Frame 1 block, which sends a transfer to the recipient. Token spheres flow along the beam.
5. [8-10s] Hold. Full pipeline visible: Alice + Bob -> Vault (F0) -> ACCEPT -> Transfer (F1).

**CALLDATAREAD direction**: Arc originates at vault (F0), points toward F1. Spark particles flow FROM F1 TOWARD vault (data flows to the reader). This is correct: Frame 0 calls CALLDATAREAD to read Frame 1's calldata.

**Encoding**:
- Purple spheres = signers (auth color + sphere shape for identity).
- Purple cylinders = signatures (auth color + key shape).
- Large central vault = validator (size encodes importance).
- Green torus = ACCEPT (approval color + ring shape).
- Blue beam = transfer (data color + flow shape).

---

### Scene 4: PaymasterFlow3D -- "Gas in Any Token"

**Concept type**: Causal + quantitative (exchange flow)
**Metaphor**: Airport currency exchange booth
**McCloud transition**: Action-to-action
**Camera**: [0, 4, 7], FOV 36. Auto-rotate 0.3.
**Loop**: 10 seconds (3 visual beats)
**Object budget**: ~45
**Max simultaneous labels**: 4

**Key visual moments**:
1. [0-3s] User node (left) with amber discs floating above it (RAI tokens). Paymaster node (center, indigo hexagonal prism) with green spheres inside it (ETH reserve). "User: has RAI, no ETH" label. "Paymaster: has ETH" label.
2. [3-6s] Amber CALLDATAREAD arc from paymaster toward user's frame (paymaster reads what the user wants to do). Spark particles flow from user toward paymaster (data flows to the reader/inspector). ACCEPT ring fires at the paymaster. "Paymaster pays gas" label. Green ETH spheres leave the paymaster and dissolve (gas consumed).
3. [6-9s] User's action completes (implied, not shown -- we cut the recipient sub-flow per Tufte). Amber RAI discs flow FROM user TO paymaster (fee collected). The exchange is complete: paymaster spent ETH, received RAI.
4. [9-10s] Hold.

**What was cut (Tufte)**: The recipient node and the user's actual transaction (USDC transfer). The scene is ONLY about gas payment. The user's action is not the point. This was the primary simplification recommended in every review.

**Legend note**: RAI = amber, ETH = green, Paymaster = indigo, CALLDATAREAD = amber. The amber overlap between RAI and CALLDATAREAD is acknowledged. Spatial context disambiguates: RAI flows along the bottom (user <-> paymaster), CALLDATAREAD arcs along the top. If this proves confusing in implementation, change CALLDATAREAD to a lighter amber-yellow or add a subtle dash pattern to the arc.

---

### Scene 5: AccountDeploy3D -- "Wallet from Nothing"

**Concept type**: Temporal (three sequential phases)
**Metaphor**: Buying a plot with a known address, then building the house
**McCloud transition**: Moment-to-moment
**Camera**: [0, 4, 7], FOV 36. No auto-rotate (the scene changes over time; adding rotation distracts from the temporal progression).
**Loop**: 10 seconds (4 segments)
**Object budget**: ~40
**Max simultaneous labels**: 4

**Key visual moments**:
1. [0-3s] An empty platform with a small sign reading "0x1a2b...3c4d" (the address). Two small green spheres sit on the platform (pre-funded ETH). "Address exists. Wallet doesn't." label. This is the hook -- the address is real, the wallet is not. The coins arrived before the house was built.
2. [3-5s] A blue construction beam descends from above and "builds" a RoundedBox structure on the platform (Frame 0: Deploy via CREATE2 factory). The box materializes from bottom to top (scale Y from 0 to 1). "Frame 0: Deploy" label.
3. [5-7s] A purple lock icon appears on the front face of the newly built box (Frame 1: Validate + ACCEPT). ACCEPT ring fires. "Frame 1: Validate" label. The pre-funded coins are now "inside" the wallet.
4. [7-9s] A green arrow extends from the wallet (Frame 2: Execute). First action from the new wallet. "Frame 2: Execute" label.
5. [9-10s] Hold.

**Encoding**:
- Position (y) of the building structure rising from 0 to full height = construction progress.
- The pre-funded coins being on the platform BEFORE the building appears = the key insight.
- Three sequential phases, each with its own color (blue, purple, green) = deploy, validate, execute.

---

### Scene 6: ZKPrivacy3D -- "Privacy Without a Middleman"

**Concept type**: Causal + spatial (broken correspondence)
**Metaphor**: Anonymous ballot box with internal clerk (no relayer)
**McCloud transition**: Aspect-to-aspect
**Camera**: [0, 5, 9], FOV 34. No auto-rotate.
**Loop**: 10 seconds (4 segments)
**Object budget**: ~50
**Max simultaneous labels**: 5

**Key visual moments**:
1. [0-2s] Two spheres: blue (labeled "0xDeposit") on the left, green (labeled "0xFresh") on the right. A dashed red line with a large X connects them. "NO LINK" label centered on the line. This is the PUNCHLINE, shown FIRST. The reader immediately understands the privacy property before understanding the mechanism.
2. [2-5s] Below the addresses, a Frame TX wireframe envelope appears containing two frames. Frame 0 (purple, labeled "ZK Paymaster") and Frame 1 (green, labeled "Withdrawal"). A small purple cube (ZK proof) enters Frame 0 from above and is absorbed. An amber CALLDATAREAD arc fires from F0 toward F1 (paymaster verifies the proof matches the withdrawal). Sparks flow from F1 to F0 (data flows to the verifier).
3. [5-8s] ACCEPT ring fires at Frame 0. "Paymaster pays gas" label briefly. A green beam extends from Frame 1 toward the fresh address (0xFresh). Withdrawal complete.
4. [8-10s] Comparison text fades in at bottom: "Old way: User -> Relayer -> Contract" (with a red strikethrough line). "Frame TX: paymaster IS a frame." Hold.

**Critical design choice**: The broken-link line is ALWAYS visible (never animated away). It is the anchor of the scene. Everything else animates around it. This is Mayer's Signaling -- the most important element is permanent; everything else is transient.

**What was cut (Tufte)**: The 25-instance anonymous crowd from the revised proposal. Replaced with the two-address + broken-link visualization. The crowd adds nothing that the broken link doesn't already communicate. The broken link IS the concept. The crowd is atmosphere.

---

### Scene 7: FOCILGuard3D -- "Can't Be Censored"

**Concept type**: Comparative (with vs without)
**Metaphor**: Bouncer vs fire marshal
**McCloud transition**: Scene-to-scene (alternate realities)
**Camera**: [0, 4, 8], FOV 38. No auto-rotate.
**Loop**: 8 seconds (3 segments)
**Object budget**: ~35
**Max simultaneous labels**: 4

**Key visual moments**:
1. [0-4s] LEFT HALF: A stream of cubes approaches a block-shaped container (the block). Blue cubes (Frame TXs) and gray cubes (regular TXs). A red X barrier appears before the block. Gray cubes pass through. Blue cubes hit the X and bounce away (or flash red and disappear). "Without FOCIL" label. This takes 4 full seconds because the viewer needs to see the PATTERN -- repeated blocking of blue cubes while gray cubes pass.
2. [4-6s] RIGHT HALF lights up: Same stream of blue and gray cubes. A green shield icon appears between the stream and the block. ALL cubes pass through. No blocking. "With FOCIL" label. The contrast is immediate.
3. [6-8s] Both halves hold. Left: blocked cubes accumulated outside. Right: all cubes inside the block. The visual asymmetry tells the story.

**Encoding**:
- Color hue distinguishes Frame TXs (blue) from regular TXs (gray). This is the ONLY conceptual distinction, and it maps to exactly one visual variable.
- Position (x) separates the two scenarios.
- The green shield is one object, not 16 committee nodes. The committee's mechanism is article text; the scene shows the EFFECT.

**Note**: FOCIL is NOT part of EIP-8141. The scene must NOT label the shield "EIP-8141." The label is "FOCIL" or "Inclusion Committee." This was flagged in the final review.

---

### Scene 8: AtomicBatch3D -- "No Gap, No Attack"

**Concept type**: Comparative + spatial (gap presence/absence)
**Metaphor**: Two doors with exposed sidewalk vs revolving door
**McCloud transition**: Scene-to-scene (before/after)
**Camera**: [0, 5, 8], FOV 34. No auto-rotate.
**Loop**: 8 seconds (3 segments)
**Object budget**: ~40
**Max simultaneous labels**: 4

**Key visual moments**:
1. [0-3s] TOP HALF: Two separate RoundedBox containers (TX1: "Approve" and TX2: "Swap") with a RED GAP between them. The gap glows red, pulsing. A red arrow drops into the gap from above (the attacker). Flash/impact visual. "Vulnerability window" label inside the gap. The reader feels the danger.
2. [3-5s] BOTTOM HALF: One wireframe Frame TX envelope containing three frames (F0: Validate, F1: Approve, F2: Swap). No gap between frames. The same red arrow attempts to penetrate but bounces off the envelope. "Atomic: no gap" label.
3. [5-8s] Both halves hold. Top: the attacker is inside the gap (danger persists). Bottom: the attacker is deflected (safety). The spatial contrast (gap vs no gap) is the entire argument.

**Encoding**:
- The RED GAP is the single most important visual element. It is literally empty space with a color. The concept (vulnerability) is encoded as an absence of structure filled with danger color.
- The attacker arrow uses both color (red) and trajectory (downward into gap) to signify threat.
- The Frame TX envelope's wireframe texture (translucent containment) encodes atomicity -- everything is inside, nothing is exposed.

**What Tufte would say**: This is perhaps the highest data-ink ratio scene. Every element carries meaning. The gap IS the data. The arrow IS the threat. The envelope IS the solution. Nothing decorative.

---

## Reflection: What the Framework Made Easy and What It Missed

### What the Layered Pipeline Made Easy

**1. Killing decoration early (Stage 3 + Stage 6).**
Bertin's "one variable, one meaning" rule immediately flagged problems. When I tried to assign both "CALLDATAREAD" and "RAI tokens" to the same amber hue (Scene 4), the framework caught the overload at Stage 3, before I had committed to a scene layout. Without the framework, this would surface during implementation as a "the legend doesn't make sense" bug.

**2. Leading with the punchline (Stage 5, Bruner + Victor).**
The original ZKPrivacy3D scene buried the "no link" punchline at the end of a 14-second loop. Bruner's enactive -> iconic -> symbolic progression forced me to ask: "What does the reader DO first?" The answer is: they see two addresses with a broken line. That is the enactive experience. Everything else explains it. This reordering (punchline first, mechanism second) was the single biggest improvement to Scene 6, and the framework made it mechanical rather than intuitive.

**3. Consistent color vocabulary (Stage 3, Bertin).**
By establishing the global variable assignment table BEFORE designing individual scenes, I ensured that green always means committed/success, purple always means auth, amber always means cross-frame read, etc. The original implementation had red meaning "untrusted" in Scene 2 but "danger" in Scene 8. The framework prevented that inconsistency by forcing the assignment up front.

**4. Cutting the right scenes down to the right size (Stage 4, Tufte + McCloud).**
Tufte's data-ink ratio audit killed the 25-instance anonymous crowd, the 16-node committee circle, the recipient sub-flow in the paymaster scene, and the gas accounting in the deploy scene. Each cut was justified by the same question: "Does this element encode information, or does it just look busy?" McCloud's transition types helped because they clarify what the READER'S ATTENTION is doing. In Scene 7 (FOCIL), the reader makes a scene-to-scene jump between two realities. That jump requires LESS visual complexity per side, not more. The 16-node committee was complexity that inhibited the jump.

### What the Framework Missed

**1. Emotional design.**
The framework handles information architecture well but says nothing about how the reader FEELS. Scene 8's attacker arrow dropping into the vulnerability gap is emotionally effective (the reader viscerally feels the danger). Scene 5's empty-plot-with-coins is emotionally resonant (it's surprising and memorable). But these emotional qualities emerged from metaphor selection (Stage 2), not from any explicit "emotional design" stage. The framework could benefit from a Stage 2.5: "What does the reader feel at each moment?" mapped to something like Norman's visceral/behavioral/reflective model.

**2. Scroll-context awareness.**
The framework treats each scene as independent. But in practice, Scene 3 (multisig) comes after Scene 2 (ACCEPT gate). The reader arrives at Scene 3 already knowing what ACCEPT means and what CALLDATAREAD looks like. The framework does not model this accumulated knowledge. A reader who scrolls to Scene 6 (ZK privacy) has already seen CALLDATAREAD in three previous scenes -- they do not need it explained again. The framework's per-scene analysis cannot capture this cross-scene learning curve. A "reader knowledge model" stage (tracking what concepts have been introduced by which scene) would help.

**3. Performance-aware composition.**
Tufte's data-ink ratio counts visual elements but does not distinguish between a single RoundedBox (cheap) and a TubeGeometry with QuadraticBezierCurve3 (expensive). The framework produces a "~45 objects" count for Scene 4, but those 45 objects vary wildly in GPU cost. An instancedMesh with 12 spheres is one draw call; 12 separate meshes are 12 draw calls. The framework needs a "Stage 4.5: Performance costing" that assigns weights to object types: instancedMesh = 1 unit, tube geometry = 3 units, Html label = 5 units (DOM compositing cost), etc.

**4. Failure path design.**
The framework designs for the SUCCESS PATH (reader understands, scrolls through, learns progressively). It says nothing about failure modes: what if the reader scrolls past in 1 second? What if they orbit the scene to a bad angle where labels overlap? What if WebGL fails to initialize on their device? A "graceful degradation" stage would address these: static fallback images for WebGL failure, label collision avoidance, and ensuring the first visual frame of every scene communicates the core concept even without animation.

**5. Accessibility.**
Bertin's visual variables are all visual. The framework does not address screen readers, color blindness, or reduced motion preferences. The existing implementation has `srDescription` and `prefers-reduced-motion` support, but the framework did not surface these requirements -- they were added separately. A "Stage 0: Accessibility constraints" that establishes non-visual channels (text descriptions, ARIA labels, motion-safe alternatives) before visual design begins would close this gap.

---

## Appendix: Cross-Scene Verification Matrix

This matrix verifies that the global encoding rules (Stage 3) are maintained across all 8 scenes.

| Visual Variable | Scene 1 | Scene 2 | Scene 3 | Scene 4 | Scene 5 | Scene 6 | Scene 7 | Scene 8 |
|-----------------|---------|---------|---------|---------|---------|---------|---------|---------|
| Blue = data/TX | cube | frames | beam | -- | deploy beam | -- | Frame TXs | -- |
| Purple = auth | padlock, F0 | F0 | keys, vault | -- | lock | ZK proof, F0 | -- | F0 |
| Green = success | endpoint | committed zone | ACCEPT | ETH | user action | fresh addr, F1 | shield | envelope |
| Red = danger | "No Sig" X | -- | -- | -- | -- | broken link | censorship X | gap, attacker |
| Amber = CALLDATAREAD | -- | arc | arc | arc | -- | arc | -- | -- |
| Indigo = gas/payment | -- | -- | -- | paymaster | -- | -- | -- | -- |
| Wireframe = container | envelope | envelope | -- | -- | -- | envelope | -- | envelope |
| Size = importance | -- | gate largest | vault largest | paymaster prominent | building grows | -- | -- | gap prominent |

No conflicts detected. Each color consistently maps to one meaning across all scenes.
