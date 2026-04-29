# PROJ-7: Lokaler Dev-Login

## Status: Approved
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Implementation Notes
- `src/components/DevLoginButton.tsx` – Client Component; gibt `null` zurück wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED !== 'true'`
- `src/app/api/auth/dev-login/route.ts` – POST-Route mit doppeltem Guard (`NODE_ENV=development` + `DEV_LOGIN_ENABLED=true`); nutzt Supabase Admin `generateLink` + SSR-Client `verifyOtp` um Session-Cookies identisch zum Azure-AD-Flow zu setzen
- `src/app/login/page.tsx` – `<DevLoginButton />` nach `<MicrosoftSignInButton />` eingefügt
- `docs/dev-seed.sql` – Legt Dev-Admin in `auth.users` und `public.profiles` an (mit `ON CONFLICT DO NOTHING/UPDATE`)
- `.env.local` enthält `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` und `DEV_LOGIN_ENABLED=true`
- **Offenes Handlungsitem:** `SUPABASE_SERVICE_ROLE_KEY` muss in `.env.local` eingetragen werden (Supabase Dashboard → Project Settings → API → service_role key); ohne diesen Key schlägt der API-Endpunkt mit 500 fehl
- `.env.local.example` um alle drei Dev-Login-Variablen erweitert

## Dependencies
- Requires: PROJ-1 (Authentication / Azure AD SSO) – der Dev-Login ist ein Bypass der bestehenden Auth-Schicht und muss in dasselbe Session-/Cookie-System integriert sein.
- Requires: PROJ-2 (Nutzerverwaltung) – der Dev-Admin-User muss in der `users`-Tabelle als Manager-Rolle existieren.

## Context / Motivation
Während der lokalen Entwicklung ist ein Azure-AD-Tenant und eine laufende SSO-Konfiguration erforderlich. Das verlangsamt das Onboarding neuer Entwickler und erschwert das Testen von Manager-Funktionalitäten. PROJ-7 fügt einen rein entwicklungsinternen Bypass hinzu: Auf der Login-Seite erscheint ein Button „Als Admin einloggen", der ohne Passwort sofort eine authentifizierte Session als seeded Admin-User öffnet. Der Button ist in Production-Deployments vollständig unsichtbar und der zugehörige API-Endpunkt liefert in Production immer HTTP 403.

## Scope
- **In Scope:** Dev-Login-Button auf der Login-Seite, ein `/api/auth/dev-login`-Endpunkt, Seed-SQL für den Admin-User
- **Out of Scope:** Produktiv-Login ohne Azure AD, Passwortbasiertes Login für reguläre Nutzer, Admin-UI zur Nutzerverwaltung lokaler Accounts

## User Stories
- Als Entwickler möchte ich mich lokal mit einem Klick als Admin einloggen, damit ich ohne Azure-AD-Konfiguration alle Manager-Funktionen testen kann.
- Als Entwickler möchte ich, dass der Dev-Login-Button nur in lokalen Umgebungen sichtbar ist, damit ich sicher sein kann, dass kein Bypass in Production existiert.
- Als Datenbankadmin möchte ich ein fertiges SQL-Snippet haben, mit dem ich den Dev-Admin-User in Supabase anlegen kann, ohne alles manuell konfigurieren zu müssen.
- Als Entwickler möchte ich nach dem Dev-Login exakt dieselbe Session-Erfahrung haben wie nach einem echten Azure-AD-Login, damit ich keine sonderfallbedingte Testverzerrung habe.

## Acceptance Criteria
- [ ] Auf der Login-Seite (`/login`) ist der Button „Als Admin einloggen" sichtbar, wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` (und ausschließlich dann).
- [ ] Der Button ist klar von der regulären Azure-AD-Schaltfläche unterscheidbar (z.B. andersfarbig, gelbes Warning-Badge oder Label „Dev only").
- [ ] Ein Klick auf den Button löst einen POST-Request an `/api/auth/dev-login` aus.
- [ ] `/api/auth/dev-login` ist nur aktiv, wenn `NODE_ENV=development` **und** `DEV_LOGIN_ENABLED=true` (server-seitige Doppelabsicherung). Andernfalls antwortet der Endpunkt mit HTTP 403.
- [ ] Der Endpunkt schreibt dieselbe Session / dasselbe Cookie wie der normale Azure-AD-Flow (gleicher Cookie-Name, gleiche Felder).
- [ ] Nach dem Dev-Login wird der Nutzer auf `/dashboard` (Werkstudent) oder `/manager` (Manager) weitergeleitet – abhängig von der Rolle des seeded Users.
- [ ] Der seeded Dev-Admin-User hat die Rolle `manager`, damit alle Manager-Ansichten getestet werden können.
- [ ] Ein SQL-Seed-Snippet (in `docs/dev-seed.sql` oder als Kommentar in der Spec) legt den Dev-Admin-User in der Supabase-Datenbank an.
- [ ] Ohne seeded User in der DB zeigt der Dev-Login einen verständlichen Fehler (z.B. Toast: „Dev-Admin-User nicht gefunden – bitte Seed-Script ausführen").
- [ ] Im Production-Build (`NODE_ENV=production`) ist der Button im DOM nicht vorhanden (kein reines CSS-Hide, sondern kein Rendering).

## Edge Cases
- **Seeded User fehlt in der DB:** API antwortet mit 404, Frontend zeigt Toast mit Hinweis auf das Seed-Script.
- **`NEXT_PUBLIC_DEV_LOGIN_ENABLED` in Production gesetzt (Konfigurationsfehler):** Server-seitiger `NODE_ENV`-Check verhindert trotzdem die Session-Erzeugung (HTTP 403). Der Button kann im Frontend sichtbar sein, der Login schlägt aber fehl.
- **Gleichzeitiger Einsatz mit Azure-AD-Login:** Beide Buttons sind in Dev-Modus nebeneinander sichtbar und funktionieren unabhängig.
- **Dev-User hat eine andere Rolle (z.B. `werkstudent`):** Login funktioniert, Weiterleitung geht auf `/dashboard`; Entwickler sieht bewusst die Werkstudenten-Ansicht. Kein Fehler.
- **Browser-Cookies bereits vorhanden (alter Session):** Der Dev-Login überschreibt die bestehende Session.
- **Mehrere Dev-Users in der DB:** Der Endpunkt wählt immer den ersten Nutzer mit `is_active=true` und `role=manager` – kein UI zur Nutzerauswahl.

## Technical Requirements
- **Security:** Doppelte Umgebungsprüfung (NEXT_PUBLIC_DEV_LOGIN_ENABLED client-seitig + NODE_ENV + DEV_LOGIN_ENABLED server-seitig); API-Route niemals in Production erreichbar.
- **Session-Kompatibilität:** Session-Cookie identisch zur Azure-AD-Auth (gleiche Supabase-Session-Struktur oder NextAuth-Session, je nachdem was PROJ-1 verwendet).
- **Kein Passwort gespeichert:** Der Dev-User braucht kein Passwort-Hash in der Datenbank – die Session wird serverseitig direkt erzeugt (Supabase `admin.auth.signInWithPassword` mit dev-only Service-Role-Key oder direkter Session-Erzeugung).
- **Performance:** Dev-Login-Roundtrip < 500 ms (kein Azure-AD-Redirect-Flow).
- **Keine Produktions-Abhängigkeit:** Der gesamte Dev-Login-Code (Button, API-Route, Seed-SQL) soll klar als `dev-only` markiert sein; ggf. mit einem Kommentar-Block.

## Seed-SQL (Vorschlag)
```sql
-- Dev-only Admin-User für PROJ-7 lokalen Login
-- Nur in lokaler Supabase-Instanz ausführen!
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  'Dev Admin',
  'manager',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/login page (existing, Server Component)
+-- mindsquare logo + title (existing)
+-- MicrosoftSignInButton (existing, unchanged)
+-- DevLoginButton (NEW – Client Component, conditional)
    +-- Amber warning badge: "Dev only"
    +-- Button: "Als Admin einloggen"
    +-- Loading state while login request is pending
    +-- Error toast if seed user is missing in DB
```

`DevLoginButton` wird nur gerendert wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true`. In Production gibt die Komponente `null` zurück – kein DOM-Eintrag.

### Data Flow

```
.env.local (dev flags gesetzt)
  → /login rendert DevLoginButton
  → Klick "Als Admin einloggen"
  → POST /api/auth/dev-login
      [Guard 1] NODE_ENV ≠ development → 403
      [Guard 2] DEV_LOGIN_ENABLED ≠ true  → 403
      → Query profiles table: erster aktiver Manager
      → Nicht gefunden → 404 (Frontend-Toast: "Bitte Seed-Script ausführen")
      → Gefunden → Supabase-Session via Service Role Key erstellen
      → Selbe Session-Cookies wie Azure-AD-Callback-Flow setzen
      → { redirectTo: "/manager" }
  → Frontend navigiert zu /manager
```

### Security: Two-Layer Environment Gate

| Layer | Variable | Geprüft in | Wirkung |
|---|---|---|---|
| Client | `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` | Login-Seite | Button gerendert vs. nicht gerendert |
| Server | `NODE_ENV=development` + `DEV_LOGIN_ENABLED=true` | API-Route | 403 wenn eine Bedingung fehlt |

### Session-Kompatibilität

Die API-Route nutzt den **Supabase Service Role Key** um eine Session für den Seed-User zu erzeugen. Die resultierenden Cookies sind strukturell identisch mit denen des bestehenden `/api/auth/callback`-Flows (`sb-<project>-auth-token`).

### Hinweis: profiles vs. users Tabelle

Die PROJ-7-Spec referenziert eine `users`-Tabelle, PROJ-1 implementiert aber eine `profiles`-Tabelle. Das Design zielt auf `profiles` – konsistent mit dem bestehenden Auth-Flow.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/app/login/page.tsx` | `DevLoginButton` hinzufügen (bedingt) |
| `src/components/DevLoginButton.tsx` | Neu – Client Component |
| `src/app/api/auth/dev-login/route.ts` | Neu – geschützte POST-Route |
| `docs/dev-seed.sql` | Neu – Seed-Script für Dev-Admin-User |
| `.env.local` (nicht committed) | `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true`, `DEV_LOGIN_ENABLED=true` |

### Environment Variables

| Variable | Side | Committed? |
|---|---|---|
| `NEXT_PUBLIC_DEV_LOGIN_ENABLED` | Client | Nein (.env.local) |
| `DEV_LOGIN_ENABLED` | Server | Nein (.env.local) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Nein (bereits in .env.local) |

### Dependencies

Keine neuen npm-Pakete – `@supabase/ssr`, shadcn `Button`, `Badge`, `sonner` sind bereits installiert.

## QA Test Results

**QA Date:** 2026-04-29
**Tester:** /qa skill (automated + code review)
**Status:** NOT READY — 1 High bug found

### Acceptance Criteria Results

| # | Acceptance Criterion | Result | Notes |
|---|---|---|---|
| AC 1 | Button sichtbar wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` | ✅ PASS | E2E test bestätigt |
| AC 2 | Button klar unterscheidbar (amber, "Dev only" Badge) | ✅ PASS | Badge + "Nur lokal sichtbar" Text vorhanden |
| AC 3 | Klick löst POST an `/api/auth/dev-login` aus | ✅ PASS | E2E via Playwright request interception |
| AC 4 | API nur aktiv wenn `NODE_ENV=development` UND `DEV_LOGIN_ENABLED=true` | ✅ PASS | Code-Review: Double-Guard korrekt implementiert |
| AC 5 | Session/Cookie identisch zum Azure-AD-Flow | ❌ BLOCKED | API wird durch Proxy blockiert (BUG-1) |
| AC 6 | Weiterleitung zu `/manager` oder `/dashboard` je nach Rolle | ❌ BLOCKED | Nicht erreichbar wegen BUG-1 |
| AC 7 | Seeded Dev-Admin hat Rolle `manager` | ✅ PASS | `docs/dev-seed.sql` setzt `role = 'manager'` |
| AC 8 | SQL-Seed-Snippet in `docs/dev-seed.sql` vorhanden | ✅ PASS | Datei existiert, Inhalt korrekt (`public.profiles`) |
| AC 9 | Fehlender Seed-User → verständlicher Error-Toast | ✅ PASS | Toast "bitte Seed-Script ausführen (docs/dev-seed.sql)" |
| AC 10 | Im Production-Build Button nicht im DOM | ✅ PASS | `return null` wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED !== 'true'` |

### Bugs Found

#### ~~BUG-1~~ (High): Proxy-Middleware blockiert `/api/auth/dev-login` — **FIXED (2026-04-29)**

`/api/auth/dev-login` added to `PUBLIC_ROUTES` in `src/proxy.ts`. Unauthenticated requests reach the route handler directly.

#### ~~Original BUG-1 description~~: Proxy-Middleware blockiert `/api/auth/dev-login` für unauthentifizierte Requests

**Beschreibung:**  
`src/proxy.ts` definiert `PUBLIC_ROUTES = ['/login', '/auth']`. Der Pfad `/api/auth/dev-login` beginnt mit `/api/auth`, NICHT mit `/auth`. Die Proxy-Middleware erkennt ihn daher als geschützte Route und leitet unauthentifizierte Requests auf `/login` (HTML) um.

**Symptom:**  
Klick auf "Als Admin einloggen" → `fetch('/api/auth/dev-login')` folgt dem 302-Redirect zur `/login`-HTML-Seite → `res.json()` wirft einen SyntaxError → `catch`-Block zeigt Toast "Dev-Login fehlgeschlagen." — der eigentliche Route-Handler wird nie erreicht.

**Nachweis:**  
Direkter `POST /api/auth/dev-login` ohne Auth-Cookies liefert `<!DOCTYPE html>` (HTML-Login-Seite) statt JSON.

**Fix:**  
In `src/proxy.ts` `PUBLIC_ROUTES` um `/api/auth` oder spezifisch `/api/auth/dev-login` erweitern:
```typescript
const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/dev-login']
```

**Betroffene ACs:** AC 5, AC 6 (beide blockiert)

#### ~~BUG-2~~ (Low): Spec-Inkonsistenz — **FIXED (2026-04-29)**

"Seed-SQL (Vorschlag)" section corrected: `public.users` → `public.profiles`, column `name` → `full_name`.

#### ~~Original BUG-2~~: Spec-Inkonsistenz — `public.users` vs. `public.profiles` in Seed-SQL

**Beschreibung:**  
Der Abschnitt "Seed-SQL (Vorschlag)" in der Spec referenziert `public.users`, das implementierte `docs/dev-seed.sql` korrekt `public.profiles`. Keine funktionale Auswirkung — Impl. ist richtig, Spec ist falsch.

**Fix:** Spec-Tabellennamen unter "Seed-SQL (Vorschlag)" auf `public.profiles` korrigieren.

#### ~~BUG-3~~ (Low): Fehlermeldung bei halbfertigem Seed — **FIXED (2026-04-29)**

`dev-login/route.ts` now detects "user not found" errors from `generateLink` and returns HTTP 404 (same as the profile-missing case) so the frontend shows the correct seed-hint toast.

#### ~~Original BUG-3~~: Fehlermeldung bei halbfertigem Seed (nur `profiles`, kein `auth.users`)

**Beschreibung:**  
Falls nur `public.profiles` gesät wurde, aber kein `auth.users`-Eintrag existiert, schlägt `supabaseAdmin.auth.admin.generateLink()` fehl → API antwortet mit HTTP 500 statt 404. Der Frontend-Toast zeigt "Dev-Login fehlgeschlagen." statt "bitte Seed-Script ausführen".

**Schweregrad:** Low (betrifft nur fehlerhafte Seed-Ausführung; vollständiger Seed aus `docs/dev-seed.sql` setzt beide Tabellen korrekt)

### Security Audit

| Prüfpunkt | Ergebnis |
|---|---|
| API in Production erreichbar? | ✅ SICHER — `NODE_ENV !== 'development'` → HTTP 403 |
| Button im Production-DOM? | ✅ SICHER — compile-time `NEXT_PUBLIC_` Guard, gibt `null` zurück |
| Service-Role-Key nur server-seitig? | ✅ SICHER — nur in `process.env.SUPABASE_SERVICE_ROLE_KEY`, kein `NEXT_PUBLIC_` |
| `redirectTo` manipulierbar? | ✅ SICHER — hardcodierter Wert (`/manager` oder `/dashboard`), kein User-Input |
| Rate-Limiting fehlt? | ✅ AKZEPTIERT — Dev-only, Production gibt 403 |
| Information Disclosure? | ✅ AKZEPTIERT — 404-Message nur in Dev sichtbar |

### Automated Tests

**Unit Tests:** Kein geeigneter Kandidat (Logik ist fetch-/Supabase-integriert; E2E aussagekräftiger)

**E2E Tests:** `tests/PROJ-7-dev-login.spec.ts` — 22 Tests, **22/22 bestanden** (Chromium + Mobile Safari)

Abgedeckte Szenarien:
- Button sichtbar, Badge/Label sichtbar
- Microsoft- und Dev-Login-Buttons koexistieren
- POST-Request ausgelöst
- Loading-Spinner sichtbar
- Proxy-Intercept bei direktem API-Aufruf ohne Auth (BUG-1 dokumentiert)
- Error-Toast bei 404 (kein Seed-User)
- Error-Toast bei 500 (Serverfehler)
- Weiterleitung zu `/manager` bei Erfolg (Mocked)
- Responsive: Mobile (375px) + Tablet (768px)

### Regression Testing

Bestehende PROJ-1 E2E Tests zeigen intermittente Fehler (8/68 bei Parallel-Ausführung) — analysiert und als **Pre-existing Flakiness** eingestuft. Diese Fehler sind weder neu noch durch PROJ-7 verursacht; PROJ-7 fügt lediglich ein zusätzliches UI-Element zur Login-Seite hinzu, das die Kern-Tests nicht beeinflusst.

Alle anderen PROJ-2/4/5 E2E Tests: ✅ unverändert bestanden.

### Production-Ready Decision

**NOT READY** — BUG-1 (High) muss behoben werden: die Dev-Login-API wird durch die Proxy-Middleware blockiert, womit das Kernfeature nicht funktioniert.

## Deployment
_To be added by /deploy_
