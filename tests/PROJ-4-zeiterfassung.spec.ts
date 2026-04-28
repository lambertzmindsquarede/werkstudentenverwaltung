import { test, expect } from '@playwright/test'

// AC: /dashboard requires auth — unauthenticated users are redirected to /login
test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /dashboard auth protection works on mobile (375px)
test('unauthenticated /dashboard redirects on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /dashboard auth protection works on tablet (768px)
test('unauthenticated /dashboard redirects on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// Security: POST /api/time-entries/stamp is protected (middleware redirects unauthenticated to /login)
// NOTE: Returns 307 redirect (not 401) — see BUG-M1 in QA results
test('POST /api/time-entries/stamp is protected — unauthenticated gets redirect', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', { maxRedirects: 0 })
  // Middleware redirects to /login (307) rather than returning 401
  expect(response.status()).toBe(307)
})

// Security: PATCH /api/time-entries/stamp is protected (middleware redirects unauthenticated to /login)
test('PATCH /api/time-entries/stamp is protected — unauthenticated gets redirect', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
})
