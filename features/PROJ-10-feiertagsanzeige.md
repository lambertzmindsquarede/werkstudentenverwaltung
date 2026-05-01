# PROJ-10: Feiertagsanzeige & Bundesland-Kalender

## Status: Architected
**Created:** 2026-04-30
**Last Updated:** 2026-04-30

## Dependencies
- Requires: PROJ-1 (Authentication) – Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Nutzerverwaltung) – `users`-Tabelle bekommt `bundesland`-Spalte; Manager setzt das Bundesland pro Werkstudent
- Requires: PROJ-3 (Wochenplanung) – Feiertage werden in der Wochenansicht markiert
- Requires: PROJ-4 (Tages-Zeiterfassung) – Feiertags-Banner und Einstempel-Warnung in der StempelCard
- Requires: PROJ-5 (Manager-Kalenderansicht) – Feiertagsname wird in Kalenderzellen angezeigt

## Scope
Gesetzliche Feiertage werden bundesland-spezifisch über eine externe API geladen und in der gesamten App angezeigt. Das Bundesland wird pro Werkstudent vom Manager gepflegt (Standard: NRW). Werkstudenten sehen Feiertage in der Wochenplanung (Tag gesperrt) und auf dem Dashboard (Banner + Einstempel-Warnung). Manager sehen Feiertagsnamen im Kalender. Einstempeln an Feiertagen ist erlaubt, aber eine Warnung erscheint.

## User Stories
- Als Werkstudent möchte ich auf meinem Dashboard sehen, ob heute ein Feiertag ist, damit ich weiß, dass mein Einsatz ggf. besonderer Genehmigung bedarf.
- Als Werkstudent möchte ich in der Wochenplanung Feiertage deutlich markiert sehen, damit ich keine Soll-Stunden an gesetzlichen Feiertagen plane.
- Als Werkstudent möchte ich beim Einstempeln an einem Feiertag eine Warnung sehen, damit ich bewusst entscheide, ob ich wirklich arbeite.
- Als Manager möchte ich im Kalender den Namen des Feiertags direkt in der Zelle sehen, damit ich Abwesenheiten sofort richtig einordnen kann.
- Als Manager möchte ich für jeden Werkstudenten ein Bundesland hinterlegen können, damit die korrekten landesspezifischen Feiertage verwendet werden.

## Acceptance Criteria

### Bundesland-Konfiguration (PROJ-2 Erweiterung)
- [ ] Die `users`-Tabelle bekommt eine Spalte `bundesland` (VARCHAR(2), NOT NULL DEFAULT 'NW') — ISO-3166-2-Kürzel (NW, BY, BE, HH, etc.)
- [ ] Im Manager-Nutzerbearbeitungs-Dialog gibt es ein Dropdown „Bundesland" mit allen 16 Bundesländern
- [ ] Das Bundesland wird als Teil des bestehenden Nutzer-Edit-Flows gespeichert
- [ ] Werkstudenten ohne explizit gesetztes Bundesland erhalten automatisch den Default „NW" (NRW)

### Feiertagsdaten (API-Integration)
- [ ] Ein interner Next.js Route Handler `GET /api/feiertage?bundesland=NW&year=2026` dient als Wrapper zur externen Feiertagsquelle
- [ ] Die Antwort enthält ein Array von Objekten: `{ date: "2026-01-01", name: "Neujahr" }`
- [ ] Der Route Handler cacht die Antwort mit `revalidate = 86400` (24 Stunden) — kein Re-fetch pro Request
- [ ] Bei Nicht-Erreichbarkeit der externen API: leeres Array zurückgeben, kein Fehler für den Nutzer (fail silently)

### Stempel-Dashboard — StempelCard (PROJ-4 Erweiterung)
- [ ] Wenn heute ein Feiertag im Bundesland des eingeloggten Werkstudenten ist: Info-Banner oberhalb der StempelCard: „[Feiertagsname] – heute ist ein gesetzlicher Feiertag in [Bundesland-Name]"
- [ ] Beim Klick auf „Einstempeln" erscheint ein Bestätigungsdialog: „Achtung: Heute ist [Feiertagsname]. Bitte stelle sicher, dass dein Einsatz genehmigt ist." mit Buttons „Abbrechen" und „Trotzdem einstempeln"
- [ ] „Trotzdem einstempeln" führt den normalen Stempelvorgang aus; „Abbrechen" schließt den Dialog ohne Aktion
- [ ] Ist heute kein Feiertag, erscheint weder Banner noch Bestätigungsdialog

### Wochenplanung — WochenplanungClient (PROJ-3 Erweiterung)
- [ ] Feiertags-Tage werden in der Wochenplanung visuell markiert (grauer Hintergrund, Feiertagsname als Label in der Spaltenüberschrift)
- [ ] Neue Soll-Einträge können an Feiertagen nicht gespeichert werden — eine Hinweismeldung erscheint: „Dieser Tag ist ein gesetzlicher Feiertag ([Name]). Planung nicht möglich."
- [ ] Bestehende Soll-Einträge an Feiertagen bleiben erhalten (kein automatisches Löschen), aber der Tag wird zusätzlich mit dem Feiertagshinweis markiert
- [ ] Feiertage außerhalb der aktuell angezeigten Woche beeinflussen die Darstellung nicht

### Manager-Kalender — KalenderZelle (PROJ-5 Erweiterung)
- [ ] Ist ein Tag ein Feiertag im Bundesland des jeweiligen Werkstudenten, wird der Feiertagsname als Label in der Kalenderzelle angezeigt
- [ ] Der Feiertagsname erscheint als kleines Badge oder kursiver Text unterhalb der Zeitangaben
- [ ] Für Werkstudenten ohne Bundesland-Eintrag wird NW als Fallback verwendet

## Edge Cases
- Was passiert, wenn kein Bundesland gesetzt ist? → NW (NRW) als automatischer Fallback; kein Fehler
- Was passiert bei API-Ausfall? → `[]` (kein Feiertag) zurückgeben; kein Fehler für den Nutzer; Feiertage erscheinen schlicht nicht
- Was passiert mit bestehenden Soll-Einträgen an Feiertagen? → Bleiben erhalten; Feiertagshinweis wird zusätzlich angezeigt
- Was passiert beim Jahreswechsel (z.B. Dezember/Januar)? → Feiertagsabfrage erfolgt jahresspezifisch; bei Wochenansicht die über den Jahreswechsel geht, werden beide Jahre abgefragt
- Was passiert, wenn ein Werkstudent an einem Feiertag einstempelt? → Warnung + Bestätigung erforderlich; Einstempeln bleibt möglich
- Was passiert, wenn ein Feiertag auf ein Wochenende fällt? → Wird normal markiert (kein Sonderfall, Wochenenden sind ohnehin inaktiv)
- Kann ein Manager das Bundesland eines Werkstudenten ändern, nachdem bereits Pläne existieren? → Ja; bestehende Einträge bleiben; zukünftige Feiertagsprüfungen nutzen das neue Bundesland

## Technical Requirements
- **DB-Migration:** `ALTER TABLE users ADD COLUMN bundesland VARCHAR(2) NOT NULL DEFAULT 'NW'`; keine Änderung an RLS-Policies
- **Externe API:** `https://get.api-feiertage.de?states=nw&year=2026` (oder gleichwertige API) — Response: `{ "NW": [{ "date": "2026-01-01", "fname": "Neujahr", ... }] }`
- **Interner Route Handler:** `src/app/api/feiertage/route.ts` — cached, fail-safe
- **Bundesland-Mapping:** Hilfsobjekt mit allen 16 Bundesland-Kürzeln und vollständigen Namen (z.B. `NW → Nordrhein-Westfalen`)
- **Feiertagsprüfung client-seitig:** Wiederverwendbarer Hook `usePublicHolidays(bundesland, year)` — ruft `/api/feiertage` ab und stellt `isHoliday(date)` und `getHolidayName(date)` bereit
- **Keine Breaking Changes** an bestehenden API-Routen, RLS-Policies oder Tabellenschemata außer der neuen `bundesland`-Spalte

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick

Das Feature erweitert 4 bestehende Komponenten und fügt eine neue API-Route sowie einen wiederverwendbaren Hook hinzu. Keine Breaking Changes an bestehenden Schnittstellen.

### Komponenten-Struktur

```
NEUE Bausteine
+-- /api/feiertage (Route Handler – neuer API-Endpunkt)
|   +-- Proxy zur externen Feiertagsquelle
|   +-- 24h-Caching (kein Re-Fetch pro Request)
|   +-- Fail-Safe (leeres Array bei API-Ausfall)
|
+-- usePublicHolidays (Shared Hook – neu)
|   +-- Ruft /api/feiertage ab
|   +-- isHoliday(date) – gibt true/false zurück
|   +-- getHolidayName(date) – gibt Namen zurück
|
+-- bundesland-utils (Hilfsobjekt – neu)
    +-- 16 Bundesland-Kürzel → vollständige Namen
    +-- NW als Default-Fallback

ERWEITERTE Bausteine (bestehend)
+-- Manager: Nutzerverwaltungs-Dialog (PROJ-2)
|   +-- Neues Dropdown "Bundesland" (16 Optionen)
|   +-- Speichert bundesland in users-Tabelle
|
+-- StempelCard (PROJ-4) – Werkstudenten-Dashboard
|   +-- Feiertagsbanner (oberhalb der Karte)
|   +-- Bestätigungsdialog vor dem Einstempeln
|
+-- WochenplanungClient (PROJ-3)
|   +-- Feiertagsmarkierung in Spaltenüberschriften
|   +-- Sperrung neuer Einträge an Feiertagen
|
+-- KalenderZelle (PROJ-5) – Manager-Kalender
    +-- Feiertagsname als Badge in der Zelle
```

### Datenmodell

**Erweiterung der `users`-Tabelle:**
- Neue Spalte `bundesland` (VARCHAR 2) mit Default `NW`
- Wertebereich: alle 16 ISO-3166-2-Kürzel (NW, BY, BE, HH, HB, SH, MV, BB, ST, SN, TH, HE, RP, SL, BW, NI)

**Feiertagsobjekt (intern):**
- `date`: Datum im Format "2026-01-01"
- `name`: Feiertagsname ("Neujahr")

**Gespeichert in:** Datenbank (Bundesland pro Nutzer), gecachte externe API (Feiertagsdaten)

### Datenfluss

```
Manager setzt Bundesland
        ↓
users-Tabelle (DB)
        ↓
Werkstudent lädt Dashboard/Wochenplanung
        ↓
usePublicHolidays(bundesland, year)
        ↓
/api/feiertage?bundesland=NW&year=2026
        ↓
Externe Feiertagsquelle (1× pro Tag gecacht)
        ↓
isHoliday() / getHolidayName() für UI-Komponenten
```

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| Interner Route Handler als Proxy | Kein direkter Browser-Zugriff auf externe API; Caching an einer Stelle; fail-safe möglich |
| Next.js ISR-Caching (24h) | Feiertagsdaten ändern sich nicht täglich – spart API-Requests |
| Shared Hook `usePublicHolidays` | Alle 4 Komponenten brauchen dieselbe Logik – kein Code-Duplikat |
| Default NW (NRW) | Firmenstandort ist NRW; sinnvoller Default ohne Konfigurationsaufwand |
| Fail Silent bei API-Ausfall | Fehlende Feiertagsdaten sind kein app-kritischer Fehler |

### Abhängigkeiten & neue Pakete

Keine neuen npm-Pakete nötig. Alle benötigten shadcn/ui-Komponenten bereits installiert:
- `Select` (Bundesland-Dropdown) ✓
- `AlertDialog` (Einstempel-Bestätigung) ✓
- `Badge` (Feiertagsname in KalenderZelle) ✓
- `Alert` (Feiertagsbanner in StempelCard) ✓

### Umsetzungsreihenfolge

1. Backend: DB-Migration + `/api/feiertage` Route Handler
2. Shared Layer: `usePublicHolidays`-Hook + `bundesland-utils`
3. UI: Manager-Dialog → StempelCard → Wochenplanung → KalenderZelle

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
