import { cn } from '@/lib/utils';
import type { SignalCategory } from '@/types';

const VARIANT_STYLES: Record<SignalCategory, string> = {
  BUY: 'bg-green-subtle text-green-primary border-green-primary/20',
  SELL: 'bg-red-subtle text-red-primary border-red-primary/20',
  TENB5_1: 'bg-amber-subtle text-amber-primary border-amber-primary/20',
  CLUSTER: 'bg-signal-subtle text-signal border-signal-light/20',
};

const VARIANT_LABELS: Record<SignalCategory, string> = {
  BUY: '🟢 買入',
  SELL: '🔴 賣出',
  TENB5_1: '🟡 10b5-1',
  CLUSTER: '⚡ 群組信號',
};

interface SignalBadgeProps {
  category: SignalCategory;
  className?: string;
}

export function SignalBadge({ category, className }: SignalBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
        VARIANT_STYLES[category],
        className
      )}
    >
      {VARIANT_LABELS[category]}
    </span>
  );
}
