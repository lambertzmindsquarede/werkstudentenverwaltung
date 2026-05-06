# PROJ-20: Team-Anwesenheitsübersicht

## Status: Architected
**Created:** 2026-05-06
**Last Updated:** 2026-05-06

## Dependencies
- Requires: PROJ-1 (Authentication) — Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) — Team-Struktur (Werkstudent ↔ Manager)
- Requires: PROJ-3 (Wochenplanung) — heutiger Arbeitsort-Plan als Basis der Gruppeneinordnung
- Requires: PROJ-16 (Arbeitsort-Auswahl) — Arbeitsort-Kategorien und Sub-Locations
- Requires: PROJ-17 (Abwesenheitsverwaltung) — Abwesenheitstypen für Urlaub/Krank/Frei/Sonstiges
- Extends: PROJ-16 — Sub-Location-Verwaltung (z.B. WRK, LAB, Arbeitsplatznummern) muss in PROJ-16 ergänzt werden

## Overview
Eine Live-Anwesenheitsübersicht für das Team: Alle Teammitglieder werden nach ihrem aktuellen Standort gruppiert dargestellt. Basis ist der geplante Arbeitsort aus der Wochenplanung (PROJ-16/PROJ-3) sowie Abwesenheiten (PROJ-17). Zusätzlich kann jeder Nutzer seinen genauen Sub-Ort (z.B. Raum WRK, LAB oder Arbeitsplatznummer) in Echtzeit selbst setzen. Die Ansicht aktualisiert sich automatisch, damit Kollegen sich schnell finden können.

---

## User Stories

### Werkstudent / Alle Nutzer
- Als Werkstudent möchte ich auf einen Blick sehen, wer heute wo arbeitet, damit ich Kollegen schnell finden kann.
- Als Werkstudent möchte ich meinen eigenen aktuellen Sub-Ort (z.B. Raum/Arbeitsplatz) per Klick setzen können, damit Kollegen wissen, wo ich sitze.
- Als Werkstudent möchte ich sofort sehen, wenn ein Kollege seinen Ort ändert (Live-Update), damit ich stets aktuelle Informationen habe.
- Als Werkstudent möchte ich meinen eigenen Status in der „Ich"-Sektion oben immer als erstes sehen, damit ich meinen aktuellen Stand schnell überprüfen kann.
- Als Werkstudent möchte ich meinen gesetzten Sub-Ort wieder zurücksetzen können, damit ich keine veralteten Informationen hinterlasse.

### Manager
- Als Manager möchte ich festlegen, ob mein Team in der Übersicht für alle App-Nutzer oder nur für meine Werkstudenten sichtbar ist, damit der Datenschutz meines Teams gewahrt bleibt.
- Als Manager möchte ich Sub-Locations pro Arbeitsort konfigurieren (z.B. „WRK", „LAB", „Platz 1–10" für „Büro Paderborn"), damit Werkstudenten ihren genauen Ort auswählen können.

---

## Acceptance Criteria

### Ansicht: Struktur & Gruppen
- [ ] Die Seite zeigt eine „Ich"-Sektion ganz oben mit der eigenen Karte des eingeloggten Nutzers
- [ ] Darunter folgen Gruppen, die den PROJ-16-Arbeitsort-Kategorien entsprechen (z.B. „Anwesend", „Home-Office", „Kunden")
- [ ] Am Ende stehen Gruppen für Abwesenheitstypen aus PROJ-17: „Urlaub", „Krank", „Frei", „Sonstiges"
- [ ] Nutzer ohne Eintrag für heute (kein Arbeitsort geplant, keine Abwesenheit) erscheinen in einer Gruppe „Kein Status"
- [ ] Leere Gruppen (keine Mitglieder heute) werden nicht angezeigt
- [ ] Bei mehreren sichtbaren Teams (global + eigenes) werden Gruppen pro Team getrennt mit Team-Label als Subheader angezeigt

### Personenkarte
- [ ] Jede Karte zeigt: Name-Badge, Ort-Element (Kreis oder Sub-Location-Tag), Emoji-Platzhalter (visuell vorhanden, aber inaktiv — für späteres Feature)
- [ ] Kein Sub-Ort gesetzt: Leerer Kreis (○) wird angezeigt
- [ ] Sub-Ort gesetzt: Der Kreis entfällt — an seiner Stelle erscheint direkt das Sub-Location-Badge (z.B. „WRK", „LAB", „Platz 3")
- [ ] Karten anderer Nutzer sind read-only (kein Klick möglich)
- [ ] Eigene Karte mit leerem Kreis: Klick auf den Kreis öffnet ein Popover/Dialog zur Sub-Ort-Auswahl
- [ ] Eigene Karte mit gesetztem Sub-Ort: Klick auf das Sub-Location-Badge öffnet den Dialog zum Ändern/Zurücksetzen

### Sub-Ort setzen (eigene Karte)
- [ ] Der Dialog zeigt die vom Manager konfigurierten Sub-Locations für den heutigen geplanten Arbeitsort
- [ ] Werkstudent wählt eine Sub-Location aus der Liste → Karte wird sofort aktualisiert
- [ ] Werkstudent kann „Kein Sub-Ort" wählen → Sub-Location-Badge verschwindet, leerer Kreis erscheint wieder
- [ ] Wenn kein Arbeitsort für heute in der Wochenplanung vorhanden ist, ist der Kreis deaktiviert mit Hinweis „Heute kein Arbeitstag geplant"
- [ ] Wenn der Arbeitsort keine konfigurierten Sub-Locations hat, erscheint ein Hinweis „Keine Sub-Orte konfiguriert" — Kreis bleibt ohne Funktion
- [ ] Bei Abwesenheit (PROJ-17) ist der Kreis deaktiviert

### Live-Updates
- [ ] Die Ansicht aktualisiert sich automatisch ≤ 60 Sekunden nach einer Statusänderung (via Polling oder Supabase Realtime)
- [ ] Statusänderungen werden ohne Seiten-Reload auf der Karte sichtbar

### Sichtbarkeit / Team-Scope (Manager-Einstellung)
- [ ] Manager kann in den Einstellungen festlegen: „Nur Team" (Standard) oder „Global" (alle App-Nutzer sehen das Team)
- [ ] Standard ist „Nur Team" — Global muss aktiv aktiviert werden (opt-in)
- [ ] Nutzer sehen immer ihr eigenes Team; zusätzlich alle Teams mit globaler Sichtbarkeit

### Sub-Location-Verwaltung (PROJ-16-Erweiterung)
- [ ] Manager kann pro Arbeitsort eine Liste von Sub-Locations anlegen, umbenennen und deaktivieren (Soft-Delete)
- [ ] Sub-Locations sind an einen Arbeitsort gebunden (kein teamübergreifender Zugriff)
- [ ] Deaktivierte Sub-Locations sind nicht mehr auswählbar, bereits gesetzte bleiben bis Tagesende sichtbar

---

## Edge Cases

- **Kein Arbeitsort für heute geplant:** Nutzer erscheint in „Kein Status" Gruppe. Sub-Ort-Setzen ist deaktiviert.
- **Abwesenheit und Arbeitsort gleichzeitig:** Abwesenheit (PROJ-17) hat Vorrang — Nutzer wird in der Abwesenheits-Gruppe angezeigt, nicht im Arbeitsort.
- **Sub-Location wird vom Manager gelöscht, während jemand sie aktiv hat:** Der bereits gesetzte Sub-Ort bleibt bis Tagesende sichtbar. Beim nächsten Setzen ist der gelöschte Ort nicht mehr wählbar.
- **Nutzer ohne Manager-Zuweisung:** Erscheint in der eigenen „Ich"-Sektion; ist für andere Nutzer nicht sichtbar.
- **Wochenplanung für heute nachträglich gelöscht:** Sub-Ort wird automatisch zurückgesetzt; Nutzer fällt in „Kein Status".
- **Mitternacht / Tageswechsel:** Sub-Orte werden täglich um Mitternacht automatisch zurückgesetzt (kein Übertrag auf den nächsten Tag).
- **Viele Nutzer in einer Gruppe (>20):** Karten werden in einem scrollbaren Grid innerhalb der Gruppe dargestellt.

---

## Technical Requirements
- Performance: Statusänderung innerhalb ≤ 60 Sekunden für alle sichtbaren Nutzer sichtbar
- Live-Update: Polling alle 30s oder Supabase Realtime (Präferenz: Supabase Realtime für Echtzeit-Gefühl)
- Security: Nutzer kann nur eigenen Sub-Ort setzen (RLS auf `daily_presence`)
- Neue DB-Tabelle `daily_presence`: `id`, `user_id`, `date`, `sub_location_id` (FK, nullable), `updated_at`
- Neue DB-Tabelle `sub_locations`: `id`, `arbeitsort_id` (FK zu PROJ-16), `name`, `is_active`, `created_at`
- Team-Sichtbarkeit: neues Feld `visibility` (enum: `team` | `global`) in der Manager/Teams-Konfiguration
- Sub-Ort wird täglich um 00:00 Uhr automatisch zurückgesetzt (Cron-Job oder DB-Trigger)

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Neue Seite: /dashboard/team  (für alle eingeloggten Nutzer)
+-- TeamAnwesenheitPage
    +-- IchSektion (immer ganz oben)
    |   +-- PersonenKarte (interaktiv, eigene Karte)
    |       +-- SubOrtKreis  ← leer wenn kein Sub-Ort gesetzt (klickbar)
    |           oder SubOrtBadge  ← zeigt gesetzten Sub-Ort (klickbar)
    |           +-- SubOrtDialog  ← öffnet sich bei Klick
    |               +-- SubLocationListe  ← Manager-konfigurierte Orte
    |               +-- "Kein Sub-Ort"-Option
    |
    +-- TeamGruppeArbeitsort[]  ← eine Gruppe pro genutztem Arbeitsort-Typ heute
    |   +-- GruppenHeader (z.B. "Homeoffice", "Büro Paderborn")
    |   +-- PersonenKartenGrid (scrollbar bei > 20 Karten)
    |       +-- PersonenKarte (read-only für fremde Nutzer)
    |           +-- SubOrtKreis oder SubOrtBadge (read-only)
    |
    +-- TeamGruppeAbwesenheit[]  ← je eine Gruppe pro Abwesenheitstyp
    |   +-- GruppenHeader (z.B. "Urlaub", "Krank", "Frei")
    |   +-- PersonenKartenGrid
    |
    +-- TeamGruppeKeinStatus  ← Nutzer ohne Planung und ohne Abwesenheit heute
        +-- PersonenKartenGrid

Manager-Einstellungen (bestehend: /manager/settings – erweitern)
+-- SettingsForm (bestehend)
    +-- TeamSichtbarkeitToggle  ← NEU: "Nur Team" / "Global"
    +-- SubLocationVerwaltung   ← NEU: pro Arbeitsort aufklappbar
        +-- ArbeitsortAkkordeon[]
            +-- SubLocationZeile (Name | Aktiv | Umbenennen | Deaktivieren)
            +-- NeueSubLocationButton + Dialog
```

### Datenmodell

**Neue Tabelle: `sub_locations`**

| Feld | Beschreibung |
|---|---|
| `id` | Eindeutige ID |
| `arbeitsort_id` | FK auf `arbeitsorte` (PROJ-16) |
| `name` | z.B. „WRK", „LAB", „Platz 3" |
| `is_active` | false = Soft-Delete (nicht mehr auswählbar) |
| `created_at` | Angelegt am |

**Neue Tabelle: `daily_presence`**

| Feld | Beschreibung |
|---|---|
| `id` | Eindeutige ID |
| `user_id` | FK auf profiles |
| `date` | Datum (nur heutiger Eintrag wird angezeigt) |
| `sub_location_id` | FK auf `sub_locations`, nullable |
| `updated_at` | Zeitstempel der letzten Änderung |

Kein nächtlicher Reset-Job nötig: Die App filtert immer nach `date = heute` — vergangene Einträge werden schlicht ignoriert.

**Erweiterung: Manager-Konfiguration**

Neues Feld `visibility` (Enum: `team` | `global`) in der Manager/Team-Konfiguration. Standard: `team` (opt-in für global).

### Berechtigungskonzept (RLS)

| Aktion | Wer | Bedingung |
|---|---|---|
| `sub_locations` lesen | Manager | Nur eigene (via `arbeitsort_id → arbeitsorte.manager_id`) |
| `sub_locations` lesen | Werkstudent | Nur die des eigenen Managers |
| `sub_locations` anlegen/bearbeiten | Manager | Nur für eigene Arbeitsorte |
| `daily_presence` lesen | Nutzer | Eigene + Einträge des eigenen Teams |
| `daily_presence` lesen (global) | Alle App-Nutzer | Nur wenn Team `visibility = global` |
| `daily_presence` schreiben | Nutzer | Nur eigener Eintrag (`user_id = auth.uid()`) |

### Server Actions

**Neu: `src/app/dashboard/team/actions.ts`**

| Aktion | Beschreibung |
|---|---|
| `getTeamPresence(date)` | Lädt alle sichtbaren Nutzer, gruppiert nach Arbeitsort / Abwesenheitstyp / Kein Status |
| `setSubLocation(sub_location_id \| null)` | Setzt oder löscht eigenen Sub-Ort für heute |
| `getSubLocationsForArbeitsort(arbeitsort_id)` | Lädt aktive Sub-Locations für den Dialog |

**Erweitert: `src/app/manager/settings/actions.ts`**

| Aktion | Beschreibung |
|---|---|
| `getSubLocations(arbeitsort_id)` | Alle Sub-Locations pro Arbeitsort laden |
| `createSubLocation(arbeitsort_id, name)` | Neue Sub-Location anlegen |
| `updateSubLocation(id, name)` | Umbenennen |
| `toggleSubLocation(id, is_active)` | Aktivieren / Deaktivieren |
| `setTeamVisibility(visibility)` | Setzt `visibility` auf `team` oder `global` |

### Live-Updates

**Supabase Realtime** (bevorzugt): Client abonniert Änderungen auf `daily_presence`. Jedes INSERT/UPDATE aktualisiert die Ansicht ohne Seiten-Reload. Fallback: Polling alle 30 Sekunden. Erfüllt die ≤ 60-Sekunden-Anforderung.

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Kein nächtlicher Reset-Job | Filterung nach `date = today` — alte Einträge werden nie gelesen |
| Supabase Realtime | Besseres UX-Gefühl, bereits im Stack vorhanden |
| Eigene Seite `/dashboard/team` | Für alle Rollen zugänglich, nicht im Manager-Bereich versteckt |
| Sub-Locations als Akkordeon in `/manager/settings` | Verwaltung ist selten — kein eigener Menüpunkt nötig |
| `visibility` als Opt-in | Standard „Nur Team" schützt Datenschutz ohne Konfigurationsaufwand |
| Keine neuen Pakete nötig | Supabase Realtime, `<Popover>`, `<Badge>`, `<Dialog>`, `<Accordion>` bereits installiert |

### Abhängigkeiten & Reihenfolge

Muss erst deployed sein:
- **PROJ-16** (Arbeitsorte) — liefert `arbeitsorte`-Tabelle als FK-Basis für `sub_locations`
- **PROJ-17** (Abwesenheitsverwaltung) — liefert Abwesenheitstypen für die Gruppenlogik

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
