"""
WhaleTrace scrapers package.

Exports:
    fetch_insider_trades  — OpenInsider insider trade filings
    fetch_finviz_snapshot — Finviz institutional & fundamental snapshot
    fetch_all_snapshots   — Bulk Finviz fetch for tracked tickers
"""

from .openinsider import fetch_insider_trades
from .finviz import fetch_finviz_snapshot, fetch_all_snapshots, TRACKED_TICKERS

__all__ = [
    "fetch_insider_trades",
    "fetch_finviz_snapshot",
    "fetch_all_snapshots",
    "TRACKED_TICKERS",
]
