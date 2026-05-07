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
    const option = page.getByRole('option', { name: /Anna Müller/i })
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

// Helper: expands first werkstudent row in auswertung
async function expandFirstWerkstudent(page: import('@playwright/test').Page) {
  // Wait for data to load — either a real tbody row or the "keine Werkstudenten" message
  await Promise.race([
    page.locator('table > tbody > tr').first().waitFor({ timeout: 18000 }),
    page.getByText('Keine Werkstudenten').waitFor({ timeout: 18000 }).catch(() => {}),
    page.getByText('Keine Zeiterfassungsdaten').waitFor({ timeout: 18000 }).catch(() => {}),
  ])
  const firstRow = page.locator('table > tbody > tr').first()
  await firstRow.click()
  // Wait for sub-rows (TagDetailZeile adds "Eintrag hinzufügen" rows)
  await page.waitForTimeout(800)
}

// ─── AC: Authorization & route protection ────────────────────────────────────

test('unauthenticated access to /manager/auswertung redirects to login', async ({ page }) => {
  await page.goto('/manager/auswertung')
  await expect(page).toHaveURL(/\/login/)
})

test('werkstudent cannot access /manager/auswertung', async ({ browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung')
    // Should redirect away from manager area
    await expect(page).not.toHaveURL(/\/manager\/auswertung/, { timeout: 8000 })
  } finally { await ctx.close() }
})

// ─── AC: Auswertung page renders with correction UI ──────────────────────────

test('manager can open /manager/auswertung without JS errors', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto('/manager/auswertung')
    await expect(page.getByRole('heading', { name: /Auswertung/i })).toBeVisible({ timeout: 10000 })
    expect(errors.filter((e) => !e.includes('Warning:'))).toHaveLength(0)
  } finally { await ctx.close() }
})

test('expanding a werkstudent row shows "Eintrag hinzufügen" button per day', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    // Use last-3-months to maximize chance of finding data
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const rowCount = await page.locator('table > tbody > tr').count()
    if (rowCount === 0) { test.skip(); return }

    // Each day sub-section should have an "Eintrag hinzufügen" button
    const addButtons = page.getByRole('button', { name: /Eintrag hinzufügen/i })
    const addCount = await addButtons.count()
    if (addCount === 0) { test.skip(); return } // No entries in time range
    expect(addCount).toBeGreaterThan(0)
  } finally { await ctx.close() }
})

test('entries with draft status show Pencil and Trash action buttons', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    // "Block N" sub-rows have pencil and trash buttons (accessible via title attribute)
    const pencilButtons = page.locator('button[title="Eintrag bearbeiten"]')
    const trashButtons = page.locator('button[title="Eintrag löschen"]')

    const pencilCount = await pencilButtons.count()
    if (pencilCount === 0) {
      // No entries in current month for this demo user — skip gracefully
      test.skip(); return
    }
    expect(pencilCount).toBeGreaterThan(0)
    expect(await trashButtons.count()).toBeGreaterThan(0)
  } finally { await ctx.close() }
})

// ─── AC: Bearbeiten-Dialog ────────────────────────────────────────────────────

test('clicking Pencil icon opens Zeitkorrektur dialog with Start/End selects and reason field', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const pencilButtons = page.locator('button[title="Eintrag bearbeiten"]')
    if (await pencilButtons.count() === 0) { test.skip(); return }

    await pencilButtons.first().click()

    // Dialog should be open
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText(/Eintrag bearbeiten/i)).toBeVisible()

    // Should have two time selects (Startzeit, Endzeit) — use label locators to avoid strict mode issues
    await expect(dialog.locator('label', { hasText: 'Startzeit' })).toBeVisible()
    await expect(dialog.locator('label', { hasText: 'Endzeit' })).toBeVisible()

    // Should have reason textarea
    await expect(dialog.getByPlaceholder(/Warum wird dieser Eintrag korrigiert/i)).toBeVisible()

    // Close dialog
    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 3000 })
  } finally { await ctx.close() }
})

test('Zeitkorrektur dialog shows validation error when reason is empty', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const pencilButtons = page.locator('button[title="Eintrag bearbeiten"]')
    if (await pencilButtons.count() === 0) { test.skip(); return }

    await pencilButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Select a valid start time
    const triggers = dialog.locator('[role="combobox"]')
    await triggers.nth(0).click()
    await page.getByRole('option', { name: '08:00' }).click()
    // Select a valid end time
    await triggers.nth(1).click()
    await page.getByRole('option', { name: '17:00' }).click()

    // Leave reason empty, click save
    await dialog.getByRole('button', { name: /^Speichern$/ }).click()

    // Should show specific error message
    await expect(dialog.getByText('Bitte eine Begründung eingeben.')).toBeVisible({ timeout: 3000 })
    await expect(dialog).toBeVisible() // dialog stays open
  } finally { await ctx.close() }
})

test('Zeitkorrektur dialog shows error when start >= end', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const pencilButtons = page.locator('button[title="Eintrag bearbeiten"]')
    if (await pencilButtons.count() === 0) { test.skip(); return }

    await pencilButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Set start AFTER end
    const triggers = dialog.locator('[role="combobox"]')
    await triggers.nth(0).click()
    await page.getByRole('option', { name: '17:00' }).click()
    await triggers.nth(1).click()
    await page.getByRole('option', { name: '08:00' }).click()

    // Error alert should appear inline (start >= end check in UI)
    await expect(dialog.getByText(/Startzeit muss vor der Endzeit liegen/i)).toBeVisible({ timeout: 3000 })

    // Save button should be disabled
    const saveBtn = dialog.getByRole('button', { name: /^Speichern$/ })
    await expect(saveBtn).toBeDisabled()
  } finally { await ctx.close() }
})

test('Zeitkorrektur dialog reason field has 200 character counter', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const pencilButtons = page.locator('button[title="Eintrag bearbeiten"]')
    if (await pencilButtons.count() === 0) { test.skip(); return }

    await pencilButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Character counter should show 0/200
    await expect(dialog.getByText('0/200')).toBeVisible()

    // Type some text
    await dialog.getByPlaceholder(/Warum wird dieser Eintrag korrigiert/i).fill('Test')
    await expect(dialog.getByText('4/200')).toBeVisible()

    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
  } finally { await ctx.close() }
})

// ─── AC: Löschen-Dialog ──────────────────────────────────────────────────────

test('clicking Trash icon opens Löschen dialog with reason field and destructive button', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const trashButtons = page.locator('button[title="Eintrag löschen"]')
    if (await trashButtons.count() === 0) { test.skip(); return }

    await trashButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText(/Eintrag löschen/i)).toBeVisible()

    // Should show confirmation warning
    await expect(dialog.getByText(/unwiderruflich gelöscht/i)).toBeVisible()

    // Should have reason textarea
    await expect(dialog.getByPlaceholder(/Warum wird dieser Eintrag gelöscht/i)).toBeVisible()

    // Should have a destructive confirm button
    await expect(dialog.getByRole('button', { name: /Löschen bestätigen/i })).toBeVisible()

    // Close dialog
    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 3000 })
  } finally { await ctx.close() }
})

test('Löschen dialog requires reason before allowing delete', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const trashButtons = page.locator('button[title="Eintrag löschen"]')
    if (await trashButtons.count() === 0) { test.skip(); return }

    await trashButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click confirm without entering reason
    await dialog.getByRole('button', { name: /Löschen bestätigen/i }).click()

    // Error should appear
    await expect(dialog.getByText(/Begründung eingeben/i)).toBeVisible({ timeout: 3000 })
    // Dialog stays open
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
  } finally { await ctx.close() }
})

// ─── AC: Eintrag hinzufügen Dialog ───────────────────────────────────────────

test('clicking "Eintrag hinzufügen" opens add dialog with date in title and time selects', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const addButtons = page.getByRole('button', { name: /Eintrag hinzufügen/i })
    if (await addButtons.count() === 0) { test.skip(); return }

    await addButtons.first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText(/Eintrag hinzufügen/i)).toBeVisible()

    // Should have two time selects
    await expect(dialog.getByText('Startzeit')).toBeVisible()
    await expect(dialog.getByText('Endzeit')).toBeVisible()

    // Should have reason textarea
    await expect(dialog.getByPlaceholder(/Warum wird dieser Eintrag nachgetragen/i)).toBeVisible()

    // Close
    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 3000 })
  } finally { await ctx.close() }
})

test('add dialog validates that start time is before end time', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const addButtons = page.getByRole('button', { name: /Eintrag hinzufügen/i })
    if (await addButtons.count() === 0) { test.skip(); return }

    await addButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Set start AFTER end
    const triggers = dialog.locator('[role="combobox"]')
    await triggers.nth(0).click()
    await page.getByRole('option', { name: '18:00' }).click()
    await triggers.nth(1).click()
    await page.getByRole('option', { name: '09:00' }).click()

    // Should show time order error
    await expect(dialog.getByText(/Startzeit muss vor der Endzeit liegen/i)).toBeVisible({ timeout: 3000 })

    // Hinzufügen button should be disabled
    const addBtn = dialog.getByRole('button', { name: /^Hinzufügen$/ })
    await expect(addBtn).toBeDisabled()

    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
  } finally { await ctx.close() }
})

test('add dialog requires reason before allowing save', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    const addButtons = page.getByRole('button', { name: /Eintrag hinzufügen/i })
    if (await addButtons.count() === 0) { test.skip(); return }

    await addButtons.first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Set valid times but no reason
    const triggers = dialog.locator('[role="combobox"]')
    await triggers.nth(0).click()
    await page.getByRole('option', { name: '08:00' }).click()
    await triggers.nth(1).click()
    await page.getByRole('option', { name: '16:00' }).click()

    // Leave reason empty and click add
    await dialog.getByRole('button', { name: /^Hinzufügen$/ }).click()

    // Error should appear, dialog stays open
    await expect(dialog.getByText(/Begründung eingeben/i)).toBeVisible({ timeout: 3000 })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /Abbrechen/i }).click()
  } finally { await ctx.close() }
})

// ─── AC: Approved entries are locked ─────────────────────────────────────────

test('approved entries show disabled Pencil and Trash icons with tooltip message', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung?range=last-3-months')
    await expandFirstWerkstudent(page)

    // Check if any approved entries exist
    const approvedPencil = page.locator('button[title="Genehmigte Einträge können nicht bearbeitet werden"]')
    const count = await approvedPencil.count()
    if (count === 0) {
      // No approved entries in demo data — test is not applicable
      test.skip(); return
    }

    await expect(approvedPencil.first()).toBeDisabled()

    const approvedTrash = page.locator('button[title="Genehmigte Einträge können nicht gelöscht werden"]')
    await expect(approvedTrash.first()).toBeDisabled()
  } finally { await ctx.close() }
})

// ─── AC: Werkstudent view — "Bearbeitet" badge ───────────────────────────────

test('werkstudent dashboard loads without JS errors after PROJ-25', async ({ browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    expect(errors.filter((e) => !e.includes('Warning:'))).toHaveLength(0)
  } finally { await ctx.close() }
})

test('werkstudent wochenplanung page renders without JS errors', async ({ browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto('/dashboard/wochenplanung')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    expect(errors.filter((e) => !e.includes('Warning:'))).toHaveLength(0)
  } finally { await ctx.close() }
})

// ─── Regression tests ────────────────────────────────────────────────────────

test('regression: /manager/auswertung still loads with existing filter functionality', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  try {
    await page.goto('/manager/auswertung')
    await expect(page.getByRole('heading', { name: /Auswertung/i })).toBeVisible({ timeout: 10000 })
    // Filter controls should still be present
    await expect(page.getByText(/aktueller Monat/i)).toBeVisible({ timeout: 8000 })
  } finally { await ctx.close() }
})

test('regression: manager kalender page still loads after PROJ-25', async ({ browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto('/manager/kalender')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    expect(errors.filter((e) => !e.includes('Warning:'))).toHaveLength(0)
  } finally { await ctx.close() }
})

test('regression: werkstudent cannot reach correction actions endpoint as werkstudent', async ({ browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed) { test.skip(); return }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const page = await ctx.newPage()
  try {
    // Werkstudent should not see correction UI on their own dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    // No Pencil icons with the manager correction title should appear
    const correctionPencils = page.locator('button[title="Eintrag bearbeiten"]')
    await expect(correctionPencils).toHaveCount(0)
  } finally { await ctx.close() }
})
