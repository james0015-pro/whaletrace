import { useTranslation } from 'react-i18next';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { ResonanceSignal } from '@/types';

interface Props {
  signal: ResonanceSignal;
  index: number;
}

export function ResonanceCard({ signal, index }: Props) {
  const { t } = useTranslation();
  const {
    ticker, company_name, total_institutional_buy,
    institution_count, institutions, insider_buy_count,
    insider_names, signal_strength, signal_date,
  } = signal;

  return (
    <div
      className={cn(
        'rounded-card border p-4 transition-all duration-200',
        'border-signal-purple/30 bg-bg-surface hover:border-signal-purple/60',
        'hover:shadow-[0_0_20px_rgba(139,92,246,0.08)]',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-text-primary tracking-tight">{ticker}</span>
            <span className="text-xs text-text-tertiary truncate max-w-[140px]">{company_name}</span>
          </div>
        </div>
        <span className="text-[10px] text-text-muted font-mono tabular-nums">{formatDate(signal_date)}</span>
      </div>

      <div className="mb-2">
        <span className="text-lg font-semibold text-text-primary tabular-nums">{formatCurrency(total_institutional_buy)}</span>
        <span className="text-xs text-text-tertiary ml-1">· {institution_count} {t('resonanceCard.institutions')}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-0.5">
        {institutions.map((inst) => (
          <span key={inst.name} className="text-[11px] text-text-tertiary">
            <span className="text-text-secondary font-medium">{inst.name}</span>
            <span className="font-mono text-text-muted ml-1 tabular-nums">{formatCurrency(inst.amount)}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-green-primary font-medium">
            {t('resonanceCard.insider_buy', { count: insider_buy_count })}
          </span>
          <span className="text-[10px] text-text-muted">
            {insider_names.slice(0, 2).join(' · ')}
            {insider_names.length > 2 && ` +${insider_names.length - 2}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full rounded-full bg-signal-purple transition-all" style={{ width: `${signal_strength}%` }} />
          </div>
          <span className="text-xs font-mono font-bold text-signal-purple tabular-nums">{signal_strength}</span>
        </div>
      </div>
    </div>
  );
}
