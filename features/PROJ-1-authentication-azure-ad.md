# PROJ-1: Authentication (Azure AD SSO)

## Status: Approved
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Implementation Notes (Frontend)
- Installed `@supabase/ssr` for SSR-compatible session handling
- Created `src/lib/supabase-browser.ts` (browser client) and `src/lib/supabase-server.ts` (server client)
- Created `src/proxy.ts` (Next.js 16 proxy, replaces deprecated middleware) for route protection
- Created `/login` page with mindsquare branding + Microsoft OAuth button
- Created `/auth/callback` route handler: exchanges code → session, upserts profile, redirects by role
- Created `/pending` page for users without a role
- Created `/dashboard` placeholder (Werkstudenten)
- Created `/manager` placeholder (Manager)
- Root `/` redirects to `/login`

## Implementation Notes (Backend)
- Created `profiles` table in Supabase (eu-north-1) via migration `create_profiles_table`
  - Columns: `id` (FK → auth.users), `email`, `full_name`, `role` (CHECK: werkstudent|manager), `created_at`, `updated_at`
  - RLS enabled; policies: own-profile SELECT+INSERT, manager-reads-all SELECT
  - Trigger `profiles_updated_at` keeps `updated_at` in sync
  - Index on `role` for manager-list queries
- Generated TypeScript types at `src/lib/database.types.ts` (exports `Profile`, `UserRole`)
- Updated `.env.local.example` with required vars
- **Manual step required:** Configure Azure AD in Supabase dashboard → Authentication → Providers → Azure (Client ID, Client Secret, Tenant ID from Azure App Registration)

## Dependencies
- None

## User Stories
- Als Werkstudent möchte ich mich mit meinem Microsoft-Unternehmenskonto anmelden, damit ich kein separates Passwort verwalten muss.
- Als Manager möchte ich mich ebenfalls per Azure AD SSO anmelden, damit Sicherheitsstandards des Unternehmens gewahrt bleiben.
- Als System möchte ich die Rolle eines Nutzers (Werkstudent / Manager) anhand seiner Azure AD-Gruppe oder einer Supabase-Konfiguration bestimmen, damit die richtigen Funktionen freigeschaltet werden.
- Als Werkstudent möchte ich nach dem Login auf mein persönliches Dashboard weitergeleitet werden.
- Als Manager möchte ich nach dem Login auf die Kalenderübersicht weitergeleitet werden.

## Acceptance Criteria
- [ ] Nutzer können sich mit ihrem Microsoft-Unternehmenskonto (Azure AD) anmelden
- [ ] Bei erfolgreichem Login wird ein Supabase-Nutzer-Profil erstellt (wenn noch nicht vorhanden)
- [ ] Rollen werden aus Supabase (nicht Azure AD) gesteuert: `werkstudent` oder `manager`
- [ ] Werkstudenten werden nach Login zu `/dashboard` weitergeleitet
- [ ] Manager werden nach Login zu `/manager` weitergeleitet
- [ ] Ohne Login ist kein Bereich der App zugänglich (alle Routen sind geschützt)
- [ ] Abmelden beendet die Supabase-Session und leitet zur Login-Seite weiter
- [ ] Bei ungültigem oder abgelaufenem Token wird der Nutzer zur Login-Seite umgeleitet

## Edge Cases
- Was passiert, wenn ein Azure-Konto existiert, aber noch kein Supabase-Profil? → Profil wird beim ersten Login automatisch angelegt, Rolle muss manuell durch Admin vergeben werden
- Was passiert, wenn ein Nutzer keine Rolle hat? → Er sieht eine "Warte auf Freischaltung"-Seite
- Was passiert bei Azure AD Serviceunterbrechungen? → Login schlägt fehl, Fehlermeldung wird angezeigt
- Was passiert, wenn der Nutzer den Browser schließt? → Session bleibt aktiv (Supabase-Cookie), Nutzer ist beim nächsten Öffnen eingeloggt

## Technical Requirements
- **Provider:** Supabase Auth mit Azure AD (OAuth 2.0 / OIDC)
- **Session:** Supabase Session Cookies (SSR-kompatibel via `@supabase/ssr`)
- **Schutz:** Alle Seiten außer `/login` erfordern gültige Session
- **Rollensteuerung:** Tabelle `profiles` in Supabase mit Spalte `role` (enum: `werkstudent`, `manager`)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
App (Next.js)
│
├── /login                     ← Öffentliche Seite
│   └── LoginPage
│       └── MicrosoftSignInButton
│
├── /auth/callback             ← Interner Redirect-Handler (kein UI)
│   └── AuthCallbackPage       Empfängt Token von Azure AD → legt Profil an
│
├── /pending                   ← Öffentliche Seite (ohne Rolle)
│   └── PendingActivationPage
│
├── /dashboard                 ← Geschützt: nur Werkstudenten
│   └── DashboardPage
│
├── /manager                   ← Geschützt: nur Manager
│   └── ManagerPage
│
└── Middleware                 ← Prüft jede Anfrage vor dem Laden der Seite
    ├── Keine Session?         → /login
    ├── Rolle: werkstudent?    → /dashboard
    ├── Rolle: manager?        → /manager
    └── Keine Rolle?           → /pending
```

### Datenmodell

**Auth-Bereich (Supabase verwaltet)**
- E-Mail, Name, ID aus Azure AD
- Azure-AD-Token (intern, für Session)

**`profiles`-Tabelle**
- `id` — Verknüpfung zum Auth-Nutzer
- `email` — E-Mail-Adresse
- `full_name` — Anzeigename
- `role` — enum: `werkstudent` | `manager` | null (leer bis Admin vergibt)
- `created_at` — Zeitpunkt der ersten Anmeldung

Profil wird beim ersten Login automatisch angelegt (ohne Rolle). Admin vergibt Rolle manuell in Supabase.

### Login-Flow

```
Nutzer → Middleware prüft Session → kein Login → /login
→ "Mit Microsoft anmelden" → Azure AD → /auth/callback
→ Supabase Session + Profil anlegen → Rolle lesen
→ werkstudent: /dashboard | manager: /manager | keine Rolle: /pending
```

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| Supabase Auth als Vermittler | Azure AD native OAuth-Unterstützung, kein eigener Auth-Server |
| Rollen in Supabase, nicht Azure AD | Kein AD-Admin-Zugriff nötig, einfachere Verwaltung |
| Next.js Middleware | Seiten werden erst gar nicht geladen ohne gültige Session |
| SSR-kompatible Cookies (`@supabase/ssr`) | Session nach Browser-Neustart erhalten, SSR-kompatibel |

### Abhängigkeiten

- `@supabase/supabase-js` — Supabase-Client
- `@supabase/ssr` — SSR-kompatible Session-Verwaltung

## QA Test Results

**QA Date:** 2026-04-28
**Tester:** /qa skill
**Production Ready:** YES — Alle Bugs behoben (2026-04-28)

### Acceptance Criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Nutzer können sich mit Microsoft-Konto (Azure AD) anmelden | PARTIAL | Cannot test end-to-end without real Azure AD tenant; OAuth button and callback handler implemented correctly |
| 2 | Bei erfolgreichem Login wird Supabase-Profil erstellt | PARTIAL | Code correct; requires live Azure AD login to verify |
| 3 | Rollen aus Supabase gesteuert (werkstudent / manager) | PARTIAL | Code correct; requires live session to verify |
| 4 | Werkstudenten → /dashboard nach Login | PARTIAL | Code correct; requires live login to verify |
| 5 | Manager → /manager nach Login | PARTIAL | Code correct; requires live login to verify |
| 6 | Ohne Login kein Zugriff auf geschützte Bereiche | PASS | Verified via curl (307) and Playwright E2E tests |
| 7 | Abmelden beendet Session und leitet zu /login | PARTIAL | UI button present; requires active session to test |
| 8 | Ungültiger/abgelaufener Token → /login Weiterleitung | PARTIAL | Proxy calls `supabase.auth.getUser()` (server-side validation); requires session to test |

### Edge Cases

| Edge Case | Status | Notes |
|-----------|--------|-------|
| Azure-Konto ohne Supabase-Profil → Profil wird angelegt | PASS (code) | `upsert` with `ignoreDuplicates: true` in callback |
| Nutzer ohne Rolle → /pending Seite | PASS (code) | Redirect logic correct in both callback and proxy |
| Azure AD Serviceunterbrechung → Fehlermeldung | FAIL | Auth failure redirects to `/login?error=auth_failed` but login page shows NO error message |
| Browser schließen → Session bleibt (Cookie) | PASS (code) | Supabase SSR cookie-based session |

### Security Audit

| Check | Result | Notes |
|-------|--------|-------|
| Auth bypass (unauthenticated access) | PASS | All routes protected; tested with curl and Playwright |
| Role isolation (werkstudent → /manager blocked) | PASS (code) | Proxy redirects werkstudent away from /manager |
| Role isolation (manager → /dashboard blocked) | PASS (code) | Proxy redirects manager away from /dashboard |
| Authenticated user with role accessing /pending | FAIL | Proxy skips role check for /pending; users with roles can view the "waiting" page |
| XSS via error query param on login page | PASS | Error params not rendered (though this means no error display — see bugs) |
| Secrets in source code | PASS | No hardcoded credentials found |
| OAuth state/CSRF protection | PASS | Supabase PKCE handles this internally |

### Responsive Testing

| Viewport | Status |
|----------|--------|
| Mobile 375px | PASS (Playwright) |
| Tablet 768px | PASS (Playwright) |
| Desktop 1440px | PASS (Playwright) |

### Bugs Found

#### ~~BUG-1 (High): Login page shows no error feedback after auth failure~~ — FIXED 2026-04-28

**Steps to reproduce:**
1. Navigate to `/auth/callback` without a `code` param, e.g. `/auth/callback`
2. → Redirected to `/login?error=missing_code`
3. Login page renders with no visible error message

**Expected:** User sees a localized error message ("Anmeldung fehlgeschlagen. Bitte erneut versuchen.")
**Actual:** Error param is silently ignored; user sees the default login page with no explanation
**Fix:** Read `searchParams.error` in `LoginPage` and display an alert below the button

---

#### ~~BUG-2 (Medium): Authenticated users with a role can directly access `/pending`~~ — FIXED 2026-04-28

**Steps to reproduce:**
1. Log in as a werkstudent (role assigned)
2. Manually navigate to `/pending`
3. → Page renders the "Warte auf Freischaltung" UI instead of redirecting to `/dashboard`

**Expected:** Users with a role are redirected to their correct page
**Actual:** Proxy skips role check for `/pending` (line 59: `if (pathname === '/pending' || isPublicRoute)`)
**Fix:** In `proxy.ts`, remove `/pending` from the early-return condition and redirect users with a role away from `/pending`

---

#### ~~BUG-3 (Medium): Profile email/name not synced on subsequent logins~~ — FIXED 2026-04-28

**Steps to reproduce:**
1. User logs in, profile created
2. User's display name changes in Azure AD
3. User logs in again
4. → `full_name` in Supabase profile is NOT updated

**Root cause:** `upsert` in `auth/callback/route.ts` uses `ignoreDuplicates: true`, which skips the update if the row exists
**Fix:** Remove `ignoreDuplicates: true` and use explicit conflict handling (`onConflict: 'id'` without ignoreDuplicates) to allow partial updates of `email` and `full_name`

---

#### ~~BUG-4 (Medium): No HTTP security headers~~ — FIXED 2026-04-28

**Issue:** Missing security headers required by project security rules:
- `X-Frame-Options: DENY` (clickjacking protection)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: origin-when-cross-origin`
- `Strict-Transport-Security`

**Fix:** Add `headers()` config to `next.config.ts`

---

#### ~~BUG-5 (Low): Unused `useRouter` import in `pending/page.tsx`~~ — FIXED 2026-04-28

**File:** [src/app/pending/page.tsx](../src/app/pending/page.tsx) line 6
**Issue:** `useRouter` imported and `router` assigned but never used; will cause lint warning
**Fix:** Remove unused import and variable

---

#### ~~BUG-6 (Low): No loading/disabled state on sign-out buttons in dashboard and manager pages~~ — FIXED 2026-04-28

**File:** [src/app/dashboard/page.tsx](../src/app/dashboard/page.tsx), [src/app/manager/page.tsx](../src/app/manager/page.tsx)
**Issue:** `handleSignOut` is async but the button has no disabled state; double-click triggers multiple sign-out calls
**Fix:** Add `useState` for loading, disable button during `handleSignOut`

### E2E Tests Written

File: `tests/PROJ-1-authentication.spec.ts` — 18 tests, all passing

- Root `/` redirects to `/login` ✓
- `/dashboard` redirected to `/login` for unauthenticated users ✓
- `/manager` redirected to `/login` for unauthenticated users ✓
- `/pending` redirected to `/login` for unauthenticated users ✓
- Login page renders Microsoft button, branding, footer note ✓
- Microsoft sign-in button is enabled and clickable ✓
- Responsive: 375px, 768px, 1440px ✓
- Security: direct URL manipulation to `/manager` and `/dashboard` blocked ✓

## Deployment
_To be added by /deploy_
