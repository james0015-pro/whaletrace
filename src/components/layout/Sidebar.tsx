import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Building2,
  Star,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: '交易動態', icon: LayoutDashboard },
  { to: '/signals', label: '群組信號', icon: Zap },
  { to: '/institutions', label: '機構 13F', icon: Building2 },
  { to: '/watchlist', label: '我的關注', icon: Star },
  { to: '/settings', label: '設定', icon: Settings },
];

interface SidebarProps {
  onClose: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Mobile close button */}
      <div className="flex items-center justify-between px-4 h-14 sm:hidden border-b border-border-subtle">
        <span className="font-semibold text-text-primary text-lg">
          🐋 WhaleTrace
        </span>
        <button
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-primary"
          aria-label="關閉選單"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-subtle text-green-primary'
                  : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary'
              )
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="text-xs text-text-muted">
          WhaleTrace v0.1.0
        </p>
      </div>
    </div>
  );
}
