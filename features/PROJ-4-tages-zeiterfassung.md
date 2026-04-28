# PROJ-4: Tages-Zeiterfassung (Einstempeln / Ausstempeln)

## Status: Planned
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Dependencies
- Requires: PROJ-1 (Authentication) – Werkstudent muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – Wochenstundenlimit muss konfiguriert sein
- Relates to: PROJ-3 (Wochenplanung) – Ist-Daten werden gegen Plan verglichen

## User Stories
- Als Werkstudent möchte ich mich morgens mit einem Klick einstempeln, damit meine tatsächliche Ankunftszeit festgehalten wird.
- Als Werkstudent möchte ich mich abends mit einem Klick ausstempeln, damit die geleisteten Stunden für den Tag berechnet werden.
- Als Werkstudent möchte ich meine Ist-Zeiten für vergangene Tage nachträglich bearbeiten, wenn ich das Einstempeln vergessen habe.
- Als Werkstudent möchte ich eine Übersicht meiner Ist-Stunden der aktuellen Woche sehen, damit ich weiß, wie viele Stunden ich bisher gearbeitet habe.
- Als Werkstudent möchte ich eine Warnung sehen, wenn meine Ist-Stunden das Wochenlimit überschreiten.

## Acceptance Criteria
- [ ] Auf dem Dashboard gibt es einen prominenten „Einstempeln"-Button, der die aktuelle Uhrzeit als Startzeit speichert
- [ ] Nach dem Einstempeln wechselt der Button zu „Ausstempeln"; Einstempeln erneut ist nicht möglich bis zum Ausstempeln
- [ ] Ausstempeln speichert die aktuelle Uhrzeit als Endzeit und berechnet die geleisteten Stunden für den Tag
- [ ] Werkstudent sieht pro Tag: geplante Start/Endzeit, tatsächliche Start/Endzeit, Differenz in Stunden
- [ ] Vergangene Ist-Einträge (auch mehrere Tage zurück) können manuell bearbeitet werden
- [ ] Es kann maximal ein Ist-Eintrag pro Tag und Person gespeichert werden
- [ ] Die Wochensumme der Ist-Stunden wird angezeigt
- [ ] Bei Überschreitung des Wochenstundenlimits durch Ist-Stunden erscheint eine Warnung
- [ ] Einträge aus der Zukunft können nicht eingestempelt werden

## Edge Cases
- Was passiert, wenn ein Werkstudent vergisst auszustempeln und am nächsten Tag zur App kommt? → Offener Einstempel wird als unvollständiger Eintrag markiert; Nutzer wird aufgefordert, die Endzeit manuell zu ergänzen
- Was passiert, wenn Start- und Endzeit manuell so eingegeben werden, dass Start > Ende ist? → Validierungsfehler, Speichern blockiert
- Was passiert, wenn ein Werkstudent mehr als 10 Stunden an einem Tag einträgt? → Warnung, aber kein Block (könnte legitimate Sonderarbeit sein)
- Was passiert, wenn an einem Tag kein Plan existiert, aber eine Ist-Zeit eingetragen wird? → Eintrag ist gültig; in der Auswertung erscheint er als „ungeplante Stunden"
- Was passiert an Wochenenden? → Einstempeln ist technisch möglich, wird aber mit Hinweis markiert (Wochenendarbeit)

## Technical Requirements
- **Datenbankstruktur:** Tabelle `actual_entries` mit Feldern: `id`, `user_id`, `date`, `actual_start`, `actual_end`, `is_complete`, `created_at`, `updated_at`
- **RLS:** Werkstudenten lesen/schreiben nur ihre eigenen Einträge; Manager lesen alle
- **Stempel-Logik:** Serverseitige Timestamp-Erfassung beim Einstempeln (nicht clientseitig), um Manipulation zu vermeiden
- **Berechnung:** Stundensummen werden clientseitig aus `actual_start` und `actual_end` berechnet

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
