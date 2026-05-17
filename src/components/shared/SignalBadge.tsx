import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SignalCategory } from '@/types';

const VARIANT_STYLES: Record<SignalCategory, string> = {
  BUY: 'bg-green-subtle text-green-primary border-green-primary/20',
  SELL: 'bg-red-subtle text-red-primary border-red-primary/20',
  TENB5_1: 'bg-amber-subtle text-amber-primary border-amber-primary/20',
  CLUSTER: 'bg-signal-subtle text-signal border-signal-light/20',
};

const LABEL_KEYS: Record<SignalCategory, string> = {
  BUY: 'signalBadge.buy',
  SELL: 'signalBadge.sell',
  TENB5_1: 'signalBadge.tenb5_1',
  CLUSTER: 'signalBadge.cluster',
};

interface SignalBadgeProps {
  category: SignalCategory;
  className?: string;
}

export function SignalBadge({ category, className }: SignalBadgeProps) {
  const { t } = useTranslation();

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border', VARIANT_STYLES[category], className)}>
      {t(LABEL_KEYS[category])}
    </span>
  );
}
