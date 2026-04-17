//! Empirical rate-limit test for tube-site scraping.
//!
//! Ramps request rate against a target tube site and logs per-request results
//! to a CSV. The goal is to find the ceiling before Cloudflare (or the site)
//! starts issuing 429s, 403s, or JavaScript challenges.
//!
//! Run from the IP you actually plan to scrape from (production VPS).
//! Results are wildly different between datacenter IPs and residential IPs.
//!
//! Usage:
//!   cargo run --release --example test_tube_scrape -- \
//!       --site pornhub \
//!       --urls-file data/test-urls-pornhub.txt \
//!       --output data/tube-rate-test-pornhub.csv
//!
//! The ramp schedule: 0.5 → 1 → 2 → 5 → 10 req/sec, 60s per step, then stop.
//! Each step records success rate, CF-challenge rate, and per-request latency.

use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use chrono::Utc;
use clap::Parser;
use regex::Regex;
use reqwest::Client;
use tokio::sync::Mutex;

#[derive(Parser, Debug)]
#[command(about = "Tube-site rate-limit ramp test")]
struct Args {
    /// Site identifier: pornhub | xvideos | xhamster | xnxx | redtube | youporn | eporner | txxx
    #[arg(long)]
    site: String,

    /// File with one video URL per line
    #[arg(long)]
    urls_file: PathBuf,

    /// Output CSV path
    #[arg(long, default_value = "tube-rate-test.csv")]
    output: PathBuf,

    /// Skip the ramp, use a fixed rate (req/sec)
    #[arg(long)]
    fixed_rps: Option<f64>,

    /// Seconds per ramp step
    #[arg(long, default_value_t = 60)]
    step_secs: u64,

    /// Stop early if challenge rate exceeds this fraction (0.0-1.0)
    #[arg(long, default_value_t = 0.5)]
    stop_challenge_rate: f64,
}

/// Known view-count regex per site. None means unparsed — request still counts.
fn view_count_regex(site: &str) -> Option<Regex> {
    match site {
        "pornhub" => Regex::new(r#""viewCount":"?(\d+)"?"#).ok(),
        "xvideos" => Regex::new(r#"video_views"[^"]*"[^"]*":(\d+)"#).ok(),
        "xhamster" => Regex::new(r#""views"\s*:\s*(\d+)"#).ok(),
        "xnxx" => Regex::new(r#"<strong class="mobile-hide">([\d,]+)</strong>"#).ok(),
        "redtube" => Regex::new(r#""views"\s*:\s*(\d+)"#).ok(),
        "youporn" => Regex::new(r#"data-video-views="(\d+)""#).ok(),
        "eporner" => Regex::new(r#"(\d[\d,]*)\s*views"#).ok(),
        "txxx" => Regex::new(r#""views":(\d+)"#).ok(),
        _ => None,
    }
}

/// Detect a Cloudflare (or generic anti-bot) interstitial in the response body.
fn is_challenge(body: &str) -> bool {
    let lower_hint = body.len().min(4096);
    let head = &body[..lower_hint];
    head.contains("Just a moment")
        || head.contains("cf-browser-verification")
        || head.contains("cf_chl_")
        || head.contains("challenge-platform")
        || head.contains("Please turn JavaScript on")
        || head.contains("Attention Required! | Cloudflare")
}

fn ramp_schedule(fixed: Option<f64>, step_secs: u64) -> Vec<(f64, u64)> {
    if let Some(r) = fixed {
        return vec![(r, step_secs * 10)];
    }
    vec![
        (0.5, step_secs),
        (1.0, step_secs),
        (2.0, step_secs),
        (5.0, step_secs),
        (10.0, step_secs),
    ]
}

#[derive(Clone)]
struct Counters {
    total: Arc<AtomicU64>,
    ok: Arc<AtomicU64>,
    http_429: Arc<AtomicU64>,
    http_403: Arc<AtomicU64>,
    http_5xx: Arc<AtomicU64>,
    challenge: Arc<AtomicU64>,
    net_err: Arc<AtomicU64>,
}

impl Counters {
    fn new() -> Self {
        Self {
            total: Arc::new(AtomicU64::new(0)),
            ok: Arc::new(AtomicU64::new(0)),
            http_429: Arc::new(AtomicU64::new(0)),
            http_403: Arc::new(AtomicU64::new(0)),
            http_5xx: Arc::new(AtomicU64::new(0)),
            challenge: Arc::new(AtomicU64::new(0)),
            net_err: Arc::new(AtomicU64::new(0)),
        }
    }

    fn snapshot(&self) -> (u64, u64, u64, u64, u64, u64, u64) {
        (
            self.total.load(Ordering::Relaxed),
            self.ok.load(Ordering::Relaxed),
            self.http_429.load(Ordering::Relaxed),
            self.http_403.load(Ordering::Relaxed),
            self.http_5xx.load(Ordering::Relaxed),
            self.challenge.load(Ordering::Relaxed),
            self.net_err.load(Ordering::Relaxed),
        )
    }
}

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> Result<()> {
    let args = Args::parse();

    let urls: Vec<String> = BufReader::new(
        File::open(&args.urls_file)
            .with_context(|| format!("open {}", args.urls_file.display()))?,
    )
    .lines()
    .filter_map(|l| l.ok())
    .map(|l| l.trim().to_string())
    .filter(|l| !l.is_empty() && !l.starts_with('#'))
    .collect();

    if urls.is_empty() {
        anyhow::bail!("no URLs in {}", args.urls_file.display());
    }
    println!("Loaded {} URLs for site={}", urls.len(), args.site);

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        .build()?;

    let view_re = view_count_regex(&args.site);
    let counters = Counters::new();
    let csv = Arc::new(Mutex::new(File::create(&args.output)?));
    writeln!(
        csv.lock().await,
        "ts,step_rps,req_num,status,elapsed_ms,bytes,cf_ray,challenge,view_count,url"
    )?;

    let schedule = ramp_schedule(args.fixed_rps, args.step_secs);
    let mut cursor: usize = 0;

    'outer: for (rps, duration_s) in schedule {
        println!("\n=== Step: {:.2} req/sec for {}s ===", rps, duration_s);
        let step_start = Instant::now();
        let step_counters = Counters::new();
        let delay_ms = (1000.0 / rps) as u64;

        while step_start.elapsed() < Duration::from_secs(duration_s) {
            let url = urls[cursor % urls.len()].clone();
            cursor += 1;

            let client = client.clone();
            let view_re = view_re.clone();
            let counters = counters.clone();
            let step_counters = step_counters.clone();
            let csv = csv.clone();
            let site = args.site.clone();
            let req_num = counters.total.fetch_add(1, Ordering::Relaxed) + 1;
            step_counters.total.fetch_add(1, Ordering::Relaxed);

            tokio::spawn(async move {
                let t0 = Instant::now();
                let ts = Utc::now().to_rfc3339();
                let result = client.get(&url).send().await;

                let (status, bytes, cf_ray, challenge, view_count, net_err_msg) = match result {
                    Ok(resp) => {
                        let status = resp.status().as_u16();
                        let cf_ray = resp
                            .headers()
                            .get("cf-ray")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("")
                            .to_string();
                        let body = resp.text().await.unwrap_or_default();
                        let bytes = body.len();
                        let is_challenge = is_challenge(&body);
                        let view_count = view_re
                            .as_ref()
                            .and_then(|re| re.captures(&body))
                            .and_then(|c| c.get(1))
                            .map(|m| m.as_str().replace(',', ""))
                            .unwrap_or_default();

                        match (status, is_challenge) {
                            (_, true) => {
                                counters.challenge.fetch_add(1, Ordering::Relaxed);
                                step_counters.challenge.fetch_add(1, Ordering::Relaxed);
                            }
                            (200..=299, false) => {
                                counters.ok.fetch_add(1, Ordering::Relaxed);
                                step_counters.ok.fetch_add(1, Ordering::Relaxed);
                            }
                            (429, _) => {
                                counters.http_429.fetch_add(1, Ordering::Relaxed);
                                step_counters.http_429.fetch_add(1, Ordering::Relaxed);
                            }
                            (403, _) => {
                                counters.http_403.fetch_add(1, Ordering::Relaxed);
                                step_counters.http_403.fetch_add(1, Ordering::Relaxed);
                            }
                            (s, _) if s >= 500 => {
                                counters.http_5xx.fetch_add(1, Ordering::Relaxed);
                                step_counters.http_5xx.fetch_add(1, Ordering::Relaxed);
                            }
                            _ => {}
                        }

                        (status, bytes, cf_ray, is_challenge, view_count, String::new())
                    }
                    Err(e) => {
                        counters.net_err.fetch_add(1, Ordering::Relaxed);
                        step_counters.net_err.fetch_add(1, Ordering::Relaxed);
                        (0, 0, String::new(), false, String::new(), e.to_string())
                    }
                };

                let elapsed_ms = t0.elapsed().as_millis();
                let line = format!(
                    "{},{:.2},{},{},{},{},{},{},{},{}\n",
                    ts,
                    0.0, // step rps is known at step level; unused in row for simplicity
                    req_num,
                    if status == 0 {
                        format!("ERR:{}", net_err_msg.chars().take(40).collect::<String>())
                    } else {
                        status.to_string()
                    },
                    elapsed_ms,
                    bytes,
                    cf_ray,
                    if challenge { "1" } else { "0" },
                    view_count,
                    url
                );
                let _ = csv.lock().await.write_all(line.as_bytes());

                if req_num % 20 == 0 {
                    let (t, ok, r429, r403, r5xx, ch, ne) = counters.snapshot();
                    println!(
                        "  [{}] site={} n={} ok={} 429={} 403={} 5xx={} chal={} neterr={}",
                        ts, site, t, ok, r429, r403, r5xx, ch, ne
                    );
                }
            });

            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }

        // Short drain so spawned tasks finish before next step rolls
        tokio::time::sleep(Duration::from_secs(2)).await;

        let (t, ok, r429, r403, r5xx, ch, ne) = step_counters.snapshot();
        let chal_rate = if t > 0 { ch as f64 / t as f64 } else { 0.0 };
        println!(
            "=== Step done @ {:.2} rps: n={} ok={} 429={} 403={} 5xx={} chal={} ({:.1}%) neterr={}",
            rps,
            t,
            ok,
            r429,
            r403,
            r5xx,
            ch,
            chal_rate * 100.0,
            ne
        );

        if chal_rate >= args.stop_challenge_rate {
            println!(
                "!! Challenge rate {:.1}% ≥ stop threshold {:.0}%, aborting ramp.",
                chal_rate * 100.0,
                args.stop_challenge_rate * 100.0
            );
            break 'outer;
        }
    }

    // Final drain
    tokio::time::sleep(Duration::from_secs(3)).await;

    let (t, ok, r429, r403, r5xx, ch, ne) = counters.snapshot();
    println!(
        "\n=== TOTALS: n={} ok={} 429={} 403={} 5xx={} chal={} neterr={} ===",
        t, ok, r429, r403, r5xx, ch, ne
    );
    println!("CSV: {}", args.output.display());

    Ok(())
}
