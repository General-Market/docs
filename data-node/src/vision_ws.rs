use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

use crate::api::AppState;
use crate::market_data::broadcast::SourcePriceBatch;

#[derive(Debug, Deserialize)]
struct ClientMessage {
    subscribe: Option<Vec<u64>>,
    unsubscribe: Option<Vec<u64>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PriceMessage {
    r#type: &'static str,
    batch_id: u64,
    ts: String,
    markets: Vec<MarketPrice>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketPrice {
    id: String,
    source: String,
    price: String,
    change_pct: Option<String>,
    volume_24h: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    // batch_id → (source, market_ids)
    let subscriptions: Arc<tokio::sync::RwLock<HashMap<u64, (String, HashSet<String>)>>> =
        Arc::new(tokio::sync::RwLock::new(HashMap::new()));

    // source → broadcast receiver task handle
    let source_tasks: Arc<tokio::sync::RwLock<HashMap<String, tokio::task::JoinHandle<()>>>> =
        Arc::new(tokio::sync::RwLock::new(HashMap::new()));

    // Channel for forwarding filtered prices to the WS sender
    let (fwd_tx, mut fwd_rx) = tokio::sync::mpsc::channel::<String>(256);

    // Task: forward filtered messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = fwd_rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read client messages (subscribe/unsubscribe)
    while let Some(Ok(msg)) = ws_rx.next().await {
        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };

        let parsed: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                debug!("Invalid WS message: {}", e);
                continue;
            }
        };

        // Handle subscribes
        if let Some(batch_ids) = parsed.subscribe {
            for batch_id in batch_ids {
                match state.vision_batch_cache.get(batch_id).await {
                    Ok(info) => {
                        let market_set: HashSet<String> = info.market_ids.into_iter().collect();
                        let source = info.source.clone();

                        subscriptions
                            .write()
                            .await
                            .insert(batch_id, (source.clone(), market_set));

                        // Ensure we have a broadcast listener for this source
                        let mut tasks = source_tasks.write().await;
                        if !tasks.contains_key(&source) {
                            let rx = state.price_broadcast.subscribe(&source).await;
                            let subs_ref = subscriptions.clone();
                            let fwd = fwd_tx.clone();

                            let handle = tokio::spawn(source_listener(
                                rx,
                                source.clone(),
                                subs_ref,
                                fwd,
                            ));
                            tasks.insert(source, handle);
                        }

                        info!("WS client subscribed to batch {}", batch_id);
                    }
                    Err(e) => {
                        warn!("WS subscribe failed for batch {}: {}", batch_id, e);
                    }
                }
            }
        }

        // Handle unsubscribes
        if let Some(batch_ids) = parsed.unsubscribe {
            let mut subs = subscriptions.write().await;
            for batch_id in batch_ids {
                subs.remove(&batch_id);
                info!("WS client unsubscribed from batch {}", batch_id);
            }
        }
    }

    // Cleanup
    drop(fwd_tx);
    send_task.abort();
    let tasks = source_tasks.read().await;
    for handle in tasks.values() {
        handle.abort();
    }
}

/// Listen to a source's broadcast channel and forward filtered prices
async fn source_listener(
    mut rx: broadcast::Receiver<Arc<SourcePriceBatch>>,
    source: String,
    subscriptions: Arc<tokio::sync::RwLock<HashMap<u64, (String, HashSet<String>)>>>,
    fwd_tx: tokio::sync::mpsc::Sender<String>,
) {
    loop {
        match rx.recv().await {
            Ok(batch) => {
                let subs = subscriptions.read().await;
                for (batch_id, (sub_source, market_ids)) in subs.iter() {
                    if *sub_source != source {
                        continue;
                    }

                    let filtered: Vec<MarketPrice> = batch
                        .prices
                        .iter()
                        .filter(|p| market_ids.contains(&p.asset_id))
                        .map(|p| MarketPrice {
                            id: p.asset_id.clone(),
                            source: p.source.clone(),
                            price: p.value.to_string(),
                            change_pct: p.change_pct.map(|v| v.to_string()),
                            volume_24h: p.volume_24h.map(|v| v.to_string()),
                        })
                        .collect();

                    if filtered.is_empty() {
                        continue;
                    }

                    let msg = PriceMessage {
                        r#type: "prices",
                        batch_id: *batch_id,
                        ts: batch.timestamp.to_rfc3339(),
                        markets: filtered,
                    };

                    if let Ok(json) = serde_json::to_string(&msg) {
                        if fwd_tx.send(json).await.is_err() {
                            return; // WS closed
                        }
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(n)) => {
                warn!("WS source listener lagged {} messages for {}", n, source);
            }
            Err(broadcast::error::RecvError::Closed) => {
                break;
            }
        }
    }
}
