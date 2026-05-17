import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// LanguageSwitcher — 語言切換按鈕
// 放在 TopNavBar 中，點擊切換 en ↔ zh-TW
// ============================================================

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const toggle = () => {
    i18n.changeLanguage(isZh ? 'en' : 'zh-TW');
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-button',
        'text-xs font-medium',
        'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
        'transition-colors',
      )}
      aria-label={t('language.label')}
      title={t('language.switch')}
    >
      <Globe size={14} />
      <span>{isZh ? 'EN' : '中文'}</span>
    </button>
  );
}
