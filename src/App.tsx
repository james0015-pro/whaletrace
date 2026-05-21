import { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { QueryProvider } from '@/lib/query';
import { FinvizNav } from '@/components/layout/FinvizNav';
import ScreenerPage from '@/pages/ScreenerPage';
import HeatmapPage from '@/pages/HeatmapPage';
import StockDetailPage from '@/pages/StockDetailPage';
import WatchlistPage from '@/pages/WatchlistPage';

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f6f8fa', color: '#7a8088',
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14,
    }}>
      WHALETRACE LOADING...
    </div>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<LoadingFallback />}>
        <QueryProvider>
          <HashRouter>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f6f8fa' }}>
              <FinvizNav />
              <div style={{ flex: 1 }}>
                <Routes>
                  <Route path="/" element={<ScreenerPage />} />
                  <Route path="/heatmap" element={<HeatmapPage />} />
                  <Route path="/stocks/:ticker" element={<StockDetailPage />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
                </Routes>
              </div>
            </div>
          </HashRouter>
        </QueryProvider>
      </Suspense>
    </I18nextProvider>
  );
}
