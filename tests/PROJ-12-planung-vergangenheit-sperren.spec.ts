import { test, expect, type Page, type Browser } from '@playwright/test'

// Serial mode: prevents concurrent Supabase OTP requests (avoids HTTP 429)
test.describe.configure({ mode: 'serial' })

// ── Shared auth state ─────────────────────────────────────────────────────────
// Login happens exactly once per test run; every test reuses the saved cookies.

type Cookie = Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>['cookies'][number]
let authCookies: Cookie[] = []
let authFailed = false

async function ensureWerkstudentAuth(browser: Browser) {
  if (authCookies.length > 0 || authFailed) return

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    const devBadge = page.getByText('Dev only')
    if (!(await devBadge.isVisible({ timeout: 5000 }).catch(() => false))) {
      authFailed = true; return
    }
    // Select Clara Fischer (werkstudent, no existing data — clean test account)
    await page.locator('[role="combobox"]').first().click()
    const claraOption = page.getByRole('option', { name: /clara fischer/i })
    if (!(await claraOption.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await claraOption.click()
    await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    authCookies = (await ctx.storageState()).cookies
  } catch {
    authFailed = true
  } finally {
    await ctx.close()
  }
}

// Helper: restore auth cookies and navigate to a wochenplanung week
async function gotoWoche(page: Page, week: string) {
  if (authCookies.length === 0) { test.skip(); return }
  await page.context().addCookies(authCookies)
  await page.goto(`/dashboard/wochenplanung?week=${week}`)
  await page.waitForSelector('.divide-y', { timeout: 10000 })
}

// Day rows are direct children of the .divide-y container (Mon=0 … Fri=4).
function dayRow(page: Page, index: number) {
  return page.locator('.divide-y > div').nth(index)
}

// Time-field triggers: shadcn <Select> renders as button[role="combobox"] (PROJ-13)
function timeSelects(container: Page | ReturnType<Page['locator']>) {
  return (container as Page).locator('button[role="combobox"]')
}
function timeSelectsIn(locator: ReturnType<Page['locator']>) {
  return locator.locator('button[role="combobox"]')
}

// ── Unauthenticated protection ────────────────────────────────────────────────

test('unauthenticated /dashboard/wochenplanung redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/wochenplanung?week=2020-W01')
  await expect(page).toHaveURL(/\/login/)
})

// ── Security ──────────────────────────────────────────────────────────────────

test('POST /api/auth/dev-login ohne Auth gibt keinen 500 zurück', async ({ request }) => {
  const response = await request.post('/api/auth/dev-login', {
    data: {},
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  expect(response.status()).not.toBe(500)
})

// ── AC: Vollständig vergangene Woche (2020-W01) ───────────────────────────────
// Mon 2019-12-30 – Fri 2020-01-03 — always in the past regardless of test date.

test.describe('Vollständig vergangene Woche (2020-W01)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, '2020-W01')
  })

  test('Speichern-Button ist deaktiviert', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })

  test('Hinweis-Banner "Vergangene Tage" ist sichtbar', async ({ page }) => {
    await expect(
      page.getByText(/vergangene tage können nicht bearbeitet werden/i)
    ).toBeVisible()
  })

  test('Vorlage-Banner ist nicht sichtbar', async ({ page }) => {
    await expect(page.getByText(/vorwoche als vorlage/i)).not.toBeVisible()
  })

  // All time Select triggers must be disabled (past days)
  test('Zeit-Selects der Arbeitstage sind alle deaktiviert', async ({ page }) => {
    const triggers = timeSelects(page)
    const count = await triggers.count()
    // 2020-W01: Jan 1 is a holiday → 4 work days × 2 selects = 8 triggers
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeDisabled()
    }
  })

  test('Alle "kein Arbeitstag"-Checkboxen sind deaktiviert', async ({ page }) => {
    const checkboxes = page.locator('button[role="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeDisabled()
    }
  })

  test('"+ Block hinzufügen" ist nicht sichtbar', async ({ page }) => {
    await expect(page.getByText('+ Block hinzufügen')).not.toBeVisible()
  })
})

// ── AC: Vollständig zukünftige Woche (2030-W30) ───────────────────────────────
// Mon 22 Jul – Fri 26 Jul 2030 — no German public holidays.

test.describe('Vollständig zukünftige Woche (2030-W30)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, '2030-W30')
  })

  test('Vergangene-Tage-Banner ist NICHT sichtbar', async ({ page }) => {
    await expect(
      page.getByText(/vergangene tage können nicht bearbeitet werden/i)
    ).not.toBeVisible()
  })

  test('Speichern-Button ist aktiv', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeEnabled()
  })

  test('Zeit-Selects sind alle editierbar', async ({ page }) => {
    const triggers = timeSelects(page)
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeEnabled()
    }
  })

  test('Vorlage-Banner wird angezeigt', async ({ page }) => {
    await expect(page.getByText(/vorwoche als vorlage/i)).toBeVisible()
  })
})

// ── AC: Aktuelle Woche teils vergangen ───────────────────────────────────────
// Login first (real time → OTP works), then freeze clock to Thu 2026-05-07,
// reload so React's useMemo re-runs with the frozen date.
// W19 (Mon 04 – Fri 08 May 2026): Mon–Wed past, Thu today, Fri future.

test.describe('Aktuelle Woche teils vergangen (clock: Do 2026-05-07, KW W19)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, '2026-W19')
    // Install clock AFTER auth & navigation so JWT/OTP verification uses real time
    await page.clock.install({ time: new Date('2026-05-07T10:00:00') })
    await page.reload()
    await page.waitForSelector('.divide-y', { timeout: 10000 })
  })

  test('Vergangene-Tage-Banner ist sichtbar', async ({ page }) => {
    await expect(
      page.getByText(/vergangene tage können nicht bearbeitet werden/i)
    ).toBeVisible()
  })

  test('Speichern-Button ist aktiv (Woche nicht vollständig vergangen)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeEnabled()
  })

  test('Montag-Zeit-Selects sind deaktiviert (vergangen)', async ({ page }) => {
    const triggers = timeSelectsIn(dayRow(page, 0))
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeDisabled()
    }
  })

  test('Dienstag-Zeit-Selects sind deaktiviert (vergangen)', async ({ page }) => {
    const triggers = timeSelectsIn(dayRow(page, 1))
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeDisabled()
    }
  })

  test('Donnerstag-Zeit-Selects sind editierbar (heute)', async ({ page }) => {
    const triggers = timeSelectsIn(dayRow(page, 3))
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeEnabled()
    }
  })

  test('Freitag-Zeit-Selects sind editierbar (Zukunft)', async ({ page }) => {
    const triggers = timeSelectsIn(dayRow(page, 4))
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeEnabled()
    }
  })

  test('Montag-Checkbox ist deaktiviert (vergangen)', async ({ page }) => {
    await expect(dayRow(page, 0).locator('button[role="checkbox"]')).toBeDisabled()
  })

  test('Donnerstag-Checkbox ist aktiv (heute)', async ({ page }) => {
    await expect(dayRow(page, 3).locator('button[role="checkbox"]')).toBeEnabled()
  })
})

// ── Responsive Mobile (375px) — vergangene Woche ─────────────────────────────

test.describe('Responsive Mobile (375px) — vergangene Woche', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureWerkstudentAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoWoche(page, '2020-W01')
  })

  test('Hinweis-Banner auf Mobile sichtbar', async ({ page }) => {
    await expect(
      page.getByText(/vergangene tage können nicht bearbeitet werden/i)
    ).toBeVisible()
  })

  test('Speichern-Button auf Mobile deaktiviert', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })
})
