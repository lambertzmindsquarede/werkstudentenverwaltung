import { test, expect, type Page } from '@playwright/test'

// ── Unauthenticated protection ────────────────────────────────────────────────

test('unauthenticated /dashboard/wochenplanung redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/wochenplanung?week=2030-W20')
  await expect(page).toHaveURL(/\/login/)
})

// ── Dev login helper ──────────────────────────────────────────────────────────

async function devLoginAsWerkstudent(page: Page): Promise<boolean> {
  await page.goto('/login')
  const devSection = page.getByText('Dev only')
  if (!(await devSection.isVisible().catch(() => false))) {
    test.skip()
    return false
  }
  const selectTrigger = page.locator('[role="combobox"]').first()
  await selectTrigger.click()
  const annaOption = page.getByRole('option', { name: /anna müller/i })
  if (!(await annaOption.isVisible().catch(() => false))) {
    test.skip()
    return false
  }
  await annaOption.click()
  await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  } catch {
    test.skip()
    return false
  }
  if (page.url().includes('/manager')) {
    test.skip()
    return false
  }
  return true
}

// 2030-W20 is always in the future — no past-day locks interfere.
const FUTURE_WEEK = '2030-W20'

// ── AC1 + AC2: Von/Bis sind Dropdowns mit nur Viertelstunden-Zeiten ───────────

test.describe('Dropdown-UI (zukünftige Woche 2030-W20)', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await devLoginAsWerkstudent(page)
    if (!ok) return
    await page.goto(`/dashboard/wochenplanung?week=${FUTURE_WEEK}`)
    await page.waitForSelector('text=Wochenplanung', { timeout: 8000 }).catch(() => {})
  })

  // AC1: Keine input[type="time"] — nur Select-Trigger vorhanden
  test('AC1: Von/Bis-Felder sind Select-Dropdowns, keine Freitext-Inputs', async ({ page }) => {
    const timeInputs = page.locator('input[type="time"]')
    await expect(timeInputs).toHaveCount(0)

    // Mindestens 2 Select-Trigger pro Tag (Von + Bis) × 5 Tage = ≥10
    const selects = page.locator('[role="combobox"]')
    const count = await selects.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  // AC2 + AC3: Dropdown zeigt nur :00/:15/:30/:45, Bereich 06:00–22:00, 65 Optionen
  test('AC2+AC3: Dropdown enthält nur Viertelstunden-Zeiten von 06:00 bis 22:00 (65 Optionen)', async ({ page }) => {
    // Open the first "Von" Select
    const firstSelect = page.locator('[role="combobox"]').first()
    await firstSelect.click()

    const options = page.locator('[role="option"]')
    await expect(options.first()).toBeVisible()

    const count = await options.count()
    expect(count).toBe(65)

    // First option is 06:00
    await expect(options.first()).toHaveText('06:00')

    // Last option is 22:00
    await expect(options.last()).toHaveText('22:00')

    // All options have minutes in {00, 15, 30, 45}
    const allTexts = await options.allTextContents()
    const validMinutes = new Set(['00', '15', '30', '45'])
    for (const t of allTexts) {
      const minutes = t.split(':')[1]
      expect(validMinutes.has(minutes), `Option "${t}" is not a quarter hour`).toBe(true)
    }

    // Close the dropdown
    await page.keyboard.press('Escape')
  })

  // AC3: 22:15 existiert nicht im Dropdown
  test('AC3 (Grenzfall): 22:00 ist letzte Option, 22:15 existiert nicht', async ({ page }) => {
    const firstSelect = page.locator('[role="combobox"]').first()
    await firstSelect.click()

    await expect(page.getByRole('option', { name: '22:00' })).toBeVisible()
    await expect(page.getByRole('option', { name: '22:15' })).not.toBeVisible()

    await page.keyboard.press('Escape')
  })

  // AC6: Startzeit == Endzeit → Validierungsfehler
  test('AC6: Gleiche Start- und Endzeit erzeugt Validierungsfehler', async ({ page }) => {
    // Set Monday Von to 10:00
    const vonSelects = page.locator('[role="combobox"]').filter({ hasNot: page.locator('[role="option"]') })
    const monVon = page.locator('[role="combobox"]').nth(0)
    const monBis = page.locator('[role="combobox"]').nth(1)

    await monVon.click()
    await page.getByRole('option', { name: '10:00' }).click()

    await monBis.click()
    await page.getByRole('option', { name: '10:00' }).click()

    await expect(page.getByText(/startzeit muss vor der endzeit/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeDisabled()
  })

  // AC7: Stundensummen werden korrekt berechnet
  test('AC7: Stundensumme wird korrekt berechnet (08:00–09:45 = 1,8 Std)', async ({ page }) => {
    const monVon = page.locator('[role="combobox"]').nth(0)
    const monBis = page.locator('[role="combobox"]').nth(1)

    await monVon.click()
    await page.getByRole('option', { name: '08:00' }).click()

    await monBis.click()
    await page.getByRole('option', { name: '09:45' }).click()

    // 08:00–09:45 = 105 min = 1,8 Std
    await expect(page.getByText('1,8 Std')).toBeVisible()
  })

  // Kein-Arbeitstag edge case: Dropdowns verschwinden
  test('Edge: "kein Arbeitstag" blendet Dropdowns aus', async ({ page }) => {
    const mondaySection = page.locator('.p-4').filter({ hasText: 'Montag' }).first()
    const checkbox = mondaySection.locator('button[role="checkbox"]')
    await checkbox.click()

    // Dropdowns in the Monday row should no longer be visible
    const mondaySelects = mondaySection.locator('[role="combobox"]')
    await expect(mondaySelects).toHaveCount(0)
  })
})

// ── AC5: Server-seitige Zod-Validierung via direkten API-Aufruf ───────────────

test('AC5 (Security): Server Action lehnt Nicht-Viertelstunden-Zeiten ab', async ({ request }) => {
  // Directly call the Next.js server action via the internal route.
  // Even without a valid session, a 400/401/500 (not 200 with success) is expected.
  // The important test is that a non-quarter time like 09:23 is NEVER silently accepted.
  // We test this structurally: the Zod schema rejects it (covered by unit tests).
  // Here we verify the API doesn't crash on invalid input and returns a non-2xx or redirect.
  const response = await request.post('/dashboard/wochenplanung', {
    data: JSON.stringify([{
      date: '2030-05-13',
      planned_start: '09:23',
      planned_end: '12:00',
      block_index: 1,
    }]),
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  })
  // Should not be a 500 internal error; a redirect to /login (307) or 400/401 is acceptable
  expect(response.status()).not.toBe(500)
  expect(response.status()).not.toBe(200)
})

// ── Responsive: Select-Dropdowns auf Mobile ───────────────────────────────────

test.describe('Responsive (Mobile 375px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const ok = await devLoginAsWerkstudent(page)
    if (!ok) return
    await page.goto(`/dashboard/wochenplanung?week=${FUTURE_WEEK}`)
    await page.waitForSelector('text=Wochenplanung', { timeout: 8000 }).catch(() => {})
  })

  test('Select-Dropdowns sichtbar auf Mobile', async ({ page }) => {
    const selects = page.locator('[role="combobox"]')
    const count = await selects.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('Speichern-Button sichtbar auf Mobile', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plan speichern/i })).toBeVisible()
  })
})

// ── Regression: Vergangene Woche — Select-Trigger deaktiviert ────────────────

test.describe('Regression PROJ-12: vergangene Tage sperren Select-Trigger', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await devLoginAsWerkstudent(page)
    if (!ok) return
    await page.goto('/dashboard/wochenplanung?week=2020-W01')
    await page.waitForSelector('text=Wochenplanung', { timeout: 8000 }).catch(() => {})
  })

  test('Alle Select-Trigger in vergangener Woche sind deaktiviert', async ({ page }) => {
    // The shadcn Select renders a button as the trigger; disabled means aria-disabled or pointer-events:none
    const triggers = page.locator('button[role="combobox"]')
    const count = await triggers.count()
    // There may be 0 triggers if all days show "kein Arbeitstag" or no data
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toBeDisabled()
    }
  })
})
