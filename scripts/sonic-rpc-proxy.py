#!/usr/bin/env python3
"""Rate-limiting caching proxy for Sonic testnet RPC.

Listens on localhost:8547, forwards to Sonic testnet with:
- Response caching (2s TTL) for identical request bodies
- Rate limiting (max 2 requests per second to upstream)
- Thread-safe for multiple clients

Usage: python3 sonic-rpc-proxy.py [port] [upstream_url]
"""

import http.server
import urllib.request
import json
import hashlib
import time
import threading
import sys
import ssl

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8547
UPSTREAM = sys.argv[2] if len(sys.argv) > 2 else "https://rpc.testnet.soniclabs.com"
CACHE_TTL = 1.0  # seconds
RATE_LIMIT = 0.05  # min seconds between upstream requests (20 req/s)

cache = {}  # {body_hash: (response_bytes, timestamp)}
cache_lock = threading.Lock()
rate_lock = threading.Lock()
last_request_time = 0.0

# SSL context for upstream HTTPS
ssl_ctx = ssl.create_default_context()


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        body_hash = hashlib.md5(body).hexdigest()

        # Check cache
        with cache_lock:
            if body_hash in cache:
                cached_resp, cached_at = cache[body_hash]
                if time.time() - cached_at < CACHE_TTL:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("X-Cache", "HIT")
                    self.end_headers()
                    self.wfile.write(cached_resp)
                    return

        # Rate limit
        global last_request_time
        with rate_lock:
            now = time.time()
            wait = RATE_LIMIT - (now - last_request_time)
            if wait > 0:
                time.sleep(wait)
            last_request_time = time.time()

        # Forward to upstream
        try:
            req = urllib.request.Request(
                UPSTREAM,
                data=body,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=10) as resp:
                resp_body = resp.read()

            # Cache response
            with cache_lock:
                cache[body_hash] = (resp_body, time.time())
                # Evict old entries
                cutoff = time.time() - CACHE_TTL * 5
                for k in list(cache.keys()):
                    if cache[k][1] < cutoff:
                        del cache[k]

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Cache", "MISS")
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            error_resp = json.dumps(
                {"jsonrpc": "2.0", "error": {"code": -32603, "message": str(e)}, "id": None}
            ).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(error_resp)

    def do_GET(self):
        """Health check endpoint — return 200 for any GET request."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, format, *args):
        pass  # Suppress access logs


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), ProxyHandler)
    print(f"Sonic RPC proxy: http://127.0.0.1:{PORT} → {UPSTREAM} (cache={CACHE_TTL}s, rate={RATE_LIMIT}s)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
