import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Building2,
  Star,
  Settings,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const NAV_ICONS = {
  '/': LayoutDashboard,
  '/signals': Zap,
  '/institutions': Building2,
  '/watchlist': Star,
  '/settings': Settings,
};

const NAV_KEYS: Record<string, string> = {
  '/': 'nav.home',
  '/signals': 'nav.signals',
  '/institutions': 'nav.institutions',
  '/watchlist': 'nav.watchlist',
  '/settings': 'nav.settings',
};

const NAV_ITEMS = ['/', '/signals', '/institutions', '/watchlist', '/settings'];

interface SidebarProps {
  onClose: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { t } = useTranslation();

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
          aria-label={t('topBar.closeMenu')}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((to) => {
          const Icon = NAV_ICONS[to];
          if (!Icon) return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
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
              <Icon size={18} />
              <span>{t(NAV_KEYS[to])}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="text-xs text-text-muted">
          {t('common.version')}
        </p>
      </div>
    </div>
  );
}
