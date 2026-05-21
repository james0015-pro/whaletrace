#!/usr/bin/env python3
"""
WhaleTrace — Data Server

Lightweight Flask HTTP API that serves scraped data to the React frontend.

Endpoints
---------
  GET /api/insider-trades?ticker=AAPL&limit=20
  GET /api/finviz-snapshot?ticker=AAPL
  GET /api/all-snapshots

Caches results for 5 minutes to avoid hammering upstream sources.

Run
---
  python data_server.py        # starts on 0.0.0.0:8765
"""

import functools
import json
import os
import sys
import threading
import time
from http import HTTPStatus

# Add the parent directory so 'import scrapers' works when run directly.
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

try:
    from flask import Flask, request, jsonify, make_response
except ImportError:
    print("Flask is not installed. Install it with: pip install flask")
    print("Falling back to http.server (limited functionality)")
    _use_http_server_fallback()
    sys.exit(0)

# Import scrapers (mock fallbacks are built into each module)
from scrapers.openinsider import fetch_insider_trades
from scrapers.finviz import fetch_finviz_snapshot, fetch_all_snapshots, TRACKED_TICKERS

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
app.config["JSONIFY_PRETTYPRINT_REGULAR"] = True


# ---------------------------------------------------------------------------
# Simple TTL cache
# ---------------------------------------------------------------------------

class TTLCache:
    """A thread-safe in-memory cache with per-key TTL."""

    def __init__(self, ttl_seconds: int = 300):
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            ts, value = entry
            if time.time() - ts > self._ttl:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: object):
        with self._lock:
            self._store[key] = (time.time(), value)

    def clear(self):
        with self._lock:
            self._store.clear()


CACHE_TTL = int(os.environ.get("WHALETRACE_CACHE_TTL", "300"))  # 5 min default
cache = TTLCache(CACHE_TTL)


def cached(prefix: str):
    """Decorator that caches function results keyed by (prefix, *args)."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"{prefix}:{':'.join(str(a) for a in args)}"
            cached_val = cache.get(cache_key)
            if cached_val is not None:
                return cached_val
            result = func(*args, **kwargs)
            cache.set(cache_key, result)
            return result

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# CORS helper
# ---------------------------------------------------------------------------

def add_cors(response):
    """Add permissive CORS headers so the React frontend can call us."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Requested-With"
    )
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


@app.after_request
def after_request(response):
    return add_cors(response)


@app.route("/api/<path:dummy>", methods=["OPTIONS"])
@app.route("/api/<path:dummy>/", methods=["OPTIONS"])
def handle_options(dummy=None):
    """Respond to CORS preflight requests."""
    resp = make_response("", 204)
    return add_cors(resp)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/insider-trades")
def insider_trades_endpoint():
    """
    GET /api/insider-trades?ticker=AAPL&limit=20

    Returns a JSON array of insider trade objects.
    """
    ticker = request.args.get("ticker", "").strip().upper() or None
    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))

    @cached("insider")
    def _fetch(ticker, limit):
        return fetch_insider_trades(ticker=ticker, limit=limit)

    data = _fetch(ticker, limit)
    return jsonify(data)


@app.route("/api/finviz-snapshot")
def finviz_snapshot_endpoint():
    """
    GET /api/finviz-snapshot?ticker=AAPL

    Returns a JSON object with Finviz snapshot data.
    """
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Missing ticker parameter"}), 400

    @cached("finviz")
    def _fetch(ticker):
        return fetch_finviz_snapshot(ticker)

    data = _fetch(ticker)
    return jsonify(data)


@app.route("/api/all-snapshots")
def all_snapshots_endpoint():
    """
    GET /api/all-snapshots

    Returns a JSON array of Finviz snapshots for all tracked tickers.
    """
    tickers_param = request.args.get("tickers", "").strip()
    if tickers_param:
        tickers = [t.strip().upper() for t in tickers_param.split(",") if t.strip()]
    else:
        tickers = TRACKED_TICKERS

    @cached("all_snaps")
    def _fetch(tickers_tuple):
        return fetch_all_snapshots(list(tickers_tuple))

    data = _fetch(tuple(tickers))
    return jsonify(data)


@app.route("/health")
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok", "ts": time.time(), "cache_ttl": CACHE_TTL})


# ---------------------------------------------------------------------------
# Fallback: pure-stdlib HTTP server (used when Flask is unavailable)
# ---------------------------------------------------------------------------

def _use_http_server_fallback():
    """Start a bare-bones http.server on port 8765 when Flask is missing."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith("/health"):
                self._json({"status": "ok", "ts": time.time(), "note": "stdlib fallback"})
            elif self.path.startswith("/api/insider-trades"):
                ticker = self._qs("ticker") or None
                limit = int(self._qs("limit") or "20")
                data = fetch_insider_trades(ticker=ticker, limit=limit)
                self._json(data)
            elif self.path.startswith("/api/finviz-snapshot"):
                ticker = self._qs("ticker") or ""
                data = fetch_finviz_snapshot(ticker)
                self._json(data)
            elif self.path.startswith("/api/all-snapshots"):
                data = fetch_all_snapshots()
                self._json(data)
            else:
                self._json({"error": "not found"}, 404)

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.end_headers()

        def _json(self, data, status=200):
            body = json.dumps(data, indent=2, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers",
                             "Content-Type, Authorization")

        def _qs(self, key, default=""):
            import urllib.parse
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            return params.get(key, [default])[0]

        def log_message(self, fmt, *args):
            pass  # suppress logs

    host = "0.0.0.0"
    port = 8765
    server = HTTPServer((host, port), Handler)
    print(f"[data_server] stdlib fallback server running on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    host = os.environ.get("WHALETRACE_HOST", "0.0.0.0")
    port = int(os.environ.get("WHALETRACE_PORT", "8765"))
    debug = os.environ.get("WHALETRACE_DEBUG", "").lower() in ("1", "true", "yes")

    print(f"[data_server] WhaleTrace API server starting on http://{host}:{port}")
    print(f"  Endpoints:")
    print(f"    GET /api/insider-trades?ticker=AAPL&limit=20")
    print(f"    GET /api/finviz-snapshot?ticker=AAPL")
    print(f"    GET /api/all-snapshots")
    print(f"    GET /health")
    print(f"  Cache TTL: {CACHE_TTL}s")
    print(f"  Debug: {debug}")
    print()

    app.run(host=host, port=port, debug=debug)
