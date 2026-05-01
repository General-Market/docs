vcl 4.1;

# Public-facing cache for the Vision data-node.
# Only whitelisted GETs are served; everything else returns 404 at the edge.

import std;

backend datanode {
    .host = "159.195.78.238";
    .port = "80";
    .host_header = "159.195.78.238";
    .connect_timeout = 5s;
    .first_byte_timeout = 20s;
    .between_bytes_timeout = 10s;
    .probe = {
        .url = "/data-node/health";
        .interval = 30s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

acl purgers {
    "127.0.0.1";
}

sub vcl_recv {
    # GET/HEAD only.
    if (req.method != "GET" && req.method != "HEAD" && req.method != "PURGE") {
        return (synth(405, "Method Not Allowed"));
    }
    if (req.method == "PURGE") {
        if (!client.ip ~ purgers) { return (synth(403, "Forbidden")); }
        return (purge);
    }

    # Endpoint whitelist. Everything else is 404 at the edge — the origin
    # never sees it, no request amplification possible.
    if (req.url !~ "^/batches/recommended($|\?)"
     && req.url !~ "^/vision/snapshot($|\?)"
     && req.url !~ "^/market/batch-history($|\?)"
     && req.url !~ "^/health($|\?)") {
        return (synth(404, "Not a public endpoint"));
    }

    # Strip client cookies — they're irrelevant here and would bust the
    # cache key unnecessarily.
    unset req.http.Cookie;

    # Rewrite /bot-api/* → /data-node/* (origin prefix).
    set req.url = "/data-node" + req.url;

    set req.backend_hint = datanode;
    return (hash);
}

sub vcl_backend_response {
    # TTL policy, tuned for data-node semantics.
    # Immutable historical data (batch-history with old `from=`) gets long
    # cache. Live snapshots get short cache. Everything else is moderate.
    set beresp.ttl = 60s;
    set beresp.grace = 10m;          # serve-while-revalidate on origin blip
    set beresp.keep = 1h;             # keep longer for if-none-match replays

    if (bereq.url ~ "^/data-node/health") {
        set beresp.ttl = 10s;
    }
    else if (bereq.url ~ "^/data-node/vision/snapshot") {
        # Snapshot fields change every data-node poll (~10–60s).
        set beresp.ttl = 45s;
    }
    else if (bereq.url ~ "^/data-node/batches/recommended") {
        # Config rotates on each tick (60s) — cache just under.
        set beresp.ttl = 30s;
    }
    else if (bereq.url ~ "^/data-node/market/batch-history") {
        # If `from=` is more than 2h in the past, treat as historical —
        # older rows are immutable. Short horizon stays live-ish.
        if (bereq.url ~ "from=20[0-9]{2}-[0-9]{2}-[0-9]{2}T") {
            # Rough heuristic: anything explicit is probably a backtest
            # fetch; long TTL is fine because historical rows don't rewrite.
            set beresp.ttl = 6h;
            set beresp.grace = 24h;
        } else {
            set beresp.ttl = 2m;
        }
    }

    # Convert 5xx into shorter-lived negative cache, so origin hiccups
    # don't poison the cache for long.
    if (beresp.status >= 500) {
        set beresp.ttl = 10s;
        set beresp.grace = 5m;
    }

    # Allow gzip pass-through; origin may or may not send it.
    if (beresp.http.Content-Type ~ "application/json"
     || beresp.http.Content-Type ~ "text/plain") {
        set beresp.do_gzip = true;
    }

    return (deliver);
}

sub vcl_deliver {
    # Observability — reveals hit vs miss to operators via curl -I.
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
    set resp.http.X-Cache-Hits = obj.hits;

    # Scrub internals.
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.Server;
    return (deliver);
}

sub vcl_synth {
    set resp.http.Content-Type = "application/json";
    synthetic({"{"error":""} + resp.reason + {"","status":"} + resp.status + "}");
    return (deliver);
}
