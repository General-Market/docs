# EIP-8141 Visual Master Plan

## Article Inventory — Every Section, Every Visual

### 1. Opening — `<StatsOverview />`
**Status**: CSS stat cards ✓
**Numbers**: 10 years | 1 primitive | N frames | 0 intermediaries
**Quality**: Good. Keep.

---

### 2. The Timeline — `<EIPTimeline />`
**Status**: CSS only. **NEEDS 3D.**
**Proposal**: 3D timeline on a curved path. Each EIP is a pillar/monolith rising from a white ground plane. Heights increase over time. The final pillar (EIP-8141) glows green and is tallest. Particles flow along the timeline curve connecting pillars. Year labels float above each pillar.
- Pillars: 6 total (EIP-86, EIP-2938, ERC-4337, EIP-3074, EIP-7702, EIP-8141)
- Color gradient: grey → grey → grey → grey → grey → emerald
- Auto-rotate orbit controls
- Ground: white with subtle grid lines

---

### 3. Core Concept — `<FrameTransactionScene />`
**Status**: 3D horizontal pipeline ✓
**Improvements needed**:
- Ground should be WHITE (currently #f8f8f8 which is fine, but add subtle grid/step details)
- Add small 3D "steps" / raised platforms under each frame box
- Calldata ribbon more visible — thicker, more particles

---

### 4. Use Case 1 — `<FlowNormalTx />` + `<FlowAtomicOps />`
**Status**: CSS flow boxes ✓
**No change needed** — these are lightweight inline flows, intentionally 2D.

---

### 5. Use Case 2 — `<FlowNewAccount />`
**Status**: CSS flow ✓
**No change needed.**

---

### 6. Use Case 3 — `<PaymasterFlow />`
**Status**: 3D U-shaped flow ✓
**Improvements**:
- Add ground steps/risers under boxes
- Token animation (coin model moving from user → paymaster)

---

### 7. Use Case 4 — `<FlowPrivacyZK />` + `<PrivacyDiagram />`
**Status**: CSS flow + 3D before/after ✓
**PrivacyDiagram improvements**:
- Person models are good
- Broadcaster antenna with pulsing rings is good
- Mempool pool model is good
- Blockchain model NEEDS TO BE BIGGER — looping chain animation
- Add crowd of tiny users in background on the AFTER side sending tx particles

---

### 8. Mempool Safety — `<MempoolLayers />`
**Status**: 3D terraced layers ✓ BUT models need work
**Critical changes**:
1. **Smart Wallet** — Wallet model: rounded box with a key slot / shield icon on front
2. **dApp** — App/screen model: flat rectangle standing upright like a phone/monitor
3. **Privacy TX** — Lock model: padlock shape (torus + box body)
4. **Blockchain model** — MUCH BIGGER. Looping animation: new blocks continuously appearing on one end, chain extending. At least 6-8 blocks visible.
5. **Crowd of users** — 15-20 tiny person models scattered OUTSIDE the scene perimeter, randomly sending tx particles (small cubes) toward the mempool pool. Staggered timing so there's always activity.
6. **Ground**: White with subtle step/riser details under each terrace

---

### 9. FOCIL + AA — `<FOCILComparison />`
**Status**: CSS before/after card ✓
**No change needed** — intentionally 2D contrast card.

---

### 10. EOA Compatibility — `<EOABenefits />`
**Status**: CSS benefit grid ✓
**No change needed.**

---

### 11. Quantum Resistance — `<QuantumComparison />`
**Status**: CSS before/after card ✓
**No change needed.**

---

### 12. What This Unlocks — `<StatsUnlocked />` + `<BeforeAfterScene />` + `<CapabilityCards />`
**Status**: CSS stats + 3D before/after + CSS grid ✓
**BeforeAfterScene improvements**:
- Ground should be white with subtle steps
- Better contrast between left (chaotic/red) and right (clean/green)

---

### 13. Closing — `<HegotaSummary />`
**Status**: Black CSS banner ✓
**No change needed** — strong closing visual.

---

## 3D Model Specifications

### Person Model (existing, keep)
- Sphere head + cylinder body + disk base
- Colors vary by role

### Wallet Model (NEW — for Smart Wallet)
- Rounded box (1.2 x 0.8 x 0.3) — like a physical wallet
- Small shield icon on front face (extruded triangle/plane)
- Color: blue (#3b82f6)

### Screen Model (NEW — for dApp)
- Thin flat rectangle standing upright (0.8 x 1.0 x 0.05)
- Small stand/base cylinder at bottom
- Subtle glow on the "screen" face (emissive)
- Color: indigo (#6366f1)

### Lock Model (NEW — for Privacy TX)
- Torus (shackle) on top + box (body) below
- Small keyhole plane on front face
- Color: violet (#8b5cf6)

### Blockchain Model (REWRITE — bigger, animated)
- 8 connected blocks (boxes) in a chain
- New blocks spawn on one end, push the chain, old blocks fade out on other end
- Each block connected by a small cylinder link
- Slight rotation on each block (alternating 5deg)
- Scale: ~1.5x current size
- Color: green (#22c55e) for chain, darker for links
- LOOPING animation at ~0.3 speed

### Mempool Pool Model (existing, keep)
- Flat cylinder + torus rim + floating tx cubes inside

### Broadcaster Antenna (existing, keep)
- Tall cylinder tower + cone tip + pulsing torus rings

### Crowd Model (NEW — background users)
- 15-20 very small person models (scale 0.3)
- Positioned in an arc OUTSIDE the main scene boundaries
- Each randomly fires a tx particle (small cube) toward the central mempool every 2-8 seconds (staggered)
- Tx particles travel in arc trajectory then splash into pool
- Very subtle — background activity, not main focus

### Timeline Pillar (NEW — for 3D timeline)
- Rounded box pillar (0.4 x HEIGHT x 0.4)
- Heights: 0.3, 0.4, 0.6, 0.5, 0.7, 1.2 (increasing, 8141 is tallest)
- Top face has year label
- Color: grey for all except EIP-8141 which is emerald
- Connected by a curved tube on the ground

---

## Implementation Assignment

### Agent 1: MempoolLayers rewrite
- Create WalletModel, ScreenModel, LockModel
- Rewrite BlockchainModel with looping chain animation
- Add CrowdUsers component with staggered tx firing
- White ground with subtle step risers under terraces
- File: `MempoolLayers.tsx`

### Agent 2: EIPTimeline3D + ground improvements
- Create `EIPTimeline3D.tsx` — 3D timeline with pillar monoliths
- Update `FrameTransactionScene.tsx` — add ground steps/risers
- Update `PaymasterFlow.tsx` — add ground steps/risers
- Update `BeforeAfterScene.tsx` — add ground steps, improve contrast
- Register EIPTimeline3D in barrel and MDX

### Agent 3: PrivacyDiagram improvements
- Bigger blockchain model with looping animation
- Add crowd users sending tx on After side
- Update `PrivacyDiagram.tsx`
- Verify all scenes render, take screenshots
