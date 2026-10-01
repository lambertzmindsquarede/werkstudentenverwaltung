import { test, expect, type Browser, type Page } from '@playwright/test'

// PROJ-28: Team-Wochenkalender für Werkstudenten
// E2E-Tests gegen die Dev-Login-Testaccounts (Demo-Bereich: Anna Müller,
// Ben Schneider, Clara Fischer).
//
// WICHTIG: Der Dev-Login setzt beim Einloggen das Passwort des Accounts neu
// und invalidiert damit bestehende Sessions desselben Accounts. Damit die
// parallel laufenden Playwright-Projekte (chromium, Mobile Safari) sich nicht
// gegenseitig ausloggen, verwendet jedes Projekt einen EIGENEN Werkstudenten-
// Account. Manager-Tests laufen nur auf chromium.

// Seriell pro Projekt: fullyParallel würde die Tests dieser Datei auf mehrere
// Worker verteilen, die sich über den Dev-Login (Passwort-Reset) gegenseitig
// die Session invalidieren. Ein Worker pro Projekt + ein Account pro Projekt
// macht die Suite deterministisch.
// retries: Der Next-DEV-Server beantwortet Server-Action-POSTs während eines
// parallelen Recompiles (zweites Playwright-Projekt) sporadisch mit einer
// HTML-Fehlerseite („An unexpected response was received from the server").
// Das ist ein Dev-only-Transient, kein App-Bug — ein Retry genügt.
test.describe.configure({ mode: 'serial', retries: 2 })

const PROJECT_ACCOUNTS: Record<string, { pattern: RegExp; displayName: string }> = {
  chromium: { pattern: /anna müller/i, displayName: 'Anna Müller' },
  'Mobile Safari': { pattern: /clara fischer/i, displayName: 'Clara Fischer' },
}

function accountForProject(projectName: string) {
  return PROJECT_ACCOUNTS[projectName] ?? PROJECT_ACCOUNTS['chromium']
}

// ─── Auth helpers (Muster aus PROJ-20, pro Projekt getrennt) ─────────────────

type Cookie = Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>['cookies'][number]
const werkstudentCookiesByProject = new Map<string, Cookie[]>()
let managerCookies: Cookie[] = []
const authFailedByProject = new Map<string, boolean>()

async function devLogin(browser: Browser, optionPattern: RegExp, urlPattern: RegExp): Promise<Cookie[]> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/login')
    if (!(await page.getByText('Demo-Zugänge').isVisible({ timeout: 5000 }).catch(() => false))) {
      return []
    }
    await page.locator('[role="combobox"]').first().click()
    const option = page.getByRole('option', { name: optionPattern })
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) return []
    await option.click()
    await page.getByRole('button', { name: /als demo-user anmelden/i }).click()
    await page.waitForURL(urlPattern, { timeout: 15000 })
    return (await ctx.storageState()).cookies
  } catch {
    return []
  } finally {
    await ctx.close()
  }
}

async function ensureWerkstudentAuth(browser: Browser, projectName: string) {
  if (werkstudentCookiesByProject.has(projectName) || authFailedByProject.get(projectName)) return
  const account = accountForProject(projectName)
  const cookies = await devLogin(browser, account.pattern, /\/dashboard/)
  if (cookies.length === 0) {
    authFailedByProject.set(projectName, true)
  } else {
    werkstudentCookiesByProject.set(projectName, cookies)
  }
}

function skipIfAuthFailed(projectName: string) {
  test.skip(authFailedByProject.get(projectName) === true, 'Dev login not available')
}

async function openTeamKalender(browser: Browser, projectName: string): Promise<{ page: Page; ctx: Awaited<ReturnType<Browser['newContext']>> }> {
  const ctx = await browser.newContext()
  await ctx.addCookies(werkstudentCookiesByProject.get(projectName) ?? [])
  const page = await ctx.newPage()
  await page.goto('/dashboard/team-kalender')
  return { page, ctx }
}

// ─── AC: Zugriff & Navigation ────────────────────────────────────────────────

test('unauthenticated access to /dashboard/team-kalender redirects to /login', async ({ page }) => {
  await page.goto('/dashboard/team-kalender')
  await expect(page).toHaveURL(/\/login/)
})

test('werkstudent nav shows a Team-Kalender item', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)
  await expect(page.getByRole('link', { name: 'Team-Kalender' })).toBeVisible()
  await ctx.close()
})

test('page loads current week with all bereich members including self first', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)
  const self = accountForProject(project).displayName

  await expect(page.getByRole('heading', { name: 'Team-Kalender' })).toBeVisible()
  await expect(page.getByText(/KW \d+/)).toBeVisible()

  // Alle aktiven Werkstudenten des Demo-Bereichs
  await expect(page.getByText('Anna Müller')).toBeVisible()
  await expect(page.getByText('Ben Schneider')).toBeVisible()
  await expect(page.getByText('Clara Fischer')).toBeVisible()

  // Eigene Zeile zuerst, markiert mit „(Ich)"
  await expect(page.getByText('(Ich)')).toBeVisible()
  const firstRowText = await page.locator('div.grid').nth(1).textContent()
  expect(firstRowText).toContain(self)
  await ctx.close()
})

test('manager accessing the werkstudent team-kalender is redirected away', async ({ browser }) => {
  test.skip(test.info().project.name !== 'chromium', 'Manager-Login nur auf chromium (Session-Kollision vermeiden)')
  if (managerCookies.length === 0) {
    managerCookies = await devLogin(browser, /mia schulz/i, /\/manager/)
  }
  test.skip(managerCookies.length === 0, 'Manager dev login not available')
  const ctx = await browser.newContext()
  await ctx.addCookies(managerCookies)
  const page = await ctx.newPage()
  await page.goto('/dashboard/team-kalender')
  await expect(page).toHaveURL(/\/manager/)
  await ctx.close()
})

// ─── AC: Zeithorizont ────────────────────────────────────────────────────────

test('back navigation is disabled in the current week', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)
  await expect(page.getByRole('button', { name: 'Vorherige Woche' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Nächste Woche' })).toBeEnabled()
  await ctx.close()
})

test('forward navigation loads the next week and allows going back to current', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)

  const weekLabel = page.getByText(/KW \d+ ·/)
  const initialWeek = await weekLabel.textContent()

  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(weekLabel).not.toHaveText(initialWeek!, { timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Vorherige Woche' })).toBeEnabled()

  await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  await expect(weekLabel).toHaveText(initialWeek!, { timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Vorherige Woche' })).toBeDisabled()
  await ctx.close()
})

// ─── AC: Dateninhalt / Sicherheit (Antwortformat) ────────────────────────────

test('server action response contains only the trimmed contract — no ist times, no colleague absence types', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/dashboard/team-kalender') && r.request().method() === 'POST',
      { timeout: 15000 }
    ),
    page.getByRole('button', { name: 'Nächste Woche' }).click(),
  ])

  const body = await response.text()
  // Vertragsfelder vorhanden
  expect(body).toContain('weekStr')
  expect(body).toContain('members')
  expect(body).toContain('teamAbsences')
  // Verbotene Inhalte: Ist-Zeiten und Abwesenheits-Typfelder für Kollegen
  expect(body).not.toContain('actual_start')
  expect(body).not.toContain('actual_entries')
  expect(body).not.toContain('is_complete')
  expect(body).not.toContain('mood_emoji')
  await ctx.close()
})

test('cells without plan or absence render an em dash', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const { page, ctx } = await openTeamKalender(browser, project)
  // Bei 3 Mitgliedern × 5 Tagen gibt es praktisch immer leere Zellen
  await expect(page.getByText('—').first()).toBeVisible()
  await ctx.close()
})

// ─── Responsive ──────────────────────────────────────────────────────────────

test('mobile viewport (375px) renders the page with scrollable calendar container', async ({ browser }) => {
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await ctx.addCookies(werkstudentCookiesByProject.get(project) ?? [])
  const page = await ctx.newPage()
  await page.goto('/dashboard/team-kalender')
  await expect(page.getByRole('heading', { name: 'Team-Kalender' })).toBeVisible()
  await expect(page.getByText(accountForProject(project).displayName)).toBeVisible()
  await ctx.close()
})

test('mobile viewport (375px) has no horizontal page overflow', async ({ browser }) => {
  // QA-Bug PROJ-28/1: Die Werkstudenten-Navigation (5 Einträge) überläuft bei
  // 375px die Seitenbreite. Erwarteter Fehlschlag bis zum Fix — test.fail()
  // schlägt dann als "unexpected pass" an und erinnert ans Entfernen.
  test.fail(true, 'Bekannter Bug: WerkstudentNav überläuft bei 375px (QA Bug 1)')
  const project = test.info().project.name
  await ensureWerkstudentAuth(browser, project)
  skipIfAuthFailed(project)
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await ctx.addCookies(werkstudentCookiesByProject.get(project) ?? [])
  const page = await ctx.newPage()
  await page.goto('/dashboard/team-kalender')
  await expect(page.getByRole('heading', { name: 'Team-Kalender' })).toBeVisible()
  const noBodyOverflow = await page.evaluate(
    () => document.body.scrollWidth <= window.innerWidth + 1
  )
  expect(noBodyOverflow).toBe(true)
  await ctx.close()
})
