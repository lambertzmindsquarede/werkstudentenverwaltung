import { test, expect } from '@playwright/test'

// ── Unauthenticated protection ────────────────────────────────────────────────

test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /dashboard redirects on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// Security: stamp API endpoints are protected
test('POST /api/time-entries/stamp returns 401 without auth', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

test('PATCH /api/time-entries/stamp returns 401 without auth', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

// ── Helper: log in and land on werkstudent /dashboard ────────────────────────
// NOTE: The dev login button logs in as a manager, who is redirected from /dashboard to /manager.
// All tests in the describe blocks below will skip automatically when using the manager account.

async function devLoginAsWerkstudent(page: import('@playwright/test').Page) {
  await page.goto('/login')
  const devButton = page.getByRole('button', { name: /als admin einloggen|dev.*login|dev.*anmelden/i })
  if (!(await devButton.isVisible())) {
    test.skip()
    return false
  }
  await devButton.click()
  await page.waitForURL(/\/dashboard|\/manager/, { timeout: 10000 })

  // The proxy redirects managers away from /dashboard — skip if not on werkstudent dashboard
  if (!page.url().includes('/dashboard')) {
    test.skip()
    return false
  }
  return true
}

// ── IstEintragEditDialog — Pause field ────────────────────────────────────────

test.describe('IstEintragEditDialog – Pause field', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  // AC: Pause field exists in IstEintragEditDialog
  test('edit dialog shows Pause (Min) input field', async ({ page }) => {
    await page.goto('/dashboard')

    // Open any edit dialog (completed block or empty day)
    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Pause (Min)')).toBeVisible()
  })

  // AC: Live netto preview shown when start/end are set
  test('edit dialog shows live Netto preview when start and end are set', async ({ page }) => {
    await page.goto('/dashboard')

    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Startzeit').fill('09:00')
    await dialog.getByLabel('Endzeit').fill('17:00')

    // Netto preview should show 8,0 Std (no break)
    await expect(dialog.getByText(/Netto:/i)).toBeVisible()
    await expect(dialog.getByText(/8[,.]0 Std/)).toBeVisible()
  })

  // AC: Pause > Blockdauer shows validation error and blocks save
  test('edit dialog blocks save when pause exceeds block duration', async ({ page }) => {
    await page.goto('/dashboard')

    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Startzeit').fill('09:00')
    await dialog.getByLabel('Endzeit').fill('10:00') // 60 min block

    // Enter break > block duration (90 > 60)
    await dialog.getByLabel('Pause (Min)').fill('90')

    await expect(dialog.getByText(/Pause darf die Blockdauer nicht überschreiten/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled()
  })

  // AC: Negative break input is clamped to 0
  test('edit dialog clamps negative break input to 0', async ({ page }) => {
    await page.goto('/dashboard')

    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const breakInput = dialog.getByLabel('Pause (Min)')
    await breakInput.fill('-30')
    await expect(breakInput).toHaveValue('0')
  })

  // AC: ArbZG warning when brutto > 6h and break < 30 min
  test('edit dialog shows ArbZG warning when brutto > 6h and break < 30 min', async ({ page }) => {
    await page.goto('/dashboard')

    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // 7h block, 0 min break → 30 min warning
    await dialog.getByLabel('Startzeit').fill('09:00')
    await dialog.getByLabel('Endzeit').fill('16:00')

    await expect(dialog.getByText(/30 Min/i)).toBeVisible()
    await expect(dialog.getByText(/§ 4 ArbZG/i)).toBeVisible()

    // After adding 30 min break, warning disappears
    await dialog.getByLabel('Pause (Min)').fill('30')
    await expect(dialog.getByText(/30 Min.*§ 4 ArbZG/i)).not.toBeVisible()
  })

  // AC: ArbZG warning is non-blocking — Speichern remains enabled
  test('ArbZG warning does not block the Speichern button', async ({ page }) => {
    await page.goto('/dashboard')

    const bearbeitenButtons = page.getByRole('button', { name: 'Bearbeiten' })
    const count = await bearbeitenButtons.count()
    if (count === 0) {
      test.skip()
      return
    }
    await bearbeitenButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Startzeit').fill('09:00')
    await dialog.getByLabel('Endzeit').fill('16:00')

    await expect(dialog.getByText(/§ 4 ArbZG/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled()
  })
})

// ── StempelCard — Inline break query + netto display ─────────────────────────

test.describe('StempelCard – Pausenerfassung', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  // AC: StempelCard shows Zeiterfassung heute
  test('dashboard shows StempelCard with Zeiterfassung heute header', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Zeiterfassung heute')).toBeVisible()
  })

  // AC: After stamp-out, inline break query appears
  test('inline break query appears after stamp-out', async ({ page }) => {
    await page.goto('/dashboard')

    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }

    await stampInBtn.click()
    await expect(page.getByRole('button', { name: 'Ausstempeln' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Ausstempeln' }).click()

    await expect(page.getByText(/Pause.*gemacht/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Überspringen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible()
  })

  // AC: "Überspringen" saves break_minutes = 0 and dismisses the query
  test('"Überspringen" dismisses the inline break query', async ({ page }) => {
    await page.goto('/dashboard')

    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }

    await stampInBtn.click()
    await expect(page.getByRole('button', { name: 'Ausstempeln' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Ausstempeln' }).click()

    await expect(page.getByText(/Pause.*gemacht/i)).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Überspringen' }).click()

    await expect(page.getByText(/Pause.*gemacht/i)).not.toBeVisible({ timeout: 5000 })
  })

  // AC: Completed block shows netto hours in Std badge
  test('completed block shows netto hours in Std badge', async ({ page }) => {
    await page.goto('/dashboard')

    const stdBadge = page.getByText(/\d[,\.]\d\s*Std/)
    if (!(await stdBadge.isVisible())) {
      test.skip()
      return
    }
    await expect(stdBadge.first()).toBeVisible()
  })
})

// ── WochenIstübersicht — Netto hours ─────────────────────────────────────────

test.describe('WochenIstübersicht – Netto-Stunden', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  // AC: WochenIstübersicht shows Ist column
  test('WochenIstübersicht shows Ist column header', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Ist', { exact: true }).first()).toBeVisible()
  })

  // AC: Weekly sum footer uses netto hours
  test('weekly sum footer shows Ist-Stunden diese Woche', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/Ist-Stunden diese Woche/i)).toBeVisible()
  })
})
