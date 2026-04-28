# PROJ-6: Auswertung & Export

## Status: Planned
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Dependencies
- Requires: PROJ-1 (Authentication) – Manager muss eingeloggt sein
- Requires: PROJ-3 (Wochenplanung) – Plan-Daten für Vergleich
- Requires: PROJ-4 (Tages-Zeiterfassung) – Ist-Daten für Vergleich
- Requires: PROJ-2 (Nutzerverwaltung) – Werkstudenten-Profile

## User Stories
- Als Manager möchte ich für jeden Werkstudenten eine monatliche Auswertung mit geplanten und tatsächlichen Stunden sehen, damit ich die Einhaltung des Stundenlimits prüfen kann.
- Als Manager möchte ich einen Plan-vs-Ist-Vergleich pro Person und Woche sehen, damit ich systematische Abweichungen erkennen kann.
- Als Manager möchte ich die Auswertung als Excel-Datei exportieren, damit ich sie an die Lohnbuchhaltung weitergeben kann.
- Als Manager möchte ich die Auswertung als PDF exportieren, damit ich sie archivieren oder ausdrucken kann.
- Als Werkstudent möchte ich meine eigene Monatsauswertung sehen, damit ich meine geleisteten Stunden nachverfolgen kann.

## Acceptance Criteria
- [ ] Manager sieht eine Auswertungsseite mit Zeitraumauswahl (Woche / Monat / individueller Datumsbereich)
- [ ] Pro Werkstudent wird angezeigt: geplante Stunden gesamt, geleistete Stunden gesamt, Differenz, Auslastung in %
- [ ] Detailansicht pro Person: tabellarische Auflistung aller Tage mit Plan-Start, Plan-Ende, Ist-Start, Ist-Ende, Differenz pro Tag
- [ ] Werkstudenten, die ihr Wochenstundenlimit überschritten haben, sind rot hervorgehoben
- [ ] Export als Excel (.xlsx): Eine Zeile pro Tag pro Werkstudent, alle relevanten Spalten
- [ ] Export als PDF: Formatierte Tabelle, drucktauglich
- [ ] Werkstudenten sehen nur ihre eigene Auswertung (keine anderen Personen)
- [ ] Auswertung lädt in < 2 Sekunden für Zeiträume bis 3 Monate

## Edge Cases
- Was passiert, wenn ein Werkstudent für manche Tage keinen Plan hat, aber Ist-Stunden? → Ist-Stunden werden als „ungeplant" markiert, Plan-Spalte bleibt leer
- Was passiert, wenn für den gesamten Auswertungszeitraum keine Daten vorliegen? → Leere Tabelle mit Hinweis „Keine Daten für diesen Zeitraum"
- Was passiert, wenn der Export-Zeitraum sehr groß ist (z.B. 1 Jahr)? → Warnung, dass große Exports länger dauern können; kein Block
- Was passiert, wenn mitten im Monat das Stundenlimit eines Werkstudenten geändert wird? → Auswertung zeigt das aktuell gültige Limit; historische Limits werden im MVP nicht versioniert

## Technical Requirements
- **Excel-Export:** Bibliothek `xlsx` (SheetJS) clientseitig oder serverseitig via API-Route
- **PDF-Export:** Bibliothek `jsPDF` oder `@react-pdf/renderer` clientseitig
- **Datenabruf:** Aggregierte Abfragen auf `planned_entries` und `actual_entries` mit Datumsfilter
- **RLS:** Manager lesen alle Daten; Werkstudenten nur eigene
- **Performance:** Für Zeiträume > 1 Monat serverseitige Aggregation empfohlen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
