# PROJ-25: Manager-Zeitkorrektur

## Status: In Review
**Created:** 2026-05-07
**Last Updated:** 2026-05-07

## Dependencies
- Requires: PROJ-1 (Authentication) – Manager muss eingeloggt sein
- Requires: PROJ-4 (Tages-Zeiterfassung) – Ist-Einträge in `time_entries` müssen vorhanden sein
- Requires: PROJ-6 (Auswertung & Export) – Einstiegspunkt für die Korrektur-UI
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – Korrekturen betreffen einzelne Zeitblöcke
- Requires: PROJ-19 (Bereichs-Datenisolation) – Manager darf nur Einträge seines Bereichs bearbeiten

## User Stories
- Als Manager möchte ich in der Auswertungsansicht Start- und Endzeit eines Zeiteintrags eines Werkstudenten korrigieren, damit ich fehlerhafte Buchungen beheben kann.
- Als Manager möchte ich einen neuen Zeiteintrag für einen Werkstudenten anlegen, damit vergessene Stempelungen nachgetragen werden können.
- Als Manager möchte ich einen falschen Zeiteintrag eines Werkstudenten löschen, damit fälschlich gebuchte Arbeitszeiten entfernt werden können.
- Als Manager möchte ich bei jeder Korrektur eine Begründung/Notiz hinterlegen, damit die Änderung für alle Beteiligten nachvollziehbar ist.
- Als Werkstudent möchte ich sehen, wenn einer meiner Einträge vom Manager korrigiert wurde (inkl. Notiz), damit ich verstehe, was geändert wurde.
- Als Manager möchte ich, dass Korrekturen nur möglich sind, solange ein Eintrag noch nicht genehmigt ist, damit genehmigte Zeiträume unveränderlich bleiben.

## Acceptance Criteria

### Einstieg aus der Auswertung
- [ ] In der Detailansicht eines Werkstudenten in `/manager/auswertung` erhält jeder Zeiteintrag ein Bearbeiten-Icon (Stift) und ein Löschen-Icon (Mülleimer)
- [ ] Unterhalb der Einträge eines Tages gibt es eine Schaltfläche „+ Eintrag hinzufügen" zum Anlegen eines neuen Blocks für diesen Tag
- [ ] Einträge mit Status `approved` zeigen die Icons grau/deaktiviert an und können nicht bearbeitet werden

### Bearbeiten eines Eintrags
- [ ] Ein Klick auf das Bearbeiten-Icon öffnet einen Dialog mit Feldern für Start-Uhrzeit, End-Uhrzeit (Viertelstunden-Genauigkeit, analog PROJ-13) und einem Freitextfeld „Begründung" (Pflichtfeld, max. 200 Zeichen)
- [ ] Validierung: Startzeit muss vor Endzeit liegen; beide Felder sind Pflichtfelder
- [ ] Speichern aktualisiert den Eintrag und setzt `corrected_by` (Manager-ID) und `corrected_at` (Timestamp)
- [ ] Der korrigierte Eintrag trägt in der UI ein kleines „Bearbeitet"-Badge, damit Werkstudenten und Manager die Änderung erkennen

### Neuen Eintrag anlegen
- [ ] Der Dialog „Eintrag hinzufügen" enthält Felder für Datum, Start-Uhrzeit, End-Uhrzeit und Begründung (Pflichtfeld)
- [ ] Es dürfen mehrere Blöcke pro Tag existieren (konsistent mit PROJ-8)
- [ ] Neu angelegte Einträge erhalten ebenfalls `corrected_by` und `corrected_at`

### Löschen eines Eintrags
- [ ] Ein Klick auf das Löschen-Icon öffnet einen Bestätigungs-Dialog mit Pflichtfeld „Begründung"
- [ ] Nach Bestätigung wird der Eintrag aus `time_entries` entfernt; ein Lösch-Log-Eintrag wird in `time_entry_corrections` gespeichert
- [ ] Das Löschen ist nur möglich, solange der Eintrag nicht den Status `approved` hat

### Werkstudenten-Ansicht
- [ ] Im Werkstudenten-Dashboard (WochenIstübersicht) wird korrigierte Einträge mit einem „Bearbeitet"-Badge markiert
- [ ] Das Badge zeigt bei Hover/Tooltip die Begründung des Managers an

### Approval-Status (Datenbankebene)
- [ ] Die Tabelle `time_entries` erhält ein Feld `status` (Enum: `draft`, `approved`; Default: `draft`)
- [ ] Alle bestehenden Einträge werden bei der Migration auf `draft` gesetzt
- [ ] Serverseitige Server Actions prüfen vor jeder Schreiboperation: Einträge mit `status = approved` dürfen nicht verändert oder gelöscht werden (HTTP 403 bei Versuch)
- [ ] Die Genehmigungslogik (wer genehmigt, wann, wie) ist **nicht** Teil dieses Features und wird in einem Folge-Feature definiert

### Berechtigungen & Isolation
- [ ] Nur Manager dürfen Korrekturen durchführen; Werkstudenten haben keine Schreibrechte auf fremde Einträge
- [ ] RLS stellt sicher, dass ein Manager nur Einträge von Werkstudenten seines eigenen Bereichs bearbeiten kann

## Edge Cases
- Was passiert, wenn der Manager einen Eintrag so ändert, dass er ein Wochenstundenlimit überschreitet? → Warnung wird angezeigt (nicht-blockierend), Speichern bleibt möglich
- Was passiert, wenn ein Werkstudent aus dem Bereich entfernt wird, während eine Korrektur offen ist? → Bestehende `draft`-Einträge bleiben erhalten; der Manager verliert nur Schreibzugriff, wenn der Werkstudent in einen anderen Bereich wechselt
- Was passiert, wenn ein Eintrag gelöscht wird, der der einzige Ist-Eintrag an einem Tag war? → Tag erscheint in der Auswertung als „ohne Ist-Stunden"; kein Fehler
- Was passiert, wenn gleichzeitig Manager und Werkstudent denselben Eintrag bearbeiten? → Last-Write-Wins (kein pessimistisches Locking); keine besondere Behandlung für MVP
- Was passiert, wenn das Begründungsfeld leer eingereicht wird? → Server Action lehnt die Anfrage ab (HTTP 422, Validierungsfehler)
- Was passiert, wenn ein Manager einen bereits genehmigten Eintrag über die API direkt ansprechen will? → RLS + Server Action blockt dies mit HTTP 403

## Technical Requirements
- **Neue Tabelle `time_entry_corrections`** (Audit-Log): `id`, `time_entry_id` (FK, nullable bei Lösch-Operationen), `action` (Enum: `edit`, `create`, `delete`), `manager_id`, `corrected_at`, `reason` (text), `old_start`, `old_end`, `new_start`, `new_end`
- **Erweiterung `time_entries`**: neue Spalten `status` (text, default `'draft'`), `corrected_by` (UUID, FK auf `profiles`, nullable), `corrected_at` (Timestamptz, nullable), `correction_note` (text, nullable)
- **Server Actions** in `/manager/auswertung/correction-actions.ts`: `updateTimeEntry`, `createTimeEntry`, `deleteTimeEntry` – jeweils mit Manager-Rollen-Check und Status-Check
- **RLS**: Manager darf `time_entries` seines Bereichs lesen und schreiben; Werkstudenten haben nur Lesezugriff auf eigene `draft`-Einträge; `approved`-Einträge sind für alle schreibgeschützt
- **UI**: Bearbeiten/Löschen-Dialog als shadcn `<Dialog>` mit `react-hook-form` + Zod-Validierung; kein neuer Page-Level-Router nötig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Dieses Feature erweitert die bestehende Auswertungsansicht (`/manager/auswertung`) um Schreibrechte für Manager. Es wird kein neuer Seitenbereich benötigt – die Korrektur-UI fügt sich als Dialogschicht in die vorhandene Tabellenstruktur ein.

---

### A) Komponentenstruktur (UI-Baum)

```
/manager/auswertung (bestehende Seite)
  └── AuswertungTable (bestehend)
        └── WerkstudentZeile (bestehend)
              └── TagDetailZeile (bestehend → wird erweitert)
                    ├── [Bearbeiten-Icon] → öffnet ZeitkorrektureDialog
                    ├── [Löschen-Icon]    → öffnet ZeiteintragLoeschenDialog
                    └── [+ Eintrag hinzufügen] → öffnet ZeiteintragHinzufuegenDialog
                          
  Neue Dialog-Komponenten (jeweils shadcn <Dialog>):
  ├── ZeitkorrektureDialog
  │     ├── Startzeit-Feld (Select, Viertelstunden-Genauigkeit)
  │     ├── Endzeit-Feld   (Select, Viertelstunden-Genauigkeit)
  │     └── Begründung-Feld (Textarea, Pflichtfeld, max. 200 Zeichen)
  │
  ├── ZeiteintragHinzufuegenDialog
  │     ├── Datum-Feld (vorausgefüllt mit dem betreffenden Tag)
  │     ├── Startzeit-Feld
  │     ├── Endzeit-Feld
  │     └── Begründung-Feld (Pflichtfeld)
  │
  └── ZeiteintragLoeschenDialog
        └── Begründung-Feld (Pflichtfeld) + Bestätigungs-Button

/dashboard/wochenplanung (Werkstudenten-Ansicht)
  └── WochenIstübersicht (bestehend → Badge-Anzeige ergänzen)
        └── "Bearbeitet"-Badge (bei corrected_by ≠ null)
              └── Tooltip mit Begründungstext
```

---

### B) Datenmodell (Klartext)

#### Erweiterung der bestehenden Tabelle `time_entries`
Vier neue Felder werden ergänzt:

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `status` | Text (draft / approved) | Schreibschutz-Zustand; Default: `draft` |
| `corrected_by` | UUID (optional) | ID des Managers, der zuletzt korrigiert hat |
| `corrected_at` | Zeitstempel (optional) | Zeitpunkt der letzten Korrektur |
| `correction_note` | Text (optional) | Begründung der letzten Korrektur |

Alle bestehenden Einträge werden bei der Migration automatisch auf `status = draft` gesetzt.

#### Neue Tabelle `time_entry_corrections` (Audit-Log)
Jede Schreibaktion des Managers erzeugt einen unveränderlichen Log-Eintrag:

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `id` | UUID | Primärschlüssel |
| `time_entry_id` | UUID (optional) | Referenz auf den betroffenen Eintrag (null bei Löschung) |
| `action` | Enum (edit / create / delete) | Art der Korrektur |
| `manager_id` | UUID | Wer hat die Aktion ausgeführt |
| `corrected_at` | Zeitstempel | Wann wurde die Aktion ausgeführt |
| `reason` | Text | Begründung (Pflichtfeld) |
| `old_start` / `old_end` | Zeit (optional) | Alte Werte vor der Änderung |
| `new_start` / `new_end` | Zeit (optional) | Neue Werte nach der Änderung |

Der Audit-Log ist append-only – Einträge werden nie verändert oder gelöscht.

---

### C) Technische Entscheidungen (Begründung)

**Keine neue Route, nur Dialoge:** Die Korrektur-UI sitzt als Modal-Schicht über der bestehenden Auswertungstabelle. Das vermeidet Navigation und hält den Kontext (welcher Werkstudent, welcher Zeitraum) sichtbar.

**Viertelstunden-Genauigkeit via Select:** Konsistent mit PROJ-13 – freie Texteingabe für Uhrzeiten führt zu Validierungsfehlern; ein Select-Dropdown begrenzt die Eingabe auf gültige Werte.

**Audit-Log als separate Tabelle (nicht nur Felder in `time_entries`):** Mehrfache Korrekturen desselben Eintrags würden sonst frühere Begründungen überschreiben. Die separate Tabelle bewahrt die vollständige Änderungshistorie.

**`status`-Feld nur als Vorbereitung:** Die Genehmigungslogik (wer genehmigt, wann) kommt in einem Folge-Feature. Hier wird nur der `draft`-Zustand eingeführt und der Schreibschutz für `approved`-Einträge serverseitig erzwungen.

**Server Actions statt API-Route:** Alle Schreiboperationen laufen über Next.js Server Actions in `correction-actions.ts` – konsistent mit dem Rest des Projekts, kein separater API-Endpunkt notwendig.

---

### D) Berechtigungen & Datenisolation

- **RLS (Datenbankebene):** Nur Manager dürfen `time_entries` anderer Nutzer schreiben. Ein Manager kann ausschließlich Einträge von Werkstudenten seines eigenen Bereichs ändern (bereits durch PROJ-19 vorbereitet).
- **Server Action Guard:** Vor jeder Schreiboperation wird `status` geprüft. Einträge mit `status = approved` werden mit einem Fehler abgelehnt.
- **Werkstudenten:** Haben weiterhin nur Lesezugriff auf ihre eigenen Einträge.

---

### E) Abhängigkeiten & neue Packages

Keine neuen npm-Pakete erforderlich. Alle benötigten UI-Bausteine sind bereits installiert:
- `shadcn/ui Dialog` – für alle drei Korrektur-Dialoge
- `react-hook-form` + `Zod` – für Formularvalidierung
- Bestehende `Select`-Komponente – für Zeitauswahl in Viertelstunden

---

### F) Neue Dateien im Überblick

| Datei | Zweck |
|-------|-------|
| `src/app/manager/auswertung/correction-actions.ts` | Server Actions: updateTimeEntry, createTimeEntry, deleteTimeEntry |
| `src/components/manager/auswertung/ZeitkorrektureDialog.tsx` | Bearbeiten-Dialog |
| `src/components/manager/auswertung/ZeiteintragHinzufuegenDialog.tsx` | Neu-Anlegen-Dialog |
| `src/components/manager/auswertung/ZeiteintragLoeschenDialog.tsx` | Löschen-Bestätigungs-Dialog |
| `supabase/migrations/YYYYMMDD_proj25_zeitkorrektur.sql` | DB-Migration (neue Felder + neue Tabelle) |

Geänderte Dateien:
| Datei | Was ändert sich |
|-------|-----------------|
| `src/components/manager/auswertung/TagDetailZeile.tsx` | Icons + Dialog-Trigger ergänzen |
| `src/components/zeiterfassung/WochenIstübersicht.tsx` | „Bearbeitet"-Badge + Tooltip |
| `src/lib/database.types.ts` | Neue Typen für `status`, `correction_note`, neue Tabelle |

## Implementation Notes (Frontend)

### New Files
- `supabase/migrations/20260509_proj25_zeitkorrektur.sql` — Adds `status`, `corrected_by`, `corrected_at`, `correction_note` to `actual_entries`; creates `time_entry_corrections` audit log table with RLS
- `src/app/manager/auswertung/correction-actions.ts` — Server Actions: `updateTimeEntry`, `createTimeEntry`, `deleteTimeEntry` (with manager bereich check + approved-status guard)
- `src/components/manager/auswertung/ZeitkorrektureDialog.tsx` — Bearbeiten-Dialog (Viertelstunden-Select + Begründungsfeld)
- `src/components/manager/auswertung/ZeiteintragHinzufuegenDialog.tsx` — Neu-Anlegen-Dialog
- `src/components/manager/auswertung/ZeiteintragLoeschenDialog.tsx` — Löschen-Bestätigungs-Dialog

### Changed Files
- `src/lib/database.types.ts` — Added `status/corrected_by/corrected_at/correction_note` to `actual_entries` Row/Insert/Update; added `time_entry_corrections` table type; extended `ActualEntry` type; added `TimeEntryCorrection` type
- `src/app/manager/auswertung/actions.ts` — Added `IstEintragDetail` interface; extended `TagDetail.istEintraege`; extended query to fetch new fields
- `src/components/manager/auswertung/TagDetailZeile.tsx` — Per-entry sub-rows with Bearbeiten (Pencil) + Löschen (Trash) icons; "+ Eintrag hinzufügen" row; all three dialogs wired up; approved entries show gray/disabled icons
- `src/components/manager/auswertung/WerkstudentZeile.tsx` — Added `onCorrectionDone` prop; added 6th header column for Aktionen
- `src/components/manager/auswertung/AuswertungTable.tsx` — Added `onCorrectionDone` prop passthrough
- `src/app/manager/auswertung/AuswertungClient.tsx` — Added `handleCorrectionDone` callback that reloads data
- `src/components/zeiterfassung/WochenIstübersicht.tsx` — "Bearbeitet" badge on corrected entries; Tooltip shows correction note

### Deviations
- The day detail dialog in `WochenIstübersicht` shows the Bearbeitet badge per-entry; multi-block days show a "Bearbeitet" badge on the summary row (without tooltip, since the note belongs to individual entries)
- Viertelstunden-Genauigkeit via Select is used (00:00–23:45 range)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
