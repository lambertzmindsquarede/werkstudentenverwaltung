import { test, expect } from '@playwright/test'

// UI: Dropdown shows all 4 dev users with name and role
test('Dev login dropdown lists all 4 dev users', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('combobox').click()
  await expect(page.getByRole('option', { name: 'Dev Admin (Manager)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Anna Müller (Werkstudentin)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Ben Schneider (Werkstudent)' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Clara Fischer (Werkstudentin)' })).toBeVisible()
})

// UI: Dev Admin is pre-selected by default (PROJ-7 backwards compatibility)
test('Dev Admin (Manager) is pre-selected in dropdown by default', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('combobox')).toContainText('Dev Admin (Manager)')
})

// UI: Button label is "Als gewählten User einloggen"
test('Login button shows correct label', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
})

// UI: Dev only amber badge is visible
test('Dev only badge is visible', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Dev only')).toBeVisible()
})

// API: selecting a werkstudent sends correct userId in POST body
test('Selecting Anna Müller sends her userId in the request body', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/auth/dev-login', route => {
    requests.push(route.request().postData() ?? '')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ redirectTo: '/dashboard' }),
    })
  })
  await page.goto('/login')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Anna Müller (Werkstudentin)' }).click()
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await page.waitForTimeout(300)
  expect(requests[0]).toContain('00000000-0000-0000-0000-000000000002')
})

// API: selecting Ben Schneider sends his userId
test('Selecting Ben Schneider sends his userId in the request body', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/auth/dev-login', route => {
    requests.push(route.request().postData() ?? '')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ redirectTo: '/dashboard' }),
    })
  })
  await page.goto('/login')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Ben Schneider (Werkstudent)' }).click()
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await page.waitForTimeout(300)
  expect(requests[0]).toContain('00000000-0000-0000-0000-000000000003')
})

// API: werkstudent login redirects to /dashboard (not /manager)
test('Werkstudent login redirects to /dashboard', async ({ page }) => {
  await page.route('**/api/auth/dev-login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tokenHash: 'fake-token', redirectTo: '/dashboard' }),
    })
  )
  await page.route('**/auth/v1/verify**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', user: {} }),
    })
  )
  await page.route('/dashboard', route =>
    route.fulfill({ status: 200, body: '<html>dashboard</html>' })
  )
  await page.goto('/login')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Anna Müller (Werkstudentin)' }).click()
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})

// API: 404 response shows "bitte Seed-Script ausführen" toast
test('Shows seed-script toast on 404 for werkstudent', async ({ page }) => {
  await page.goto('/login')
  await page.route('**/api/auth/dev-login', route =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'User nicht gefunden' }),
    })
  )
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Clara Fischer (Werkstudentin)' }).click()
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(
    page.getByText('User nicht gefunden — bitte Seed-Script ausführen (docs/dev-seed.sql)')
  ).toBeVisible()
})

// API: 403 inactive user shows error message from API
test('Shows inaktiver-user error on 403 response', async ({ page }) => {
  await page.goto('/login')
  await page.route('**/api/auth/dev-login', route =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Inaktiver User' }),
    })
  )
  await page.getByRole('button', { name: 'Als gewählten User einloggen' }).click()
  await expect(page.getByText('Inaktiver User')).toBeVisible()
})

// UI: loading state shown while request is in flight
test('Shows loading spinner while login is in progress', async ({ page }) => {
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

// Responsive: dropdown and button visible on mobile (375px)
test('Dev login section is fully visible on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByRole('combobox')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
  await expect(page.getByText('Dev only')).toBeVisible()
})

// Responsive: dropdown and button visible on tablet (768px)
test('Dev login section is fully visible on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await expect(page.getByRole('combobox')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Als gewählten User einloggen' })).toBeVisible()
})
