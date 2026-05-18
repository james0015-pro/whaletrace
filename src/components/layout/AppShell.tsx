import { useState, useEffect } from 'react';
import { TopNavBar } from './TopNavBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text-secondary">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="hidden sm:flex flex-col w-[240px] flex-shrink-0 border-r border-border-subtle bg-surface">
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-[280px] bg-surface border-r border-border-subtle animate-slide-right">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopNavBar />
        <main className="flex-1 overflow-y-auto pb-16 sm:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && <MobileNav />}
    </div>
  );
}
