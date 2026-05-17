import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Building2,
  Star,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { to: '/', label: '動態', icon: LayoutDashboard },
  { to: '/signals', label: '信號', icon: Zap },
  { to: '/institutions', label: '機構', icon: Building2 },
  { to: '/watchlist', label: '關注', icon: Star },
  { to: '/settings', label: '設定', icon: Settings },
];

export function MobileNav() {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-center justify-around',
        'h-[60px]',
        'bg-surface/95 backdrop-blur-md',
        'border-t border-border-default',
        'safe-area-pb'
      )}
    >
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 py-1 px-2 min-w-0 transition-colors',
              isActive
                ? 'text-green-primary'
                : 'text-text-muted'
            )
          }
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium leading-none">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
