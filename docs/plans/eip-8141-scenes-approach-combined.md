# EIP-8141 3D Scenes -- Combined Framework Design

**Date**: 2026-03-03
**Framework**: Pipeline (A) + 7-Question Checklist (B) + Principle Reference Card (C)
**Scope**: 8 scenes for the EIP-8141 article, redesigned from first principles using the combined approach.
**Input artifacts**: existing 8 implemented scenes, 12 2D technical diagrams, 4 rounds of cynical review, article MDX.

---

## Stage 1: Concept Decomposition

Before designing any scene, decompose the entire article into atomic concepts and determine which ones deserve a 3D scene versus prose or 2D treatment.

### 1.1 Concept Inventory

| # | Concept | Type (spatial/temporal/causal/comparative) | Scene candidate? |
|---|---------|-------------------------------------------|------------------|
| C1 | Normal TX vs Frame TX structural difference | **Comparative** | Yes -- side-by-side is the hook |
| C2 | Sequential frame execution with sandbox/committed mode | **Temporal** + causal | Yes -- the "how it works" foundation |
| C3 | ACCEPT opcode as the trust boundary | **Causal** (trigger) | Embedded in C2, not standalone |
| C4 | CALLDATAREAD as cross-frame data inspection | **Spatial** (linking) | Embedded in C2/C5/C6/C7, not standalone |
| C5 | Multisig: N signatures -> 1 validation -> 1 execution | **Causal** (many-to-one-to-one pipeline) | Yes -- simplest concrete use case |
| C6 | Paymaster: gas abstraction via token exchange | **Causal** + spatial (bidirectional flow) | Yes -- the "gas in any token" pitch |
| C7 | Account deployment: create wallet that doesn't exist yet | **Temporal** (build-then-use sequence) | Yes -- "address before existence" is visceral |
| C8 | ZK privacy: proof replaces identity, paymaster replaces relayer | **Causal** + comparative (old vs new) | Yes -- the "no relayer" innovation |
| C9 | FOCIL: forced inclusion prevents censorship | **Comparative** (with/without protection) | Yes -- the safety guarantee |
| C10 | Atomic operations: no gap = no attack | **Comparative** (gap vs no gap) | Yes -- the emotional closer |
| C11 | 2D nonces for parallel channels | Spatial | No -- too infrastructure-level for 3D; explained in prose |
| C12 | Mempool safety tiers | Classificatory | No -- fundamentally a table/tree; 2D treatment only |
| C13 | EOA backward compatibility | Comparative | No -- too text-heavy, no spatial dimension |
| C14 | Quantum resistance | Comparative (scheme swap) | No -- the visual is "same slot, different algorithm," a one-sentence idea |
| C15 | EIP evolution timeline | Temporal (1D) | No -- a timeline is forced in 3D |

**Checklist Q7 applied globally (what can be removed?):** C11-C15 are cut from 3D. C3 and C4 are embedded within other scenes, not standalone. This yields 8 scene-worthy concepts: C1, C2, C5, C6, C7, C8, C9, C10. This matches the existing 8-scene structure -- the previous review process converged on the right set, so the decomposition validates it.

**Principles consulted:** Tufte's data-ink ratio (eliminate concepts that don't gain from 3D), Mayer's Coherence (every scene must teach one thing the article text cannot teach alone).

### 1.2 Narrative Arc

The 8 concepts form a natural progression:

```
HOOK (what's different?)
  -> MECHANISM (how does it work?)
    -> DEMONSTRATIONS (what can you do with it?)
      -> SAFETY (what protects it?)
        -> CLOSE (why does it matter emotionally?)
```

Mapped to scenes:

1. NormalVsFrame (C1) -- comparative hook
2. FrameOverview (C2) -- temporal/causal mechanism
3. MultisigAuth (C5) -- simplest demonstration
4. PaymasterFlow (C6) -- medium-complexity demonstration
5. AccountDeploy (C7) -- high-complexity demonstration
6. ZKPrivacy (C8) -- advanced demonstration + comparative
7. FOCILGuard (C9) -- safety net
8. AtomicBatch (C10) -- emotional closer

**Transition type between scenes (McCloud Q6):**
- 1->2: **action-to-action** (from "what is it" to "how does it work")
- 2->3: **subject-to-subject** (from mechanism to first use case)
- 3->4->5->6: **subject-to-subject** (escalating use cases, same frame TX structure)
- 6->7: **scene-to-scene** (from use cases to systemic protection)
- 7->8: **aspect-to-aspect** (from safety to consequence)

---

## Stage 2: Metaphor Selection

For each scene, answer Q2 (what type of concept?) and Q3 (what physical experience maps to it?).

### Scene 1: NormalVsFrame3D

**Q2 (Tversky): Comparative.** The concept is a structural difference between two things. The visual form must be a side-by-side comparison where structural differences are immediately visible through spatial arrangement.

**Q3 (Lakoff/Johnson): "Simple vs. Complex Tool."** A normal TX is a screwdriver (one function, one grip). A Frame TX is a Swiss Army knife (multiple tools, one handle). But this metaphor breaks because "complex" sounds worse. Better: **"Letter vs. Package."** A normal TX is a sealed letter (one sender, one message, signature on the envelope). A Frame TX is a shipping box with multiple labeled compartments and no signature on the outside -- the authentication is a document inside one of the compartments.

**Structural property match test:** Letter has: one content, one seal, one destination. Package has: multiple compartments, seal is inside, multiple destinations. This maps correctly to: one call vs. N frames, signature on envelope vs. ACCEPT inside a frame, one target vs. multiple targets.

**Selected metaphor:** Two platforms. Left: a sealed envelope with a visible padlock (signature) and one content block inside. Right: an open shipping box with 3 compartments visible, the padlock is inside compartment #1, and compartments #2 and #3 contain separate payloads. The padlock placement IS the insight.

**Principles consulted:** Tversky's Correspondence (side-by-side for comparison), Lakoff/Johnson's Structural Metaphor (letter/package mapping preserves structure, not just surface).

### Scene 2: FrameOverview3D

**Q2 (Tversky): Temporal + causal.** The concept is a sequence of events where one event (ACCEPT) causes a state change. The visual form must be a timeline/pipeline where order matters and one moment transforms everything.

**Q3 (Lakoff/Johnson): "The Checkpoint."** Physical experience: walking through airport security. Before the checkpoint, you are untrusted (no boarding pass validated). At the checkpoint, your identity is confirmed. After the checkpoint, you have full access. The checkpoint is ACCEPT. The security zone before it is the sandbox. The terminal after it is committed execution.

**Structural property match test:** Before checkpoint: actions are inspected but not permanent (your bags can be opened, but you haven't boarded). At checkpoint: binary decision (pass/fail). After checkpoint: full authority (board any gate). Maps to: sandbox state is tentative, ACCEPT is binary, post-ACCEPT frames have full msg.sender authority.

**Additional sub-metaphor:** CALLDATAREAD is like the security officer looking at your boarding pass (reading another frame's data) before deciding to wave you through. The officer (Frame 0) reads the passenger manifest (Frame 1's calldata) before approving.

**Selected metaphor:** A linear corridor with 3 rooms (Frame 0, Frame 1, Frame 2). A gate/checkpoint between Frame 0 and Frame 1. A data cube enters Frame 0 (red/untrusted glow on the corridor walls). At the checkpoint, ACCEPT fires -- the corridor walls shift from red to green. The cube continues through Frame 1 and Frame 2 (green/trusted). CALLDATAREAD is shown as an amber arc reaching from the Frame 0 room to Frame 1's room BEFORE the gate opens -- Frame 0 inspects Frame 1's contents first.

**Critical timing note from review:** CALLDATAREAD must happen BEFORE the ACCEPT gate fires, not after. This was a blocking issue in the prior implementation. The metaphor enforces this naturally: the security officer looks at your documents BEFORE waving you through.

**Principles consulted:** Tversky's Correspondence (timeline for temporal), Lakoff/Johnson (checkpoint = trust boundary), Mayer's Signaling (color shift at ACCEPT = the most important visual signal in the scene).

### Scene 3: MultisigAuth3D

**Q2 (Tversky): Causal.** Many-to-one-to-one pipeline. Two inputs (signatures) cause one event (validation), which enables one output (execution). The visual form must show convergence then release.

**Q3 (Lakoff/Johnson): "Two Keys, One Vault."** Physical experience: a safe deposit box at a bank that requires two keys turned simultaneously. Alice has key A, Bob has key B. Both keys are inserted. The vault opens. Money can be moved. The vault is Frame 0 (validation). The money transfer is Frame 1 (execution).

**Structural property match test:** Two independent keys (two signatures). Both must be present (threshold check). Vault mechanism verifies both (ecrecover). Vault opens (ACCEPT). Contents become accessible (msg.sender = multisig wallet). Transfer executes (Frame 1). Correct mapping.

**Sub-metaphor for CALLDATAREAD:** Before the vault opens, the vault mechanism "looks ahead" through a one-way window to see WHAT will be done with the money (the Frame 1 calldata). The vault doesn't just check keys -- it checks keys AND inspects the intended action. This is the security advantage of Frame TXs over legacy multisig.

**Selected metaphor:** Two signer spheres (Alice, Bob) on the left. A central vault (hexagonal, with a visible lock mechanism). A target on the right (USDC contract). Animation: signature beams converge from Alice and Bob to the vault. An amber CALLDATAREAD arc reaches from the vault to the target (Frame 0 reads Frame 1's calldata). The lock rotates open. An ACCEPT ring fires. A green execution beam goes from vault to target. Tokens flow.

**Principles consulted:** Bruner's enactive-first (the "two keys" physical intuition), Tversky's Correspondence (convergent flow for many-to-one causality).

### Scene 4: PaymasterFlow3D

**Q2 (Tversky): Causal + spatial (bidirectional flow).** Two things move in opposite directions: ETH goes from paymaster to protocol (gas), and RAI goes from user to paymaster (fee). The visual form must show a two-way exchange with a mediator in the middle.

**Q3 (Lakoff/Johnson): "Currency Exchange Booth."** Physical experience: arriving in a foreign country. You have yen but need euros. The exchange booth takes your yen, gives you euros, and charges a commission. The booth is the paymaster. Yen is RAI. Euros is ETH. The commission is the paymaster's fee margin.

**Structural property match test:** You (user) have one currency (RAI) but need another (ETH) to function (pay gas). The booth (paymaster) holds reserves of both. The booth inspects your transaction intent (CALLDATAREAD) before deciding to serve you. The booth pays euros to the venue on your behalf (covers gas), then collects yen from you (pulls RAI). Correct mapping.

**Selected metaphor:** Three nodes in a triangle: User (left), Paymaster (center/top), Protocol/Recipient (right). Animation: (1) User displays RAI tokens. Paymaster displays ETH reserves. (2) Amber CALLDATAREAD arc from paymaster to user's execution frame -- paymaster inspects what the user wants to do. (3) ACCEPT ring fires at paymaster. Green ETH flows from paymaster downward (gas payment). (4) Amber RAI tokens flow from user to paymaster (fee). (5) Green execution beam goes from user to recipient. Three beats, two token flows going opposite directions. The bidirectional flow IS the payoff.

**Principles consulted:** Tversky's Correspondence (bidirectional flow for exchange), Bertin's 7 Variables (color distinguishes token types: amber=RAI, green=ETH -- one variable, one meaning).

### Scene 5: AccountDeploy3D

**Q2 (Tversky): Temporal.** A strict 3-step sequence where each step depends on the previous. Deploy -> Validate -> Execute. The visual form must be a timeline where causality is visible.

**Q3 (Lakoff/Johnson): "Building a House at a Known Address."** Physical experience: buying a plot of land. The lot has a street address (0x1a2b...) before any building exists. You can even receive mail at that address (pre-funded coins). Then: (1) the house is built (deploy), (2) the locks are installed and tested (validate), (3) you move in and start living there (execute).

**Structural property match test:** Address exists before the thing at the address (deterministic CREATE2). Funds can arrive before the thing exists (pre-funded coins). Construction (Frame 0: deploy via factory). Lock installation (Frame 1: validate + ACCEPT). Moving in (Frame 2: first transaction). Each step depends on the previous -- you can't install locks on a house that doesn't exist. Correct mapping.

**Selected metaphor:** An empty plot with a visible address sign and pre-existing coins sitting on the ground. Animation: (1) A deploy beam fires downward from a factory node -- the house materializes on the plot (Frame 0). (2) A lock icon appears on the door, a key turns (Frame 1: validation + ACCEPT). (3) The door opens, a transaction beam exits (Frame 2: execute). The coins that were sitting on the ground are now inside the house.

**Principles consulted:** Lakoff/Johnson (the construction metaphor preserves temporal dependencies), Mayer's Segmenting (3 distinct visual beats for 3 frames).

### Scene 6: ZKPrivacy3D

**Q2 (Tversky): Causal + comparative.** The causality is: ZK proof -> verification -> withdrawal. The comparison is: old way (with relayer) vs. new way (paymaster as a frame). The visual form must show causality AND contrast.

**Q3 (Lakoff/Johnson): "Anonymous Crowd + Self-Service Counter."** Physical experience: a masked ball. Everyone deposits their invitation at the entrance (deposit phase). Later, someone approaches a self-service counter (not a human clerk/relayer), presents a mask (ZK proof) that proves "I was invited" without revealing which invitation is theirs. The counter verifies the mask and pays out (withdrawal). Old way: you had to whisper to a specific clerk (relayer) who knew your timing. New way: walk up to the counter yourself. The counter is the ZK paymaster frame.

**Structural property match test:** Deposit address (the entrance) != withdrawal address (the exit). ZK proof (the mask) proves membership without revealing identity. Paymaster frame (the self-service counter) removes the relayer dependency. CALLDATAREAD lets the paymaster frame inspect the withdrawal frame's intent. "NO LINK" between entrance and exit is the core property. Correct mapping.

**Selected metaphor:** Two addresses on opposite sides of the scene -- 0xDeposit (blue sphere) and 0xFresh (green sphere) -- with a permanent broken red line between them labeled "NO LINK." In the center: a Frame TX envelope containing two frames. Frame 0 (purple): the ZK paymaster. A ZK proof cube enters, gets absorbed, verification succeeds, ACCEPT fires, "paymaster pays gas" appears. An amber CALLDATAREAD arc connects Frame 0 to Frame 1. Frame 1 (green): the withdrawal. A green beam exits toward 0xFresh. At the end: a comparison label -- "Old: User -> Relayer -> Contract" crossed out vs. "Frame TX: paymaster IS a frame / no relayer."

**Principles consulted:** Tversky's Correspondence (broken line for "no link" -- the visual form of disconnection), Tufte's data-ink (the red broken line is the most information-dense element in the scene).

### Scene 7: FOCILGuard3D

**Q2 (Tversky): Comparative.** With vs. without protection. The visual form must show the same input producing different outcomes depending on the presence of a shield.

**Q3 (Lakoff/Johnson): "Bouncer vs. Doorman."** Physical experience: a nightclub with a biased bouncer (the builder) who turns away certain people. Without FOCIL: the bouncer silently rejects all Frame TX users (too complex, don't like them). With FOCIL: a committee of doormen stands behind the bouncer with a clipboard -- if the bouncer tries to reject someone who's on the committee's guest list, the doormen overrule the bouncer. The block is the club. The bouncer is the block builder. The committee is the FOCIL validators.

**Structural property match test:** Builder has discretion to exclude transactions (bouncer rejects). FOCIL committee publishes inclusion lists (guest list). Builder must include listed transactions or the block is invalid (overruled). Enforcement is by attesters (other doormen who check the list against who actually entered). Correct mapping.

**Selected metaphor:** Two halves, side by side. Left (without FOCIL): blue cubes (Frame TXs) approach a block/gate, a red X blocks them, gray cubes (EOA txs) pass through. Right (with FOCIL): same setup, but a green shield (FOCIL) appears behind the gate. ALL cubes pass through. The shield is the committee. Minimal visual -- the story is "blocked vs. not blocked." The mechanism of HOW the committee works belongs in the article text, not the 3D scene.

**Principles consulted:** Tversky's Correspondence (binary comparison for with/without), Tufte's data-ink (strip committee internals -- the 3D adds blocked vs. unblocked, the text explains the mechanism).

### Scene 8: AtomicBatch3D

**Q2 (Tversky): Comparative.** Gap vs. no gap. The visual form must show a vulnerability that exists when things are separate and disappears when things are combined.

**Q3 (Lakoff/Johnson): "Two Doors vs. One Door."** Physical experience: entering a building through two doors with a gap between them (a vestibule). An attacker can slip in through the gap between the doors. With one solid door (atomic Frame TX), there's no gap to exploit.

**Better metaphor: "The Gap in the Wall."** Two walls with a gap between them. An attacker (red arrow) drops through the gap. Then: the walls slide together into one solid wall. No gap, no attacker. The walls are the two operations (approve + execute). The gap is the block boundary between separate transactions. Merging them is the Frame TX.

**Structural property match test:** Separate transactions = two walls with a gap. Attacker exploits the gap (front-running, sandwich attack between approve and swap). Single Frame TX = one wall, no gap. All frames execute atomically -- no interleaving by external transactions. Correct mapping.

**Selected metaphor:** Top half (BEFORE): two separated blocks labeled "TX 1: Approve" and "TX 2: Swap" with a red "VULNERABILITY WINDOW" gap between them. A red attacker arrow drops into the gap. Bottom half (AFTER): one unified block labeled "Frame TX" containing Frame 0 (validate), Frame 1 (approve), Frame 2 (swap) -- no gap. The blocks are flush. A "NO GAP" label replaces the red gap. Clean, 3-second read.

**Principles consulted:** Lakoff/Johnson (gap = vulnerability, no gap = safety -- physical experience of structural integrity), McCloud's Transitions (aspect-to-aspect between BEFORE and AFTER states).

---

## Stage 3: Visual Encoding

For each scene, answer Q5 (what visual properties carry meaning?) using Bertin's 7 Visual Variables. Each variable carries ONE meaning only.

### Global Encoding Table (shared across all 8 scenes)

| Variable | Meaning | Values |
|----------|---------|--------|
| **Color** | Trust/authorization state | Purple = validation/pre-ACCEPT, Green = committed/trusted/execution, Amber = data inspection (CALLDATAREAD), Red = danger/attack/rejection, Blue = neutral data/structural |
| **Position** | Temporal sequence (left-to-right) OR structural role (signer, validator, target) | Left = earlier in time or input, Right = later in time or output, Center = decision point |
| **Size** | Relative importance in the current animation beat | Larger = currently active element, smaller = passive/waiting |
| **Shape** | Entity type | Sphere = actor/signer, Box/RoundedBox = frame/container, Tube = data flow, Ring/Torus = ACCEPT flash, Cylinder = vault/validator |
| **Orientation** | Not used | -- (too subtle in 3D to carry meaning reliably) |
| **Value** (lightness) | Activity state | Emissive glow = active, matte = inactive |
| **Texture** | Not used | -- (meshStandardMaterial throughout; texture would require new material system) |

**Bertin's constraint check:** Color carries ONE meaning (trust state). Position carries ONE meaning (sequence/role). Size carries ONE meaning (current focus). Shape carries ONE meaning (entity type). No variable is double-coded. No two meanings share a variable.

**Cross-scene color consistency fix:** The previous implementation used red for pre-ACCEPT in Scene 2 but purple for pre-ACCEPT in Scene 1. Under this encoding, pre-ACCEPT is ALWAYS purple. Red is ALWAYS danger/attack (the attacker arrow in Scene 8, the X in Scene 7, the broken line in Scene 6). This resolves the color inconsistency flagged in the screenshot review.

**Principles consulted:** Bertin's 7 Visual Variables (one variable = one meaning), Mayer's Spatial Contiguity (labels next to what they describe, enforced by `<Html center position={[x,y,z]}>`).

### Per-Scene Encoding Specifications

#### Scene 1: NormalVsFrame3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| Normal TX envelope | RoundedBox (thin) | Blue | Left platform | Small (4x0.06x3) | Matte |
| Normal TX padlock | Small cylinder + torus | Green | ON the envelope, top-left | Small | Emissive |
| Normal TX content | Single cube | Blue | Inside envelope | Standard | Matte |
| Frame TX envelope | RoundedBox (wider) | Blue wireframe | Right platform | Larger (5x0.06x3) | Matte |
| Frame TX frames (F0, F1, F2) | 3 RoundedBoxes | F0=Purple, F1-F2=Green | Inside envelope, left to right | Standard | Matte until active |
| ACCEPT gate | Thin vertical plane | Green | Between F0 and F1 | Spans envelope height | Emissive flash at trigger |
| "No Sig" indicator | X mark or empty slot | Red | Where padlock would be on Frame TX envelope, top-left | Small | Subtle glow |

**Key encoding insight:** The padlock's position IS the story. On the Normal TX, it's on the outside of the envelope. On the Frame TX, it's inside Frame 0. The viewer should be able to extract this insight from position alone, without reading labels.

#### Scene 2: FrameOverview3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| Frame 0 room | RoundedBox shell | Purple (walls) | Left third | Standard | Matte -> pulse at validation |
| Frame 1 room | RoundedBox shell | Green (walls) | Center third | Standard | Matte -> bright at execution |
| Frame 2 room | RoundedBox shell | Green (walls) | Right third | Standard | Matte |
| ACCEPT gate | Vertical plane | Green | Between Frame 0 and Frame 1 | Full height | Explosive flash at trigger |
| Data cube | Box | Blue -> Green transition | Moves left to right | Standard | Glow increases at ACCEPT |
| CALLDATAREAD arc | TubeGeometry on QuadraticBezierCurve3 | Amber | From Frame 0 to Frame 1 (data flows back) | Thin tube | Spark particles flowing FROM Frame 1 TOWARD Frame 0 |
| Corridor walls | Plane | Red (pre-ACCEPT) -> Green (post-ACCEPT) | Background | Full scene width | Color shift at ACCEPT |

**CALLDATAREAD direction specification:** The tube CONNECTS Frame 0 and Frame 1. The spark particles flow FROM Frame 1 TOWARD Frame 0 (data being read by Frame 0 from Frame 1). The label says "reads Frame 1." This resolves the direction ambiguity flagged in all reviews.

**CALLDATAREAD timing specification:** The arc appears at 1.5s and the sparks flow until 3.5s. ACCEPT fires at 4s. This enforces the correct temporal ordering: Frame 0 reads Frame 1's calldata, THEN decides to call ACCEPT. The previous implementation had CALLDATAREAD appearing AFTER ACCEPT (at 4.5-6.5s), which was technically wrong.

#### Scene 3: MultisigAuth3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| Alice | Sphere | Purple | Upper-left | 0.35 radius | Breathe pulse |
| Bob | Sphere | Purple | Lower-left | 0.35 radius | Breathe pulse |
| Vault (Frame 0) | Hexagonal cylinder + lock | Purple -> Green at ACCEPT | Center | Dominant | Lock rotation at ACCEPT |
| USDC Target (Frame 1) | Sphere or RoundedBox | Green | Right | Standard | Lights up at execution |
| Signature beams | Tubes | Purple | Alice->Vault, Bob->Vault | Thin | Particles flow toward vault |
| CALLDATAREAD arc | TubeGeometry | Amber | Vault -> Frame 1 calldata | Thin | Sparks flow FROM F1 TOWARD vault |
| ACCEPT ring | Torus | Green | At vault | Expanding 0->1 scale | Emissive flash |
| Execution beam | Tube | Green | Vault -> USDC | Medium | Particles flow toward USDC |
| Lock mechanism | Cylinder + torus on vault | Red -> Green | On vault face | Prominent | Rotates dramatically at ACCEPT |

**Labels (max 5 simultaneous):**
1. "Alice" (persistent, at Alice sphere)
2. "Bob" (persistent, at Bob sphere)
3. "Frame 0 / Validate" (persistent, at vault)
4. "Frame 1 / Execute" (persistent, at USDC target)
5. "ACCEPT" (transient, appears at flash, fades after 2s)

#### Scene 4: PaymasterFlow3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| User | Sphere | Purple | Left | Standard | Breathe |
| Paymaster | Hexagonal prism | Indigo | Center-top | Larger (dominant) | Steady |
| RAI tokens | Small discs | Amber | At user, then flow to paymaster | Small | Glow during flow |
| ETH reserves | Small spheres | Green | At paymaster, then flow downward | Small | Glow during flow |
| CALLDATAREAD arc | TubeGeometry | Amber | Paymaster -> User's execution frame | Thin | Sparks flow FROM user TOWARD paymaster |
| ACCEPT ring | Torus | Green | At paymaster | Expanding | Flash |
| Execution beam | Tube | Green | User -> Recipient | Standard | Particles |

**Labels (max 5 simultaneous):**
1. "User (RAI)" (persistent)
2. "Paymaster (ETH)" (persistent)
3. "CALLDATAREAD" (transient, 2-4s)
4. "ACCEPT" (transient, 4-5s)
5. "Gas paid in ETH / Fee collected in RAI" (transient, 6-8s)

**Bidirectional flow encoding:** RAI flows user->paymaster (amber). ETH flows paymaster->downward (green). The two flows move in opposite directions simultaneously. This is the scene's visual payoff -- two colors crossing mid-screen.

#### Scene 5: AccountDeploy3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| Empty plot | Flat RoundedBox (ground) | Gray | Center | Standard | Matte |
| Address sign | Thin box with text | Blue | Above plot | Small | Steady glow (address exists before wallet) |
| Pre-funded coins | Small spheres | Amber | ON the empty plot | Small | Subtle glow |
| Factory node | Box | Blue | Above-left | Standard | Matte |
| Deploy beam | Tube | Blue | Factory -> plot | Thick | Particles downward |
| House/wallet (materializes) | RoundedBox rising from plot | Purple -> Green | At plot | Grows from 0 to full | Scale animation |
| Lock (validation) | Cylinder + torus | Purple | On house face | Small | Lights up at ACCEPT |
| ACCEPT ring | Torus | Green | At house | Expanding | Flash |
| Execute beam | Tube | Green | House -> outward | Standard | Particles |

**Labels (max 5 simultaneous):**
1. "0x1a2b...3c4d" (persistent, at address sign -- visible BEFORE house exists)
2. "Funds waiting" (transient, at coins, 0-2s)
3. "Frame 0 / Deploy" (transient, 2-4s)
4. "Frame 1 / Validate" (transient, 4-6s)
5. "Frame 2 / Execute" (transient, 7-9s)

#### Scene 6: ZKPrivacy3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| 0xDeposit address | Sphere | Blue | Far left | Standard | Matte |
| 0xFresh address | Sphere | Green | Far right | Standard | Matte |
| "NO LINK" broken line | Dashed line segments + X | Red | Between the two addresses | Spans scene | Persistent, not animated |
| Frame TX envelope | Wireframe RoundedBox | Blue | Center | Contains both frames | Subtle |
| Frame 0 (ZK Paymaster) | RoundedBox | Purple | Left-center | Standard | Lights up during verification |
| Frame 1 (Withdrawal) | RoundedBox | Green | Right-center | Standard | Lights up during execution |
| ZK proof cube | Box | Purple | Enters Frame 0 from above | Small | Bright glow |
| CALLDATAREAD arc | TubeGeometry | Amber | Frame 0 -> Frame 1 | Thin | Sparks flow FROM F1 TOWARD F0 |
| ACCEPT ring | Torus | Green | At Frame 0 | Expanding | Flash |
| Withdrawal beam | Tube | Green | Frame 1 -> 0xFresh | Standard | Particles |

**Labels (max 5 simultaneous):**
1. "0xDeposit" (persistent)
2. "0xFresh" (persistent)
3. "NO LINK" (persistent, on the red broken line)
4. "Frame 0 / ZK Paymaster" (persistent)
5. "Frame 1 / Withdrawal" (persistent)

**Phase labels (one at a time, transient, replacing each other):**
- Phase 1 (0-3s): "No link between deposit and withdrawal"
- Phase 2 (4-6s): "ZK proof verified -> ACCEPT -> paymaster pays gas"
- Phase 3 (7-8s): "No relayer needed"

**Note:** The previous implementation had 13+ labels. This redesign caps at 5 persistent + 1 transient phase label at any time. The phase labels rotate (Mayer's Signaling) rather than accumulate.

#### Scene 7: FOCILGuard3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| Block/gate (left half) | RoundedBox | Gray | Center-left | Standard | Matte |
| Block/gate (right half) | RoundedBox | Gray | Center-right | Standard | Matte |
| Blue cubes (Frame TXs) | Boxes | Blue | Approaching gates from left | Small | Glow |
| Gray cubes (EOA TXs) | Boxes | Gray | Approaching gates from left | Small | Matte |
| Red X (left side) | Lines forming X | Red | At left gate | Medium | Flash on rejection |
| FOCIL shield | Semi-transparent plane | Green | Behind right gate | Medium | Steady glow |
| "Censored" label (left) | Text | Red | Below left gate | -- | -- |
| "Protected" label (right) | Text | Green | Below right gate | -- | -- |

**Labels (max 5 simultaneous):**
1. "Without FOCIL" (persistent, above left half)
2. "With FOCIL" (persistent, above right half)
3. "Builder censors" (transient, at red X)
4. "Committee forces inclusion" (transient, at green shield)

#### Scene 8: AtomicBatch3D

| Element | Shape | Color | Position | Size | Glow |
|---------|-------|-------|----------|------|------|
| TX 1 block (BEFORE) | RoundedBox | Blue | Upper-left | Standard | Matte |
| TX 2 block (BEFORE) | RoundedBox | Blue | Upper-right | Standard | Matte |
| Vulnerability gap (BEFORE) | Empty space + red dashed border | Red | Between TX 1 and TX 2 | Gap width | Pulsing red |
| Attacker arrow (BEFORE) | Cone + line | Red | Drops into gap from above | Medium | Bright |
| Frame TX block (AFTER) | RoundedBox (wider, unified) | Green | Lower-center | Spans full width | Steady glow |
| F0, F1, F2 (AFTER) | Inner RoundedBoxes, flush | Green shades | Inside Frame TX | Standard | Matte |
| "NO GAP" label (AFTER) | Text | Green | Where gap was | -- | -- |

**Labels (max 5 simultaneous):**
1. "TX 1: Approve" (persistent, upper-left)
2. "TX 2: Swap" (persistent, upper-right)
3. "VULNERABILITY WINDOW" (persistent, at gap)
4. "Frame TX: Atomic" (persistent, lower-center)
5. "No gap = no front-running" (transient, appears after merge animation)

---

## Stage 4: Scene Composition

For each scene, answer Q1 (what's the ONE concept?) and Q4 (what should the reader be able to DO?). Then compose the final scene layout.

### Scene 1: NormalVsFrame3D

**Q1 (ONE concept):** A Frame TX moves authentication from outside the envelope to inside it.

**Q4 (Reader action):** The reader should be able to orbit the scene to see both platforms from different angles. They should be able to identify, without reading labels, where the padlock is on each TX type. The direct manipulation: orbiting reveals the structural difference.

**Composition:**
- Camera starts at [0, 4, 8], looking at [0, 0, 0]. Both platforms visible.
- Left platform (Normal TX) at x=-3.5. Right platform (Frame TX) at x=3.5.
- Divider line at x=0.
- Animation loop (8s): Content blocks appear (1s), padlock appears on Normal TX envelope (2s), padlock appears INSIDE Frame TX's Frame 0 (3s), ACCEPT flash at Frame TX gate (5s), execution flows on both sides (6-8s).
- OrbitControls enabled, autoRotate OFF.

**Object count: ~40.** Well within budget.

### Scene 2: FrameOverview3D

**Q1 (ONE concept):** Frames execute sequentially through a trust boundary (ACCEPT). Before ACCEPT, everything is tentative. After ACCEPT, everything is committed.

**Q4 (Reader action):** The reader should be able to see the color shift happen as the cube crosses the ACCEPT gate. Orbiting shows the CALLDATAREAD arc reaching across frames. The moment of state change should be unmistakable.

**Composition:**
- Camera starts at [0, 3, 7], looking at [0, 0, 0].
- Three rooms arranged left-to-right: Frame 0 (x=-2.5), Gate (x=0), Frame 1 (x=1.5), Frame 2 (x=3.5).
- Animation loop (9s):
  - 0-1.5s: Data cube appears in Frame 0. Corridor walls are purple (untrusted).
  - 1.5-3.5s: CALLDATAREAD amber arc appears, sparks flow from Frame 1 toward Frame 0. Label: "reads Frame 1 calldata."
  - 3.5-4.5s: CALLDATAREAD fades. Cube approaches gate.
  - 4.5-5s: ACCEPT fires. Gate flashes green. Corridor walls shift purple->green. ACCEPT torus expands.
  - 5-7s: Cube (now green-tinted) moves through Frame 1 and Frame 2.
  - 7-9s: Reset/hold.

**Object count: ~60.**

### Scene 3: MultisigAuth3D

**Q1 (ONE concept):** Two independent signers converge on one validator, which inspects the intended action (CALLDATAREAD) before authorizing it (ACCEPT).

**Q4 (Reader action):** The reader should see the convergence (two beams -> one vault) and the "look ahead" (amber arc from vault to execution target). Orbiting reveals the lock mechanism on the vault face.

**Composition:**
- Camera starts at [0, 3, 8], looking at [0, 0.5, 0].
- Alice at [-4, 0.5, 1.5]. Bob at [-4, 0.5, -1.5]. Vault at [0, 0.5, 0]. USDC at [4.5, 0.5, 0].
- Animation loop (10s):
  - 0-1s: Alice and Bob breathe-pulse.
  - 1-3s: Purple signature beams travel from Alice->Vault and Bob->Vault simultaneously.
  - 3-4.5s: CALLDATAREAD amber arc appears from Vault toward USDC (Frame 1 calldata). Sparks flow FROM USDC TOWARD Vault.
  - 4.5-5.5s: Vault lock rotates. ACCEPT ring fires green.
  - 5.5-7s: Green execution beam from Vault to USDC. Token particles flow.
  - 7-8s: "Signature verified: Alice" and "Signature verified: Bob" labels appear briefly at vault.
  - 8-10s: Hold/reset.

**Object count: ~80.** Highest of all scenes, but within 120 hard max.

### Scene 4: PaymasterFlow3D

**Q1 (ONE concept):** A paymaster inspects your intent, pays gas in ETH, and collects a fee in your token -- two-way exchange, no intermediary.

**Q4 (Reader action):** The reader should see two token flows crossing in opposite directions (RAI one way, ETH the other). The "exchange booth" metaphor should click visually without labels.

**Composition:**
- Camera starts at [0, 4, 7], looking at [0, 0, 0].
- User at [-3, 0.5, 0]. Paymaster at [0, 2, 0]. Recipient at [3, 0.5, 0].
- Animation loop (10s):
  - 0-2s: User displays RAI discs (amber). Paymaster displays ETH spheres (green).
  - 2-4s: CALLDATAREAD amber arc from Paymaster to User's execution intent. Sparks flow FROM User TOWARD Paymaster.
  - 4-5s: ACCEPT ring fires at Paymaster.
  - 5-7s: ETH green spheres flow from Paymaster downward (gas payment). RAI amber discs flow from User to Paymaster (fee). These cross mid-screen.
  - 7-9s: Execution beam from User to Recipient.
  - 9-10s: Hold/reset.

**Object count: ~55.**

### Scene 5: AccountDeploy3D

**Q1 (ONE concept):** The wallet address exists and can receive funds before the wallet itself is deployed.

**Q4 (Reader action):** The reader should see coins sitting on an empty plot with a visible address -- and understand that the address came first, the wallet came second.

**Composition:**
- Camera starts at [0, 4, 6], looking at [0, 0, 0].
- Plot at [0, 0, 0]. Factory at [-2, 2.5, 0]. Address sign at [0, 1.5, 0].
- Animation loop (10s):
  - 0-2s: Empty plot visible. Address sign glows. Pre-funded coins sit on the plot. Label: "Funds waiting at 0x1a2b...3c4d."
  - 2-4s: Deploy beam from Factory to plot. House materializes (scale 0->1). Label: "Frame 0 / Deploy."
  - 4-6s: Lock appears on house. Rotates. ACCEPT fires. Label: "Frame 1 / Validate."
  - 6-8s: Door opens. Execute beam exits. Label: "Frame 2 / Execute." Coins are now inside the house.
  - 8-10s: Hold/reset.

**Object count: ~50.**

### Scene 6: ZKPrivacy3D

**Q1 (ONE concept):** There is no link between deposit and withdrawal because the ZK paymaster is a frame inside the transaction, not an external relayer.

**Q4 (Reader action):** The reader should immediately see the broken red line (NO LINK) and understand that two addresses are disconnected. Then they should see the Frame TX structure that makes it possible.

**Composition:**
- Camera starts at [0, 3, 8], looking at [0, 0, 0].
- 0xDeposit at [-4, 0.5, 0]. 0xFresh at [4, 0.5, 0]. Frame TX envelope at [0, 0.5, 0].
- The broken red line and "NO LINK" are ALWAYS visible (the punchline is persistent, not a reveal).
- Animation loop (9s):
  - 0-2s: Scene establishes. Both addresses, red line, and Frame TX envelope visible.
  - 2-4s: ZK proof cube enters Frame 0. Absorbed. Purple glow.
  - 4-5.5s: CALLDATAREAD arc from Frame 0 to Frame 1. Sparks flow.
  - 5.5-6.5s: ACCEPT fires at Frame 0. "Paymaster pays gas."
  - 6.5-8s: Withdrawal beam exits Frame 1 toward 0xFresh.
  - 8-9s: Comparison text appears briefly: "No relayer needed."

**Object count: ~50.**

**Key design choice:** Leading with the punchline (permanent broken line) rather than building to it. This was the specific fix recommended in the cynical review, and it's supported by Mayer's Signaling (highlight the most important information first).

### Scene 7: FOCILGuard3D

**Q1 (ONE concept):** Without FOCIL, a builder can silently censor Frame TXs. With FOCIL, they cannot.

**Q4 (Reader action):** The reader should see the contrast: left side blocks, right side passes. The binary outcome should be immediate.

**Composition:**
- Camera starts at [0, 3, 7], looking at [0, 0, 0].
- Left half centered at x=-3. Right half centered at x=3. Divider at x=0.
- Animation loop (8s):
  - 0-2s: Blue cubes (Frame TXs) and gray cubes (EOA TXs) approach from the left on both sides.
  - 2-4s: LEFT: gray cubes pass through gate, blue cubes hit red X, bounce back. RIGHT: all cubes pass through gate (green shield visible behind gate).
  - 4-6s: LEFT: red "Censored" label. RIGHT: green "Protected" label.
  - 6-8s: Hold/reset.

**Object count: ~50.**

### Scene 8: AtomicBatch3D

**Q1 (ONE concept):** Separate transactions create a gap an attacker can exploit. A Frame TX eliminates the gap.

**Q4 (Reader action):** The reader should see the red gap, see the attacker drop in, then see the gap close when the operations become one Frame TX. The visceral threat-then-resolution should register in under 3 seconds.

**Composition:**
- Camera starts at [0, 4, 7], looking at [0, 0.5, 0].
- BEFORE section (upper): TX 1 at [-2, 1.5, 0], TX 2 at [2, 1.5, 0], gap between them.
- AFTER section (lower): Unified Frame TX at [0, -1, 0].
- Animation loop (10s):
  - 0-2s: TX 1 and TX 2 visible with red pulsing gap between them. "VULNERABILITY WINDOW" label at gap.
  - 2-4s: Red attacker arrow drops from above into the gap. Flashes.
  - 4-6s: Transition. TX 1 and TX 2 slide together and morph into one block. Gap disappears.
  - 6-8s: Unified Frame TX shows 3 inner frames (Validate, Approve, Swap). "No gap = no front-running" label appears.
  - 8-10s: Hold/reset.

**Object count: ~45.**

---

## Stage 5: Interaction Design

For each scene, answer Q4 in detail (Bruner's modes: enactive -> iconic -> symbolic).

### Interaction Specification (all scenes)

**Enactive (do):**
- OrbitControls on every scene. Drag to rotate. Scroll to zoom. This is the primary interaction -- the reader MOVES the camera to understand the spatial layout.
- `autoRotate: false`. The reader controls the perspective. No forced camera movement.
- `enablePan: false`. Pan is confusing in bounded scenes. Only orbit and zoom.
- Minimum polar angle: 0.3 rad (prevent going under the platform). Maximum polar angle: 1.4 rad (prevent going fully top-down and losing depth).

**Iconic (see):**
- Color transitions (purple -> green at ACCEPT) are the iconic representation of trust state change. The reader sees the state change without needing to interact.
- Token flows (amber RAI, green ETH crossing in Scene 4) are the iconic representation of exchange.
- The red broken line (Scene 6) and red gap (Scene 8) are the iconic representations of danger/vulnerability.

**Symbolic (name):**
- Html labels provide the symbolic layer. Max 5 on screen at once.
- Frame labels ("Frame 0 / Validate", "Frame 1 / Execute") are the symbolic naming of what the visual boxes represent.
- "ACCEPT" label appears only at the moment of the flash, connecting the visual event to the protocol concept.

**Bruner ordering:** The reader first orbits (enactive), then watches the animation (iconic), then reads labels to connect visuals to protocol concepts (symbolic). The scenes should work at the iconic level without labels -- the labels confirm, not reveal.

**Bret Victor principle applied:** "Small parts first, then combine." The article introduces one scene at a time. Each scene teaches one concept. The reader accumulates understanding scene by scene. By Scene 6 (ZKPrivacy), the reader already knows what CALLDATAREAD arcs mean and what ACCEPT flashes mean from Scenes 2-5. The visual vocabulary builds cumulatively.

**Distill affordance applied:** "Make systems playful." Orbit controls let the reader explore the 3D space. The scenes are not passive videos -- the reader discovers angles that reveal structure (e.g., orbiting the vault in Scene 3 shows the lock mechanism from different perspectives).

**Principles consulted:** Bruner's Modes (enactive -> iconic -> symbolic ordering), Bret Victor (small parts, direct manipulation), Distill's Affordances (playfulness through orbit, reduced cognitive load through visual vocabulary buildup).

---

## Stage 6: Editing Pass

Run Q7 (what can be removed?) and verify Q6 (transitions between states) for every scene.

### 6.1 Global Removals

| Removed element | Rationale |
|----------------|-----------|
| Ambient dust particles | Tufte's Chartjunk. Does not encode data. Pure decoration. |
| Rail particles on platforms | Tufte's Chartjunk. No information content. |
| Gradient backgrounds | Tufte's data-ink. Background should be neutral to make foreground elements pop. Use `#f8f9fa` or similar flat color. |
| Wireframe grid on platforms | Mayer's Coherence. The platform is a spatial anchor, not a data element. Solid matte is sufficient. |
| msg.sender labels in early scenes | Mayer's Coherence. "msg.sender = 0x0" is protocol jargon. The visual (purple = untrusted, green = trusted) communicates the state without the label. Reserve msg.sender for the technical diagrams in the article body. |

### 6.2 Per-Scene Removal Audit

**Scene 1 (NormalVsFrame):** Remove the "drag to orbit" hint after 3 seconds (it's useful on first encounter but becomes noise). Remove the signature verification animation on the Normal TX side -- the padlock alone communicates "signed."

**Scene 2 (FrameOverview):** Remove per-frame gas labels. Gas accounting is an implementation detail that doesn't help the "trust boundary" concept. Remove the "SANDBOX" / "COMMITTED" text labels from the previous implementation -- the color (purple/green) already encodes this. Use a single transient label "tentative" on the corridor pre-ACCEPT and "committed" post-ACCEPT, shown once, then let color carry the meaning.

**Scene 3 (MultisigAuth):** Remove the signature verification details ("ecrecover" etc.). The review already mandated plain English: "Signature verified: Alice/Bob." Even this can be cut -- the signature beams hitting the vault IS the visual. Labels only confirm. Keep 1-2s display, then fade.

**Scene 4 (PaymasterFlow):** Remove the USDC-to-recipient sub-flow. The previous review correctly identified this as a distraction from the gas abstraction story. The scene is ONLY about gas payment in alternative tokens. The user's actual action (what they spend USDC on) is irrelevant to the concept.

**Scene 5 (AccountDeploy):** Remove cross-chain ghosts (Chain A, B, C platforms). The review flagged these as disconnected from the main flow. The cross-chain address story is a one-liner in the article text, not a 3D concept. Focus entirely on the temporal sequence: empty plot -> deploy -> validate -> execute.

**Scene 6 (ZKPrivacy):** Remove the anonymous crowd (25 instanced spheres from the previous design). The crowd was a Tornado Cash/Railgun visualization, not a Frame TX visualization. The Frame TX contribution to privacy is the paymaster-as-a-frame structure, not the anonymity set. The anonymity set is a property of the ZK circuit, which the article text explains. The 3D scene shows the Frame TX architecture, not the ZK math.

**Scene 7 (FOCILGuard):** Remove committee member nodes (the previous design had 16). The committee structure is a FOCIL implementation detail. The 3D scene communicates one bit of information: censored vs. not censored. The green shield is the committee. Individual committee members don't need visual representation.

**Scene 8 (AtomicBatch):** Remove any auth scheme carousel or quantum resistance elements (these were in the old FullStack scene that was replaced). Atomic batching is one concept. Quantum resistance is a different concept. They share a scene in Diagram 12 of the 2D diagrams, but the 3D budget cannot support both. Quantum is text-only.

### 6.3 Transition Verification (McCloud Q6)

| Transition | Between | Type | Is it the right type? |
|-----------|---------|------|----------------------|
| Article intro -> Scene 1 | Text to visual | Scene-to-scene | Yes -- entering a new representational mode |
| Scene 1 internal | Normal TX animating, then Frame TX animating | Subject-to-subject | Yes -- comparing two subjects |
| Scene 1 -> Scene 2 | "What's different" -> "How it works" | Action-to-action | Yes -- from structural comparison to process |
| Scene 2 internal | Cube moves through rooms, CALLDATAREAD fires, ACCEPT fires | Moment-to-moment | Yes -- continuous timeline within one process |
| Scene 2 -> Scene 3 | Mechanism -> First use case | Subject-to-subject | Yes -- applying mechanism to specific scenario |
| Scene 3 internal | Sigs converge, vault opens, tokens flow | Action-to-action | Yes -- discrete actions in a causal chain |
| Scene 3 -> Scene 4 | Multisig -> Paymaster | Subject-to-subject | Yes -- different use case, same Frame TX structure |
| Scene 4 internal | Display holdings, inspect, exchange, execute | Action-to-action | Yes -- discrete steps in exchange |
| Scene 4 -> Scene 5 | Gas abstraction -> Account deployment | Subject-to-subject | Yes -- escalating complexity |
| Scene 5 internal | Empty plot -> build -> validate -> execute | Moment-to-moment | Yes -- continuous construction timeline |
| Scene 5 -> Scene 6 | Deployment -> Privacy | Subject-to-subject | Yes -- different use case |
| Scene 6 internal | Proof enters, verifies, withdraws | Action-to-action | Yes -- discrete ZK verification steps |
| Scene 6 -> Scene 7 | Use case -> Safety net | Scene-to-scene | Yes -- shifting from "what can you do" to "what protects it" |
| Scene 7 internal | Left half (censored), right half (protected) | Aspect-to-aspect | Yes -- two aspects of the same input |
| Scene 7 -> Scene 8 | Safety -> Emotional close | Scene-to-scene | Yes -- shifting to visceral threat/resolution |
| Scene 8 internal | Gap with attacker -> gap closes -> no attacker | Action-to-action | Yes -- sequential transformation |

All transitions are intentional and match their concept type. No non-sequitur transitions (which would break flow). No unnecessary scene-to-scene jumps within a single concept.

### 6.4 Label Count Verification

| Scene | Max simultaneous labels | Target: <=5 | Status |
|-------|------------------------|-------------|--------|
| 1. NormalVsFrame | 4 (Normal TX, Frame TX, divider title, one sub-label) | Pass | |
| 2. FrameOverview | 5 (Frame 0, Frame 1, Frame 2, CALLDATAREAD, ACCEPT) | Pass | CALLDATAREAD and ACCEPT are never simultaneous |
| 3. MultisigAuth | 5 (Alice, Bob, Frame 0/Validate, Frame 1/Execute, ACCEPT) | Pass | ACCEPT is transient |
| 4. PaymasterFlow | 5 (User, Paymaster, CALLDATAREAD, ACCEPT, fee label) | Pass | CALLDATAREAD and ACCEPT are never simultaneous |
| 5. AccountDeploy | 5 (address, funds, Frame 0/1/2) | Pass | Frame labels rotate |
| 6. ZKPrivacy | 5 (0xDeposit, 0xFresh, NO LINK, Frame 0, Frame 1) + 1 phase label | Borderline | Phase label replaces, does not accumulate |
| 7. FOCILGuard | 4 (Without FOCIL, With FOCIL, Censored, Protected) | Pass | |
| 8. AtomicBatch | 5 (TX 1, TX 2, VULNERABILITY, Frame TX, no gap) | Pass | |

All scenes comply with the 5-label maximum.

### 6.5 Loop Length Verification

| Scene | Loop | Target: 8-10s | Status |
|-------|------|---------------|--------|
| 1. NormalVsFrame | 8s | Pass | |
| 2. FrameOverview | 9s | Pass | |
| 3. MultisigAuth | 10s | Pass | |
| 4. PaymasterFlow | 10s | Pass | |
| 5. AccountDeploy | 10s | Pass | |
| 6. ZKPrivacy | 9s | Pass | |
| 7. FOCILGuard | 8s | Pass | |
| 8. AtomicBatch | 10s | Pass | |

All scenes are within 8-10s. The key insight lands within the first 3-5 seconds of every scene.

### 6.6 Object Count Verification

| Scene | Objects | Budget: <=120 | Status |
|-------|---------|---------------|--------|
| 1. NormalVsFrame | ~40 | Pass | |
| 2. FrameOverview | ~60 | Pass | |
| 3. MultisigAuth | ~80 | Pass | Highest count -- acceptable for the strongest scene |
| 4. PaymasterFlow | ~55 | Pass | |
| 5. AccountDeploy | ~50 | Pass | |
| 6. ZKPrivacy | ~50 | Pass | Down from ~150 in original proposal |
| 7. FOCILGuard | ~50 | Pass | Down from ~120 in original proposal |
| 8. AtomicBatch | ~45 | Pass | |
| **TOTAL** | **~430** | | |
| **Max simultaneous** (3 scenes) | **~190** | | Well within mobile budget |

---

## Per-Scene 7-Question Checklists

### Scene 1: NormalVsFrame3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | A Frame TX moves authentication from outside the envelope to inside it. |
| 2 | Spatial, temporal, causal, or comparative? | **Comparative.** Side-by-side structural difference. |
| 3 | What physical experience maps to it? | Letter (sealed, signature on outside) vs. package (compartments, authentication document inside one compartment). |
| 4 | What should the reader DO? | Orbit to see both platforms. Identify the padlock position without reading labels. |
| 5 | Visual properties carrying meaning? | Color: blue=structural, green=authenticated, purple=validation frame. Position: left=Normal TX, right=Frame TX. Shape: padlock for auth, cube for data. |
| 6 | What transitions between states? | Subject-to-subject (Normal TX animation, then Frame TX animation). Within Frame TX: action-to-action (frames light up sequentially). |
| 7 | What can be removed? | Removed: signature verification animation on Normal TX side, orbit hint after 3s, ambient particles. |

### Scene 2: FrameOverview3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | ACCEPT is the trust boundary. Before it, everything is tentative. After it, everything is committed. |
| 2 | Spatial, temporal, causal, or comparative? | **Temporal + causal.** A sequence where one event transforms everything. |
| 3 | What physical experience maps to it? | Airport security checkpoint. Before: untrusted zone. Checkpoint: identity verified. After: full access. |
| 4 | What should the reader DO? | Watch the color shift at the ACCEPT gate. Orbit to see the CALLDATAREAD arc reaching across frames. |
| 5 | Visual properties carrying meaning? | Color: purple walls = tentative, green walls = committed, amber = CALLDATAREAD. Position: left-to-right = time progression. Size: gate is tallest element (decision point). |
| 6 | What transitions between states? | Moment-to-moment (continuous cube movement through rooms). One critical action-to-action: ACCEPT gate fires, causing color shift. |
| 7 | What can be removed? | Removed: per-frame gas labels, SANDBOX/COMMITTED text labels (color encodes it), post-gate CALLDATAREAD (moved to pre-gate). |

### Scene 3: MultisigAuth3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | Two signers converge on one validator, which inspects the intended action before authorizing. |
| 2 | Spatial, temporal, causal, or comparative? | **Causal.** Many-to-one-to-one pipeline (convergence then release). |
| 3 | What physical experience maps to it? | Two-key safe deposit box. Both keys required. Vault mechanism looks ahead at what will be accessed before opening. |
| 4 | What should the reader DO? | See two beams converge. See the amber arc (look-ahead). See the vault open. Orbit to see the lock mechanism. |
| 5 | Visual properties carrying meaning? | Color: purple=signatures/validation, amber=CALLDATAREAD, green=execution. Shape: spheres=signers, hexagonal cylinder=vault, torus=ACCEPT ring. Position: left=input, center=decision, right=output. |
| 6 | What transitions between states? | Action-to-action: sigs converge (action 1), vault inspects (action 2), vault opens (action 3), tokens flow (action 4). |
| 7 | What can be removed? | Removed: ecrecover labels (plain English only), per-frame gas accounting, msg.sender labels. |

### Scene 4: PaymasterFlow3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | A paymaster inspects your intent, pays gas in ETH, and collects a fee in your token -- two-way exchange. |
| 2 | Spatial, temporal, causal, or comparative? | **Causal + spatial.** Bidirectional flow with a mediating entity. |
| 3 | What physical experience maps to it? | Currency exchange booth at an airport. You have yen, need euros. Booth takes yen, gives euros, charges commission. |
| 4 | What should the reader DO? | See two token flows cross mid-screen going opposite directions (amber RAI one way, green ETH the other). |
| 5 | Visual properties carrying meaning? | Color: amber=RAI, green=ETH, indigo=paymaster entity. Shape: discs=RAI tokens, spheres=ETH. Position: user left, paymaster top-center, recipient right. |
| 6 | What transitions between states? | Action-to-action: display holdings (action 1), inspect intent (action 2), exchange tokens (action 3), execute (action 4). |
| 7 | What can be removed? | Removed: USDC-to-recipient sub-flow (not the gas story), DEX/AMM internals, multiple CALLDATAREAD arcs (one is sufficient). |

### Scene 5: AccountDeploy3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | The wallet address exists and can receive funds before the wallet is deployed. |
| 2 | Spatial, temporal, causal, or comparative? | **Temporal.** Strict 3-step sequence with causal dependencies. |
| 3 | What physical experience maps to it? | Building a house at a known address. The lot has a street number. Mail arrives before construction. Build, install locks, move in. |
| 4 | What should the reader DO? | See coins on an empty plot (address exists before wallet). Watch the house materialize. Understand the temporal sequence. |
| 5 | Visual properties carrying meaning? | Color: gray=empty plot, blue=deploy beam, purple=lock/validation, green=execution. Size: house grows from 0 to full (materialization). Position: left-to-right temporal sequence of labels. |
| 6 | What transitions between states? | Moment-to-moment: continuous construction timeline. Each frame label appears and fades as the next step begins. |
| 7 | What can be removed? | Removed: cross-chain ghosts (Chain A/B/C), gas accounting, factory address details (text, not visual). |

### Scene 6: ZKPrivacy3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | No link between deposit and withdrawal because the ZK paymaster is a frame, not an external relayer. |
| 2 | Spatial, temporal, causal, or comparative? | **Causal + comparative.** ZK proof causes verification, which causes withdrawal. Comparative: old way (relayer) vs. new way (paymaster frame). |
| 3 | What physical experience maps to it? | Masked ball + self-service counter. Prove you were invited without revealing which invitation was yours. The counter (frame) replaces the human clerk (relayer). |
| 4 | What should the reader DO? | Immediately see the red broken line (NO LINK) and understand disconnection. Then see the Frame TX structure enabling it. |
| 5 | Visual properties carrying meaning? | Color: red broken line = no link (danger/separation), purple=ZK paymaster frame, green=withdrawal frame, amber=CALLDATAREAD. Position: far-left=deposit address, far-right=fresh address, center=Frame TX. |
| 6 | What transitions between states? | Action-to-action: proof enters (action 1), verification via CALLDATAREAD (action 2), ACCEPT (action 3), withdrawal (action 4). The comparison (old vs new) is aspect-to-aspect at the end. |
| 7 | What can be removed? | Removed: anonymous crowd (25 instances -- belongs to ZK math, not Frame TX architecture), Merkle tree visualization, nullifier mechanics, deposit flow. The scene shows ONLY the withdrawal-via-Frame-TX flow. |

### Scene 7: FOCILGuard3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | Without FOCIL, builders can censor Frame TXs. With FOCIL, they cannot. |
| 2 | Spatial, temporal, causal, or comparative? | **Comparative.** Binary with/without. |
| 3 | What physical experience maps to it? | Biased bouncer vs. bouncer with committee oversight. Without oversight, bouncer rejects whoever they want. With oversight, a guest list forces inclusion. |
| 4 | What should the reader DO? | See the contrast: left rejects blue cubes, right passes all cubes. The binary should register in 2 seconds. |
| 5 | Visual properties carrying meaning? | Color: blue=Frame TXs, gray=EOA TXs, red=censorship/rejection, green=protection/inclusion. Position: left=without FOCIL, right=with FOCIL. Shape: shield for FOCIL protection. |
| 6 | What transitions between states? | Aspect-to-aspect: left and right halves show two aspects of the same scenario (cubes approaching a gate). Within each half: action-to-action (approach, accepted/rejected). |
| 7 | What can be removed? | Removed: 16 committee member nodes (mechanism belongs in text), inclusion list details, attestation flow, builder motivation explanation. Only the outcome (censored vs. protected) is shown. |

### Scene 8: AtomicBatch3D -- Complete Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the ONE concept? | Separate transactions create a gap an attacker can exploit. A Frame TX eliminates the gap. |
| 2 | Spatial, temporal, causal, or comparative? | **Comparative.** Gap vs. no gap. Vulnerable vs. safe. |
| 3 | What physical experience maps to it? | Two walls with a gap (vestibule) vs. one solid wall. The gap is where the attacker slips in. |
| 4 | What should the reader DO? | See the red gap. See the attacker drop in. See the gap close. Feel the threat, then the resolution. |
| 5 | Visual properties carrying meaning? | Color: red=vulnerability/attacker, blue=transactions, green=unified Frame TX/safety. Position: top=BEFORE (separate), bottom=AFTER (unified). Size: gap width is the vulnerability; zero gap = safety. |
| 6 | What transitions between states? | Action-to-action: gap exists (state 1), attacker exploits (action), gap closes (state 2). The BEFORE/AFTER is scene-to-scene within the same canvas. |
| 7 | What can be removed? | Removed: auth scheme carousel, quantum resistance, plug-in funnel, output beams. Only the gap/no-gap comparison remains. |

---

## Final Scene Specifications (Summary Table)

| # | Scene | One Concept | Metaphor | Key Visual | Objects | Loop | Labels |
|---|-------|-------------|----------|------------|---------|------|--------|
| 1 | NormalVsFrame3D | Auth moves from outside envelope to inside | Letter vs. package | Padlock position | ~40 | 8s | 4 |
| 2 | FrameOverview3D | ACCEPT is the trust boundary | Airport security checkpoint | Purple->green color shift at gate | ~60 | 9s | 5 |
| 3 | MultisigAuth3D | Two signers, one vault, look-ahead inspection | Two-key safe deposit box | Convergent beams + amber CALLDATAREAD arc | ~80 | 10s | 5 |
| 4 | PaymasterFlow3D | Two-way token exchange for gas | Currency exchange booth | Bidirectional token flows crossing mid-screen | ~55 | 10s | 5 |
| 5 | AccountDeploy3D | Address exists before wallet | Building house at known address | Coins on empty plot, house materializes | ~50 | 10s | 5 |
| 6 | ZKPrivacy3D | No link because paymaster is a frame | Masked ball + self-service counter | Permanent red broken "NO LINK" line | ~50 | 9s | 5+1 phase |
| 7 | FOCILGuard3D | With FOCIL, no censorship | Bouncer with committee oversight | Blue cubes blocked (left) vs. all pass (right) | ~50 | 8s | 4 |
| 8 | AtomicBatch3D | No gap = no attack | Gap in the wall | Red gap closes, attacker eliminated | ~45 | 10s | 5 |

**Total objects: ~430. Max simultaneous (3 scenes): ~190. All within mobile budget.**

---

## Reflection: What the Combined Approach Made Easy and What It Missed

### What the Combined Approach Made Easy

**1. Concept triage was fast.** Running Q7 (Tufte's data-ink) during Stage 1 immediately cut C11-C15 from the 3D scene list. Without the explicit question, the temptation is to visualize everything. The pipeline's Stage 1 (Concept Decomposition) combined with Q7 (removal) produced the same 8-scene set that 4 rounds of review had converged on -- but in one pass instead of four.

**2. Metaphor quality improved.** Stage 2 (Metaphor Selection) forced me to run Q3 (Lakoff/Johnson) with a structural property match test for every metaphor. This caught weak metaphors early. For example, the initial "Swiss Army knife" metaphor for Frame TXs failed the structural test (complex tool doesn't map to N independent calls). The "letter vs. package" metaphor survived because its structural properties (seal placement, compartment count, destination count) map correctly to the protocol concepts.

**3. Color consistency was enforced by the encoding table.** Q5 (Bertin's 7 Variables) in Stage 3 produced a global encoding table before any per-scene design. This prevented the color inconsistency that the prior implementation suffered (red vs. purple for pre-ACCEPT state across scenes). By defining "color = trust state" globally, every scene was forced to use the same color for the same meaning.

**4. The editing pass was mechanical, not subjective.** Stage 6 had clear criteria: Q7 (remove if no data encoded), label count <=5, loop <=10s, object count <=120. These are binary checks, not aesthetic judgments. The prior review process required a cynical reviewer to spot "too many labels" subjectively. The framework makes it a table.

**5. Transition coherence was verifiable.** Q6 (McCloud's transitions) in Stage 6 produced a table of every transition with its type. This revealed that the 6->7 transition (ZKPrivacy -> FOCILGuard) is a scene-to-scene shift (from use cases to systemic protection) -- which is correct but should be signaled in the article text with a section divider or a transitional sentence. Without explicitly classifying transitions, this might have been missed.

### What the Combined Approach Missed

**1. Emotional arc.** The framework is strong on cognitive design (what the reader understands) but weak on affective design (what the reader feels). The "emotional closer" (Scene 8, AtomicBatch) was chosen by gut, not by the framework. McCloud's transitions classify types but don't prescribe emotional trajectory. A missing principle: something like Pixar's "story spine" (setup, rising action, climax, resolution) applied to educational content.

**2. Mobile-specific constraints.** The framework principles (Bertin, Tufte, Mayer, McCloud) were developed for static or screen-based media. They don't address mobile-3D-specific problems: touch target sizes for orbit controls, WebGL context limits, GPU memory per scene, label readability at 340px viewport height. The implementation review caught these issues; the framework did not.

**3. Animation design.** The framework handles WHAT to show and HOW to encode it, but the timing of animations (ease curves, beat durations, particle speeds) is absent from all three frameworks. Mayer's Segmenting says "break into user-paced steps" but doesn't specify animation duration or easing. The 8-10s loop lengths and the 3-second rule (key insight in first 3 seconds) came from the review process, not the framework.

**4. Cross-scene vocabulary accumulation.** The framework designs each scene independently and then checks consistency in the editing pass. But the real power of 8 sequential scenes is that the reader LEARNS the visual vocabulary (amber = CALLDATAREAD, green torus = ACCEPT) from early scenes and applies it to later scenes. The framework doesn't model this learning curve explicitly. Scene 6 (ZKPrivacy) can be sparser BECAUSE the reader already saw CALLDATAREAD in Scenes 2-4. A learning-curve-aware framework would specify "introduce visual element in Scene X, then use it without label in Scene Y."

**5. Fallback for reduced motion.** The `prefers-reduced-motion` accessibility requirement is outside the framework's scope. Every scene needs a static fallback state that communicates the concept without animation. The framework designs animated scenes; the static fallback is an implementation concern the framework doesn't address.

**6. Performance budgeting.** The object count table is a post-hoc check, not a design constraint. Ideally, the framework would have a "budget" concept in Stage 3 (Visual Encoding) that forces trade-offs: "you have 80 object slots for this scene -- which encodings are worth the budget?" Instead, the budget check happens in Stage 6 after all design decisions are made. Moving budget awareness earlier would prevent over-design-then-cut cycles.

### Verdict on the Combined Approach

The pipeline (A) provides the right process ordering -- decompose before encoding, encode before composing, compose before editing. The checklist (B) forces rigor at each stage -- especially Q7 (removal) which prevents scope creep and Q5 (Bertin) which prevents encoding ambiguity. The reference card (C) provides the theoretical backing to defend design decisions against "but what about..." objections.

The combination is stronger than any individual framework because:
- The pipeline alone lacks rigor within each stage (it says "select metaphor" but not how to evaluate metaphor quality).
- The checklist alone lacks process ordering (it asks the right questions but not when to ask them).
- The reference card alone lacks actionable structure (it has principles but no workflow).

Together, they produced a design that matches the 4-review-cycle output in one pass. The gaps (emotional arc, mobile constraints, animation timing, learning curve, accessibility, performance budgeting) are real but addressable -- they represent extensions to the framework, not failures of it.
