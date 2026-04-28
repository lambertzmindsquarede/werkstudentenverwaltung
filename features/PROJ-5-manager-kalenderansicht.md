# PROJ-5: Manager-Kalenderansicht

## Status: Planned
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Dependencies
- Requires: PROJ-1 (Authentication) – Manager muss eingeloggt und autorisiert sein
- Requires: PROJ-2 (Nutzerverwaltung) – Werkstudenten-Profile müssen existieren
- Requires: PROJ-3 (Wochenplanung) – Plan-Daten werden angezeigt
- Requires: PROJ-4 (Tages-Zeiterfassung) – Ist-Daten werden angezeigt

## User Stories
- Als Manager möchte ich in einer Wochenkalenderansicht sehen, welche Werkstudenten an welchen Tagen geplant sind, damit ich die Teamverfügbarkeit im Blick habe.
- Als Manager möchte ich auf einen Blick erkennen, ob ein Werkstudent wie geplant erschienen ist oder nicht, damit ich schnell Abweichungen entdecke.
- Als Manager möchte ich zwischen Wochen vor- und zurücknavigieren, damit ich vergangene und zukünftige Wochen einsehen kann.
- Als Manager möchte ich die Kalenderansicht nach einzelnen Werkstudenten filtern, damit ich mich auf bestimmte Personen konzentrieren kann.
- Als Manager möchte ich mit einem Klick auf einen Eintrag die Details (geplante vs. tatsächliche Zeit) sehen.

## Acceptance Criteria
- [ ] Manager sieht eine Wochenansicht (Mo–Fr) mit allen aktiven Werkstudenten als Zeilen
- [ ] Pro Zelle (Person × Tag) wird angezeigt: geplante Zeit (falls vorhanden) und Ist-Zeit (falls vorhanden)
- [ ] Farbkodierung: Nur Plan = grau, Nur Ist = gelb/orange (ungeplant), Plan + Ist vorhanden = grün (anwesend), Plan aber kein Ist = rot (abwesend/fehlt)
- [ ] Wochennavigation mit Vor/Zurück-Buttons und Anzeige des aktuellen Datumrahmens
- [ ] Filter: Manager kann einzelne Werkstudenten aus der Ansicht ausblenden
- [ ] Klick auf eine Zelle öffnet eine Detail-Ansicht mit exakten Uhrzeiten und Stundendifferenz
- [ ] Heute wird visuell hervorgehoben
- [ ] Werkstudenten ohne Plan und ohne Ist-Eintrag zeigen eine leere Zelle

## Edge Cases
- Was passiert, wenn ein Werkstudent an einem Tag mehrere Ist-Einträge hätte? → Im MVP maximal ein Ist-Eintrag pro Tag (vgl. PROJ-4); Zelle zeigt diesen einen Eintrag
- Was passiert, wenn der Manager sehr viele Werkstudenten (>20) hat? → Tabelle wird scrollbar; kein Paging im MVP
- Was passiert, wenn es für eine Woche keinerlei Daten gibt? → Leere Kalenderansicht ohne Fehler
- Was passiert, wenn der Manager auf eine Detailzelle für die Zukunft klickt? → Nur Plan-Daten werden gezeigt, Ist-Felder sind leer

## Technical Requirements
- **Datenabruf:** Kombinierte Abfrage aus `planned_entries` und `actual_entries` für den jeweiligen Wochenzeitraum, gefiltert nach aktiven Nutzern
- **RLS:** Nur Manager haben Lesezugriff auf alle Nutzereinträge
- **Performance:** Kalender lädt Daten für eine Woche in < 500ms
- **Responsive:** Tabelle ist horizontal scrollbar auf kleinen Bildschirmen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
