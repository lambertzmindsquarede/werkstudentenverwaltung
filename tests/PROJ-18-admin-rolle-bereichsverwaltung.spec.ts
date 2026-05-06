import { test, expect } from '@playwright/test'

// ─── Route Protection ───────────────────────────────────────────────────────

test('unauthenticated access to /admin redirects to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /admin/bereiche redirects to /login', async ({ page }) => {
  await page.goto('/admin/bereiche')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated access to /admin/bereiche/some-id redirects to /login', async ({ page }) => {
  await page.goto('/admin/bereiche/00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Cross-Role Guard ────────────────────────────────────────────────────────

test('werkstudent cannot access /admin (redirected to /dashboard)', async ({ page }) => {
  // Log in as Anna Müller (Werkstudentin, id=...0002)
  await page.goto('/login')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Anna Müller (Werkstudentin)' }).click()
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Now try to navigate to /admin
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/dashboard/)
})

test('manager (is_admin=false) cannot access /admin (redirected to /manager)', async ({
  page,
}) => {
  // Log in as Dev Admin (role=manager, is_admin=false by default)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page).toHaveURL(/\/manager/, { timeout: 15000 })

  // Attempt to navigate to /admin — middleware redirects to /manager
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/manager/)
})

// ─── Login Page – Responsive ─────────────────────────────────────────────────

test('/login is accessible and shows sign-in button (baseline for admin auth flow)', async ({
  page,
}) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /Microsoft/i })).toBeVisible()
})

// ─── /admin route: no unauthenticated content leakage ────────────────────────

test('admin page title is not visible without authentication', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByText('Admin-Übersicht')).not.toBeVisible()
})

test('/admin/bereiche table is not visible without authentication', async ({ page }) => {
  await page.goto('/admin/bereiche')
  await expect(page.getByRole('table')).not.toBeVisible()
})

// ─── Responsive: login page (gateway to admin) ───────────────────────────────

test('/admin redirect works on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('/admin redirect works on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
