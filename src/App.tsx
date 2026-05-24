import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { QueryProvider } from '@/lib/query';
import { AuthProvider } from '@/contexts/AuthContext';
import { TopNavBar } from '@/components/layout/TopNavBar';

// Code-split pages — each gets its own chunk (feat-014)
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const SignalsPage = lazy(() => import('@/pages/SignalsPage'));
const InstitutionsPage = lazy(() => import('@/pages/InstitutionsPage'));
const StockDetailPage = lazy(() => import('@/pages/StockDetailPage'));
const TreemapPage = lazy(() => import('@/pages/TreemapPage'));
const HeatmapPage = lazy(() => import('@/pages/HeatmapPage'));
const ScreenerPage = lazy(() => import('@/pages/ScreenerPage'));
const WatchlistPage = lazy(() => import('@/pages/WatchlistPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function LoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading WhaleTrace"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#000', color: '#888',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
      }}
    >
      <span style={{ animation: 'bl-shimmer 1.5s infinite' }}>WHALETRACE LOADING...</span>
    </div>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<LoadingFallback />}>
        <QueryProvider>
          <AuthProvider>
          <HashRouter>
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>
              <TopNavBar />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Routes>
                  <Route path="/" element={<FeedPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/signals" element={<SignalsPage />} />
                  <Route path="/institutions" element={<InstitutionsPage />} />
                  <Route path="/stocks/:ticker" element={<StockDetailPage />} />
                  <Route path="/treemap" element={<TreemapPage />} />
                  <Route path="/heatmap" element={<HeatmapPage />} />
                  <Route path="/screener" element={<ScreenerPage />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </div>
            </div>
          </HashRouter>
          </AuthProvider>
        </QueryProvider>
      </Suspense>
    </I18nextProvider>
  );
}
