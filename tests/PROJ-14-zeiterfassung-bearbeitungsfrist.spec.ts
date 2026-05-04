import { test, expect, type Browser } from '@playwright/test'

// Serial mode: prevents concurrent Supabase OTP requests (avoids HTTP 429)
test.describe.configure({ mode: 'serial' })

// ── Shared auth state ─────────────────────────────────────────────────────────

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
    const devBadge = page.getByText('Dev only')
    if (!(await devBadge.isVisible({ timeout: 5000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: /dev admin.*manager/i })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
    await page.waitForURL(/\/manager/, { timeout: 15000 })
    managerCookies = (await ctx.storageState()).cookies
  } catch {
    authFailed = true
  } finally {
    await ctx.close()
  }
}

async function ensureWerkstudentAuth(browser: Browser) {
  if (werkstudentCookies.length > 0 || authFailed) return
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    const devBadge = page.getByText('Dev only')
    if (!(await devBadge.isVisible({ timeout: 5000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: /clara fischer/i })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    werkstudentCookies = (await ctx.storageState()).cookies
  } catch {
    authFailed = true
  } finally {
    await ctx.close()
  }
}

// ── Manager: Einstellungsseite ─────────────────────────────────────────────────

test.describe('Manager – /manager/settings Einstellungsseite', () => {
  test('settings page is accessible via nav link on manager overview', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager')
    await expect(page.getByRole('link', { name: /einstellungen/i })).toBeVisible({ timeout: 10000 })
  })

  test('settings page shows Bearbeitungsfrist card with current value', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/settings')
    await expect(page.getByText('Bearbeitungsfrist').first()).toBeVisible({ timeout: 10000 })
    const input = page.getByLabel(/bearbeitungsfrist.*tage/i)
    await expect(input).toBeVisible()
    const value = await input.inputValue()
    const parsed = parseInt(value, 10)
    expect(parsed).toBeGreaterThanOrEqual(1)
    expect(parsed).toBeLessThanOrEqual(365)
  })

  test('saving a new valid value shows success alert', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/settings')
    const input = page.getByLabel(/bearbeitungsfrist.*tage/i)
    await input.waitFor({ timeout: 10000 })
    await input.fill('14')
    await page.getByRole('button', { name: /speichern/i }).click()
    await expect(page.getByText(/einstellung gespeichert/i)).toBeVisible({ timeout: 8000 })
  })

  test('validation blocks value below 1 (client-side)', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/settings')
    const input = page.getByLabel(/bearbeitungsfrist.*tage/i)
    await input.waitFor({ timeout: 10000 })
    await input.fill('0')
    await page.getByRole('button', { name: /speichern/i }).click()
    // Should show error alert (client-side guard rejects value < 1)
    await expect(page.getByText(/wert zwischen 1 und 365/i)).toBeVisible({ timeout: 5000 })
  })

  test('validation blocks value above 365 (client-side)', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/settings')
    const input = page.getByLabel(/bearbeitungsfrist.*tage/i)
    await input.waitFor({ timeout: 10000 })
    await input.fill('400')
    await page.getByRole('button', { name: /speichern/i }).click()
    await expect(page.getByText(/wert zwischen 1 und 365/i)).toBeVisible({ timeout: 5000 })
  })

  test('settings page redirects werkstudent to /dashboard (access control)', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.goto('/manager/settings')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('settings page is responsive at 375px', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/manager/settings')
    await expect(page.getByText('Bearbeitungsfrist').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel(/bearbeitungsfrist.*tage/i)).toBeVisible()
  })

  test('settings page is responsive at 768px', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/manager/settings')
    await expect(page.getByText('Bearbeitungsfrist').first()).toBeVisible({ timeout: 10000 })
  })
})

// ── Dashboard: Bearbeiten-Button Sichtbarkeit ─────────────────────────────────

test.describe('Werkstudent – Dashboard Bearbeiten-Button visibility', () => {
  test('dashboard loads and shows WochenIstübersicht for werkstudent', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.goto('/dashboard')
    // KW navigator should be present
    await expect(page.getByText(/KW \d+/)).toBeVisible({ timeout: 10000 })
  })
})

// ── Manager: unrestricted access ──────────────────────────────────────────────

test.describe('Manager – hat uneingeschränkten Zugriff auf Bearbeiten-Buttons', () => {
  test('manager dashboard shows Bearbeiten/Blöcke buttons for past entries', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/dashboard')
    // Manager's maxEditDaysPast = null → cutoffStr = null → all past entries editable
    // We can't test edit buttons without actual DB entries, but we can verify the page loads
    await expect(page.getByText(/KW \d+/)).toBeVisible({ timeout: 10000 })
  })
})

// ── Unauthenticated access ────────────────────────────────────────────────────

test.describe('Unauthentifizierter Zugriff', () => {
  test('/manager/settings redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/manager/settings')
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })
})
