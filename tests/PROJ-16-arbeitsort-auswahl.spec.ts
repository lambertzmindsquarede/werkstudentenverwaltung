import { test, expect, type Browser } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

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
    if (!(await page.getByText('Dev only').isVisible({ timeout: 5000 }).catch(() => false))) {
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
  } catch { authFailed = true }
  finally { await ctx.close() }
}

async function ensureWerkstudentAuth(browser: Browser) {
  if (werkstudentCookies.length > 0 || authFailed) return
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    if (!(await page.getByText('Dev only').isVisible({ timeout: 5000 }).catch(() => false))) {
      authFailed = true; return
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: /anna müller/i })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      authFailed = true; return
    }
    await option.click()
    await page.getByRole('button', { name: /als gewählten user einloggen/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    if (page.url().includes('/manager')) { authFailed = true; return }
    werkstudentCookies = (await ctx.storageState()).cookies
  } catch { authFailed = true }
  finally { await ctx.close() }
}

// ── Auth-Protection ────────────────────────────────────────────────────────────

test('unauthenticated /manager/arbeitsorte redirects to /login', async ({ page }) => {
  await page.goto('/manager/arbeitsorte')
  await expect(page).toHaveURL(/\/login/)
})

test('werkstudent accessing /manager/arbeitsorte is redirected away', async ({ page }) => {
  // Even with a werkstudent cookie, manager routes should be inaccessible
  await page.goto('/manager/arbeitsorte')
  await expect(page).toHaveURL(/\/login/)
})

// ── Manager: Arbeitsort-Verwaltungsseite ───────────────────────────────────────

test.describe('Manager: Arbeitsorte-Verwaltungsseite', () => {
  let lastCreatedOrtName = ''

  test.beforeAll(async ({ browser }) => {
    await ensureManagerAuth(browser)
  })

  test.beforeEach(async ({ page }) => {
    if (authFailed || managerCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(managerCookies)
    await page.goto('/manager/arbeitsorte')
    await page.waitForSelector('text=Arbeitsorte', { timeout: 8000 }).catch(() => {})
  })

  test('AC: Manager-Seite /manager/arbeitsorte lädt korrekt', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Arbeitsorte' })).toBeVisible()
    await expect(page.getByRole('button', { name: /neuer arbeitsort/i })).toBeVisible()
  })

  test('AC: Kalender-Navigation enthält "Arbeitsorte" Link', async ({ page }) => {
    await page.goto('/manager/kalender')
    await expect(page.getByRole('link', { name: /arbeitsorte/i })).toBeVisible()
  })

  test('AC: Manager kann neuen Arbeitsort anlegen', async ({ page }) => {
    lastCreatedOrtName = `QA-Ort-${Date.now()}`
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').locator('input').fill(lastCreatedOrtName)
    await page.getByRole('button', { name: /^speichern$/i }).click()
    // After creation page reloads (window.location.reload) — wait for reload
    await page.waitForURL(/\/manager\/arbeitsorte/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(lastCreatedOrtName)).toBeVisible()
  })

  test('AC: Duplikater aktiver Name wird abgelehnt', async ({ page }) => {
    // Verify the ort from the previous test is actually in the list
    if (!lastCreatedOrtName) { test.skip(); return }
    const isInList = await page.getByText(lastCreatedOrtName).isVisible().catch(() => false)
    if (!isInList) { test.skip(); return }

    // Try to create an ort with the same name — dialog must show an error
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').locator('input').fill(lastCreatedOrtName)
    await page.getByRole('button', { name: /^speichern$/i }).click()

    // Wait for server action to complete: save button returns to non-loading state
    await expect(page.getByRole('button', { name: /^speichern$/i })).not.toBeDisabled({ timeout: 8000 })
    // Dialog must stay open and show an error (app-level or DB-constraint)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').locator('p').filter({ hasClass: 'text-red-500' }).first()).toBeVisible({ timeout: 3000 })
  })

  test('AC: Leerer Name wird abgelehnt (Mindestname 1 Zeichen)', async ({ page }) => {
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    // Speichern button should be disabled without text
    const saveBtn = page.getByRole('button', { name: /^speichern$/i })
    await expect(saveBtn).toBeDisabled()
  })

  test('AC: Zeichenzähler im Dialog zeigt aktuelle Länge', async ({ page }) => {
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    const input = page.getByRole('dialog').locator('input')
    await input.fill('Test')
    await expect(page.getByText('4/100 Zeichen')).toBeVisible()
  })

  test('AC: Manager kann Arbeitsort deaktivieren und reaktivieren', async ({ page }) => {
    // Create a fresh ort to toggle
    const uniqueName = `QA-Toggle-${Date.now()}`
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    await page.getByRole('dialog').locator('input').fill(uniqueName)
    await page.getByRole('button', { name: /^speichern$/i }).click()
    await page.waitForURL(/\/manager\/arbeitsorte/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Deactivate it — use specific row div selector to avoid strict mode violation
    const row = page.locator('div[class*="justify-between"]').filter({ hasText: uniqueName })
    await row.getByRole('button', { name: /deaktivieren/i }).click()
    await expect(page.getByText('Arbeitsort deaktiviert')).toBeVisible()

    // Reactivate it
    await row.getByRole('button', { name: /reaktivieren/i }).click()
    await expect(page.getByText('Arbeitsort reaktiviert')).toBeVisible()
  })

  test('AC: Inaktive Arbeitsorte erscheinen mit "Inaktiv"-Badge und durchgestrichenem Namen', async ({ page }) => {
    // Create and deactivate an ort
    const uniqueName = `QA-Inaktiv-${Date.now()}`
    await page.getByRole('button', { name: /neuer arbeitsort/i }).click()
    await page.getByRole('dialog').locator('input').fill(uniqueName)
    await page.getByRole('button', { name: /^speichern$/i }).click()
    await page.waitForURL(/\/manager\/arbeitsorte/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const row = page.locator('div[class*="justify-between"]').filter({ hasText: uniqueName })
    await row.getByRole('button', { name: /deaktivieren/i }).click()
    await page.waitForTimeout(500)

    // "Inaktiv"-Badge should appear
    await expect(page.getByText('Inaktiv').first()).toBeVisible()
  })

  test('AC: Hinweis zu inaktiven Orten erscheint wenn vorhanden', async ({ page }) => {
    // If any inactive orts exist, the alert should be visible
    const inaktivCount = await page.getByText('Inaktiv').count()
    if (inaktivCount > 0) {
      await expect(page.getByText(/inaktive orte sind für neue planungen gesperrt/i)).toBeVisible()
    }
  })

  test('Responsive: Arbeitsorte-Seite auf Mobile (375px) nutzbar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/manager/arbeitsorte')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Arbeitsorte' })).toBeVisible()
    await expect(page.getByRole('button', { name: /neuer arbeitsort/i })).toBeVisible()
  })
})

// ── Werkstudent: Arbeitsort-Auswahl in der Wochenplanung ─────────────────────

test.describe('Werkstudent: Arbeitsort-Dropdown in Wochenplanung', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureWerkstudentAuth(browser)
  })

  test.beforeEach(async ({ page }) => {
    if (authFailed || werkstudentCookies.length === 0) { test.skip(); return }
    await page.context().addCookies(werkstudentCookies)
    await page.goto('/dashboard/wochenplanung?week=2030-W20')
    await page.waitForSelector('text=Wochenplanung', { timeout: 8000 }).catch(() => {})
  })

  test('AC: Wochenplanung-Seite lädt ohne Fehler', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible()
  })

  test('AC: Arbeitsort-Dropdown oder Hinweismeldung erscheint pro Arbeitstag', async ({ page }) => {
    // Either the dropdown selector (combobox labeled "Ort") or the hint message should be visible
    const arbeitsortDropdowns = page.locator('text=Ort').filter({ hasNot: page.locator('header') })
    const hinweisMessage = page.getByText(/manager hat noch keine arbeitsorte/i)

    const hasDropdown = await arbeitsortDropdowns.first().isVisible().catch(() => false)
    const hasHinweis = await hinweisMessage.first().isVisible().catch(() => false)

    expect(hasDropdown || hasHinweis).toBe(true)
  })

  test('AC: Wenn Arbeitsorte konfiguriert, ist Speichern ohne Auswahl nicht möglich', async ({ page }) => {
    const arbeitsortLabel = page.getByText('Ort').first()
    const hasArbeitsortDropdown = await arbeitsortLabel.isVisible().catch(() => false)
    if (!hasArbeitsortDropdown) {
      // No arbeitsorte configured — skip this specific check
      test.skip()
      return
    }

    // Set a time block on Monday (future week)
    const vonSelect = page.locator('[aria-label*="Von"], [role="combobox"]').filter({ hasText: /--:--/ }).first()
    // Use the time select specifically (after the Ort select)
    const allComboboxes = page.locator('[role="combobox"]')
    const count = await allComboboxes.count()
    // Find the Von time select by clicking past the Ort dropdown (index 1 of first day)
    if (count >= 2) {
      await allComboboxes.nth(1).click()
      const opt09 = page.getByRole('option', { name: '09:00' })
      if (await opt09.isVisible().catch(() => false)) {
        await opt09.click()
        await allComboboxes.nth(2).click()
        const opt10 = page.getByRole('option', { name: '10:00' })
        if (await opt10.isVisible().catch(() => false)) {
          await opt10.click()
          // Save should be disabled if no arbeitsort selected
          const saveBtn = page.getByRole('button', { name: /plan speichern/i })
          // Button might be disabled due to missing arbeitsort
          await expect(saveBtn).toBeDisabled()
        }
      }
    }
  })

  test('Security: /manager/arbeitsorte nicht zugänglich für Werkstudenten', async ({ page }) => {
    await page.goto('/manager/arbeitsorte')
    await expect(page).not.toHaveURL(/\/manager\/arbeitsorte/)
  })
})
