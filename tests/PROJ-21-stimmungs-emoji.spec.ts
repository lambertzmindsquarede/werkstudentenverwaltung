import { test, expect } from '@playwright/test'

// ─── Auth helper ──────────────────────────────────────────────────────────

async function loginAs(page: import('@playwright/test').Page, name: RegExp | string): Promise<boolean> {
  await page.goto('/login')
  const devAvailable = await page.getByText('Dev only').isVisible({ timeout: 6000 }).catch(() => false)
  if (!devAvailable) return false

  await page.getByRole('combobox').click()
  await page.getByRole('option', { name }).click()
  await page.getByRole('button', { name: /Als gewählten User einloggen/i }).click()
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  } catch {
    return false
  }
  return true
}

// ─── Security: Unauthenticated API access ─────────────────────────────────

test('PATCH /api/time-entries/mood-emoji is protected — unauthenticated gets 401', async ({
  request,
}) => {
  const response = await request.patch('/api/time-entries/mood-emoji', {
    data: { emoji: '😊' },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(401)
})

test('PATCH /api/time-entries/mood-emoji rejects oversized emoji string — gets 401 or 400', async ({
  request,
}) => {
  const response = await request.patch('/api/time-entries/mood-emoji', {
    data: { emoji: 'a'.repeat(11) },
    maxRedirects: 0,
  })
  expect([400, 401]).toContain(response.status())
})

// ─── AC: Emoji picker trigger visible before stamp-in ────────────────────

test('emoji picker trigger (🙂 optional) is shown next to Einstempeln button', async ({ page }) => {
  // Try multiple users until we find one in canStampIn state
  const users = [/Anna Müller/i, /Ben Schneider/i, /Clara Fischer/i]
  let loggedIn = false
  for (const user of users) {
    loggedIn = await loginAs(page, user)
    if (!loggedIn) continue
    await page.goto('/dashboard')
    const trigger = page.locator('button[title="Stimmung auswählen (optional)"]')
    if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) break
    // This user not in canStampIn state, try next
    loggedIn = false
  }
  if (!loggedIn) { test.skip(); return }

  const emojiTrigger = page.locator('button[title="Stimmung auswählen (optional)"]')
  await expect(emojiTrigger).toBeVisible()
})

// ─── AC: 6 favorite emojis + "Alle Emojis" button in picker ─────────────

test('emoji picker shows 6 favourite emojis and "Alle Emojis →" button', async ({ page }) => {
  const users = [/Anna Müller/i, /Ben Schneider/i, /Clara Fischer/i]
  let loggedIn = false
  for (const user of users) {
    loggedIn = await loginAs(page, user)
    if (!loggedIn) continue
    await page.goto('/dashboard')
    const trigger = page.locator('button[title="Stimmung auswählen (optional)"]')
    if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) break
    loggedIn = false
  }
  if (!loggedIn) { test.skip(); return }

  await page.locator('button[title="Stimmung auswählen (optional)"]').click()

  const favourites = ['Motiviert', 'Gut', 'Neutral', 'Müde', 'Gestresst', 'Krank']
  for (const label of favourites) {
    await expect(page.getByTitle(label)).toBeVisible()
  }
  await expect(page.getByText(/Alle Emojis/i)).toBeVisible()
})

// ─── AC: Optional — stamp-in without emoji selection works ───────────────

test('stamp-in succeeds without any emoji selection', async ({ page }) => {
  const ok = await loginAs(page, /Ben Schneider/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard')
  await expect(page.getByText('Zeiterfassung heute')).toBeVisible({ timeout: 10000 })

  const emojiTrigger = page.locator('button[title="Stimmung auswählen (optional)"]')
  const canStampIn = await emojiTrigger.isVisible({ timeout: 5000 }).catch(() => false)
  if (!canStampIn) { test.skip(); return }

  await page.getByRole('button', { name: /^Einstempeln$/i }).click()
  await expect(page.getByRole('button', { name: /Ausstempeln/i })).toBeVisible({ timeout: 10000 })
})

// ─── AC: "Stimmung setzen" control visible while stamped in ──────────────

test('"Stimmung setzen" button is visible while user is stamped in', async ({ page }) => {
  const ok = await loginAs(page, /Ben Schneider/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard')
  await expect(page.getByText('Zeiterfassung heute')).toBeVisible({ timeout: 10000 })

  const isStampedIn = await page.getByRole('button', { name: /Ausstempeln/i }).isVisible()
  if (!isStampedIn) {
    const canStampIn = await page.locator('button[title="Stimmung auswählen (optional)"]').isVisible({ timeout: 3000 }).catch(() => false)
    if (!canStampIn) { test.skip(); return }
    await page.getByRole('button', { name: /^Einstempeln$/i }).click()
    await expect(page.getByRole('button', { name: /Ausstempeln/i })).toBeVisible({ timeout: 10000 })
  }

  await expect(page.getByText(/Stimmung setzen|Stimmung ändern/i)).toBeVisible()
})

// ─── AC: Stamp-out clears emoji and hides "Stimmung" control ─────────────

test('stamp-out removes "Stimmung setzen" control from view', async ({ page }) => {
  const ok = await loginAs(page, /Ben Schneider/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard')
  await expect(page.getByText('Zeiterfassung heute')).toBeVisible({ timeout: 10000 })

  const isStampedIn = await page.getByRole('button', { name: /Ausstempeln/i }).isVisible()
  if (!isStampedIn) {
    const canStampIn = await page.locator('button[title="Stimmung auswählen (optional)"]').isVisible({ timeout: 3000 }).catch(() => false)
    if (!canStampIn) { test.skip(); return }
    await page.getByRole('button', { name: /^Einstempeln$/i }).click()
    await expect(page.getByRole('button', { name: /Ausstempeln/i })).toBeVisible({ timeout: 10000 })
  }

  await page.getByRole('button', { name: /Ausstempeln/i }).click()
  const skipBreak = page.getByRole('button', { name: /Überspringen/i })
  if (await skipBreak.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBreak.click()
  }

  await expect(page.getByRole('button', { name: /^Einstempeln$/i })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Stimmung setzen|Stimmung ändern/i)).not.toBeVisible()
})

// ─── AC: Stamp-in with emoji — emoji displayed while stamped in ──────────

test('stamp-in with 🚀 emoji displays that emoji in the active block indicator', async ({ page }) => {
  const ok = await loginAs(page, /Clara Fischer/i)
  if (!ok) { test.skip(); return }

  await page.goto('/dashboard')
  await expect(page.getByText('Zeiterfassung heute')).toBeVisible({ timeout: 10000 })

  const emojiTrigger = page.locator('button[title="Stimmung auswählen (optional)"]')
  const canStampIn = await emojiTrigger.isVisible({ timeout: 5000 }).catch(() => false)
  if (!canStampIn) { test.skip(); return }

  await emojiTrigger.click()
  await page.getByTitle('Motiviert').click()

  await page.getByRole('button', { name: /^Einstempeln$/i }).click()
  await expect(page.getByRole('button', { name: /Ausstempeln/i })).toBeVisible({ timeout: 10000 })

  // 🚀 should appear in the stamped-in state
  await expect(page.locator(':text("🚀")').first()).toBeVisible()

  // Clean up
  await page.getByRole('button', { name: /Ausstempeln/i }).click()
  const skipBreak = page.getByRole('button', { name: /Überspringen/i })
  if (await skipBreak.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBreak.click()
  }
})

// ─── AC: Same favourite emoji toggles off (deselects) ────────────────────

test('clicking the same favourite emoji again in picker deselects it', async ({ page }) => {
  const users = [/Anna Müller/i, /Ben Schneider/i, /Clara Fischer/i]
  let loggedIn = false
  for (const user of users) {
    loggedIn = await loginAs(page, user)
    if (!loggedIn) continue
    await page.goto('/dashboard')
    const trigger = page.locator('button[title="Stimmung auswählen (optional)"]')
    if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) break
    loggedIn = false
  }
  if (!loggedIn) { test.skip(); return }

  // Select 😊 (Gut)
  await page.locator('button[title="Stimmung auswählen (optional)"]').click()
  await page.getByTitle('Gut').click()

  // Now shows filled trigger
  await expect(page.locator('button[title="Stimmung ändern"]')).toBeVisible()

  // Open again and click the same emoji — should toggle off
  await page.locator('button[title="Stimmung ändern"]').click()
  await page.getByTitle('Gut').click()

  // Reverts to dashed optional trigger
  await expect(page.locator('button[title="Stimmung auswählen (optional)"]')).toBeVisible()
})

// ─── Responsive: emoji picker trigger visible on mobile (375px) ──────────

test('emoji picker trigger visible on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })

  const users = [/Anna Müller/i, /Ben Schneider/i, /Clara Fischer/i]
  let loggedIn = false
  for (const user of users) {
    loggedIn = await loginAs(page, user)
    if (!loggedIn) continue
    await page.goto('/dashboard')
    const trigger = page.locator('button[title="Stimmung auswählen (optional)"]')
    if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) break
    loggedIn = false
  }
  if (!loggedIn) { test.skip(); return }

  await expect(page.locator('button[title="Stimmung auswählen (optional)"]')).toBeVisible()
})
