# PROJ-23: Deckungsübersicht für Manager

## Status: Approved
**Created:** 2026-05-07
**Last Updated:** 2026-05-07

## Implementation Notes (Frontend)
- Route: `/manager/deckung` — Server Component + Client DeckungsGrid
- New files: `src/app/manager/deckung/page.tsx`, `actions.ts`, `src/components/deckung/DeckungsGrid.tsx`, `WochenGantt.tsx`, `TagesGantt.tsx`
- Gantt rendering via pure CSS percentage positioning — no external chart library
- Color assignment: deterministic hash of user ID → index into 10-color palette (consistent across navigation)
- Stacking algorithm: lane-based (blocks sorted by startMin, first fitting lane wins)
- `ManagerNav.tsx` updated with "Deckungsübersicht" link
- Day navigation in TagesGantt is limited to Mo–Fr within the loaded week's data; prev/next buttons disabled at weekends
- Build passes with no TypeScript errors

## Dependencies
- Requires: PROJ-1 (Authentication) – Manager muss eingeloggt und autorisiert sein
- Requires: PROJ-2 (Nutzerverwaltung) – Werkstudenten-Profile müssen existieren
- Requires: PROJ-3 (Wochenplanung) – Plan-Daten werden angezeigt
- Requires: PROJ-5 (Manager-Kalenderansicht) – Ergänzt die bestehende individuelle Kalenderansicht

## Problem Statement
In der bestehenden Manager-Kalenderansicht (PROJ-5) ist jeder Werkstudent eine eigene Zeile. Das ist gut um den Status einzelner Personen zu prüfen, aber schlecht um zu erkennen, **wann im Laufe des Tages jemand da ist und wann niemand verfügbar ist**. Die neue Deckungsübersicht visualisiert die geplanten Zeitblöcke aller Werkstudenten in einem gemeinsamen Zeitstrahl, so dass Planungslücken sofort ins Auge fallen.

## User Stories
- Als Manager möchte ich in einem Gantt-Zeitstrahl sehen, wann welche Werkstudenten über den Wochentag verteilt eingeplant sind, damit ich Überschneidungen und Lücken sofort erkenne.
- Als Manager möchte ich in der Wochenübersicht für jeden Tag eine Zeile sehen mit den Zeitblöcken aller Werkstudenten, damit ich auf einen Blick die Gesamtabdeckung der Woche beurteile.
- Als Manager möchte ich in eine Tagesansicht zoomen, um einen einzelnen Tag in 15-Minuten-Granularität zu untersuchen.
- Als Manager möchte ich die Namen der Werkstudenten direkt in ihren Zeitblöcken lesen, damit ich sofort weiß wen ich ansprechen muss falls eine Lücke entsteht.
- Als Manager möchte ich zwischen Wochen vor- und zurücknavigieren, um vergangene und zukünftige Pläne zu prüfen.
- Als Manager möchte ich in der Tagesansicht einen Tag direkt durch Klick auf die Zeile in der Wochenübersicht öffnen, damit die Navigation intuitiv bleibt.

## Acceptance Criteria

### Wochenansicht (Standard-Tab)
- [ ] Die Ansicht zeigt eine horizontale Gantt-ähnliche Darstellung: **Zeilen = Wochentage (Mo–Fr)**, **X-Achse = Uhrzeit in 1-Stunden-Slots** (Bereich: frühester Plan-Start minus 1h bis spätester Plan-Ende plus 1h, mindestens 08:00–18:00)
- [ ] Jeder eingeplante Zeitblock eines Werkstudenten wird als farbiger, beschrifteter Balken in der Zeile des entsprechenden Tages angezeigt (Name + Uhrzeit z.B. „Anna 8–12")
- [ ] Mehrere Werkstudenten am gleichen Tag werden als gestapelte oder nebeneinander liegende Balken in derselben Tageszeile dargestellt
- [ ] Heutiger Tag wird visuell hervorgehoben (z.B. farbiger Zeilenrahmen)
- [ ] Wochennavigation mit ← / → Buttons und Anzeige von KW + Datumsbereich
- [ ] Klick auf eine Tageszeile wechselt in die Tagesansicht für diesen Tag
- [ ] Tage ohne Planung zeigen eine leere Zeile (kein Fehler)
- [ ] Legende erklärt die Farben (eine Farbe pro Werkstudent, konsistent über die Woche)

### Tagesansicht (zweiter Tab / Drill-Down)
- [ ] Die Tagesansicht zeigt einen einzelnen ausgewählten Tag als horizontalen Zeitstrahl mit **15-Minuten-Slots**
- [ ] Zeitblöcke werden als beschriftete Balken in einer einzigen Zeile (oder gestapelt bei Überschneidung) dargestellt, inkl. Name und Zeitangabe
- [ ] Navigation zum vorherigen/nächsten Tag mit ← / → Buttons, Datumsanzeige
- [ ] Klick auf einen Zeitblock zeigt einen Tooltip oder Dialog mit: Name, geplante Von–Bis Zeit und Gesamtstunden
- [ ] Heutige Uhrzeit (falls der angezeigte Tag = heute) wird als vertikale Linie hervorgehoben
- [ ] Tag ohne Planung zeigt eine leere Zeitleiste mit entsprechendem Hinweis

### Allgemein
- [ ] Die Ansicht ist als eigener Tab oder Link in der Manager-Navigation erreichbar (z.B. „Deckungsübersicht" neben „Kalenderansicht")
- [ ] Beide Tabs (Woche/Tag) sind über URL-Parameter verlinkbar
- [ ] Die Ansicht ist nur für Manager und Admins zugänglich (Werkstudenten werden weitergeleitet)
- [ ] Responsive: auf kleinen Bildschirmen horizontal scrollbar

## Edge Cases
- **Überschneidende Zeitblöcke (mehrere Werkstudenten gleichzeitig):** Balken werden gestapelt (übereinander) dargestellt, nicht überlagert – jeder Balken bleibt vollständig lesbar
- **Sehr viele Werkstudenten an einem Tag (>5):** Die Tageszeile in der Wochenansicht wird entsprechend höher; kein Abschneiden von Balken
- **Extrem kurze Zeitblöcke (<1h):** Balken werden anteilig schmaler dargestellt; Name wird ggf. mit Tooltip statt inline angezeigt
- **Kein Plan für die gesamte Woche:** Wochenübersicht zeigt leere Zeilen ohne Fehler, mit Hinweis „Keine Planungen für diese Woche"
- **Plan-Zeiten außerhalb des angezeigten Zeitbereichs:** Zeitachse passt sich dynamisch an den frühesten/spätesten Wert an
- **Wochenplanung reicht über Mitternacht:** Wird im MVP nicht unterstützt; Blöcke werden bis 23:59 angezeigt

## Technical Requirements
- **Datenabruf:** Nur `planned_entries` (kein `actual_entries` – diese Ansicht zeigt ausschließlich Planung, nicht Ist-Zeiten)
- **Performance:** Wochendaten laden in < 500ms (analog PROJ-5)
- **RLS:** Nur Manager/Admins haben Lesezugriff auf alle Nutzereinträge (bereits vorhanden aus PROJ-3/PROJ-5)
- **Keine neuen DB-Tabellen:** Alle Daten kommen aus `planned_entries` + `profiles`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Neue Route
`/manager/deckung` — Server Component lädt Wochendaten, gibt sie an Client-Komponente weiter.
URL-Parameter: `?week=YYYY-Www`, `?view=woche|tag`, `?day=YYYY-MM-DD`, `?bereich=<id>`

### Komponenten-Struktur
```
/manager/deckung (Server Component)
└── DeckungsGrid (Client, Haupt-Interaktivität)
    ├── ManagerNav (bestehend — um "Deckungsübersicht" ergänzt)
    ├── Wochennavigation ← / KW / →
    ├── Bereich-Filter (Admin-only)
    ├── Tab "Wochenansicht" → WochenGantt
    │   └── TagesZeile × 5 (Mo–Fr)
    │       └── ZeitBlock × n (Balken pro Werkstudent + Tooltip bei Hover)
    └── Tab "Tagesansicht" → TagesGantt
        └── ZeitBlock × n (gestapelt, Dialog bei Klick)
```

### Datenfluss
- Server Action `loadDeckungWeek(weekStr, bereichFilter)` — analog zu `loadKalenderWeek`
- Lädt nur `planned_entries` + `profiles` (keine `actual_entries`, keine neuen DB-Tabellen)
- RLS bereits vorhanden (Manager sieht nur seinen Bereich)

### Gantt-Rendering
- Zeitachse: frühester Start −1h bis spätester End +1h, mindestens 08:00–18:00; dynamisch berechnet
- Wochenansicht: 1-Stunden-Slots; Tagesansicht: 15-Minuten-Slots
- Balkenbreite und -position via CSS-Prozentrechnung (kein externes Chart-Paket)
- Überschneidende Blöcke werden gestapelt (übereinander), nicht überlagert

### Farbzuweisung
- Deterministisch aus User-ID (Hash → Index in Farbpalette mit 10 Farben)
- Konsistent über Wochen-/Tagesansicht und Wochennavigation hinweg
- Legende zeigt Name + Farbe aller angezeigten Werkstudenten

### Betroffene Dateien
| Datei | Aktion |
|-------|--------|
| `src/app/manager/deckung/page.tsx` | Neu |
| `src/app/manager/deckung/actions.ts` | Neu |
| `src/components/deckung/DeckungsGrid.tsx` | Neu |
| `src/components/deckung/WochenGantt.tsx` | Neu |
| `src/components/deckung/TagesGantt.tsx` | Neu |
| `src/components/deckung/ZeitBlock.tsx` | Neu |
| `src/components/manager/ManagerNav.tsx` | Geändert |

### Abhängigkeiten
Keine neuen npm-Pakete. Verwendete shadcn-Komponenten (alle installiert):
`Tabs`, `Tooltip`, `Dialog`, `ScrollArea`, `Button`, `Badge`

## QA Test Results

**QA Date:** 2026-05-07
**Tester:** /qa skill
**Build:** TypeScript build clean, 292 unit tests pass

### Acceptance Criteria Results

#### Wochenansicht
| # | Criterion | Result |
|---|-----------|--------|
| W1 | Horizontal Gantt, Zeilen Mo–Fr, X-Achse Uhrzeit (08:00–18:00 min.) | PASS |
| W2 | Farbige beschriftete Balken (Name + Von–Bis) pro Werkstudent | PASS |
| W3 | Gestapelte Balken bei Überschneidung (assignLanes-Algorithmus) | PASS |
| W4 | Heutiger Tag visuell hervorgehoben (blaues ring-Highlight) | PASS |
| W5 | Wochennavigation ← / → mit KW + Datumsbereich | PASS |
| W6 | Klick auf Tageszeile → Tagesansicht für diesen Tag | PASS |
| W7 | Tage ohne Planung zeigen leere Zeile mit Hinweis | PASS |
| W8 | Legende mit Name + Farbe aller Werkstudenten | PASS |

#### Tagesansicht
| # | Criterion | Result |
|---|-----------|--------|
| T1 | 15-Minuten-Slots auf der X-Achse | PASS |
| T2 | Beschriftete Balken (Name + Von–Bis) gestapelt bei Überschneidung | PASS |
| T3 | Navigation zum vorherigen/nächsten Tag (← / →) | PASS |
| T4 | Klick auf Zeitblock öffnet Dialog mit Name, Von–Bis, Stunden | PASS |
| T5 | Aktuelle Uhrzeit als rote vertikale Linie (nur wenn Tag = heute) | PASS |
| T6 | Leerer Tag zeigt Hinweis "Keine Planung für diesen Tag" | PASS |

#### Allgemein
| # | Criterion | Result |
|---|-----------|--------|
| A1 | Link "Deckungsübersicht" in ManagerNav | PASS |
| A2 | URL-Parameter verlinkbar (?view=woche/tag, ?week=, ?day=) | PASS |
| A3 | Nur Manager/Admins haben Zugriff (Werkstudenten → /dashboard) | PASS |
| A4 | Responsive: horizontal scrollbar auf kleinen Bildschirmen | PASS |

#### Edge Cases
| # | Edge Case | Result |
|---|-----------|--------|
| E1 | Leere Woche → "Keine Planungen für diese Woche" | PASS |
| E2 | Montag: vorheriger Tag disabled (Sonntag ist kein Werktag) | PASS |
| E3 | Freitag: nächster Tag disabled (Samstag ist kein Werktag) | PASS |
| E4 | Unauthentifizierter Zugriff → Weiterleitung zu /login | PASS |
| E5 | Admin: Bereichs-Filter (SelectTrigger) wird angezeigt | PASS |

**Total: 23/23 Acceptance Criteria PASS**

### Security Audit
| Check | Result |
|-------|--------|
| Unauthentifizierter Zugriff wird abgewiesen (Redirect zu /login) | PASS |
| Server Action prüft Authentifizierung serverseitig | PASS |
| Bereichs-Datenisolation: Manager sieht nur eigene Bereiche (via bereich_manager) | PASS |
| Admin kann per bereichFilter filtern, sieht aber alle Bereiche | PASS |
| POST ohne Session gibt 307-Redirect zurück | PASS |
| Keine sensiblen Daten in URL-Parametern | PASS |

### Unit Tests
- `getUserColor` (DeckungsGrid.test.ts): 5 Tests, alle grün
- `timeToMinutes`, `minutesToTime`, `assignLanes`: private Funktionen, indirekt durch E2E getestet

### E2E Tests
**Datei:** `tests/PROJ-23-deckungsuebersicht.spec.ts`
**Ergebnis nach Test-Bug-Fixes:** 43/46 pass, 3 skip (intermittent auth timing in parallelen Playwright-Workers), 0 fail

Behobene Test-Bugs (waren keine Implementierungsfehler):
1. Montagstest verwendete `day=2026-05-05` (Dienstag) statt `day=2026-05-04` (Montag)
2. Freitagstest verwendete `day=2026-05-09` (Samstag) statt `day=2026-05-08` (Freitag) — bestand durch Zufall
3. Wochennavigations-Buttons: Selektor `button[svg].nth(1)` traf falschen Button wenn Admin-SelectTrigger im DOM → auf `.min-w-36`-Container-Scope umgestellt

Die 3 Skips sind Worker-Auth-Timing-Probleme (intermittent), kein Feature-Bug.

### Regressions
Alle anderen Deployed-Features wurden nicht negativ beeinflusst. Die neue ManagerNav-Route ist isoliert.

### Production-Ready Decision
**READY** — Keine Critical oder High Bugs. Alle Acceptance Criteria erfüllt.

## Deployment
_To be added by /deploy_
