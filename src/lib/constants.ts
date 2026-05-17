// ============================================================
// WhaleTrace Constants
// ============================================================

/** API base URL — override with VITE_API_URL env var */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/** App metadata */
export const APP_NAME = 'WhaleTrace';
export const APP_TAGLINE = '追蹤華爾街內部人的每一筆交易';
export const APP_DESCRIPTION = '讓散戶在第一時間看見華爾街內部人和大機構每一季真金白銀押注的股票。';

/** Pagination */
export const DEFAULT_PAGE_SIZE = 25;

/** Cache durations (ms) */
export const STALE_TIME = 60_000;        // 1 min — insider data doesn't change by the second
export const GC_TIME = 5 * 60_000;       // 5 min garbage collection
export const REFETCH_INTERVAL = 300_000; // 5 min background refetch
