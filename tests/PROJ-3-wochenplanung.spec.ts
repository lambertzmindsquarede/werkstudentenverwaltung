import { test, expect, type Page, type Browser } from '@playwright/test'

// Serial mode: single shared auth session, prevents concurrent OTP requests (avoids HTTP 429)
test.describe.configure({ mode: 'serial' })

// ── Shared auth state ─────────────────────────────────────────────────────────

type Cookie = Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>['cookies'][number]
let authCookies: Cookie[] = []
let authFailed = false

async function ensureAuth(browser: Browser) {
  if (authCookies.length > 0 || authFailed) return

  // Use different dev accounts per browser to avoid concurrent OTP rate limits:
  // Chromium → Clara Fischer, Mobile Safari → Ben Schneider
  const browserName = browser.browserType().name()
  const userPattern = browserName === 'chromium' ? /clara fischer/i : /ben schneider/i

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    const devBadge = page.getByText('Dev only')
    if (!(await devBadge.isVisible({ timeout: 5000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: userPattern })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    authCookies = (await ctx.storageState()).cookies
  } catch {
    authFailed = true
  } finally {
    await ctx.close()
  }
}

async function gotoWoche(page: Page, week: string) {
  if (authCookies.length === 0) { test.skip(); return }
  await page.context().addCookies(authCookies)
  await page.goto(`/dashboard/wochenplanung?week=${week}`)
  await page.waitForSelector('.divide-y', { timeout: 10000 })
}

function daySection(page: Page, name: string) {
  return page.locator('.p-4').filter({ hasText: name }).first()
}

async function selectTime(page: Page, comboboxIndex: number, value: string) {
  await page.locator('[role="combobox"]').nth(comboboxIndex).click()
  await page.getByRole('option', { name: value }).click()
}

// Isolated future weeks — not used by any other test suite
const READ_WEEK = '2030-W40'  // Mo 30 Sep – Fr 04 Oct 2030, no German holidays
const SAVE_WEEK = '2030-W41'  // Mo 07 Oct – Fr 11 Oct 2030
const TMPL_WEEK = '2030-W42'  // Mo 14 Oct – Fr 18 Oct 2030 (loads W41 as template)

// ── Security: unauthenticated redirect ───────────────────────────────────────

test('Unauthenticated /dashboard/wochenplanung redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/wochenplanung?week=2020-W01')
  await expect(page).toHaveURL(/\/login/)
})

// ── AC9: Wochennavigation ────────────────────────────────────────────────────

test.describe('AC9: Wochennavigation', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('KW-Nummer und Datumsbereich werden angezeigt', async ({ page }) => {
    const nav = page.locator('.text-center').filter({ hasText: 'KW' })
    await expect(nav).toContainText('KW 40')
    await expect(nav).toContainText('30.09.')
    await expect(nav).toContainText('04.10.')
  })

  test('← Zurück navigiert zur Vorwoche (W39)', async ({ page }) => {
    await page.getByRole('button', { name: '← Zurück' }).click()
    await expect(page).toHaveURL(/week=2030-W39/)
    await expect(page.locator('.text-center').filter({ hasText: 'KW' })).toContainText('KW 39')
  })

  test('Weiter → navigiert zur nächsten Woche (W41)', async ({ page }) => {
    await page.getByRole('button', { name: 'Weiter →' }).click()
    await expect(page).toHaveURL(/week=2030-W41/)
    await expect(page.locator('.text-center').filter({ hasText: 'KW' })).toContainText('KW 41')
  })
})

// ── AC1: Zeitfelder vorhanden (Mo–Fr) ────────────────────────────────────────

test.describe('AC1: Zeitfelder für alle Wochentage', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('Alle fünf Wochentage werden angezeigt', async ({ page }) => {
    for (const day of ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']) {
      await expect(page.getByText(day)).toBeVisible()
    }
  })

  test('Pro Tag gibt es Von- und Bis-Zeitfelder (≥10 Selects gesamt)', async ({ page }) => {
    const count = await page.locator('[role="combobox"]').count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('Alle Zeitfelder sind in zukünftiger Woche editierbar', async ({ page }) => {
    const triggers = page.locator('button[role="combobox"]')
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeEnabled()
    }
  })
})

// ── AC2: Keine Pausenfelder ───────────────────────────────────────────────────

test.describe('AC2: Keine separaten Pausenfelder (Bruttozeiten)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test('Keine Pausenfelder sichtbar', async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
    await expect(page.getByText(/pause/i)).not.toBeVisible()
  })
})

// ── AC3: Echtzeit-Stundenberechnung ──────────────────────────────────────────

test.describe('AC3: Echtzeit-Stundenberechnung', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('Tagessumme sofort nach Zeiteingabe korrekt (08:00–12:00 = 4,0 Std)', async ({ page }) => {
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await expect(page.getByText('4,0 Std')).toBeVisible()
  })

  test('Wochensumme wird korrekt dargestellt (4,0 / 20,0 Std)', async ({ page }) => {
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await expect(page.getByText(/4,0 \/ 20,0 Std/)).toBeVisible()
  })

  test('Wochensumme addiert mehrere Tage korrekt (Mo 4h + Di 4h = 8,0 Std)', async ({ page }) => {
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await selectTime(page, 2, '08:00')
    await selectTime(page, 3, '12:00')
    await expect(page.getByText(/8,0 \/ 20,0 Std/)).toBeVisible()
  })
})

// ── AC4: Wochenstundenlimit-Warnung ──────────────────────────────────────────

test.describe('AC4: Überschreitungswarnung (nicht blockierend)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('Warnung "Limit überschritten" erscheint bei >20h', async ({ page }) => {
    // 5 × 08:00–13:00 = 5 × 5h = 25h
    for (let i = 0; i < 5; i++) {
      await selectTime(page, i * 2, '08:00')
      await selectTime(page, i * 2 + 1, '13:00')
    }
    await expect(page.getByText('Limit überschritten')).toBeVisible()
    await expect(page.getByText(/wochenstundenlimit.*überschritten/i)).toBeVisible()
  })

  test('Warnung blockiert den Speichern-Button nicht (kein Block)', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await selectTime(page, i * 2, '08:00')
      await selectTime(page, i * 2 + 1, '13:00')
    }
    await expect(page.getByText('Limit überschritten')).toBeVisible()
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeEnabled()
  })

  test('Keine Warnung wenn Stunden unter dem Limit liegen', async ({ page }) => {
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await expect(page.getByText('Limit überschritten')).not.toBeVisible()
  })
})

// ── AC7: kein Arbeitstag ──────────────────────────────────────────────────────

test.describe('AC7: kein Arbeitstag Checkbox', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('"kein Arbeitstag" versteckt die Zeitfelder des Tages', async ({ page }) => {
    const monday = daySection(page, 'Montag')
    await monday.locator('button[role="checkbox"]').click()
    await expect(monday.locator('[role="combobox"]')).toHaveCount(0)
  })

  test('Tag mit "kein Arbeitstag" zählt 0h zur Wochensumme', async ({ page }) => {
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await expect(page.getByText(/4,0 \/ 20,0 Std/)).toBeVisible()
    await daySection(page, 'Montag').locator('button[role="checkbox"]').click()
    await expect(page.getByText(/0,0 \/ 20,0 Std/)).toBeVisible()
  })

  test('"kein Arbeitstag" Checkbox kann wieder deaktiviert werden', async ({ page }) => {
    const checkbox = daySection(page, 'Montag').locator('button[role="checkbox"]')
    await checkbox.click()
    await expect(daySection(page, 'Montag').locator('[role="combobox"]')).toHaveCount(0)
    await checkbox.click()
    const count = await daySection(page, 'Montag').locator('[role="combobox"]').count()
    expect(count).toBeGreaterThan(0)
  })
})

// ── Edge case: Startzeit nach Endzeit ────────────────────────────────────────

test.describe('Edge case: Startzeit ≥ Endzeit', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, READ_WEEK)
  })

  test('Validierungsfehler erscheint wenn Startzeit nach Endzeit liegt', async ({ page }) => {
    await selectTime(page, 0, '14:00')
    await selectTime(page, 1, '08:00')
    await expect(page.getByText(/startzeit muss vor der endzeit/i)).toBeVisible()
  })

  test('Speichern-Button ist bei Validierungsfehler deaktiviert', async ({ page }) => {
    await selectTime(page, 0, '14:00')
    await selectTime(page, 1, '08:00')
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })

  test('Gleiche Start- und Endzeit erzeugt ebenfalls Fehler', async ({ page }) => {
    await selectTime(page, 0, '10:00')
    await selectTime(page, 1, '10:00')
    await expect(page.getByText(/startzeit muss vor der endzeit/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })
})

// ── AC5: Plan speichern und bearbeiten ───────────────────────────────────────

test.describe('AC5: Plan speichern und bearbeiten', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test('Plan speichern zeigt Erfolgs-Toast', async ({ page }) => {
    await gotoWoche(page, SAVE_WEEK)
    await selectTime(page, 0, '09:00')
    await selectTime(page, 1, '13:00')
    await page.getByRole('button', { name: /plan speichern/i }).click()
    await expect(page.getByText('Plan gespeichert')).toBeVisible({ timeout: 10000 })
  })

  test('Gespeicherter Plan bleibt nach Seitenneuladung erhalten', async ({ page }) => {
    await gotoWoche(page, SAVE_WEEK)
    await selectTime(page, 0, '09:00')
    await selectTime(page, 1, '13:00')
    await page.getByRole('button', { name: /plan speichern/i }).click()
    await expect(page.getByText('Plan gespeichert')).toBeVisible({ timeout: 10000 })
    await page.reload()
    await page.waitForSelector('.divide-y', { timeout: 10000 })
    await expect(page.locator('[role="combobox"]').nth(0)).toHaveText('09:00')
    await expect(page.locator('[role="combobox"]').nth(1)).toHaveText('13:00')
  })

  test('Gespeicherter Plan kann bearbeitet und erneut gespeichert werden', async ({ page }) => {
    await gotoWoche(page, SAVE_WEEK)
    await selectTime(page, 0, '10:00')
    await selectTime(page, 1, '14:00')
    await page.getByRole('button', { name: /plan speichern/i }).click()
    await expect(page.getByText('Plan gespeichert')).toBeVisible({ timeout: 10000 })
    await page.reload()
    await page.waitForSelector('.divide-y', { timeout: 10000 })
    await expect(page.locator('[role="combobox"]').nth(0)).toHaveText('10:00')
    await expect(page.locator('[role="combobox"]').nth(1)).toHaveText('14:00')
  })
})

// ── AC6: Vorwoche als Vorlage ─────────────────────────────────────────────────

test.describe('AC6: Vorwoche als Vorlage', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test('Vorlage-Banner ist auf zukünftiger Woche sichtbar', async ({ page }) => {
    await gotoWoche(page, TMPL_WEEK)
    await expect(page.getByText(/vorwoche als vorlage/i)).toBeVisible()
  })

  test('Vorlage aus Vorwoche (W41) wird korrekt in W42 übernommen', async ({ page }) => {
    // Speichere W41 Mo 08:00–12:00
    await gotoWoche(page, SAVE_WEEK)
    await selectTime(page, 0, '08:00')
    await selectTime(page, 1, '12:00')
    await page.getByRole('button', { name: /plan speichern/i }).click()
    await expect(page.getByText('Plan gespeichert')).toBeVisible({ timeout: 10000 })

    // Lade W42 und übernehme Vorlage
    await gotoWoche(page, TMPL_WEEK)
    await page.getByRole('button', { name: /übernehmen/i }).click()
    await expect(page.getByText('Vorlage der Vorwoche übernommen')).toBeVisible({ timeout: 10000 })

    // Montag-Zeiten aus W41 sind übernommen
    await expect(page.locator('[role="combobox"]').nth(0)).toHaveText('08:00')
    await expect(page.locator('[role="combobox"]').nth(1)).toHaveText('12:00')
  })

  test('Vorlage-Banner verschwindet nach dem Übernehmen', async ({ page }) => {
    await gotoWoche(page, TMPL_WEEK)
    await page.getByRole('button', { name: /übernehmen/i }).click()
    await expect(page.getByText('Vorlage der Vorwoche übernommen')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/vorwoche als vorlage/i)).not.toBeVisible()
  })
})

// ── Vollständig vergangene Woche ─────────────────────────────────────────────

test.describe('Vergangene Woche (2020-W01): Nur-Lesen', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await gotoWoche(page, '2020-W01')
  })

  test('Speichern-Button ist deaktiviert', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })

  test('"Vergangene Tage" Hinweis-Banner ist sichtbar', async ({ page }) => {
    await expect(page.getByText(/vergangene tage können nicht bearbeitet werden/i)).toBeVisible()
  })

  test('Vorlage-Banner ist nicht sichtbar (alle Tage vergangen)', async ({ page }) => {
    await expect(page.getByText(/vorwoche als vorlage/i)).not.toBeVisible()
  })
})

// ── Responsive ────────────────────────────────────────────────────────────────

test.describe('Responsive Mobile (375px)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoWoche(page, READ_WEEK)
  })

  test('Alle fünf Tage auf Mobile sichtbar', async ({ page }) => {
    await expect(page.getByText('Montag')).toBeVisible()
    await expect(page.getByText('Freitag')).toBeVisible()
  })

  test('Speichern-Button und Stundenanzeige auf Mobile sichtbar', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeVisible()
    await expect(page.getByText(/Geplant diese Woche/)).toBeVisible()
  })
})

test.describe('Responsive Tablet (768px)', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuth(browser)
    if (authFailed) test.skip()
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await gotoWoche(page, READ_WEEK)
  })

  test('Wochenplan auf Tablet vollständig dargestellt', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible()
    await expect(page.getByText('Montag')).toBeVisible()
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeVisible()
  })
})
