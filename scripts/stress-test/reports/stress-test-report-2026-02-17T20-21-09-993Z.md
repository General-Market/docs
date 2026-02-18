# Stress Test Report

**Timestamp**: 2026-02-17T20:15:24.438Z
**Duration**: 345.6s

## Breaking Points Found

- Chaos Medium: 18 critical mismatches: ITP 0x00000000... totalSupply mismatch

## Phase 6: Chaos Fuzz Test

### Operations Summary

| Tier | Duration | Ops Total | Succeeded | Failed | Buy | Sell | Create | Rebalance | Liquidate | Breaking Point |
|------|----------|-----------|-----------|--------|-----|------|--------|-----------|-----------|----------------|
| Light | 76441ms | 260 | 147 | 113 | 79 | 71 | 29 | 46 | 35 | — |
| Medium | 187992ms | 500 | 258 | 242 | 177 | 127 | 53 | 78 | 65 | 18 critical mismatches: ITP 0x00000000... totalSupply mismatch |

### Fuzz Validation

| Tier | Fuzz Ops | Correct Reverts | INCORRECT Successes | Correct Successes | Incorrect Reverts |
|------|----------|-----------------|---------------------|-------------------|-----------|
| Light | 7 | 7 | 0 | 147 | 4 |
| Medium | 84 | 84 | 0 | 258 | 6 |

### Reconciliation

| Tier | Block Range | Orders | Fills | Creates | Rebalances | Fees | Stuck | Escrow Leaks | Mismatches |
|------|-------------|--------|-------|---------|------------|------|-------|--------------|------------|
| Light | 898→1096 | 77 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| Medium | 1096→1444 | 148 | 200 | 23 | 0 | 0 | 25 | 0 | 19 |

### Critical Mismatches

| Category | Description | Expected | Actual |
|----------|-------------|----------|--------|
| totalSupply | ITP 0x00000000... totalSupply mismatch | 162928840455775444858656 | 237407208150373372396246 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 136043866673173181293548 | 206208942958945267328833 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 73003542533859427553934 | 129347663711128283297247 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 421865470003036223440863 | 665277079630212826307573 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 82280921708211972411090 | 291843005813201005753679 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 225054040152451578664151 | 268355160590914901155254 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 290332107000005778922834 | 410143087303101298312755 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 74039814999840479127426 | 465100555889024787347400 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 248792162600641289796530 | 484913829157330206503009 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 314193393539186877364042 | 627609882928130892486937 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 104227840713371456899422 | 425069438989932101683663 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 187118510308177504404190 | 394741215244434955808532 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 51416064401092837907359 | 146474679288916200003879 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 263979796980864539996402 | 530711014361746499044676 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 246326167963046836074892 | 480052896485865879783805 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 271072518423621990798963 | 438432830736129775459532 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 466093702668784946782031 | 666479529633131260215470 |
| totalSupply | ITP 0x00000000... totalSupply mismatch | 179550227426790618307140 | 282847949789829358705067 |

## Health Monitor Summary

- Duration: 345.6s
- Total samples: 1360
- Anomalies: 0

