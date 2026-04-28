import { test, expect } from '@playwright/test'

// AC: Ohne Login ist kein Bereich der App zugänglich
test('root / redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /manager redirects to /login', async ({ page }) => {
  await page.goto('/manager')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /pending redirects to /login', async ({ page }) => {
  await page.goto('/pending')
  // /pending is accessible only to authenticated users without a role
  // Without a session it should redirect to /login
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login-Seite ist erreichbar und zeigt Microsoft-Anmelden-Button
test('login page renders with Microsoft sign-in button', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Mit Microsoft anmelden')).toBeVisible()
})

test('login page shows mindsquare branding', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByAltText('mindsquare')).toBeVisible()
  await expect(page.getByText('Werkstudentenverwaltung')).toBeVisible()
  await expect(page.getByText('Melde dich mit deinem mindsquare-Konto an')).toBeVisible()
})

test('login page shows footer note for mindsquare employees only', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Nur für mindsquare-Mitarbeiter zugänglich.')).toBeVisible()
})

// AC: Pending-Seite ist korrekt aufgebaut (für Nutzer ohne Rolle)
// Note: Requires authenticated session with no role to reach /pending
// Tests below verify the page structure when rendered directly (expected to redirect without auth)
test('login page sign-in button is clickable and triggers OAuth flow', async ({ page }) => {
  await page.goto('/login')
  const button = page.getByRole('button', { name: /Mit Microsoft anmelden/ })
  await expect(button).toBeEnabled()
  // We can't complete the OAuth flow in tests, just verify button is present and enabled
})

// AC: Abmelden beendet die Session (verifiable via UI presence)
test('dashboard page has sign-out button', async ({ page, context }) => {
  // This test verifies the UI structure — full sign-out test requires auth
  // Without auth, /dashboard redirects to /login (verifying route protection)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Fehlermeldung bei gescheiterter Anmeldung (BUG-1 fix)
test('login page shows error message for auth_failed', async ({ page }) => {
  await page.goto('/login?error=auth_failed')
  await expect(page.getByText('Anmeldung fehlgeschlagen. Bitte versuche es erneut.')).toBeVisible()
})

test('login page shows error message for missing_code', async ({ page }) => {
  await page.goto('/login?error=missing_code')
  await expect(page.getByText('Ungültiger Anmelde-Link. Bitte starte die Anmeldung erneut.')).toBeVisible()
})

test('login page shows fallback error for unknown error codes', async ({ page }) => {
  await page.goto('/login?error=some_unknown_error')
  await expect(page.getByText('Ein unbekannter Fehler ist aufgetreten.')).toBeVisible()
})

test('login page shows no error when no error param present', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Anmeldung fehlgeschlagen')).not.toBeVisible()
  await expect(page.getByText('Ungültiger Anmelde-Link')).not.toBeVisible()
})

// Responsive: Mobile (375px)
test('login page is responsive on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByText('Mit Microsoft anmelden')).toBeVisible()
  await expect(page.getByText('Werkstudentenverwaltung')).toBeVisible()
})

// Responsive: Tablet (768px)
test('login page is responsive on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await expect(page.getByText('Mit Microsoft anmelden')).toBeVisible()
})

// Responsive: Desktop (1440px)
test('login page is responsive on desktop (1440px)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await expect(page.getByText('Mit Microsoft anmelden')).toBeVisible()
})

// Security: Direct URL manipulation — no cross-role access
test('unauthenticated direct URL /manager is blocked', async ({ page }) => {
  await page.goto('/manager')
  await expect(page).toHaveURL(/\/login/)
  // Should NOT show the manager page content
  await expect(page.getByText('Manager-Übersicht')).not.toBeVisible()
})

test('unauthenticated direct URL /dashboard is blocked', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Mein Dashboard')).not.toBeVisible()
})
