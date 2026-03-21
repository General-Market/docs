# Meta-Evaluation: Scoring the Scoring System

This evaluates the quality of the Method 2 evaluation framework (eval.md + prompt instructions) for producing excellent video scripts via autoresearch.

## Dimensions (each scored 0-10)

### 1. DISCRIMINATION POWER
Can the rubric distinguish a mediocre script from a great one? Do the 0-3-5-7-10 anchor points describe genuinely different quality levels, or do they blur together?
- 0: All scripts score similarly regardless of quality.
- 5: Rubric catches obvious failures but rates "good" and "great" the same.
- 10: Each score level describes a qualitatively distinct experience. A 7 script and a 9 script are unmistakably different things.

### 2. DIMENSION COVERAGE
Do the dimensions cover everything that makes a video script work? Are there blind spots — aspects of quality that could improve dramatically without any dimension noticing?
- 0: Major quality axes are missing. A script could score 10/10 while being unwatchable.
- 5: Core aspects covered but 1-2 meaningful blind spots remain.
- 10: Every way a video script can fail or succeed maps to at least one dimension.

### 3. ACTIONABILITY
When a dimension scores low, does the rubric tell the agent WHAT to fix? Or just that something is wrong?
- 0: Scores diagnose nothing. "Your hook is a 3" gives no direction.
- 5: Anchor descriptions hint at fixes but leave interpretation to the agent.
- 10: Each anchor point implicitly contains its own repair instruction. Reading the 7 description after getting a 3 tells you exactly what's missing.

### 4. ANTI-INFLATION
Does the rubric resist score inflation over iterations? Can an agent game it by making changes that technically satisfy descriptions without improving the actual script?
- 0: Easy to game. Adding a "pattern interrupt" checkbox-style satisfies the rubric without improving quality.
- 5: Most dimensions resist gaming but 1-2 can be satisfied superficially.
- 10: Every dimension measures a FELT quality that cannot be faked by mechanical changes.

### 5. INDEPENDENCE
Are the dimensions truly independent, or do improvements in one automatically improve another? Correlated dimensions waste evaluation bandwidth.
- 0: Most dimensions measure the same underlying thing with different words.
- 5: Some correlation exists but each dimension captures at least one unique signal.
- 10: Each dimension can move independently. Improving voice doesn't automatically improve clarity. Improving hook doesn't automatically improve closing.

### 6. GENERALIZABILITY
Will this rubric work for different types of video scripts (not just this specific Vision VC pitch)? Future videos might be product demos, explainers, social content, investor updates.
- 0: Rubric is hardcoded to one script type. Would need total rewrite for a different video.
- 5: Core dimensions transfer but anchor descriptions are too specific to one format.
- 10: Dimensions are universal. Anchor descriptions reference principles, not specific content.

### 7. PROMPT QUALITY
Is the agent prompt (the instructions given to the autoresearch agent) clear, complete, and well-structured? Does it prevent common failure modes?
- 0: Prompt is vague. Agent would interpret instructions differently each run.
- 5: Prompt is clear but missing guardrails for edge cases (what to do at ceiling, how to handle ties, when to stop).
- 10: Prompt anticipates failure modes, specifies exact behavior for edge cases, and produces consistent results across different runs.

### 8. CEILING BEHAVIOR
What does the system do after reaching its maximum score? Does it have a strategy for continued improvement, or does it waste iterations?
- 0: System has no strategy for post-ceiling iterations. Wastes compute.
- 5: System attempts improvements but has no systematic approach.
- 10: System has explicit strategies for post-ceiling work (stress testing, production polish, adversarial testing, finding new dimensions).

### 9. VOICE PRESERVATION
Does the rubric protect the intended voice (Cioran in this case) from being eroded by optimization pressure? Optimizing for clarity often kills voice. Optimizing for hook often kills subtlety.
- 0: Voice is one dimension among many and gets sacrificed when other dimensions are low.
- 5: Voice dimension exists but other dimensions can override it in practice.
- 10: Voice is structurally protected — the rubric makes it impossible to score high on other dimensions while losing voice.

### 10. CONVERGENCE SPEED
How quickly does the system reach meaningful quality? A rubric that takes 40 iterations to find obvious problems is wasting time.
- 0: System meanders. Obvious fixes take many iterations to surface.
- 5: System finds major issues within 10 iterations but fine-tuning is slow.
- 10: The lowest-scoring dimension at each step points directly at the most impactful change. The system is greedy-optimal.

## Scoring
Final score = average of all 10 dimensions (0-10 scale)

## Rules
- Score each dimension independently with 1-sentence justification.
- Reference specific lines from eval.md and the prompt when justifying scores.
- The agent modifying eval.md and the prompt CANNOT modify this meta-eval file.
