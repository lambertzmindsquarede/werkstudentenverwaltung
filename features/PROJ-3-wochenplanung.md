# PROJ-3: Wochenplanung

## Status: In Progress
**Created:** 2026-04-28
**Last Updated:** 2026-04-28
**Architected:** 2026-04-28
**Frontend:** 2026-04-28

## Dependencies
- Requires: PROJ-1 (Authentication) – Werkstudent muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – Wochenstundenlimit muss konfiguriert sein

## User Stories
- Als Werkstudent möchte ich für die aktuelle und nächste Woche planen, an welchen Tagen ich arbeite und wann (Von–Bis), damit mein Manager sehen kann, wann ich verfügbar bin.
- Als Werkstudent möchte ich meine geplanten Stunden für die Woche summiert sehen, damit ich nicht versehentlich mein 20h-Limit überschreite.
- Als Werkstudent möchte ich eine Warnung erhalten, wenn meine geplanten Stunden das Wochenlimit überschreiten, damit ich den Plan noch anpassen kann.
- Als Werkstudent möchte ich einen einmal gespeicherten Wochenplan jederzeit bearbeiten können, damit ich flexibel auf Änderungen reagieren kann.
- Als Werkstudent möchte ich meinen Plan der Vorwoche als Vorlage für die aktuelle Woche übernehmen können, damit ich Wiederholungen nicht neu eingeben muss.

## Acceptance Criteria
- [ ] Werkstudent kann für jeden Wochentag (Mo–Fr) eine geplante Startzeit und Endzeit eingeben
- [ ] Pausen werden nicht separat erfasst (Zeiten sind Bruttozeiten)
- [ ] Geplante Stunden pro Tag und Wochensumme werden in Echtzeit berechnet und angezeigt
- [ ] Bei Überschreitung des Wochenstundenlimits (Standard: 20h) erscheint eine deutliche Warnung (kein Block)
- [ ] Wochenplan kann jederzeit gespeichert und bearbeitet werden
- [ ] Werkstudent kann den Plan der Vorwoche als Vorlage laden (Ein-Klick-Funktion)
- [ ] Werkstudent kann einzelne Tage als „kein Arbeitstag" markieren (kein Eintrag)
- [ ] Gespeicherte Wochenpläne sind für Manager in der Kalenderansicht sichtbar
- [ ] Werktage-Navigation: Wechsel zwischen Wochen über Vor/Zurück-Buttons

## Edge Cases
- Was passiert, wenn die Startzeit nach der Endzeit liegt? → Validierungsfehler, Speichern blockiert
- Was passiert, wenn ein Werkstudent keinen Plan für eine Woche einträgt? → Woche erscheint in der Manageransicht als „kein Plan"
- Was passiert, wenn der Plan nach dem tatsächlichen Einstempeln noch bearbeitet wird? → Plan-Änderung ist erlaubt, Ist-Werte bleiben unverändert; Differenz wird in der Auswertung sichtbar
- Was passiert bei Wochenwechsel (Sonntag → Montag)? → Neue Woche startet leer, Vorlage-Funktion verfügbar
- Was passiert an Feiertagen? → Keine automatische Feiertagserkennung im MVP; Werkstudent trägt einfach keinen Plan ein

## Technical Requirements
- **Datenbankstruktur:** Tabelle `planned_entries` mit Feldern: `id`, `user_id`, `date`, `planned_start`, `planned_end`, `created_at`, `updated_at`
- **RLS:** Werkstudenten lesen/schreiben nur ihre eigenen Einträge; Manager lesen alle
- **Berechnung:** Stundensummen werden clientseitig berechnet; keine gespeicherte Spalte notwendig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Neue Seite
`/dashboard/wochenplanung` — erreichbar über einen Navigationseintrag im bestehenden Dashboard-Layout. Wochenauswahl via URL-Parameter `?week=2026-W18` (ermöglicht Direktlinks und Browser-Back).

### Komponentenstruktur
```
/dashboard/wochenplanung
│
├── WochenNavigator
│     Kalenderwochen-Anzeige (KW X · Datum-Range)
│     [← Zurück]  [Weiter →]
│
├── VorlageBanner  (sichtbar nur wenn Vorwoche Einträge hat)
│     "Vorwoche als Vorlage übernehmen?" [Übernehmen]
│
├── WochenplanTabelle  (Mo–Fr)
│     Pro Tag eine Zeile:
│     ├── TagKopf          (z.B. Montag, 27.04.)
│     ├── ArbeitstagnToggle  ("kein Arbeitstag" Checkbox)
│     ├── ZeitEingabe      Von [08:00] Bis [12:00]
│     └── TagStunden       = 4,0 Std (clientseitig berechnet)
│
├── StundenSummary
│     Geplant diese Woche: 18,5 / 20,0 Std
│     WarningBadge bei Überschreitung des Limits
│
└── SpeichernButton
      [Plan speichern] / [Änderungen speichern]
      Inline-Feedback: "Gespeichert ✓" oder Fehlermeldung
```

### Datenmodell

**Neue Tabelle: `planned_entries`**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID (PK) | Eindeutige ID, auto-generiert |
| `user_id` | UUID (FK → profiles) | Werkstudent |
| `date` | date | Konkreter Arbeitstag (YYYY-MM-DD) |
| `planned_start` | time | Geplante Startzeit (HH:MM) |
| `planned_end` | time | Geplante Endzeit (HH:MM) |
| `created_at` | timestamptz | Automatisch |
| `updated_at` | timestamptz | Automatisch |

Pro User + Datum gibt es maximal 1 Eintrag (Unique Constraint auf `user_id + date`).

Stundensummen werden **nicht gespeichert** — sie werden im Browser berechnet.

**RLS-Policies:**
- Werkstudent: liest + schreibt nur eigene Einträge (`user_id = auth.uid()`)
- Manager: liest alle Einträge (wird für PROJ-5 Kalenderansicht benötigt)

### Datenzugriff
Server Actions (wie in `manager/users/actions.ts`) für alle Datenbankoperationen:
- Einträge einer Woche laden (Werkstudent + Manager)
- Woche speichern (Upsert: pro Tag anlegen oder aktualisieren)
- Vorwoche als Vorlage laden

### Validierung
Zod-Schema clientseitig: `planned_start < planned_end`. Bei Verstoß ist der Speichern-Button gesperrt. Warnungen (Stundenlimit) blockieren nicht.

### Neue Packages
Keine — alle benötigten shadcn/ui-Komponenten (`Input`, `Checkbox`, `Button`, `Card`, `Alert`) sind bereits installiert.

## Implementation Notes (Frontend)

**Files created:**
- `src/lib/week-utils.ts` — ISO week helpers (getISOWeekString, weekStringToMonday, getWeekDates, etc.)
- `src/app/dashboard/wochenplanung/actions.ts` — Server actions: loadWeekEntries, saveWeekPlan, loadPreviousWeekTemplate
- `src/app/dashboard/wochenplanung/page.tsx` — Server component; loads entries + profile, redirects if unauthenticated
- `src/components/wochenplanung/WochenplanungClient.tsx` — Full client component with week navigation, day rows, template banner, hours summary, save

**Modified:**
- `src/lib/database.types.ts` — Added PlannedEntry type
- `src/app/dashboard/page.tsx` — Added "Wochenplanung" nav link and dashboard card link

**Design decisions:**
- "kein Arbeitstag" checkbox per day: when checked, time inputs are hidden and the day is not saved
- Template banner always visible (first visit per session); disappears after template is loaded
- Week navigation via URL param `?week=2026-W18`; `key={weekStr}` on client component forces remount on week change
- Hours calculated client-side in real time; limit warning is non-blocking
- Saves via upsert (active days) + delete (inactive/empty days) in a single saveWeekPlan action

**Note:** `planned_entries` table must be created by `/backend` skill before this feature works end-to-end.

## Implementation Notes (Backend)

**Database migration applied (Supabase):**
- Table `planned_entries` created with columns: `id` (UUID PK), `user_id` (FK → profiles), `date` (DATE), `planned_start` (TIME), `planned_end` (TIME), `created_at`, `updated_at`
- `UNIQUE (user_id, date)` constraint — max 1 entry per user per day
- `CHECK (planned_end > planned_start)` enforced at DB level
- RLS enabled with 5 policies: werkstudenten read/insert/update/delete own rows; managers read all
- Indexes: `user_id`, `date`, `(user_id, date)`

**Updated:**
- `src/lib/database.types.ts` — Added `planned_entries` table to `Database` type (Row, Insert, Update)

**Tests added:**
- `src/lib/week-utils.test.ts` — 16 tests for all ISO week utility functions
- `src/app/dashboard/wochenplanung/actions.test.ts` — 14 tests for Zod validation schema, time normalization, and upsert/delete split logic
- All 45 tests pass (`npm test`)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
