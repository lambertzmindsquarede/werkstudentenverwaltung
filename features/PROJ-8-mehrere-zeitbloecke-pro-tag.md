# PROJ-8: Mehrere Zeitblöcke pro Tag

## Status: In Progress
**Created:** 2026-04-29
**Last Updated:** 2026-04-29

## Dependencies
- Requires: PROJ-1 (Authentication) – Werkstudent muss eingeloggt sein
- Requires: PROJ-3 (Wochenplanung) – Datenbankstruktur `planned_entries` wird erweitert
- Requires: PROJ-4 (Tages-Zeiterfassung) – Datenbankstruktur `actual_entries` wird erweitert; Stempel-Logik wird angepasst

## Scope
Diese Feature ersetzt die bisherige 1-Block-Einschränkung in Wochenplanung (PROJ-3) und Zeiterfassung (PROJ-4). Werkstudenten können pro Tag bis zu **3 Zeitblöcke** pflegen – sowohl als Planung als auch als tatsächliche Ist-Zeiten. Die Tagessumme ergibt sich als Summe aller Blöcke.

## User Stories
- Als Werkstudent möchte ich pro Tag mehrere Zeitblöcke in meinem Wochenplan eingeben können (z.B. 09–12 Uhr und 14–17 Uhr), damit ich Unterbrechungen und Pausen korrekt abbilden kann.
- Als Werkstudent möchte ich mehrfach täglich ein- und ausstempeln können, damit Vormittags- und Nachmittagsarbeit separat erfasst werden.
- Als Werkstudent möchte ich die Gesamtarbeitszeit des Tages als Summe aller meiner Zeitblöcke sehen, damit ich mein Stundenkonto im Blick behalte.
- Als Werkstudent möchte ich einzelne Zeitblöcke nachträglich bearbeiten oder löschen können, damit ich Tippfehler korrigieren kann.
- Als Manager möchte ich alle Zeitblöcke eines Werkstudenten pro Tag in der Kalenderansicht sehen, damit ich die tatsächliche Verfügbarkeit genau nachvollziehen kann.
- Als Werkstudent möchte ich eine Warnung sehen, wenn sich zwei Zeitblöcke zeitlich überschneiden, damit ich Eingabefehler sofort erkennen kann.

## Acceptance Criteria

### Wochenplanung (Planung)
- [ ] Pro Tag können bis zu 3 geplante Zeitblöcke (je Von–Bis) erfasst werden
- [ ] Ein weiterer Block kann nur hinzugefügt werden, wenn der vorherige Block vollständig ist (Start + Ende)
- [ ] Die Reihenfolge der Blöcke ist chronologisch aufsteigend nach Startzeit
- [ ] Zeitblöcke dürfen sich nicht überschneiden – bei Überschneidung erscheint ein Validierungsfehler und Speichern ist blockiert
- [ ] Die Tagessumme (Stunden) wird als Summe aller Block-Dauern berechnet und angezeigt
- [ ] Die Wochensumme addiert alle Tagessummen korrekt
- [ ] Einzelne Blöcke können entfernt werden (Minus-Button pro Block)
- [ ] Bei weniger als 3 Blöcken wird ein „+ Block hinzufügen"-Button angezeigt
- [ ] Bestehende Pläne mit nur einem Block bleiben gültig und werden korrekt angezeigt

### Zeiterfassung (Ist)
- [ ] Einstempeln startet einen neuen Zeitblock (nur möglich, wenn kein offener Block vorhanden und weniger als 3 Blöcke heute)
- [ ] Ausstempeln schließt den aktuell offenen Block
- [ ] Nach dem Ausstempeln kann erneut eingestempelt werden (neuer Block), solange weniger als 3 Blöcke vorhanden
- [ ] Bei 3 vollständigen Blöcken ist der Einstempeln-Button deaktiviert mit Hinweis „Maximum 3 Blöcke pro Tag erreicht"
- [ ] Die Tagessumme der Ist-Stunden ist die Summe aller vollständigen Blöcke des Tages
- [ ] Vergangene Blöcke können einzeln manuell bearbeitet werden (Start + Ende)
- [ ] Einzelne vergangene Blöcke können gelöscht werden
- [ ] Der OffenerEintragBanner zeigt an, wenn ein offener Block (ohne Endzeit) aus einem vergangenen Tag vorliegt

## Edge Cases
- Was passiert, wenn Blöcke sich überschneiden? → Validierungsfehler mit Hinweis auf den überschneidenden Block; Speichern blockiert
- Was passiert, wenn bereits 3 Blöcke vorhanden sind und der User erneut einstempeln will? → Einstempeln-Button deaktiviert mit Meldung „Maximum 3 Blöcke pro Tag erreicht"
- Was passiert, wenn ein Block noch offen ist (Einstempel ohne Ausstempel) und der User einen weiteren Block anlegen will? → Einstempeln-Button zeigt stattdessen „Ausstempeln"; kein zweiter offener Block gleichzeitig möglich
- Was passiert mit Start > Ende bei manueller Eingabe? → Validierungsfehler, Speichern blockiert
- Was passiert mit einem Block, der über Mitternacht geht (z.B. 23:00–01:00)? → Nicht erlaubt; Ende muss am gleichen Tag liegen (Endzeit > Startzeit)
- Was passiert, wenn der mittlere von 3 Blöcken gelöscht wird? → Lücke ist erlaubt; verbleibende Blöcke werden weiterhin einzeln angezeigt
- Was passiert mit bestehenden DB-Einträgen (1 Block pro Tag)? → Datenbankmigration fügt `block_index = 1` für alle bestehenden Einträge ein; keine Datenverlust

## Technical Requirements
- **DB-Migration `planned_entries`:** UNIQUE Constraint `(user_id, date)` entfernen; neue Spalte `block_index` (integer, 1–3) hinzufügen; neuer UNIQUE Constraint auf `(user_id, date, block_index)`; CHECK `block_index BETWEEN 1 AND 3`
- **DB-Migration `actual_entries`:** UNIQUE Constraint `(user_id, date)` entfernen; neue Spalte `block_index` (integer, 1–3) hinzufügen; neuer UNIQUE Constraint auf `(user_id, date, block_index)`; CHECK `block_index BETWEEN 1 AND 3`; bestehender CHECK `planned_end > planned_start` bleibt erhalten
- **Max-3-Enforcement:** Auf Applikationsebene (vor dem Einfügen prüfen: Anzahl Blöcke < 3); zusätzlich auf DB-Ebene via UNIQUE Constraint (kein block_index 4+ möglich)
- **Überschneidungsvalidierung:** Clientseitig in Echtzeit; serverseitig in Server Action / API-Route vor dem Speichern
- **RLS:** Bestehende Policies bleiben unverändert (Werkstudenten eigene Einträge; Manager lesen alle)
- **Berechnung:** Stundensummen weiterhin clientseitig; Summe aller vollständigen Blöcke des Tages

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Datenbankstruktur

**`planned_entries` – Änderungen:**
- Neue Spalte `block_index` (integer, 1–3): Blocknummer innerhalb des Tages
- UNIQUE Constraint `(user_id, date)` wird entfernt
- Neuer UNIQUE Constraint `(user_id, date, block_index)`
- CHECK: `block_index BETWEEN 1 AND 3`
- Datenmigration: alle bestehenden Zeilen erhalten `block_index = 1`

**`actual_entries` – identische Änderungen:**
- Neue Spalte `block_index` (integer, 1–3)
- UNIQUE Constraint `(user_id, date)` wird entfernt
- Neuer UNIQUE Constraint `(user_id, date, block_index)`
- CHECK: `block_index BETWEEN 1 AND 3`
- Datenmigration: alle bestehenden Zeilen erhalten `block_index = 1`

### Komponentenstruktur

**Wochenplanung** (`WochenplanungClient.tsx` – stark erweitert):
```
WochenplanungClient
└── Pro Wochentag:
    ├── Tages-Label (Mo, Di, …)
    ├── "kein Arbeitstag" Checkbox
    └── Zeitblock-Liste (ersetzt die 2 bisherigen Inputs)
        ├── ZeitBlock-Zeile #1  [Von] [Bis] [Dauer] [– Button]
        ├── ZeitBlock-Zeile #2  [Von] [Bis] [Dauer] [– Button]
        └── [+ Block hinzufügen]  (nur sichtbar wenn < 3 Blöcke und letzter Block vollständig)
    └── Tagessumme = Summe aller Block-Dauern
└── Wochensummen-Card (Berechnungslogik auf Mehrblock-Summe umgestellt)
```

**Dashboard / Zeiterfassung** (`StempelCard.tsx` – komplett überarbeitet):
```
StempelCard
├── Heute-Blöcke Liste
│   └── Pro abgeschlossenem Block: [09:00 – 12:00] [3,0 Std] [Bearbeiten-Button]
├── Offener Block (falls aktiv): "Eingestempelt seit 14:00 Uhr"
└── Stempel-Button:
    - "Einstempeln"  (kein offener Block + < 3 Blöcke)
    - "Ausstempeln"  (offener Block vorhanden)
    - Deaktiviert + Hinweis  (3 vollständige Blöcke)
```

**Edit-Dialog** (`IstEintragEditDialog.tsx` – leicht erweitert):
- Bearbeitet einen einzelnen Block (Start + Ende)
- Wird pro Block-Zeile separat geöffnet
- Überschneidungs-Validierung gegen die anderen Blöcke des Tages

**Manager-Kalenderansicht** (minimal angepasst):
- `KalenderZelle`: zeigt weiterhin Gesamtstunden (Summe aller Blöcke)
- `ZellDetailDialog`: listet alle Blöcke des Tages einzeln mit Gesamtsumme

### API-Änderungen

**`POST /api/time-entries/stamp` (Einstempeln):**
1. Zähle heutige Blöcke des Users
2. Falls offener Block vorhanden → Fehler "Bitte zuerst ausstempeln"
3. Falls 3 vollständige Blöcke → Fehler "Maximum 3 Blöcke pro Tag erreicht"
4. Neuer Block mit `block_index = Anzahl + 1`

**`PATCH /api/time-entries/stamp` (Ausstempeln):**
- Logik unverändert: offenen Block (`is_complete = false`) finden und Endzeit setzen

**Server Action `saveWeekPlan`:**
- Neu: Delete alle Einträge der Woche → Insert alle Blöcke
- Serverseitige Validierung: Überschneidungscheck + max. 3 + Start < Ende

### Shared Utility

Neue Datei `src/lib/time-block-utils.ts` mit `validateBlocks()`:
- Prüft Start < Ende, keine Überschneidungen, max. 3 Blöcke
- Verwendet in: WochenplanungClient (Echtzeit), saveWeekPlan (Server), Stamp-API (Server), IstEintragEditDialog

### Tech-Entscheidungen

| Entscheidung | Ansatz | Begründung |
|---|---|---|
| Schema | `block_index` zu bestehenden Tabellen | RLS-Policies bleiben unverändert |
| Blocknummer beim Stempeln | `count + 1` | Einfach; max. 1 offener Block möglich |
| Neuindexierung bei Löschen | 1, 2, 3 lückenlos | UNIQUE Constraint erfordert lückenlose Nummern |
| Überschneidungscheck | Client + Server | Client: Sofort-Feedback; Server: Sicherheitsabsicherung |
| Wochenplanung speichern | Delete + Re-Insert | Atomarer Ansatz; Upsert bei flexiblen Blocklisten fehleranfällig |

### Keine neuen Pakete nötig
Alle Werkzeuge sind bereits installiert: Supabase, React state, bestehende shadcn/ui-Komponenten.

## Implementation Notes (Backend)

### What was built
- **`supabase/migrations/20260429_proj8_multi_block.sql`** (new): DB migration that adds `block_index` (integer, 1–3, NOT NULL) to both `planned_entries` and `actual_entries`, backfills existing rows with `block_index = 1`, drops the old `UNIQUE(user_id, date)` constraints, and adds new `UNIQUE(user_id, date, block_index)` + `CHECK(block_index BETWEEN 1 AND 3)` constraints.
- **`src/app/api/time-entries/stamp/stamp.test.ts`** (updated): Replaced single-entry duplicate guard tests with multi-block guard tests — open-block check, max-3 check, `nextBlockIndex` helper, multi-entry shape contract.
- All application-layer code (route.ts, actions.ts, time-block-utils.ts) was already updated by the frontend skill.

### DB migration checklist (manual step required)
Run the migration in the Supabase SQL Editor (or via `supabase db push` if local):
```
supabase/migrations/20260429_proj8_multi_block.sql
```

> **Note:** If the `block_index` column already exists on a table (e.g. from a previous manual migration), the `ADD COLUMN IF NOT EXISTS` guards make the script idempotent. The `DROP CONSTRAINT IF EXISTS` guards handle the same for the old unique constraint. Always verify constraint names in Supabase Dashboard → Table Editor → Constraints if you hit conflicts.

### Deviations from spec
- RLS policies were not changed (unchanged as per spec).

## Implementation Notes (Frontend)

### What was built
- **`src/lib/time-block-utils.ts`** (new): Shared `validateBlocks()`, `calcBlockHours()`, `timeToMinutes()` utilities used across client and server
- **`src/lib/database.types.ts`**: Added `block_index: number | null` to `actual_entries` and `planned_entries` types
- **`src/app/dashboard/wochenplanung/actions.ts`**: `DayEntry` type gains `block_index`; `saveWeekPlan` changed from upsert/delete-per-date to delete-all-then-insert; `loadWeekEntries` returns multiple rows per date ordered by `block_index`
- **`WochenplanungClient.tsx`**: State changed from `{start, end}` per day to `{blocks: TimeBlock[]}` per day; up to 3 blocks per day with `+`/`−` buttons; per-block validation errors; day total shown when >1 block
- **`src/app/api/time-entries/stamp/route.ts`**: POST now counts existing blocks, checks for open block, inserts with `block_index = count + 1`; PATCH unchanged
- **`src/app/dashboard/page.tsx`**: Today entries loaded as array (not single), ordered by `block_index`
- **`IstEintragEditDialog.tsx`**: Added `otherEntries` prop for overlap validation; added delete button with confirmation step
- **`StempelCard.tsx`**: Redesigned to show list of completed blocks each with edit button; open block indicator; smart stamp button (disabled at 3 blocks)
- **`DashboardContent.tsx`**: `initialTodayEntry` → `initialTodayEntries`; all state updates by entry `id`
- **`WochenIstübersicht.tsx`**: Groups entries by date; IST column shows "X Bl." summary for multiple blocks; "Blöcke" button opens day-detail dialog listing all blocks with individual edit/delete
- **`KalenderZelle.tsx`**: Props changed from single plan/actual to arrays; computes aggregate hours
- **`ZellDetailDialog.tsx`**: `SelectedCell` uses `plans[]` and `actuals[]`; lists each block individually
- **`KalenderGrid.tsx`**: Lookup maps changed to `Map<userId, Map<date, Entry[]>>`

### Deviations from spec
- DB migration (adding `block_index` column, updating UNIQUE constraints) is **not yet applied to Supabase** — must be done by `/backend`
- Existing data with `block_index = null` will still work (falls back to 1 in loadWeekEntries)

## QA Test Results

**QA Date:** 2026-04-29
**Tester:** /qa skill

### Automated Tests

| Suite | Result |
|-------|--------|
| Vitest unit tests (127 total) | ✅ All pass |
| Playwright E2E (18 pass, 16 skip*) | ✅ All pass / skip |

*Skipped tests require dev login (no seed user in CI); they self-skip gracefully.

**New tests added:**
- `src/lib/time-block-utils.test.ts` — 23 unit tests for `timeToMinutes`, `calcBlockHours`, `validateBlocks`
- `tests/PROJ-8-mehrere-zeitbloecke.spec.ts` — 17 E2E tests (auth protection, Wochenplanung UI, Stempelkarte)
- `tests/PROJ-4-zeiterfassung.spec.ts` — Fixed 4 tests: now correctly expect 401 (PROJ-8 route returns 401 directly, fixing old BUG-M1)

### Acceptance Criteria

#### Wochenplanung (Planung)
| AC | Status | Notes |
|----|--------|-------|
| Pro Tag bis zu 3 Zeitblöcke | ✅ Pass | Max 3 enforced via `day.blocks.length < 3` check |
| Neuer Block nur wenn vorheriger vollständig | ✅ Pass | `canAddBlock()` guards the `+` button |
| Reihenfolge chronologisch | ✅ Pass | Blocks sorted by `block_index` on load |
| Überschneidungsvalidierung + Speichern blockiert | ✅ Pass | Client-side realtime + server-side in `saveWeekPlan` |
| Tagessumme als Summe aller Blöcke | ✅ Pass | `calcDayHours()` sums all blocks |
| Wochensumme korrekt | ✅ Pass | `totalHours` sums all day totals |
| Einzelne Blöcke entfernen (Minus-Button) | ✅ Pass | Only shown when `day.blocks.length > 1` |
| `+ Block hinzufügen`-Button bei < 3 Blöcken | ✅ Pass | Hidden at 3 blocks |
| Bestehende 1-Block-Pläne bleiben gültig | ✅ Pass | `block_index ?? 1` fallback in `loadWeekEntries` |

#### Zeiterfassung (Ist)
| AC | Status | Notes |
|----|--------|-------|
| Einstempeln startet neuen Block | ✅ Pass | Route checks open block + count before inserting |
| Ausstempeln schließt offenen Block | ✅ Pass | PATCH route unchanged |
| Nach Ausstempeln erneut einstempeln möglich | ✅ Pass | Checked via `!openBlock && completedBlocks.length < 3` |
| Bei 3 Blöcken Einstempeln deaktiviert | ✅ Pass | `atMaxBlocks` disables button |
| Tagessumme Ist = Summe vollständiger Blöcke | ✅ Pass | `todayTotalHours` sums completed blocks |
| Vergangene Blöcke manuell bearbeiten | ✅ Pass | `IstEintragEditDialog` per Block |
| Einzelne vergangene Blöcke löschen | ✅ Pass | Löschen-Button mit Bestätigungsschritt |
| OffenerEintragBanner für offenen Block aus Vortag | ✅ Pass | `initialOpenEntry` shown in banner |

### Bugs Found

#### BUG-8-1: Validation error shown on wrong block (edge case)
- **Severity:** Low
- **Steps to reproduce:** Fill 3 complete blocks for one day → clear the end time of the middle block → observe overlap error
- **Expected:** Error indicator on the block that actually overlaps
- **Actual:** Error indicator on the middle (now-incomplete) block; the overlapping 3rd block shows no error
- **Root cause:** `validationErrors` index comes from `completedBlocks` (filtered array); UI display uses `day.blocks` index (unfiltered). Indices diverge when an intermediate block has only a start time set.
- **Impact:** Save button correctly remains disabled; only the visual error indicator is on the wrong block. Requires an unlikely manual sequence to trigger.
- **Workaround:** Clear or fix the incomplete block; the UI resolves correctly.

#### BUG-8-2: DB migration not yet applied (blocker for live deployment)
- **Severity:** Critical (deployment blocker, not a code bug)
- **Description:** `supabase/migrations/20260429_proj8_multi_block.sql` must be applied to the Supabase project before the feature functions. Without the migration, stamp POST fails (inserts `block_index` into non-existent column), and the old `UNIQUE(user_id, date)` constraint prevents multiple blocks.
- **Status:** Known/documented. Migration file is ready. Must be applied before deploy.
- **Fix:** Run the migration via Supabase SQL Editor or `supabase db push`.

#### BUG-8-3 (FIXED): PROJ-4 E2E tests expected 307, PROJ-8 route now returns 401
- **Severity:** Low (test regression, code behavior improved)
- **Description:** PROJ-8 route.ts returns 401 directly for unauthenticated API requests. The old behavior was a 307 middleware redirect (previously documented as BUG-M1 in PROJ-4). The 401 is the correct API behavior.
- **Status:** Fixed — PROJ-4 E2E tests updated to expect 401.

### Security Audit

| Check | Status |
|-------|--------|
| Stamp API returns 401 for unauthenticated requests | ✅ Pass |
| Server-side overlap validation in `saveWeekPlan` | ✅ Pass |
| Server-side max-block-count check in stamp route | ✅ Pass |
| RLS policies unchanged | ✅ Pass (per spec) |
| No hardcoded secrets | ✅ Pass |
| Input validation via Zod in `saveWeekPlan` | ✅ Pass |

### Production-Ready Decision

**NOT READY** — BUG-8-2 (DB migration not applied) is a deployment blocker. Once the migration is applied, no critical or high code bugs remain. The feature can be re-assessed after the migration is confirmed applied.

### Regression

No regressions found in PROJ-3, PROJ-4, PROJ-5. The stamp API auth behavior change (307→401) is an improvement, not a regression.

## Deployment
_To be added by /deploy_
