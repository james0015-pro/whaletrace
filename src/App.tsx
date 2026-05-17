import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryProvider } from '@/lib/query';
import { AppShell } from '@/components/layout/AppShell';
import FeedPage from '@/pages/FeedPage';
import SignalsPage from '@/pages/SignalsPage';
import InstitutionsPage from '@/pages/InstitutionsPage';
import StockDetailPage from '@/pages/StockDetailPage';
import WatchlistPage from '@/pages/WatchlistPage';
import SettingsPage from '@/pages/SettingsPage';

// i18n — must be imported before any useTranslation() call
import '@/i18n';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <div className="text-text-muted text-sm animate-pulse">Loading...</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <QueryProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<FeedPage />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/institutions" element={<InstitutionsPage />} />
              <Route path="/stocks/:ticker" element={<StockDetailPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </QueryProvider>
    </Suspense>
  );
}
