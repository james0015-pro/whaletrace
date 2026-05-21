#!/usr/bin/env python3
"""
WhaleTrace — Finviz Scraper

Scrapes https://finviz.com/quote.ashx for institutional & fundamental data.
Uses regex + stdlib — no BeautifulSoup required here (Finviz HTML is deeply
nested div soup; regex is more reliable).

Falls back to realistic mock data on any failure.
"""

import json
import re
import time
import urllib.request
import urllib.error
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FINVIZ_QUOTE_URL = "https://finviz.com/quote.ashx?t={ticker}"
REQUEST_TIMEOUT = 15  # seconds

# Labels we want to extract from the snapshot table, in the order Finviz
# presents them (helps with regex construction).
SNAPSHOT_LABELS = [
    "Market Cap",
    "P/E",
    "Forward P/E",
    "PEG",
    "Beta",
    "RSI (14)",
    "Short Float",
    "Short Ratio",
    "Institutional Ownership",
    "Insider Ownership",
    "Insider Transactions",
    "Debt/Eq",
    "ROE",
    "Profit Margin",
]

# Labels whose values include a literal '%' that the regex must capture.
PERCENT_LABELS = {
    "Short Float",
    "Institutional Ownership",
    "Insider Ownership",
    "Insider Transactions",
    "ROE",
    "Profit Margin",
}


# ---------------------------------------------------------------------------
# Mock data — realistic snapshots for demo / fallback
# ---------------------------------------------------------------------------

MOCK_SNAPSHOTS: dict[str, dict] = {
    "AAPL": {
        "ticker": "AAPL",
        "Market Cap": "2.85T",
        "P/E": "31.52",
        "Forward P/E": "28.14",
        "PEG": "2.87",
        "Beta": "1.24",
        "RSI (14)": "52.30",
        "Short Float": "0.68%",
        "Short Ratio": "1.95",
        "Institutional Ownership": "61.20%",
        "Insider Ownership": "0.07%",
        "Insider Transactions": "-3.15%",
        "Debt/Eq": "1.64",
        "ROE": "157.40%",
        "Profit Margin": "26.30%",
    },
    "MSFT": {
        "ticker": "MSFT",
        "Market Cap": "3.10T",
        "P/E": "38.15",
        "Forward P/E": "32.50",
        "PEG": "2.34",
        "Beta": "0.89",
        "RSI (14)": "61.40",
        "Short Float": "0.55%",
        "Short Ratio": "1.72",
        "Institutional Ownership": "72.90%",
        "Insider Ownership": "0.04%",
        "Insider Transactions": "-4.80%",
        "Debt/Eq": "0.28",
        "ROE": "42.70%",
        "Profit Margin": "36.20%",
    },
    "NVDA": {
        "ticker": "NVDA",
        "Market Cap": "3.65T",
        "P/E": "53.20",
        "Forward P/E": "38.90",
        "PEG": "1.15",
        "Beta": "1.72",
        "RSI (14)": "58.75",
        "Short Float": "1.02%",
        "Short Ratio": "1.10",
        "Institutional Ownership": "66.40%",
        "Insider Ownership": "4.20%",
        "Insider Transactions": "-0.12%",
        "Debt/Eq": "0.16",
        "ROE": "123.50%",
        "Profit Margin": "55.80%",
    },
    "GOOGL": {
        "ticker": "GOOGL",
        "Market Cap": "2.20T",
        "P/E": "26.80",
        "Forward P/E": "22.10",
        "PEG": "1.64",
        "Beta": "1.07",
        "RSI (14)": "49.90",
        "Short Float": "0.42%",
        "Short Ratio": "1.30",
        "Institutional Ownership": "60.80%",
        "Insider Ownership": "0.02%",
        "Insider Transactions": "-1.40%",
        "Debt/Eq": "0.11",
        "ROE": "32.10%",
        "Profit Margin": "28.90%",
    },
    "META": {
        "ticker": "META",
        "Market Cap": "1.55T",
        "P/E": "29.40",
        "Forward P/E": "23.70",
        "PEG": "1.48",
        "Beta": "1.18",
        "RSI (14)": "55.20",
        "Short Float": "0.95%",
        "Short Ratio": "1.50",
        "Institutional Ownership": "74.10%",
        "Insider Ownership": "13.50%",
        "Insider Transactions": "-0.02%",
        "Debt/Eq": "0.23",
        "ROE": "36.40%",
        "Profit Margin": "39.70%",
    },
    # A default fallback used when a ticker isn't in the dict above.
    "_DEFAULT": {
        "ticker": "???",
        "Market Cap": "-",
        "P/E": "-",
        "Forward P/E": "-",
        "PEG": "-",
        "Beta": "-",
        "RSI (14)": "-",
        "Short Float": "-",
        "Short Ratio": "-",
        "Institutional Ownership": "-",
        "Insider Ownership": "-",
        "Insider Transactions": "-",
        "Debt/Eq": "-",
        "ROE": "-",
        "Profit Margin": "-",
    },
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_finviz_snapshot(ticker: str) -> dict:
    """
    Fetch the Finviz snapshot for *ticker*.

    Parameters
    ----------
    ticker : str
        Stock ticker symbol (e.g. "AAPL").

    Returns
    -------
    dict
        Keys include 'ticker' plus every label in SNAPSHOT_LABELS.
        Values are strings (numbers / percentages / dashes).
    """
    ticker = ticker.upper().strip()
    url = FINVIZ_QUOTE_URL.format(ticker=ticker)

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        snapshot = _parse_snapshot(html, ticker)

        # If we got nothing useful, fall back to mock
        if not snapshot or len(snapshot) <= 1:
            return _mock_snapshot(ticker)

        return snapshot

    except (urllib.error.URLError, urllib.error.HTTPError, OSError,
            ValueError, TimeoutError, Exception) as exc:
        print(f"[finviz] Scrape failed for {ticker}: {exc} — falling back to mock")
        return _mock_snapshot(ticker)


# ---------------------------------------------------------------------------
# Regex-based parser for the Finviz snapshot table
# ---------------------------------------------------------------------------

def _parse_snapshot(html: str, ticker: str) -> dict:
    """Extract snapshot values from the raw HTML using regex.

    Finviz uses a deeply nested table of divs/a/spans.  The pattern below
    matches each label and extracts the adjacent value cell.
    """
    result: dict = {"ticker": ticker}

    # Collapse whitespace to make regex more robust
    html_flat = re.sub(r"\s+", " ", html)

    for label in SNAPSHOT_LABELS:
        value = _extract_cell(html_flat, label)
        if value is not None:
            result[label] = value
        else:
            result[label] = "-"

    return result


def _extract_cell(html: str, label: str) -> str | None:
    """Try the primary regex pattern, then a fallback pattern."""
    # Primary pattern — handles the typical markup structure
    escaped = re.escape(label)
    primary_pattern = (
        rf'{escaped}</(?:div|a)></td>'
        rf'\s*<td[^>]*>'
        rf'\s*<div[^>]*>'
        rf'\s*(?:<a[^>]*>)?'
        rf'\s*(?:<b>)?'
        rf'\s*(?:<span[^>]*>)?'
        rf'\s*([\d.,]+[%BMK]?)'
    )
    m = re.search(primary_pattern, html, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # Fallback — looser pattern
    fallback = rf'{escaped}.*?<td[^>]*>.*?<b>\s*([\d.,\-]+[%BMK]?)\s*</b>'
    m = re.search(fallback, html, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # Desperate fallback — grab anything after the label inside a <b>
    fallback2 = rf'{escaped}.*?<b>\s*([\d.,\-]+[%BMK]?)\s*</b>'
    m = re.search(fallback2, html, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return None


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _mock_snapshot(ticker: str) -> dict:
    """Return mock snapshot data for *ticker*."""
    ticker = ticker.upper()
    snap = MOCK_SNAPSHOTS.get(ticker)
    if snap:
        return dict(snap)  # return a copy
    default = dict(MOCK_SNAPSHOTS["_DEFAULT"])
    default["ticker"] = ticker
    return default


# ---------------------------------------------------------------------------
# Convenience: multi-ticker fetch
# ---------------------------------------------------------------------------

TRACKED_TICKERS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA",
    "JPM", "BRK.B", "V", "UNH", "XOM", "WMT", "JNJ", "MA",
    "PG", "HD", "BAC", "DIS", "CRM",
]


def fetch_all_snapshots(tickers: Optional[list[str]] = None) -> list[dict]:
    """Fetch Finviz snapshots for multiple tickers.

    Parameters
    ----------
    tickers : list[str] or None
        Tickers to fetch.  Uses TRACKED_TICKERS by default.

    Returns
    -------
    list[dict]
    """
    tickers = tickers or TRACKED_TICKERS
    results = []
    for t in tickers:
        snap = fetch_finviz_snapshot(t)
        results.append(snap)
        # Small delay to be polite to Finviz
        time.sleep(0.15)
    return results


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== Finviz Scraper — Self-Test ===\n")

    # 1. Try live scrape of AAPL
    print("[1] Fetching live snapshot for AAPL …")
    start = time.time()
    snap = fetch_finviz_snapshot("AAPL")
    elapsed = time.time() - start
    print(f"    Done in {elapsed:.2f}s\n")
    print(json.dumps(snap, indent=2))
    print()

    # 2. Try an obscure ticker (triggers mock)
    print("[2] Mock fallback for ZZZZZZ …")
    snap = fetch_finviz_snapshot("ZZZZZZ")
    print(json.dumps(snap, indent=2))
    print()

    # 3. Multi-ticker (small batch)
    print("[3] Fetching 3 tickers …")
    snaps = fetch_all_snapshots(["AAPL", "MSFT", "XXXXX"])
    for s in snaps:
        print(f"    {s['ticker']}: Market Cap={s.get('Market Cap','?')}, "
              f"Inst Own={s.get('Institutional Ownership','?')}")
    print()

    print("=== Done ===")
