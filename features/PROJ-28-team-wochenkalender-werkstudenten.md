# PROJ-28: Team-Wochenkalender für Werkstudenten

## Status: In Progress
**Created:** 2026-09-22
**Last Updated:** 2026-09-22

## Dependencies
- Requires: PROJ-1 (Authentication) — Nutzer muss eingeloggt sein
- Requires: PROJ-3 (Wochenplanung) — Plan-Zeiten sind die Datenbasis
- Requires: PROJ-5 (Manager-Kalenderansicht) — UI-Vorbild; die Werkstudenten-Variante ist eine abgespeckte Fassung
- Requires: PROJ-17 (Abwesenheitsverwaltung) — Abwesenheiten werden (neutralisiert) angezeigt
- Requires: PROJ-19 (Bereichs-Datenisolation) — Sichtbarkeit ist auf den eigenen Bereich begrenzt
- Relates to: PROJ-20 (Team-Anwesenheitsübersicht) — beantwortet „wer ist heute wo?", PROJ-28 beantwortet „wer ist diese Woche wann da?"

## Overview
Werkstudenten erhalten eine eigene Wochenkalender-Ansicht ihres Bereichs — analog zur Manager-Kalenderansicht (PROJ-5), aber bewusst reduziert: nur Plan-Zeiten, keine Ist-Zeiten, Abwesenheiten ohne Typ, nur aktuelle und zukünftige Wochen. Zweck ist die Selbstorganisation im Team („wann sind meine Kollegen da?"), nicht Kontrolle.

## User Stories
- Als Werkstudent möchte ich die geplanten Anwesenheitszeiten meiner Bereichs-Kollegen für die Woche sehen, damit ich meine eigene Planung (z. B. gemeinsame Bürotage, Übergaben) danach ausrichten kann.
- Als Werkstudent möchte ich im Kalender in zukünftige Wochen blättern, damit ich auch für kommende Wochen absehen kann, wer wann da ist.
- Als Werkstudent möchte ich sehen, wenn ein Kollege abwesend ist (ohne den Grund zu erfahren), damit ich weiß, dass ich nicht mit ihm rechnen kann.
- Als Werkstudent möchte ich meine eigenen Plan-Zeiten in derselben Ansicht sehen, damit ich mich direkt mit dem Team vergleichen kann.
- Als Manager möchte ich, dass Werkstudenten keine Ist-Zeiten und keine Abwesenheitsgründe ihrer Kollegen sehen, damit Leistungs- und Gesundheitsdaten geschützt bleiben.

## Out of Scope
- **Ist-Zeiten / Anwesend-Fehlt-Status der Kollegen** — bewusst ausgeschlossen (Leistungsdaten); bleibt exklusiv in der Manager-Ansicht (PROJ-5)
- **Abwesenheitstypen (Krank/Urlaub/Frei/Sonstiges)** — Kollegen sehen nur neutral „Abwesend"
- **ICS-Download der Team-Planung** — kann später als Erweiterung kommen
- **Personen-/Status-Filter** — bei einem einzelnen Bereich unnötig; ggf. später
- **Blick in vergangene Wochen** — kein Planungsnutzen, unnötige Kontrollmöglichkeit
- **Bereichsübergreifende Sicht** — Sichtbarkeit strikt auf den eigenen Bereich begrenzt; die „global sichtbar"-Team-Einstellung aus PROJ-20 gilt hier NICHT
- **Änderungen an der Manager-Kalenderansicht (PROJ-5)** — bleibt unangetastet

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugriff & Navigation
- [ ] Angenommen ein aktiver Werkstudent ist eingeloggt, wenn er die Werkstudenten-Navigation öffnet, dann sieht er einen neuen Punkt „Team-Kalender"
- [ ] Angenommen ein Werkstudent öffnet den Team-Kalender, wenn die Seite lädt, dann zeigt sie die aktuelle Kalenderwoche (Mo–Fr) mit allen aktiven Werkstudenten seines Bereichs inklusive ihm selbst
- [ ] Angenommen ein Werkstudent ist keinem Bereich zugeordnet, wenn er den Team-Kalender öffnet, dann sieht er einen Hinweis „Du bist keinem Bereich zugeordnet" statt einer Personenliste
- [ ] Angenommen ein Manager oder Admin ohne Werkstudenten-Rolle ist eingeloggt, wenn er die Werkstudenten-Route des Team-Kalenders direkt aufruft, dann greift die bestehende Rollen-Routing-Logik (kein Zugriff auf Werkstudenten-Seiten)

### Dateninhalt
- [ ] Angenommen ein Kollege hat für einen Tag Plan-Zeiten (auch mehrere Blöcke), wenn der Werkstudent die Woche betrachtet, dann werden die Plan-Zeitblöcke des Kollegen mit Uhrzeiten und Stundensumme angezeigt
- [ ] Angenommen ein Kollege hat Ist-Zeiten erfasst, wenn der Werkstudent die Woche betrachtet, dann sind ausschließlich Plan-Zeiten sichtbar — keine Ist-Zeiten, kein Anwesend/Fehlt-Status
- [ ] Angenommen ein Kollege ist an einem Tag abwesend (beliebiger Typ), wenn der Werkstudent die Woche betrachtet, dann wird der Tag neutral als „Abwesend" markiert — ohne Typ, ohne Grund
- [ ] Angenommen der eingeloggte Werkstudent selbst ist an einem Tag abwesend, wenn er seine eigene Zeile betrachtet, dann darf bei ihm selbst der Abwesenheitstyp angezeigt werden (eigene Daten)
- [ ] Angenommen ein Kollege hat für einen Tag weder Plan noch Abwesenheit, wenn der Werkstudent die Woche betrachtet, dann wird die Zelle als leer („—") dargestellt

### Zeithorizont
- [ ] Angenommen der Werkstudent befindet sich in der aktuellen Kalenderwoche, wenn er die Zurück-Navigation betrachtet, dann ist das Blättern in vergangene Wochen nicht möglich (Button deaktiviert)
- [ ] Angenommen der Werkstudent blättert vorwärts, wenn er eine zukünftige Woche erreicht hat, dann kann er von dort wieder zurück bis maximal zur aktuellen Woche blättern
- [ ] Angenommen ein Werkstudent manipuliert die Wochen-Auswahl (z. B. per URL-Parameter) auf eine vergangene Woche, dann liefert der Server keine Daten für vergangene Wochen, sondern die aktuelle Woche

### Sicherheit & Datenisolation
- [ ] Angenommen ein Werkstudent gehört zu Bereich A, wenn die Team-Kalender-Daten geladen werden, dann enthält die Antwort ausschließlich Werkstudenten aus Bereich A — server-seitig durchgesetzt, nicht nur im UI gefiltert
- [ ] Angenommen ein Werkstudent ruft die Datenquelle des Team-Kalenders direkt auf (API/Server-Request), wenn er Parameter manipuliert (fremder Bereich, fremde Nutzer-ID), dann erhält er keine Daten außerhalb seines Bereichs und keine Ist-Zeiten oder Abwesenheitstypen von Kollegen
- [ ] Angenommen ein Werkstudent wird deaktiviert (is_active = false), wenn Kollegen den Team-Kalender betrachten, dann taucht der deaktivierte Nutzer nicht mehr auf

## Edge Cases
- **Werkstudent ist der einzige aktive Werkstudent im Bereich:** Kalender zeigt nur die eigene Zeile — kein Fehler, ggf. Hinweis „Noch keine weiteren Kollegen in deinem Bereich".
- **Kollege wechselt den Bereich mitten in der Woche:** Maßgeblich ist die aktuelle Bereichszuordnung zum Zeitpunkt des Seitenaufrufs (konsistent mit PROJ-19/PROJ-20); es gibt keine historische Bereichslogik.
- **Feiertag (PROJ-10):** Feiertagsmarkierung wie in der Manager-Ansicht anzeigen, damit leere Tage erklärbar sind.
- **Abwesenheit nur für einen halben Tag / kombiniert mit Plan-Zeiten:** Darstellung folgt der bestehenden Logik der Manager-Kalenderansicht, nur mit neutralisiertem Label.
- **Netzwerkfehler beim Wochenwechsel:** Fehlermeldung mit Retry-Möglichkeit, zuletzt geladene Woche bleibt sichtbar.
- **Woche über Jahreswechsel (KW 52/53 → KW 1):** Wochennavigation muss korrekt weiterblättern (bestehende week-utils nutzen die etablierte Logik).

## Technical Requirements (optional)
- Security: Datenbeschränkung (nur Plan, neutrale Abwesenheit, nur eigener Bereich, keine Vergangenheit) muss server-seitig gelten — Client-seitige Filterung reicht nicht
- Performance: Seitenaufbau vergleichbar mit der Manager-Kalenderansicht (eine Woche, ein Bereich)
- Responsive: Ansicht muss wie die übrigen Werkstudenten-Seiten auf Mobile (375px) nutzbar sein

## Open Questions
- [ ] Inkonsistenz zur bestehenden Team-Anwesenheitsübersicht (PROJ-20): Dort sehen Kollegen heute die Abwesenheits-Gruppen „Urlaub/Krank/Frei/Sonstiges" für den aktuellen Tag. PROJ-28 neutralisiert Abwesenheiten bewusst. Soll PROJ-20 nachgezogen werden (Neutralisierung auch dort)? → Entscheidung für separates Refinement von PROJ-20.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Priorität P1, eigenständiges Feature statt Erweiterung von PROJ-5 | Komfort-Feature für Werkstudenten, kein MVP-Blocker; eigene Route/Rolle → eigene Spec (Single Responsibility) | 2026-09-22 |
| Nur Plan-Zeiten, keine Ist-Zeiten | Ist-Zeiten sind Leistungsdaten und gegenüber Kollegen sensibel; für „wann sind Kollegen da?" reicht der Plan | 2026-09-22 |
| Abwesenheiten neutral als „Abwesend" (eigene Abwesenheit darf typisiert sein) | Abwesenheitstyp (insb. Krank = Gesundheitsdaten) geht Kollegen nichts an | 2026-09-22 |
| Sichtbarkeit nur eigener Bereich, PROJ-20-Global-Einstellung gilt nicht | Konsistent mit Bereichs-Datenisolation (PROJ-19); kleinster sinnvoller Scope | 2026-09-22 |
| Nur Wochennavigation — kein ICS, keine Filter | Schlanke erste Version; Filter bei einem Bereich kaum nötig, ICS als mögliche Erweiterung | 2026-09-22 |
| Eigener Nav-Punkt „Team-Kalender" statt Tab in Team-Anwesenheit | Die Ansichten beantworten verschiedene Fragen (heute/wo vs. Woche/wann); klare Navigation | 2026-09-22 |
| Nur aktuelle + zukünftige Wochen | Rückblick hat keinen Planungsnutzen und wäre eine unnötige Kontrollmöglichkeit unter Kollegen | 2026-09-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Server Action mit Service-Role-Client statt RLS-Erweiterung | RLS für Werkstudenten-Fremdzugriff zu öffnen wäre riskant; das PROJ-20-Muster (Auth-Check + beschnittene Antwort an einer Stelle) ist etabliert und auditiert | 2026-09-22 |
| Beschneidung im Server-Antwortformat, nicht im UI | Kollegen-Ist-Zeiten und Abwesenheitstypen verlassen den Server nie — kein Leak über DevTools/Netzwerk-Tab möglich | 2026-09-22 |
| Zeithorizont-Clamp auf dem Server (angefragte Vergangenheit → aktuelle Woche) | AC verlangt Absicherung gegen URL-Manipulation; Client-Sperre allein reicht nicht | 2026-09-22 |
| Eigener `TeamKalenderClient` statt Wiederverwendung des Manager-`KalenderGrid` | KalenderGrid ist fest mit ManagerNav, Bereichs-Filter, Ist-Logik und ICS verdrahtet; Entkernung riskanter als schlanker Neubau mit Wiederverwendung von week-utils/Feiertagen/Zellen-Muster | 2026-09-22 |
| Keine neuen Tabellen, keine Migration | Reines Lese-Feature auf bestehenden Daten | 2026-09-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Designed:** 2026-09-22

### Grundidee
Die neue Seite ist eine abgespeckte Schwester der Manager-Kalenderansicht (PROJ-5): gleiche Wochen-Tabelle, aber sie bekommt vom Server von vornherein nur die Daten, die Werkstudenten sehen dürfen. Die Beschneidung (nur Plan, Abwesenheit ohne Typ, nur eigener Bereich, keine Vergangenheit) passiert komplett auf dem Server — der Browser eines Werkstudenten erhält die sensiblen Daten nie, egal was im UI manipuliert wird.

### Seitenstruktur (Component Tree)
```
/dashboard/team-kalender (neue Werkstudenten-Seite)
+-- WerkstudentNav (bestehend — neuer Punkt „Team-Kalender")
+-- TeamKalenderClient (neu, schlanke Variante des Manager-KalenderGrid)
    +-- Wochennavigation (KW-Anzeige, ← deaktiviert in aktueller Woche, →)
    +-- Wochen-Tabelle
    |   +-- Zeile pro aktivem Werkstudenten des eigenen Bereichs (eigene Zeile zuerst)
    |   +-- Zelle pro Tag: Plan-Zeitblöcke + Stundensumme, „Abwesend"-Badge oder „—"
    |   +-- Feiertagsmarkierung (bestehende Feiertags-Logik aus PROJ-10)
    +-- Hinweis-Zustände („Kein Bereich zugeordnet", „Noch keine weiteren Kollegen")
```

### Datenmodell
**Keine neuen Tabellen, keine Migration.** Es werden ausschließlich bestehende Daten gelesen:
- Profile (Name, Bereich) — nur aktive Werkstudenten des eigenen Bereichs
- Plan-Einträge der Woche (PROJ-3)
- Abwesenheiten der Woche (PROJ-17) — für Kollegen reduziert auf „ja/nein pro Tag", nur für die eigene Person mit Typ

Der Server liefert ein bewusst schmales Antwortformat: Bei Kollegen sind Ist-Zeiten und Abwesenheitstypen gar nicht erst enthalten (nicht nur ausgeblendet).

### Zugriffsweg (WARUM so)
Werkstudenten dürfen per Datenbank-Rechten (RLS) grundsätzlich keine fremden Plan-Daten lesen — das ist gut so und bleibt unangetastet. Stattdessen nutzt die Seite dasselbe Muster wie die bestehende Team-Anwesenheitsübersicht (PROJ-20): eine Server Action prüft zuerst „ist das ein aktiver Werkstudent, und welchem Bereich gehört er an?" und liest dann mit erhöhten Rechten (Service-Role) genau die erlaubte Datenmenge. Vorteile:
- Keine RLS-Änderung nötig → kein Risiko, versehentlich mehr freizugeben als gewollt
- Die Beschneidungsregeln stehen an genau einer Stelle im Server-Code und sind dort testbar
- Konsistent mit dem bereits auditierten PROJ-20-Muster

Der Server erzwingt außerdem den Zeithorizont: Wird eine vergangene Woche angefragt (z. B. per manipuliertem Parameter), antwortet er mit der aktuellen Woche.

### Wiederverwendung vs. Neubau
- **Wiederverwendet:** Wochen-Logik (`week-utils`), Feiertags-Abfrage (PROJ-10), Zellen-Darstellung der Plan-Blöcke (Anlehnung an `KalenderZelle`), Navigations- und Layout-Muster der Werkstudenten-Seiten
- **Neu gebaut:** `TeamKalenderClient` als eigene schlanke Komponente. Das Manager-`KalenderGrid` wird bewusst NICHT wiederverwendet — es ist fest mit Manager-Navigation, Bereichs-Filter, Ist-Zeiten-Logik und ICS-Download verdrahtet; eine „Entkernung" wäre riskanter als ein schlanker Neubau
- **Unverändert:** Manager-Kalenderansicht, RLS-Policies, Datenbank-Schema

### Dependencies
Keine neuen Pakete — alles Nötige (Next.js, Supabase-Clients, shadcn/ui, date-fns) ist vorhanden.

## Implementation Notes (Frontend)

**Implemented:** 2026-09-22

### Neue Dateien
- `src/app/dashboard/team-kalender/page.tsx` — Server Component: Auth-Check, berechnet heutiges Datum (Europe/Berlin) und aktuelle KW, lädt Initialdaten
- `src/app/dashboard/team-kalender/actions.ts` — Datenvertrag (`TeamKalenderWeekData`: nur Plan-Einträge, neutrale `teamAbsences`, typisierte `ownAbsences`, `noBereich`-Flag) + Stub; Implementierung folgt in `/backend`
- `src/components/team-kalender/TeamKalenderClient.tsx` — Wochennavigation (← deaktiviert in aktueller KW), Wochen-Tabelle mit eigener Zeile zuerst (blau hinterlegt, „(Ich)"), Feiertagsanzeige pro Bundesland (Muster aus Manager-KalenderGrid), Fehler-/Leer-Zustände („Kein Bereich zugeordnet", „Noch keine weiteren Kollegen"), horizontales Scrollen auf Mobile
- `src/components/team-kalender/TeamKalenderZelle.tsx` — Read-only-Tageszelle: Plan-Label (Uhrzeiten bzw. „N Bl. · Xh"), Arbeitsort, neutrales „Abwesend"-Badge für Kollegen, typisierte Abwesenheit nur in der eigenen Zeile, Feiertags-Badge
- `src/components/team-kalender/utils.ts` + `utils.test.ts` — Plan-Label, Eigene-Zeile-zuerst-Sortierung, Initialen, Stunden-Format (11 Unit-Tests)

### Geänderte Dateien
- `src/components/werkstudent/WerkstudentNav.tsx` — neuer Nav-Punkt „Team-Kalender" zwischen „Team" und „Mein Profil"

### Designentscheidungen
- Kein Klick-Dialog auf Zellen (anders als Manager-Ansicht) — es gibt keine Detail-Ebene, die Werkstudenten sehen dürften
- `proxy.ts` unverändert — die Route liegt unter `/dashboard/*` und ist damit vom bestehenden Werkstudenten-Guard abgedeckt
- Die Seite rendert bis zur Backend-Anbindung einen klaren Fehlerhinweis („noch nicht angebunden") statt leerer Fake-Daten

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
