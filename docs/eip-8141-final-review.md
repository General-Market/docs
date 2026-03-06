# EIP-8141 3D Scenes -- Final Implementation Gate Review

**Reviewer:** Cynical gate reviewer (implementation-blocking issues only)
**Source docs reviewed:**
- `eip-8141-3d-proposals.md` -- the 8 revised scene proposals
- `eip-8141-3d-review.md` -- previous review
- `eip-8141-visual-diagrams.md` -- 2D source of truth for protocol accuracy
- `ParallelVerification3D.tsx` -- reference implementation

**Verdict criteria:** Only flagging issues that cause (1) technical inaccuracy, (2) visual confusion, (3) performance problems, or (4) R3F impossibility.

---

## Review Status: Previous Review Fixes

The previous review requested 7 structural changes. Checking each:

| Fix requested | Applied? |
|---|---|
| Add NormalVsFrame comparison scene | Yes -- Scene 1 |
| Merge FrameExecution + FrameAnatomy | Yes -- Scene 2 (FrameOverview3D) |
| Kill ValidationPipeline (conveyor clone) | Yes -- removed |
| Kill NonceLanes (conveyor clone) | Yes -- removed |
| Replace FullStack kitchen sink with AtomicBatch | Yes -- Scene 8 |
| Simplify ZKPrivacy (60->25 crowd, remove Merkle layers) | Yes -- 25 instances, opaque pool |
| Strip FOCILGuard committee internals | Yes -- simplified to shield metaphor |
| Enforce max 5 labels, max 10s loops | Yes -- all scenes comply |
| Rename ecrecover to plain English | Yes -- "Signature verified: Alice/Bob" |

All previous review fixes have been applied. No regressions.

---

## Scene-by-Scene Verdicts

### Scene 1: NormalVsFrame3D -- PASS

No blocking issues.

- Protocol accuracy: Normal TX (1 sender, 1 sig, 1 action) vs Frame TX (N frames, no sig in envelope, ACCEPT inside) matches Diagram 0 and Diagram 2 exactly.
- The ACCEPT gate between F0 and F1 correctly shows auth happening inside the TX, not outside.
- 40 objects, 8s loop. Comfortable budget.
- Side-by-side comparison lands in the first 2 seconds. 3-second test passes.

### Scene 2: FrameOverview3D -- PASS WITH NOTES

No blocking issues. Two things to watch:

1. **CALLDATAREAD direction.** The proposal says the amber arc goes "F0->F1" and the timeline says it appears at 4.5-6.5s after the cube passes the gate. Per Diagram 0 and Diagram 4, CALLDATAREAD is called BY Frame 0 TO READ Frame 1's calldata. The arc should originate at F0 and point toward F1 (reading direction), or more precisely, data flows FROM F1 back TO F0. The proposal's arc direction (F0 to F1) could be read as "F0 sends data to F1" which is backwards. **Implementation note:** Make the amber spark particles flow FROM F1 TOWARD F0 (data being read), while the tube itself just connects the two. Or label it "reads Frame 1" to disambiguate.

2. **Timing of CALLDATAREAD.** It appears at 4.5-6.5s, AFTER the cube passes the ACCEPT gate. In the actual protocol, CALLDATAREAD happens BEFORE ACCEPT (Frame 0 reads Frame 1's calldata during validation, then calls ACCEPT). The scene shows it after, which is temporally wrong. **Implementation note:** Move CALLDATAREAD arc to 1.5-3s (while the cube is still in the untrusted zone). This matches the actual execution order: Frame 0 reads calldata, verifies, then calls ACCEPT.

### Scene 3: MultisigAuth3D -- PASS

No blocking issues.

- Protocol flow matches Diagram 4 exactly: Alice+Bob sign off-chain, sigs go to validator, validator does CALLDATAREAD on Frame 1, verifies sigs via ecrecover, calls ACCEPT, then Frame 1 executes USDC transfer.
- The CALLDATAREAD arc from Frame 1 calldata cube back to the vault correctly shows the vault reading what Frame 1 will do before approving.
- 80 objects is the highest of the 8 scenes but within the 120 hard max.
- 10s loop. Strongest scene. Ship it.

### Scene 4: AccountDeploy3D -- PASS WITH NOTES

No blocking issues. One thing to watch:

1. **Frame ordering matters.** The proposal labels Frame 0 = Deploy, Frame 1 = Validate + ACCEPT, Frame 2 = Execute. This matches Diagram 5 exactly (deploy first so the wallet exists, then validate against the just-deployed wallet, then execute). The previous review suggested removing cross-chain ghosts, which was done. Good.

2. **The "Funds waiting" detail is important.** Pre-funded coins at the empty plot is the key visual proof that addresses are deterministic. Make sure the coins are visible BEFORE the deploy beam fires (0-1.5s). The proposal does this correctly.

### Scene 5: PaymasterFlow3D -- PASS WITH NOTES

No blocking issues. Two things to watch:

1. **Simplified flow vs actual 4-frame flow.** Diagram 6 shows 4 frames (validate+ACCEPT, approve RAI, send USDC, collect RAI). The 3D proposal simplifies to 3 visual beats (show holdings, paymaster checks+pays gas, RAI fee collected). The USDC-to-recipient sub-flow was intentionally removed per review. This is a correct simplification for visual clarity -- the USDC transfer is not the point of this scene, gas abstraction is.

2. **Who calls ACCEPT.** In Diagram 6, the PAYMASTER calls ACCEPT with `sender=0xUser, gas_payer=0xPaymaster`. The scene shows the ACCEPT ring at the paymaster node, which is correct. Make sure the implementer does NOT show ACCEPT at the user node.

3. **CALLDATAREAD direction.** The arc goes "from paymaster to user." Per Diagram 6, the paymaster reads the user's frames' calldata via CALLDATAREAD. The data flows FROM user's frames TO the paymaster. So the arc direction (paymaster to user) could be confusing -- it looks like the paymaster is sending something to the user. **Implementation note:** Same fix as Scene 2. Make spark particles flow from user toward paymaster (data being read), or label the arc "reads user's intent."

### Scene 6: ZKPrivacy3D -- PASS WITH NOTES

No blocking issues. Two things to watch:

1. **Who calls ACCEPT.** In Diagram 7, `ACCEPT(sender=0xZKPaymaster, gas_payer=0xZKPaymaster)` -- the ZK paymaster is BOTH sender and gas payer. The scene shows a "Privacy Pool" with an ACCEPT label at the pool (6-8s). This is slightly misleading: ACCEPT is called by the ZK paymaster contract, not the privacy pool itself. They are different contracts. **Implementation note:** The pool and paymaster can be the same visual node for simplicity, but if they are separate, ACCEPT should be at the paymaster, not the pool.

2. **"No link" is the correct punchline.** Leading with the broken line is the right call. The depositor fading into the pool, then a proof emerging from the pool (not from the depositor) is technically accurate -- the proof proves membership without revealing which deposit. Good.

### Scene 7: FOCILGuard3D -- PASS WITH NOTES

No blocking issues. One thing to watch:

1. **FOCIL is NOT part of EIP-8141.** Diagram 10 explicitly states: "FOCIL is NOT part of EIP-8141. It is a separate proposal." The scene should not visually imply FOCIL is part of 8141. The proposal correctly presents it as "with FOCIL / without FOCIL" comparison, not as an 8141 feature. **Implementation note:** If the article text does not already clarify this, the scene itself does not need to -- but do NOT label the shield "EIP-8141" or similar. "FOCIL" is the correct label.

2. **Blue cubes = Frame TXs, gray cubes = EOA.** The proposal correctly distinguishes them. The left side censors blue (Frame TXs) and passes gray (EOA), which matches the Diagram 10 narrative: builders ignore complex Frame TXs. The right side passes all. This is accurate.

### Scene 8: AtomicBatch3D -- PASS

No blocking issues.

- The before/after comparison (2 TXs with vulnerability gap vs 1 Frame TX atomic) is the cleanest visual in the set.
- The attacker arrow dropping into the gap is emotionally effective and technically accurate (front-running/sandwich attacks exploit the gap between approve and swap).
- The AFTER section correctly shows 3 frames (validate, approve, swap) inside one envelope. This matches how a real approve+swap would be structured as a Frame TX.
- 45 objects. Comfortable budget.
- The "no gap = no front-running" label is accurate. Frame TX atomicity guarantees all frames execute in one transaction with no interleaving.

---

## Cross-Cutting Answers

### 1. Is the scroll story coherent?

**Yes.** The progression is:

1. NormalVsFrame -- "What is different?" (comparison, the hook)
2. FrameOverview -- "How does it work?" (mechanics)
3. MultisigAuth -- "Showcase: real use case" (strongest scene)
4. AccountDeploy -- "Showcase: new wallets"
5. PaymasterFlow -- "Showcase: gas in any token"
6. ZKPrivacy -- "Showcase: privacy"
7. FOCILGuard -- "Safety: anti-censorship"
8. AtomicBatch -- "Closer: atomic safety"

This follows the pattern: introduce -> explain -> demonstrate (4 use cases) -> safety net -> emotional close. Scene 7 (FOCIL) between ZKPrivacy and AtomicBatch works because FOCIL addresses a natural concern ("what if builders ignore all this?") before the closer resolves on a positive note ("and your operations are atomic").

No coherence issues.

### 2. Is the total object budget (~448) acceptable?

**Yes.** With 8 scenes and IntersectionObserver mount/unmount:

- Only 2-3 scenes render simultaneously (viewport + 1 above + 1 below).
- Worst case simultaneous: MultisigAuth (80) + ZKPrivacy (75) + one neighbor (~55) = ~210 animated objects across 3 WebGL contexts. This is well within budget.
- No single scene exceeds 80 objects. The 120 hard max is never approached.
- Total page weight: 8 scenes with dynamic imports is fine. Each scene is ~300-500 lines. Bundle splitting via `next/dynamic` keeps initial load clean.

One note: **448 total is a document-level number, not a runtime number.** At any moment, the GPU handles at most ~210 objects. This is comfortable for mobile.

### 3. R3F / Three.js implementation gotchas

**The implementer should know:**

1. **QuadBezier tubes for CALLDATAREAD arcs.** `TubeGeometry` with a `QuadraticBezierCurve3` works in Three.js, but the tube's `radius` must be set at creation time (not animatable without recreating geometry). If the arc needs to animate in (grow from one end), use a custom approach: create the full tube geometry and animate a `drawRange` or use a `ShaderMaterial` with a uniform controlling visible length. `drawRange` is simpler and works with `TubeGeometry`.

2. **Color transitions (red to green on cube at ACCEPT gate).** Do NOT use `new THREE.Color().lerp()` in `useFrame` directly on a shared material. Each animated cube needs its OWN material instance. If using `<meshStandardMaterial>` as a JSX child, R3F creates a new material per mesh by default, so this is fine. But if materials are shared via `useMemo`, the lerp will affect all meshes using that material.

3. **Html labels inside Canvas.** `@react-three/drei`'s `<Html>` creates a DOM overlay positioned via CSS transforms matching the 3D position. On iOS Safari, too many `<Html>` elements (>5-6 simultaneously visible) cause compositing layer explosions and jank. The 5-label max is correct and should be strictly enforced. Hide labels by unmounting the `<Html>` component (not just `opacity: 0`), so the DOM node is removed entirely.

4. **instancedMesh + useFrame pattern.** The proposals use `Object3D.updateMatrix()` + `setMatrixAt()` in useFrame. This is the correct pattern. One gotcha: call `ref.current.instanceMatrix.needsUpdate = true` EVERY frame, not conditionally. Missing this causes stale particle positions on some frames.

5. **TorusGeometry for ACCEPT flash rings.** The expanding ring animation (scale 0 -> 1 -> fade) works fine with `scale.setScalar()` in useFrame. Use `meshBasicMaterial` (not Standard) for emissive effects -- Basic ignores lighting, so the ring will glow consistently regardless of scene light angles.

6. **Wireframe boxes for envelopes.** `meshBasicMaterial` with `wireframe={true}` works but renders triangle edges (diagonals visible on faces). For a cleaner box wireframe (edges only), use `<lineSegments>` with `<edgesGeometry>` wrapping a `<boxGeometry>`. This is a minor visual quality improvement.

7. **ContextDisposer timing.** The `ContextDisposer` pattern from the scaling scenes disposes GPU resources when the Canvas unmounts. With 8 scenes and fast scrolling, mount/unmount churn can cause brief white flashes as WebGL contexts are created. Consider a small delay before unmounting (e.g., `rootMargin: '200px'` on the IntersectionObserver) to keep scenes alive slightly longer than the viewport. The existing `SceneContainer` may already handle this.

---

## Summary

| Scene | Verdict |
|---|---|
| 1. NormalVsFrame3D | PASS |
| 2. FrameOverview3D | PASS WITH NOTES (fix CALLDATAREAD timing + direction) |
| 3. MultisigAuth3D | PASS |
| 4. AccountDeploy3D | PASS WITH NOTES (ensure coins visible before deploy) |
| 5. PaymasterFlow3D | PASS WITH NOTES (CALLDATAREAD direction, ACCEPT at paymaster) |
| 6. ZKPrivacy3D | PASS WITH NOTES (ACCEPT is at ZK paymaster, not pool) |
| 7. FOCILGuard3D | PASS WITH NOTES (FOCIL is separate from 8141) |
| 8. AtomicBatch3D | PASS |

**No FAIL verdicts. All 8 scenes are cleared for implementation.**

The two most important implementation-time fixes:

1. **Scene 2 (FrameOverview3D): Move CALLDATAREAD to BEFORE the ACCEPT gate** (1.5-3s, not 4.5-6.5s). This is a protocol accuracy issue -- CALLDATAREAD happens during validation, before ACCEPT commits.

2. **Scenes 2, 5: CALLDATAREAD arc particle direction.** Spark particles should flow FROM the frame being read TOWARD the reader (data flows to the caller). The proposals have the arc connecting the right nodes but the visual direction of flow is ambiguous or reversed.

Everything else is implementation-ready.
