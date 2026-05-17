import type { ApiError, PaginatedResponse } from '@/types';

// ============================================================
// Fetch Wrapper — base URL, auth, error handling
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Supabase auth token (when user is logged in)
    // In Phase 0, this is a no-op; will be wired in Phase 4
    const token = localStorage.getItem('whaletrace-auth-token');
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = {
        message: `Request failed: ${response.statusText}`,
        code: 'HTTP_ERROR',
        status: response.status,
      };
      try {
        const body = await response.json();
        error.message = body.detail || body.message || error.message;
        error.code = body.code || error.code;
      } catch {
        // no JSON body
      }
      throw error;
    }

    return response.json();
  }

  /** GET request */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>(`${endpoint}${searchParams}`);
  }

  /** POST request */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** PUT request */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** DELETE request */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(BASE_URL);

// ============================================================
// Typed API Endpoints
// ============================================================

import type {
  InsiderTrade,
  ClusterSignal,
  InstitutionalHolding,
  SuperInvestor,
  StockDetail,
  ConfidenceScore,
} from '@/types';

export const endpoints = {
  // Insider trades
  getInsiderTrades: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<InsiderTrade>>('/insider-trades', params),

  // Cluster signals
  getClusterSignals: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<ClusterSignal>>('/cluster-signals', params),

  // Institutional holdings
  getInstitutionalHoldings: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<InstitutionalHolding>>('/institutional', params),

  // Super investors list
  getSuperInvestors: () =>
    api.get<SuperInvestor[]>('/super-investors'),

  // Stock detail (aggregated)
  getStockDetail: (ticker: string) =>
    api.get<StockDetail>(`/stocks/${ticker.toUpperCase()}`),

  // Confidence score
  getConfidenceScore: (ticker: string) =>
    api.get<ConfidenceScore>(`/stocks/${ticker.toUpperCase()}/confidence`),

  // Global search
  search: (q: string) =>
    api.get<{ results: { type: string; data: unknown }[] }>('/search', { q }),

  // User watchlist (auth required — Phase 4)
  getWatchlist: () =>
    api.get<{ tickers: string[] }>('/watchlist'),

  addToWatchlist: (ticker: string) =>
    api.post<{ success: boolean }>('/watchlist', { ticker }),

  removeFromWatchlist: (ticker: string) =>
    api.delete<{ success: boolean }>(`/watchlist/${ticker}`),
};
