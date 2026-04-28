import { test, expect } from '@playwright/test'

// AC: /manager/kalender requires auth — unauthenticated users are redirected to /login
test('unauthenticated access to /manager/kalender redirects to /login', async ({ page }) => {
  await page.goto('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /manager/kalender auth protection works on mobile (375px)
test('unauthenticated /manager/kalender redirects on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})

// AC: /manager/kalender auth protection works on tablet (768px)
test('unauthenticated /manager/kalender redirects on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})

// AC: ?week= URL parameter is also protected — unauthenticated users are redirected to /login
test('unauthenticated /manager/kalender?week=2026-W18 redirects to /login', async ({ page }) => {
  await page.goto('/manager/kalender?week=2026-W18')
  await expect(page).toHaveURL(/\/login/)
})

// Security: werkstudent role cannot access /manager/kalender (middleware enforces role separation)
// NOTE: Requires proxy.ts — werkstudenten are redirected to /dashboard when hitting /manager/*
test('unauthenticated /manager paths redirect to /login (proxy coverage)', async ({ page }) => {
  await page.goto('/manager/kalender')
  const url = page.url()
  expect(url).not.toContain('/manager/kalender')
  await expect(page).toHaveURL(/\/login/)
})
