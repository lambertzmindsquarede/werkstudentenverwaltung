# PROJ-11: Dev-Login Werkstudenten Test-Accounts

## Status: Deployed
**Created:** 2026-04-30
**Last Updated:** 2026-05-05

## Dependencies
- Requires: PROJ-7 (Lokaler Dev-Login) — baut direkt auf der bestehenden Dev-Login-Infrastruktur auf; ersetzt/erweitert `DevLoginButton.tsx` und `/api/auth/dev-login`
- Requires: PROJ-1 (Authentication) — Session-Mechanismus muss für Werkstudenten-Rolle funktionieren
- Requires: PROJ-2 (Nutzerverwaltung) — `profiles`-Tabelle mit `role = 'werkstudent'` muss existieren

## Context / Motivation
PROJ-7 legt einen einzigen Dev-Admin-User an. Für das Testen von Werkstudenten-Features (Wochenplanung, Zeiterfassung, Stempelkarte) werden dedizierte Werkstudenten-Accounts mit unterschiedlichen Datenzuständen benötigt. Außerdem wird der bisherige Einzelbutton durch ein Dropdown ersetzt, das alle verfügbaren Dev-User auflistet.

## Scope
- **In Scope:** Dropdown-UI auf der Login-Seite, 3 Werkstudenten-Seed-Accounts mit Beispieldaten, erweiterter `/api/auth/dev-login`-Endpunkt (akzeptiert User-ID)
- **Out of Scope:** Produktiv-Login ohne Azure AD, UI zur Verwaltung lokaler Testdaten, automatisiertes Zurücksetzen der Testdaten

## User Stories
- Als Entwickler möchte ich aus einem Dropdown auswählen können, als welcher Dev-User ich mich einlogge, damit ich schnell zwischen Manager- und Werkstudenten-Perspektive wechseln kann.
- Als Entwickler möchte ich einen Werkstudenten-Account mit vollständiger Wochenplanung und abgeschlossenen Zeiteinträgen haben, damit ich die Wochenübersicht und Auswertungsfunktionen testen kann.
- Als Entwickler möchte ich einen Werkstudenten-Account mit laufendem Stempel haben, damit ich die Stempelkarte und laufende Zeiterfassung testen kann.
- Als Entwickler möchte ich einen leeren Werkstudenten-Account haben, damit ich die Erstkonfiguration und leere Zustände testen kann.
- Als Entwickler möchte ich, dass das Dropdown nur in lokalen Umgebungen sichtbar ist und dieselben Sicherheitsgarantien wie PROJ-7 gilt.

## Acceptance Criteria

### UI
- [ ] Das PROJ-7-Einzelbutton „Als Admin einloggen" wird durch ein Dropdown ersetzt, das alle Dev-User listet.
- [ ] Das Dropdown zeigt Name und Rolle jedes Eintrags (z.B. „Dev Admin (Manager)", „Anna Müller (Werkstudentin)").
- [ ] Ein separater Button „Als gewählten User einloggen" löst den Login für den im Dropdown selektierten User aus.
- [ ] Im Dropdown ist standardmäßig der Dev Admin (Manager) vorausgewählt — identisches Verhalten zu PROJ-7.
- [ ] Die Dev-Login-Sektion bleibt mit Amber-Badge „Dev only" gekennzeichnet.
- [ ] Im Production-Build ist das Dropdown nicht im DOM vorhanden (kein reines CSS-Hide).

### API
- [ ] `POST /api/auth/dev-login` akzeptiert optional einen `userId`-Parameter im Body.
- [ ] Ohne `userId` im Body verhält sich der Endpunkt wie bisher (wählt ersten aktiven Manager).
- [ ] Mit `userId` im Body wird genau dieser User eingeloggt, sofern er in `profiles` existiert und `is_active = true`.
- [ ] Unbekannte `userId` → HTTP 404 mit verständlichem Fehler-Toast.
- [ ] Alle PROJ-7-Sicherheitsgarantien bleiben erhalten (`NODE_ENV=development` + `DEV_LOGIN_ENABLED=true`).

### Seed-Daten (3 Werkstudenten)
- [ ] `docs/dev-seed.sql` enthält Einträge für alle drei Werkstudenten-Accounts.
- [ ] **Anna Müller** (`werkstudent`): Hat geplante Einträge für Mo–Fr der aktuellen Woche sowie abgeschlossene Ist-Einträge für Mo–Mi.
- [ ] **Ben Schneider** (`werkstudent`): Hat einen laufenden Stempel für heute (`actual_start` gesetzt, `actual_end` null, `is_complete = false`).
- [ ] **Clara Fischer** (`werkstudentin`): Keine `planned_entries`, keine `actual_entries` — frisches Konto.
- [ ] Das Seed-Script ist idempotent (`ON CONFLICT DO UPDATE/NOTHING`) und kann mehrfach ausgeführt werden.

## Edge Cases
- **Dev Admin im Dropdown fehlend in DB:** API antwortet mit 404, Frontend zeigt Toast „bitte Seed-Script ausführen (docs/dev-seed.sql)".
- **Werkstudent im Dropdown fehlt in DB:** Gleiche 404-Behandlung wie oben.
- **`userId` im Body ist kein gültiges UUID-Format:** API antwortet mit HTTP 400; kein Supabase-Aufruf.
- **`is_active = false` für gewählten User:** API antwortet mit 403 „Inaktiver User"; kein Login.
- **Mehrere Tabs gleichzeitig:** Jeder Tab-Login überschreibt die bestehende Session — kein Fehler, erwartetes Verhalten.
- **Seed-Daten mit relativen Datumsangaben:** `planned_entries` und `actual_entries` der Seed-User nutzen `CURRENT_DATE`-Ausdrücke in SQL, damit sie beim Ausführen immer auf die aktuelle Woche zeigen.
- **PROJ-7-E2E-Tests:** Bestehende Tests prüfen den Einzelbutton — nach dem Umbau auf Dropdown müssen sie angepasst werden (Scope von PROJ-11, nicht separat).

## Technical Requirements
- **Security:** Identische Doppelabsicherung wie PROJ-7 (`NODE_ENV` + `DEV_LOGIN_ENABLED`); `userId` wird niemals an den Client zurückgegeben.
- **Session-Kompatibilität:** Session-Cookie für Werkstudenten-User identisch zum Azure-AD-Flow; Weiterleitung nach `/dashboard` (nicht `/manager`).
- **Performance:** Dropdown lädt User-Liste clientseitig aus einem kleinen statischen Array (hartcodiert im Component); kein zusätzlicher API-Aufruf zum Befüllen.
- **Keine neuen npm-Pakete:** `shadcn/ui Select` ist bereits installiert.

## Vorgeschlagene UUID-Zuordnung
| User | UUID | Rolle |
|------|------|-------|
| Dev Admin | `00000000-0000-0000-0000-000000000001` | manager (PROJ-7, unverändert) |
| Anna Müller | `00000000-0000-0000-0000-000000000002` | werkstudent |
| Ben Schneider | `00000000-0000-0000-0000-000000000003` | werkstudent |
| Clara Fischer | `00000000-0000-0000-0000-000000000004` | werkstudent |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
Login Page
└── DevLoginSection  ← ersetzt DevLoginButton.tsx
    ├── Badge "Dev only"  (amber, unverändert)
    ├── Select (shadcn/ui — bereits installiert)
    │   ├── Option: "Dev Admin (Manager)"          [UUID …0001]
    │   ├── Option: "Anna Müller (Werkstudentin)"  [UUID …0002]
    │   ├── Option: "Ben Schneider (Werkstudent)"  [UUID …0003]
    │   └── Option: "Clara Fischer (Werkstudentin)" [UUID …0004]
    └── Button "Als gewählten User einloggen"
```

### Ablauflogik

```
Entwickler wählt User im Dropdown
        ↓
Klick auf Button
        ↓
POST /api/auth/dev-login  { userId: "…0003" }
        ↓
API: Sicherheitscheck (NODE_ENV + DEV_LOGIN_ENABLED)
API: Lookup userId in profiles (is_active=true)
API: Supabase Admin → Magic Link generieren
API: gibt { tokenHash, redirectTo } zurück
        ↓
Frontend: supabase.verifyOtp(tokenHash) → Session wird gesetzt
Frontend: window.location.href = redirectTo
        ↓
Werkstudent → /dashboard   |   Manager → /manager
```

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/DevLoginButton.tsx` | Komplett ersetzt durch Dropdown + Button |
| `src/app/api/auth/dev-login/route.ts` | `userId`-Parameter + 400/404/403 Error Handling |
| `docs/dev-seed.sql` | 3 neue Werkstudenten-Profile + Beispieldaten |

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **shadcn/ui Select** (bereits installiert) | Kein neues Paket, konsistent mit bestehender UI |
| **Statische User-Liste im Component** | Kein API-Aufruf nötig — die 4 UUIDs sind bekannt und fest |
| **Magic Link via API (nicht signInWithPassword)** | Kein Passwort im Client-Code; nutzt denselben sicheren Flow wie der bestehende Endpunkt |
| **CURRENT_DATE in SQL** | Seed-Daten zeigen immer auf aktuelle Woche — kein manuelles Aktualisieren |

### Keine neuen npm-Pakete erforderlich

## Implementation Notes

### Geänderte Dateien
- **`src/components/DevLoginButton.tsx`** — Komplett ersetzt: shadcn `Select` mit 4 Dev-User-Optionen + Button „Als gewählten User einloggen". Statische `DEV_USERS`-Liste mit festen UUIDs. Login-Flow über `/api/auth/dev-login` (Magic Link) statt `signInWithPassword`.
- **`src/app/api/auth/dev-login/route.ts`** — Akzeptiert optionalen `userId`-Parameter im Body. UUID-Format-Validierung (400), Not-found (404), Inaktiver User (403). Ohne `userId`: Fallback auf ersten aktiven Manager (PROJ-7-Kompatibilität).
- **`docs/dev-seed.sql`** — 4 Auth-User + Profile + planned_entries für Anna Mo–Fr + actual_entries für Anna Mo–Mi (abgeschlossen) + laufender Stempel für Ben. Alle Datumsangaben mit `CURRENT_DATE`-Ausdrücken. Idempotent via `ON CONFLICT`.

### Abweichungen vom Spec
- Keine

## QA Test Results

**QA Date:** 2026-05-05
**QA Engineer:** /qa skill
**Overall Result:** APPROVED — production-ready

### Acceptance Criteria

#### UI
| # | Criterion | Result |
|---|-----------|--------|
| 1 | PROJ-7 Einzelbutton ersetzt durch Dropdown mit allen Dev-Usern | ✅ Pass |
| 2 | Dropdown zeigt Name + Rolle jedes Eintrags | ✅ Pass |
| 3 | Button „Als gewählten User einloggen" löst Login aus | ✅ Pass |
| 4 | Dev Admin standardmäßig vorausgewählt | ✅ Pass |
| 5 | Amber-Badge „Dev only" sichtbar | ✅ Pass |
| 6 | Im Production-Build nicht im DOM (return null guard) | ✅ Pass (NEXT_PUBLIC_ env var baked at build time) |

#### API
| # | Criterion | Result |
|---|-----------|--------|
| 7 | POST /api/auth/dev-login akzeptiert optionalen userId-Parameter | ✅ Pass |
| 8 | Ohne userId → Fallback auf ersten aktiven Manager | ✅ Pass |
| 9 | Mit userId → genau dieser User eingeloggt | ✅ Pass |
| 10 | Unbekannte userId → HTTP 404 + Toast | ✅ Pass |
| 11 | PROJ-7-Sicherheitsgarantien erhalten (NODE_ENV + DEV_LOGIN_ENABLED) | ✅ Pass |

#### Seed-Daten
| # | Criterion | Result |
|---|-----------|--------|
| 12 | docs/dev-seed.sql vorhanden mit allen 3 Werkstudenten-Accounts | ✅ Pass |
| 13 | Anna Müller: planned_entries Mo–Fr + actual_entries Mo–Mi | ✅ Pass |
| 14 | Ben Schneider: laufender Stempel (actual_end null, is_complete false) | ✅ Pass |
| 15 | Clara Fischer: keine Einträge | ✅ Pass |
| 16 | Seed-Script idempotent (ON CONFLICT DO UPDATE/NOTHING) | ✅ Pass |

### Edge Cases
| Edge Case | Result |
|-----------|--------|
| User fehlt in DB → 404 + Toast mit Seed-Script-Hinweis | ✅ Pass |
| is_active=false → 403 + Inaktiver-User-Toast | ✅ Pass |
| Ungültiges UUID-Format → 400 (no Supabase call) | ✅ Pass (unit-tested) |
| PROJ-7-E2E-Tests auf neues Dropdown angepasst | ✅ Pass |
| Werkstudent → /dashboard Redirect | ✅ Pass |
| Manager → /manager Redirect | ✅ Pass |

### Cross-Browser & Responsive
| Environment | Result |
|-------------|--------|
| Chrome Desktop (1440px) | ✅ Pass |
| Safari Mobile (375px) | ✅ Pass |
| Tablet (768px) | ✅ Pass |

### Security Audit
- Doppelte Absicherung (NODE_ENV=development + DEV_LOGIN_ENABLED=true) auf API-Ebene ✅
- userId wird nie an den Client zurückgegeben ✅
- UUID-Format wird vor Supabase-Aufruf validiert (verhindert Injection) ✅
- NEXT_PUBLIC_DEV_LOGIN_ENABLED guard rendert null in Production (kein DOM-Element) ✅

### Bugs Found
| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | High | PROJ-7 E2E-Tests prüften alten Button-Text „Als Admin einloggen" → 20/22 Tests fehlgeschlagen | **Fixed** (Tests in diesem QA-Lauf aktualisiert) |
| 2 | Info | BUG-1 aus PROJ-7 (Proxy-Intercept) ist nicht mehr reproduzierbar — API antwortet jetzt direkt mit JSON | Resolved (Proxy-Verhalten geändert, Test angepasst) |

### Automated Tests Written
- **Unit:** `src/app/api/auth/dev-login/route.test.ts` — UUID-Validierungslogik (9 Test-Cases), alle ✅
- **E2E:** `tests/PROJ-11-dev-werkstudenten-testaccounts.spec.ts` — 11 Acceptance Criteria Tests (22 inkl. Browser-Varianten), alle ✅
- **E2E (aktualisiert):** `tests/PROJ-7-dev-login.spec.ts` — auf neues Dropdown-UI angepasst, alle 22 ✅

### Test Summary
- Unit tests: 235/235 ✅
- PROJ-7 E2E: 22/22 ✅ (aktualisiert)
- PROJ-11 E2E: 22/22 ✅
- Vitest + Playwright: alle grün

## Deployment
**Deployed:** 2026-05-05
**Branch:** main (commit `094c365`)
**Triggered by:** Push to main → Vercel auto-deploy
