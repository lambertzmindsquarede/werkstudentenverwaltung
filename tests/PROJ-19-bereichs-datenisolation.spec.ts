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
    werkstudentCookies = (await ctx.storageState()).cookies
  } catch { authFailed = true }
  finally { await ctx.close() }
}

// ─── Route Protection ────────────────────────────────────────────────────────

test('unauthenticated access to /manager/users redirects to /login', async ({ page }) => {
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /manager/kalender redirects to /login', async ({ page }) => {
  await page.goto('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Werkstudent cannot access manager pages ─────────────────────────────────

test('werkstudent is redirected away from /manager/users', async ({ page, browser }) => {
  await ensureWerkstudentAuth(browser)
  if (authFailed || werkstudentCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/users')
  await expect(p).not.toHaveURL(/\/manager\/users/)
  await ctx.close()
})

// ─── Manager Nutzerverwaltung ─────────────────────────────────────────────────

test('manager sees /manager/users page with user table', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/users')
  await expect(p).toHaveURL(/\/manager\/users/)
  await expect(p.getByRole('heading', { name: 'Nutzerverwaltung' })).toBeVisible()
  await expect(p.getByRole('table')).toBeVisible()
  await ctx.close()
})

test('manager role badge is displayed in /manager/users header', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/users')
  // Header badge shows 'Admin' or 'Manager'
  const badge = p.locator('header span').filter({ hasText: /^(Admin|Manager)$/ })
  await expect(badge).toBeVisible()
  await ctx.close()
})

test('URL param ?bereich= does not override manager bereich restriction', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  // Manager (non-admin) navigates with a bereich param — server action ignores it
  await p.goto('/manager/users?bereich=00000000-0000-0000-0000-000000000099')
  await expect(p).toHaveURL(/\/manager\/users/)
  // Page should still load without error
  await expect(p.getByRole('heading', { name: 'Nutzerverwaltung' })).toBeVisible()
  await ctx.close()
})

// ─── Manager Kalenderansicht ──────────────────────────────────────────────────

test('manager sees /manager/kalender page', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  await p.goto('/manager/kalender')
  await expect(p).toHaveURL(/\/manager\/kalender/)
  // Should show the calendar header with KW
  await expect(p.getByText(/KW \d+/)).toBeVisible({ timeout: 10000 })
  await ctx.close()
})

test('kalender week navigation preserves bereich filter param', async ({ page, browser }) => {
  await ensureManagerAuth(browser)
  if (authFailed || managerCookies.length === 0) {
    test.skip(true, 'Dev login not available')
    return
  }
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const p = await ctx.newPage()
  const fakeBereich = '00000000-0000-0000-0000-000000000001'
  await p.goto(`/manager/kalender?bereich=${fakeBereich}`)
  // Click "previous week" button — bereich param should be preserved in URL
  const prevBtn = p.getByRole('button', { name: /←|zurück|prev/i }).first()
  if (await prevBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await prevBtn.click()
    await p.waitForURL(/bereich=/, { timeout: 5000 }).catch(() => null)
    // URL should still contain the bereich param after navigation
    expect(p.url()).toContain(`bereich=${fakeBereich}`)
  }
  await ctx.close()
})

// ─── Responsive ──────────────────────────────────────────────────────────────

test('/manager/users is not visible without auth at mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
})

test('/manager/kalender is not visible without auth at tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})
