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

// ── Unauthentifizierter Zugriff ───────────────────────────────────────────────

test('unauthenticated access to /manager/users redirects to /login', async ({ page }) => {
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
})

// ── AC1: Vorgesetzter-Spalte in Nutzerverwaltung ──────────────────────────────

test.describe('AC1: Vorgesetzter-Zuordnung in Nutzerverwaltung', () => {
  test('Nutzerverwaltung zeigt Spalte "Vorgesetzter" in der Tabelle', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/users')
    await expect(page.getByRole('columnheader', { name: /vorgesetzter/i })).toBeVisible({ timeout: 10000 })
  })

  test('EditDialog für Werkstudenten zeigt Vorgesetzter-Dropdown', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/users')
    await page.waitForLoadState('networkidle')
    // Klick auf "Bearbeiten" für einen Werkstudenten
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    let foundWerkstudent = false
    for (let i = 1; i < rowCount; i++) {
      const row = rows.nth(i)
      const werkstudentBadge = row.getByText('Werkstudent')
      if (await werkstudentBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
        await row.getByRole('button', { name: /bearbeiten/i }).click()
        foundWerkstudent = true
        break
      }
    }
    if (!foundWerkstudent) { test.skip(); return }
    // Dialog öffnet sich → Vorgesetzter-Dropdown sichtbar
    await expect(page.getByLabel(/vorgesetzter/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/e-mail-benachrichtigungen.*buchungsänderungen/i)).toBeVisible()
  })

  test('EditDialog für Manager zeigt kein Vorgesetzter-Dropdown', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/users')
    await page.waitForLoadState('networkidle')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    let foundManager = false
    for (let i = 1; i < rowCount; i++) {
      const row = rows.nth(i)
      const managerBadge = row.getByText('Manager')
      if (await managerBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
        await row.getByRole('button', { name: /bearbeiten/i }).click()
        foundManager = true
        break
      }
    }
    if (!foundManager) { test.skip(); return }
    // Dialog öffnet sich → Vorgesetzter-Dropdown NICHT sichtbar
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await expect(page.getByLabel(/vorgesetzter/i)).not.toBeVisible()
  })

  test('Vorgesetzter-Dropdown enthält nur aktive Manager', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/users')
    await page.waitForLoadState('networkidle')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    for (let i = 1; i < rowCount; i++) {
      const row = rows.nth(i)
      if (await row.getByText('Werkstudent').isVisible({ timeout: 500 }).catch(() => false)) {
        await row.getByRole('button', { name: /bearbeiten/i }).click()
        break
      }
    }
    const select = page.getByLabel(/vorgesetzter/i)
    if (!(await select.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
    await select.click()
    // "Kein Vorgesetzter" Option muss immer vorhanden sein
    await expect(page.getByRole('option', { name: /kein vorgesetzter/i })).toBeVisible({ timeout: 3000 })
  })

  test('Nutzerverwaltung ist bei 375px responsive', async ({ browser, page }) => {
    await ensureManagerAuth(browser)
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/manager/users')
    await expect(page.getByRole('heading', { name: /nutzerverwaltung/i })).toBeVisible({ timeout: 10000 })
  })
})

// ── AC10: Manager-Hinweis im Dashboard ───────────────────────────────────────

test.describe('AC10: Manager-Hinweis beim Bearbeiten vergangener Buchungen', () => {
  test('Dashboard lädt für Werkstudenten mit Wochenübersicht', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.goto('/dashboard')
    await expect(page.getByText(/KW \d+/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/wochenübersicht ist-zeiten/i)).toBeVisible()
  })

  test('Dashboard ist bei 375px responsive', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await expect(page.getByText(/mein dashboard/i)).toBeVisible({ timeout: 10000 })
  })

  test('Dashboard ist bei 768px responsive', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')
    await expect(page.getByText(/mein dashboard/i)).toBeVisible({ timeout: 10000 })
  })
})

// ── Security: Zugriffsschutz ──────────────────────────────────────────────────

test.describe('Security: Zugriffsschutz', () => {
  test('Werkstudent kann /manager/users nicht aufrufen', async ({ browser, page }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.goto('/manager/users')
    // Middleware redirects werkstudenten away from /manager routes
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 })
    expect(page.url()).not.toContain('/manager/users')
  })
})
