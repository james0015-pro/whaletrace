import { cn, formatCurrency } from '@/lib/utils';
import type { InstitutionOrder } from '@/lib/mock-data';

// ============================================================
// CompactDataTable — 彭博終端機風格的緊湊表格
// 字小、行高窄、數字對齊、hover 列高亮
// ============================================================

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props {
  data: InstitutionOrder[];
  columns: Column<InstitutionOrder>[];
  maxRows?: number;
  compact?: boolean;
}

export function CompactDataTable({ data, columns, maxRows, compact }: Props) {
  const rows = maxRows ? data.slice(0, maxRows) : data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        {/* Header */}
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-2 py-1.5 font-medium text-text-muted uppercase tracking-wider whitespace-nowrap',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  compact && 'py-1',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-border-subtle/50 transition-colors duration-100',
                'hover:bg-bg-hover',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-2 py-2 text-text-secondary whitespace-nowrap tabular-nums',
                    col.align === 'right' ? 'text-right font-mono' : 'text-left',
                    compact && 'py-1.5',
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 機構大單欄位定義
// ============================================================

export const INSTITUTION_COLUMNS: Column<InstitutionOrder>[] = [
  {
    key: 'institution',
    header: '機構',
    align: 'left',
    render: (r) => (
      <span className="font-medium text-text-primary">{r.institution}</span>
    ),
  },
  {
    key: 'ticker',
    header: '股票',
    align: 'left',
    render: (r) => (
      <span className="font-mono font-bold text-text-primary">{r.ticker}</span>
    ),
  },
  {
    key: 'amount',
    header: '金額',
    align: 'right',
    render: (r) => (
      <span className="text-text-primary font-semibold">
        {formatCurrency(r.amount)}
      </span>
    ),
  },
  {
    key: 'change',
    header: '變動',
    align: 'right',
    render: (r) => {
      if (r.direction === 'NEW') {
        return (
          <span className="text-signal-purple font-medium text-[10px] px-1.5 py-0.5 rounded bg-signal-subtle">
            NEW
          </span>
        );
      }
      const isUp = r.change_pct > 0;
      return (
        <span
          className={cn(
            'font-medium tabular-nums',
            isUp ? 'text-green-primary' : 'text-red-primary',
          )}
        >
          {isUp ? '+' : ''}{r.change_pct}%
        </span>
      );
    },
  },
];
