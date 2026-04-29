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

// Security: POST /api/time-entries/stamp is protected — route returns 401 for unauthenticated API callers
// NOTE: PROJ-8 route.ts now returns 401 directly (previously middleware returned 307 — BUG-M1 now fixed)
test('POST /api/time-entries/stamp is protected — unauthenticated gets 401', async ({ request }) => {
  const response = await request.post('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
})

// Security: PATCH /api/time-entries/stamp is protected — route returns 401 for unauthenticated API callers
test('PATCH /api/time-entries/stamp is protected — unauthenticated gets 401', async ({ request }) => {
  const response = await request.patch('/api/time-entries/stamp', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
})
