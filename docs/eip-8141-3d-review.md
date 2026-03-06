# EIP-8141 3D Scene Proposals -- Cynical Review

**Reviewer stance:** I am assuming the reader is a non-crypto person who wandered in from a Google search. They do not know what an opcode is. They do not know what a mempool is. They will give each scene exactly 3 seconds before scrolling past it.

---

## Scene-by-Scene Verdicts

---

### Scene 1: FrameExecution3D.tsx (Frame Execution Model)

**Instant understanding (3-second test): 4/10**
**Technical accuracy revealed: 7/10**

**What's wrong:**

The core concept -- "some frames are tentative, one moment commits everything" -- is genuinely important. But the scene buries it under too many simultaneous visual systems. You have: a sandbox platform, a committed platform, a gate with pillars and an arch, three cubes with color transitions, two sets of rail particles in different colors, CALLDATAREAD amber arcs with their own spark particles, and 6 Html labels that appear at different times.

A non-expert sees: "colored cubes moving left to right through an archway." They do NOT see: "everything before this archway is fake, and everything after is real." The sandbox/committed distinction requires reading two small labels and understanding what "tentative state" means. That is a 30-second comprehension task, not a 3-second one.

The CALLDATAREAD arcs appearing at 8-10s are wasted. By then, the viewer has scrolled away. And the concept of "Frame 0 reads Frame 1's calldata" is an implementation detail that belongs in Scene 2 (Anatomy), not here.

**Concrete fix:**

Strip this to its essence. ONE cube that is red (glowing, unstable, maybe vibrating) slides toward a gate. The gate flashes. The cube turns solid green. That is it. The entire scene should communicate: "red = untrusted, green = trusted, the gate is the moment of truth." Remove CALLDATAREAD arcs entirely from this scene. Remove msg.sender labels. Remove per-frame cubes after the gate -- the viewer does not need to see Frame 1 and Frame 2 separately here. One cube, one transformation, one gate. The labels should be "UNTRUSTED" and "TRUSTED" (not "SANDBOX" and "COMMITTED" -- those are jargon).

---

### Scene 2: FrameAnatomy3D.tsx (Frame TX Anatomy)

**Instant understanding (3-second test): 3/10**
**Technical accuracy revealed: 8/10**

**What's wrong:**

This scene is a 3D exploded diagram of a data structure. It works for engineers who already know what RLP encoding is. It does not work for anyone else.

A non-expert sees: "boxes inside a bigger box." That tells them nothing. The animation of header cubes dropping from above is purely decorative -- it does not teach anything about WHY those fields exist. The "NO SIGNATURE" X mark at the bottom is the most interesting part of this entire scene, but it arrives at 7-8s, by which point no one is watching.

9 inner data cubes (3 per frame x 3 frames) plus 4 header cubes plus a wireframe envelope plus pipe particles plus ambient dust = a cluttered diorama that communicates "this is complex" rather than "this is how it works."

The 10 Html labels are too many. "chain_id: 1", "nonce: (0, 42)", "gas: 500k", "fee: 30 gwei" -- these are meaningless to non-experts and obvious to experts.

**Concrete fix:**

Reverse the emphasis. Lead with the headline: "NO SIGNATURE INSIDE." Show a traditional transaction (small, with a padlock/signature icon) next to a Frame TX (larger, with a conspicuous empty slot where the signature would be). Then show the Frame TX's "authentication" happening INSIDE one of its frames (a glowing frame box). The structural insight is: "authentication moved from outside the envelope to inside the envelope." That is a 3-second idea. The RLP byte layout is not.

Alternatively, MERGE this with Scene 1. Scene 1 shows the sandbox-to-committed flow; this scene shows the structure. Combined, you get: "here is the envelope, here are the frames inside it, and here is the moment that commits them." That is one coherent scene instead of two half-scenes.

---

### Scene 3: ValidationPipeline3D.tsx (Validation + Execution)

**Instant understanding (3-second test): 5/10**
**Technical accuracy revealed: 8/10**

**What's wrong:**

This is a pipeline scene: cube enters from left, passes through sandbox gate, waits in pool, passes through block gate, exits green. That is a legitimate visual metaphor for "validated twice."

The problem is the CONVEYOR BELT metaphor. This is the THIRD scene that uses platforms-with-rails-and-particles-flowing-left-to-right. Scene 1 uses it. Scene 8 (NonceLanes) will use it. And the reference implementation (ParallelVerification3D) already uses it. The viewer will think these scenes are the same thing.

The "State S0 -> S1" concept is critical and well-handled in the waiting pool section. But the rejected-cube-dropping animation (at 4-4.5s and 10-10.5s) is a fork path that appears for half a second and then the viewer misses it.

14s loop is too long. The viewer will not watch 14 seconds of animation. The key insight -- "validated in sandbox, state can change, validated again in block" -- needs to land in the first 5 seconds.

**Concrete fix:**

Drop the loop to 8 seconds. Make the dual-validation the FIRST thing the viewer sees: show the same cube being checked twice, with a visible state change between checks (the pool area morphs color). The rejected path is important -- make it a permanent fork (show the reject cube STAYING on screen, not fading) so the viewer can see both outcomes at once.

Consider whether this scene is necessary at all. The "two-phase validation" concept could be folded into the article text with a simple 2D diagram. The 3D adds visual weight but not conceptual clarity over the 2D source diagram.

---

### Scene 4: MultisigAuth3D.tsx (Multisig with Frame Auth)

**Instant understanding (3-second test): 7/10**
**Technical accuracy revealed: 9/10**

**What's wrong:**

This is the strongest scene. Two people send signatures to a vault, the vault checks them, the vault sends money. That is a universally understandable flow. Even a non-crypto person grasps: "two people had to approve before the money moved."

The CALLDATAREAD arc (3-4s) is the scene's secret weapon -- it shows the vault "looking ahead" to see what the money will do before approving it. This is genuinely novel and the animation captures it well.

Problems: The 12s loop is long. The "ecrecover: Alice/Bob" labels inside the vault are crypto jargon. The Lock icon on the vault is a nice touch but might be too small at the scene scale. The USDC node at the end is generic -- it could be any action.

**Concrete fix:**

Rename "ecrecover" labels to "Signature verified: Alice" / "Signature verified: Bob" (plain English). Shorten the loop to 10s by compressing the hold at the end. Make the vault lock icon larger and animate its rotation more dramatically (the "unlock" moment should be the emotional peak). Otherwise, this scene is good. Keep it.

---

### Scene 5: AccountDeploy3D.tsx (New Account Deployment)

**Instant understanding (3-second test): 6/10**
**Technical accuracy revealed: 7/10**

**What's wrong:**

The "building a house" metaphor is effective. Empty plot -> construction -> built wallet -> first transaction. The pre-funded coins at the empty plot are a nice touch (money waiting at an address before the wallet exists).

The cross-chain address ghosts at the bottom ([0, 0, -3] area) are trying to show "same address on every chain" but they are off to the side and disconnected from the main flow. A non-expert will not understand why there are three translucent boxes labeled "Chain A, Chain B, Chain C."

The 3-frame choreography (deploy, validate, execute) with sequential labels is clear but slow. 14s loop is too long.

The gas accounting visualization (8.5-10s) is a niche concern that does not need screen time.

**Concrete fix:**

Cut the loop to 10s. Remove gas accounting. Move the cross-chain ghosts to be the OPENING shot: show the same address appearing on 3 chain platforms simultaneously (3 platforms with the same address beacon). Then zoom into one chain and show the deploy+validate+execute flow. This makes the cross-chain story the hook, not an afterthought.

---

### Scene 6: PaymasterFlow3D.tsx (Paymaster Gas Flow)

**Instant understanding (3-second test): 6/10**
**Technical accuracy revealed: 9/10**

**What's wrong:**

The concept -- "user has RAI but no ETH, paymaster pays gas in ETH, takes RAI as fee" -- is powerful and relatable. "Pay gas in any token" is something anyone can understand.

The problem is the 4-frame choreography is too many steps for a 3-second read. The scene has: user, paymaster, USDC node, recipient node, CALLDATAREAD arcs (3 of them), signature beam, ACCEPT ring, RAI approval beam, USDC transfer beam, RAI collection beam, RAI token flow, USDC token flow, ETH gas flame particles. That is 12+ animated elements telling a 4-step story. Each step only gets ~3 seconds of screen time.

The 16s loop is the longest of all 10 scenes. Nobody watches 16 seconds of animation.

3 CALLDATAREAD arcs (reading F1, F2, F3) at once is visual noise. The viewer does not need to see that the paymaster reads all three frames -- the conceptual point is "the paymaster knows what the tx will do."

**Concrete fix:**

Simplify to 3 beats in 10 seconds: (1) User shows tokens (RAI), paymaster shows ETH. (2) Paymaster checks the tx and pays gas (ETH leaves paymaster). (3) User's action completes, paymaster receives RAI fee. Cut CALLDATAREAD to ONE arc (not three). Remove the USDC-to-recipient sub-flow entirely -- it is a distraction from the gas story. The scene should be ONLY about gas payment, not about what the user's actual transaction does.

---

### Scene 7: ZKPrivacy3D.tsx (ZK-SNARK Privacy)

**Instant understanding (3-second test): 5/10**
**Technical accuracy revealed: 7/10**

**What's wrong:**

60 instanced sphere+cylinder combos for the "anonymous crowd" is the highest object count of any scene (~150 total). This is approaching the performance boundary, especially on mobile.

The visual metaphor -- "one person steps out of a crowd, generates a proof, withdraws money without being linked to the crowd" -- is conceptually sound. But the execution is cluttered. A prover machine with internal bars, Merkle tree layers with stacked torus rings, a nullifier X mark, a "no link" dashed line with X -- these are all separate concepts being animated in sequence.

The Merkle tree visualization (cylindrical pool with stacked rings and 40 deposit dots) will look like a cylinder with dots on it. A non-expert will not understand why layers are illuminating bottom-up (Merkle verification). They will see "the cylinder lit up." The technical accuracy is high (Groth16, nullifier, Merkle path) but the visual legibility is low.

The "no link" dashed line at the end (12-14s) is the punchline, but it arrives 12 seconds into a scene that most people stopped watching at second 5.

**Concrete fix:**

Lead with the punchline. Start the scene showing the "no link" visual: crowd on one side, fresh address on the other, with a clear BROKEN LINE between them. Then rewind and show how: one person generates a proof (simplified -- just a glowing cube emerging from a box), the proof unlocks a withdrawal, the person fades back into the crowd. The crowd should be SMALLER (20-30 instances, not 60) to hit performance budget. Remove the Merkle tree layers entirely -- just use a single opaque pool cylinder with "10K deposits" label.

---

### Scene 8: NonceLanes3D.tsx (2D-Nonce Channels)

**Instant understanding (3-second test): 7/10**
**Technical accuracy revealed: 6/10**

**What's wrong:**

This is effectively a CLONE of ParallelVerification3D.tsx, which already exists as the reference implementation. Left side: sequential bottleneck. Right side: parallel lanes. The visual vocabulary is identical: platforms, rails, cubes, particles, bottleneck funnel.

A viewer who has scrolled past ParallelVerification3D earlier in the scaling article (or even earlier on THIS page) will think this is the same scene. The only difference is the labels (nonce channels vs. transaction verification). But the VISUAL is the same: "one lane bad, many lanes good."

The technical concept being illustrated (2D nonces enable parallel mempool processing for the SAME account) IS different from parallel execution. But the scene does not SHOW that difference. It just re-uses the same metaphor.

**Concrete fix:**

Either (a) MERGE this into a text callout with a simple 2D comparison diagram, or (b) make the visual metaphor DIFFERENT from ParallelVerification3D. Option (b): show a SINGLE user (Alice) with multiple outgoing channels, each channel carrying a different kind of transaction (swap, transfer, approve) simultaneously. The visual insight should be "one person, many simultaneous operations" -- not "many people in many lanes." This distinguishes it from the scaling scene, which is about DIFFERENT transactions being parallel.

---

### Scene 9: FOCILGuard3D.tsx (FOCIL Anti-Censorship)

**Instant understanding (3-second test): 5/10**
**Technical accuracy revealed: 7/10**

**What's wrong:**

The left/right comparison (without FOCIL vs. with FOCIL) is a good structure. The problem: the "without FOCIL" side requires the viewer to understand what "builder drops AA txs" means. If they do not know what a builder is, or what "AA" means, or why a builder would censor transactions, the left side is meaningless -- and then the right side has no contrast to work against.

16 committee nodes in a circle is visually noisy. The committee -> builder -> attester chain has 3 separate actor types that the viewer needs to track. Plus the left-side mempool, left-side builder, and rejection X marks. That is 5 actor types and 3 flow paths.

The 120 animated objects is the second-highest count.

**Concrete fix:**

Simplify the left side to ONE visual: a red "X" blocking blue cubes from entering a block. No explanation of who the builder is -- just "some transactions are blocked." Then the right side shows: a shield (the committee) appears, and now ALL cubes enter the block. The story is: "without protection, some txs get censored. With FOCIL, they cannot be censored." No need to show the committee structure, the inclusion lists, or the attestation flow in the 3D scene. Those are article-text concepts.

---

### Scene 10: FullStack3D.tsx (Atomic Ops + Quantum)

**Instant understanding (3-second test): 4/10**
**Technical accuracy revealed: 5/10**

**What's wrong:**

This scene tries to be the grand finale: "all auth schemes plug into the same Frame TX format, and atomic operations close the vulnerability gap." But it is a kitchen sink. Four auth scheme nodes in a carousel, a plug-in funnel, a Frame TX envelope, three internal frame slots, a before/after comparison zone, a vulnerability gap, auth particles, envelope particles, output particles.

The "carousel" of auth schemes rotating and connecting one by one is 10 seconds of "look, we can swap the auth method." That is a point the article should make with a sentence ("Frame TXs support ECDSA, multisig, ZK proofs, and post-quantum signatures -- same format"). Animating it for 10 seconds is motion for motion's sake.

The before/after atomic comparison (two cubes with a gap vs. one merged cube) is actually the strongest visual in this scene, but it is buried at 10-12s.

The Dilithium/quantum-resistance angle is tacked on. It does not get its own scene moment -- it is just one of four items in the carousel.

**Concrete fix:**

SPLIT this into two ideas and pick ONE. Either:
- (a) The "plug-in auth" scene: show ONE Frame TX envelope with a swappable first frame (slide in ECDSA, slide it out, slide in Multisig, slide it out, etc.). Keep it simple -- no particles, no output beam. The visual point is "the auth frame is a module."
- (b) The "atomic operations" scene: show the before/after. Two separate transactions with a red gap between them (the "sandwich attack" moment). Then show them merging into one Frame TX. This is a 3-second concept.

Do NOT try to do both in one scene. If you must choose one, choose (b) -- "atomic" is more universally understood than "pluggable auth."

---

## Cross-Cutting Issues

### 1. The Missing Scene: Normal TX vs. Frame TX

The article's single most important insight -- "how is a Frame TX structurally different from a normal transaction?" -- has NO dedicated scene. Scene 2 (Anatomy) shows the Frame TX internals but never shows a normal TX for comparison. A viewer who does not already know what a normal Ethereum transaction looks like gets no baseline.

**Recommendation:** Create a new Scene 0 (or make it Scene 1): side-by-side comparison. Left: a normal transaction (one sender, one receiver, one signature, one action). Right: a Frame TX (one envelope, multiple frames, no signature in envelope, authentication inside). The visual contrast should be immediate and stark. This replaces the current Scene 2 (Anatomy), which tries to show the Frame TX structure in isolation.

### 2. Conveyor Belt Overload

Scenes 1, 3, and 8 all use the same conveyor-belt/platform/rail metaphor. The reference implementation (ParallelVerification3D) uses it too. That is 4 scenes with the same visual language for different concepts. The viewer will tune out by the second conveyor belt.

### 3. Label Count

| Scene | Max simultaneous labels | Verdict |
|-------|------------------------|---------|
| 1 | 6 | Borderline |
| 2 | 10 | Too many |
| 3 | 7 | Borderline |
| 4 | 9 | Too many (but timed well -- never all at once) |
| 5 | 7 | Borderline |
| 6 | 8 | Too many |
| 7 | 7 | Borderline |
| 8 | 6 | Acceptable |
| 9 | 6 | Acceptable |
| 10 | 8 | Too many |

Scenes 2, 4, 6, and 10 need label reduction. Rule of thumb: 5 labels on screen at any one time is the maximum.

### 4. Loop Lengths

| Scene | Loop | Verdict |
|-------|------|---------|
| 1 | 12s | Too long |
| 2 | 10s | Acceptable |
| 3 | 14s | Too long |
| 4 | 12s | Acceptable (high engagement) |
| 5 | 14s | Too long |
| 6 | 16s | Far too long |
| 7 | 14s | Too long |
| 8 | 10s | Acceptable |
| 9 | 12s | Acceptable |
| 10 | 16s | Far too long |

Target: 8-10 seconds for simple scenes, 12 seconds max for complex ones. The key insight MUST land in the first 5 seconds.

### 5. Performance Budget: 10 WebGL Contexts

With SceneContainer's IntersectionObserver, only 2-3 scenes render at once. That is fine for frame rate. But total page weight (JS bundle) is a concern:

- Each scene imports `@react-three/fiber`, `@react-three/drei`, `three` -- these are shared, so no duplication.
- Each scene's component code is ~300-500 lines. 10 scenes = ~3,500-5,000 lines of scene code.
- With dynamic imports (next/dynamic), only visible scenes load. This is acceptable.

The real concern is MOBILE memory. Each WebGL context, even when not rendering, holds GPU texture/buffer references until unmounted. The ContextDisposer pattern handles this. With 10 scenes, the mount/unmount churn on scroll will cause frame drops on low-end devices. **Recommendation:** limit to 7-8 scenes maximum.

### 6. Scroll Story Coherence

Current order and whether each scene builds on the previous:

1. FrameExecution3D -- "What is a Frame TX?"
2. FrameAnatomy3D -- "What does it look like inside?"
3. ValidationPipeline3D -- "How is it validated?"
4. MultisigAuth3D -- "Showcase: multisig"
5. AccountDeploy3D -- "Showcase: deploy new wallet"
6. PaymasterFlow3D -- "Showcase: gas in any token"
7. ZKPrivacy3D -- "Showcase: privacy"
8. NonceLanes3D -- "Infrastructure: parallel nonces"
9. FOCILGuard3D -- "Infrastructure: anti-censorship"
10. FullStack3D -- "Everything together"

The progression from "what" (1-2) to "how" (3) to "examples" (4-7) to "infrastructure" (8-9) to "convergence" (10) is logical. But scenes 8 and 9 are a comedown after the high of scene 7. By that point the viewer has seen 7 scenes and is fatigued. The infrastructure scenes feel like appendices.

---

## Final Verdict: KEEP, MERGE, REPLACE

### KEEP (4 scenes)

| Scene | Reason |
|-------|--------|
| **4: MultisigAuth3D** | Best scene. Universally understandable. Minor label fixes needed. |
| **5: AccountDeploy3D** | Strong metaphor. Trim loop, promote cross-chain hook. |
| **6: PaymasterFlow3D** | Powerful concept. Needs heavy simplification (4 frames -> 3 beats). |
| **9: FOCILGuard3D** | Important concept. Needs simplification (remove committee internals). |

### MERGE (3 scenes -> 1)

| Merge | Into | Reason |
|-------|------|--------|
| **1: FrameExecution3D** + **2: FrameAnatomy3D** | **New Scene: "FrameOverview3D"** | Scene 1 shows the sandbox-to-committed flow. Scene 2 shows the envelope structure. These are two halves of the same concept: "what is a Frame TX and how does it work?" Merge them into one scene: show the envelope, show the frames inside, show the ACCEPT gate that commits. |
| **3: ValidationPipeline3D** | **Fold into article text as a 2D diagram** | The two-phase validation is important but the conveyor belt is redundant. A 2D flow diagram with arrows communicates this faster than a 3D scene. |

### REPLACE (3 scenes)

| Scene | Replace with | Reason |
|-------|-------------|--------|
| **7: ZKPrivacy3D** | **Simplified version** | Keep the concept but cut objects to ~80 (from ~150). Smaller crowd, no Merkle layers, lead with the punchline. |
| **8: NonceLanes3D** | **Kill entirely OR redesign** | Clone of ParallelVerification3D. Either cut it (explain nonce channels in text) or redesign with a fundamentally different metaphor (one user, multiple channels). |
| **10: FullStack3D** | **AtomicBatch3D** | Drop the auth carousel and quantum angle. Focus entirely on "two separate TXs with a gap" -> "one atomic Frame TX." That is a 3-second insight with real emotional weight (people have lost money to sandwich attacks). |

### ADD (1 new scene)

| Scene | Concept | Why |
|-------|---------|-----|
| **New Scene 1: NormalVsFrame3D** | Side-by-side: normal TX (one action, signature on outside) vs. Frame TX (multiple frames, auth on inside) | This is the single most important comparison in the article, and it currently has no scene. It should be the FIRST thing the viewer sees. |

### Proposed Final Scene List (8 scenes)

1. **NormalVsFrame3D** (NEW) -- "What's different?"
2. **FrameOverview3D** (MERGED 1+2) -- "How it works"
3. **MultisigAuth3D** (KEEP, scene 4) -- "Showcase: multisig"
4. **AccountDeploy3D** (KEEP, scene 5) -- "Showcase: deploy"
5. **PaymasterFlow3D** (KEEP, simplified scene 6) -- "Showcase: gas in any token"
6. **ZKPrivacy3D** (REPLACE, simplified scene 7) -- "Showcase: privacy"
7. **FOCILGuard3D** (KEEP, simplified scene 9) -- "Safety: anti-censorship"
8. **AtomicBatch3D** (REPLACE scene 10) -- "Closer: atomic operations"

This cuts 10 scenes to 8, eliminating the NonceLanes clone and the ValidationPipeline conveyor belt redundancy. It adds the missing NormalVsFrame comparison. Total animated objects drops from ~940 to ~600-650. Mobile performance improves. Scroll fatigue decreases. Every remaining scene passes the 3-second test.
