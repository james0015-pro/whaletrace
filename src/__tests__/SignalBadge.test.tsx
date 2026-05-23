import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalBadge } from '@/components/shared/SignalBadge';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'signalBadge.buy': 'BUY',
        'signalBadge.sell': 'SELL',
        'signalBadge.tenb5_1': '10b5-1',
        'signalBadge.cluster': 'CLUSTER',
      };
      return map[key] || key;
    },
    i18n: { language: 'zh-TW' },
  }),
}));

describe('SignalBadge', () => {
  it('renders BUY badge with correct text', () => {
    render(<SignalBadge category="BUY" />);
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('renders SELL badge with correct text', () => {
    render(<SignalBadge category="SELL" />);
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('renders TENB5_1 badge with correct text', () => {
    render(<SignalBadge category="TENB5_1" />);
    expect(screen.getByText('10b5-1')).toBeInTheDocument();
  });

  it('renders CLUSTER badge with correct text', () => {
    render(<SignalBadge category="CLUSTER" />);
    expect(screen.getByText('CLUSTER')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SignalBadge category="BUY" className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('has correct base classes', () => {
    const { container } = render(<SignalBadge category="BUY" />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('inline-flex');
    expect(span).toHaveClass('rounded');
    expect(span).toHaveClass('border');
  });
});
