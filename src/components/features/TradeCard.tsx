import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn, formatDate, formatCurrency, formatNumber } from '@/lib/utils';
import { SignalBadge } from '@/components/shared/SignalBadge';
import type { InsiderTrade } from '@/types';

interface TradeCardProps {
  trade: InsiderTrade;
  index: number;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const isBuy = (t: InsiderTrade) => t.transaction_type === 'BUY';

export function TradeCard({ trade, index }: TradeCardProps) {
  const { t } = useTranslation();
  const buy = isBuy(trade);
  const leftColor = buy ? 'border-l-green-primary' : 'border-l-red-primary';
  const amountColor = buy ? 'text-green-primary' : 'text-red-primary';
  const avatarBg = buy ? 'bg-green-subtle text-green-primary' : 'bg-red-subtle text-red-primary';
  const Arrow = buy ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'mb-3 p-4 rounded-card bg-surface border border-l-4 border-r border-t border-b',
        leftColor, 'border-r-border-subtle border-t-border-subtle border-b-border-subtle',
        'hover:border-r-border-default hover:border-t-border-default hover:border-b-border-default',
        'transition-colors duration-150',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', 'text-xs font-semibold', avatarBg)}>
          {getInitials(trade.insider_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary truncate">{trade.insider_name}</span>
            <SignalBadge category={trade.signal_category} />
          </div>
          <p className="text-xs text-text-tertiary truncate mt-0.5">
            {trade.title} · <span className="font-mono text-text-secondary">{trade.ticker}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{t('tradeCard.volume')}</p>
          <p className="text-sm text-text-secondary tabular-nums">{formatNumber(trade.shares)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{t('tradeCard.avgPrice')}</p>
          <p className="text-sm text-text-secondary tabular-nums">{formatCurrency(trade.price)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{t('tradeCard.total')}</p>
          <p className={cn('text-sm font-semibold tabular-nums flex items-center gap-0.5', amountColor)}>
            <Arrow size={14} strokeWidth={2.5} />
            {formatCurrency(trade.total_value)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{formatDate(trade.trade_date)}</span>
        {trade.signal_category === 'CLUSTER' && (
          <span className="flex items-center gap-1 text-signal">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" />
            {t('tradeCard.signal_strength')} {trade.signal_strength}
          </span>
        )}
        <span className="text-border-default">·</span>
        <a href={trade.sec_form_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-text-muted hover:text-text-secondary transition-colors">
          <ExternalLink size={12} />
          {t('tradeCard.sec_form4')}
        </a>
      </div>
    </motion.div>
  );
}
