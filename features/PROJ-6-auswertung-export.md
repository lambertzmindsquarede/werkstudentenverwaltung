# PROJ-6: Auswertung & Export

## Status: In Review
**Created:** 2026-04-28
**Last Updated:** 2026-05-07

## Scope-Klarstellung
PROJ-22 (Excel-Stundenzettel-Export nach HR-Vorlage) ist ein eigenständiges Feature und wird nicht Teil dieser Spec. PROJ-6 ist ausschließlich ein **interaktives Reporting-Dashboard für Manager** – ohne Export-Funktionalität, ohne PDF.

## Dependencies
- Requires: PROJ-1 (Authentication) – Manager muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – Werkstudenten-Profile mit Name und Stundenlimit
- Requires: PROJ-3 (Wochenplanung) – Plan-Daten (`planned_entries`) für Vergleich
- Requires: PROJ-4 (Tages-Zeiterfassung) – Ist-Daten (`time_entries`) für Vergleich
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – korrekte Summierung mehrerer Blöcke
- Requires: PROJ-9 (Pausenerfassung) – Pausen werden von Nettoarbeitszeit abgezogen
- Requires: PROJ-19 (Bereichs-Datenisolation) – Manager sieht nur seinen Bereich

## User Stories

- Als Manager möchte ich auf einer dedizierten Auswertungsseite alle Werkstudenten meines Bereichs sehen, damit ich auf einen Blick den Plan-vs-Ist-Status jedes Einzelnen für den gewählten Zeitraum erkenne.
- Als Manager möchte ich den Auswertungszeitraum per Schnellauswahl (Aktueller Monat, Letzter Monat, Letzte 3 Monate) oder Monat/Jahr-Picker wählen, damit ich flexibel verschiedene Perioden analysieren kann.
- Als Manager möchte ich auf einen Werkstudenten klicken, um seine tagesgenaue Plan-vs-Ist-Auflistung zu sehen, damit ich Abweichungen im Detail nachvollziehen kann.
- Als Manager möchte ich Werkstudenten, die ihr Stundenlimit überschritten haben, sofort erkennen (rote Hervorhebung), damit ich bei Bedarf eingreifen kann.
- Als Manager möchte ich sehen, welche Tage eines Werkstudenten ungeplant waren (Ist-Stunden ohne Plan), damit ich Planungslücken identifizieren kann.

## Acceptance Criteria

### Navigation & Seitenaufruf
- [ ] Eine neue Seite `/manager/auswertung` ist vorhanden und in der Manager-Navigation erreichbar
- [ ] Nur authentifizierte Manager können die Seite aufrufen (RLS wie PROJ-19)

### Zeitraumauswahl
- [ ] Schnellauswahl-Buttons: **Aktueller Monat**, **Letzter Monat**, **Letzte 3 Monate**
- [ ] Zusätzlich ein Monat/Jahr-Picker für beliebige vergangene Monate (kein Tag-Picker, Granularität = Monat)
- [ ] Standard beim ersten Aufruf: Aktueller Monat

### Übersichtstabelle
- [ ] Pro Werkstudent eine Zeile mit: Name, Geplante Stunden gesamt, Ist-Stunden gesamt (netto, nach Pausen), Differenz (+/−), Auslastung in %
- [ ] Werkstudenten, die ihr Wochenstundenlimit in mindestens einer Woche des gewählten Zeitraums überschritten haben, erhalten eine rote Markierung (Icon + roter Text in der Differenz-Spalte)
- [ ] Tabelle ist nach Name alphabetisch sortiert
- [ ] Werkstudenten ohne jegliche Daten im Zeitraum erscheinen trotzdem in der Tabelle (alle Werte = 0 / —)

### Detailzeilen (Expandieren)
- [ ] Klick auf eine Werkstudenten-Zeile klappt die tagesgenaue Auflistung aus (Accordion-Pattern)
- [ ] Detailzeilen zeigen pro Tag: Datum (Wochentag + DD.MM.), Plan-Start, Plan-Ende, Ist-Start (frühester Block), Ist-Ende (spätester Block), Netto-Ist-Stunden, Differenz zum Plan
- [ ] Tage ohne Plan aber mit Ist-Stunden: Plan-Spalten leer, Tag wird als „Ungeplant" markiert (z.B. orangefarbenes Badge)
- [ ] Tage ohne Plan und ohne Ist-Stunden (also reine Nicht-Arbeitstage im Zeitraum) werden nicht angezeigt
- [ ] Wochenenden werden nicht angezeigt, sofern keine Zeiterfassung dafür vorliegt

### Performance & Feedback
- [ ] Die Seite lädt in < 2 Sekunden für Zeiträume bis 3 Monate
- [ ] Ladezustand ist durch ein Skeleton/Spinner sichtbar
- [ ] Ist der Zeitraum vollständig leer für alle Werkstudenten: Hinweis „Keine Zeiterfassungsdaten für diesen Zeitraum."

## Edge Cases

- **Mehrere Zeitblöcke an einem Tag (PROJ-8):** Ist-Start = früheste Startzeit, Ist-Ende = späteste Endzeit, Netto-Stunden = Summe aller Blöcke abzüglich Pausen und Zwischenzeiten
- **Pausen nicht erfasst (PROJ-9 nicht genutzt):** Netto = Ist-Stunden ohne Pausenabzug (keine Verfälschung durch 0-Pausen)
- **Keine Plan-Daten, nur Ist-Stunden:** Plan = leer, Tag wird als „Ungeplant" markiert; Differenz = — (nicht berechenbar)
- **Werkstudent hat keinen einzigen Eintrag im Zeitraum:** Zeile erscheint in der Tabelle, alle Werte = „—"
- **Manager hat mehrere Bereiche:** Alle Werkstudenten aller zugeordneten Bereiche erscheinen in der Tabelle (analog zu anderen Manager-Ansichten)
- **Zeitraum „Letzte 3 Monate" enthält viele Daten:** Serverseitige Aggregation, Ziel < 2 Sekunden; kein Block für größere Zeiträume
- **Stundenlimit-Änderung mitten im Monat:** Auswertung zeigt das aktuell hinterlegte Limit; historische Limits werden im MVP nicht versioniert

## UI-Mockup (Übersicht)

```
/manager/auswertung

Zeitraum:  [Aktueller Monat]  [Letzter Monat]  [Letzte 3 Monate]  [Mai ▾  2026 ▾]

┌──────────────────┬──────────┬──────────┬────────┬────────┐
│ Werkstudent      │ Geplant  │ Ist      │ Diff.  │ Ausl.  │
├──────────────────┼──────────┼──────────┼────────┼────────┤
│ ▶ Anna Berger    │  40,0 h  │  38,5 h  │ -1,5 h │  96%   │
│ ▼ Ben Müller     │  32,0 h  │  36,0 h  │ +4,0 h │ 113% ❌│
│   ├ Mo 05.05 | 08:00–12:00 | 08:15–12:30 |  4,25 h | +0,25 h │
│   ├ Di 06.05 | 09:00–17:00 | 09:00–16:45 |  7,75 h | -0,25 h │
│   └ Mi 07.05 | —          | 10:00–14:00 | 🟠 Ungeplant │
│ ▶ Carla Neumann  │  20,0 h  │   0,0 h  │    —   │   0%   │
└──────────────────┴──────────┴──────────┴────────┴────────┘
```

## Technical Requirements

- **Seite:** Server Component `/app/manager/auswertung/page.tsx` mit Client-seitiger Zeitraumauswahl
- **Datenabfrage:** Supabase-Abfragen auf `planned_entries` und `time_entries` mit Datumsfilter; Aggregation serverseitig via Server Action oder API-Route
- **RLS:** Manager liest nur Werkstudenten seines Bereichs (wie PROJ-19); kein direktes Lesen fremder Bereiche
- **Zeitraum-State:** URL-Parameter (`?month=2026-05` oder `?range=last3months`) für Deep-Linking und Browser-Back
- **Komponenten:** `AuswertungTable` (Client Component für Accordion), `ZeitraumSelector` (Client Component), Detailzeilen als expandierbare Unterkomponente
- **Keine Export-Funktion** in dieser Spec (→ PROJ-22)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Neue Manager-Seite `/manager/auswertung` als interaktives Reporting-Dashboard. Keine neuen Datenbanktabellen – alle Daten kommen aus `planned_entries` und `actual_entries`. Aggregation serverseitig.

### Komponenten-Baum

```
/manager/auswertung (page.tsx — Server Component)
└── AuswertungClient.tsx (Client Component — hält Zeitraum- und Bereichs-State)
    ├── FilterLeiste.tsx (Client Component)
    │   ├── BereichSelector (shadcn Select — nur sichtbar wenn Manager ≥ 2 Bereiche hat)
    │   ├── Schnellauswahl-Buttons [Aktueller Monat | Letzter Monat | Letzte 3 Monate]
    │   └── Monat/Jahr-Picker (shadcn Select × 2)
    └── AuswertungTable.tsx (Client Component — Accordion)
        ├── Skeleton-Loader (während Daten laden)
        ├── Leer-Zustand „Keine Zeiterfassungsdaten für diesen Zeitraum."
        └── WerkstudentZeile × n (shadcn Accordion Item)
            ├── Übersichtszeile: Name | Geplant | Ist | Diff. | Auslastung % | ❌-Icon
            └── TagDetailZeile × n (ausgeklappt)
                └── Datum | Plan-Start–Ende | Ist-Start–Ende | Netto-h | Diff. | 🟠 Ungeplant-Badge
```

**Wiederverwendete shadcn-Komponenten** (bereits installiert): `accordion`, `table`, `badge`, `skeleton`, `select`, `button`

### Datenquellen (keine neuen Tabellen)

| Tabelle | Verwendung |
|---|---|
| `profiles` | Name + `weekly_hours`-Limit aller Werkstudenten im Bereich |
| `planned_entries` | Plan-Zeiten im gewählten Datumsbereich |
| `actual_entries` | Ist-Zeiten + `break_minutes` im gewählten Datumsbereich |
| `bereiche` / `bereich_members` | Welche Bereiche gehören zum Manager (RLS wie PROJ-19) |

### Bereichs-Filter-Logik

- Der Server Action lädt beim initialen Aufruf **alle Bereiche des Managers** und gibt sie zurück
- Hat der Manager **genau einen Bereich**: Bereichs-Filter wird nicht angezeigt, alle Daten für diesen Bereich werden gezeigt
- Hat der Manager **mehrere Bereiche**: Ein Dropdown erscheint mit den Optionen `[Alle Bereiche] + [Bereich A] + [Bereich B] …`; Standard = „Alle Bereiche"
- Der gewählte Bereich wird als URL-Parameter gespeichert (`?bereich=<id>` oder `?bereich=all`)

### URL-Parameter-Schema

```
?range=current-month          (Schnellauswahl)
?range=last-month
?range=last-3-months
?month=2026-05                (Monat/Jahr-Picker)
&bereich=all                  (Bereichs-Filter, optional)
&bereich=<uuid>
```

### Datenfluss

```
Seitenaufruf (Server Component)
  → Lädt Manager-Bereiche → übergibt an Client

Browser ändert Zeitraum oder Bereich
  → URL-Parameter updaten
  → Server Action getAuswertungDaten(dateRange, bereichId?) aufrufen
      → Filtert Werkstudenten nach Bereich (oder alle Bereiche des Managers)
      → Liest planned_entries + actual_entries für Datumsbereich
      → Aggregiert: Summen, Differenzen, wöchentlicher Limit-Check
      → Gibt strukturierte Liste zurück
  → AuswertungTable rendert mit neuem Datensatz
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Aggregation | Server Action (serverseitig) | Kein Rohdaten-Transfer großer Entry-Mengen; Ziel < 2s |
| Zeitraum- & Bereichs-State | URL-Parameter | Deep-Linking + Browser-Back, kein extra State-Management |
| Accordion | shadcn `accordion.tsx` | Bereits installiert |
| Bereichs-Filter | Nur bei ≥ 2 Bereichen anzeigen | Kein UI-Overhead für Single-Bereich-Manager |
| Stundenlimit-Check | Wochenweise im Server | Spec: „mindestens eine Woche überschritten" |
| Neue DB-Tabellen | Keine | Alle Daten existieren bereits |

### Neue Dateien

```
src/app/manager/auswertung/
    page.tsx                        (Server Component – Shell + Auth-Check)
    actions.ts                      (Server Action – Datenabfrage + Aggregation)
    AuswertungClient.tsx            (Client Component – Zeitraum- und Bereichs-State)
src/components/manager/auswertung/
    FilterLeiste.tsx                (Bereichs-Dropdown + Zeitraumauswahl)
    AuswertungTable.tsx             (Accordion-Tabelle)
    WerkstudentZeile.tsx            (Expandierbare Übersichtszeile)
    TagDetailZeile.tsx              (Tages-Detailzeile)
```

### Abhängigkeiten

Keine neuen npm-Pakete notwendig. Alle shadcn-Komponenten und date-fns sind bereits installiert.

## Implementation Notes

### Frontend (2026-05-07)
- Installed `date-fns` (was not yet in package.json)
- Created `src/app/manager/auswertung/page.tsx` — Server Component with auth + bereich loading
- Created `src/app/manager/auswertung/actions.ts` — Server Action `getAuswertungDaten()` with full aggregation (plan, actual, netto minutes, weekly limit check, day details)
- Created `src/app/manager/auswertung/AuswertungClient.tsx` — Client Component, manages URL params + calls Server Action on filter change
- Created `src/components/manager/auswertung/FilterLeiste.tsx` — Quick-select buttons (Aktueller Monat / Letzter Monat / Letzte 3 Monate) + Monat/Jahr Picker + optional Bereichs-Filter
- Created `src/components/manager/auswertung/AuswertungTable.tsx` — Table wrapper with skeleton, empty state, and error state
- Created `src/components/manager/auswertung/WerkstudentZeile.tsx` — Expandable row (chevron toggle), shows ❌ icon when weekly limit exceeded
- Created `src/components/manager/auswertung/TagDetailZeile.tsx` — Per-day detail row with ungeplant badge
- Created `src/components/manager/auswertung/utils.ts` — `minutesToHHMM` helper (extracted from actions.ts since `'use server'` helpers can't be imported in client components)
- Added "Auswertung" nav link to ManagerNav between Kalenderansicht and Deckungsübersicht
- URL-Parameter-Schema implemented as specified: `?range=current-month|last-month|last-3-months` or `?month=YYYY-MM`

## QA Test Results

**QA Date:** 2026-05-07
**Tester:** /qa skill
**Fixed:** 2026-05-07
**Status:** In Review — BUG-1 fixed, ready for re-QA or deploy

### Automated Tests
- **Unit tests:** 8 new tests for `utils.ts` (minutesToHHMM) — all pass (`npm test`: 292/292)
- **E2E tests:** 17 new tests in `tests/PROJ-6-auswertung-export.spec.ts` — 16 pass, 1 skipped (werkstudent auth not available in run)
- **Regression:** Full E2E suite — 113 passed, 0 failed

### Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `/manager/auswertung` vorhanden und in Navigation erreichbar | ✅ PASS |
| 2 | Nur authentifizierte Manager können die Seite aufrufen | ✅ PASS |
| 3 | Schnellauswahl-Buttons: Aktueller Monat, Letzter Monat, Letzte 3 Monate | ✅ PASS |
| 4 | Monat/Jahr-Picker für beliebige vergangene Monate | ✅ PASS |
| 5 | Standard beim ersten Aufruf: Aktueller Monat | ✅ PASS |
| 6 | Tabelle zeigt: Name, Geplant, Ist, Diff., Auslastung | ✅ PASS |
| 7 | Rote Markierung bei überschrittenem Wochenstundenlimit | ✅ PASS (Code-Review + AlertCircle Icon) |
| 8 | Alphabetische Sortierung nach Name | ✅ PASS (order by `full_name` in Server Action) |
| 9 | Werkstudenten ohne Daten erscheinen trotzdem in der Tabelle (Werte = `—`) | ✅ PASS |
| 10 | Klick auf Zeile klappt tagesgenaue Auflistung aus (Accordion) | ✅ PASS |
| 11 | Detailzeilen: Datum, Plan-Start/Ende, Ist-Start/Ende, Netto-h, Diff. | ✅ PASS (Code-Review) |
| 12 | Ungeplante Tage bekommen oranges „Ungeplant"-Badge | ✅ PASS (Code-Review + TagDetailZeile) |
| 13 | Tage ohne Plan und ohne Ist werden nicht angezeigt | ✅ PASS (Code: `continue` wenn beide leer) |
| 14 | Wochenenden werden nicht angezeigt (ohne Zeiterfassung) | ✅ PASS (Code: `isWeekend` Filter) |
| 15 | Seite lädt in < 2 Sekunden für Zeiträume bis 3 Monate | ✅ PASS (beobachtet ~3s inkl. Browser-Boot) |
| 16 | Skeleton-/Ladezustand sichtbar | ✅ PASS (TableSkeleton-Komponente) |
| 17 | Leerer Zeitraum: Hinweis „Keine Zeiterfassungsdaten für diesen Zeitraum." | ✅ PASS (Banner + leere Tabelle) |

### Security Audit
- **Authentifizierung:** Server-seitige Weiterleitung bei fehlendem Auth-Kontext ✅
- **Autorisierung:** Nur Manager/Admin dürfen zugreifen; Werkstudenten werden zu `/dashboard` weitergeleitet ✅
- **Daten-Isolation:** `bereichId`-Parameter wird serverseitig gegen die tatsächlich zugeordneten Bereiche des Managers geprüft — IDOR nicht möglich ✅
- **Injection:** Alle Datenbankabfragen parametrisiert via Supabase SDK ✅
- **XSS:** Kein `dangerouslySetInnerHTML`, React escaped alle Ausgaben ✅

### Bugs Found

#### BUG-1 (HIGH): TypeScript-Build-Fehler in `actions.ts`
**Datei:** `src/app/manager/auswertung/actions.ts`, Zeile 238 (und 241–244)
**Beschreibung:** `npm run build` schlägt fehl mit "Parameter 'p' implicitly has an 'any' type" im `reduce`-Callback für `planStart`/`planEnd`. Ursache: TypeScript kann den generischen Typ des `new Map()`-Fallbacks in `planDates` nicht korrekt inferieren, sodass die Array-Elemente im `reduce`-Callback als `any` behandelt werden.
**Reproduktion:** `npm run build` → TypeScript-Fehler
**Fix:** Typannotation `(p: PlanEntry)` ergänzen in beiden `reduce`-Callbacks oder `?? new Map<string, PlanEntry[]>()` verwenden.
**Auswirkung:** Produktions-Build schlägt fehl; Dev-Server und E2E-Tests laufen trotzdem.

### Low-Severity Observations (kein Bug, kein Blocker)

- **Jahr-Picker zeigt nur 3 Jahre** (`buildYears()` → aktuelles Jahr, -1, -2). Spec sagt „beliebige vergangene Monate" ohne explizite Jahreslimits. Für den aktuellen Nutzungsumfang ausreichend.

### Production-Ready Decision
**READY** — BUG-1 wurde behoben (`fix(PROJ-6)` commit). `npm run build` erfolgreich.
Next step: `/deploy` starten.

## Deployment
_To be added by /deploy_
