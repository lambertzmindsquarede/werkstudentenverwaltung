import { test, expect } from '@playwright/test'

// AC 1: Dev login section visible when NEXT_PUBLIC_DEV_LOGIN_ENABLED=true (set in .env.local)
test('Dev login section is visible on login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
})

// AC 2: Dev login section distinguishable from Azure-AD button (amber badge + "Dev only" label)
test('Dev login section has "Dev only" badge and warning label', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Dev only')).toBeVisible()
  await expect(page.getByText('Nur lokal sichtbar')).toBeVisible()
})

// AC 2 (coexistence): Both Azure-AD and Dev Login visible simultaneously in dev mode
test('Microsoft and Dev Login section coexist on login page', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Mit Microsoft anmelden')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
})

// AC 3: Button triggers POST request to /api/auth/dev-login
test('Dev Login button triggers POST to /api/auth/dev-login', async ({ page }) => {
  const requestPromise = page.waitForRequest(
    req => req.url().includes('/api/auth/dev-login') && req.method() === 'POST'
  )
  await page.route('**/api/auth/dev-login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ redirectTo: '/manager' }),
    })
  )
  await page.goto('/login')
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  const request = await requestPromise
  expect(request.method()).toBe('POST')
})

// Loading state: button shows spinner while request is in flight
test('Dev Login button shows loading state while logging in', async ({ page }) => {
  await page.route('**/api/auth/dev-login', async route => {
    await new Promise(resolve => setTimeout(resolve, 600))
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ redirectTo: '/manager' }),
    })
  })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page.getByText('Einloggen…')).toBeVisible()
})

// AC 4: API endpoint guard — in dev mode the endpoint processes requests (not 403)
// Direct API calls reach the route handler and return JSON (proxy no longer intercepts).
test('API /api/auth/dev-login responds with JSON in dev mode', async ({ request }) => {
  const response = await request.post('/api/auth/dev-login')
  const contentType = response.headers()['content-type'] ?? ''
  expect(contentType).toContain('application/json')
})

// AC 9: Missing seed user — API returns 404, frontend shows toast (mocked)
test('Dev Login shows error toast when seed user is missing (404 response)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
  await page.route('**/api/auth/dev-login', route => {
    if (route.request().method() !== 'POST') return route.continue()
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Dev-Admin-User nicht gefunden' }),
    })
  })
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(
    page.getByText('User nicht gefunden — bitte Seed-Script ausführen (docs/dev-seed.sql)')
  ).toBeVisible()
})

// AC 9: Non-200 non-404 response — generic error toast
test('Dev Login shows generic error toast on server error (500 response)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
  await page.route('**/api/auth/dev-login', route => {
    if (route.request().method() !== 'POST') return route.continue()
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Session-Erzeugung fehlgeschlagen' }),
    })
  })
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page.getByText('Session-Erzeugung fehlgeschlagen')).toBeVisible()
})

// AC 6: Redirect to /manager on success (manager role)
test('Dev Login redirects to /manager on successful manager login', async ({ page }) => {
  await page.route('**/api/auth/dev-login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tokenHash: 'fake-token', redirectTo: '/manager' }),
    })
  )
  // Mock supabase verifyOtp so it succeeds without a real token
  await page.route('**/auth/v1/verify**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', user: {} }),
    })
  )
  await page.route('/manager', route => route.fulfill({ status: 200, body: '<html>manager</html>' }))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page).toHaveURL(/\/manager/)
})

// Responsive: Dev Login section visible on mobile (375px)
test('Dev Login section visible on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
  await expect(page.getByText('Dev only')).toBeVisible()
})

// Responsive: Dev Login section visible on tablet (768px)
test('Dev Login section visible on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
})
