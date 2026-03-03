# Visual Explanation Framework for 3D Technical Articles

## How To Use This Document

You are transforming a technical spec (EIP, protocol upgrade, whitepaper) into a complete article with interactive 3D scenes. Follow the **Pipeline** stages in order.

**THE CORE RULE: 3D-first, text-minimal.** Every section of the article is anchored by a 3D scene. Text exists only to bridge between scenes — a few sentences max. The article is a sequence of 3D experiences with minimal prose connectors. If a concept exists in the article, it gets a 3D scene. No exceptions. No text-only sections. No 2D diagrams. No CSS components. No static illustrations.

This applies to ALL content — including historical context, social proof, stakes, and audience calibration. These are not "text sections." They are 3D scenes with a few bridging sentences. The historical timeline is a 3D scene. Social proof is a 3D scene. The transformation promise is a 3D scene. Everything is 3D.

At each stage, consult the **named frameworks** listed. These are real, proven frameworks from communication theory, cognitive science, journalism, and persuasion psychology.

---

## The Pipeline (work through in order)

### Stage 0: Source Analysis & Audience Calibration

**Goal:** Understand the source material and who you're writing for.

**Frameworks:**

| Framework | Author/Origin | What it answers |
|---|---|---|
| **Zone of Proximal Development** | Lev Vygotsky, 1978 | Who are the readers? What do they already know? What's just beyond their current understanding? |
| **Progressive Disclosure** | J.M. Keller (ARCS Model, 1987) / Nielsen Norman Group | How much to show at each level? Minimum first, depth on demand. |
| **Dual Coding Theory** | Allan Paivio, 1971 | 3D scenes are the universal layer (novice to expert). Prose is the depth layer. Novices lean on the scenes; experts lean on the text; both get value. |

**Checklist:**
- [ ] Read the source EIP/spec end-to-end
- [ ] Extract the "one sentence" insight — the thing a 5-year-old could repeat back
- [ ] Define 3 audience tiers and what each needs:

| Tier | What they know | What they need from this article |
|---|---|---|
| Crypto-curious (L1) | "Ethereum exists, gas is a thing" | Analogy-first, zero jargon, "why should I care" |
| DeFi user (L2) | Wallets, swaps, gas fees, MetaMask | How this changes their daily UX |
| Developer (L3) | Solidity, EVM internals, opcodes | Implementation details, new primitives, migration path |

- [ ] Target: article readable at L1-L2, rewarding at L3. L3 details go in `code` blocks, never in the main narrative.
- [ ] List prerequisite concepts. If not common knowledge, teach inline — don't link out.

---

### Stage 0.5: Transformation Promise (Intro & Outro)

**Goal:** The article is a transformation. The reader arrives not understanding X and leaves able to explain Y. Make this contract explicit — visually, in 3D — at the top and bottom.

**Frameworks:**

| Framework | Author/Origin | What it answers |
|---|---|---|
| **ARCS Model** | J.M. Keller, 1987 | **A**ttention (hook the reader) → **R**elevance ("what's in it for YOU") → **C**onfidence ("you can understand this in 5 minutes") → **S**atisfaction ("look what you now know"). The complete "why invest time" loop. |
| **Transformation Promise** | 3Blue1Brown / Ali Abdaal pattern | "Before: you don't know X. After: you can Y." The article IS a transformation. Show the before state, deliver the transformation, confirm the after state. |
| **Cold Open / In Medias Res** | Screenwriting tradition | Show the climax or payoff FIRST, then rewind. YouTube creators do this constantly — "This is what you'll be able to understand..." |

**Structure:**

**Opening 3D scene (Promise):**
- Show the reader's BEFORE state — the problem space they currently live in
- Visually chaotic: the pain, the complexity, the thing that's broken
- Text overlay states the transformation contract: "In 5 minutes, you'll understand why [specific thing] is about to change"
- This scene sets the ARCS "Attention" and "Relevance" — the reader knows what they're getting and why it matters to them

**Closing 3D scene (Payoff):**
- Show the SAME elements from the opening, but now transformed — organized, clean, unified
- Everything the article taught is visible as one coherent system
- Text overlay confirms the transformation: "You now understand [X]. Here's what this means for you."
- This scene delivers ARCS "Satisfaction" — the reader sees their own knowledge gain

**Checklist:**

- [ ] Define the BEFORE state: what does the reader's world look like now? (Broken, complex, painful)
- [ ] Define the AFTER state: what does it look like once they understand? (Clean, unified, powerful)
- [ ] Write the transformation contract: "Before this article: ___. After: ___."
- [ ] The opening scene and closing scene use the SAME visual elements — the transformation is the difference between them
- [ ] The contract must be specific. Not "you'll learn about EIP-8141" but "you'll understand why every Ethereum wallet is about to work differently"

---

### Stage 0.7: Context Layers

**Goal:** The article must answer "why should I care" before "how does it work." Three mandatory context layers.

**Frameworks:**

| Framework | Author/Origin | What it answers |
|---|---|---|
| **SCQA** (Situation-Complication-Question-Answer) | Barbara Minto / McKinsey, 1987 | How to structure the opening. Situation everyone agrees on → Complication (what changed) → Question it raises → Answer (the EIP). |
| **Story Spine** | Kenn Adams, 1991 / Pixar | Historical arc with forward momentum: "Once upon a time... Every day... One day... Because of that... Until finally..." |
| **Nut Graf** | Wall Street Journal editors, 1980s | The single "so what" paragraph that zooms from specific detail to universal significance. |
| **Shift Narrative** | Andy Raskin, 2016 | Frame stakes as an inevitable shift with winners and losers. Not a feature list — evidence the world is changing. |

**Each context layer is a 3D scene, not a text section.** The historical arc is a 3D timeline scene. The stakes are a 3D split-screen (winners/losers) scene. The technical context is a 3D architecture/stack scene. Text exists only as 1-2 bridging sentences between scenes.

**Checklist:**

- [ ] **Historical arc 3D scene** (Story Spine): A 3D timeline showing what came before, what failed, why. Animated progression: "X tried in YEAR → failed → Y tried → failed → Z solves it." The reader SEES the history, not reads it. Run through the 7-Question Checklist (Stages 1-6).
- [ ] **Technical context 3D scene** (SCQA): A 3D stack/architecture scene showing what layer this change affects. Where does this piece fit in the system? What does it replace? What does it depend on? The reader SEES the position in the stack. Run through the 7-Question Checklist.
- [ ] **Stakes 3D scene** (Raskin Shift Narrative): A 3D split/comparison showing winners vs losers of an inevitable shift. What breaks if this doesn't ship? What becomes possible if it does? The reader SEES the diverging futures. Run through the 7-Question Checklist.
- [ ] **Nut graf**: The ONLY text-only element — 1-2 sentences bridging the context scenes to the core insight. Why this article exists right now.

---

### Stage 0.9: Prose Writing Rules

**Goal:** Guide how to write the text between 3D scenes. Every concept is either a 3D scene or a few sentences — the prose must be tight.

**Frameworks:**

| Framework | Author/Origin | What it answers |
|---|---|---|
| **Cognitive Load Theory** | John Sweller, 1988 | Working memory is limited (~7 chunks). One concept per paragraph. No split attention. Consistent terminology — no synonyms for the same thing. |
| **SUCCESs** (Simple, Unexpected, Concrete, Credible, Emotional, Stories) | Chip & Dan Heath, *Made to Stick*, 2007 | Open a knowledge gap before filling it. Use concrete examples, not abstractions. The "Unexpected" principle: create curiosity, then resolve it. |
| **Explanation-First Design** | Shan Carter & Michael Nielsen / Distill.pub, 2017 | Start from the reader's existing mental model. Never start from the formal definition. Build outward from what they already know. |

**Rules:**

1. **Analogy before acronym** (Explanation-First). Never introduce a technical term without first explaining what it does in plain language. Bad: "CALLDATAREAD lets Frame 0 inspect Frame 1's calldata." Good: "Before the bouncer lets you in, he reads your guest list entry. That's CALLDATAREAD."
2. **One concept per paragraph** (Cognitive Load Theory). If a paragraph explains two things, split it.
3. **Open gaps before filling them** (SUCCESs: Unexpected). "Here's the weird thing about Ethereum transactions..." before explaining what Frame TXs fix.
4. **Concrete over abstract** (SUCCESs: Concrete). "You hold RAI but need ETH" not "Users with alternative token holdings require native currency."
5. **Every section ends with implication** (SUCCESs: resolve the gap). "This means X" or "Without this, Y."
6. **Active voice.** "The paymaster pays gas" not "Gas is paid by the paymaster."
7. **Progressive complexity** (Progressive Disclosure). Each section can be more technical than the previous. Never regress.

---

### Stage 1: Concept Decomposition

**Goal:** Identify what the reader needs to learn. Classify each concept. Decide: 3D scene or prose.

**Frameworks:** Munzner's What-Why-How

- List all atomic concepts in the article
- For each: What data does the reader see? Why do they need it? How will you show it? (Munzner)
- Classify each as: spatial, temporal, causal, comparative, or quantitative
- **Default: every concept is a 3D scene.** A concept gets demoted to prose ONLY if:
  - It has NO spatial, temporal, causal, or comparative structure at all
  - It is pure metadata (dates, names, links) with no relational meaning
  - Even then: 1-3 sentences max. If you're writing more than 3 sentences, it should be a 3D scene.
- Every 3D scene must pass the Tufte test: the scene carries data, not decoration.

---

### Stage 2: Metaphor Selection

**Goal:** Find a physical experience the reader already understands that maps to the abstract concept.

**Frameworks:** Lakoff/Johnson's Conceptual Metaphor, Tversky's Correspondence

- The metaphor must share STRUCTURAL properties with the concept (Lakoff/Johnson)
- The form of the visual MUST match the form of the concept (Tversky's Correspondence):
  - Temporal concept → timeline/sequence visual
  - Comparative concept → side-by-side visual
  - Causal concept → cause-then-effect visual
  - Spatial concept → spatial layout visual
- Test: list 3+ structural properties of your metaphor. Do they map 1:1 to the concept's properties? If not, find a better metaphor.

---

### Stage 3: Visual Encoding

**Goal:** Map each meaningful distinction to exactly ONE visual property.

**Frameworks:** Bertin's 7 Visual Variables, Tufte's Data-Ink Ratio

- Bertin's 7 Visual Variables: position, size, shape, value (lightness), color (hue), orientation, texture
- RULE: Each variable carries ONE meaning across ALL scenes. Do not overload.
- Create a global encoding table BEFORE designing individual scenes
- Example: if color = trust state, then blue always means the same thing in every scene

---

### Stage 4: Scene Composition

**Goal:** Arrange elements, define animation timeline, choose transitions.

**Frameworks:** McCloud's 6 Transitions

- McCloud's 6 Transitions: moment-to-moment, action-to-action, subject-to-subject, scene-to-scene, aspect-to-aspect, non-sequitur
- Choose the transition type that matches how the reader's attention moves
- Define the animation timeline with specific second markers
- Camera position and orbit constraints

---

### Stage 5: Interaction Design

**Goal:** Define what the reader can DO.

**Frameworks:** Bruner's Modes of Representation, Bret Victor, Distill.pub

- Bruner: enactive (do) → iconic (see) → symbolic (name). Enactive first.
- Victor: small parts first, then combine. Direct manipulation. Integrated with prose.
- Distill's 5 affordances: connect, play, reflect, personalize, reduce cognitive load
- Not everything needs to be interactive — only add interaction when it improves comprehension

---

### Stage 6: Editing Pass

**Goal:** Cut everything that doesn't serve comprehension.

**Frameworks:** Mayer's Multimedia Principles, Tufte's Data-Ink Ratio

- Mayer's Coherence: cut irrelevant visuals/sounds
- Mayer's Signaling: guide attention to what matters at each moment
- Mayer's Segmenting: break into user-paced steps
- Mayer's Spatial Contiguity: labels next to what they describe
- Tufte: maximize data-ink ratio, kill chartjunk (particles, gradients, decorations that carry no data)
- Hard limits: max 5 simultaneous labels, 8-10s animation loops, max 120 objects per scene

---

### Stage 7: Social Proof & Desire Signals

**Goal:** Establish that real people care about this. The article must prove demand, not just explain mechanics.

**This is a 3D scene, not a text section.** Social proof is visualized — a 3D scene showing adoption, authority, community momentum. Numbers, names, and evidence rendered as 3D objects the reader can see and interact with. Text exists only as 1-2 bridging sentences before/after the scene.

**Frameworks:**

| Framework | Author/Origin | What it answers |
|---|---|---|
| **Principles of Persuasion** (Social Proof, Authority, Unity) | Robert Cialdini, *Influence*, 1984 | People follow similar others. People defer to credible experts. People trust their in-group. |
| **Ethos-Logos-Pathos** | Aristotle, *Rhetoric* (~4th c. BC); Jay Heinrichs, *Thank You for Arguing*, 2007 | Sequence: credibility first (who proposed this), then argument (how it works), then emotion (what it means for you). |
| **Shift Narrative** (evidence step) | Andy Raskin, 2016 | Frame proof as evidence of an inevitable shift, not testimonials. "TVL grew from $0 to $X" is proof of a shift. "Customer says we're great" is a testimonial. |

**Checklist (all visualized in the 3D scene):**

- [ ] **Authority** (Cialdini + Ethos): Who proposed this? What's their track record? Visualize as 3D entities — author avatars, institutional logos, contribution graphs. The reader SEES credibility, not reads it.
- [ ] **Social proof from similar others** (Cialdini): Community reaction — upvotes, thread engagement, conference mentions. Visualize as 3D counters, rising bars, network graphs. Who's already building on it? Show their logos/names as 3D objects.
- [ ] **Scale** (Raskin): How many people/protocols are affected? Visualize the number — not "500M users" as text, but 500M as a 3D mass or scale comparison. The reader SEES the magnitude.
- [ ] **Shift evidence** (Raskin): Adoption metrics, wallet integrations, governance votes. Visualize as an animated timeline or growth curve in 3D. Evidence the shift is happening.
- [ ] **Unity** (Cialdini): Position the reader as part of the movement. The 3D scene should make the reader feel they're looking at something they belong to.
- [ ] Run the 3D scene through the 7-Question Checklist (Stages 1-6).

---

### Stage 8: Article Structure & Quality Gate

**Goal:** Final completeness check. Does the article have everything?

**Required sections (in order):**

| # | Section | Type | Framework | Purpose |
|---|---|---|---|---|
| 1 | **3D Promise scene** (intro) | 3D SCENE | Transformation Promise (3Blue1Brown) + ARCS: Attention + Relevance (Keller) | Show the BEFORE state. State the transformation contract. |
| 2 | Key takeaways (TLDR) | TEXT (only exception) | Progressive Disclosure (Keller/NNG) | Let skimmers get the point in 10 seconds |
| 3 | **3D Historical context scene** | 3D SCENE | Story Spine (Adams/Pixar) | What came before, what failed, why this time is different — as animated 3D timeline |
| 4 | The core insight | PROSE BRIDGE | SUCCESs: Simple (Heath & Heath) | The "one sentence" — 1-2 sentences max bridging context to how-it-works |
| 5 | How it works (multiple scenes) | 3D SCENES | Cognitive Load (Sweller) + Stages 1-6 | One concept per 3D scene, minimal prose bridges between |
| 6 | Use cases / demonstrations | 3D SCENES | SUCCESs: Concrete (Heath & Heath) | What you can actually DO — each use case is a 3D scene |
| 7 | Safety / guarantees | PROSE BRIDGE | Ethos + Logos (Aristotle) | 1-3 sentences — trust signals woven into scene captions, not standalone |
| 8 | **3D Social proof scene** | 3D SCENE | Cialdini + Raskin | Who cares, who's building — visualized as 3D adoption/authority scene |
| 9 | **3D Payoff scene** (outro) | 3D SCENE | Transformation Promise + ARCS: Satisfaction (Keller) | Show the AFTER state — same elements as intro, now transformed |
| 10 | Sources + Further Reading | TEXT (only exception) | Authority (Cialdini) | Verifiable links to primary sources |

**Quality gate — answer ALL before publishing:**

- [ ] Does the opening 3D scene state a specific transformation contract? (Transformation Promise)
- [ ] Does the closing 3D scene use the SAME visual elements as the opening, but transformed? (ARCS: Satisfaction)
- [ ] Is the historical context a **3D scene**, not a text section? (Story Spine + 3D-first rule)
- [ ] Is the social proof a **3D scene**, not a text section? (Cialdini + 3D-first rule)
- [ ] Are the stakes visualized in a **3D scene** (winners/losers)? (Raskin + 3D-first rule)
- [ ] Does a crypto-curious reader (L1) understand the "one sentence" insight from SCENES alone? (Vygotsky ZPD + Dual Coding)
- [ ] Does a DeFi user (L2) know what changes for them? (Progressive Disclosure)
- [ ] Does a developer (L3) know the new primitives? (Dual Coding)
- [ ] Does every 3D scene pass the 7-Question Checklist? (Stages 1-6)
- [ ] Are there ZERO text-only sections? (Only TLDR and Sources are text. Everything else is 3D scene + prose bridge.)
- [ ] Does every paragraph explain one concept only? (Cognitive Load Theory)
- [ ] Does every technical term get an analogy first? (Explanation-First Design)

---

## The 7-Question Checklist (run for EVERY 3D scene)

| # | Question | Framework | What it produces |
|---|----------|-----------|-----------------|
| 1 | What's the ONE concept this scene explains? | Munzner | Single sentence |
| 2 | Is this concept spatial, temporal, causal, or comparative? | Tversky | Concept type → visual form |
| 3 | What physical experience maps to it? | Lakoff/Johnson | Metaphor with structural property match |
| 4 | What should the reader be able to DO? | Bruner | Interaction spec |
| 5 | What visual properties carry meaning? | Bertin | Encoding table per scene |
| 6 | What transitions between states? | McCloud | Transition type + pacing |
| 7 | What can be removed? | Tufte + Mayer | Cut list |

---

## Principle Reference Card

### Source Analysis & Audience
- **Vygotsky's Zone of Proximal Development** (1978): Effective instruction targets just beyond the learner's current understanding. Different readers have different zones — stack layers so each finds their level.
- **Paivio's Dual Coding** (1971): Humans process verbal and visual information through independent channels. Information in both channels is retained far better. 3D scenes = universal layer; prose = depth layer.
- **Keller's Progressive Disclosure** (1987): Show the minimum first, reveal complexity on demand. Readers self-select their depth.

### Transformation Promise
- **Keller's ARCS Model** (1987): Attention → Relevance → Confidence → Satisfaction. The complete "why invest time reading this" loop. Opening scene = Attention + Relevance. Closing scene = Satisfaction.
- **Transformation Promise** (3Blue1Brown / Ali Abdaal pattern): "Before: you don't know X. After: you can Y." The article is a transformation. Show the before state visually, deliver the transformation through scenes + prose, confirm the after state visually.
- **Cold Open / In Medias Res** (screenwriting tradition): Show the payoff first, then rewind. The reader sees what they'll gain before investing time.

### Context & Narrative
- **Minto's SCQA** (1987): Situation → Complication → Question → Answer. The standard structure for explaining a new development to a mixed audience. Experts skim the Situation; newcomers ground themselves in it.
- **Adams' Story Spine** (1991/Pixar): Status quo → inciting event → cascading consequences → resolution. Creates forward momentum — readers keep reading to see what happens next.
- **WSJ Nut Graf** (1980s): Specific scene → "so what" paragraph → evidence → return. The "so what" paragraph zooms from detail to universal significance.
- **Raskin's Shift Narrative** (2016): Name an undeniable shift → show winners and losers → tease the promised land → show features as proof of path → present evidence of delivery.

### Prose Clarity
- **Sweller's Cognitive Load Theory** (1988): Working memory holds ~7 chunks. One concept per paragraph. Consistent terminology. No split attention.
- **Heath & Heath's SUCCESs** (2007): Simple, Unexpected, Concrete, Credible, Emotional, Stories. Open knowledge gaps before filling them. Concrete examples over abstractions.
- **Carter & Nielsen's Explanation-First Design** (2017): Start from the reader's existing mental model. Never start from the formal definition. Build outward.

### Metaphor & Encoding
- **Tversky's Correspondence**: Form of visual must match form of concept.
- **Lakoff/Johnson's Conceptual Metaphor**: Abstract concepts understood through physical/spatial experience. Structural properties must match.
- **Bertin's 7 Variables**: position, size, shape, value, color, orientation, texture. One variable = one meaning.
- **Tufte's Data-Ink**: every pixel must represent data. Eliminate chartjunk.

### Pacing & Interaction
- **McCloud's 6 Transitions**: moment-to-moment, action-to-action, subject-to-subject, scene-to-scene, aspect-to-aspect, non-sequitur
- **Mayer's Segmenting**: break complex processes into user-paced steps
- **Mayer's Signaling**: use highlights, color to guide attention
- **Bruner's Modes**: enactive (do) → iconic (see) → symbolic (name). Enactive first.
- **Bret Victor**: small parts first, then combine. Direct manipulation. Integrated with prose.
- **Distill's 5 Affordances**: connect, play, reflect, personalize, reduce cognitive load

### Editing
- **Mayer's Coherence**: cut irrelevant words, images, sounds
- **Mayer's Spatial Contiguity**: labels next to what they describe
- **Tufte's Chartjunk**: if it doesn't encode data, it's noise

### Social Proof & Persuasion
- **Cialdini's Principles** (1984): Social Proof (people follow similar others), Authority (defer to experts), Unity (trust in-group). Social proof from *similar others* is stronger than raw numbers.
- **Aristotle's Ethos-Logos-Pathos**: Credibility first, then argument, then emotion. If the reader doesn't trust the source, logic and emotion are wasted.
- **Raskin's Shift Narrative** (2016): Frame proof as evidence of an inevitable shift. "TVL grew from $0 to $X" is shift evidence. "Customer says it's great" is a testimonial. Shift framing triggers loss aversion.

---

## Codebase Patterns (for implementation)

All scenes use this stack:
- `'use client'` directive
- React Three Fiber (`@react-three/fiber`): `Canvas`, `useFrame`
- Drei (`@react-three/drei`): `Html`, `OrbitControls`, `RoundedBox`
- THREE.js: `THREE.Color`, `THREE.Vector3`, `THREE.TubeGeometry`, `THREE.QuadraticBezierCurve3`, `THREE.InstancedMesh`
- `SceneContainer` wrapper from `../scaling/SceneContainer` — handles WebGL detection, IntersectionObserver mount/unmount, context loss recovery, reduced motion, legend, a11y
- `ContextDisposer` from `../scaling/shared/ContextDisposer` — releases WebGL context on unmount
- Dynamic imports in `index.tsx` with `next/dynamic`, `ssr: false`

### SceneContainer API
```tsx
<SceneContainer
  height="h-[340px] md:h-[400px]"
  ariaLabel="Description of the scene for screen readers"
  srDescription="Detailed screen reader description"
  legend={<Legend />}
  fallbackText="Fallback text when WebGL unavailable"
>
  {({ reducedMotion }) => (
    <Canvas flat camera={{ position: [0, 5, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ContextDisposer />
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-3, 6, -2]} intensity={0.3} />
      {/* Scene content */}
      <OrbitControls enableZoom minDistance={3} maxDistance={18} enablePan={false} />
    </Canvas>
  )}
</SceneContainer>
```

### Animation Pattern
```tsx
const CYCLE = 10 // seconds
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function AnimatedElement({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Animation logic using cycleT (0-1)
  })
  return <group ref={ref}>{/* content */}</group>
}
```

### Global Color Encoding
| Color | Hex | Meaning |
|-------|-----|---------|
| Purple | #8b5cf6 | Validation / pre-ACCEPT |
| Green | #22c55e | Committed / trusted / execution |
| Amber | #f59e0b | Data inspection (CALLDATAREAD) / fees |
| Red | #ef4444 | Danger / attack / rejection |
| Blue | #3b82f6 | Neutral data / structural |
| Indigo | #6366f1 | Special entities (paymaster, factory) |

### Global Shape Encoding
| Shape | Meaning |
|-------|---------|
| Sphere | Actor / signer |
| RoundedBox | Frame / container / transaction |
| Tube | Data flow / connection |
| Torus | ACCEPT flash ring |
| Hexagonal cylinder | Vault / validator / paymaster |

### Constraints
- Max 5 simultaneous labels per scene
- Animation loop: 8-10 seconds
- Max 120 objects per scene
- Key insight must land within first 3-5 seconds
- `autoRotate: false` (reader controls camera)
- `enablePan: false` (orbit and zoom only)
- All particle systems use InstancedMesh for performance
- Respect `reducedMotion` — skip all animations when true
