# PROJ-15: Änderungsbenachrichtigung für Manager

## Status: Planned
**Created:** 2026-05-05
**Last Updated:** 2026-05-05

## Dependencies
- Requires: PROJ-2 (Nutzerverwaltung) – wird um Manager-Zuordnung erweitert
- Requires: PROJ-4 (Tages-Zeiterfassung) – Zeiteinträge, die geändert werden
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – mehrere Zeitblöcke als Änderungsobjekte
- Requires: PROJ-9 (Pausenerfassung) – Pausen als Änderungsobjekte
- Relates to: PROJ-14 (Bearbeitungsfrist) – definiert, für welche vergangenen Tage Änderungen erlaubt sind

## Summary
Wenn ein Werkstudent eine vergangene Buchung (Zeiterfassung oder Pause) nachträglich bearbeitet, wird eine E-Mail-Benachrichtigung an den zuständigen Manager gesendet. Der Versand erfolgt täglich um 08:00 Uhr als Sammelmail mit allen Änderungen des Vortages. Nur Änderungen an vergangenen Tagen (nicht der laufende Tag) lösen eine Benachrichtigung aus.

## User Stories

- Als Manager möchte ich täglich um 08:00 Uhr eine Sammelmail mit allen nachträglichen Buchungsänderungen meiner Werkstudenten erhalten, damit ich Abweichungen ohne manuelles Nachfragen nachvollziehen kann.
- Als Manager möchte ich in der Mail sehen, wer die Änderung vorgenommen hat, welcher Tag betroffen war sowie den alten und neuen Wert, damit ich die Änderung einordnen kann.
- Als Admin/Manager möchte ich in der Nutzerverwaltung jedem Werkstudenten einen Vorgesetzten zuweisen können, damit die Benachrichtigungen an die richtige Person gehen.
- Als Werkstudent möchte ich beim Speichern einer vergangenen Buchung darauf hingewiesen werden, dass mein Vorgesetzter benachrichtigt wird, damit ich bewusst entscheide.

## Acceptance Criteria

- [ ] In der Nutzerverwaltung (PROJ-2) kann jedem Werkstudenten ein Manager (Vorgesetzter) zugewiesen werden; das Feld ist optional
- [ ] Jede Änderung an einem vergangenen `actual_entries`-Eintrag (Zeitblock-Start/-Ende) wird in einer Audit-Tabelle (`booking_change_log`) protokolliert
- [ ] Jede Änderung an einem vergangenen `break_entries`-Eintrag (Pausen-Start/-Ende) wird ebenfalls in `booking_change_log` protokolliert
- [ ] Als „vergangen" gilt: Einträge mit `date < heute (Europe/Berlin)`; Änderungen am laufenden Tag lösen keine Mail aus
- [ ] Täglich um 08:00 Uhr (Europe/Berlin) wird ein Cron-Job ausgeführt, der alle Änderungen seit der letzten Ausführung (letzten 24 Stunden) verarbeitet
- [ ] Pro Manager wird pro betroffenen Werkstudenten eine eigene E-Mail versendet
- [ ] Die Betreffzeile lautet exakt: `Werkstudentenverwaltung es wurde ein Eintrag von [Vorname Nachname] geändert`
- [ ] Der Mailinhalt enthält je Änderung: betroffener Tag (Datum ausgeschrieben), Art der Buchung (Zeiterfassung / Pause), alter Wert, neuer Wert, Zeitstempel der Änderung
- [ ] Wenn kein Werkstudent des Managers im Zeitraum Änderungen vorgenommen hat, wird keine Mail versendet
- [ ] Der Werkstudent sieht beim Speichern einer vergangenen Buchung einen Hinweis: „Dein Vorgesetzter wird über diese Änderung informiert"
- [ ] Ist einem Werkstudenten kein Manager zugewiesen, wird die Änderung protokolliert, aber keine Mail versendet

## Edge Cases

- Was passiert, wenn ein Werkstudent am laufenden Tag (heute) seine Zeiterfassung bearbeitet? → Keine Benachrichtigung; nur vergangene Tage lösen Mails aus
- Was passiert, wenn mehrere Werkstudenten desselben Managers an einem Tag Änderungen vornehmen? → Je Werkstudent eine separate Mail (nicht gebündelt in einer Mail), damit die Betreffzeile klar ist
- Was passiert, wenn ein Werkstudent keinen zugewiesenen Manager hat? → Änderung wird im `booking_change_log` gespeichert; keine Mail; kein Fehler für den Endnutzer; technisches Log-Entry
- Was passiert, wenn der Cron-Job ausfällt? → Beim nächsten Lauf werden alle unverarbeiteten Einträge seit dem letzten erfolgreichen Lauf nachgeholt (Timestamp-basiert, kein Datenverlust)
- Was passiert, wenn der Manager keine E-Mail-Adresse hinterlegt hat? → Mail kann nicht versendet werden; Fehler wird serverseitig geloggt; kein Absturz
- Was passiert, wenn eine Buchung mehrfach geändert wird (z.B. erst 09:00, dann 09:15, dann 09:30)? → Alle Änderungen werden einzeln protokolliert; die Mail listet alle Änderungen des Tages (mit Zeitstempel), nicht nur die letzte
- Was passiert, wenn eine Buchung gelöscht statt nur geändert wird? → Der alte Wert wird gespeichert, der neue Wert ist „—" (Eintrag gelöscht); Mail-Inhalt macht die Löschung kenntlich

## Technical Requirements

- **Audit-Tabelle:** `booking_change_log` mit Feldern: `id`, `entry_type` (actual_entry / break_entry), `entry_id`, `user_id`, `date`, `field_changed`, `old_value`, `new_value`, `changed_at`, `notified_at` (NULL bis Mail versendet)
- **Manager-Zuordnung:** Feld `manager_id` (FK auf `profiles`) in der `profiles`-Tabelle; kann NULL sein
- **Cron-Job:** Supabase Edge Function, täglich 08:00 Uhr Europe/Berlin; verarbeitet alle `booking_change_log`-Einträge mit `notified_at IS NULL` und `date < today`
- **E-Mail-Service:** Supabase integriertes SMTP / Edge Function mit Fetch
- **RLS:** `booking_change_log` — Werkstudenten können nur eigene Einträge lesen; Manager können Einträge ihrer Werkstudenten lesen; Schreiben nur durch Server (Edge Function / API Route)
- **Trigger-Zeitpunkt:** Audit-Eintrag wird beim Speichern der Änderung erstellt (synchron zur Bearbeitung), nicht erst beim Cron-Job

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Hinweis zur Datenbankstruktur
Pausen werden nicht in einer separaten `break_entries`-Tabelle gespeichert, sondern als `break_minutes`-Feld in `actual_entries` (aus PROJ-9). Der Trigger und das `booking_change_log` behandeln Pausenänderungen daher als Feld-Änderung an `actual_entries`.

### A) Komponenten-Übersicht

```
Nutzerverwaltung (bestehend: /manager/users)
+-- Werkstudenten-Tabelle (erweitert)
    +-- Neue Spalte: "Vorgesetzter" (Dropdown, Manager auswählen)

Werkstudenten-Dashboard (bestehend: /dashboard)
+-- IstEintragEditDialog / StempelCard (erweitert)
    +-- Hinweis-Banner beim Speichern vergangener Buchungen:
        "Dein Vorgesetzter wird über diese Änderung informiert"
        (nur wenn: Datum < heute UND Manager zugewiesen)

Datenbank: Postgres-Trigger
+-- Feuert bei UPDATE auf actual_entries automatisch
+-- Schreibt geänderte Felder in booking_change_log
+-- Kein Eingriff in App-Code nötig

Datenbank: booking_change_log (neue Tabelle)
+-- Audit-Log aller Änderungen an vergangenen Einträgen

Backend: Supabase Edge Function (Cron)
+-- Läuft täglich um 08:00 Uhr Europe/Berlin
+-- Liest booking_change_log (notified_at IS NULL, date < heute)
+-- Gruppiert: pro Manager → pro Werkstudent → eine E-Mail
+-- Sendet E-Mail via SMTP (Zugangsdaten als Supabase Secrets)
+-- Setzt notified_at nach erfolgreichem Versand
```

### B) Datenmodell

**Erweiterung `profiles`-Tabelle:**
- Neues Feld `manager_id` (UUID, optional) → Fremdschlüssel auf `profiles.id` (role = 'manager')
- Werkstudenten bekommen damit genau einen Vorgesetzten; Manager bleiben ohne `manager_id`

**Neue Tabelle `booking_change_log`:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `entry_id` | UUID | Fremdschlüssel → `actual_entries.id` |
| `user_id` | UUID | Fremdschlüssel → `profiles.id` (Werkstudent) |
| `date` | date | Datum des betroffenen Eintrags |
| `field_changed` | text | `actual_start` / `actual_end` / `break_minutes` |
| `old_value` | text (nullable) | Wert vor der Änderung |
| `new_value` | text (nullable) | Wert nach der Änderung (`—` bei Löschung) |
| `changed_at` | timestamptz | Zeitstempel der Änderung |
| `notified_at` | timestamptz (nullable) | NULL bis E-Mail versendet |

### C) Technische Entscheidungen

| Entscheidung | Ansatz | Begründung |
|---|---|---|
| **Änderungs-Logging** | Postgres-Trigger auf `actual_entries UPDATE` | Audit-Log ist unabhängig vom App-Code — wird nie versehentlich ausgelassen |
| **Cron-Job** | Supabase Edge Function (Deno) mit Cron-Scheduler | Direkter DB-Zugriff, kein Vercel-Cron nötig, alles in Supabase |
| **E-Mail-Versand** | SMTP via Edge Function (Deno) | Bestehender SMTP-Account wird genutzt; Credentials als Supabase Secrets hinterlegt |
| **RLS `booking_change_log`** | Werkstudent liest nur eigene Zeilen; Manager liest Zeilen seiner Werkstudenten; Schreiben nur via Service Role (Trigger + Edge Function) | Sicherer Lesezugriff ohne direktes Client-Schreiben |

### D) Ablauf

**Beim Speichern einer Buchungsänderung:**
```
Werkstudent speichert Änderung an vergangenem actual_entries-Eintrag
  → Postgres-Trigger feuert automatisch
  → booking_change_log-Eintrag wird angelegt (notified_at = NULL)
  → UI zeigt Hinweis: "Dein Vorgesetzter wird benachrichtigt"
     (nur wenn Datum < heute UND manager_id gesetzt)
```

**Täglicher Cron-Job:**
```
08:00 Uhr Europe/Berlin
  → Edge Function liest booking_change_log:
      notified_at IS NULL UND date < heute
  → Gruppierung: pro Manager → pro Werkstudent → eine E-Mail
  → E-Mail via SMTP gesendet (Betreff + Änderungsdetails)
  → notified_at = jetzt gesetzt
  → Kein Eintrag? → keine Mail
  → Kein Manager zugewiesen? → Eintrag bleibt, keine Mail, kein Fehler
```

### E) Neue Abhängigkeiten
Keine neuen npm-Pakete. SMTP-Zugangsdaten werden als Supabase Secrets konfiguriert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
