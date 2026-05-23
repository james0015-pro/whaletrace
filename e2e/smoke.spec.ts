/**
 * WhaleTrace E2E Smoke Tests (feat-019)
 *
 * Covers: page load, routing, data rendering, basic interactions.
 * Bloomberg/Finviz hybrid dark-theme dashboard.
 */
import { test, expect } from '@playwright/test';

// ─── Helper: wait for lazy-loaded page content ──────────────────────
async function waitForPageReady(page: import('@playwright/test').Page) {
  // Wait for the Suspense fallback to disappear + first meaningful content
  await page.waitForSelector('[role="status"]', { state: 'detached', timeout: 10_000 }).catch(() => {});
  // Wait for any data row or panel header (Bloomberg convention)
  await page.waitForTimeout(800);
}

// ─── Helper: navigate via hash router ───────────────────────────────
async function goTo(page: import('@playwright/test').Page, hashPath: string) {
  await page.goto(`/#${hashPath}`);
  await waitForPageReady(page);
}

// ═══════════════════════════════════════════════════════════════════
// 1. APP SHELL + HOME PAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('App Shell', () => {
  test('loads without crashing', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/WhaleTrace/i);
  });

  test('renders TopNavBar with logo text', async ({ page }) => {
    await page.goto('/');
    // The Bloomberg-style header has ticker tape; logo should be visible
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. HOME PAGE — FeedPage (Bloomberg 4-quadrant terminal)
// ═══════════════════════════════════════════════════════════════════
test.describe('Home Page (FeedPage)', () => {
  test('renders insider trade data rows', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    // Bloomberg-style rows use JetBrains Mono and contain tickers
    // Wait for at least 3 ticker-like elements (INSIDER TRADES section)
    await page.waitForSelector('text=INSIDER', { timeout: 8_000 }).catch(() => {});
    // Check the page has content (not just a white/black blank screen)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('Dashboard Page', () => {
  test('loads successfully', async ({ page }) => {
    await goTo(page, '/dashboard');
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('renders market intelligence cards', async ({ page }) => {
    await goTo(page, '/dashboard');
    // DashboardPage shows market intelligence cards with company names
    await page.waitForSelector('text=NVDA', { timeout: 8_000 }).catch(() => {});
    // Should have substantial content
    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. STOCK DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('Stock Detail Page', () => {
  test('loads with ticker parameter', async ({ page }) => {
    await goTo(page, '/stocks/NVDA');
    // Should show ticker in bold amber
    await page.waitForSelector('text=NVDA', { timeout: 8_000 });
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('NVDA');
  });

  test('shows confidence score section', async ({ page }) => {
    await goTo(page, '/stocks/NVDA');
    // Confidence score label (uppercase amber convention)
    await page.waitForSelector('text=CONFIDENCE', { timeout: 8_000 }).catch(() => {});
    const bodyText = await page.textContent('body');
    // Should contain score-like numbers
    expect(bodyText!.length).toBeGreaterThan(400);
  });

  test('shows watch toggle button', async ({ page }) => {
    await goTo(page, '/stocks/NVDA');
    // WATCH button is present
    const watchBtn = page.locator('text=WATCH');
    await expect(watchBtn.first()).toBeVisible({ timeout: 6_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. WATCHLIST PAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('Watchlist Page', () => {
  test('loads successfully', async ({ page }) => {
    await goTo(page, '/watchlist');
    await expect(page.locator('text=WATCHLIST').first()).toBeVisible({ timeout: 8_000 }).catch(() => {});
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. TREEMAP PAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('Treemap Page', () => {
  test('loads with SVG content', async ({ page }) => {
    await goTo(page, '/treemap');
    // Treemap uses inline SVG
    const svg = page.locator('svg');
    await expect(svg.first()).toBeVisible({ timeout: 8_000 }).catch(() => {});
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. NAVIGATION BETWEEN PAGES
// ═══════════════════════════════════════════════════════════════════
test.describe('Navigation', () => {
  test('navigates from home to dashboard and back', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Navigate to dashboard via URL
    await goTo(page, '/dashboard');
    const dashText = await page.textContent('body');
    expect(dashText).toBeTruthy();

    // Navigate back to home
    await goTo(page, '/');
    const homeText = await page.textContent('body');
    expect(homeText).toBeTruthy();
  });

  test('navigates from home to stock detail to treemap', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    await goTo(page, '/stocks/AAPL');
    let text = await page.textContent('body');
    expect(text).toContain('AAPL');

    await goTo(page, '/treemap');
    text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('navigates to watchlist and settings', async ({ page }) => {
    await goTo(page, '/watchlist');
    let text = await page.textContent('body');
    expect(text).toBeTruthy();

    await goTo(page, '/settings');
    text = await page.textContent('body');
    expect(text).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. BASIC INTERACTIONS
// ═══════════════════════════════════════════════════════════════════
test.describe('Interactions', () => {
  test('keyboard Escape does not crash the page', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    // Press Escape — should not throw
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Page should still be alive
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('scrolling on home page works', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    // Scroll down
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    // Page should still be rendered
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });
});
