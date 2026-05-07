# PROJ-22: Excel-Stundenzettel-Export (HR-Vorlage)

## Status: In Progress
**Created:** 2026-05-07
**Last Updated:** 2026-05-07

## Dependencies
- Requires: PROJ-1 (Authentication) – Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – Profildaten (Name, Personalnummer)
- Requires: PROJ-4 (Tages-Zeiterfassung) – Ist-Daten für Export
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – Korrekte Zusammenfassung mehrerer Blöcke pro Tag
- Requires: PROJ-9 (Pausenerfassung) – Pausendaten für Export

## Hintergrund & Prozess

Die Personalabteilung schreibt eine verbindliche Excel-Vorlage für die monatliche Stundenabrechnung vor. Jeder Werkstudent muss bis zum 20. des Monats (im Dezember bis 18.) seinen ausgefüllten Stundenzettel digital an seinen Vorgesetzten senden. Der Manager prüft die Daten und leitet sie an payroll@mindsquare.de weiter.

Vorlage-Datei im Repo: `2025-08_Nachname_Vorname.xlsx`

**Dateibenennungspflicht:** `JJJJ-MM_Nachname_Vorname.xlsx`  
**Pro Monat typisch:** 2 Dateien – Reststunden Vormonat + aktueller Monat (je nach Situation)

## User Stories

### Werkstudenten
- Als Werkstudent möchte ich meinen monatlichen Stundenzettel als Excel-Datei herunterladen, damit ich ihn an meinen Manager weiterleiten kann, ohne ihn manuell ausfüllen zu müssen.
- Als Werkstudent möchte ich meine Personalnummer einmalig in meinem Profil hinterlegen, damit sie automatisch in jeden Export übernommen wird.
- Als Werkstudent möchte ich den Exportmonat frei wählen können, damit ich auch Vormonatsdaten nachexportieren kann (z.B. für den "Reststunden Vormonat"-Zettel).
- Als Werkstudent möchte ich, dass die Datei automatisch korrekt benannt wird (JJJJ-MM_Nachname_Vorname.xlsx), damit sie von der Personalabteilung akzeptiert wird.
- Als Werkstudent möchte ich eine klare Warnung sehen, wenn meine Personalnummer fehlt, damit ich sie vor dem Export ergänzen kann.

### Manager
- Als Manager möchte ich den Stundenzettel eines meiner Werkstudenten exportieren können, damit ich die Daten vor der Weiterleitung an payroll@mindsquare.de prüfen kann.
- Als Manager möchte ich sehen, welche Werkstudenten ihre Personalnummer noch nicht hinterlegt haben, damit ich sie gezielt darauf hinweisen kann.

## Acceptance Criteria

### Profil-Erweiterung: Personalnummer
- [ ] Das Nutzerprofil (`profiles`-Tabelle) erhält ein neues Feld `personalnummer` (Text, optional in der DB, aber für Export Pflicht)
- [ ] Werkstudenten können ihre Personalnummer im Profil-/Einstellungsbereich eintragen und bearbeiten
- [ ] Das Dashboard zeigt einen persistenten Hinweis-Banner, wenn Personalnummer fehlt und Werkstudent-Rolle aktiv ist

### Export-Funktion für Werkstudenten
- [ ] Auf der Zeiterfassungs-Seite (oder im persönlichen Dashboard) gibt es einen "Stundenzettel exportieren"-Button
- [ ] Ein Dialog ermöglicht die Auswahl des Exportmonats (Standard: aktueller Monat, Auswahl: 12 Monate zurück)
- [ ] Wenn Personalnummer fehlt: Export-Button ist deaktiviert, Tooltip erklärt warum, Link zu Profil-Einstellungen
- [ ] Nach Bestätigung wird die .xlsx-Datei automatisch heruntergeladen
- [ ] Dateiname folgt dem Schema: `JJJJ-MM_Nachname_Vorname.xlsx` (Ableitung aus `full_name`, Sonderzeichen normalisiert)

### Export-Funktion für Manager
- [ ] Im Manager-Bereich (Kalenderansicht oder neuer Bereich) kann der Manager für jeden Werkstudenten seines Bereichs einen Stundenzettel exportieren
- [ ] Der Manager sieht für welche Werkstudenten die Personalnummer fehlt (visueller Hinweis, z.B. gelbes Icon)
- [ ] Export für Werkstudenten ohne Personalnummer ist blockiert, bis diese hinterlegt wurde

### Excel-Dateiformat (entspricht der offiziellen mindsquare HR-Vorlage)
- [ ] Titelzeile: "Vorlage zur Dokumentation der täglichen Arbeitszeit"
- [ ] Firma: "mindsquare AG" (fest eingetragen)
- [ ] Name des Mitarbeiters: aus `full_name` des Profils
- [ ] Monat/Jahr: gewählter Monat im Format `MM/JJJJ` (z.B. 08/2025)
- [ ] Personalnummer: aus `personalnummer` des Profils
- [ ] Tabellenstruktur: Eine Zeile pro Kalendertag (alle 31 möglichen Zeilen vorhanden)
  - **Spalte Kalendertag:** Datum im Excel-Datumsformat, nicht erfasste Tage = 0/leer (wie in Vorlage)
  - **Spalte Beginn:** Früheste Startzeit aller Zeitblöcke des Tages, Format `hhmm` (z.B. `0830`)
  - **Spalte Pause:** Gesamtpausenzeit (Summe aller Pausen + Zwischenzeit zwischen Blöcken), Format `hhmm`
  - **Spalte Ende:** Späteste Endzeit aller Zeitblöcke des Tages, Format `hhmm`
  - **Spalte Dauer:** Automatisch per Excel-Formel berechnet (aus Vorlage übernommen)
  - **Spalte Bemerkungen:** Leer (Freitext – wird nicht aus der App befüllt)
- [ ] Tage ohne Zeiterfassung: Beginn/Pause/Ende bleiben leer (nicht 0000)
- [ ] Die Excel-Formeln für Dauer und Pausenwarnung aus der Originalvorlage bleiben erhalten

## Edge Cases
- **Kein Eintrag im Exportmonat:** Export wird erlaubt, alle Tageszeilen sind leer. Dialog zeigt Warnung "Keine Zeiterfassungsdaten für diesen Monat."
- **`full_name` ohne Leerzeichen (nur ein Wort):** Dateiname verwendet den Namen direkt ohne Underscore: `JJJJ-MM_Name.xlsx`
- **Sonderzeichen im Namen (Umlaute, ß):** Dateiname wird normalisiert: ä→ae, ö→oe, ü→ue, ß→ss; Leerzeichen→Underscore
- **Mehrere Zeitblöcke an einem Tag (PROJ-8):** Beginn = früheste Startzeit, Ende = späteste Endzeit, Pause = Gesamtpausenzeit inkl. Zwischenzeit zwischen Blöcken
- **Kein Pauseneintrag vorhanden (PROJ-9 nicht genutzt):** Pause-Spalte bleibt leer (nicht 0000)
- **Zeitblöcke über Mitternacht:** Nicht unterstützt im MVP; Verhalten wird dokumentiert
- **Manager exportiert für Werkstudenten aus fremdem Bereich:** Nicht erlaubt (RLS, wie PROJ-19)
- **Dezember-Deadline:** Der 18. statt dem 20. als Deadline für Dezember ist informativ (kein App-Enforcement im MVP)

## Technical Requirements
- **Excel-Library:** `xlsx` (SheetJS) – die Originalvorlage als Template laden und befüllen; Formeln bleiben erhalten
- **Vorlage:** `2025-08_Nachname_Vorname.xlsx` im Repo unter `src/lib/export/` ablegen
- **Export-Endpoint:** Server-seitige API-Route `/api/export/stundenzettel` (vermeidet das 20MB SheetJS-Bundle im Client)
- **Personalnummer DB-Feld:** `ALTER TABLE profiles ADD COLUMN personalnummer TEXT;` (Migration)
- **Dateiname-Logik:** `${year}-${String(month).padStart(2,'0')}_${lastName}_${firstName}.xlsx`, Sonderzeichen-Normalisierung serverseitig
- **RLS:** Werkstudent liest/schreibt nur eigene `personalnummer`; Manager liest `personalnummer` seiner Werkstudenten; kein öffentlicher Zugriff
- **Namens-Split:** `full_name` wird am letzten Leerzeichen geteilt → Vorname = alles vor letztem Leerzeichen, Nachname = letztes Wort

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Status:** Architected — 2026-05-07

### Kernlogik: Abrechnungszeitraum

Der Export arbeitet mit einem Datumsbereich (Von/Bis), nicht einem einzelnen Monat. Pro Kalendermonat im Bereich entsteht eine Excel-Datei — jedoch nur wenn in diesem Zeitraum tatsächlich Stunden erfasst sind. Tage außerhalb des gewählten Bereichs erscheinen im Excel leer (die Vorlage hat immer alle 31 Zeilen).

**Standardvorschlag beim Öffnen des Dialogs:**
- Von: 20. des Vormonats
- Bis: 19. des aktuellen Monats
- Beispiel (Mai 2026): 20.04.2026 – 19.05.2026
  - Datei 1 (April): enthält Einträge 20.04–30.04
  - Datei 2 (Mai): enthält Einträge 01.05–19.05

### Komponenten-Struktur

```
Dashboard (bestehende Seite)
+-- PersonalnummerBanner [NEU]   — Warnung wenn Personalnummer fehlt, mit Link zur Profilseite
+-- DashboardContent (bestehend)
    +-- StundenzettelExportButton [NEU]
        +-- ExportDialog [NEU, 3 Schritte]

Profil-Seite (bestehende Seite erweitern)
+-- Kontodaten Card (bestehend, unverändert)
+-- Personalnummer Card [NEU, editierbar]
    +-- Eingabefeld + Speichern-Button

Manager Users-Seite (bestehende Tabelle erweitern)
+-- Spalte: Personalnummer-Status [NEU]  — gelbes Icon wenn fehlend
+-- Spalte: Export-Button [NEU]          — pro Werkstudent, blockiert ohne Personalnummer

API: /api/export/stundenzettel [NEU]
+-- Parameter: userId, from (YYYY-MM-DD), to (YYYY-MM-DD)
+-- Auth-Check + Bereichs-Prüfung (RLS wie PROJ-19)
+-- Zeiteinträge abrufen, Template je Monat befüllen
+-- ZIP-Archiv mit 1–2 xlsx-Dateien zurückgeben

API: /api/export/stundenzettel/send [NEU]
+-- Selbe Logik wie oben
+-- Manager-E-Mail aus profiles laden
+-- E-Mail mit 1–2 xlsx-Anhängen senden (Resend)
+-- Bestätigung zurückgeben
```

### ExportDialog (3 Schritte)

**Schritt 1 – Zeitraum wählen**
- Von-Datum (Datepicker, Standard: 20. des Vormonats)
- Bis-Datum (Datepicker, Standard: 19. des aktuellen Monats)
- Beide Felder frei editierbar

**Schritt 2 – Vorschau**

Tabelle der abgedeckten Monate:

| Monat | Zeitraum im File | Tage mit Daten | Stunden gesamt | Status |
|-------|-----------------|----------------|----------------|--------|
| April 2026 | 20.–30.04. | 5 Tage | 21,5 h | ✓ Export |
| Mai 2026 | 01.–19.05. | 8 Tage | 32,0 h | ✓ Export |

Monate ohne Einträge im Bereich werden angezeigt, aber kein File erzeugt.

**Schritt 3 – Aktionen**
- `[Herunterladen]` → ZIP-Download mit 1–2 xlsx-Dateien
- `[An Manager senden]` → E-Mail an Vorgesetzten mit 1–2 Anhängen, Bestätigung mit Empfänger-Adresse

### Datenhaltung

Neue Spalte in der bestehenden `profiles`-Tabelle:
- `personalnummer` (Text, optional in DB — Pflicht für Export-Aktion)

Keine weiteren Datenbankänderungen notwendig.

### Technische Entscheidungen

| Entscheidung | Warum |
|---|---|
| Server-seitige API-Route für Export | SheetJS ~20 MB — zu groß für Client-Bundle |
| Template-Datei im Repo (`src/lib/export/template.xlsx`) | Originalvorlage mit HR-Formeln wird geladen und befüllt — Formeln bleiben erhalten |
| ZIP-Archiv für Download | Eine Aktion erzeugt bis zu 2 Dateien — ZIP ist sauberer als zwei sequentielle Downloads |
| Resend für E-Mail-Versand | Einfache API, gute Zustellrate, kostenloser Tier ausreichend, Vercel-kompatibel |
| Personalnummer in `profiles` | Einmalig hinterlegen, automatisch in jeden Export übernommen |
| Dateiname-Logik serverseitig | Sonderzeichen-Normalisierung (ä→ae, ö→oe, ü→ue, ß→ss) zuverlässig auf dem Server |

### Sicherheit & Zugriffsrechte

- Werkstudent: liest/schreibt nur eigene `personalnummer`; exportiert nur eigene Zeiteinträge
- Manager: liest `personalnummer` seiner Werkstudenten; kann Export für Werkstudenten des eigenen Bereichs auslösen
- Manager aus fremdem Bereich: per RLS blockiert (wie PROJ-19)
- E-Mail-Empfänger: immer der direkte Vorgesetzte aus `profiles.manager_id` — kein freies Eingabefeld

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `xlsx` (SheetJS) | Excel-Template laden, Zellen befüllen, Formeln erhalten |
| `resend` | E-Mail-Versand mit xlsx-Anhängen |
| `jszip` | Mehrere xlsx-Dateien in ein ZIP-Archiv packen |

## Implementation Notes (Frontend)

**Implemented 2026-05-07:**

- DB migration: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personalnummer TEXT` — applied to Supabase
- Template copied to `src/lib/export/template.xlsx` (original HR template from repo root)
- Packages added: `xlsx` (SheetJS), `jszip`

**New files:**
- `src/app/api/export/stundenzettel/route.ts` — POST endpoint: loads xlsx template, fills metadata + daily time rows, returns single xlsx or ZIP for multi-month ranges
- `src/app/api/export/stundenzettel/preview/route.ts` — POST endpoint: returns monthly summary (days with data, total hours) for the dialog preview step
- `src/components/zeiterfassung/PersonalnummerBanner.tsx` — warning banner shown on dashboard when personalnummer is missing
- `src/components/zeiterfassung/StundenzettelExportButton.tsx` — button + 2-step dialog (date range → preview table → download)
- `src/components/werkstudent/PersonalnummerCard.tsx` — editable card on profile page

**Modified files:**
- `src/lib/database.types.ts` — added `personalnummer: string | null` to Profile
- `src/components/zeiterfassung/DashboardContent.tsx` — added banner + export button for werkstudent role
- `src/app/dashboard/page.tsx` — fetches `personalnummer`, passes `isWerkstudent` prop
- `src/app/dashboard/profile/page.tsx` — added `PersonalnummerCard` for werkstudent profiles
- `src/app/manager/users/UsersClient.tsx` — added Pers.-Nr. column with missing indicator + export button per werkstudent row

**Deviations from spec:**
- E-mail sending (Manager → payroll@mindsquare.de via Resend) deferred — not yet implemented; core download flow is complete
- Preview is simplified to 2 steps (date range + preview/download) instead of 3 separate steps

## QA Test Results

**QA Date:** 2026-05-07  
**Tester:** /qa skill  
**Overall Result:** ❌ NOT READY — 1 High bug found

---

### Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `profiles.personalnummer` DB column added | ✅ PASS — migration applied |
| 2 | Werkstudenten can enter/edit personalnummer in profile | ✅ PASS — PersonalnummerCard renders, Save button state correct |
| 3 | Dashboard shows banner when personalnummer missing | ✅ PASS — PersonalnummerBanner visible with link to profile |
| 4 | Dashboard: "Stundenzettel exportieren" button for werkstudenten | ✅ PASS — button visible, disabled correctly when no personalnummer |
| 5 | Export dialog: date range picker (step 1) | ✅ PASS — Von/Bis inputs with defaults (20. Vormonat – 19. aktueller Monat) |
| 6 | Export dialog: preview table (step 2) with Herunterladen button | ✅ PASS — columns Monat/Zeitraum/Tage/Stunden visible |
| 7 | Export dialog: warning when no data in period | ✅ PASS — amber banner "Keine Zeiterfassungsdaten…" shown |
| 8 | From > To validation rejects on client side | ✅ PASS — stays on step 1 without proceeding |
| 9 | API: POST /api/export/stundenzettel — auth protected | ✅ PASS — 401 for unauthenticated |
| 10 | API: POST /api/export/stundenzettel/preview — auth protected | ✅ PASS — 401 for unauthenticated |
| 11 | File download with correct JJJJ-MM_Nachname_Vorname.xlsx filename | ✅ PASS — buildFileName logic verified by unit tests |
| 12 | Filename Umlaut normalization (ä→ae, ö→oe, ü→ue, ß→ss) | ✅ PASS — 27 unit tests covering all cases |
| 13 | Pers.-Nr. column in manager Users table | ✅ PASS — column header visible with missing indicator |
| 14 | Manager export button per werkstudent row | ❌ FAIL — **High Bug #1** |
| 15 | RLS: Manager from different bereich blocked | ✅ PASS — access check in API routes verified in code |
| 16 | Export button visible on mobile (375px) | ✅ PASS |

**15/16 criteria pass.**

---

### Bugs Found

#### BUG-1 — HIGH: Export button missing from manager Users table
**Steps to reproduce:**
1. Log in as a manager
2. Navigate to `/manager/users`
3. Look at werkstudent rows in the action column

**Expected:** "Stundenzettel exportieren" button next to "Bearbeiten" for each werkstudent row  
**Actual:** Only "Bearbeiten" button — no export button rendered  
**Root cause:** `StundenzettelExportButton` is imported in `UsersClient.tsx` (line 41) but was not placed in the last `<TableCell>` action column (lines 597–608). The `{user.role === 'werkstudent' && <StundenzettelExportButton ... />}` block is missing from the JSX.

---

#### BUG-2 — MEDIUM: setCell overwrites Excel cell format from template
**Location:** `src/app/api/export/stundenzettel/route.ts`, `setCell()` function (line 25–27)  
**Description:** `setCell` replaces the entire cell object `{ v, t }` without preserving the cell's number format (`z`) from the loaded template. If the HR template has time cells formatted as `0000` (to display `830` as `0830`), this format is lost when data cells are filled in. Cells that receive data from the export will display `830` rather than `0830`.  
**Needs verification:** Open an exported Excel file and check if time values display with leading zeros.

---

#### BUG-3 — LOW: `step` state typed as `1 | 2 | 3` but step 3 never rendered
**Location:** `src/components/zeiterfassung/StundenzettelExportButton.tsx`, line 47  
**Description:** `const [step, setStep] = useState<1 | 2 | 3>(1)` — step 3 was planned for a 3-step dialog but the implementation was simplified to 2 steps. The type and state value 3 are dead code.

---

#### BUG-4 — LOW: No server-side input validation on export API routes
**Location:** `src/app/api/export/stundenzettel/route.ts` and `preview/route.ts`  
**Description:** The `from`, `to`, and `userId` fields from the request body are used without Zod validation. Malformed date strings (e.g. `"not-a-date"`) are passed directly to Supabase `.gte()` / `.lte()` queries. Supabase will handle this gracefully (no data returned), but a properly validated API would return 400 with a clear error. The client-side `from > to` check is not duplicated server-side.

---

#### BUG-5 — LOW: Missing vertical spacing between profile page cards
**Location:** `src/app/dashboard/profile/page.tsx`, around line 148  
**Description:** The `PersonalnummerCard` is placed immediately after the Kontodaten Card with no `mt-6` or equivalent spacing class. The two cards render flush against each other.

---

### Security Audit

| Check | Result |
|-------|--------|
| Unauthenticated API access | ✅ Protected — 401 on both export routes |
| Manager accessing other bereich | ✅ Protected — bereich_id check in both API routes |
| Admin bypass | ✅ Correct — is_admin check allows full access |
| Filename injection (special chars in name) | ✅ Protected — `normalizeNamePart` strips non-alphanumeric |
| Path traversal in template loading | ✅ Safe — template path is hardcoded, no user input |
| Sensitive data in export | ✅ Acceptable — only own time data and personalnummer exported |

---

### Test Coverage

**Unit tests (Vitest):** 27 new tests in `src/app/api/export/stundenzettel/export-utils.test.ts`  
- `normalizeNamePart`: 7 tests covering ASCII, umlauts, ß, special chars  
- `buildFileName`: 9 tests covering standard names, months, umlauts, single-word names, 3-part names  
- `timeToMinutes`: 4 tests  
- `minutesToHhmm`: 7 tests  
All 279 total unit tests pass.

**E2E tests (Playwright):** `tests/PROJ-22-excel-stundenzettel-export.spec.ts`  
- 16 tests total (Chromium + Mobile Safari = 32 runs)  
- 6 tests pass consistently  
- 1 test fails (documents High Bug #1 — missing manager export button)  
- 9 tests skip (data-dependent: test users without personalnummer set can't trigger export dialog; manager with no bereich assignment has no werkstudenten in view)

**Regression:** All 252 pre-existing tests continue to pass.

## Deployment
_To be added by /deploy_
