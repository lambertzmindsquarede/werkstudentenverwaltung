# Product Requirements Document

## Vision
Eine interne Web-Applikation zur Verwaltung von Werkstudenten-Arbeitszeiten bei mindsquare. Werkstudenten planen ihre wöchentliche Anwesenheit und erfassen ihre tatsächlich geleisteten Stunden. Manager erhalten einen zentralen Überblick über geplante und tatsächliche Anwesenheiten sowie Auswertungstools zum Vergleich und Export.

## Target Users

### Werkstudenten
Studenten, die in Teilzeit arbeiten (max. 20h/Woche). Sie müssen ihre Anwesenheitszeiten vorausplanen und täglich einstempeln. Ihr Schmerz: Manuelle Stundenzettel, keine Übersicht über verbrauchte Stunden.

### Manager / Vorgesetzte
Teamleiter oder HR-Verantwortliche, die einen Überblick über die Verfügbarkeit und Anwesenheit aller Werkstudenten im Team benötigen. Ihr Schmerz: Keine zentrale Übersicht, Abweichungen zwischen Plan und Realität schwer nachvollziehbar.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1: Authentication (Azure AD SSO) | Planned |
| P0 (MVP) | PROJ-2: Nutzerverwaltung | Planned |
| P0 (MVP) | PROJ-3: Wochenplanung | Planned |
| P0 (MVP) | PROJ-4: Tages-Zeiterfassung | Planned |
| P1 | PROJ-5: Manager-Kalenderansicht | Planned |
| P1 | PROJ-6: Auswertung & Export | Planned |

## Success Metrics
- Alle Werkstudenten nutzen die App täglich zum Einstempeln (100% Adoption)
- Manager hat jederzeit eine aktuelle Übersicht über Anwesenheiten (kein manuelles Nachfragen)
- Abweichungen Plan vs. Ist sind sofort sichtbar
- Export für Lohnbuchhaltung spart mindestens 2h/Monat pro Manager

## Constraints
- **Team:** Kleines Entwicklungsteam, keine feste Deadline
- **Authentifizierung:** Nur Azure AD SSO (keine separaten Konten)
- **Rechtlich:** Werkstudenten dürfen max. 20h/Woche arbeiten (§ 20 SGB IV)
- **Tech:** Next.js + Supabase + Vercel

## Non-Goals
- Kein Urlaubsantragssystem
- Keine Gehaltsabrechnung oder Lohnzahlung
- Keine Aufgaben-/Projektmanagement-Funktionen
- Kein Onboarding-/Bewerbungsmanagement
- Keine Mobile App (nur Web, responsive)
