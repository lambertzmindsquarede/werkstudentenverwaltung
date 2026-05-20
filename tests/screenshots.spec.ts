import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots')
const BASE_URL = 'http://localhost:3000'

const MANAGER_ID = '00000000-0000-0000-0000-000000000001'
const STUDENT_ID = '00000000-0000-0000-0000-000000000002'

const VIEWPORT = { width: 1280, height: 720 }

async function devLogin(page: Page, userId: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  const res = await page.request.post(`${BASE_URL}/api/auth/dev-login`, {
    data: { userId },
  })
  const data = await res.json()
  expect(res.ok()).toBeTruthy()

  const supabaseUrl = await page.evaluate(() => {
    return (window as any).__NEXT_DATA__?.props?.pageProps?.supabaseUrl
      ?? document.cookie
  })

  // Trigger login via UI to properly set session cookies
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Select the correct user via the dropdown
  const selectTrigger = page.locator('[role="combobox"]').first()
  if (await selectTrigger.isVisible()) {
    // Check if already correct user selected, otherwise change
    const currentText = await selectTrigger.textContent()
    if (userId === MANAGER_ID && !currentText?.includes('Mia')) {
      await selectTrigger.click()
      await page.locator('[role="option"]').filter({ hasText: 'Mia' }).click()
    } else if (userId === STUDENT_ID && !currentText?.includes('Anna')) {
      await selectTrigger.click()
      await page.locator('[role="option"]').filter({ hasText: 'Anna' }).click()
    }
  }

  await page.getByRole('button', { name: 'Als Demo-User anmelden' }).click()
  await page.waitForURL(/\/(dashboard|manager)/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function shot(page: Page, filename: string) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true,
  })
}

// ─── Login Page ───────────────────────────────────────────────────────────────
test('screenshot: login', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await shot(page, '00-login.png')
})

// ─── Werkstudent Views ────────────────────────────────────────────────────────
test('screenshot: werkstudent dashboard', async ({ page }) => {
  await devLogin(page, STUDENT_ID)
  await shot(page, '01-ws-dashboard.png')
})

test('screenshot: wochenplanung', async ({ page }) => {
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard/wochenplanung')
  await shot(page, '02-ws-wochenplanung.png')
})

test('screenshot: team-anwesenheit (werkstudent)', async ({ page }) => {
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard/team')
  await shot(page, '03-ws-team-anwesenheit.png')
})

test('screenshot: profil', async ({ page }) => {
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard/profile')
  await shot(page, '04-ws-profil.png')
})

// ─── Manager Views ────────────────────────────────────────────────────────────
test('screenshot: manager dashboard', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await shot(page, '05-mgr-dashboard.png')
})

test('screenshot: manager kalender', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/kalender')
  await shot(page, '06-mgr-kalender.png')
})

test('screenshot: manager deckungsübersicht', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/deckung')
  await shot(page, '07-mgr-deckung.png')
})

test('screenshot: manager auswertung & export', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/auswertung')
  await shot(page, '08-mgr-auswertung.png')
})

test('screenshot: manager team', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/team')
  await shot(page, '09-mgr-team.png')
})

test('screenshot: manager abwesenheiten', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/abwesenheiten')
  await shot(page, '10-mgr-abwesenheiten.png')
})

test('screenshot: manager arbeitsorte', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/arbeitsorte')
  await shot(page, '11-mgr-arbeitsorte.png')
})

test('screenshot: manager nutzer', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/users')
  await shot(page, '12-mgr-users.png')
})

test('screenshot: manager einstellungen', async ({ page }) => {
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/settings')
  await shot(page, '13-mgr-settings.png')
})

// ─── New Screenshots (14–19) ──────────────────────────────────────────────────

test('screenshot: ws abwesenheit-dialog', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard/wochenplanung')
  await page.waitForLoadState('networkidle')

  // Click "+ Abwesenheit eintragen" on any day that has the button
  const absBtn = page.getByText('+ Abwesenheit eintragen').first()
  await absBtn.waitFor({ state: 'visible', timeout: 10000 })
  await absBtn.click()

  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
  await page.waitForTimeout(600)
  await shot(page, '14-ws-abwesenheit-dialog.png')
})

test('screenshot: ws stundenzettel export', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // Click "Stundenzettel exportieren" button in dashboard header
  const exportBtn = page.getByRole('button', { name: /Stundenzettel exportieren/i })
  await exportBtn.waitFor({ state: 'visible', timeout: 10000 })
  await exportBtn.click()

  // Dialog opens at step 1 (date range selection)
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
  await page.waitForTimeout(600)
  await shot(page, '15-ws-stundenzettel-export.png')
})

test('screenshot: mgr zeitkorrektur', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, MANAGER_ID)
  // Use last month which is more likely to have data
  await page.goto('/manager/auswertung?range=last-month')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Expand the first student row that has data (click ChevronRight)
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 10000 })
  await firstRow.click()
  await page.waitForTimeout(800)

  // Click the pencil (edit) button on the first time entry row
  const pencilBtn = page.locator('button[title="Eintrag bearbeiten"]').first()
  await pencilBtn.waitFor({ state: 'visible', timeout: 8000 })
  await pencilBtn.click()

  // ZeitkorrektureDialog opens
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
  await page.waitForTimeout(600)
  await shot(page, '16-mgr-zeitkorrektur.png')
})

test('screenshot: ws dashboard gefuellt', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Anna Müller hat Zeiterfassungsdaten in KW 18 (27.04.–01.05.2026).
  // Aktuelle Woche KW 20 → 2× Zurück = KW 18.
  const zurueckBtn = page.getByRole('button', { name: '← Zurück' })
  for (let i = 0; i < 2; i++) {
    await zurueckBtn.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  }

  await shot(page, '17-ws-dashboard-gefuellt.png')
})

test('screenshot: ws endzeit nachtragen', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, STUDENT_ID)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Check if the incomplete entry banner is visible
  const banner = page.locator('text=Eintrag vom')
  const bannerVisible = await banner.isVisible()

  if (bannerVisible) {
    // Click "Endzeit nachtragen →"
    await page.getByRole('button', { name: /Endzeit nachtragen/i }).click()
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await page.waitForTimeout(600)
  }
  // Screenshot shows either the open dialog (if banner was visible) or the
  // dashboard without incomplete entry (if no open entry exists in test data)
  await shot(page, '18-ws-endzeit-nachtragen.png')
})

test('screenshot: mgr auswertung expanded', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await devLogin(page, MANAGER_ID)
  await page.goto('/manager/auswertung?range=last-month')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Expand the first student row to show day-level entries
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor({ state: 'visible', timeout: 10000 })
  await firstRow.click()
  await page.waitForTimeout(800)

  await shot(page, '19-mgr-stundenzettel-export.png')
})
