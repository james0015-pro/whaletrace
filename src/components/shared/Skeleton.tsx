import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /** Card (full trade card), Text (single line), Chart (large area) */
  variant?: 'card' | 'text' | 'chart';
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  if (variant === 'card') {
    return (
      <div
        className={cn(
          'mb-3 p-4 rounded-card bg-surface border border-border-subtle',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-12 rounded bg-border-default" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded skeleton" />
            <div className="h-3 w-48 rounded skeleton" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-4 w-20 rounded skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div
        className={cn(
          'h-64 rounded-card bg-surface border border-border-subtle skeleton',
          className
        )}
      />
    );
  }

  // Text skeleton
  return (
    <div
      className={cn('h-4 rounded skeleton', className)}
      style={{ width: '60%' }}
    />
  );
}
