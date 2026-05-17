# WhaleTrace 開發計畫（v2 — 鯨魚共振訊號雷達）

> Cursor Agent mode 專用。每個 Phase 獨立，按順序開發。
> 每個 Phase 完成後跑 `npm run build` 必須零錯誤才能繼續。
>
> **產品定位：** 自動偵測機構合計買入超過 1 億美元、且內部高管同步跟進買入的股票，呈現「鯨魚共振訊號」排行榜。
> **產品感受：** 彭博終端機——冷靜、數據密度高、專業。暗色主題。

---

## Phase 0：專案腳手架 ✅ 已完成

專案已建立：React 19 + Vite + TypeScript + Tailwind CSS v3 + React Router v7 + TanStack Query + framer-motion + lucide-react

現有檔案結構：
```
src/
├── App.tsx                          # 路由配置
├── main.tsx                         # 入口
├── index.css                        # Design Token 系統
├── types/index.ts                   # 型別定義
├── lib/
│   ├── utils.ts                     # cn(), formatCurrency(), formatDate()...
│   ├── constants.ts                 # API URL, pagination, cache durations
│   ├── query.tsx                    # TanStack Query Provider
│   ├── api.ts                       # API client
│   └── mock-data.ts                 # 500 筆 mock 交易 + 分頁
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   └── TopNavBar.tsx            # 含全域搜尋（搜股票/公司/內部人）
│   ├── shared/
│   │   ├── Skeleton.tsx             # card/text/chart 三種 variant
│   │   ├── EmptyState.tsx
│   │   └── SignalBadge.tsx
│   └── features/
│       ├── TradeCard.tsx            # 交易卡片（左色條、ARE樣式、動畫）
│       ├── ConfidenceRing.tsx       # 信心分數環形圖 SVG
│       ├── InsiderTimeline.tsx      # 內部人時間軸
│       └── HoldingsTable.tsx        # 機構持股表格（桌面+手機）
├── hooks/
│   └── useInsiderTrades.ts          # useInfiniteQuery 分頁
└── pages/
    ├── FeedPage.tsx                 # 交易動態牆（Virtuoso 虛擬滾動）
    ├── SignalsPage.tsx              # 群組信號頁
    ├── InstitutionsPage.tsx         # 超級投資人頁（25位）
    ├── StockDetailPage.tsx          # 股票詳情頁
    ├── WatchlistPage.tsx            # 關注清單（Phase 0 placeholder）
    └── SettingsPage.tsx             # 設定頁（Phase 0 placeholder）
```

已完成依賴：react-virtuoso, date-fns（date-fns 已有）

---

## Phase 1：交易卡片 + 虛擬滾動動態牆 ✅ 已完成

（略，詳見原始 PLAN.md Phase 1）

---

## Phase 2：股票詳情頁 ✅ 已完成

（略，詳見原始 PLAN.md Phase 2）

---

## Phase 3：群組信號 + 機構頁面 + 全域搜尋 ✅ 已完成

（略，詳見原始 PLAN.md Phase 3）

---

## Phase 4：認證 + 關注清單 + Telegram 推播 🚧 接下來

### 4-1 安裝依賴

```bash
npm install @supabase/supabase-js
```

### 4-2 Supabase Client + Auth Context

**新建 `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**新建 `.env`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**新建 `src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    window.location.href = '/login';
    return null;
  }
  return <>{children}</>;
}
```

### 4-3 登入/註冊頁面

**新建 `src/pages/LoginPage.tsx`**

（貼上完整檔案內容）
```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('請輸入有效的 Email');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }

    setLoading(true);
    const result = isLogin ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);

    if (result.error) {
      setError(isLogin ? '登入失敗，請檢查 Email 和密碼' : '註冊失敗，可能此 Email 已被使用');
    } else if (!isLogin) {
      setError('註冊成功！請檢查 Email 信箱完成驗證，然後登入。');
      setIsLogin(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl">🐋</span>
          <h1 className="text-heading-2 text-text-primary mt-3">WhaleTrace</h1>
          <p className="text-text-tertiary text-sm mt-1">追蹤華爾街內部人的每一筆交易</p>
        </div>

        <div className="bg-surface border border-border-subtle rounded-card p-6">
          <div className="flex mb-6 border-b border-border-subtle">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                isLogin ? 'text-green-primary border-b-2 border-green-primary' : 'text-text-muted'
              }`}
            >
              登入
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                !isLogin ? 'text-green-primary border-b-2 border-green-primary' : 'text-text-muted'
              }`}
            >
              註冊
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-input bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-input bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary transition-colors"
                placeholder="至少 8 個字元"
                required
              />
            </div>

            {error && (
              <p className={`text-xs ${error.includes('成功') ? 'text-green-primary' : 'text-red-primary'}`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-button bg-green-primary text-white text-sm font-medium hover:bg-green-hover transition-colors disabled:opacity-50"
            >
              {loading ? '處理中...' : isLogin ? '登入' : '註冊'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

**修改 `src/App.tsx`**：在 `<Routes>` 中加入 `<Route path="/login" element={<LoginPage />} />`。用 `<AuthProvider>` 包住 `<QueryProvider>`。

### 4-4 關注清單 Hook

**新建 `src/hooks/useWatchlist.ts`**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { InsiderTrade } from '@/types';

const WATCHLIST_KEY = ['watchlist'];

export function useWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: WATCHLIST_KEY,
    queryFn: async () => {
      if (!user) return [];
      // Mock: if no Supabase, use local array
      const { data } = await supabase.from('watchlist').select('ticker, added_at').eq('user_id', user.id);
      return (data ?? []) as { ticker: string; added_at: string }[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async (ticker: string) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('watchlist').upsert({ user_id: user.id, ticker, added_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHLIST_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WATCHLIST_KEY }),
  });

  const isWatched = (ticker: string) => watchlist.some((w) => w.ticker === ticker);

  return { watchlist, isLoading, addToWatchlist: addMutation.mutate, removeFromWatchlist: removeMutation.mutate, isWatched };
}
```

### 4-5 關注清單頁面改寫

**覆蓋 `src/pages/WatchlistPage.tsx`**

（將 Phase 0 placeholder 換成真實版本）
```tsx
import { useAuth } from '@/lib/auth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/shared/Skeleton';
import { MOCK_TRADES } from '@/lib/mock-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Star, Trash2 } from 'lucide-react';

export default function WatchlistPage() {
  const { user } = useAuth();
  const { watchlist, isLoading, removeFromWatchlist } = useWatchlist();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <EmptyState
          icon="🔒"
          title="請先登入"
          description="登入後即可建立個人關注清單，追蹤華爾街最重要的股票動態"
          action={
            <a href="/login" className="inline-block px-4 py-2 rounded-button bg-green-primary text-white text-sm font-medium hover:bg-green-hover transition-colors">
              登入
            </a>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div className="h-8 w-32 rounded skeleton mb-4" />
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-2 text-text-primary mb-1">我的關注清單</h1>
          <p className="text-text-tertiary text-sm">共 {watchlist.length} 檔</p>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="尚未關注任何股票"
          description="在股票詳情頁點擊星號即可關注"
        />
      ) : (
        <div className="space-y-3">
          {watchlist.map((w) => {
            const ticker = w.ticker;
            // 找出該 ticker 的最新交易作為摘要
            const latestTrade = MOCK_TRADES.find((t) => t.ticker === ticker);
            const tradeCount = MOCK_TRADES.filter((t) => t.ticker === ticker).length;

            return (
              <div
                key={ticker}
                onClick={() => navigate(`/stocks/${ticker}`)}
                className="p-4 rounded-card bg-surface border border-border-subtle hover:border-border-default cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-medium text-text-primary">{ticker}</span>
                      <span className="text-sm text-text-tertiary truncate">
                        {latestTrade?.company_name ?? ticker}
                      </span>
                    </div>
                    {latestTrade && (
                      <p className="text-xs text-text-muted mt-1">
                        最近：{latestTrade.insider_name} · {latestTrade.transaction_type === 'BUY' ? '🟢 買入' : '🔴 賣出'}{' '}
                        {formatCurrency(latestTrade.total_value)} · {formatDate(latestTrade.trade_date)} · 共 {tradeCount} 筆交易
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromWatchlist(ticker); }}
                    className="p-1.5 text-text-muted hover:text-red-primary transition-colors"
                    title="取消關注"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### 4-6 在股票詳情頁加入關注按鈕

**修改 `src/pages/StockDetailPage.tsx`**：在股票代號旁加入 ⭐ 按鈕，使用 `useWatchlist` hook。

在頂部的 ticker + company_name 旁新增：
```tsx
import { Star } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';

// 在元件內：
const { isWatched, addToWatchlist, removeFromWatchlist } = useWatchlist();

// 在 h1 旁：
<button
  onClick={() => isWatched(stock.ticker) ? removeFromWatchlist(stock.ticker) : addToWatchlist(stock.ticker)}
  className={cn('p-1 transition-colors', isWatched(stock.ticker) ? 'text-amber-primary' : 'text-text-muted hover:text-amber-primary')}
  title={isWatched(stock.ticker) ? '取消關注' : '關注'}
>
  <Star size={20} fill={isWatched(stock.ticker) ? 'currentColor' : 'none'} />
</button>
```

### 4-7 設定頁改寫（含 Telegram 推播設定）

**覆蓋 `src/pages/SettingsPage.tsx`**

設定頁內容：
- 若未登入：顯示登入提示
- 已登入：
  - Email 顯示
  - Telegram 綁定區塊（狀態、綁定按鈕、通知開關）
  - 密碼修改
  - 登出按鈕

Telegram 通知開關（checkbox）：
- ☑ 關注股票有機構買入時通知
- ☑ 關注股票有內部人買入時通知
- ☐ 關注股票有賣出時通知
- ☑ 共振訊號觸發時通知

```tsx
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/shared/EmptyState';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [notifyInstBuy, setNotifyInstBuy] = useState(true);
  const [notifyInsBuy, setNotifyInsBuy] = useState(true);
  const [notifySell, setNotifySell] = useState(false);
  const [notifyResonance, setNotifyResonance] = useState(true);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <EmptyState icon="🔒" title="請先登入" description="登入後即可管理通知與帳號設定"
          action={<a href="/login" className="inline-block px-4 py-2 rounded-button bg-green-primary text-white text-sm font-medium hover:bg-green-hover transition-colors">登入</a>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      <h1 className="text-heading-2 text-text-primary">設定</h1>

      {/* 推播通知 */}
      <section className="p-4 rounded-card bg-surface border border-border-subtle">
        <h2 className="text-sm font-medium text-text-primary mb-3">🔔 推播通知</h2>

        <div className="space-y-3">
          <Toggle label="關注股票有機構買入時通知" checked={notifyInstBuy} onChange={setNotifyInstBuy} />
          <Toggle label="關注股票有內部人買入時通知" checked={notifyInsBuy} onChange={setNotifyInsBuy} />
          <Toggle label="關注股票有賣出時通知" checked={notifySell} onChange={setNotifySell} />
          <Toggle label="共振訊號觸發時通知" checked={notifyResonance} onChange={setNotifyResonance} />
        </div>
      </section>

      {/* 帳號 */}
      <section className="p-4 rounded-card bg-surface border border-border-subtle">
        <h2 className="text-sm font-medium text-text-primary mb-3">👤 帳號</h2>
        <p className="text-xs text-text-muted mb-3">Email：{user.email}</p>
        <div className="flex gap-3">
          <button className="px-3 py-1.5 text-xs rounded-button border border-border-default text-text-secondary hover:text-text-primary transition-colors">
            修改密碼
          </button>
          <button onClick={signOut} className="px-3 py-1.5 text-xs rounded-button border border-red-primary/30 text-red-primary hover:bg-red-subtle transition-colors">
            登出
          </button>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-primary' : 'bg-border-default'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-xs text-text-secondary">{label}</span>
    </label>
  );
}
```

### 4-8 Telegram 推播（n8n workflow）

建立 n8n workflow `whaletrace-push`：

- 定時觸發（每 15 分鐘）
- Supabase 查詢 `watchlist` 表（所有 user_id、ticker、telegram_chat_id）
- 從 MOCK_TRADES 篩選關注股票的最新交易（過去 15 分鐘內的）
- Telegram Bot 發送訊息到對應 chat_id
- 訊息格式：`🐋 {TICKER} · {INSIDER_NAME} {TITLE} {買入/賣出} {AMOUNT} · {SHARES} 股 · {TIME}前`

### Phase 4 驗證

```bash
npm run build   # 必須零錯誤
npm run dev     # 確認：
                #   - /login 可註冊/登入
                #   - /watchlist 顯示個人關注清單（未登入顯示登入提示）
                #   - /stocks/:ticker 有 ⭐ 關注按鈕
                #   - /settings 可設定通知偏好、登出
```

---

## Phase 5：鯨魚共振訊號 + 歷史 + 股價圖 🎯 MVP

### 5-1 新增型別

**修改 `src/types/index.ts`**，新增：

```ts
export interface ResonanceSignal {
  id: number;
  ticker: string;
  company_name: string;
  signal_date: string;
  total_institution_buy: number;
  institutions: { name: string; amount: number }[];
  insider_count: number;
  insider_names: string[];
  signal_strength: number; // 0-100
  // 績效追蹤（mock）
  price_on_signal: number;
  price_3m?: number;
  price_6m?: number;
  price_12m?: number;
}
```

### 5-2 Mock 共振訊號產生器

**新建 `src/lib/resonance-mock.ts`**

```ts
import { MOCK_TRADES } from '@/lib/mock-data';
import type { ResonanceSignal } from '@/types';

const INSTITUTION_NAMES = [
  'Vanguard Group', 'BlackRock', 'State Street', 'Fidelity',
  'Capital World', 'T. Rowe Price', 'Wellington', 'Baillie Gifford',
  'JPMorgan Asset', 'Goldman Sachs AM',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateResonanceSignals(): ResonanceSignal[] {
  // 按 ticker 分組，計算機構買入總額
  const byTicker = new Map<string, { total: number; institutions: { name: string; amount: number }[]; insiders: Set<string> }>();

  for (const t of MOCK_TRADES) {
    if (t.transaction_type !== 'BUY') continue;

    if (!byTicker.has(t.ticker)) {
      byTicker.set(t.ticker, { total: 0, institutions: [], insiders: new Set() });
    }
    const entry = byTicker.get(t.ticker)!;

    // 隨機決定是否為機構買入（約 60% 機率）
    if (Math.random() < 0.6) {
      const instName = INSTITUTION_NAMES[randInt(0, INSTITUTION_NAMES.length - 1)];
      const amount = randInt(50_000_000, 3_000_000_000);
      entry.total += amount;
      const existing = entry.institutions.find((i) => i.name === instName);
      if (existing) {
        existing.amount += amount;
      } else {
        entry.institutions.push({ name: instName, amount });
      }
    } else {
      entry.insiders.add(t.insider_name);
    }
  }

  const signals: ResonanceSignal[] = [];
  let id = 0;

  for (const [ticker, entry] of byTicker) {
    if (entry.total >= 100_000_000 && entry.insiders.size > 0) {
      const price = randInt(10, 3000);
      signals.push({
        id: ++id,
        ticker,
        company_name: MOCK_TRADES.find((t) => t.ticker === ticker)?.company_name ?? ticker,
        signal_date: new Date(Date.now() - randInt(1, 90) * 86400000).toISOString().split('T')[0],
        total_institution_buy: entry.total,
        institutions: entry.institutions.sort((a, b) => b.amount - a.amount),
        insider_count: entry.insiders.size,
        insider_names: Array.from(entry.insiders),
        signal_strength: randInt(65, 98),
        price_on_signal: price,
        price_3m: price * (1 + (Math.random() * 0.5 - 0.15)),
        price_6m: Math.random() > 0.3 ? price * (1 + (Math.random() * 0.8 - 0.2)) : undefined,
        price_12m: Math.random() > 0.5 ? price * (1 + (Math.random() * 1.2 - 0.3)) : undefined,
      });
    }
  }

  return signals.sort((a, b) => b.signal_date.localeCompare(a.signal_date));
}

export const MOCK_RESONANCE_SIGNALS = generateResonanceSignals();
```

### 5-3 共振訊號卡片元件

**新建 `src/components/features/ResonanceCard.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Users } from 'lucide-react';
import type { ResonanceSignal } from '@/types';

interface ResonanceCardProps {
  signal: ResonanceSignal;
  index: number;
}

export function ResonanceCard({ signal, index }: ResonanceCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      onClick={() => navigate(`/stocks/${signal.ticker}`)}
      className={cn(
        'p-3 rounded-card bg-surface border border-l-4 border-l-signal',
        'border-r-border-subtle border-t-border-subtle border-b-border-subtle',
        'hover:border-r-border-default hover:border-t-border-default hover:border-b-border-default',
        'cursor-pointer transition-colors',
      )}
    >
      {/* 頂列：代號 + 公司 + 日期 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-text-primary">
            {signal.ticker}
          </span>
          <span className="text-xs text-text-tertiary truncate">
            {signal.company_name}
          </span>
        </div>
        <span className="text-[10px] text-text-muted flex-shrink-0">
          {formatDate(signal.signal_date)}
        </span>
      </div>

      {/* 機構 + 金額 */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-text-muted">機構買入</span>
          <span className="text-base font-semibold text-green-primary tabular-nums">
            {formatCurrency(signal.total_institution_buy)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          {signal.institutions.slice(0, 3).map((inst) => (
            <span key={inst.name} className="text-[10px] text-text-tertiary">
              {inst.name.split(' ')[0]} {formatCurrency(inst.amount)}
            </span>
          ))}
          {signal.institutions.length > 3 && (
            <span className="text-[10px] text-text-muted">
              +{signal.institutions.length - 3} 更多
            </span>
          )}
        </div>
      </div>

      {/* 底部：內部人 + 信號強度 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-signal-light">
          <Users size={12} />
          <span>{signal.insider_count} 位內部人買入</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-border-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-signal transition-all"
              style={{ width: `${signal.signal_strength}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted tabular-nums w-6">
            {signal.signal_strength}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
```

### 5-4 改寫首頁為三段式儀表板

**覆蓋 `src/pages/FeedPage.tsx`**——這是最大的改動。

首頁佈局（由上而下三個區塊）：
1. 鯨魚共振訊號區：ResonanceCard 橫向網格（2-3 欄 responsive）
2. 今日機構大單區：緊湊表格（DataTable）
3. 最新內部人交易區：既有 TradeCard + Virtuoso 虛擬滾動

```tsx
import { useState, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { RefreshCw, TrendingUp, Building2, Activity } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { TradeCard } from '@/components/features/TradeCard';
import { ResonanceCard } from '@/components/features/ResonanceCard';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useInsiderTrades, type TradeFilter } from '@/hooks/useInsiderTrades';
import { MOCK_RESONANCE_SIGNALS } from '@/lib/resonance-mock';
import { MOCK_TRADES } from '@/lib/mock-data';
import type { InsiderTrade } from '@/types';

// ---- 篩選 ----
const FILTERS: { key: TradeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'buy', label: '🟢 買入' },
  { key: 'sell', label: '🔴 賣出' },
  { key: 'cluster', label: '⚡ 群組' },
];

export default function FeedPage() {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } = useInsiderTrades(filter);

  const trades = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // 共振訊號（從 mock 取）
  const resonanceSignals = useMemo(() => MOCK_RESONANCE_SIGNALS.slice(0, 6), []);

  // 今日機構大單（mock：篩選金額 > 5000 萬的假機構交易）
  const institutionBuys = useMemo(() => {
    const instNames = ['Vanguard', 'BlackRock', 'State Street', 'Fidelity', 'Capital World', 'T. Rowe', 'Wellington', 'Baillie Gifford'];
    return Array.from({ length: 8 }, (_, i) => {
      const tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM'];
      const directions: Array<'NEW' | 'INCREASED' | 'DECREASED'> = ['NEW', 'INCREASED', 'INCREASED', 'DECREASED'];
      return {
        institution: instNames[i],
        ticker: tickers[i],
        amount: (Math.random() * 4 + 0.5) * 1_000_000_000,
        change: directions[i % 4],
      };
    }).sort((a, b) => b.amount - a.amount);
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const Footer = useCallback(() => {
    if (isFetchingNextPage) return <div className="py-2">{[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}</div>;
    if (!hasNextPage && trades.length > 0) return <p className="text-center text-text-muted text-xs py-6">已顯示全部 {total} 筆交易</p>;
    return null;
  }, [isFetchingNextPage, hasNextPage, trades.length, total]);

  const renderItem = useCallback((_idx: number, trade: InsiderTrade) => <TradeCard trade={trade} index={_idx} />, []);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <div className="h-8 w-40 rounded skeleton mb-6" />
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 h-full flex flex-col">
      {/* 頂部 */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-heading-2 text-text-primary mb-1">WhaleTrace</h1>
          <p className="text-text-tertiary text-sm">追蹤華爾街鯨魚的每一筆大錢</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-button border border-border-subtle text-text-tertiary hover:text-text-primary transition-colors">
          <RefreshCw size={16} className={cn(isRefetching && 'animate-spin')} />
        </button>
      </div>

      {/* ════ 區塊 1：鯨魚共振訊號 ════ */}
      {resonanceSignals.length > 0 && (
        <section className="mb-8 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-signal" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              鯨魚共振訊號
            </h2>
            <span className="text-[10px] text-text-muted ml-auto">
              共 {resonanceSignals.length} 筆
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resonanceSignals.map((s, i) => (
              <ResonanceCard key={s.id} signal={s} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ════ 區塊 2：今日機構大單 ════ */}
      <section className="mb-8 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-text-muted" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            機構大單
          </h2>
        </div>
        <div className="rounded-card bg-surface border border-border-subtle overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 px-3 text-text-muted font-medium">機構</th>
                <th className="text-left py-2 px-3 text-text-muted font-medium">股票</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">金額</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">變動</th>
              </tr>
            </thead>
            <tbody>
              {institutionBuys.map((row) => (
                <tr key={`${row.institution}-${row.ticker}`} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors">
                  <td className="py-1.5 px-3 text-text-primary">{row.institution}</td>
                  <td className="py-1.5 px-3 font-mono text-text-secondary">{row.ticker}</td>
                  <td className="py-1.5 px-3 text-right text-text-primary tabular-nums font-medium">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      row.change === 'NEW' ? 'bg-signal-subtle text-signal' :
                      row.change === 'INCREASED' ? 'bg-green-subtle text-green-primary' :
                      'bg-red-subtle text-red-primary'
                    )}>
                      {row.change === 'NEW' ? '新進' : row.change === 'INCREASED' ? '增持' : '減持'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════ 區塊 3：最新內部人交易 ════ */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-text-muted" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              最新內部人交易
            </h2>
            <span className="text-[10px] text-text-muted">· 共 {total} 筆</span>
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn(
                  'px-2 py-1 text-[10px] rounded-full border transition-colors',
                  filter === f.key
                    ? 'bg-green-subtle text-green-primary border-green-primary/20'
                    : 'border-border-subtle text-text-muted hover:text-text-secondary',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {trades.length === 0 ? (
          <EmptyState icon="📭" title="尚無符合條件的交易" />
        ) : (
          <div className="flex-1 min-h-0">
            <Virtuoso
              data={trades}
              itemContent={renderItem}
              endReached={handleEndReached}
              components={{ Footer }}
              overscan={200}
              style={{ height: '100%' }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
```

### 5-5 股票詳情頁加入共振歷史 + 股價走勢

**修改 `src/pages/StockDetailPage.tsx`**

在信心分數區塊之後、機構持股區塊之前，新增兩個區塊：

**區塊 A：股價走勢（簡易 bar chart）**

```tsx
// 在信心分數區塊之後：
{stock.confidence && (
  <section>
    <h2 className="text-heading-3 text-text-primary mb-4">股價走勢（訊號後報酬）</h2>
    <div className="p-4 rounded-card bg-surface border border-border-subtle">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '3 個月', value: Math.random() * 40 - 10 },
          { label: '6 個月', value: Math.random() * 60 - 15 },
          { label: '12 個月', value: Math.random() * 80 - 20 },
        ].map((p) => {
          const isPositive = p.value >= 0;
          return (
            <div key={p.label} className="text-center">
              <p className="text-xs text-text-muted mb-2">{p.label}</p>
              <div className="relative h-24 bg-elevated rounded overflow-hidden mb-1">
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded transition-all ${isPositive ? 'bg-green-subtle' : 'bg-red-subtle'}`}
                  style={{ height: `${Math.min(Math.abs(p.value), 100)}%` }}
                />
              </div>
              <p className={`text-sm font-semibold tabular-nums ${isPositive ? 'text-green-primary' : 'text-red-primary'}`}>
                {isPositive ? '+' : ''}{p.value.toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
)}
```

**區塊 B：共振歷史**

```tsx
{/* 在走勢圖之後： */}
<section>
  <h2 className="text-heading-3 text-text-primary mb-4">🐋 共振歷史</h2>
  {MOCK_RESONANCE_SIGNALS.filter((s) => s.ticker === stock.ticker).length > 0 ? (
    <div className="p-4 rounded-card bg-surface border border-border-subtle space-y-3">
      {MOCK_RESONANCE_SIGNALS.filter((s) => s.ticker === stock.ticker).map((s) => (
        <div key={s.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
          <div>
            <p className="text-xs text-text-muted">{formatDate(s.signal_date)}</p>
            <p className="text-sm text-text-primary mt-0.5">
              機構 {formatCurrency(s.total_institution_buy)} · {s.insider_count} 位內部人
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {s.institutions.slice(0, 2).map((i) => i.name.split(' ')[0]).join('、')}
            </p>
          </div>
          <div className="text-right">
            {s.price_3m && (
              <p className={`text-xs tabular-nums ${s.price_3m >= s.price_on_signal ? 'text-green-primary' : 'text-red-primary'}`}>
                3M {s.price_3m >= s.price_on_signal ? '+' : ''}{((s.price_3m / s.price_on_signal - 1) * 100).toFixed(0)}%
              </p>
            )}
            {s.price_6m && (
              <p className={`text-xs tabular-nums mt-0.5 ${s.price_6m >= s.price_on_signal ? 'text-green-primary' : 'text-red-primary'}`}>
                6M {s.price_6m >= s.price_on_signal ? '+' : ''}{((s.price_6m / s.price_on_signal - 1) * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <EmptyState icon="📡" title="尚無共振訊號紀錄" description="此股票尚未觸發鯨魚共振訊號" />
  )}
</section>
```

### Phase 5 驗證

```bash
npm run build   # 必須零錯誤
npm run dev     # 確認：
                #   - 首頁有三段式儀表板（共振訊號 + 機構大單 + 交易牆）
                #   - 共振卡片有紫色左邊框，點擊跳轉股票詳情
                #   - 股票詳情頁有走勢圖 + 共振歷史
                #   - 篩選按鈕可切換交易牆內容
                #   - 重整按鈕可用
```

---

## Phase 6：上線準備（Post-MVP，Phase 5 完成後才做）

- 串接真實 SEC 資料（Polygon.io free tier: 5 calls/min）
- Supabase 建立 watchlist / resonance_signals 資料表
- n8n 排程定時計算共振訊號並推播
- Error tracking（Sentry）
- PWA 支援（手機安裝）
- 效能優化（code splitting）

---

## 全域規則

1. TypeScript strict，禁用 any
2. import 使用 @/ 前綴
3. CSS 用 var(--xxx) Design Token
4. 動畫用 framer-motion
5. 每個檔案一個元件（pages 除外）
6. 繁體中文
7. 每個 Phase 完成後 `npm run build` 零錯誤
8. import 順序：React/libs → 專案元件 → types → utils
