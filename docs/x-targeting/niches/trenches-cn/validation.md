| dropped term | replacement | why |
|---|---|---|
| `土狗 sol min_faves:50 lang:zh` | `土狗 sol min_faves:25 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `(pumpfun OR pump) 内盘 min_faves:30 lang:zh` | `(pumpfun OR pump) 内盘 min_faves:15 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `狙击 pump min_faves:20 lang:zh` | `狙击 pump min_faves:10 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `捆绑 检测 min_faves:10 lang:zh` | `捆绑 检测 min_faves:5 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `axiom min_faves:20 lang:zh` | `axiom min_faves:10 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `今日 金狗 min_faves:20 lang:zh` | `今日 金狗 min_faves:10 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `夹子 sol min_faves:20 lang:zh` | `夹子 sol min_faves:10 lang:zh` | Validation returned 0 tweets; lowered `min_faves` by half. |
| `土狗 sol min_faves:25 lang:zh` | `土狗 sol min_faves:12 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `(pumpfun OR pump) 内盘 min_faves:15 lang:zh` | `(pumpfun OR pump) 内盘 min_faves:7 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `捆绑 检测 min_faves:5 lang:zh` | `捆绑 检测 min_faves:2 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `axiom min_faves:10 lang:zh` | `axiom min_faves:5 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `今日 金狗 min_faves:10 lang:zh` | `今日 金狗 min_faves:5 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `夹子 sol min_faves:10 lang:zh` | `夹子 sol min_faves:5 lang:zh` | Repaired query still returned 0 tweets; lowered `min_faves` by half again. |
| `土狗 sol min_faves:12 lang:zh` | `冲土狗 min_faves:1 lang:zh` | Final validation still returned 0 tweets; replaced with live cached phrase from `tweets.jsonl` for `trenches-cn`. |
| `捆绑 检测 min_faves:2 lang:zh` | `捆绑 检测 min_faves:1 lang:zh` | Final validation still returned 0 tweets; threshold was already very low, so set `min_faves:1`. |
| `axiom min_faves:5 lang:zh` | `链上主力 min_faves:1 lang:zh` | Final validation still returned 0 tweets; replaced with live cached terminal/workflow phrase from `tweets.jsonl` for `trenches-cn`. |
| `夹子 sol min_faves:5 lang:zh` | `狙击机器人 min_faves:1 lang:zh` | Final validation still returned 0 tweets; replaced with live cached bot phrase from `tweets.jsonl` for `trenches-cn`. |
| `捆绑 检测 min_faves:1 lang:zh` | `捆绑砸货 min_faves:1 lang:zh` | Validation still returned 0 tweets; replaced with live cached phrase from `tweets.jsonl` for `trenches-cn`. |
