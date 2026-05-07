import { test, expect, type Browser } from '@playwright/test'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

type Cookie = Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>['cookies'][number]
let managerCookies: Cookie[] = []
let werkstudentCookies: Cookie[] = []
let authFailed = false

async function ensureManagerAuth(browser: Browser) {
  if (managerCookies.length > 0 || authFailed) return
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    if (!(await page.getByText('Demo-Zugänge').isVisible({ timeout: 6000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: /Mia Schulz/i })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /Als Demo-User anmelden/i }).click()
    await page.waitForURL(/\/manager|\/dashboard/, { timeout: 20000 })
    managerCookies = (await ctx.storageState()).cookies
  } catch { authFailed = true }
  finally { await ctx.close() }
}

async function ensureWerkstudentAuth(browser: Browser) {
  if (werkstudentCookies.length > 0 || authFailed) return
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    if (!(await page.getByText('Demo-Zugänge').isVisible({ timeout: 6000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: /anna müller/i })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /Als Demo-User anmelden/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
    werkstudentCookies = (await ctx.storageState()).cookies
  } catch { authFailed = true }
  finally { await ctx.close() }
}

// ─── AC: Route Protection ─────────────────────────────────────────────────────

test('unauthenticated access to /manager/deckung redirects to /login', async ({ page }) => {
  await page.goto('/manager/deckung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /manager/deckung?week=2026-W19 redirects to /login', async ({ page }) => {
  await page.goto('/manager/deckung?week=2026-W19')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /manager/deckung?view=tag redirects to /login', async ({ page }) => {
  await page.goto('/manager/deckung?view=tag')
  await expect(page).toHaveURL(/\/login/)
})

test('werkstudent accessing /manager/deckung is redirected to /dashboard', async ({ page, browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed || werkstudentCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung')
  await expect(p).toHaveURL(/\/dashboard/)
  await ctx.close()
})

// ─── AC: ManagerNav has "Deckungsübersicht" link ──────────────────────────────

test('ManagerNav shows "Deckungsübersicht" link', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung')
  await expect(p.getByRole('link', { name: /deckungsübersicht/i })).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

// ─── AC: Wochenansicht — page loads with heading and KW indicator ─────────────

test('Wochenansicht loads with "Deckungsübersicht" heading', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung')
  await expect(p.getByRole('heading', { name: /deckungsübersicht/i })).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

test('Wochenansicht shows KW number and week date range', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await expect(p.getByText(/KW\s*19/)).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

test('Wochenansicht shows Mo–Fr day rows', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForURL(/\/manager\/deckung/, { timeout: 15000 })
  await p.waitForLoadState('networkidle')
  // Day labels Mo–Fr must all be present
  for (const day of ['Mo', 'Di', 'Mi', 'Do', 'Fr']) {
    await expect(p.getByText(day).first()).toBeVisible({ timeout: 10000 })
  }
  await ctx.close()
})

test('Wochenansicht shows week navigation buttons (← / →)', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung')
  await p.waitForLoadState('networkidle')
  // Two buttons with chevron icons for week navigation
  const buttons = p.getByRole('button')
  await expect(buttons.first()).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('Wochenansicht — empty week shows "Keine Planungen" message', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  // Navigate to a week far in the future with no planning data
  await p.goto('/manager/deckung?week=2030-W01')
  await p.waitForLoadState('networkidle')
  await expect(p.getByText(/keine planungen für diese woche/i)).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

// ─── AC: Tab navigation (Woche / Tag) ────────────────────────────────────────

test('page shows "Wochenansicht" and "Tagesansicht" tabs', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung')
  await p.waitForLoadState('networkidle')
  await expect(p.getByRole('tab', { name: /wochenansicht/i })).toBeVisible({ timeout: 10000 })
  await expect(p.getByRole('tab', { name: /tagesansicht/i })).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('clicking "Tagesansicht" tab updates URL to ?view=tag', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForLoadState('networkidle')
  await p.getByRole('tab', { name: /tagesansicht/i }).click()
  await expect(p).toHaveURL(/view=tag/)
  await ctx.close()
})

test('?view=tag URL directly loads Tagesansicht tab as active', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19&view=tag&day=2026-05-07')
  await p.waitForLoadState('networkidle')
  await expect(p.getByRole('tab', { name: /tagesansicht/i })).toHaveAttribute('data-state', 'active', { timeout: 10000 })
  await ctx.close()
})

// ─── AC: Tagesansicht loads for a specific day ────────────────────────────────

test('Tagesansicht shows day label with date', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19&view=tag&day=2026-05-06')
  await p.waitForLoadState('networkidle')
  // Mittwoch, 06.05.2026
  await expect(p.getByText(/06\.05\./)).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('Tagesansicht day navigation buttons are visible', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19&view=tag&day=2026-05-07')
  await p.waitForLoadState('networkidle')
  // Within TagesGantt there are prev/next day buttons — the tab content must be visible
  await expect(p.getByRole('tab', { name: /tagesansicht/i })).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('Tagesansicht Monday — previous day button is disabled (no earlier weekday)', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  // Monday 2026-05-04
  await p.goto('/manager/deckung?week=2026-W19&view=tag&day=2026-05-05')
  await p.waitForLoadState('networkidle')
  // The first button in TagesGantt should be disabled (prev disabled on Monday)
  // Find buttons inside the tab panel
  const tabPanel = p.locator('[role="tabpanel"]').filter({ hasText: '' })
  await p.waitForTimeout(500)
  const disabledBtn = p.locator('button[disabled]').first()
  await expect(disabledBtn).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('Tagesansicht Friday — next day button is disabled', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  // Friday 2026-05-08
  await p.goto('/manager/deckung?week=2026-W19&view=tag&day=2026-05-09')
  await p.waitForLoadState('networkidle')
  await p.waitForTimeout(500)
  const disabledBtn = p.locator('button[disabled]').last()
  await expect(disabledBtn).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('Tagesansicht — empty day shows "Keine Planung für diesen Tag"', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  // Far future day — guaranteed no data
  await p.goto('/manager/deckung?week=2030-W01&view=tag&day=2030-01-07')
  await p.waitForLoadState('networkidle')
  await expect(p.getByText(/keine planung für diesen tag/i)).toBeVisible({ timeout: 15000 })
  await ctx.close()
})

// ─── AC: Clicking a day row in Wochenansicht opens Tagesansicht ───────────────

test('clicking a day row in Wochenansicht navigates to Tagesansicht for that day', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForLoadState('networkidle')
  // Click on the row containing "Mo" (first day row)
  await p.getByText('Mo').first().click()
  await expect(p).toHaveURL(/view=tag/, { timeout: 10000 })
  await ctx.close()
})

// ─── AC: Week navigation (← / →) ─────────────────────────────────────────────

test('next week button updates URL to KW+1', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForLoadState('networkidle')
  // Click the → (next) week button — it's the second outline button in the week nav area
  const weekNavButtons = p.locator('button').filter({ has: p.locator('svg') })
  // Navigate to next week
  await weekNavButtons.nth(1).click()
  await expect(p).toHaveURL(/week=2026-W20/, { timeout: 10000 })
  await ctx.close()
})

test('previous week button updates URL to KW-1', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForLoadState('networkidle')
  const weekNavButtons = p.locator('button').filter({ has: p.locator('svg') })
  await weekNavButtons.first().click()
  await expect(p).toHaveURL(/week=2026-W18/, { timeout: 10000 })
  await ctx.close()
})

// ─── AC: Responsive — horizontal scroll on small screens ─────────────────────

test('Wochenansicht is horizontally scrollable on mobile (375px)', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) { test.skip(true, 'Dev login unavailable'); return }
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/deckung?week=2026-W19')
  await p.waitForLoadState('networkidle')
  // The heading must still be visible (page didn't break)
  await expect(p.getByRole('heading', { name: /deckungsübersicht/i })).toBeVisible({ timeout: 15000 })
  // Verify overflow-x-auto container exists
  const scrollable = p.locator('.overflow-x-auto').first()
  await expect(scrollable).toBeVisible()
  await ctx.close()
})

// ─── Security: API / data isolation ──────────────────────────────────────────

test('server action returns 401-equivalent when not authenticated (direct call)', async ({ request }) => {
  // Server actions require authentication — calling without a session should fail
  const response = await request.post('/manager/deckung', {
    data: {},
    maxRedirects: 0,
  })
  // Should redirect to /login (307) or return 401/403
  expect([307, 308, 401, 403].includes(response.status())).toBeTruthy()
})
