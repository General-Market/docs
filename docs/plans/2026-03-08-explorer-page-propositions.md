# Explorer Page — Propositions

95 graphs to visualize oracle activity on the frontend.

**Estimated storage**: ~3-5 MB/day (all scalar per-cycle data + event-driven data).

---

## Consensus & Leadership (1-15)

1. **Live leader identity** — which oracle node is currently leading
2. **Leader tenure timeline** — how long each node holds leadership before rotation
3. **Leader election frequency** — elections/hour over time (line chart)
4. **Consensus success rate** — success vs failed rounds (pie or ratio gauge)
5. **Consensus round duration** — histogram of `last_consensus_time_ms`
6. **Consensus rounds/minute** — throughput over time (area chart)
7. **Signatures collected per round** — distribution (bar chart)
8. **Consensus failure reasons** — breakdown by error type (stacked bar)
9. **Leader thrashing detector** — highlight periods of rapid leader changes
10. **Equivocation events** — timeline of `CONSENSUS-021` detections
11. **Leader rejection count** — proposals rejected because sender wasn't leader
12. **Consensus in-progress indicator** — live green/red dot
13. **BLS signing latency** — time from proposal to threshold signatures
14. **Consensus quorum heatmap** — which nodes signed each round (matrix)
15. **Consensus gap detector** — periods where no consensus happened

## Order Pipeline (16-30)

16. **Live pending order count** — real-time gauge
17. **Orders processed/minute** — rolling throughput (sparkline)
18. **Order lifecycle waterfall** — Phase 1→2→3→4 duration breakdown per order
19. **Order phase distribution** — how many orders in each phase right now (funnel)
20. **Order completion time** — end-to-end latency histogram
21. **Buy vs sell order ratio** — over time (stacked area)
22. **Order volume (USDC)** — total value flowing through pipeline
23. **Failed orders timeline** — when and why orders failed
24. **Stale order detections** — watchdog catches over time
25. **Order retry count** — how often orders need retry before success
26. **Orders by ITP** — which ITPs generate most order flow (bar chart)
27. **Bridge settlement→L3 latency** — Phase 1 timing
28. **Batch confirmation latency** — Phase 2 timing
29. **Mint latency** — Phase 4 timing (Settlement chain confirmation)
30. **Order pipeline bottleneck** — which phase is slowest right now

## Price Feeds (31-39)

31. **Price consensus agreement rate** — how often nodes agree on prices
32. **Bitget API latency** — response times over time
33. **Bitget rate limit hits** — `INFRA-012` events timeline
34. **Bitget API errors by type** — breakdown of INFRA-011 through 016
35. **DEX price source health** — 1inch recovery/degradation events
36. **Oracle update frequency** — on-chain price submissions/hour
37. **Price proposal broadcast latency** — time from creation to peer receipt
38. **Price vote convergence** — how many rounds to agree
39. **Gas cost of price updates** — cumulative gas spent on oracle updates

## P2P Network (40-54)

40. **Network topology map** — nodes and connections (force-directed graph)
41. **Connected peers count** — per node, over time
42. **Messages sent/received** — aggregate throughput (dual-axis line)
43. **Message rate per peer** — identify chatty/quiet nodes
44. **Rate-limited messages** — `INFRA-020` events over time
45. **Peer health status** — healthy vs unhealthy peers (donut chart)
46. **Heartbeat round-trip time** — latency between peers
47. **Peer ban events** — timeline of `INFRA-023` peer bans
48. **Kick vote proposals** — peer removal attempts over time
49. **Connection rejections** — `INFRA-021` per-IP limit hits
50. **Decode failures** — malformed message rate
51. **WAL entries written** — write-ahead log growth over time
52. **WAL size monitor** — approaching 10MB limit warning
53. **Reconnection attempts** — backoff patterns per peer
54. **P2P message type breakdown** — consensus vs heartbeat vs price vs bridge

## Cycle Performance (55-64)

55. **Cycle duration over time** — `last_cycle_duration_ms` line chart
56. **Cycle duration histogram** — distribution of cycle times
57. **Cycle trigger type ratio** — demand-driven vs work-driven (pie)
58. **Slow cycle alerts** — cycles exceeding 2000ms threshold
59. **NTP clock drift** — time sync accuracy across nodes
60. **Cycle gap detection** — missed or delayed cycles
61. **Cycles per minute** — throughput trend
62. **Cycle type breakdown** — price cycles vs batch cycles
63. **Consensus pause events** — when on-chain pause was active
64. **Cycle efficiency** — useful work per cycle (orders processed / cycle)

## ITP & NAV (65-73)

65. **NAV per ITP over time** — multi-line chart
66. **ITP creation events** — timeline of new ITPs
67. **Rebalance events** — when weight changes happened
68. **ITP AUM ranking** — bar chart of total value locked
69. **ITP inventory composition** — treemap of asset weights
70. **Rebalance consensus duration** — how long rebalances take
71. **ITP creation request queue** — pending requests over time
72. **Weight change magnitude** — how much ITPs shift on rebalance
73. **ITP mint/burn ratio** — shares created vs destroyed

## Vision & Batches (74-81)

74. **Active Vision batches** — live count and list
75. **Tick consensus frequency** — ticks/minute per batch
76. **Player count per batch** — participation over time
77. **Batch lifecycle events** — create/pause/unpause/close timeline
78. **Vision deposit volume** — USDC flowing into Vision
79. **Tick vote convergence** — player votes per tick
80. **Batch event processing lag** — cursor position vs chain head
81. **Vision positions opened/closed** — flow rate

## System Health (82-88)

82. **Node health status** — multi-node dashboard (healthy/degraded/unhealthy)
83. **Readiness check breakdown** — which checks pass/fail per node
84. **Error rate by category** — INFRA vs CONSENSUS vs BRIDGE over time
85. **Warning rate trend** — are warnings increasing?
86. **Log volume** — lines/minute by severity level
87. **State reconstruction time** — startup duration trend
88. **Chain RPC latency** — response times for L3 and Settlement

## Chain & Gas (89-95)

89. **Gas spent per transaction type** — cumulative and per-cycle
90. **Nonce resync events** — timeline of forced resyncs
91. **Transaction confirmation time** — L3 vs Settlement
92. **On-chain error codes** — E008 and others frequency
93. **Settlement scan range** — from_block to to_block gap over time
94. **Arbitration requests** — timeline of new arbitration cases
95. **Arbitration resolution time** — time from request to on-chain resolution
