# PROJ-3: Wochenplanung

## Status: Planned
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
