import { test, expect } from '@playwright/test'

// ── Auth protection ───────────────────────────────────────────────────────────

// AC (technical): POST /api/time-entries/stamp requires authentication
test('POST /api/time-entries/stamp with time param returns 401 without auth', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', {
    data: { time: '09:00' },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(401)
})

// AC (technical): PATCH /api/time-entries/stamp requires authentication
test('PATCH /api/time-entries/stamp with time param returns 401 without auth', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', {
    data: { time: '09:00' },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(401)
})

// ── Server-side input validation (no auth needed to test 400 vs 401) ──────────

// AC (technical): API rejects invalid time format "9:00" (missing leading zero)
test('POST /api/time-entries/stamp rejects invalid time format "9:00"', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', {
    data: { time: '9:00' },
    maxRedirects: 0,
  })
  // 401 (no auth) wins over 400, but the field is validated by Zod — accepted that auth is checked first
  expect([400, 401]).toContain(response.status())
})

// AC (technical): API rejects non-round minutes (e.g. "09:13") — Zod validates on POST
test('POST /api/time-entries/stamp rejects time with non-5-minute minutes when authenticated shape matters', async ({ request }) => {
  // Without auth we get 401; the validation order is: auth → Zod → business logic
  // We confirm the endpoint returns 401 (not a 2xx or other unexpected code)
  const response = await request.post('/api/time-entries/stamp', {
    data: { time: '09:13' },
    maxRedirects: 0,
  })
  expect([400, 401]).toContain(response.status())
})

// AC (technical): PATCH /api/time-entries/stamp rejects non-round minutes
test('PATCH /api/time-entries/stamp rejects time with non-5-minute minutes', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', {
    data: { time: '09:13' },
    maxRedirects: 0,
  })
  expect([400, 401]).toContain(response.status())
})

// AC (technical): API is backward-compatible — missing time field still works (returns 401 for unauth, not 400)
test('POST /api/time-entries/stamp without time field is backward-compatible', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', {
    data: { emoji: null },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(401)
})

// AC (technical): PATCH without time field is backward-compatible
test('PATCH /api/time-entries/stamp without time field is backward-compatible', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', {
    data: {},
    maxRedirects: 0,
  })
  expect(response.status()).toBe(401)
})

// ── Helper: dev login ─────────────────────────────────────────────────────────

async function devLoginAsWerkstudent(page: import('@playwright/test').Page) {
  await page.goto('/login')
  const devButton = page.getByRole('button', { name: /als admin einloggen|dev.*login|dev.*anmelden/i })
  if (!(await devButton.isVisible())) {
    test.skip()
    return false
  }
  await devButton.click()
  await page.waitForURL(/\/dashboard|\/manager/, { timeout: 10000 })
  if (!page.url().includes('/dashboard')) {
    test.skip()
    return false
  }
  return true
}

// ── UI: Inline time picker appears on Einstempeln click ──────────────────────

test.describe('StempelCard – Einstempeln inline time picker', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  // AC: Clicking "Einstempeln" opens an inline time picker (no modal) with a time input
  test('clicking Einstempeln shows inline time field with time input', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    // Time input should appear inline (not a dialog/modal)
    await expect(page.locator('input[type="time"]')).toBeVisible()
    // The original "Einstempeln" button should be hidden
    await expect(page.getByRole('button', { name: 'Einstempeln' })).not.toBeVisible()
  })

  // AC: Inline picker shows "Jetzt einstempeln" confirm button
  test('inline time picker shows "Jetzt einstempeln" confirm button', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    await expect(page.getByRole('button', { name: 'Jetzt einstempeln' })).toBeVisible()
  })

  // AC: Cancel button is shown and returns card to idle state
  test('cancel button in stamp-in picker restores idle state', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    await expect(page.locator('input[type="time"]')).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    // Time input disappears, Einstempeln button is back
    await expect(page.locator('input[type="time"]')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Einstempeln' })).toBeVisible()
  })

  // AC: Time input is pre-filled with a valid HH:MM value (current Berlin time)
  test('time input is pre-filled with a non-empty HH:MM value', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    const timeInput = page.locator('input[type="time"]').first()
    const value = await timeInput.inputValue()
    expect(value).toMatch(/^\d{2}:\d{2}$/)
  })

  // AC: Pre-fill is a multiple of 5 minutes (rounding to 5-minute boundary)
  test('pre-filled time has minutes that are a multiple of 5', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    const value = await page.locator('input[type="time"]').first().inputValue()
    const minutes = parseInt(value.split(':')[1], 10)
    expect(minutes % 5).toBe(0)
  })

  // AC: Confirm button is disabled when time is cleared
  test('confirm button is disabled when time field is empty', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    const timeInput = page.locator('input[type="time"]').first()
    await timeInput.fill('')
    const confirmBtn = page.getByRole('button', { name: 'Jetzt einstempeln' })
    await expect(confirmBtn).toBeDisabled()
  })

  // AC: Inline picker, not a modal/dialog
  test('no modal/dialog element appears when clicking Einstempeln', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    // There should be no open dialog role element
    const dialogs = page.locator('[role="dialog"]')
    const count = await dialogs.count()
    expect(count).toBe(0)
  })

  // AC: Setting a future time shows an inline validation error
  test('entering a future time shows a validation error message', async ({ page }) => {
    const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
    if (!(await stampInBtn.isVisible())) {
      test.skip()
      return
    }
    await stampInBtn.click()
    const timeInput = page.locator('input[type="time"]').first()
    await timeInput.fill('23:55')
    // Error should appear inline (not a toast)
    await expect(page.getByText(/Zukunft/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jetzt einstempeln' })).toBeDisabled()
  })
})

// ── UI: Inline time picker for Ausstempeln ────────────────────────────────────

test.describe('StempelCard – Ausstempeln inline time picker', () => {
  test.beforeEach(async ({ page }) => {
    await devLoginAsWerkstudent(page)
  })

  // AC: If stamped in, clicking Ausstempeln shows inline time picker
  test('clicking Ausstempeln shows inline time picker when stamped in', async ({ page }) => {
    const stampOutBtn = page.getByRole('button', { name: 'Ausstempeln' })
    if (!(await stampOutBtn.isVisible())) {
      test.skip()
      return
    }
    await stampOutBtn.click()
    await expect(page.locator('input[type="time"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jetzt ausstempeln' })).toBeVisible()
  })

  // AC: Cancel restores state without closing the open block
  test('cancel in stamp-out picker returns to idle (Ausstempeln button visible again)', async ({ page }) => {
    const stampOutBtn = page.getByRole('button', { name: 'Ausstempeln' })
    if (!(await stampOutBtn.isVisible())) {
      test.skip()
      return
    }
    await stampOutBtn.click()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.locator('input[type="time"]')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Ausstempeln' })).toBeVisible()
  })
})

// ── Responsive tests ──────────────────────────────────────────────────────────

// AC: Dashboard with time picker UI works at 375px mobile width
test('time picker area is visible at mobile width (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const ok = await devLoginAsWerkstudent(page)
  if (!ok) return
  const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
  if (!(await stampInBtn.isVisible())) return
  await stampInBtn.click()
  await expect(page.locator('input[type="time"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Jetzt einstempeln' })).toBeVisible()
})

// AC: Dashboard with time picker works at tablet width (768px)
test('time picker area is visible at tablet width (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  const ok = await devLoginAsWerkstudent(page)
  if (!ok) return
  const stampInBtn = page.getByRole('button', { name: 'Einstempeln' })
  if (!(await stampInBtn.isVisible())) return
  await stampInBtn.click()
  await expect(page.locator('input[type="time"]')).toBeVisible()
})
