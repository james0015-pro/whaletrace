import { Search, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopNavBarProps {
  onMenuClick: () => void;
}

export function TopNavBar({ onMenuClick }: TopNavBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6',
        'h-14 sm:h-[56px]',
        'bg-canvas/80 backdrop-blur-md',
        'border-b border-border-subtle'
      )}
    >
      {/* Mobile menu trigger */}
      <button
        onClick={onMenuClick}
        className="sm:hidden p-2 -ml-2 text-text-tertiary hover:text-text-primary transition-colors"
        aria-label="開啟選單"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <a href="/" className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xl" role="img" aria-label="whale">
          🐋
        </span>
        <span className="font-semibold text-text-primary text-base hidden xs:inline">
          WhaleTrace
        </span>
      </a>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick search */}
      <div className="relative hidden md:block">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="搜尋股票代號或公司..."
          className={cn(
            'w-56 lg:w-72 h-9 pl-9 pr-3',
            'bg-surface border border-border-default rounded-input',
            'text-sm text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/20',
            'transition-colors'
          )}
        />
      </div>

      {/* Notification bell */}
      <button
        className="relative p-2 text-text-tertiary hover:text-text-primary transition-colors"
        aria-label="通知"
      >
        <Bell size={18} />
        {/* Notification dot */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-primary rounded-full" />
      </button>

      {/* User avatar placeholder */}
      <div className="w-8 h-8 rounded-full bg-elevated border border-border-default flex items-center justify-center text-sm text-text-tertiary">
        ?
      </div>
    </header>
  );
}
