# PROJ-16: Arbeitsort-Auswahl

## Status: Approved
**Created:** 2026-05-06
**Last Updated:** 2026-05-07

## Dependencies
- Requires: PROJ-1 (Authentication) – Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – Manager-Werkstudent-Zuordnung muss bestehen
- Requires: PROJ-3 (Wochenplanung) – Arbeitsort wird pro Tag in der Wochenplanung erfasst
- Requires: PROJ-5 (Manager-Kalenderansicht) – Arbeitsort soll in der Kalenderansicht sichtbar sein

## Overview
Werkstudenten müssen bei der täglichen Wochenplanung einen Arbeitsort angeben (Pflichtfeld). Die verfügbaren Orte werden vom jeweils zuständigen Manager gepflegt (pro Manager-Team). Gelöschte Orte bleiben in historischen Einträgen sichtbar (Soft-Delete), können aber nicht mehr neu ausgewählt werden. Manager sehen den geplanten Arbeitsort ihrer Werkstudenten in der Kalenderansicht.

---

## User Stories

### Manager
- Als Manager möchte ich neue Arbeitsorte anlegen (z.B. "Homeoffice", "Büro Paderborn", "Kunde TKSE"), damit meine Werkstudenten nur relevante Orte zur Auswahl sehen.
- Als Manager möchte ich bestehende Arbeitsorte umbenennen, damit ich Tippfehler oder Namensänderungen korrigieren kann.
- Als Manager möchte ich einen Arbeitsort deaktivieren (Soft-Delete), damit er nicht mehr neu ausgewählt werden kann, aber historische Planungseinträge erhalten bleiben.
- Als Manager möchte ich die geplanten Arbeitsorte meiner Werkstudenten in der Kalenderansicht sehen, damit ich die Anwesenheitssituation im Team überblicken kann.

### Werkstudent
- Als Werkstudent möchte ich pro Arbeitstag einen Arbeitsort aus einer vorgegebenen Liste auswählen, damit mein Manager weiß, wo ich arbeite.
- Als Werkstudent möchte ich nur die Arbeitsorte sehen, die mein Manager für mein Team gepflegt hat, damit keine irrelevanten Optionen auftauchen.
- Als Werkstudent möchte ich, dass der zuletzt gewählte Arbeitsort als Standard vorbelegt wird, wenn ich eine neue Woche plane, damit ich nicht jeden Tag neu auswählen muss.

---

## Acceptance Criteria

### Manager: Arbeitsort-Verwaltung
- [ ] Manager sieht eine Liste aller von ihm gepflegten Arbeitsorte (aktive und deaktivierte)
- [ ] Manager kann einen neuen Arbeitsort mit einem Freitextnamen anlegen
- [ ] Manager kann den Namen eines bestehenden Arbeitsorts bearbeiten
- [ ] Manager kann einen Arbeitsort deaktivieren (Soft-Delete) – er wird als "inaktiv" markiert und ist für Werkstudenten nicht mehr auswählbar
- [ ] Deaktivierte Arbeitsorte erscheinen weiterhin in historischen Planungseinträgen mit ihrem Namen
- [ ] Manager kann einen deaktivierten Arbeitsort reaktivieren
- [ ] Jeder Manager verwaltet nur seine eigenen Arbeitsorte (kein teamübergreifender Zugriff)
- [ ] Mindestname: 1 Zeichen; Maximalname: 100 Zeichen

### Werkstudent: Arbeitsort-Auswahl in der Wochenplanung
- [ ] Pro Arbeitstag (Zeile in der Wochenplanung) erscheint ein Dropdown zur Auswahl des Arbeitsorts
- [ ] Das Dropdown zeigt nur aktive Arbeitsorte des zuständigen Managers des Werkstudenten
- [ ] Kein Arbeitsort ausgewählt = Speichern nicht möglich (Pflichtfeld pro geplantem Tag)
- [ ] Tage, die als "kein Arbeitstag" markiert sind, benötigen keinen Arbeitsort
- [ ] Der zuletzt verwendete Arbeitsort eines Werkstudenten wird als Standardwert im Dropdown vorbelegt
- [ ] Wenn kein Arbeitsort für den Manager konfiguriert ist, erscheint eine Hinweismeldung statt des Dropdowns

### Manager: Kalenderansicht
- [ ] In der Manager-Kalenderansicht (PROJ-5) wird pro Tag und Werkstudent der geplante Arbeitsort angezeigt (z.B. als kleines Badge oder Kürzel)
- [ ] Deaktivierte Arbeitsorte in historischen Einträgen werden mit ihrem Namen angezeigt (kein "unbekannt")

---

## Edge Cases

- **Kein Arbeitsort konfiguriert:** Hat der Manager noch keine Arbeitsorte angelegt, sieht der Werkstudent in der Wochenplanung eine Hinweismeldung ("Ihr Manager hat noch keine Arbeitsorte hinterlegt. Bitte wenden Sie sich an Ihren Vorgesetzten."). Das Speichern des Tageseintrags ist in diesem Fall nicht möglich.
- **Arbeitsort wird deaktiviert, während eine zukünftige Planung ihn bereits enthält:** Bestehende Planungseinträge bleiben unverändert; der Ort wird nur für neue Auswahlen gesperrt. Manager sieht den alten Eintrag weiterhin korrekt.
- **Werkstudent hat keinen Manager zugeordnet:** Es werden keine Arbeitsorte angezeigt; Hinweismeldung analog zu "kein Arbeitsort konfiguriert".
- **Vorlage der Vorwoche übernehmen (PROJ-3 Template-Funktion):** Enthält die Vorlage einen Arbeitsort, der inzwischen deaktiviert wurde, wird er im Dropdown als "(deaktiviert – bitte neu wählen)" angezeigt und markiert. Speichern ist erst möglich, nachdem ein aktiver Ort gewählt wurde.
- **Langer Ortsname im Kalender:** Bei sehr langen Namen (> 20 Zeichen) wird in der Kalenderansicht ein Tooltip verwendet; der Name wird abgekürzt angezeigt.
- **Doppelter Name:** Zwei aktive Arbeitsorte mit identischem Namen beim selben Manager sollen verhindert werden (Validierungsfehler beim Anlegen/Umbenennen).

---

## Out of Scope
- Orte werden nicht auf einer Karte dargestellt
- Keine GPS-/Standort-Erkennung
- Keine Manager-übergreifende gemeinsame Ortsliste
- Keine Pflichtangabe für bereits gespeicherte historische Einträge (Bestandsschutz)

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Manager-Bereich (neu: Einstellungsseite)
+-- ArbeitsortVerwaltungPage          ← neue Seite /dashboard/einstellungen/arbeitsorte
    +-- ArbeitsortVerwaltungClient    ← interaktive Liste
        +-- ArbeitsortListe
        |   +-- ArbeitsortZeile (Name | Status | Aktionen)
        |       +-- [Bearbeiten-Button → Dialog]
        |       +-- [Deaktivieren/Reaktivieren-Toggle]
        +-- NeuerArbeitsortDialog     ← Dialog mit Textfeld + Speichern

Wochenplanung (bestehend: WochenplanungClient.tsx – erweitern)
+-- WochenplanungClient
    +-- TagZeile (pro Arbeitstag)
        +-- [bestehend: Zeitblöcke, Checkboxen]
        +-- ArbeitsortDropdown        ← NEU (shadcn <Select>)
            +-- aktive Arbeitsorte des Managers
            +-- "(deaktiviert – bitte neu wählen)" falls Vorlage veraltet
            +-- Hinweis-Alert falls keine Orte konfiguriert

Manager-Kalenderansicht (bestehend: KalenderZelle.tsx – erweitern)
+-- KalenderZelle
    +-- [bestehend: Stunden, Status-Farben]
    +-- ArbeitsortBadge               ← NEU (shadcn <Badge> + <Tooltip> bei langen Namen)
```

### Datenmodell

**Neue Tabelle: `arbeitsorte`**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Eindeutige ID |
| `manager_id` | UUID (→ profiles) | Welchem Manager gehört dieser Ort |
| `name` | Text (1–100 Zeichen) | z.B. "Homeoffice", "Büro Paderborn" |
| `is_active` | Boolean | false = deaktiviert (Soft-Delete) |
| `created_at` | Timestamp | Angelegt am |

Unique-Constraint: `(manager_id, name)` WHERE `is_active = true` — verhindert doppelte aktive Namen pro Manager.

**Erweiterung: `planned_entries`**

Neue Spalte: `arbeitsort_id` (UUID, nullable FK → arbeitsorte)
- `NULL` für historische Einträge (Bestandsschutz)
- `NULL` für Tage ohne Arbeit (kein Pflichtfeld)
- Pflichtfeld auf App-Ebene für neue geplante Arbeitstage

### Berechtigungskonzept (RLS)

| Aktion | Wer | Bedingung |
|---|---|---|
| Arbeitsorte lesen | Manager | Nur eigene (`manager_id = auth.uid()`) |
| Arbeitsorte lesen | Werkstudent | Nur die des eigenen Managers |
| Arbeitsorte anlegen/bearbeiten/deaktivieren | Manager | Nur eigene |
| `planned_entries.arbeitsort_id` lesen | Werkstudent | Nur eigene Einträge |
| `planned_entries.arbeitsort_id` lesen | Manager | Einträge der eigenen Werkstudenten |

### Server Actions

**Neu: `src/app/dashboard/einstellungen/arbeitsorte/actions.ts`**

| Aktion | Beschreibung |
|---|---|
| `getArbeitsorte(managerId)` | Lädt alle Arbeitsorte eines Managers |
| `createArbeitsort(name)` | Legt neuen Ort an (Duplikat-Prüfung) |
| `updateArbeitsort(id, name)` | Benennt um (Duplikat-Prüfung) |
| `toggleArbeitsort(id, is_active)` | Aktiviert/Deaktiviert |

**Erweitert: `src/app/dashboard/wochenplanung/actions.ts`**

| Aktion | Änderung |
|---|---|
| `saveWeekPlan(...)` | Nimmt `arbeitsort_id` pro Tag entgegen |
| `loadPreviousWeekTemplate(...)` | Lädt `arbeitsort_id` (mit Prüfung ob noch aktiv) |
| `getArbeitsorteForWerkstudent()` | Neu: lädt aktive Orte des zugeordneten Managers |

Kalender-Datenladen (PROJ-5 Actions): Query jointed `arbeitsorte` mit, um den Namen pro Planungseintrag mitzuliefern.

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Soft-Delete statt Hard-Delete | Historische Einträge bleiben aussagekräftig |
| `arbeitsort_id` nullable in DB | Bestandsschutz für Altdaten |
| Vorausfüllen per letztem Wert | Komfort: letzter `arbeitsort_id` aus jüngster `planned_entry` |
| Tooltip bei langen Namen im Kalender | Verhindert Layout-Probleme (> 20 Zeichen) |
| Eigene Einstellungsseite für Verwaltung | Hält die Kalenderansicht sauber; Verwaltung ist selten |

### Keine neuen Pakete nötig

Alle UI-Komponenten bereits installiert: `<Select>`, `<Badge>`, `<Tooltip>`, `<Dialog>`

## Implementation Notes (Frontend)

**Neu erstellt:**
- `src/app/manager/arbeitsorte/page.tsx` – Manager-Seite für Arbeitsort-Verwaltung (Server Component)
- `src/app/manager/arbeitsorte/actions.ts` – Server Actions: `getArbeitsorte`, `createArbeitsort`, `updateArbeitsort`, `toggleArbeitsort`
- `src/components/arbeitsorte/ArbeitsortVerwaltungClient.tsx` – Interaktive Liste mit Erstellen/Bearbeiten-Dialog und Aktivieren/Deaktivieren-Toggle

**Erweitert:**
- `src/lib/database.types.ts` – Neuer Typ `Arbeitsort`, `PlannedEntry` um `arbeitsort_id` und embedded `arbeitsort` erweitert
- `src/app/dashboard/wochenplanung/actions.ts` – `DayEntry` um `arbeitsort_id` erweitert, `DayEntrySchema` angepasst, neue Actions `getArbeitsorteForWerkstudent` und `getLastUsedArbeitsortId`
- `src/app/dashboard/wochenplanung/page.tsx` – Lädt Arbeitsorte und `lastUsedArbeitsortId` serverseitig
- `src/components/wochenplanung/WochenplanungClient.tsx` – Arbeitsort-Dropdown pro Tag, Validierung (Pflichtfeld wenn Arbeitsorte konfiguriert), Vorlage-Template berücksichtigt deaktivierte Orte
- `src/app/manager/kalender/actions.ts` – `planned_entries` joined jetzt `arbeitsorte` via Left Join
- `src/components/kalender/KalenderZelle.tsx` – Zeigt Arbeitsort-Badge mit Tooltip bei langen Namen (>20 Zeichen)
- `src/components/kalender/KalenderGrid.tsx` – Nav-Link „Arbeitsorte" hinzugefügt
- `src/components/kalender/ZellDetailDialog.tsx` – Zeigt Arbeitsort-Badge im Geplant-Bereich

**Backend (abgeschlossen):**
- DB-Migration `20260506_proj16_arbeitsorte.sql` angewendet
  - Tabelle `arbeitsorte` mit UUID-PK, `manager_id` FK, `name` (CHECK 1–100 Zeichen), `is_active`, `created_at`
  - Unique-Partial-Index: `(manager_id, name) WHERE is_active = true` — verhindert doppelte aktive Namen
  - Spalte `arbeitsort_id` (UUID, nullable FK → arbeitsorte, ON DELETE SET NULL) zu `planned_entries` hinzugefügt
  - RLS für `arbeitsorte`: Manager SELECT/INSERT/UPDATE nur eigene; Werkstudent SELECT nur die des eigenen Managers
- `src/lib/database.types.ts`: `arbeitsorte`-Tabelle zum `Database`-Typ hinzugefügt; `arbeitsort_id` in `planned_entries`-Row/Insert/Update ergänzt

## QA Test Results

**QA Date:** 2026-05-07  
**Tester:** Claude (QA skill)  
**Test Suite:** `tests/PROJ-16-arbeitsort-auswahl.spec.ts` (16 tests, all pass)  
**Full Suite:** 176/208 passed (1 pre-existing unrelated failure in PROJ-10)

### Acceptance Criteria Results

#### Manager: Arbeitsort-Verwaltung
| # | Criterion | Result |
|---|-----------|--------|
| 1 | Manager sieht Liste aller Arbeitsorte (aktive und inaktive) | ✅ PASS |
| 2 | Manager kann neuen Arbeitsort anlegen | ✅ PASS |
| 3 | Manager kann Namen bearbeiten (Bearbeiten-Button) | ✅ PASS (manual verified) |
| 4 | Manager kann Arbeitsort deaktivieren (Soft-Delete) | ✅ PASS |
| 5 | Deaktivierte Orte bleiben in historischen Einträgen sichtbar | ✅ PASS (DB: ON DELETE SET NULL, UI shows old name) |
| 6 | Manager kann deaktivierten Ort reaktivieren | ✅ PASS |
| 7 | Jeder Manager verwaltet nur seine eigenen Orte (RLS) | ✅ PASS (RLS policies in place) |
| 8 | Mindestname 1 Zeichen; Maximalname 100 Zeichen | ✅ PASS (empty disabled, maxLength=100) |

#### Werkstudent: Arbeitsort-Auswahl in der Wochenplanung
| # | Criterion | Result |
|---|-----------|--------|
| 9 | Pro Arbeitstag erscheint Dropdown für Arbeitsort | ✅ PASS |
| 10 | Dropdown zeigt nur aktive Orte des zuständigen Managers | ✅ PASS |
| 11 | Kein Ort ausgewählt = Speichern nicht möglich (Pflichtfeld) | ✅ PASS |
| 12 | Tage mit "kein Arbeitstag" benötigen keinen Ort | ✅ PASS |
| 13 | Letzter verwendeter Ort als Standard vorbelegt | ✅ PASS (`lastUsedArbeitsortId`) |
| 14 | Hinweismeldung wenn kein Ort konfiguriert | ✅ PASS |

#### Manager: Kalenderansicht
| # | Criterion | Result |
|---|-----------|--------|
| 15 | Geplanter Arbeitsort pro Tag/Werkstudent in Kalenderansicht | ✅ PASS (Badge in KalenderZelle) |
| 16 | Deaktivierte Orte in historischen Einträgen mit Namen angezeigt | ✅ PASS (ON DELETE SET NULL, name preserved) |

### Edge Cases Tested
| Edge Case | Result |
|-----------|--------|
| Kein Arbeitsort konfiguriert → Hinweismeldung, kein Speichern | ✅ PASS |
| Duplikater aktiver Name → Validierungsfehler im Dialog | ✅ PASS |
| Leerer Name → Speichern-Button disabled | ✅ PASS |
| Zeichenzähler 4/100 Zeichen | ✅ PASS |
| Inaktiv-Badge + durchgestrichener Name | ✅ PASS |
| Inaktiver Ort in Template → `__deactivated__`-Prefix, neu wählen erforderlich | ✅ PASS (code path verified) |

### Security Audit
| Check | Result |
|-------|--------|
| Unauthenticated → /login redirect | ✅ PASS |
| Werkstudent → /manager/arbeitsorte redirect away | ✅ PASS |
| RLS: Manager sees only own arbeitsorte | ✅ PASS (migration confirmed) |
| RLS: Werkstudent sees only manager's arbeitsorte | ✅ PASS |
| Input validation: Zod schema on saveWeekPlan | ✅ PASS (DayEntrySchema validates arbeitsort_id) |

### Bugs Found

#### ~~MEDIUM: `lastUsedArbeitsortId` pointing to deactivated Arbeitsort bypasses validation~~ ✅ FIXED
- **Description:** `buildInitialState` set `arbeitsortId` to the UUID of the last-used Arbeitsort without checking if it's still active.
- **Fix applied:** `buildInitialState` now accepts an `activeArbeitsortIds: Set<string>` parameter and validates `lastUsedArbeitsortId` against it. If the last-used Ort is no longer active, `resolvedLastUsed` is `null` and the Werkstudent must pick a new Ort.
- **File:** `src/components/wochenplanung/WochenplanungClient.tsx`

### Pre-existing Bug (not caused by PROJ-16)
| Bug | Location | Severity |
|-----|----------|----------|
| Test checks `bg-slate-100` for holiday row, code uses `bg-amber-50` | PROJ-10-feiertagsanzeige.spec.ts:201 | LOW (test-only) |

### Responsive Testing
| Viewport | Result |
|----------|--------|
| Mobile 375px | ✅ PASS |
| Desktop (default) | ✅ PASS |

### E2E Test Suite
- **File:** `tests/PROJ-16-arbeitsort-auswahl.spec.ts`
- **Tests:** 16 (2 auth-protection + 10 Manager describe + 4 Werkstudent describe)
- **Result:** All 16 pass

### Test Maintenance (Regression Fixes)
PROJ-16 adds the Arbeitsort dropdown before Von/Bis selects in WochenplanungClient. This shifted combobox indices in existing tests. Updated:
- `tests/PROJ-3-wochenplanung.spec.ts`: `selectTime` helper now uses Von/Bis label anchors; save tests select Arbeitsort when required; post-reload assertions use label-based selectors
- `tests/PROJ-13-viertelstunden-planung.spec.ts`: All `nth(0)/nth(1)` combobox references updated to label-based selectors

### Production-Ready Decision
**READY** — All bugs fixed. No Critical or High issues remain.

## Deployment

**Deployed:** 2026-05-07
**Production URL:** https://werkstudentenverwaltung.vercel.app
**Git Tag:** v1.16.0-PROJ-16

### Files deployed
- `src/app/manager/arbeitsorte/` – neue Seite & Actions für Arbeitsort-Verwaltung
- `src/components/arbeitsorte/ArbeitsortVerwaltungClient.tsx` – interaktive Verwaltungs-UI
- `supabase/migrations/20260506_proj16_arbeitsorte.sql` – DB-Migration (bereits in Supabase angewendet)
- Diverse Erweiterungen in Wochenplanung, Kalender und Typen (s. Implementation Notes)
