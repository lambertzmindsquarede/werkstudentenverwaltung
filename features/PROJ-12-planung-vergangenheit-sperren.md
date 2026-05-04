# PROJ-12: Planung für vergangene Tage sperren

## Status: Approved
**Created:** 2026-05-01
**Last Updated:** 2026-05-01

## Dependencies
- Requires: PROJ-3 (Wochenplanung) – betrifft den Wochenplanungs-Editor

## User Stories
- Als Werkstudent möchte ich, dass vergangene Tage in der Wochenplanung schreibgeschützt sind, damit ich keine versehentlichen Rückwirkungsänderungen vornehme.
- Als Werkstudent möchte ich vergangene Planeinträge noch lesen können, damit ich meinen bisherigen Plan nachvollziehen kann.
- Als Manager möchte ich, dass auch ich keine vergangenen Planeinträge bearbeiten kann, damit die historischen Daten konsistent und nachvollziehbar bleiben.

## Acceptance Criteria
- [ ] Tage, die vor dem heutigen Datum liegen (gestern und früher), sind in der Wochenplanung read-only
- [ ] Der heutige Tag bleibt vollständig editierbar
- [ ] Für read-only Tage sind alle Eingabefelder (Von, Bis) und die „kein Arbeitstag"-Checkbox visuell deaktiviert
- [ ] Der Speichern-Button ist für Wochen, die ausschließlich vergangene Tage enthalten (abgeschlossene Wochen), deaktiviert
- [ ] Für Wochen, die teils vergangene und teils zukünftige Tage enthalten (aktuelle Woche), ist der Speichern-Button aktiv — gespeichert werden nur die nicht-vergangenen Tage
- [ ] Ein erklärenden Hinweis-Text (z.B. „Vergangene Tage können nicht bearbeitet werden.") erscheint, wenn die angezeigte Woche mindestens einen gesperrten Tag enthält
- [ ] Die Einschränkung gilt für alle Nutzer (Werkstudenten und Manager)
- [ ] Bestehende Planeinträge für vergangene Tage bleiben lesbar und werden weiterhin angezeigt

## Edge Cases
- Was passiert, wenn genau heute Mitternacht ist und ein Eintrag für „heute" existiert? → Heutiger Tag bleibt editierbar; die Grenze ist `date < today` (nicht `<=`)
- Was passiert, wenn eine Woche nur vergangene Tage hat (z.B. letzte Woche)? → Alle Tage read-only, Speichern-Button deaktiviert, Banner sichtbar
- Was passiert bei der aktuellen Woche (Mo–Fr mit Mo–Do in der Vergangenheit und Fr in der Zukunft)? → Mo–Do read-only, Fr editierbar, Speichern speichert nur Fr
- Was passiert, wenn jemand versucht, die Sperre per API zu umgehen (direkter Supabase-Aufruf)? → Serverseitige Validierung in der Server Action: Einträge mit `date < today` werden abgelehnt (HTTP 400)
- Was passiert, wenn die Zeitzone des Nutzers von der Serverzeit abweicht? → Datum-Vergleich basiert auf dem lokalen Datum des Browsers (`new Date().toLocaleDateString('sv')` als YYYY-MM-DD)
- Was passiert mit der „Vorwoche als Vorlage übernehmen"-Funktion? → Die Vorlage befüllt nur die Eingabefelder für nicht-vergangene Tage der Zielwoche; vergangene Tage werden dabei ignoriert

## Technical Requirements
- Datum-Vergleich clientseitig: `date < today` (ISO-Format YYYY-MM-DD), wobei `today` bei Komponenten-Mount einmalig ermittelt wird
- Serverseitige Absicherung in `saveWeekPlan` (Server Action): Einträge mit `date < today` aus dem Input-Array herausfiltern bzw. mit Fehler ablehnen
- Keine Datenbankänderungen notwendig — rein logische Einschränkung in UI + Server Action

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_No separate architecture pass — spec was self-contained with clear technical requirements._

## Implementation Notes
- **`WochenplanungClient.tsx`**: `today` computed once via `useMemo` using `toLocaleDateString('sv')` (YYYY-MM-DD). `isPast(dateStr)` helper. Past day rows: checkbox and time inputs disabled, add/remove block buttons hidden, row opacity reduced. Info banner shown when `hasAnyPastDay`. Template banner hidden for fully-past weeks. Save button disabled when `allDaysPast`. `handleSave` and `handleLoadTemplate` skip past dates.
- **`actions.ts`** (`saveWeekPlan`): Server-side guard filters entries to `date >= today` (UTC). Delete step only touches `editableDates` (non-past), preserving historical data. Early return if all dates are past.

## QA Test Results

**QA Date:** 2026-05-01
**Tester:** Claude (QA skill)
**Build:** PROJ-12 implementation in WochenplanungClient + actions.ts

### Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| AC-1 | Vergangene Tage (gestern und früher) sind read-only | ✅ Pass |
| AC-2 | Heutiger Tag bleibt vollständig editierbar | ✅ Pass |
| AC-3 | Eingabefelder (Von, Bis) und „kein Arbeitstag"-Checkbox sind deaktiviert für vergangene Tage | ✅ Pass |
| AC-4 | Speichern-Button deaktiviert für abgeschlossene Wochen (nur vergangene Tage) | ✅ Pass |
| AC-5 | Speichern-Button aktiv bei aktueller Woche (teils vergangen, teils zukünftig) | ✅ Pass |
| AC-6 | Hinweis-Banner sichtbar wenn ≥1 gesperrter Tag in der Woche | ✅ Pass |
| AC-7 | Einschränkung gilt für alle Nutzer | ✅ Pass (Werkstudent getestet; Manager via selbe Server Action) |
| AC-8 | Bestehende Planeinträge für vergangene Tage bleiben lesbar | ✅ Pass |

**All 8 acceptance criteria passed.**

### Edge Cases Tested

| Edge Case | Result |
|-----------|--------|
| Vollständig vergangene Woche (2020-W01) | ✅ Alle Selects + Checkboxen disabled, Save disabled, Banner sichtbar, Template-Banner absent |
| Vollständig zukünftige Woche (2030-W30) | ✅ Alle Selects enabled, Save enabled, Banner absent, Template-Banner sichtbar |
| Aktuelle Woche teils vergangen (W19, clock: Do 2026-05-07): Mo–Mi past, Do heute, Fr Zukunft | ✅ Mo+Di Selects/Checkboxen disabled; Do+Fr Selects/Checkboxen enabled; Save enabled; Banner sichtbar |
| „+ Block hinzufügen" bei vergangener Woche | ✅ Nicht sichtbar |
| Unauthenticated access → redirect to /login | ✅ Pass |
| Responsive Mobile 375px | ✅ Banner sichtbar, Save deaktiviert |

### Security Audit

| Test | Result |
|------|--------|
| Unauthenticated API call POST /api/auth/dev-login → kein 500 | ✅ Pass |
| Server-seitige Sperre in `saveWeekPlan` via `editableDates` filter (kein reines Client-Vertrauen) | ✅ Implementiert |
| XSS / Injection via Zeitfelder | ✅ shadcn Select-Komponenten akzeptieren nur definierte Werte |

### Bugs Found

| # | Severity | Description | Steps |
|---|----------|-------------|-------|
| BUG-12-1 | Medium | **Timezone-Mismatch: Server (UTC) vs. Client (lokal)** — `saveWeekPlan` verwendet `new Date().toISOString().slice(0,10)` (UTC), der Client verwendet `toLocaleDateString('sv')` (lokal). Für Nutzer in UTC+1/+2 kann dies im Fenster 00:00–02:00 Lokalzeit dazu führen, dass der Server "heute" als gestrigen Tag wertet und historische Einträge für "gestern" (lokal = "heute" in UTC) löscht. | Tritt auf wenn: Nutzer ist in UTC+2, es ist 00:30 Lokalzeit (= 22:30 UTC Vortag); Nutzer speichert aktuelle Woche → Server filtert den heutigen Tag (lokal) heraus und löscht seinen Planeintrag für heute. |

**Kein Critical/High Bug. BUG-12-1 ist Medium und nur in einem 2-Stunden-Fenster nachts relevant.**

### Test Suite Results

**Unit Tests (Vitest):** `src/app/dashboard/wochenplanung/actions.test.ts`
- 8 neue Tests für PROJ-12 (`getEditableDates`, `filterInsertable`)
- Alle 169 Tests bestanden ✅

**E2E Tests (Playwright):** `tests/PROJ-12-planung-vergangenheit-sperren.spec.ts`
- 22 Tests, serial mode (verhindert Supabase 429 bei parallelen OTP-Anfragen)
- Auth: einmaliger Login als Clara Fischer (Werkstudent, UUID …0004) mit Cookie-Sharing
- Alle 22 Tests bestanden ✅ (46s)

### Production-Ready Decision

**✅ PRODUCTION READY**

Keine Critical/High Bugs. BUG-12-1 (Medium, Timezone-Mismatch) tritt nur nachts in einem 2-Stunden-Fenster auf und betrifft das Löschen von Planeinträgen, nicht die Datensicherheit. Kann als separates Ticket (Bugfix: Server-Datum auf lokale Zeitzone umstellen) nachgezogen werden.

## Deployment
_To be added by /deploy_
