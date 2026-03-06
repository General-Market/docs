# EIP-8141 Account Abstraction -- 3D Scene Proposals (Revised)

**8 scenes. Each one animates a core concept from the EIP-8141 article.**
**Reference implementation:** `ParallelVerification3D.tsx` (style, code patterns, performance budget).
**Revision note:** Down from 10 scenes. Merged FrameExecution + FrameAnatomy. Added NormalVsFrame comparison. Replaced NonceLanes (conveyor clone) and FullStack (kitchen sink). Simplified PaymasterFlow, ZKPrivacy, FOCILGuard. Total objects ~520 (down from ~940).

---

## Selection Rationale (Revised)

| # | Scene | Source | Action | Role in narrative |
|---|-------|--------|--------|-------------------|
| 1 | NormalVsFrame3D | NEW | ADD | "What's different?" -- the single most important comparison |
| 2 | FrameOverview3D | Scenes 1+2 merged | MERGE | "How it works" -- frame structure + execution flow |
| 3 | MultisigAuth3D | Scene 4 | KEEP (polished) | "Showcase: multisig" -- strongest scene |
| 4 | AccountDeploy3D | Scene 5 | KEEP (trimmed) | "Showcase: deploy new wallet" |
| 5 | PaymasterFlow3D | Scene 6 | SIMPLIFY | "Showcase: gas in any token" |
| 6 | ZKPrivacy3D | Scene 7 | REDESIGN | "Showcase: privacy" |
| 7 | FOCILGuard3D | Scene 9 | KEEP (stripped) | "Safety: anti-censorship" |
| 8 | AtomicBatch3D | Scene 10 replaced | REPLACE | "Closer: atomic operations" |

**Removed:**
- ValidationPipeline3D (Scene 3) -- conveyor belt redundant with ParallelVerification3D; two-phase validation explained in article text with 2D diagram
- NonceLanes3D (Scene 8) -- visual clone of ParallelVerification3D; nonce channels explained in article text

---

## Global Design System

### Color Palette (shared across all 8 scenes)

| Token | Hex | Usage |
|-------|-----|-------|
| blue | #3b82f6 | Frame containers, primary data flow |
| green | #22c55e | Success states, ACCEPT confirmations, committed mode |
| red | #ef4444 | Sandbox mode, rejected paths, reverts, vulnerability |
| amber | #f59e0b | Cross-frame reads (CALLDATAREAD), dependency wires |
| purple | #8b5cf6 | Signatures, cryptographic proofs |
| indigo | #6366f1 | Gas flow, paymaster operations |

### Recurring Visual Vocabulary

| Object | Meaning |
|--------|---------|
| RoundedBox cube (0.3 units) | A transaction or data packet |
| Flat platform (RoundedBox, 0.06 thick) | A processing zone |
| TubeGeometry rail | Data flow path |
| instancedMesh spheres on rail | Particles showing flow direction and speed |
| Html label | Opcode name, address, state annotation |
| Pulsing glow (emissive oscillation) | Active processing |
| Color transition (red to green) | Untrusted to trusted state change |

### Performance Budget

- Target: 50-100 animated props per scene (hard max 120)
- instancedMesh for anything with >10 copies (particles, cubes in batches)
- useFrame + useRef only (never setState in render loop)
- Canvas dpr={[1, 2]}, flat rendering, antialias: true
- SceneContainer wrapper with IntersectionObserver mount/unmount
- Max 5 Html labels on screen at any one time
- Max loop length: 10s (simple scenes), 12s (complex scenes)
- Key insight MUST land in the first 5 seconds

---

## Scene 1: NormalVsFrame3D.tsx

**Narrative role:** The MOST IMPORTANT scene. Side-by-side comparison: how is a Frame TX different from a normal Ethereum transaction?
**Key insight:** A normal TX has 1 sender, 1 signature, 1 action. A Frame TX has N frames, no signature in the envelope, and uses ACCEPT to separate authentication from execution.
**3-second test target:** Viewer immediately sees two sides. Left is simple and familiar. Right is structured and new. The difference is visceral.

### Camera

- Position: [0, 5, 8]
- FOV: 34
- OrbitControls: polar 45-60 deg, azimuth +/- 12 deg, autoRotate 0.3

### Scene Layout (ASCII -- top-down camera view)

```
                    CAMERA LOOKING DOWN AT ~60deg
     _______________________________________________________________
    |                                                               |
    |   NORMAL TX (left)                FRAME TX (right)            |
    |                                                               |
    |   ┌──────────┐                   ┌──────────────────────┐    |
    |   │          │                   │  ENVELOPE (wireframe) │    |
    |   │  ┌────┐  │                   │                       │    |
    |   │  │CUBE│  │                   │  ┌─────┐ ┌─────┐ ┌──┐│    |
    |   │  │data│  │                   │  │ F0  │ │ F1  │ │F2││    |
    |   │  └────┘  │                   │  │auth │ │data │ │  ││    |
    |   │          │                   │  └─────┘ └─────┘ └──┘│    |
    |   │  🔒 SIG  │                   │                       │    |
    |   │  (ECDSA) │                   │  NO SIG IN ENVELOPE   │    |
    |   └──────────┘                   │  auth via ACCEPT ↗    │    |
    |                                  └──────────────────────┘    |
    |   1 sender                       N frames                     |
    |   1 signature                    0 signatures (in envelope)   |
    |   1 action                       ACCEPT = the gate            |
    |                                                               |
    |   ECDSA ──> execute              validate ──> ACCEPT ──> exec |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Left platform | 1 | [-3.5, 0, 0] | [4, 0.06, 3] | #fafafa | meshStandard, roughness 0.7 |
| Right platform | 1 | [3.5, 0, 0] | [5, 0.06, 3] | #fafafa | meshStandard, roughness 0.7 |
| Divider line | 1 | [0, 0.1, 0] | [0.02, 0.2, 3] | #e5e7eb | meshStandard |
| Normal TX cube | 1 | [-3.5, 0.5, 0] | [0.5, 0.5, 0.5] | #3b82f6 | RoundedBox |
| ECDSA padlock (cylinder + ring) | 2 | [-3.5, 0.15, 0.8] | small | #8b5cf6 | meshStandard |
| Normal TX arrow (tube) | 1 | [-3.5, 0.3, -0.8] to [-3.5, 0.3, -1.5] | tube r=0.015 | #3b82f6 | meshStandard |
| "execute" endpoint (small green cube) | 1 | [-3.5, 0.3, -1.8] | [0.3, 0.3, 0.3] | #22c55e | RoundedBox |
| Frame TX envelope (wireframe box) | 1 | [3.5, 0.7, 0] | [4.5, 1.5, 2.5] | #3b82f6, opacity 0.15 | meshBasic wireframe |
| Frame 0 container (auth frame) | 1 | [1.8, 0.5, 0] | [1, 0.8, 1] | #8b5cf6, opacity 0.25 | RoundedBox transparent |
| Frame 1 container | 1 | [3.5, 0.5, 0] | [1, 0.8, 1] | #3b82f6, opacity 0.25 | RoundedBox transparent |
| Frame 2 container | 1 | [5.2, 0.5, 0] | [1, 0.8, 1] | #3b82f6, opacity 0.25 | RoundedBox transparent |
| ACCEPT gate (2 pillars + arch) between F0 and F1 | 3 | [2.65, 0, +/-0.6] and [2.65, 0.6, 0] | pillars: [0.06, 0.6, 0.06], arch: [0.06, 0.06, 1.3] | #22c55e | meshStandard, emissive pulse |
| "No Sig" X mark (crossed bars) | 1 | [3.5, -0.15, 1.3] | small | #ef4444 | two crossed RoundedBox bars |
| Flow arrow particles (normal TX) | 8 | instanced along normal arrow | sphere r=0.01 | #3b82f6, opacity 0.5 | meshBasic |
| Flow arrow particles (Frame TX, 3-step) | 12 | instanced along F0->gate->F1->F2 path | sphere r=0.01 | #3b82f6, opacity 0.5 | meshBasic |
| Platform | 1 | [0, 0, 0] | [11, 0.04, 4] | #fafafa | meshStandard |

**Total animated objects: ~40**

### Animation Timeline (8s loop)

| Time | Event |
|------|-------|
| 0-2s | Both sides visible immediately. LEFT: Normal TX cube glows blue. Padlock visible below it. Label "1 sender, 1 signature, 1 action" appears. Arrow shows flow: ECDSA -> execute. The cube slides down the arrow to the green execute endpoint. Simple, fast, familiar. |
| 2-4s | RIGHT: Frame TX envelope fades in (already visible but wireframe brightens). Three frame containers appear inside (scale 0->1, left to right, 0.3s each). Frame 0 glows purple (it is the auth frame). Label "N frames, 0 signatures in envelope". The "No Sig" X mark pulses red at envelope bottom. |
| 4-6s | RIGHT: A small data cube emerges from Frame 0, travels toward the ACCEPT gate. Gate flashes green. Label "ACCEPT = authentication inside the TX". The cube passes through and continues to Frame 1, then Frame 2. This is the aha moment: authentication moved from OUTSIDE the TX to INSIDE one of its frames. |
| 6-8s | Both sides hold. LEFT: "ECDSA -> execute" path label. RIGHT: "validate -> ACCEPT -> execute" path label. Contrast is stark. Frame particles flow along the 3-step path. Brief hold, then loop. |

### instancedMesh Usage

- Normal TX flow particles: 8 instances, sphereGeometry
- Frame TX flow particles: 12 instances, sphereGeometry

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "Normal TX" | [-3.5, 1.8, 0] | Always |
| "Frame TX" | [3.5, 1.8, 0] | Always |
| "1 sender, 1 sig, 1 action" | [-3.5, -0.3, 1.5] | 0-4s |
| "ACCEPT" | [2.65, 0.8, 0] | 4-8s (pulses at 4-5s) |
| "Auth is INSIDE the TX" | [3.5, -0.3, 1.5] | 4-8s |

### Legend Items

- Blue square: "Transaction data"
- Purple square: "Authentication (signature / auth frame)"
- Green square: "ACCEPT gate"

---

## Scene 2: FrameOverview3D.tsx

**Diagram source:** Merged from Diagrams 0 (Frame Execution) + 2 (Frame TX Anatomy)
**Narrative role:** How Frame TXs work -- structure AND execution in one scene.
**Key insight:** Frames are ordered containers inside an envelope. CALLDATAREAD connects them. ACCEPT is the gate that flips everything from untrusted to trusted. Before ACCEPT = sandbox. After ACCEPT = committed.
**3-second test target:** Viewer sees an envelope with boxes inside it, one gate in the middle, and a clear red-to-green color shift.

### Camera

- Position: [0, 5, 8]
- FOV: 34
- OrbitControls: polar 45-60 deg, azimuth +/- 15 deg, autoRotate 0.3

### Scene Layout (ASCII)

```
                    CAMERA LOOKING DOWN AT ~60deg
     _______________________________________________________________
    |                                                               |
    |              ENVELOPE (large wireframe)                       |
    |   ┌─────────────────────────────────────────────────────┐    |
    |   │                                                     │    |
    |   │  UNTRUSTED ZONE     GATE     TRUSTED ZONE           │    |
    |   │  (red tint)          ║║      (green tint)           │    |
    |   │                      ║║                              │    |
    |   │  ┌─────┐            ║║     ┌─────┐    ┌─────┐     │    |
    |   │  │ F0  │ --------->  ║║ --> │ F1  │ -> │ F2  │     │    |
    |   │  │auth │  (red cube) ║║     │data │    │data │     │    |
    |   │  └─────┘            ║║     └─────┘    └─────┘     │    |
    |   │                      ║║                              │    |
    |   │  msg.sender=0x0   ACCEPT  msg.sender=0xUser         │    |
    |   │                      ║║                              │    |
    |   │  --- amber CALLDATAREAD arc from F0 to F1 ---       │    |
    |   │                                                     │    |
    |   └─────────────────────────────────────────────────────┘    |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Envelope wireframe | 1 | [0, 0.8, 0] | [9, 2, 3] | #3b82f6, opacity 0.12 | meshBasic wireframe |
| Envelope floor | 1 | [0, 0, 0] | [9, 0.04, 3] | #fafafa | meshStandard |
| Untrusted zone tint (flat plane) | 1 | [-2.5, 0.02, 0] | [3.5, 0.01, 2.5] | #fef2f2, opacity 0.4 | meshBasic |
| Trusted zone tint (flat plane) | 1 | [2.5, 0.02, 0] | [4.5, 0.01, 2.5] | #f0fdf4, opacity 0.4 | meshBasic |
| ACCEPT gate (2 pillars + arch) | 3 | [0, 0, +/-0.8] and [0, 0.7, 0] | pillars: [0.07, 0.7, 0.07], arch: [0.07, 0.07, 1.7] | #22c55e | meshStandard, emissive pulse |
| Frame 0 container (auth) | 1 | [-2.5, 0.5, 0] | [1.5, 0.8, 1.2] | #8b5cf6, opacity 0.2 | RoundedBox transparent |
| Frame 1 container | 1 | [2, 0.5, 0] | [1.5, 0.8, 1.2] | #3b82f6, opacity 0.2 | RoundedBox transparent |
| Frame 2 container | 1 | [4.2, 0.5, 0] | [1.5, 0.8, 1.2] | #3b82f6, opacity 0.2 | RoundedBox transparent |
| Animated cube (starts red, transitions to green at gate) | 1 | animated L-to-R inside envelope | [0.35, 0.35, 0.35] | #ef4444 -> #22c55e at gate | RoundedBox |
| ACCEPT flash ring | 1 | [0, 0.5, 0] | TorusGeometry, scale animation | #22c55e, emissive | meshBasic |
| CALLDATAREAD arc (amber, F0->F1) | 1 | QuadBezier from F0 to F1 | tube r=0.006 | #f59e0b, opacity 0.5 | meshStandard |
| CALLDATAREAD spark particles | 8 | instanced on arc, flowing F0→F1 | sphere r=0.006 | #f59e0b, opacity 0.7 | meshBasic |
| Flow particles (along cube path) | 16 | instanced along the L-to-R path | sphere r=0.01 | color matches zone (red/green) | meshBasic |

**Total animated objects: ~40**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-1.5s | Envelope wireframe visible. Three frame containers visible inside. Untrusted zone tinted red, trusted zone tinted green. Gate visible between them. Label "UNTRUSTED" on left, "TRUSTED" on right. The red cube appears at Frame 0 (auth frame). |
| 1.5-3s | Red cube slides right toward the ACCEPT gate. Flow particles trail behind it in red. Frame 0 glows purple (it is the auth frame doing validation). Meanwhile, CALLDATAREAD amber arc appears between F0 and F1 -- sparks travel along it. Label "CALLDATAREAD" appears briefly along the arc. |
| 3-4.5s | Cube reaches the ACCEPT gate. Gate pillars pulse green. Flash ring expands outward. Cube color transitions from red to green (lerp). Label "ACCEPT" pulses above gate. This is the moment: untrusted becomes trusted. |
| 4.5-6.5s | Green cube continues right past the gate. Passes through Frame 1, then Frame 2. Flow particles are now green. |
| 6.5-8s | All frames in position. The cube arrives at the end. The scene holds: untrusted zone on left, trusted zone on right, gate in the middle. The visual story is complete. |
| 8-10s | Gentle bob. Elements fade. Loop reset. |

### instancedMesh Usage

- CALLDATAREAD sparks: 8 instances, sphereGeometry
- Flow particles: 16 instances, sphereGeometry

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "UNTRUSTED" | [-2.5, 1.5, 0] | Always |
| "TRUSTED" | [2.5, 1.5, 0] | Always |
| "ACCEPT" | [0, 1.0, 0] | Always (pulses at 3-4.5s) |
| "Frame 0: validate" | [-2.5, -0.2, 1.5] | 1.5-3s |
| "CALLDATAREAD" | [0, 0.8, 1.2] | 1.5-3s |

### Legend Items

- Red square: "Untrusted (before ACCEPT)"
- Green square: "Trusted (after ACCEPT)"
- Amber square: "CALLDATAREAD (data flows from Frame 0 being read to Frame 0 reading)"

---

## Scene 3: MultisigAuth3D.tsx

**Diagram source:** Diagram 4 -- Multisig with Frame Auth
**Narrative role:** THE showcase scene. How multisig authentication works natively inside Frame TXs.
**Key insight:** Two signers produce signatures off-chain, which are verified in Frame 0. CALLDATAREAD lets the validator inspect what Frame 1 will do BEFORE approving it. ACCEPT fires once both sigs check out.
**Review action:** KEEP. Best scene. Rename ecrecover labels to plain English. Shorten loop from 12s to 10s. Make vault lock larger and animate unlock more dramatically.

### Camera

- Position: [0, 5.5, 9]
- FOV: 35
- OrbitControls: polar 40-55 deg, azimuth +/- 18 deg, autoRotate 0.4

### Scene Layout (ASCII)

```
                           CAMERA
     _______________________________________________________________
    |                                                               |
    |     ALICE        BOB          VALIDATOR VAULT       USDC      |
    |                                                               |
    |     ┌──┐        ┌──┐         ┌───────────┐       ┌───────┐  |
    |     │A │\      /│B │         │           │       │       │  |
    |     │  │ \    / │  │    ═══> │  VERIFY   │  ═══> │USDC   │  |
    |     └──┘  \  /  └──┘    sig │  ALICE ✓  │  beam │xfer   │  |
    |   purple   \/   purple  cube│  BOB ✓    │       │       │  |
    |   sphere  merge  sphere     │  ACCEPT!  │       └───────┘  |
    |           point             │  🔓 -> 🔓  │                   |
    |             │               └───────────┘                   |
    |             │                  ┌──┐                          |
    |             │<--- amber arc ---│F1│ CALLDATAREAD             |
    |             │                  │cd│                          |
    |             ▼                  └──┘                          |
    |         validator                                            |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Alice sphere | 1 | [-4, 0.5, 1.5] | sphere r=0.35 | #8b5cf6 | meshStandard |
| Bob sphere | 1 | [-4, 0.5, -1.5] | sphere r=0.35 | #8b5cf6 | meshStandard |
| Signature cubes (2, one per signer) | 2 | animated: start at signers, merge toward vault | [0.2, 0.2, 0.2] | #8b5cf6 | RoundedBox, emissive pulse |
| Validator vault (large RoundedBox) | 1 | [0, 0.5, 0] | [2, 1.5, 2] | #f8fafc border, subtle blue | RoundedBox + wireframe outline |
| Vault lock icon (2 cylinders + torus ring) | 3 | on front face of vault, LARGE and prominent | cylinder r=0.12 h=0.25, ring r=0.18 | #6366f1 -> #22c55e on unlock | meshStandard |
| ACCEPT flash ring | 1 | [0, 0.5, 0] | TorusGeometry, scale animation | #22c55e, emissive | meshBasic |
| Command beam (bright line from vault to USDC) | 1 | animated: grows from vault to USDC node | CylinderGeometry h animated | #22c55e, emissive | meshBasic |
| USDC target node (rounded cube) | 1 | [4.5, 0.5, 0] | [1.5, 1, 1.5] | #3b82f6 | RoundedBox |
| Frame 1 calldata cube | 1 | [2, 0.3, 2] | [0.5, 0.3, 0.5] | #3b82f6 | RoundedBox |
| CALLDATAREAD arc (amber) | 1 | QuadBezier from F1 cube back to vault | tube r=0.006 | #f59e0b | meshStandard |
| CALLDATAREAD particles | 12 | instanced on arc | sphere r=0.006 | #f59e0b | meshBasic |
| Signature trail particles (Alice) | 16 | instanced along Alice->vault path | sphere r=0.008 | #8b5cf6, opacity 0.6 | meshBasic |
| Signature trail particles (Bob) | 16 | instanced along Bob->vault path | sphere r=0.008 | #8b5cf6, opacity 0.6 | meshBasic |
| USDC token symbols (floating) | 20 | instanced, stream from vault to USDC target | sphere r=0.015 | #22c55e | meshBasic |
| Platform | 1 | [0, 0, 0] | [12, 0.04, 5] | #fafafa | meshStandard |

**Total animated objects: ~80**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-1s | Alice and Bob spheres pulse (scale breathe). Labels "Alice" and "Bob" visible. Vault visible with large lock icon. |
| 1-2.5s | Signature cubes emerge from each signer (scale from 0). They travel along curved paths toward the vault. Purple trail particles follow each cube. |
| 2.5-3.5s | As sig cubes travel, CALLDATAREAD arc appears. Amber particles flow from Frame 1 calldata cube to the vault. Label "CALLDATAREAD" appears along arc. This shows the vault reading what Frame 1 will do. |
| 3.5-4.5s | Sig cubes arrive at vault. They sink into the vault faces (scale to 0 as they enter). Inside vault: "Signature verified: Alice" checkmark appears. 0.3s later: "Signature verified: Bob" checkmark. |
| 4.5-6s | ACCEPT flash: green ring expands from vault center outward. Vault wireframe turns green. Lock icon rotates dramatically (full 180-degree flip, changes color from indigo to green -- the emotional peak). Label "ACCEPT" appears above. |
| 6-8s | Command beam grows from vault toward USDC node (CylinderGeometry, length animates). Green token particles stream along the beam. USDC node pulses on receiving. |
| 8-10s | Hold. All elements gently breathe. Labels fade. Loop reset. |

### instancedMesh Usage

- Signature trail particles (Alice): 16 instances
- Signature trail particles (Bob): 16 instances
- CALLDATAREAD particles: 12 instances
- USDC token stream: 20 instances

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "Alice" | above Alice | Always |
| "Bob" | above Bob | Always |
| "Validator" | above vault | Always |
| "CALLDATAREAD" | along amber arc | 2.5-4.5s |
| "ACCEPT" | above vault | 4.5-8s |

### Legend Items

- Purple square: "Signatures"
- Amber square: "CALLDATAREAD"
- Green square: "ACCEPT + Execution"

---

## Scene 4: AccountDeploy3D.tsx

**Diagram source:** Diagram 5 -- New Account Deployment
**Narrative role:** How new accounts deploy. Address exists before code does.
**Key insight:** The address is deterministic (CREATE2). User can receive funds BEFORE deploying. One 3-frame TX: deploy, validate, execute -- all atomic.
**Review action:** KEEP. Trim loop from 14s to 10s. Remove gas accounting. Remove cross-chain ghost addresses (they are disconnected and confusing). Focus on the 3-frame build sequence: empty plot -> construction -> built wallet -> first TX.

### Camera

- Position: [-1, 6, 9]
- FOV: 36
- OrbitControls: polar 40-55 deg, azimuth +/- 20 deg, autoRotate 0.3

### Scene Layout (ASCII)

```
                         CAMERA
     _______________________________________________________________
    |                                                               |
    |   FACTORY            EMPTY PLOT           BUILT WALLET        |
    |   PREDEPLOY          (address known)      (after deploy)      |
    |                                                               |
    |   ┌──────┐    F0     ┌·····────┐   F1     ┌────────┐        |
    |   │7997..│  ═══════> │0x1a2b.. │ ═══════> │WALLET  │        |
    |   │FACTORY│  deploy  │         │ validate │ACTIVE  │        |
    |   │      │  beam    │ funds   │ sig beam │ACCEPT! │        |
    |   └──────┘          │ waiting │          └───┬────┘        |
    |                      └─────────┘              │              |
    |                                          F2   │ execute      |
    |                                          ═════╪═════>        |
    |                                               │              |
    |                                          ┌───▼────┐        |
    |                                          │ USDC   │        |
    |                                          │ xfer   │        |
    |                                          └────────┘        |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Factory node (hexagonal prism) | 1 | [-4.5, 0.5, 0] | r=0.6, h=0.8 | #6366f1 | meshStandard |
| Empty plot (dashed-outline box, wireframe) | 1 | [-1, 0.5, 0] | [1.5, 1, 1.5] | #d4d4d8, dashed | meshBasic wireframe |
| Address beacon (small pillar at plot) | 1 | [-1, 0, 0] | [0.3, 0.08, 0.3] | #f59e0b | meshStandard |
| Pre-funded coins (stacked discs at plot) | 6 | [-1, 0.15-0.45, 0] | cylinder r=0.15, h=0.05 | #f59e0b | meshStandard |
| Built wallet (RoundedBox, materializes in same spot) | 1 | [-1, 0.5, 0] | [1.5, 1, 1.5] | #22c55e | RoundedBox, scale 0->1 |
| Deploy beam (factory to plot) | 1 | animated tube | tube r=0.01 | #6366f1, emissive | meshBasic |
| Deploy construction particles | 24 | instanced, spiral upward from plot during build | sphere r=0.01 | #6366f1 | meshBasic |
| Validate beam (signature arc into wallet) | 1 | QuadBezier arc | tube r=0.008 | #8b5cf6 | meshStandard |
| ACCEPT ring | 1 | at wallet position | TorusGeometry | #22c55e, emissive | meshBasic |
| Execute beam (wallet to USDC) | 1 | animated tube | tube r=0.01 | #22c55e | meshBasic |
| USDC target | 1 | [3.5, 0.5, 0] | [1.2, 0.8, 1.2] | #3b82f6 | RoundedBox |
| Token stream particles | 16 | instanced along execute beam | sphere r=0.01 | #22c55e | meshBasic |
| Platform | 1 | [0, 0, 0] | [11, 0.04, 4] | #fafafa | meshStandard |

**Total animated objects: ~58**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-1.5s | Empty plot visible with dashed wireframe. Address beacon pulses amber. Pre-funded coins visible. Label "0x1a2b..." and "Funds waiting (no wallet yet)" appear. |
| 1.5-4s | FRAME 0 -- Deploy: beam shoots from factory to plot. Construction particles spiral upward (like a building assembling). The dashed wireframe fills in, becoming a solid green wallet box. Label "Frame 0: Deploy". |
| 4-6s | FRAME 1 -- Validate: purple signature arc curves from above into the wallet. Wallet glows purple briefly during verification. ACCEPT ring expands green. Label "Frame 1: Validate + ACCEPT". |
| 6-8s | FRAME 2 -- Execute: green beam extends from wallet to USDC node. Token stream particles flow along beam. USDC node pulses on receipt. Label "Frame 2: Execute". |
| 8-10s | Hold with gentle bob. Label "First-ever TX from this wallet" appears. Loop reset. |

### instancedMesh Usage

- Construction particles: 24 instances
- Token stream: 16 instances

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "Factory" | above factory | Always |
| "0x1a2b..." | above plot/wallet | Always |
| "Funds waiting" | beside coins | 0-4s |
| "Frame 0: Deploy" | above scene | 1.5-4s |
| "Frame 1: ACCEPT" | above scene | 4-6s |

### Legend Items

- Indigo square: "Factory / Deploy"
- Green square: "Wallet (committed)"
- Amber square: "Pre-funded balance"

---

## Scene 5: PaymasterFlow3D.tsx

**Diagram source:** Diagram 6 -- Paymaster Gas Flow
**Narrative role:** How paymasters pay gas in any token. The user holds RAI, no ETH.
**Key insight:** The user has tokens but no ETH. The paymaster pays gas in ETH. After the user's operation, the paymaster takes its fee in the user's token. Gas abstraction.
**Review action:** SIMPLIFY. Cut from 4-frame choreography to 3 visual beats. Cut CALLDATAREAD to ONE arc. Remove USDC-to-recipient sub-flow entirely. Scene is ONLY about gas payment. Loop from 16s to 10s. Objects from 100 to ~70.

### Camera

- Position: [0, 6, 10]
- FOV: 34
- OrbitControls: polar 40-55 deg, azimuth +/- 15 deg, autoRotate 0.3

### Scene Layout (ASCII)

```
                            CAMERA
     _______________________________________________________________
    |                                                               |
    |   USER                    PAYMASTER                           |
    |   (has RAI,               (has ETH,                           |
    |    no ETH)                 wants RAI)                         |
    |                                                               |
    |   ┌────────┐             ┌──────────┐                        |
    |   │  USER  │             │PAYMASTER │                        |
    |   │        │  ═ BEAT 1 ═ │          │                        |
    |   │ [RAI]  │  show both  │  [ETH]   │                        |
    |   │ [RAI]  │  holdings   │  [ETH]   │                        |
    |   │ [RAI]  │             │  [ETH]   │                        |
    |   │ [0 ETH]│             │          │                        |
    |   └────────┘             └──────────┘                        |
    |        │                       │                              |
    |        │   ═ BEAT 2 ═          │                              |
    |        │   Paymaster checks    │                              |
    |        │   tx + pays gas       │                              |
    |        │   <-- amber arc --    │                              |
    |        │        ETH burns ↑    │                              |
    |        │                       │                              |
    |        │   ═ BEAT 3 ═          │                              |
    |        │   Operation done,     │                              |
    |        │   RAI fee collected   │                              |
    |        │── RAI tokens ────────>│                              |
    |        │                       │                              |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| User node (RoundedBox) | 1 | [-3.5, 0.5, 0] | [1.5, 1.2, 1.5] | #3b82f6 | meshStandard |
| RAI token stack (discs inside user, visible) | 6 | inside user node | cylinder r=0.12, h=0.04 | #8b5cf6 | meshStandard |
| "0 ETH" indicator (small empty circle) | 1 | [-3.5, -0.1, 1] | small ring | #ef4444, opacity 0.5 | meshBasic |
| Paymaster node (hexagonal prism) | 1 | [3.5, 0.5, 0] | r=0.8, h=1.2 | #6366f1 | meshStandard |
| ETH reserve (spheres inside paymaster) | 5 | scattered inside paymaster | sphere r=0.1 | #f59e0b | meshStandard |
| CALLDATAREAD arc (ONE arc: paymaster reads user intent) | 1 | QuadBezier from user to paymaster | tube r=0.005 | #f59e0b, opacity 0.5 | meshStandard |
| CALLDATAREAD particles | 8 | instanced on arc, flowing user→paymaster | sphere r=0.005 | #f59e0b | meshBasic |
| ACCEPT ring | 1 | at paymaster | TorusGeometry | #22c55e | meshBasic |
| ETH gas flame (particle fountain above paymaster) | 12 | instanced, rise and fade | sphere r=0.008 | #f59e0b, opacity fade | meshBasic |
| RAI token flow (discs moving user->paymaster) | 10 | instanced on collection beam | cylinder r=0.06, h=0.03 | #8b5cf6 | meshBasic |
| RAI collection beam (user to paymaster) | 1 | animated tube | tube r=0.008 | #8b5cf6 | meshStandard |
| Operation checkmark (appears at user) | 1 | at user position | TorusGeometry small | #22c55e, emissive | meshBasic |
| Platform | 1 | [0, 0, 0] | [10, 0.04, 4] | #fafafa | meshStandard |

**Total animated objects: ~55**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-2.5s | BEAT 1: Both nodes visible. User shows RAI stack (purple discs) and a red "0 ETH" indicator. Paymaster shows ETH spheres (amber). Label "User: RAI tokens, no ETH" and "Paymaster: has ETH". The problem is clear: the user cannot pay gas. |
| 2.5-5s | BEAT 2: CALLDATAREAD arc appears from paymaster to user (one arc, not three). Amber particles flow. The paymaster reads the user's intent. ACCEPT ring fires green at paymaster. Label "Paymaster checks TX + pays gas". ETH flame particles rise from paymaster (gas is being burned). One ETH sphere inside paymaster shrinks/disappears. |
| 5-8s | BEAT 3: Operation completes -- checkmark appears at user node. Then RAI collection beam appears from user to paymaster. RAI disc tokens flow along the beam. RAI stack inside user decreases. RAI appears inside paymaster. Label "Fee collected: RAI". |
| 8-10s | Hold. Final state visible: user has fewer RAI, paymaster has RAI + less ETH. Both sides satisfied. Loop reset. |

### instancedMesh Usage

- CALLDATAREAD particles: 8 instances
- ETH gas flame: 12 instances
- RAI token flow: 10 instances

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "User: RAI, no ETH" | above user | 0-5s |
| "Paymaster: has ETH" | above paymaster | 0-5s |
| "Pays gas" | above paymaster | 2.5-5s |
| "ACCEPT" | at paymaster | 3-5s |
| "Fee: RAI" | along beam | 5-8s |

### Legend Items

- Purple square: "RAI tokens (user's)"
- Amber square: "ETH (gas)"
- Indigo square: "Paymaster"
- Amber arc: "CALLDATAREAD (data flows from user being read toward paymaster reading)"

---

## Scene 6: ZKPrivacy3D.tsx

**Diagram source:** Diagram 7 -- ZK-SNARK Privacy Protocol
**Narrative role:** How ZK privacy works -- withdraw without revealing identity.
**Key insight:** No link between deposit and withdrawal. That is the punchline. The ZK proof replaces a signature.
**Review action:** REDESIGN. Lead with the punchline (broken link), then reveal why. Crowd from 60 to 25 instances. Remove Merkle tree layers entirely (one opaque pool cylinder). Cut from 150 to ~80 objects. Loop from 14s to 10s.

### Camera

- Position: [0, 5, 10]
- FOV: 36
- OrbitControls: polar 40-60 deg, azimuth +/- 15 deg, autoRotate 0.2

### Scene Layout (ASCII)

```
                           CAMERA
     _______________________________________________________________
    |                                                               |
    |   DEPOSITORS                   FRESH ADDRESS                  |
    |   (crowd)                      (withdrawal)                   |
    |                                                               |
    |   ? ? ? ? ?                    ┌──────────┐                  |
    |   ? ? ? ? ?  ----  X  ----    │ 0xFresh  │                  |
    |   ? ? ? ? ?    NO LINK        │  1 ETH   │                  |
    |   ? ? ? ? ?                    └──────────┘                  |
    |   ? ? ? ? ?                                                   |
    |                                                               |
    |            ┌───────────────┐                                  |
    |            │  PRIVACY POOL │                                  |
    |            │   "10K deps"  │                                  |
    |            │   ┌────────┐  │                                  |
    |            │   │ZK PROOF│  │                                  |
    |            │   │ purple │  │                                  |
    |            │   └────────┘  │                                  |
    |            └───────────────┘                                  |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Anonymous crowd (sphere silhouettes) | 25 | instanced, [-4, 0, -2 to 2] grid formation | sphere r=0.12 | #a8a29e, opacity 0.5 | meshBasic |
| "No link" broken line (dashed tube + X mark) | 2 | from crowd area to fresh address, center X | dashed tube segments + X | #ef4444, opacity 0.6 | meshBasic |
| Fresh address node | 1 | [4, 0.5, 0] | [1.2, 0.8, 1.2] | #22c55e | RoundedBox |
| Privacy pool (opaque cylinder) | 1 | [0, 0.5, -2] | cylinder r=1.2, h=1.5 | #3b82f6, opacity 0.3 | meshStandard |
| Pool surface dots (deposits) | 20 | instanced on pool surface | sphere r=0.025 | #3b82f6, opacity 0.4 | meshBasic |
| Active depositor (one from crowd, highlighted) | 1 | separates from crowd | sphere r=0.15 | #8b5cf6 | meshStandard |
| Proof cube (output from pool) | 1 | animated: emerges from pool | [0.35, 0.35, 0.35] | #8b5cf6, emissive | RoundedBox |
| Verification beam (proof to pool validator) | 1 | animated tube | tube r=0.01 | #8b5cf6, emissive | meshBasic |
| Verification flash | 1 | at pool | expanding sphere, fade | #22c55e | meshBasic |
| Withdrawal beam (pool to fresh address) | 1 | animated tube | tube r=0.01 | #22c55e | meshBasic |
| ETH flow particles | 12 | instanced along withdrawal beam | sphere r=0.015 | #f59e0b | meshBasic |
| Nullifier X mark (on one pool dot) | 1 | on pool surface | -- | #ef4444 | small cross mesh |
| Platform | 1 | [0, 0, 0] | [11, 0.04, 6] | #fafafa | meshStandard |

**Total animated objects: ~75**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-2s | PUNCHLINE FIRST: Crowd on left, fresh address on right. Broken dashed line with X between them. Label "No link between deposit and withdrawal." This is what the viewer needs to understand in 3 seconds. The crowd is gray and anonymous. The fresh address is green and new. The X is red and stark. |
| 2-4s | HOW IT WORKS -- step 1: One sphere in the crowd glows purple (the depositor). It slides toward the privacy pool. The pool glows. Label "One depositor enters the pool." The depositor fades into the pool (opacity -> 0 as it merges with the pool surface). Now the depositor is hidden among 10K others. |
| 4-6s | HOW IT WORKS -- step 2: A proof cube emerges from the pool (scale 0->1 with bounce). It glows purple. Label "ZK proof: I own a deposit (but which one?)." The proof cube does NOT come from the crowd -- it comes from the pool itself. This is important: the proof proves membership without revealing identity. |
| 6-8s | HOW IT WORKS -- step 3: Proof cube travels to pool validator area. Verification flash (green). Nullifier X appears on one pool dot (preventing reuse). Withdrawal beam extends to fresh address. ETH particles flow. Label "Withdraw to fresh address." Fresh node pulses green. |
| 8-10s | Return to the punchline: broken line with X reappears prominently. The crowd is unchanged. The fresh address has funds. No connection between them. Hold. Reset. |

### instancedMesh Usage

- Anonymous crowd: 25 instances, sphereGeometry
- Pool surface dots: 20 instances, sphereGeometry
- ETH flow particles: 12 instances, sphereGeometry

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "No link" | center, above broken line | 0-2s, 8-10s |
| "10K depositors" | above crowd | 0-2s |
| "ZK proof" | beside proof cube | 4-6s |
| "ACCEPT" | at pool | 6-8s |
| "0xFresh" | above fresh address | 6-10s |

### Legend Items

- Gray square: "Anonymous depositors"
- Purple square: "ZK proof"
- Green square: "Withdrawal (fresh address)"
- Red X: "No link (unlinkable)"

---

## Scene 7: FOCILGuard3D.tsx

**Diagram source:** Diagram 10 -- FOCIL + Account Abstraction
**Narrative role:** How FOCIL prevents censorship of Frame TXs.
**Key insight:** Without FOCIL, builders can ignore Frame TXs. With FOCIL, they are forced to include them.
**Review action:** KEEP but strip committee internals. No committee circle, no inclusion lists, no attestation flow. Simplify to: left side = red X blocking blue cubes. Right side = shield appears, all cubes enter block. The story: "without protection, censored. With FOCIL, cannot be censored." Objects from 120 to ~60.

### Camera

- Position: [0, 5, 9]
- FOV: 36
- OrbitControls: polar 40-55 deg, azimuth +/- 15 deg, autoRotate 0.3

### Scene Layout (ASCII)

```
                           CAMERA
     _______________________________________________________________
    |                                                               |
    |   WITHOUT FOCIL (left)          WITH FOCIL (right)           |
    |                                                               |
    |   MEMPOOL      BLOCK            MEMPOOL   SHIELD   BLOCK     |
    |                                                               |
    |   ┌────┐      ┌──────┐        ┌────┐    ┌──┐    ┌──────┐  |
    |   │tx1 │ ──>  │      │        │tx1 │    │🛡│    │      │  |
    |   │tx2 │  X   │ BLOCK│        │tx2 │ ─> │  │ ─> │ BLOCK│  |
    |   │tx3 │  X   │(gaps)│        │tx3 │    │  │    │(full)│  |
    |   │tx4 │ ──>  │      │        │tx4 │ ─> │  │ ─> │      │  |
    |   │tx5 │  X   │      │        │tx5 │    └──┘    │      │  |
    |   └────┘      └──────┘        └────┘             └──────┘  |
    |                                                               |
    |   Blue txs = Frame TXs (AA)    All txs included              |
    |   Gray txs = normal EOA        No censorship                 |
    |   X = censored by builder                                    |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| Left mempool cubes (5 TX cubes) | 5 | [-5.5, 0.3-1.5, -1.5] stacked | [0.4, 0.2, 0.4] | AA(3 cubes)=#3b82f6, EOA(2 cubes)=#d4d4d8 | RoundedBox |
| Left block (RoundedBox with gaps) | 1 | [-2.5, 0.5, -1.5] | [1.2, 1.5, 1.2] | #ef4444, opacity 0.3 | RoundedBox, transparent |
| Rejection X marks (left, 3 marks) | 3 | between left mempool and block | -- | #ef4444 | two crossed bars each |
| Left accepted cubes (2 EOA inside block) | 2 | inside left block | [0.35, 0.18, 0.35] | #d4d4d8 | RoundedBox |
| Left rejected cubes (3 AA, scattered on ground) | 3 | below left block, fallen | [0.35, 0.18, 0.35] | #3b82f6, opacity 0.4 | RoundedBox |
| Right mempool cubes (5 TX cubes) | 5 | [1, 0.3-1.5, 1.5] stacked | [0.4, 0.2, 0.4] | same mix as left | RoundedBox |
| FOCIL shield (large flat RoundedBox with icon) | 1 | [3, 0.5, 1.5] | [0.3, 1.5, 1.5] | #6366f1, emissive | RoundedBox |
| Right block (RoundedBox, full) | 1 | [5, 0.5, 1.5] | [1.2, 1.5, 1.2] | #22c55e, opacity 0.3 | RoundedBox, transparent |
| Right accepted cubes (all 5 inside block) | 5 | inside right block | [0.35, 0.18, 0.35] | matching colors | RoundedBox |
| Flow particles (left, partial) | 8 | instanced along accepted paths only | sphere r=0.008 | #d4d4d8 | meshBasic |
| Flow particles (right, full) | 12 | instanced along all paths | sphere r=0.008 | #22c55e | meshBasic |
| Divider line | 1 | [-0.5, 0.15, 0] | [0.02, 0.3, 3.5] | #e5e7eb | meshStandard |
| Platform | 1 | [0, 0, 0] | [13, 0.04, 5] | #fafafa | meshStandard |

**Total animated objects: ~55**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-3s | LEFT SIDE (without FOCIL): TX cubes in mempool. Some cubes fly toward block. Blue cubes (Frame TXs / AA) hit X marks -- they bounce back and fall to the ground. Gray cubes (EOA) pass through to the block. Label "Some txs blocked." The block has visible gaps (half empty). |
| 3-5s | LEFT result holds. The fallen blue cubes sit on the ground. The block is sparse. Label "Frame TXs censored." The visual is stark: a half-empty block and rejected transactions on the ground. |
| 5-8s | RIGHT SIDE (with FOCIL): FOCIL shield glows indigo in the center. ALL tx cubes flow from mempool, through the shield, into the block. Blue and gray cubes alike. No X marks. No rejections. Label "FOCIL: all txs included." The block is full and glows green. |
| 8-10s | Both sides hold for comparison. Left: half-empty block, fallen cubes. Right: full block, no waste. The contrast speaks for itself. Hold. Reset. |

### instancedMesh Usage

- Left flow particles: 8 instances
- Right flow particles: 12 instances

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "Without FOCIL" | above left area | Always |
| "With FOCIL" | above right area | Always |
| "Txs blocked" | near left X marks | 0-5s |
| "All included" | near right block | 5-10s |
| "FOCIL" | on shield | 5-10s |

### Legend Items

- Red square + X: "Censored txs"
- Blue square: "Frame TXs (AA)"
- Indigo square: "FOCIL shield"
- Green square: "Included in block"

---

## Scene 8: AtomicBatch3D.tsx

**Diagram source:** Replaces Scene 10 (FullStack3D)
**Narrative role:** The closer. Why atomic operations matter.
**Key insight:** When you do 2 separate TXs (approve + swap), there is a time gap between them. During that gap, state can change -- someone can front-run you. Frame TXs merge all steps into ONE atomic TX. No gap. No front-running.
**3-second test target:** Viewer sees two separate boxes with a scary red gap between them, then sees them merge into one box with no gap. Emotional weight: people have lost money to sandwich attacks.

### Camera

- Position: [0, 5, 9]
- FOV: 34
- OrbitControls: polar 45-60 deg, azimuth +/- 12 deg, autoRotate 0.3

### Scene Layout (ASCII)

```
                           CAMERA
     _______________________________________________________________
    |                                                               |
    |   BEFORE (top):  2 separate TXs with vulnerability gap       |
    |                                                               |
    |   ┌────────┐     ▓▓▓▓▓▓▓▓     ┌────────┐                   |
    |   │  TX 1  │     ▓ DANGER ▓     │  TX 2  │                   |
    |   │approve │     ▓  GAP   ▓     │  swap  │                   |
    |   │        │     ▓▓▓▓▓▓▓▓     │        │                   |
    |   └────────┘                    └────────┘                   |
    |                                                               |
    |         state can change here ↑                               |
    |         front-run, sandwich, MEV                              |
    |                                                               |
    |   ─────────────────────────────────────────                   |
    |                                                               |
    |   AFTER (bottom): 1 Frame TX, all frames atomic              |
    |                                                               |
    |   ┌────────────────────────────────────────┐                 |
    |   │  FRAME TX                              │                 |
    |   │  ┌─────────┐  ┌─────────┐  ┌────────┐│                 |
    |   │  │Frame 0  │  │Frame 1  │  │Frame 2 ││                 |
    |   │  │validate │  │approve  │  │swap    ││                 |
    |   │  └─────────┘  └─────────┘  └────────┘│                 |
    |   │  🛡 NO GAP -- atomic execution        │                 |
    |   └────────────────────────────────────────┘                 |
    |_______________________________________________________________|
```

### Objects

| Object | Count | Position | Size | Color | Material |
|--------|-------|----------|------|-------|----------|
| BEFORE: TX 1 cube ("approve") | 1 | [-2.5, 0.5, 1.5] | [1.5, 0.8, 1] | #3b82f6 | RoundedBox |
| BEFORE: TX 2 cube ("swap") | 1 | [2.5, 0.5, 1.5] | [1.5, 0.8, 1] | #3b82f6 | RoundedBox |
| BEFORE: vulnerability gap (pulsing red zone) | 1 | [0, 0.5, 1.5] | [1.5, 0.8, 1] | #ef4444, opacity pulsing 0.2-0.6 | meshBasic |
| BEFORE: danger particles (chaotic, inside gap) | 16 | instanced, jittering inside gap zone | sphere r=0.015 | #ef4444, opacity 0.7 | meshBasic |
| BEFORE: attacker arrow (sharp triangle entering gap from above) | 1 | [0, 1.5, 1.5] animated drop | cone r=0.15, h=0.4 | #ef4444 | meshStandard |
| AFTER: Frame TX envelope (wireframe + solid floor) | 1 | [0, 0.5, -1.5] | [6, 1.2, 1.5] | #3b82f6, opacity 0.15 wireframe | meshBasic + solid floor |
| AFTER: Frame 0 (validate) | 1 | [-2, 0.5, -1.5] | [1.2, 0.6, 0.8] | #8b5cf6, opacity 0.25 | RoundedBox |
| AFTER: Frame 1 (approve) | 1 | [0, 0.5, -1.5] | [1.2, 0.6, 0.8] | #3b82f6, opacity 0.25 | RoundedBox |
| AFTER: Frame 2 (swap) | 1 | [2, 0.5, -1.5] | [1.2, 0.6, 0.8] | #3b82f6, opacity 0.25 | RoundedBox |
| AFTER: shield icon (on envelope face) | 1 | [0, 0.9, -0.7] | small geometry | #22c55e | meshStandard |
| AFTER: green connection particles (flowing through all frames) | 12 | instanced, flowing L-to-R through frames | sphere r=0.01 | #22c55e, opacity 0.6 | meshBasic |
| "BEFORE" / "AFTER" divider (horizontal line) | 1 | [0, 0.3, 0] | [7, 0.01, 0.02] | #d4d4d8 | meshStandard |
| Platform | 1 | [0, 0, 0] | [9, 0.04, 5] | #fafafa | meshStandard |

**Total animated objects: ~45**

### Animation Timeline (10s loop)

| Time | Event |
|------|-------|
| 0-3s | BEFORE section (top): Two TX cubes visible with red gap between them. Gap pulses red (emissive oscillation). Danger particles jitter chaotically inside the gap. Label "2 separate TXs". Then the attacker arrow drops from above into the gap. Label "Front-run! State changed between TXs." The gap flashes bright red. This is the problem. |
| 3-5s | BEFORE holds with the attacker lodged in the gap. The two TX cubes shake slightly (they are compromised). The emotional hit: your approve went through, but someone changed the price before your swap. |
| 5-8s | AFTER section (bottom): Frame TX envelope visible with 3 frames inside. Green connection particles flow smoothly through all frames (L-to-R, continuous). No gaps. Shield icon glows on envelope. Label "1 Frame TX: atomic." The contrast with BEFORE is immediate: smooth green flow vs. chaotic red gap. |
| 8-10s | Both sections hold for comparison. BEFORE: broken, with attacker. AFTER: seamless, with shield. Label "No gap = no front-running." Hold. Reset. |

### instancedMesh Usage

- Danger particles (gap): 16 instances, sphereGeometry
- Green connection particles (after): 12 instances, sphereGeometry

### Html Labels

| Text | Position | When visible |
|------|----------|-------------|
| "BEFORE: 2 TXs" | above before section | Always |
| "AFTER: 1 Frame TX" | above after section | Always |
| "Vulnerability gap" | above red zone | 0-5s |
| "Front-run!" | at attacker arrow | 2-5s |
| "Atomic: no gap" | below envelope | 5-10s |

### Legend Items

- Red square: "Vulnerability gap (attackable)"
- Blue square: "Transaction / Frame"
- Green square: "Atomic execution (safe)"
- Purple square: "Validation frame"

---

## Implementation Notes

### File Structure

```
frontend/components/learn/diagrams/eip8141/
  NormalVsFrame3D.tsx        (Scene 1 -- NEW)
  FrameOverview3D.tsx        (Scene 2 -- MERGED from 1+2)
  MultisigAuth3D.tsx         (Scene 3 -- KEPT, polished)
  AccountDeploy3D.tsx        (Scene 4 -- KEPT, trimmed)
  PaymasterFlow3D.tsx        (Scene 5 -- SIMPLIFIED)
  ZKPrivacy3D.tsx            (Scene 6 -- REDESIGNED)
  FOCILGuard3D.tsx           (Scene 7 -- STRIPPED)
  AtomicBatch3D.tsx          (Scene 8 -- REPLACES FullStack3D)
  shared/
    ContextDisposer.tsx      (reuse from scaling/)
```

### Shared Imports (every scene)

```tsx
'use client'
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'
```

### Pattern: Animation Loop

Every animated component follows this pattern (from ParallelVerification3D):

```tsx
function AnimatedThing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    // animate using t, never call setState
    ref.current.position.x = Math.sin(t) * 2
  })

  return <mesh ref={ref}>...</mesh>
}
```

### Pattern: instancedMesh Particles

```tsx
function Particles({ count = 30, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const p = ((t * speed + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.scale.setScalar(0.01)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
    </instancedMesh>
  )
}
```

### Pattern: SceneContainer Wrapper

```tsx
export function SceneName3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="..."
      srDescription="..."
      legend={<Legend />}
      fallbackText="..."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [...], fov: N }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          {/* scene components */}
          <OrbitControls
            enableZoom minDistance={3} maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8} maxAzimuthAngle={Math.PI / 8}
            autoRotate={!reducedMotion} autoRotateSpeed={0.4}
            enableDamping dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
```

### Build Order (recommended)

1. Scene 1: NormalVsFrame3D -- most important, sets the foundation for everything
2. Scene 3: MultisigAuth3D -- highest engagement, the showcase (already strongest)
3. Scene 2: FrameOverview3D -- foundational mechanics, referenced by everything
4. Scene 5: PaymasterFlow3D -- high impact, relatable concept
5. Scene 8: AtomicBatch3D -- strong closer, emotionally resonant
6. Scene 4: AccountDeploy3D -- "building a house" metaphor
7. Scene 6: ZKPrivacy3D -- visually dramatic
8. Scene 7: FOCILGuard3D -- infrastructure, can be last

### Total Animated Objects Across All 8 Scenes

| Scene | Objects | Loop |
|-------|---------|------|
| 1. NormalVsFrame3D | ~40 | 8s |
| 2. FrameOverview3D | ~40 | 10s |
| 3. MultisigAuth3D | ~80 | 10s |
| 4. AccountDeploy3D | ~58 | 10s |
| 5. PaymasterFlow3D | ~55 | 10s |
| 6. ZKPrivacy3D | ~75 | 10s |
| 7. FOCILGuard3D | ~55 | 10s |
| 8. AtomicBatch3D | ~45 | 10s |
| **TOTAL** | **~448** | -- |

**Previous total: ~940 objects across 10 scenes.**
**New total: ~448 objects across 8 scenes. 52% reduction.**

Max simultaneous labels per scene: 5 (enforced).
Max loop length: 10s (enforced, except Scene 1 at 8s).
No conveyor belt metaphors (eliminated NonceLanes and ValidationPipeline).
Key insight lands in first 5 seconds (enforced for all scenes).
