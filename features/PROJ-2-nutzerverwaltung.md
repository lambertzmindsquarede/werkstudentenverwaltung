# PROJ-2: Nutzerverwaltung

## Status: In Progress
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Dependencies
- Requires: PROJ-1 (Authentication) – für geschützte Routen und Rollenmodell

## User Stories
- Als Manager möchte ich alle Werkstudenten in meinem Team sehen, damit ich einen Überblick habe, wer aktiv ist.
- Als Manager möchte ich einem neu angemeldeten Nutzer die Rolle „Werkstudent" zuweisen, damit er die App nutzen kann.
- Als Manager möchte ich das maximale Wochenstundenlimit eines Werkstudenten festlegen (Standard: 20h), damit die App bei Überschreitung warnen kann.
- Als Manager möchte ich einen Werkstudenten deaktivieren, wenn er das Unternehmen verlässt, damit er keinen Zugang mehr hat und nicht mehr in der Kalenderansicht erscheint.
- Als Werkstudent möchte ich mein eigenes Profil (Name, Avatar) sehen, damit ich weiß, mit welchem Konto ich angemeldet bin.

## Acceptance Criteria
- [ ] Manager sieht eine Liste aller Werkstudenten mit Name, E-Mail, Wochenstundenlimit und Status (aktiv/inaktiv)
- [ ] Manager kann Nutzern die Rolle `werkstudent` oder `manager` zuweisen
- [ ] Manager kann das Wochenstundenlimit pro Werkstudent setzen (1–40h, Standard: 20h)
- [ ] Manager kann einen Werkstudenten deaktivieren (Status: inaktiv); Login wird dadurch blockiert
- [ ] Inaktive Werkstudenten erscheinen nicht in der Kalenderansicht
- [ ] Werkstudenten können ihr eigenes Profil lesen, aber nicht bearbeiten (Name kommt aus Azure AD)
- [ ] Neu angelegte Profile ohne Rolle sehen eine Wartepage bis zur Rollenfreischaltung

## Edge Cases
- Was passiert, wenn der einzige Manager deaktiviert wird? → Deaktivierung von Accounts mit Manager-Rolle nur möglich, wenn mind. ein anderer Manager existiert
- Was passiert, wenn ein Werkstudent sich erneut per SSO anmeldet, nachdem er deaktiviert wurde? → Weiterleitung zur "Konto deaktiviert"-Seite, kein Zugang zur App
- Was passiert, wenn der Azure-Name eines Nutzers sich ändert? → Beim nächsten Login wird der Anzeigename aus Azure AD aktualisiert

## Technical Requirements
- **Datenbankstruktur:** Tabelle `profiles` mit Feldern: `id`, `email`, `display_name`, `role`, `weekly_hour_limit`, `is_active`, `created_at`
- **RLS:** Nur Manager dürfen alle Profile lesen und schreiben; Werkstudenten nur ihr eigenes
- **Security:** Keine direkte Manipulation der eigenen Rolle durch den Nutzer möglich

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Onboarding-Flow (wichtig)

Ein neuer Werkstudent kann **nicht manuell angelegt** werden. Der Prozess läuft immer so:

```
1. Werkstudent meldet sich erstmalig per Azure AD SSO an
         ↓
2. /auth/callback legt automatisch ein Profil an (kein role, is_active = true)
         ↓
3. Werkstudent landet auf /pending ("Warte auf Freischaltung")
         ↓
4. Manager sieht den neuen Nutzer in /manager/users (Status: "Ausstehend")
         ↓
5. Manager weist Rolle "werkstudent" zu und setzt Wochenstundenlimit
         ↓
6. Werkstudent kann die App jetzt vollständig nutzen
```

### Datenbankänderungen

Die bestehende `profiles`-Tabelle (PROJ-1) bekommt zwei neue Spalten via Migration:

| Feld | Typ | Standard | Bedeutung |
|---|---|---|---|
| `weekly_hour_limit` | Ganzzahl | 20 | Max. Stunden/Woche (1–40) |
| `is_active` | Boolean | true | Aktiv = Zugang erlaubt |

RLS-Erweiterung: Manager dürfen alle Profile auch **schreiben** (bisher nur lesen). Werkstudenten bleiben auf ihr eigenes Profil beschränkt.

### Komponenten-Struktur

```
/manager/users                     ← Nutzerverwaltung (nur Manager)
  └── UserManagementPage
      ├── PageHeader               (Titel + Anzahl aktiver Nutzer)
      ├── UserFilterBar            (Filter: Aktiv / Inaktiv / Ausstehend, Rolle)
      └── UserTable
          └── UserRow (pro Nutzer)
              ├── Avatar + Name + E-Mail
              ├── StatusBadge      ("Aktiv" / "Inaktiv" / "Ausstehend")
              ├── RoleBadge        (Werkstudent / Manager / —)
              ├── WeeklyHoursDisplay (z.B. "20h/Woche")
              ├── ActiveToggle     (Ein/Aus-Schalter; nur bei Nutzern mit Rolle)
              └── EditButton       → öffnet EditUserDialog

EditUserDialog                     (Overlay-Formular)
  ├── RoleSelect    (Werkstudent / Manager)
  ├── HourLimitInput (1–40, Standard: 20)
  └── Speichern-Button

/dashboard/profile                 ← Eigenes Profil (nur Werkstudenten)
  └── ProfilePage
      └── ProfileCard
          ├── Avatar + Name + E-Mail (aus Azure AD, read-only)
          ├── RoleBadge
          └── WeeklyHourLimit (Anzeige, nicht editierbar)

/deactivated                       ← Konto gesperrt (öffentliche Seite)
  └── DeactivatedPage
      └── Hinweistext + Abmelden-Button
```

### Status-Übersicht in der Nutzerliste

| Status | Bedeutung | Anzeige |
|---|---|---|
| Ausstehend | Profil existiert, keine Rolle | gelbes Badge, Toggle deaktiviert |
| Aktiv | Hat Rolle + is_active = true | grünes Badge |
| Inaktiv | is_active = false | rotes Badge, Toggle aus |

### Technische Entscheidungen

**Server Actions statt API-Routen:** Formulare (Rolle, Limit, Deaktivierung) nutzen Next.js Server Actions — kein separater API-Endpunkt nötig. Typ-sicher, weniger Boilerplate.

**`is_active`-Prüfung im bestehenden Proxy:** `src/proxy.ts` wird erweitert — nach Session-Check wird `is_active` geprüft. Bei `false` → Weiterleitung zu `/deactivated`. Kein deaktivierter Nutzer kann die App erreichen.

**"Letzter Manager"-Schutz:** Vor Deaktivierung oder Rollenwechsel eines Managers zählt die Server Action aktive Manager. Bei ≤1 wird die Aktion abgelehnt mit erklärender Fehlermeldung.

**Revalidierung:** Nach jeder Änderung wird die Nutzerliste sofort aktualisiert — keine manuelle Seitenaktualisierung.

**Keine neuen Pakete nötig:** Table, Dialog, Select, Switch, Badge, Card, Avatar — alles aus PROJ-1 bereits installiert.

## Implementation Notes (Frontend)

**Gebaut am:** 2026-04-28

### Neue Seiten
- `/manager/users` – Nutzerverwaltung (Client Component): Tabelle aller Profile mit StatusBadge, RoleBadge, Switch für is_active, EditButton
- `/dashboard/profile` – Eigenes Profil (read-only, Client Component): Avatar, Name, E-Mail, Rolle, Wochenstundenlimit
- `/deactivated` – "Konto deaktiviert"-Seite für gesperrte Nutzer

### Geänderte Dateien
- `src/lib/database.types.ts` – `weekly_hour_limit` und `is_active` zu Profile-Typen hinzugefügt
- `src/proxy.ts` – `is_active`-Prüfung ergänzt: deaktivierte Nutzer werden zu `/deactivated` weitergeleitet
- `src/app/manager/page.tsx` – Nav-Leiste mit Link zu `/manager/users` ergänzt
- `src/app/dashboard/page.tsx` – Nav-Leiste mit Link zu `/dashboard/profile` ergänzt
- `src/app/layout.tsx` – `<Toaster />` von Sonner global eingebunden

### Server Actions
- `src/app/manager/users/actions.ts` – `updateUserProfile()`: Rolle, Wochenstundenlimit und is_active; inkl. Letzter-Manager-Schutz

### Abweichungen vom Tech Design
- Keine: alle Komponenten laut Spec gebaut

## Implementation Notes (Backend)

**Gebaut am:** 2026-04-28

### Datenbankmigrationen
- `20260428070423` – `create_profiles_table` (PROJ-1): Grundtabelle mit `id`, `email`, `full_name`, `role`, `created_at`, `updated_at`
- `add_user_management_fields` (PROJ-2): Neue Spalten `weekly_hour_limit INTEGER NOT NULL DEFAULT 20` (CHECK 1–40) und `is_active BOOLEAN NOT NULL DEFAULT true`

### RLS-Policies (profiles)
- `Users can read own profile` – SELECT für eigene Zeile (bereits aus PROJ-1)
- `Users can insert own profile` – INSERT für eigene Zeile (bereits aus PROJ-1)
- `Managers can read all profiles` – SELECT für alle Profile wenn Rolle = Manager (bereits aus PROJ-1)
- `Managers can update all profiles` – UPDATE für alle Profile wenn Rolle = Manager (NEU)
- `Users can update own profile` – UPDATE für eigene Zeile (NEU; für zukünftigen Azure-AD-Namens-Sync)

### Server Action
- `src/app/manager/users/actions.ts` – `updateUserProfile()`: vollständig mit Auth-Check, Manager-Prüfung, Letzter-Manager-Schutz und `revalidatePath`

### E2E-Tests
- `tests/PROJ-2-nutzerverwaltung.spec.ts`: 6 Playwright-Tests (Route-Schutz für `/manager/users`, `/deactivated`, `/pending`, `/dashboard/profile`, Responsiveness)

### Abweichungen vom Tech Design
- Keine

## QA Test Results

**Tested:** 2026-04-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Manager sieht Liste aller Werkstudenten (Name, E-Mail, Limit, Status)
- [x] `/manager/users` rendert Tabelle mit allen Spalten (Code-Review bestätigt)
- [x] StatusBadge zeigt korrekt Ausstehend / Aktiv / Inaktiv
- [x] WeeklyHoursDisplay zeigt `{n}h` (Fallback: 20h)
- [x] Route-Schutz: Unauthentifizierte Nutzer werden zu `/login` weitergeleitet (E2E)

#### AC-2: Manager kann Rollen zuweisen (werkstudent / manager)
- [x] EditUserDialog mit RoleSelect (keine Rolle / Werkstudent / Manager) vorhanden
- [x] Server Action prüft Manager-Rolle des Aufrufers vor der Änderung
- [x] RLS-Policy `Managers can update all profiles` verhindert direkten DB-Zugriff durch Werkstudenten
- [ ] Hinweis: Vollständiger E2E-Test (mit Login) nicht möglich wegen Azure AD SSO (kein Test-IdP vorhanden)

#### AC-3: Manager kann Wochenstundenlimit setzen (1–40h, Standard: 20h)
- [x] HourLimitInput im EditDialog (type=number, min=1, max=40)
- [x] Client-seitige Validierung bei ungültigem Wert mit Toast-Fehlermeldung
- [x] DB-CHECK-Constraint als zusätzliche Sicherheitsebene laut Migration
- [x] Standard-Anzeige 20h bei NULL-Wert korrekt

#### AC-4: Manager kann Werkstudenten deaktivieren; Login wird blockiert
- [x] Switch-Toggle in Nutzertabelle für Nutzer mit Rolle
- [x] Switch deaktiviert für Nutzer ohne Rolle (Ausstehend-Status)
- [x] Server Action setzt `is_active = false`
- [x] `proxy.ts` leitet deaktivierte Nutzer zu `/deactivated` weiter
- [x] Deaktivierte Nutzer können keine anderen Seiten erreichen

#### AC-5: Inaktive Werkstudenten erscheinen nicht in Kalenderansicht
- [ ] NICHT TESTBAR: PROJ-5 (Manager-Kalenderansicht) ist noch nicht gebaut (Status: Planned)
- [x] `is_active`-Feld vorhanden und über RLS/Server Action steuerbar – AC kann implementiert werden sobald PROJ-5 gebaut wird

#### AC-6: Werkstudenten können Profil lesen, aber nicht bearbeiten
- [x] `/dashboard/profile` rendert Avatar, Name, E-Mail, Rolle, Wochenstundenlimit
- [x] Kein Edit-Button, kein Formular – alles read-only
- [x] Seite ist nur für Werkstudenten zugänglich (Proxy leitet Manager weg)
- [x] Route-Schutz: Unauthentifizierte Nutzer werden zu `/login` weitergeleitet (E2E)

#### AC-7: Neu angelegte Profile ohne Rolle sehen Wartepage
- [x] `/pending`-Seite mit Hinweistext und Abmelden-Button vorhanden
- [x] Proxy leitet Nutzer ohne Rolle zu `/pending` weiter
- [x] Route-Schutz: Unauthentifizierte Nutzer werden zu `/login` weitergeleitet (E2E)
- [x] Nutzer mit Rolle werden von `/pending` zu ihrem Dashboard weitergeleitet

### Edge Cases Status

#### EC-1: Letzter Manager darf nicht deaktiviert werden
- [x] Server Action zählt aktive Manager (exkl. Ziel-Nutzer) vor Deaktivierung/Rollenwechsel
- [x] Fehler "Mindestens ein aktiver Manager muss verbleiben." wird zurückgegeben wenn count = 0
- [x] Schutz greift sowohl bei `is_active = false` als auch bei Rollenwechsel weg von Manager

#### EC-2: Deaktivierter Nutzer meldet sich erneut per SSO an
- [x] Proxy prüft `is_active` nach der Session-Prüfung
- [x] Deaktivierte Nutzer werden zu `/deactivated` weitergeleitet
- [ ] BUG-3: `is_active = null` wird als aktiv behandelt (Medium)

#### EC-3: Azure-Name ändert sich nach erstem Login
- [x] `/auth/callback` verwendet `upsert` mit `onConflict: 'id'` — aktualisiert `email` und `full_name` bei jedem Login
- [ ] BUG-4: Wenn Azure AD kein `full_name`/`name`-Metadata liefert, wird `full_name` zu `null` überschrieben (Low)

### Security Audit Results
- [x] Authentifizierung: Alle geschützten Routen leiten zu `/login` weiter (E2E verifiziert)
- [x] Autorisierung: Werkstudenten haben keinen Zugriff auf `/manager/*` (Proxy-Prüfung + RLS)
- [x] Server Action: Manager-Prüfung vor jeder Änderung (kein Werkstudent kann Rollen ändern)
- [x] XSS: Kein `dangerouslySetInnerHTML`, React escaped alle User-Daten automatisch
- [x] CSRF: Next.js Server Actions haben eingebauten CSRF-Schutz
- [x] Letzter-Manager-Schutz: Verhindert versehentliche Aussperrung aller Manager
- [x] Input-Validierung: Stundenlimit wird client-seitig und per DB-CHECK validiert
- [ ] BUG-3: `is_active = null` in `proxy.ts` wird als aktiv behandelt (Defense-in-Depth-Problem)

### Bugs Found

#### BUG-1: Vitest-Konfiguration inkludierte Playwright-Testdateien — WÄHREND QA BEHOBEN
- **Severity:** High (behoben)
- **Steps to Reproduce:**
  1. `npm test` ausführen
  2. Fehlermeldung: "Playwright Test did not expect test() to be called here"
- **Root Cause:** `vitest.config.ts` hatte kein `include`-Pattern, dadurch wurden `tests/*.spec.ts` (Playwright-Dateien) vom Vitest-Runner mitgeführt
- **Fix:** `include: ['src/**/*.{test,spec}.{ts,tsx}']` und `exclude: ['tests/**']` in `vitest.config.ts` hinzugefügt

#### BUG-2: Mobile Safari (WebKit) Browser-Binaries nicht installiert
- **Severity:** Medium
- **Steps to Reproduce:**
  1. `npm run test:e2e` ausführen
  2. Alle 12 `[Mobile Safari]`-Tests schlagen fehl mit "Executable doesn't exist"
- **Expected:** Alle 24 Tests (Chromium + Mobile Safari) laufen durch
- **Actual:** 12 Chromium-Tests bestehen, 12 Mobile Safari-Tests schlagen fehl
- **Fix:** `npx playwright install webkit` ausführen (einmalig, ~100MB)
- **Priority:** Fix before deployment

#### BUG-3: `is_active = null` wird in `proxy.ts` als aktiv behandelt
- **Severity:** Medium (Security)
- **Location:** `src/proxy.ts:70`
- **Steps to Reproduce:**
  1. `is_active` eines Nutzers direkt in der Datenbank auf `null` setzen
  2. Nutzer meldet sich an → hat vollen Zugang zur App
- **Expected:** Nutzer ohne explizit gesetztes `is_active = true` sollten blockiert werden
- **Actual:** `profile?.is_active !== false` → `null !== false` → Nutzer wird als aktiv behandelt
- **Note:** DB-Migration setzt `NOT NULL DEFAULT true`, daher nur über direkten DB-Eingriff ausnutzbar
- **Fix:** Änderung zu `profile?.is_active === true` in `proxy.ts:70`
- **Priority:** Fix before deployment

#### BUG-4: Azure AD null-Metadata überschreibt gespeicherten Namen
- **Severity:** Low
- **Location:** `src/app/auth/callback/route.ts:46`
- **Steps to Reproduce:**
  1. Nutzer hat gespeicherten Namen in der DB
  2. Login, bei dem Azure AD kein `full_name`/`name` in `user_metadata` liefert
  3. `full_name` wird zu `null` überschrieben
- **Expected:** Gespeicherter Name bleibt erhalten wenn Azure AD kein Metadata liefert
- **Actual:** Upsert setzt `full_name = null`
- **Fix:** Upsert-Object um `...(full_name && { full_name })` ergänzen (nur aktualisieren wenn vorhanden)
- **Priority:** Fix in next sprint

#### BUG-5: Rollenbadge auf Profilseite zeigt immer "Werkstudent"
- **Severity:** Low
- **Location:** `src/app/dashboard/profile/page.tsx:139`
- **Steps to Reproduce:**
  1. Profilseite rendern mit einem Nutzer, der Rolle "manager" hat
  2. Badge zeigt "Werkstudent" (obwohl Manager durch Proxy weitergeleitet werden, ist der Code logisch falsch)
- **Expected:** Badge zeigt tatsächliche Rolle des Nutzers
- **Actual:** Immer "Werkstudent" angezeigt (Hardcoded-String statt `profile?.role`)
- **Priority:** Fix in next sprint (kein Produktionsrisiko wegen Proxy-Redirect)

#### BUG-6: Filterkombi "Ausstehend" + Rolle ergibt leere Liste ohne Erklärung
- **Severity:** Low (UX)
- **Steps to Reproduce:**
  1. Status-Filter auf "Ausstehend" setzen
  2. Rollenfilter auf "Werkstudent" oder "Manager" setzen
  3. Tabelle zeigt "Keine Nutzer gefunden."
- **Expected:** Hinweistext erklärt warum die Filterkombi keine Ergebnisse liefert (ausstehende Nutzer haben keine Rolle)
- **Actual:** Generische Leerstate-Meldung ohne Kontext
- **Priority:** Nice to have

### Automated Test Results

**Vitest (Unit Tests):** 14/14 bestanden
- `src/app/manager/users/users.test.ts` — Filter-Logik und `getInitials`-Funktion

**Playwright (E2E Tests, Chromium):** 24/24 bestanden
- `tests/PROJ-1-authentication.spec.ts` — 18 Tests (Route-Schutz, Login-UI, Responsiveness)
- `tests/PROJ-2-nutzerverwaltung.spec.ts` — 6 Tests (Route-Schutz für alle PROJ-2-Seiten)

**Playwright (E2E Tests, Mobile Safari):** 0/24 bestanden (Browser nicht installiert — BUG-2)

### Summary
- **Acceptance Criteria:** 6/7 vollständig testbar (AC-5 abhängig von PROJ-5, noch nicht gebaut)
- **Bugs Found:** 6 gesamt (1 High behoben, 2 Medium, 3 Low)
- **Security:** Grundsätzlich solide; ein Defense-in-Depth-Problem (BUG-3) vorhanden
- **Production Ready:** NEIN — BUG-2 (Mobile Safari) und BUG-3 (is_active null) müssen vor Deployment behoben werden
- **Recommendation:** BUG-2 und BUG-3 beheben, dann `/qa` erneut ausführen

## Deployment
_To be added by /deploy_
