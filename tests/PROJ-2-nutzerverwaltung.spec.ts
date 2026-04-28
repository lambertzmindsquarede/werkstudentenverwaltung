import { test, expect } from '@playwright/test'

// AC: /manager/users ist nur für authentifizierte Manager zugänglich
test('unauthenticated access to /manager/users redirects to /login', async ({ page }) => {
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /deactivated ist eine eigenständige Seite (für deaktivierte Nutzer)
test('/deactivated redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/deactivated')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /pending redirects unauthenticated users to /login
test('/pending redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/pending')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /dashboard/profile redirects unauthenticated users to /login
test('unauthenticated access to /dashboard/profile redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/profile')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Route-Schutz — direkter Zugriff auf Manager-Bereich ohne Auth
test('unauthenticated direct URL /manager/users is blocked and shows login', async ({ page }) => {
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Nutzerverwaltung')).not.toBeVisible()
})

// Responsive: /login ist auf Mobile erreichbar (Baseline nach Redirect)
test('manager/users redirect works on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/manager/users')
  await expect(page).toHaveURL(/\/login/)
})
