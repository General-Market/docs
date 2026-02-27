# PostHog Deep Analytics — Design

## Goal

Instrument the entire frontend with PostHog to:
1. **Diagnose where users drop off** in every flow (wallet → buy/sell → completion)
2. **Optimize conversion** with funnel analysis and session replay
3. **Surface errors** that silently kill user experience (SSE drops, tx failures, wrong network)

## Approach: Hybrid (Autocapture + Manual Events)

- **Autocapture ON**: Catches all clicks, inputs, form submits as baseline
- **Manual events**: Rich, property-laden events on every critical flow step
- **Session replay ON**: Full recording, mask sensitive inputs only
- **Identity**: `posthog.identify(walletAddress)` on connect, `posthog.reset()` on disconnect

## PostHog Config

- PostHog Cloud (us.i.posthog.com)
- Env vars: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- `autocapture: true`
- `capture_pageview: false` (manual via App Router hook)
- `capture_pageleave: true`
- `session_recording.maskAllInputs: false` (no sensitive fields in this app)
- `person_profiles: 'identified_only'`

## Event Taxonomy

### Wallet Connection Funnel
| Event | Properties |
|-------|------------|
| `wallet_connect_clicked` | `source` |
| `wallet_connector_selected` | `connector_type` |
| `wallet_connected` | `wallet_address`, `connector_type`, `chain_id` |
| `wallet_connect_failed` | `connector_type`, `error_message` |
| `wallet_wrong_network` | `current_chain_id`, `target_chain_id` |
| `wallet_network_switched` | `from_chain_id`, `to_chain_id` |
| `wallet_network_switch_failed` | `error_message` |
| `wallet_disconnected` | `session_duration_seconds` |

### Buy/Sell ITP Funnel
| Event | Properties |
|-------|------------|
| `buy_modal_opened` | `itp_id`, `itp_name`, `current_nav` |
| `buy_amount_entered` | `itp_id`, `amount_usd`, `user_balance` |
| `buy_slippage_changed` | `itp_id`, `slippage_tier` |
| `buy_limit_price_set` | `itp_id`, `limit_price`, `current_nav` |
| `buy_submitted` | `itp_id`, `amount_usd`, `slippage`, `deadline_hours`, `is_limit_order` |
| `buy_approval_started` | `itp_id`, `token_address` |
| `buy_approval_completed` | `itp_id`, `tx_hash` |
| `buy_approval_failed` | `itp_id`, `error_message`, `error_type` |
| `buy_tx_submitted` | `itp_id`, `tx_hash` |
| `buy_step_reached` | `itp_id`, `step_name`, `step_index`, `time_since_submit_ms` |
| `buy_completed` | `itp_id`, `amount_usd`, `fill_price`, `total_time_ms` |
| `buy_failed` | `itp_id`, `step_name`, `step_index`, `error_message`, `time_since_submit_ms` |
| `buy_modal_closed` | `itp_id`, `last_step`, `had_entered_amount` |
| `sell_modal_opened` | `itp_id`, `user_shares` |
| `sell_submitted` | `itp_id`, `shares_amount` |
| `sell_completed` | `itp_id`, `shares_amount`, `received_usd`, `total_time_ms` |
| `sell_failed` | `itp_id`, `error_message`, `step_name` |

### ITP Creation Funnel
| Event | Properties |
|-------|------------|
| `create_itp_section_viewed` | - |
| `create_itp_assets_selected` | `asset_count`, `asset_ids` |
| `create_itp_weights_set` | `asset_count`, `weight_distribution` |
| `create_itp_submitted` | `asset_count`, `name` |
| `create_itp_completed` | `itp_id`, `asset_count`, `tx_hash` |
| `create_itp_failed` | `error_message`, `step` |

### Rebalance Funnel
| Event | Properties |
|-------|------------|
| `rebalance_modal_opened` | `itp_id`, `current_weights` |
| `rebalance_submitted` | `itp_id`, `old_weights`, `new_weights`, `assets_changed_count` |
| `rebalance_completed` | `itp_id`, `tx_hash` |
| `rebalance_failed` | `itp_id`, `error_message` |

### Vision Platform Funnel
| Event | Properties |
|-------|------------|
| `vision_page_viewed` | - |
| `vision_batch_create_started` | - |
| `vision_batch_created` | `batch_id`, `initial_deposit` |
| `vision_deposit_submitted` | `batch_id`, `amount` |
| `vision_withdraw_submitted` | `batch_id`, `amount` |
| `vision_strategy_selected` | `template_name` |
| `vision_backtest_run` | `script_length`, `duration_ms` |
| `vision_script_edited` | `script_length` |

### Lending (Morpho) Funnel
| Event | Properties |
|-------|------------|
| `lend_modal_opened` | `itp_id` |
| `lend_deposit_submitted` | `itp_id`, `amount` |
| `lend_withdraw_submitted` | `itp_id`, `amount` |
| `lend_completed` | `itp_id`, `action`, `tx_hash` |
| `lend_failed` | `itp_id`, `action`, `error_message` |

### System/Diagnostic Events
| Event | Properties |
|-------|------------|
| `sse_connected` | `topic` |
| `sse_disconnected` | `topic`, `reconnect_attempt` |
| `sse_fallback_to_polling` | `topic`, `attempts` |
| `error_boundary_triggered` | `component_stack`, `error_message` |
| `toast_error_shown` | `message`, `source_component` |
| `page_viewed` | `path`, `locale`, `referrer` |
| `section_scrolled_to` | `section_name` |
| `section_time_spent` | `section_name`, `time_spent_seconds`, `had_interaction` |

## Architecture

### New Files
```
frontend/
├── lib/posthog.ts                    # PostHog client init + config
├── components/PostHogProvider.tsx     # Provider wrapper (identity, pageview tracking)
├── components/PostHogPageView.tsx     # App Router pageview tracker
├── hooks/usePostHog.ts               # Hook: capture(), identify() — single import point
├── hooks/useSectionTimeTracker.ts    # IntersectionObserver section time tracking
```

### Files to Modify (15)
1. `app/providers.tsx` — add PostHogProvider
2. `components/domain/WalletConnectButton.tsx` — wallet events + identify
3. `components/domain/BuyItpModal.tsx` — buy funnel
4. `components/domain/CreateItpSection.tsx` — creation funnel
5. `components/domain/vision/VisionPage.tsx` — vision page view
6. `components/domain/vision/CreateBatchModal.tsx` — batch creation
7. `components/domain/vision/DepositModal.tsx` — deposit events
8. `components/domain/vision/WithdrawModal.tsx` — withdraw events
9. `components/domain/LendItpModal.tsx` — lending funnel
10. `components/domain/RebalanceModal.tsx` — rebalance funnel
11. `components/ui/ErrorBoundary.tsx` — error tracking
12. `lib/contexts/ToastContext.tsx` — error toast tracking
13. `hooks/useSSE.tsx` — SSE health tracking
14. `components/layout/Header.tsx` — section navigation tracking
15. `app/[locale]/page.tsx` — section time observer

### Design Principle
All PostHog calls go through `usePostHog()` hook. Never import `posthog-js` directly in components.

## Key PostHog Dashboards to Build

1. **Conversion Funnel**: page_viewed → wallet_connected → buy_modal_opened → buy_submitted → buy_completed
2. **Buy Drop-off Analysis**: Which micro-step loses the most users?
3. **Error Heatmap**: Where do errors concentrate? (by component, by step)
4. **Wallet Friction**: Connect attempts vs successes, wrong network rate
5. **Session Replay on Failures**: Filter replays by buy_failed or wallet_connect_failed
6. **Vision Engagement**: How far do users get in the backtesting flow?
7. **Section Time**: Which sections hold attention, which are skipped?
