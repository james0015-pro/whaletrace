import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { QueryProvider } from '@/lib/query';
import { TopNavBar } from '@/components/layout/TopNavBar';
import FeedPage from '@/pages/FeedPage';
import SignalsPage from '@/pages/SignalsPage';
import InstitutionsPage from '@/pages/InstitutionsPage';
import StockDetailPage from '@/pages/StockDetailPage';
import WatchlistPage from '@/pages/WatchlistPage';
import SettingsPage from '@/pages/SettingsPage';

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#000', color: '#888',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
    }}>
      <span style={{ animation: 'bl-shimmer 1.5s infinite' }}>WHALETRACE LOADING...</span>
    </div>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<LoadingFallback />}>
        <QueryProvider>
          <BrowserRouter>
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>
              <TopNavBar />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Routes>
                  <Route path="/" element={<FeedPage />} />
                  <Route path="/signals" element={<SignalsPage />} />
                  <Route path="/institutions" element={<InstitutionsPage />} />
                  <Route path="/stocks/:ticker" element={<StockDetailPage />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </div>
            </div>
          </BrowserRouter>
        </QueryProvider>
      </Suspense>
    </I18nextProvider>
  );
}
