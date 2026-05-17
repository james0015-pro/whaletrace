---
description: React 元件開發規則 — 當編輯 src/components/ 或 src/pages/ 時觸發
globs: ["src/components/**/*.tsx", "src/pages/**/*.tsx"]
alwaysApply: false
---

# React 元件規則

## 元件結構
```tsx
// 1. imports
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SomeType } from '@/types';

// 2. Props interface
interface ComponentNameProps {
  /** 說明這個 prop 的用途 */
  someProp: string;
  className?: string;
}

// 3. Component
export function ComponentName({ someProp, className }: ComponentNameProps) {
  // hooks at top
  // event handlers
  // render
  return <div className={cn('base-class', className)}>...</div>;
}
```

## 必須遵守
- 所有元件必須處理 **loading**、**error**、**empty** 三種狀態
- Loading 狀態使用 `Skeleton` 元件（`@/components/shared/Skeleton`）
- Empty 狀態使用 `EmptyState` 元件（`@/components/shared/EmptyState`）
- 錯誤狀態顯示錯誤訊息 + 重試按鈕
- 圖片/頭像使用 `loading="lazy"` 懶載入
- 列表超過 100 項必須使用虛擬滾動（`@tanstack/react-virtual`）
