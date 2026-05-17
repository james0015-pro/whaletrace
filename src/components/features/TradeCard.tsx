import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { cn, formatDate, formatCurrency, formatNumber } from '@/lib/utils';
import { SignalBadge } from '@/components/shared/SignalBadge';
import type { InsiderTrade } from '@/types';

// ============================================================
// Props
// ============================================================

interface TradeCardProps {
  trade: InsiderTrade;
  index: number;
}

// ============================================================
// 輔助
// ============================================================

/** "Michael Burke" → "MB" */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const isBuy = (t: InsiderTrade) => t.transaction_type === 'BUY';

// ============================================================
// TradeCard
// ============================================================

export function TradeCard({ trade, index }: TradeCardProps) {
  const buy = isBuy(trade);
  const leftColor = buy ? 'border-l-green-primary' : 'border-l-red-primary';
  const amountColor = buy ? 'text-green-primary' : 'text-red-primary';
  const avatarBg = buy ? 'bg-green-subtle text-green-primary' : 'bg-red-subtle text-red-primary';
  const Arrow = buy ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.03, 0.3),
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        'mb-3 p-4 rounded-card bg-surface border border-l-4 border-r border-t border-b',
        leftColor,
        'border-r-border-subtle border-t-border-subtle border-b-border-subtle',
        'hover:border-r-border-default hover:border-t-border-default hover:border-b-border-default',
        'transition-colors duration-150',
      )}
    >
      {/* ---- 頂列：頭像 + 姓名/職位/代號 + SignalBadge ---- */}
      <div className="flex items-center gap-3 mb-3">
        {/* 頭像 */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            'text-xs font-semibold',
            avatarBg,
          )}
        >
          {getInitials(trade.insider_name)}
        </div>

        {/* 姓名 + 職位 · 代號 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary truncate">
              {trade.insider_name}
            </span>
            <SignalBadge category={trade.signal_category} />
          </div>
          <p className="text-xs text-text-tertiary truncate mt-0.5">
            {trade.title} · <span className="font-mono text-text-secondary">{trade.ticker}</span>
          </p>
        </div>
      </div>

      {/* ---- 中列：三欄（交易量 / 均價 / 總額） ---- */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* 交易量 */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            交易量
          </p>
          <p className="text-sm text-text-secondary tabular-nums">
            {formatNumber(trade.shares)}
          </p>
        </div>

        {/* 均價 */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            均價
          </p>
          <p className="text-sm text-text-secondary tabular-nums">
            {formatCurrency(trade.price)}
          </p>
        </div>

        {/* 總額 */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            總額
          </p>
          <p
            className={cn(
              'text-sm font-semibold tabular-nums flex items-center gap-0.5',
              amountColor,
            )}
          >
            <Arrow size={14} strokeWidth={2.5} />
            {formatCurrency(trade.total_value)}
          </p>
        </div>
      </div>

      {/* ---- 底列：日期 + 信號強度 + SEC 連結 ---- */}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{formatDate(trade.trade_date)}</span>

        {/* 群組信號強度（僅 CLUSTER） */}
        {trade.signal_category === 'CLUSTER' && (
          <span className="flex items-center gap-1 text-signal">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" />
            信號強度 {trade.signal_strength}
          </span>
        )}

        {/* 分隔點 */}
        <span className="text-border-default">·</span>

        {/* SEC Form 4 */}
        <a
          href={trade.sec_form_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
        >
          <ExternalLink size={12} />
          SEC Form 4
        </a>
      </div>
    </motion.div>
  );
}
