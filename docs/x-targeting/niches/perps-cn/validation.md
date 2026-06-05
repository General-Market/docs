| dropped term | replacement | why |
|---|---|---|
| `合约 教学 min_faves:20 lang:zh` | `合约 教学 min_faves:10 lang:zh` | Phase B Task 10 validation returned 0 tweets for this query in the `perps-cn` window; lowering `min_faves` by half keeps the same niche term while broadening recall. |
| `合约 教学 min_faves:10 lang:zh` | `合约 教学 min_faves:5 lang:zh` | The repaired query still returned 0 tweets on the rerun; lowering `min_faves` by half again keeps the same query intent while broadening recall. |
