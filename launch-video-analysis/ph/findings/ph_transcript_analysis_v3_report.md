# PH Transcript Analysis V3 — LLM-Extracted 200 Dimensions

**Dataset:** 1712 Product Hunt transcripts with ≥20 words.
**Method:** Semantic extraction via 20 parallel LLM agents (not regex).
**Dimensions:** ~170 extracted per transcript (V1 re-extracted + V2 new).

- 2023: 411 transcripts, median 350 votes
- 2024: 587 transcripts, median 454 votes
- 2025: 568 transcripts, median 372 votes
- 2026: 146 transcripts, median 327 votes

---

## 1. Continuous & Scale Dimensions — Ranked by Spearman r

| # | Dimension | r | High med | Low med | Lift | n |
|---|---|---|---|---|---|---|
| 1 | **fomo_construction** | +0.468 | 377 | 389 | -12 | 1712 |
| 2 | **in_group_language** | +0.466 | 411 | 388 | +23 | 1712 |
| 3 | **success_cost_savings** | +0.445 | 420 | 387 | +33 | 1712 |
| 4 | **future_self_projection** | +0.444 | 400 | 388 | +12 | 1712 |
| 5 | **everyone_else_maneuver** | +0.438 | 392 | 389 | +3 | 1712 |
| 6 | **counterfactual_count** | +0.436 | 407 | 388 | +19 | 1712 |
| 7 | **success_growth** | +0.421 | 417 | 387 | +30 | 1712 |
| 8 | **success_users** | +0.418 | 371 | 391 | -20 | 1712 |
| 9 | **qualifying_retreat** | +0.418 | 402 | 389 | +13 | 1712 |
| 10 | **unsaid_problem** | +0.417 | 370 | 391 | -21 | 1712 |
| 11 | **callback_count** | +0.406 | 394 | 389 | +5 | 1712 |
| 12 | **objection_preempt** | +0.386 | 387 | 390 | -3 | 1712 |
| 13 | **anticipatory_emotion** | +0.385 | 409 | 385 | +24 | 1712 |
| 14 | **success_revenue** | +0.382 | 394 | 389 | +5 | 1712 |
| 15 | **replacement_total** | +0.381 | 380 | 391 | -11 | 1712 |
| 16 | **surprise_delight** | +0.374 | 373 | 391 | -18 | 1712 |
| 17 | **question_answer_pairs** | +0.370 | 380 | 391 | -11 | 1712 |
| 18 | **imagine_device** | +0.363 | 423 | 386 | +37 | 1712 |
| 19 | **social_belonging** | +0.360 | 402 | 387 | +15 | 1712 |
| 20 | **buzzword_count** | +0.340 | 365 | 392 | -27 | 1712 |
| 21 | **relief_distance** | +0.337 | 413 | 384 | +29 | 1712 |
| 22 | **speaker_changes** | +0.335 | 385 | 391 | -6 | 1712 |
| 23 | **cliche_count** | +0.331 | 386 | 390 | -4 | 1712 |
| 24 | **pride_trigger** | +0.331 | 376 | 391 | -15 | 1712 |
| 25 | **competitive_total** | +0.325 | 408 | 386 | +22 | 1712 |
| 26 | **parenthetical_credibility** | +0.301 | 376 | 391 | -15 | 1712 |
| 27 | **finally_signal** | +0.290 | 380 | 391 | -11 | 1712 |
| 28 | **transformation_position** | +0.283 | 428 | 379 | +49 | 1712 |
| 29 | **contrast_pairs** | +0.266 | 392 | 389 | +3 | 1712 |
| 30 | **parallel_structure** | +0.264 | 395 | 387 | +8 | 1712 |
| 31 | **cliffhanger_beats** | +0.253 | 402 | 386 | +16 | 1712 |
| 32 | **category_creation_total** | +0.242 | 388 | 389 | -1 | 1712 |
| 33 | **negation_as_benefit** | +0.233 | 388 | 389 | -1 | 1712 |
| 34 | **multi_persona_address** | +0.227 | 397 | 383 | +14 | 1712 |
| 35 | **question_count** | +0.206 | 363 | 395 | -32 | 1712 |
| 36 | **hedge_count** | +0.201 | 402 | 384 | +18 | 1712 |
| 37 | **choice_architecture** | +0.200 | 404 | 379 | +25 | 1712 |
| 38 | **loss_aversion_framing** | +0.194 | 391 | 389 | +2 | 1712 |
| 39 | **just_minimizer** | +0.193 | 395 | 388 | +7 | 1712 |
| 40 | **speed_claims** | +0.190 | 396 | 386 | +10 | 1712 |
| 41 | **joy_velocity_shift** | +0.181 | 404 | 379 | +25 | 1712 |
| 42 | **production_markers** | +0.177 | 391 | 389 | +2 | 1712 |
| 43 | **cognitive_ease** | +0.175 | 390 | 389 | +1 | 1712 |
| 44 | **emotional_contrast_ratio** | +0.174 | 421 | 381 | +40 | 1712 |
| 45 | **temporal_anchors** | +0.171 | 384 | 391 | -7 | 1712 |
| 46 | **villain_count** | +0.170 | 397 | 385 | +12 | 1712 |
| 47 | **integration_count** | +0.159 | 403 | 380 | +23 | 1712 |
| 48 | **problem_pct** | +0.159 | 400 | 380 | +20 | 1712 |
| 49 | **energy_markers** | +0.154 | 395 | 382 | +13 | 1712 |
| 50 | **data_viz_cues** | +0.154 | 399 | 382 | +17 | 1712 |
| 51 | **magic_moment_position** | +0.149 | 399 | 388 | +11 | 1712 |
| 52 | **before_after_total** | +0.144 | 379 | 394 | -15 | 1712 |
| 53 | **resolution_completeness** | +0.143 | 405 | 371 | +34 | 1712 |
| 54 | **verb_energy** | +0.137 | 411 | 378 | +33 | 1712 |
| 55 | **anaphora_count** | +0.134 | 391 | 388 | +3 | 1712 |
| 56 | **story_compression** | +0.133 | 399 | 384 | +15 | 1712 |
| 57 | **social_proof_claims** | +0.127 | 396 | 381 | +15 | 1712 |
| 58 | **power_word_cluster_density** | +0.119 | 385 | 391 | -6 | 1712 |
| 59 | **conditional_density** | +0.118 | 375 | 395 | -20 | 1712 |
| 60 | **flesch_kincaid_grade** | +0.114 | 401 | 378 | +23 | 1712 |
| 61 | **number_density** | +0.111 | 397 | 381 | +16 | 1712 |
| 62 | **use_case_count** | +0.110 | 392 | 388 | +4 | 1712 |
| 63 | **frustration_vocabulary_breadth** | +0.110 | 387 | 391 | -4 | 1712 |
| 64 | **demo_instructions** | +0.109 | 385 | 391 | -6 | 1712 |
| 65 | **emotion_specificity** | +0.109 | 371 | 396 | -25 | 1712 |
| 66 | **avg_sentence_length** | +0.106 | 406 | 372 | +34 | 1712 |
| 67 | **ai_density** | +0.104 | 395 | 382 | +13 | 1712 |
| 68 | **number_count** | +0.104 | 397 | 380 | +17 | 1712 |
| 69 | **screen_narration** | +0.102 | 379 | 394 | -15 | 1712 |
| 70 | **ai_count** | +0.101 | 396 | 383 | +13 | 1712 |
| 71 | **passive_voice_count** | +0.093 | 370 | 398 | -28 | 1712 |
| 72 | **empathy_depth** | +0.082 | 370 | 397 | -27 | 1712 |
| 73 | **first_sentence_words** | +0.069 | 405 | 371 | +34 | 1712 |
| 74 | **brand_count** | +0.069 | 400 | 385 | +15 | 1712 |
| 75 | **conclusive_finality** | +0.066 | 400 | 383 | +17 | 1712 |
| 76 | **section_length_cv** | +0.066 | 399 | 380 | +19 | 1712 |
| 77 | **journey_vs_destination** | +0.066 | 398 | 383 | +15 | 1712 |
| 78 | **platform_mentions** | +0.061 | 399 | 386 | +13 | 1712 |
| 79 | **syllable_density** | +0.060 | 388 | 391 | -3 | 1712 |
| 80 | product_name_repeats | +0.056 | 389 | 389 | +0 | 1712 |
| 81 | superlative_density | +0.055 | 394 | 385 | +9 | 1712 |
| 82 | feature_intro_velocity | +0.054 | 387 | 392 | -5 | 1712 |
| 83 | setup_payoff_distance | +0.054 | 359 | 402 | -43 | 1712 |
| 84 | simplicity_signals | +0.050 | 395 | 385 | +10 | 1712 |
| 85 | transition_sophistication | +0.050 | 381 | 391 | -10 | 1712 |
| 86 | word_diversity | +0.047 | 395 | 381 | +14 | 1712 |
| 87 | promise_proof_push | +0.046 | 394 | 388 | +6 | 1712 |
| 88 | solution_pct | +0.046 | 388 | 391 | -3 | 1712 |
| 89 | section_boundary_markers | +0.044 | 380 | 393 | -13 | 1712 |
| 90 | benefit_ratio | +0.041 | 392 | 388 | +4 | 1712 |
| 91 | voice_consistency | +0.039 | 395 | 384 | +11 | 1712 |
| 92 | orphaned_features | +0.039 | 394 | 386 | +8 | 1712 |
| 93 | confidence_count | +0.035 | 384 | 391 | -7 | 1712 |
| 94 | confidence_gradient | +0.032 | 380 | 398 | -18 | 1712 |
| 95 | specificity_index | +0.031 | 388 | 389 | -1 | 1712 |
| 96 | word_rarity_score | +0.026 | 394 | 385 | +9 | 1712 |
| 97 | sentence_rhythm_variance | +0.024 | 394 | 386 | +8 | 1712 |
| 98 | pivot_sharpness | +0.023 | 387 | 391 | -4 | 1712 |
| 99 | feature_words | +0.023 | 393 | 386 | +7 | 1712 |
| 100 | we_count | +0.021 | 395 | 381 | +14 | 1712 |
| 101 | imperative_density | +0.020 | 388 | 391 | -3 | 1712 |
| 102 | benefit_words | +0.017 | 391 | 388 | +3 | 1712 |
| 103 | hook_quality | +0.016 | 371 | 401 | -30 | 1712 |
| 104 | first_feature_position | +0.014 | 386 | 392 | -6 | 1712 |
| 105 | concrete_vs_abstract | +0.014 | 392 | 388 | +4 | 1712 |
| 106 | action_verb_count | +0.012 | 384 | 392 | -8 | 1712 |
| 107 | liveness_score | +0.010 | 393 | 386 | +7 | 1712 |
| 108 | feature_list_markers | +0.006 | 384 | 394 | -10 | 1712 |
| 109 | word_count | -0.007 | 395 | 381 | +14 | 1712 |
| 110 | certainty_ratio | -0.012 | 380 | 395 | -15 | 1712 |
| 111 | you_insertion_rate | -0.022 | 388 | 390 | -2 | 1712 |
| 112 | filler_count | -0.024 | 378 | 397 | -19 | 1712 |
| 113 | you_count | -0.026 | 383 | 392 | -9 | 1712 |
| 114 | cold_open_words | -0.057 | 375 | 397 | -22 | 1712 |
| 115 | breathing_room | -0.059 | 379 | 396 | -17 | 1712 |
| 116 | **topic_transitions** | -0.064 | 375 | 398 | -23 | 1712 |
| 117 | **closing_velocity** | -0.069 | 384 | 393 | -9 | 1712 |
| 118 | **sentence_count** | -0.094 | 377 | 402 | -25 | 1712 |

---

## 2. Boolean Dimensions — Ranked by Median Vote Lift

| # | Dimension | Has (n) | Has (med) | No (med) | Lift | Prevalence |
|---|---|---|---|---|---|---|
| 1 | **bandwagon_gradient** | 27 ⚠ | 483 | 389 | +94 | 1% |
| 2 | **has_investor_mention** | 79 | 465 | 388 | +77 | 4% |
| 3 | **transformation_promise** | 499 | 424 | 379 | +45 | 29% |
| 4 | **has_scarcity** | 100 | 421 | 388 | +33 | 5% |
| 5 | **nested_stories** | 171 | 417 | 384 | +33 | 9% |
| 6 | **emotional_bookend_match** | 259 | 416 | 385 | +31 | 15% |
| 7 | **declining_arc** | 44 | 410 | 389 | +21 | 2% |
| 8 | **has_partnership** | 165 | 407 | 386 | +21 | 9% |
| 9 | **inciting_incident** | 190 | 408 | 388 | +20 | 11% |
| 10 | **anchor_contrast_pricing** | 21 ⚠ | 406 | 389 | +17 | 1% |
| 11 | **has_testimonial** | 214 | 402 | 385 | +17 | 12% |
| 12 | **reciprocity_trigger** | 311 | 398 | 387 | +11 | 18% |
| 13 | **definitive_closing** | 558 | 394 | 384 | +10 | 32% |
| 14 | stakes_escalation | 133 | 397 | 388 | +9 | 7% |
| 15 | closing_has_thanks | 455 | 393 | 387 | +6 | 26% |
| 16 | demo_voice_present_tense | 519 | 393 | 387 | +6 | 30% |
| 17 | effort_reduction_specific | 63 | 395 | 389 | +6 | 3% |
| 18 | has_discount | 222 | 394 | 388 | +6 | 12% |
| 19 | closing_has_cta | 829 | 391 | 386 | +5 | 48% |
| 20 | has_negative_opener | 170 | 394 | 389 | +5 | 9% |
| 21 | progressive_disclosure | 402 | 392 | 389 | +3 | 23% |
| 22 | storytelling | 328 | 392 | 389 | +3 | 19% |
| 23 | has_pricing | 343 | 391 | 389 | +2 | 20% |
| 24 | has_credential | 208 | 390 | 389 | +1 | 12% |
| 25 | vulnerability_moment | 54 | 390 | 389 | +1 | 3% |
| 26 | villain_named | 525 | 389 | 389 | +0 | 30% |
| 27 | open_loop_closing | 71 | 384 | 389 | -5 | 4% |
| 28 | under_the_hood | 297 | 384 | 389 | -5 | 17% |
| 29 | empathy_observed | 86 | 384 | 391 | -7 | 5% |
| 30 | why_now | 355 | 384 | 391 | -7 | 20% |
| 31 | **one_more_thing** | 94 | 379 | 390 | -11 | 5% |
| 32 | **humor** | 107 | 376 | 390 | -14 | 6% |
| 33 | **comparison_moment** | 235 | 373 | 392 | -19 | 13% |
| 34 | **first_person_opener** | 116 | 371 | 391 | -20 | 6% |
| 35 | **empathy_firsthand** | 207 | 370 | 391 | -21 | 12% |
| 36 | **onboarding_time_claim** | 70 | 370 | 391 | -21 | 4% |
| 37 | **effort_reduction_vague** | 419 | 373 | 395 | -22 | 24% |
| 38 | **has_url** | 312 | 362 | 395 | -33 | 18% |
| 39 | **trusted_by** | 24 ⚠ | 341 | 391 | -50 | 1% |

---

## 3. Categorical Dimensions

### authority_type

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1353 | 384 | 447 |
| technical | 167 | 395 | 439 |
| market | 96 | 418 | 464 |
| domain | 84 | 417 | 482 |
| mixed | 12 | 365 | 385 |

### cta_position

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 660 | 392 | 449 |
| end | 612 | 391 | 458 |
| start | 203 | 386 | 451 |
| middle | 187 | 361 | 415 |
| back | 29 | 411 | 431 |
| front | 21 | 408 | 427 |

### hook_type

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| greeting | 592 | 399 | 466 |
| descriptive | 485 | 393 | 448 |
| product_statement | 119 | 370 | 419 |
| pain_point | 119 | 388 | 458 |
| announcement | 100 | 399 | 422 |
| demo_instruction | 76 | 381 | 411 |
| founder_story | 71 | 367 | 417 |
| question | 63 | 363 | 424 |
| bold_claim | 58 | 370 | 486 |
| stat_number | 29 | 365 | 422 |

### info_density_shape

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| even | 706 | 369 | 424 |
| front_loaded | 394 | 406 | 488 |
| middle_peak | 308 | 405 | 451 |
| back_loaded | 304 | 392 | 450 |

### jargon_distribution_shape

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| minimal | 1219 | 389 | 440 |
| even | 187 | 370 | 441 |
| front_heavy | 154 | 395 | 439 |
| back_heavy | 88 | 417 | 471 |
| middle_heavy | 64 | 407 | 623 |

### metric_placement

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 954 | 380 | 430 |
| front | 353 | 423 | 501 |
| back | 208 | 395 | 454 |
| middle | 197 | 376 | 433 |

### narrative_arc

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| solution_first | 862 | 404 | 470 |
| neutral_flat | 440 | 380 | 426 |
| problem_solution | 230 | 379 | 430 |
| problem_heavy | 61 | 357 | 421 |
| traction_first | 61 | 371 | 408 |
| too_short | 58 | 368 | 427 |

### primary_cta

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 804 | 392 | 448 |
| try | 361 | 379 | 437 |
| free | 153 | 379 | 476 |
| get_started | 140 | 403 | 447 |
| sign_up | 112 | 368 | 423 |
| join | 85 | 421 | 466 |
| beta | 17 | 393 | 465 |
| book_demo | 16 | 414 | 418 |
| limited | 15 | 485 | 482 |
| waitlist | 9 | 596 | 545 |

### pronoun_strategy

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| mostly_you | 1267 | 384 | 440 |
| balanced | 217 | 393 | 446 |
| mostly_we | 142 | 397 | 522 |
| neutral | 86 | 408 | 456 |

### scarcity_type

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1490 | 390 | 447 |
| capability | 142 | 383 | 452 |
| time | 28 | 334 | 417 |
| quantity | 28 | 435 | 473 |
| access | 24 | 419 | 486 |

### sentiment

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| positive | 1070 | 394 | 460 |
| neutral | 540 | 376 | 426 |
| negative | 102 | 410 | 444 |

### social_proof_stacking_order

| Value | n | Median Votes | Mean Votes |
|---|---|---|---|
| none | 1171 | 387 | 453 |
| brands_first | 394 | 379 | 430 |
| quotes_first | 100 | 431 | 463 |
| numbers_first | 47 | 416 | 456 |

---

## 4. Temporal Shifts — Continuous Dimensions (2024 → 2025 → 2026)

| Dimension | 2024 r | 2025 r | 2026 r | Shift (24→26) | Direction |
|---|---|---|---|---|---|
| question_count | +0.464 | +0.096 | +0.034 | -0.430 | ↓ declining |
| setup_payoff_distance | +0.448 | +0.055 | +0.101 | -0.348 | ↓ declining |
| social_proof_claims | +0.076 | +0.087 | +0.363 | +0.287 | ↑ growing |
| superlative_density | +0.151 | +0.044 | -0.111 | -0.261 | ↓ declining |
| question_answer_pairs | +0.485 | +0.296 | +0.231 | -0.254 | ↓ declining |
| transformation_position | +0.166 | +0.268 | +0.382 | +0.216 | ↑ growing |
| magic_moment_position | +0.173 | +0.102 | +0.385 | +0.213 | ↑ growing |
| anaphora_count | +0.226 | +0.094 | +0.022 | -0.204 | ↓ declining |
| conclusive_finality | +0.011 | +0.064 | +0.203 | +0.192 | ↑ growing |
| platform_mentions | +0.010 | +0.055 | +0.200 | +0.190 | ↑ growing |
| closing_velocity | -0.043 | +0.048 | +0.137 | +0.181 | ↑ growing |
| demo_instructions | +0.097 | +0.135 | +0.276 | +0.179 | ↑ growing |
| just_minimizer | +0.269 | +0.109 | +0.094 | -0.175 | ↓ declining |
| brand_count | +0.006 | +0.034 | +0.172 | +0.167 | ↑ growing |
| social_belonging | +0.346 | +0.358 | +0.500 | +0.154 | ↑ growing |
| orphaned_features | +0.168 | -0.006 | +0.016 | -0.152 | ↓ declining |
| empathy_depth | +0.202 | +0.078 | +0.060 | -0.142 | ↓ declining |
| speaker_changes | +0.408 | +0.282 | +0.266 | -0.141 | ↓ declining |
| pride_trigger | +0.371 | +0.391 | +0.234 | -0.137 | ↓ declining |
| multi_persona_address | +0.203 | +0.147 | +0.068 | -0.135 | ↓ declining |
| choice_architecture | +0.106 | +0.184 | +0.239 | +0.133 | ↑ growing |
| feature_list_markers | +0.018 | -0.032 | +0.150 | +0.132 | ↑ growing |
| joy_velocity_shift | +0.082 | +0.185 | +0.212 | +0.130 | ↑ growing |
| simplicity_signals | +0.062 | +0.006 | -0.060 | -0.123 | ↓ declining |
| use_case_count | +0.138 | +0.070 | +0.019 | -0.119 | ↓ declining |
| cognitive_ease | +0.241 | +0.151 | +0.125 | -0.115 | ↓ declining |
| ai_count | +0.229 | +0.015 | +0.118 | -0.111 | ↓ declining |
| parallel_structure | +0.329 | +0.228 | +0.439 | +0.110 | ↑ growing |
| before_after_total | +0.170 | +0.176 | +0.061 | -0.109 | ↓ declining |
| villain_count | +0.208 | +0.124 | +0.100 | -0.108 | ↓ declining |

---

## 5. Temporal Shifts — Boolean Dimensions (2024 → 2025 → 2026)

| Dimension | 2024 (usage%, lift) | 2025 (usage%, lift) | 2026 (usage%, lift) | Trend |
|---|---|---|---|---|
| effort_reduction_specific | 3%, +21 | 4%, +57 | 0%, +193 | ↑ +172 |
| onboarding_time_claim | 3%, -15 | 3%, -39 | 3%, +134 | ↑ +149 |
| nested_stories | 12%, -30 | 9%, +35 | 4%, +90 | ↑ +120 |
| declining_arc | 1%, +67 | 3%, +14 | 1%, -47 | ↓ -114 |
| empathy_observed | 1%, +99 | 5%, +21 | 12%, -3 | ↓ -102 |
| has_testimonial | 16%, -10 | 13%, +16 | 4%, +90 | ↑ +100 |
| anchor_contrast_pricing | 1%, -54 | 1%, +54 | 2%, +44 | ↑ +98 |
| has_negative_opener | 13%, +60 | 7%, +9 | 5%, -37 | ↓ -97 |
| has_investor_mention | 5%, +51 | 4%, +108 | 4%, -32 | ↓ -83 |
| definitive_closing | 30%, -14 | 39%, +15 | 27%, +67 | ↑ +81 |
| has_scarcity | 5%, +8 | 6%, +64 | 1%, -71 | ↓ -79 |
| has_url | 14%, -50 | 19%, -14 | 17%, +17 | ↑ +67 |
| has_credential | 11%, -27 | 12%, +20 | 19%, +36 | ↑ +63 |
| emotional_bookend_match | 23%, +43 | 7%, +35 | 7%, -11 | ↓ -54 |
| villain_named | 29%, +10 | 36%, -9 | 34%, -44 | ↓ -54 |
| closing_has_cta | 48%, -14 | 48%, +6 | 39%, +38 | ↑ +52 |
| trusted_by | 0%, +51 | 1%, -35 | 2%, +102 | ↑ +51 |
| humor | 4%, +42 | 6%, +17 | 4%, -8 | ↓ -50 |
| open_loop_closing | 4%, -31 | 4%, +1 | 2%, +14 | ↑ +45 |
| one_more_thing | 5%, +0 | 7%, -67 | 2%, -45 | ↓ -45 |
| inciting_incident | 11%, +56 | 10%, +34 | 11%, +12 | ↓ -44 |
| reciprocity_trigger | 17%, +0 | 17%, +14 | 18%, +44 | ↑ +44 |
| progressive_disclosure | 25%, -13 | 25%, +2 | 23%, +28 | ↑ +41 |
| demo_voice_present_tense | 26%, -33 | 38%, +17 | 24%, +5 | ↑ +38 |
| empathy_firsthand | 8%, +59 | 11%, -6 | 23%, +22 | ↓ -37 |

---

## 6. Scale Dimensions — Distribution Check

| Dimension | Min | Max | Mean | Median | Std | r vs votes |
|---|---|---|---|---|---|---|
| breathing_room | 1 | 5 | 3.1 | 3 | 1.3 | -0.059 |
| closing_velocity | 1 | 5 | 2.9 | 3 | 1.2 | -0.069 |
| conclusive_finality | 1 | 5 | 3.1 | 3 | 1.1 | +0.066 |
| concrete_vs_abstract | 1 | 5 | 3.3 | 3 | 1.2 | +0.014 |
| confidence_gradient | 1 | 5 | 2.6 | 2 | 0.8 | +0.032 |
| emotion_specificity | 1 | 5 | 1.5 | 1 | 0.8 | +0.109 |
| emotional_contrast_ratio | 1 | 5 | 1.8 | 2 | 1.0 | +0.174 |
| empathy_depth | 1 | 5 | 1.6 | 1 | 0.9 | +0.082 |
| feature_intro_velocity | 1 | 5 | 3.7 | 3 | 1.1 | +0.054 |
| hook_quality | 1 | 5 | 2.6 | 2 | 0.9 | +0.016 |
| joy_velocity_shift | 1 | 5 | 2.5 | 2 | 0.9 | +0.181 |
| liveness_score | 1 | 5 | 2.6 | 2 | 1.2 | +0.010 |
| pivot_sharpness | 1 | 5 | 2.6 | 2 | 1.2 | +0.023 |
| power_word_cluster_density | 1 | 5 | 1.6 | 1 | 0.9 | +0.119 |
| section_length_cv | 1 | 5 | 2.6 | 2 | 1.1 | +0.066 |
| sentence_rhythm_variance | 1 | 5 | 3.1 | 3 | 1.3 | +0.024 |
| setup_payoff_distance | 1 | 5 | 1.5 | 1 | 0.9 | +0.054 |
| specificity_index | 1 | 5 | 2.4 | 2 | 1.1 | +0.031 |
| story_compression | 0 | 5 | 2.0 | 2 | 0.8 | +0.133 |
| transition_sophistication | 1 | 5 | 1.8 | 2 | 0.7 | +0.050 |
| verb_energy | 1 | 5 | 3.4 | 3 | 1.0 | +0.137 |
| voice_consistency | 1 | 5 | 3.6 | 4 | 1.2 | +0.039 |
| word_rarity_score | 1 | 5 | 2.8 | 2 | 1.3 | +0.026 |

---

## 7. Top 1% Deep Dive

**Top 17 products** vs rest:

| Dimension | Top 1% | Dataset | Gap |
|---|---|---|---|
| definitive_closing | 23% | 32% | -9pp |
| effort_reduction_vague | 11% | 24% | -13pp |
| emotional_bookend_match | 0% | 15% | -15pp |
| empathy_firsthand | 0% | 12% | -12pp |
| empathy_observed | 0% | 5% | -5pp |
| first_person_opener | 0% | 6% | -6pp |
| has_credential | 0% | 12% | -12pp |
| has_negative_opener | 0% | 10% | -10pp |
| has_partnership | 0% | 9% | -9pp |
| has_scarcity | 0% | 5% | -5pp |
| has_url | 5% | 18% | -13pp |
| humor | 11% | 6% | +5pp |
| inciting_incident | 5% | 11% | -6pp |
| nested_stories | 0% | 10% | -10pp |
| one_more_thing | 0% | 5% | -5pp |
| progressive_disclosure | 17% | 23% | -6pp |
| storytelling | 5% | 19% | -14pp |
| transformation_promise | 52% | 28% | +24pp |
| under_the_hood | 11% | 17% | -6pp |
| villain_named | 23% | 30% | -7pp |
| emotion_specificity (avg) | 1.2 | 1.5 | -0.3 |
| emotional_contrast_ratio (avg) | 1.5 | 1.8 | -0.3 |
| empathy_depth (avg) | 1.2 | 1.6 | -0.4 |
| hook_quality (avg) | 2.2 | 2.6 | -0.4 |
| power_word_cluster_density (avg) | 1.2 | 1.6 | -0.4 |
| sentence_rhythm_variance (avg) | 2.7 | 3.1 | -0.4 |
| specificity_index (avg) | 2.1 | 2.4 | -0.3 |
| voice_consistency (avg) | 3.9 | 3.6 | +0.3 |
| word_rarity_score (avg) | 3.2 | 2.8 | +0.5 |

---

*Analysis generated from 1712 transcripts across ~170 LLM-extracted dimensions*