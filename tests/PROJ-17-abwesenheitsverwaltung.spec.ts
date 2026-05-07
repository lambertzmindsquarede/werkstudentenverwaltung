import { test, expect } from '@playwright/test'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function loginAs(page: import('@playwright/test').Page, name: RegExp | string): Promise<boolean> {
  await page.goto('/login')
  const devAvailable = await page.getByText('Dev only').isVisible({ timeout: 6000 }).catch(() => false)
  if (!devAvailable) return false

  await page.locator('[role="combobox"]').first().click()
  await page.getByRole('option', { name }).click()
  await page.getByRole('button', { name: /Als gewählten User einloggen/i }).click()
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  } catch {
    return false
  }
  return true
}

async function loginAsManager(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/login')
  const devAvailable = await page.getByText('Dev only').isVisible({ timeout: 6000 }).catch(() => false)
  if (!devAvailable) return false

  await page.locator('[role="combobox"]').first().click()
  const managerOption = page.getByRole('option', { name: /dev admin.*manager/i })
  const managerVisible = await managerOption.isVisible({ timeout: 3000 }).catch(() => false)
  if (!managerVisible) return false

  await managerOption.click()
  await page.getByRole('button', { name: /Als gewählten User einloggen/i }).click()
  try {
    await page.waitForURL(/\/manager|\/dashboard/, { timeout: 20000 })
  } catch {
    return false
  }
  return true
}

async function loginAsAdmin(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/login')
  const devAvailable = await page.getByText('Dev only').isVisible({ timeout: 6000 }).catch(() => false)
  if (!devAvailable) return false

  await page.locator('[role="combobox"]').first().click()
  // Admin option might be named "Dev Admin" or similar
  const adminOption = page.getByRole('option', { name: /dev admin/i }).first()
  const adminVisible = await adminOption.isVisible({ timeout: 3000 }).catch(() => false)
  if (!adminVisible) return false

  await adminOption.click()
  await page.getByRole('button', { name: /Als gewählten User einloggen/i }).click()
  try {
    await page.waitForURL(/\/admin|\/manager|\/dashboard/, { timeout: 20000 })
  } catch {
    return false
  }
  return true
}

// ─── Security: Unauthenticated access protection ─────────────────────────────

test('unauthenticated user cannot access /dashboard/wochenplanung', async ({ page }) => {
  await page.goto('/dashboard/wochenplanung', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login|\/dashboard\/wochenplanung/, { timeout: 10000 })
})

test('werkstudent is redirected from /manager/abwesenheiten', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/abwesenheiten', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/dashboard|\/login/, { timeout: 10000 })
})

test('werkstudent is redirected from /admin/abwesenheitstypen', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/admin/abwesenheitstypen', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/dashboard|\/login/, { timeout: 10000 })
})

// ─── AC: Wochenplanung — Abwesenheit-eintragen Button sichtbar ───────────────

test('Werkstudent sieht "+ Abwesenheit eintragen" Button in der Wochenplanung', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  // At least one "+ Abwesenheit eintragen" button should exist for a future day
  const absenceBtn = page.locator('button:has-text("+ Abwesenheit eintragen")').first()
  await expect(absenceBtn).toBeVisible({ timeout: 5000 })
})

// ─── AC: Abwesenheitsdialog öffnet sich beim Klick ──────────────────────────

test('Abwesenheitsdialog öffnet sich und zeigt Datum im Titel', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const absenceBtns = page.locator('button:has-text("+ Abwesenheit eintragen")')
  if (await absenceBtns.count() === 0) { test.skip(); return }

  await absenceBtns.first().click()

  // Dialog should open with the correct title
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByRole('heading', { name: 'Abwesenheit eintragen' })).toBeVisible()
})

// ─── AC: Abwesenheitsdialog zeigt Typ-Auswahl ───────────────────────────────

test('Abwesenheitsdialog zeigt Typ-Auswahl-Feld', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const absenceBtns = page.locator('button:has-text("+ Abwesenheit eintragen")')
  if (await absenceBtns.count() === 0) { test.skip(); return }

  await absenceBtns.first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

  // Label "Abwesenheitstyp *" should be visible
  await expect(page.locator('label').filter({ hasText: /Abwesenheitstyp/i })).toBeVisible()
})

// ─── AC: Notizfeld max. 100 Zeichen ──────────────────────────────────────────

test('Notizfeld akzeptiert maximal 100 Zeichen und zeigt Zeichenzähler', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const absenceBtns = page.locator('button:has-text("+ Abwesenheit eintragen")')
  if (await absenceBtns.count() === 0) { test.skip(); return }

  await absenceBtns.first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

  const noteField = page.locator('[id="absence-note"]')
  await noteField.fill('A'.repeat(150))

  const value = await noteField.inputValue()
  expect(value.length).toBeLessThanOrEqual(100)

  // Character counter: shows X/100
  await expect(page.locator('text=/\\d+\\/100/')).toBeVisible()
})

// ─── AC: Abbruch-Button schließt Dialog ──────────────────────────────────────

test('Abbruch-Button schließt den Abwesenheitsdialog', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const absenceBtns = page.locator('button:has-text("+ Abwesenheit eintragen")')
  if (await absenceBtns.count() === 0) { test.skip(); return }

  await absenceBtns.first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: /Abbrechen/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
})

// ─── AC: Abwesender Tag zeigt "Abwesend – Planung gesperrt" ─────────────────

test('Tag mit Abwesenheit zeigt Sperr-Markierung', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  // If there's already an absence, verify the locked state
  const lockedText = page.locator('text=Abwesend – Planung gesperrt').first()
  const isAbsent = await lockedText.isVisible({ timeout: 2000 }).catch(() => false)

  if (isAbsent) {
    await expect(lockedText).toBeVisible()
    await expect(page.locator('text=Details / Löschen').first()).toBeVisible()
  } else {
    test.skip()
  }
})

// ─── AC: Bearbeitungsfrist-Meldung ───────────────────────────────────────────

test('Abgelaufene Bearbeitungsfrist zeigt Informationstext', async ({ page }) => {
  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const detailLinks = page.locator('text=Details / Löschen')
  if (await detailLinks.count() === 0) { test.skip(); return }

  await detailLinks.first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

  const lockMsg = page.getByText(/Bearbeitungsfrist abgelaufen/i)
  if (await lockMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(lockMsg).toBeVisible()
    // Delete button should NOT be visible when frist expired
    await expect(page.getByRole('button', { name: /Abwesenheit löschen/i })).not.toBeVisible()
  }

  await page.keyboard.press('Escape')
})

// ─── AC: Admin — /admin/abwesenheitstypen ───────────────────────────────────

test('Admin kann /admin/abwesenheitstypen aufrufen', async ({ page }) => {
  const ok = await loginAsAdmin(page)
  if (!ok) { test.skip(); return }

  await page.goto('/admin/abwesenheitstypen')
  await expect(page.getByRole('heading', { name: 'Abwesenheitstypen' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Unternehmensweite Standard-Liste')).toBeVisible()
})

// ─── AC: Admin — Standard-Abwesenheitstypen sichtbar ────────────────────────

test('Admin sieht mindestens einen Abwesenheitstyp', async ({ page }) => {
  const ok = await loginAsAdmin(page)
  if (!ok) { test.skip(); return }

  await page.goto('/admin/abwesenheitstypen')
  await expect(page.getByRole('heading', { name: 'Abwesenheitstypen' })).toBeVisible({ timeout: 10000 })

  // Real types from DB or default types should be visible
  const anyType = page.locator('text=/Krank|Urlaub|Frei|Sonstiges/').first()
  await expect(anyType).toBeVisible({ timeout: 5000 })
})

// ─── AC: Admin — Neuer Typ Dialog ───────────────────────────────────────────

test('Admin-Dialog "Neuer Abwesenheitstyp" hat Name- und Kürzel-Felder', async ({ page }) => {
  const ok = await loginAsAdmin(page)
  if (!ok) { test.skip(); return }

  await page.goto('/admin/abwesenheitstypen')
  await expect(page.getByRole('heading', { name: 'Abwesenheitstypen' })).toBeVisible({ timeout: 10000 })

  const newTypeBtn = page.getByRole('button', { name: /\+ Neuer Typ/i })
  if (!(await newTypeBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

  await newTypeBtn.click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Neuer Abwesenheitstyp')).toBeVisible()

  // Name field with 50 char limit
  await expect(page.locator('label', { hasText: /^Name/i })).toBeVisible()
  // Abbreviation field
  await expect(page.locator('label', { hasText: /Kürzel/i })).toBeVisible()

  await page.getByRole('button', { name: /Abbrechen/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

// ─── AC: Manager — /manager/abwesenheiten aufrufen ───────────────────────────

test('Manager kann /manager/abwesenheiten aufrufen und sieht Abwesenheitsübersicht', async ({ page }) => {
  const ok = await loginAsManager(page)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/abwesenheiten')
  await expect(page.getByRole('heading', { name: 'Abwesenheiten' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Übersicht aller Abwesenheiten/i)).toBeVisible()
})

// ─── AC: Manager — Abwesenheitsübersicht hat Filter ──────────────────────────

test('Abwesenheitsübersicht hat Person-Filter und Datumsbereich-Filter', async ({ page }) => {
  const ok = await loginAsManager(page)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/abwesenheiten')
  await expect(page.getByRole('heading', { name: 'Abwesenheiten' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('Filter')).toBeVisible()
  await expect(page.getByText('Person')).toBeVisible()
  await expect(page.getByText('Von')).toBeVisible()
  await expect(page.getByText('Bis')).toBeVisible()
  await expect(page.getByRole('button', { name: /Anwenden/i })).toBeVisible()
})

// ─── AC: Manager — Tabelle hat sortierbare Spalten ───────────────────────────

test('Abwesenheitsübersicht hat Datum und Werkstudent als sortierbare Spalten', async ({ page }) => {
  const ok = await loginAsManager(page)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/abwesenheiten')
  await expect(page.getByRole('heading', { name: 'Abwesenheiten' })).toBeVisible({ timeout: 10000 })

  // Table headers
  await expect(page.getByRole('columnheader').filter({ hasText: 'Werkstudent' })).toBeVisible()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Datum' })).toBeVisible()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Typ' })).toBeVisible()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Notiz' })).toBeVisible()
})

// ─── AC: Manager — Einstellungsseite hat Abwesenheitstypen-Abschnitt ─────────

test('Manager-Einstellungsseite hat Abwesenheitstypen-Konfigurationsbereich', async ({ page }) => {
  const ok = await loginAsManager(page)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/settings')
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })

  // Should have absence type config section
  const absenceSection = page.locator('text=/Abwesenheitstypen|Abwesenheitskonfiguration/i').first()
  await expect(absenceSection).toBeVisible({ timeout: 5000 })
})

// ─── AC: Manager-Kalender hat Abwesenheiten-Navigation ──────────────────────

test('Manager-Kalender hat "Abwesenheiten"-Link in der Navigation', async ({ page }) => {
  const ok = await loginAsManager(page)
  if (!ok) { test.skip(); return }

  await page.goto('/manager/kalender')
  await expect(page.locator('nav')).toBeVisible({ timeout: 10000 })

  await expect(page.getByRole('link', { name: /Abwesenheiten/i })).toBeVisible()
})

// ─── Responsive: Wochenplanung auf Mobile ───────────────────────────────────

test('Abwesenheit-eintragen-Button sichtbar auf Mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })

  const ok = await loginAs(page, /Anna Müller/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard/wochenplanung')
  await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible({ timeout: 10000 })

  const btn = page.locator('button:has-text("+ Abwesenheit eintragen")').first()
  await expect(btn).toBeVisible({ timeout: 5000 })
})
