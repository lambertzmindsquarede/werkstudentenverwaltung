import { test, expect } from '@playwright/test'

// ── Unauthenticated protection ────────────────────────────────────────────────

test('unauthenticated /dashboard/wochenplanung redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/wochenplanung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /dashboard/wochenplanung redirects on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard/wochenplanung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Stamp API returns 401 for unauthenticated requests (multi-block route)
test('POST /api/time-entries/stamp returns 401 for unauthenticated request', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

test('PATCH /api/time-entries/stamp returns 401 for unauthenticated request', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

// ── Wochenplanung UI — dev login required ─────────────────────────────────────

test.describe('Wochenplanung multi-block UI', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via dev login
    await page.goto('/login')
    const devButton = page.getByRole('button', { name: /dev.*login|dev.*anmelden/i })
    if (!(await devButton.isVisible())) {
      test.skip()
    }
    await devButton.click()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  // AC: Wochenplanung loads and shows the week plan form
  test('Wochenplanung page loads with day rows and save button', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')
    await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Plan speichern' })).toBeVisible()
  })

  // AC: "kein Arbeitstag" checkbox hides time inputs for that day
  test('checking "kein Arbeitstag" hides time inputs for that day', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')
    const firstCheckbox = page.getByRole('checkbox', { name: 'kein Arbeitstag' }).first()
    await firstCheckbox.check()
    // No time inputs should be visible for that row
    const firstRow = page.locator('div').filter({ hasText: 'Montag' }).first()
    await expect(firstRow.locator('input[type="time"]').first()).not.toBeVisible()
  })

  // AC: "+ Block hinzufügen" only enabled when previous block is complete
  test('"+ Block hinzufügen" is disabled when the first block is empty', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')
    const addButton = page.getByRole('button', { name: /\+ Block hinzufügen/ }).first()
    if (await addButton.isVisible()) {
      await expect(addButton).toBeDisabled()
    }
  })

  // AC: Up to 3 blocks can be added per day
  test('can add up to 3 blocks per day, third block hides add button', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')

    // Fill block 1 for Monday
    const timeInputs = page.locator('input[type="time"]')
    await timeInputs.nth(0).fill('09:00')
    await timeInputs.nth(1).fill('12:00')

    // "+" button should now be enabled
    const addButton = page.getByText('+ Block hinzufügen').first()
    await expect(addButton).toBeEnabled()
    await addButton.click()

    // Fill block 2
    await timeInputs.nth(2).fill('14:00')
    await timeInputs.nth(3).fill('16:00')

    // Add block 3
    await addButton.click()

    // Fill block 3
    await timeInputs.nth(4).fill('17:00')
    await timeInputs.nth(5).fill('18:00')

    // No "+" button visible for Monday (at max 3 blocks)
    await expect(page.getByText('+ Block hinzufügen').first()).not.toBeVisible()
  })

  // AC: Overlapping blocks show validation error and block save button
  test('overlapping blocks show validation error and disable save', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')

    const timeInputs = page.locator('input[type="time"]')
    await timeInputs.nth(0).fill('09:00')
    await timeInputs.nth(1).fill('13:00')

    const addButton = page.getByText('+ Block hinzufügen').first()
    await addButton.click()

    await timeInputs.nth(2).fill('11:00')
    await timeInputs.nth(3).fill('15:00')

    // Validation error should appear
    await expect(page.getByText(/Überschneidung/i)).toBeVisible()

    // Save button should be disabled
    await expect(page.getByRole('button', { name: 'Plan speichern' })).toBeDisabled()
  })

  // AC: Day total shown when >1 block
  test('day total shown when 2 blocks are filled', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')

    const timeInputs = page.locator('input[type="time"]')
    await timeInputs.nth(0).fill('09:00')
    await timeInputs.nth(1).fill('12:00')

    const addButton = page.getByText('+ Block hinzufügen').first()
    await addButton.click()

    await timeInputs.nth(2).fill('14:00')
    await timeInputs.nth(3).fill('16:00')

    // Day total: 3h + 2h = 5h
    await expect(page.getByText(/Gesamt:/)).toBeVisible()
  })

  // AC: Individual blocks can be removed via minus button
  test('individual block removed via minus button', async ({ page }) => {
    await page.goto('/dashboard/wochenplanung')

    const timeInputs = page.locator('input[type="time"]')
    await timeInputs.nth(0).fill('09:00')
    await timeInputs.nth(1).fill('12:00')

    await page.getByText('+ Block hinzufügen').first().click()

    // Minus button should be visible now (2 blocks)
    const removeButton = page.getByRole('button', { name: 'Block entfernen' }).first()
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    // Back to 1 block — minus button gone
    await expect(page.getByRole('button', { name: 'Block entfernen' })).toHaveCount(0)
  })
})

// ── Dashboard — Stempelkarte multi-block ──────────────────────────────────────

test.describe('Stempelkarte multi-block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const devButton = page.getByRole('button', { name: /dev.*login|dev.*anmelden/i })
    if (!(await devButton.isVisible())) {
      test.skip()
    }
    await devButton.click()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  // AC: Dashboard loads and shows stamp card
  test('dashboard stamp card is visible', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Zeiterfassung heute')).toBeVisible()
    // Stamp button present in one of its states
    const stampIn = page.getByRole('button', { name: 'Einstempeln' })
    const stampOut = page.getByRole('button', { name: 'Ausstempeln' })
    const oneVisible = (await stampIn.isVisible()) || (await stampOut.isVisible())
    expect(oneVisible).toBe(true)
  })
})
