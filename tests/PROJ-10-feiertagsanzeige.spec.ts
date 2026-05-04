import { test, expect } from '@playwright/test'

// Supabase rate-limits magic link generation (~1 per email per minute).
// Running tests serially avoids login conflicts when multiple tests log in as the same user.
test.describe.configure({ mode: 'serial' })

// KW18 2026 (Mon 2026-04-27 to Fri 2026-05-01) contains "Tag der Arbeit" on Freitag.
// Authenticated API calls (browser cookies) work; unauthenticated calls return 401 (by proxy design).

const HOLIDAY_WEEK = '2026-W18'
const HOLIDAY_DATE = '2026-05-01' // Freitag, Tag der Arbeit
const HOLIDAY_NAME = 'Tag der Arbeit'

// ── Helper: Log in via dev login UI ──────────────────────────────────────────

async function devLoginAs(
  page: import('@playwright/test').Page,
  userLabel: string
): Promise<boolean> {
  await page.goto('/login')

  // If the proxy detects an existing session it redirects away from /login — skip test
  if (!page.url().includes('/login')) {
    test.skip()
    return false
  }

  const loginBtn = page.getByRole('button', { name: /als gewählten user einloggen/i })
  if (!(await loginBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip()
    return false
  }

  // Change user if not the default (Dev Admin / Manager)
  if (!userLabel.includes('Admin')) {
    const trigger = page.getByRole('combobox').first()
    await trigger.click()
    await page.getByRole('option', { name: userLabel }).click()
  }

  await loginBtn.click()
  try {
    await page.waitForURL(/\/dashboard|\/manager/, { timeout: 20000 })
  } catch {
    // Supabase rate-limits magic link generation; skip the test gracefully
    test.skip()
    return false
  }
  return true
}

async function devLoginAsWerkstudent(page: import('@playwright/test').Page): Promise<boolean> {
  return devLoginAs(page, 'Anna Müller (Werkstudentin)')
}

async function devLoginAsManager(page: import('@playwright/test').Page): Promise<boolean> {
  return devLoginAs(page, 'Dev Admin')
}

// ── Helper: Check holiday data via authenticated page.request ─────────────────

async function holidayApiIsAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  try {
    const res = await page.request.get(`/api/feiertage?bundesland=NW&year=2026`)
    if (!res.ok()) return false
    const body = await res.json()
    if (!Array.isArray(body)) return false
    return body.some(
      (h: { date: string; name: string }) =>
        h.date === HOLIDAY_DATE && h.name === HOLIDAY_NAME
    )
  } catch {
    return false
  }
}

// ── Security: proxy protects the API ─────────────────────────────────────────

test('GET /api/feiertage returns 401 for unauthenticated requests (proxy design)', async ({
  request,
}) => {
  // The src/proxy.ts returns 401 for all unauthenticated /api/* requests.
  // This is intentional — the endpoint is "internal" (called from authenticated pages only).
  const res = await request.get('/api/feiertage?bundesland=NW&year=2026')
  expect(res.status()).toBe(401)
})

test('POST /api/time-entries/stamp returns 401 for unauthenticated requests', async ({
  request,
}) => {
  const res = await request.post('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(res.status()).toBe(401)
})

// ── API endpoint (authenticated) ─────────────────────────────────────────────

test.describe('API /api/feiertage – authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  test('returns a JSON array for NW/2026', async ({ page }) => {
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('each item has date (YYYY-MM-DD) and name fields only', async ({ page }) => {
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    if (body.length === 0) {
      test.skip() // external API down
      return
    }
    for (const item of body) {
      expect(Object.keys(item).sort()).toEqual(['date', 'name'])
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof item.name).toBe('string')
    }
  })

  test('includes Tag der Arbeit on 2026-05-01 for NW', async ({ page }) => {
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    if (body.length === 0) {
      test.skip() // external API down
      return
    }
    const found = body.some(
      (h: { date: string; name: string }) =>
        h.date === HOLIDAY_DATE && h.name === HOLIDAY_NAME
    )
    expect(found).toBe(true)
  })

  test('returns empty array for unknown bundesland (fail-safe)', async ({ page }) => {
    const res = await page.request.get('/api/feiertage?bundesland=XX&year=2026')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })

  test('BY returns different holidays than NW (Bayern-specific holidays)', async ({ page }) => {
    const [nwRes, byRes] = await Promise.all([
      page.request.get('/api/feiertage?bundesland=NW&year=2026'),
      page.request.get('/api/feiertage?bundesland=BY&year=2026'),
    ])
    expect(nwRes.ok()).toBe(true)
    expect(byRes.ok()).toBe(true)
    const nw = await nwRes.json()
    const by = await byRes.json()
    if (nw.length === 0 || by.length === 0) {
      test.skip()
      return
    }
    // Bayern has Heilige Drei Könige (Jan 6) — NRW does not
    const byNames: string[] = by.map((h: { name: string }) => h.name)
    const nwNames: string[] = nw.map((h: { name: string }) => h.name)
    // Bayern has more or different holidays — just verify the counts differ
    // or that BY has at least one holiday NW doesn't
    const byOnly = byNames.filter((n) => !nwNames.includes(n))
    expect(byOnly.length).toBeGreaterThan(0)
  })
})

// ── Wochenplanung: Feiertagsmarkierung (KW18 — contains May 1) ───────────────

test.describe('Wochenplanung – Feiertagsmarkierung in KW18', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  test('holiday day (Freitag 2026-05-01) shows holiday name label', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
  })

  test('holiday day shows "Gesetzlicher Feiertag" message instead of time inputs', async ({
    page,
  }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/Gesetzlicher Feiertag/i)).toBeVisible()
    await expect(page.getByText(/Planung nicht möglich/i)).toBeVisible()
  })

  test('holiday day has gray background (bg-slate-100 class)', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
    // The holiday row gets a bg-slate-100/70 background
    const holidayRow = page.locator('[class*="bg-slate-100"]')
    await expect(holidayRow.first()).toBeVisible()
  })

  test('five weekdays are rendered in the week plan', async ({ page }) => {
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    // All 5 day names should be present in the plan
    for (const day of ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('non-holiday days still show time input fields', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
    // Non-holiday days should still have time inputs (type="time")
    const timeInputs = page.locator('input[type="time"]')
    // At least one non-holiday day should have time inputs
    await expect(timeInputs.first()).toBeVisible()
  })
})

// ── Dashboard: StempelCard – Feiertagsdialog ──────────────────────────────────

test.describe('StempelCard – Feiertagsdialog (if today is a holiday)', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  test('StempelCard renders and shows Zeiterfassung heute', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Zeiterfassung heute')).toBeVisible({ timeout: 8000 })
  })

  test('holiday banner visible when today is a federal holiday', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip() // no holiday data or today is not a holiday
      return
    }
    // Today must be a holiday — verify the holiday name matches
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    const body = await res.json()
    const todayISO = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Berlin'}).format(new Date())
    const todayHoliday = body.find((h: { date: string }) => h.date === todayISO)
    if (!todayHoliday) {
      test.skip() // today is not a holiday
      return
    }
    await page.goto('/dashboard')
    await expect(page.getByText(todayHoliday.name)).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/gesetzlicher Feiertag/i)).toBeVisible()
  })

  test('Einstempeln shows holiday dialog when today is a holiday', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    const body = await res.json()
    const todayISO = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Berlin'}).format(new Date())
    const todayHoliday = body.find((h: { date: string }) => h.date === todayISO)
    if (!todayHoliday) {
      test.skip() // today is not a holiday
      return
    }

    await page.goto('/dashboard')
    await expect(page.getByText(todayHoliday.name)).toBeVisible({ timeout: 8000 })

    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip() // already stamped in
      return
    }
    await stampInBtn.click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /trotzdem einstempeln/i })).toBeVisible()
  })

  test('"Abbrechen" in holiday dialog keeps Einstempeln button visible', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    const res = await page.request.get('/api/feiertage?bundesland=NW&year=2026')
    const body = await res.json()
    const todayISO = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Berlin'}).format(new Date())
    const todayHoliday = body.find((h: { date: string }) => h.date === todayISO)
    if (!todayHoliday) {
      test.skip()
      return
    }

    await page.goto('/dashboard')
    await expect(page.getByText(todayHoliday.name)).toBeVisible({ timeout: 8000 })

    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Einstempeln' })).toBeVisible()
  })
})

// ── Manager: Bundesland dropdown in EditUserDialog ────────────────────────────

test.describe('Manager – Bundesland-Konfiguration im EditUserDialog', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsManager(page)
  })

  test('EditUserDialog has Bundesland dropdown', async ({ page }) => {
    await page.goto('/manager/users')
    const editBtns = page.getByRole('button', { name: 'Bearbeiten' })
    await expect(editBtns.first()).toBeVisible({ timeout: 8000 })
    await editBtns.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Bundesland', { exact: true })).toBeVisible()
    await expect(dialog.locator('#bundesland-select')).toBeVisible()
  })

  test('Bundesland dropdown contains key German states', async ({ page }) => {
    await page.goto('/manager/users')
    await expect(page.getByRole('button', { name: 'Bearbeiten' }).first()).toBeVisible({
      timeout: 8000,
    })
    await page.getByRole('button', { name: 'Bearbeiten' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#bundesland-select').click()

    await expect(page.getByRole('option', { name: 'Nordrhein-Westfalen' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Bayern' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Berlin' })).toBeVisible()
  })
})

// ── Manager Kalender: Feiertagsname in KW18 ───────────────────────────────────

test.describe('Manager Kalender – Feiertagsname in Zelle', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsManager(page)
  })

  test('holiday name appears in calendar for KW18 (Tag der Arbeit)', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.goto(`/manager/kalender?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
  })
})

// ── Responsive ────────────────────────────────────────────────────────────────

test.describe('Responsive – Wochenplanung holiday at 375px and 768px', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  test('holiday name visible on mobile (375px)', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
  })

  test('holiday name visible on tablet (768px)', async ({ page }) => {
    const hasHoliday = await holidayApiIsAvailable(page)
    if (!hasHoliday) {
      test.skip()
      return
    }
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`/dashboard/wochenplanung?week=${HOLIDAY_WEEK}`)
    await expect(page.getByText(HOLIDAY_NAME).first()).toBeVisible({ timeout: 8000 })
  })
})
