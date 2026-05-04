# PROJ-14: Bearbeitungsfrist für Zeiterfassung

## Status: Architected
**Created:** 2026-05-02
**Last Updated:** 2026-05-02

## Dependencies
- Requires: PROJ-4 (Tages-Zeiterfassung) – betrifft das Bearbeiten von Ist-Einträgen
- Requires: PROJ-2 (Nutzerverwaltung) – Rollenmodell (Manager vs. Werkstudent)

## User Stories
- Als Werkstudent möchte ich meine Zeiterfassungseinträge für die letzten X Tage bearbeiten können, damit ich vergessene oder fehlerhafte Einträge korrigieren kann.
- Als Werkstudent möchte ich klare Grenzen haben, bis wann ich Einträge korrigieren darf, damit ich weiß, wann Fristen ablaufen.
- Als Manager möchte ich global einstellen können, wie viele Tage zurückreichend Werkstudenten ihre Zeiterfassung bearbeiten dürfen, damit ich die Flexibilität an unsere Arbeitsprozesse anpassen kann.
- Als Manager möchte ich Zeiterfassungseinträge von Werkstudenten immer bearbeiten können, unabhängig von der konfigurierten Frist, damit ich Korrekturen für ältere Zeiträume vornehmen kann.
- Als Manager möchte ich die aktuelle Frist-Einstellung jederzeit auf einer Einstellungsseite einsehen können, damit ich die Konfiguration nachvollziehen kann.

## Acceptance Criteria
- [ ] Manager kann auf `/manager/settings` eine globale Bearbeitungsfrist (in Tagen) konfigurieren
- [ ] Der konfigurierbare Wertebereich liegt zwischen 1 und 365 Tagen; der Standardwert beträgt 14 Tage
- [ ] Werkstudenten sehen den Bearbeiten-Button nur für Einträge, deren Datum maximal X Tage in der Vergangenheit liegt (heute = Tag 0, gestern = Tag 1)
- [ ] Für Einträge außerhalb der Frist ist der Bearbeiten-Button ausgeblendet (nicht nur deaktiviert)
- [ ] Manager sehen den Bearbeiten-Button für alle Einträge, unabhängig von der konfigurierten Frist
- [ ] Eine serverseitige Validierung verhindert, dass Werkstudenten Einträge außerhalb der Frist via direktem API/SDK-Aufruf bearbeiten (HTTP 403)
- [ ] Änderungen an der Einstellung werden sofort wirksam (kein App-Neustart, kein Cache-Problem)
- [ ] Die Einstellungsseite zeigt die aktuell gespeicherte Frist an; Speichern-Button übernimmt den neuen Wert
- [ ] Nur Manager haben Schreibzugriff auf die Einstellung; Werkstudenten können den Wert lesen (für clientseitige Guard-Logik)

## Edge Cases
- Was passiert, wenn die Frist auf 0 Tage gesetzt wird? → Werkstudenten können nur den heutigen Tag bearbeiten (Tag 0 = heute ≙ `date >= today`)
- Was passiert, wenn die Frist auf 365 gesetzt wird? → Werkstudenten können ein volles Jahr zurück bearbeiten; kein sonstiges Verhalten ändert sich
- Was passiert, wenn die Frist erhöht wird? → Einträge innerhalb der neuen (größeren) Frist sind sofort wieder bearbeitbar
- Was passiert, wenn die Frist verringert wird? → Einträge außerhalb der neuen (kleineren) Frist haben sofort keinen Bearbeiten-Button mehr; die Einträge selbst bleiben unverändert erhalten
- Was passiert, wenn kein Eintrag in `app_settings` existiert (frische Installation / erster Start)? → Standardwert 14 Tage wird verwendet; kein Fehler, kein leerer Zustand
- Was passiert bei einem direkten Supabase-SDK-Aufruf, der die clientseitige Guard-Logik umgeht? → Server Action liest den aktuellen Frist-Wert aus `app_settings` und lehnt Updates für Einträge mit `date < today - X` ab (HTTP 403)
- Was passiert, wenn ein Manager selbst keinen Eintrag in `app_settings` speichert (Formular leer abschickt)? → Validierung blockiert das Speichern; Pflichtfeld mit Minimalwert 1

## Technical Requirements
- Neue Tabelle `app_settings` in der Datenbank: Schlüssel-Wert-Tabelle mit mind. dem Eintrag `max_edit_days_past` (integer, Default: 14)
- RLS: Manager dürfen `app_settings` lesen und schreiben; Werkstudenten dürfen nur lesen
- Neue Seite `/manager/settings` (nur für Manager zugänglich)
- Server Action `saveAppSettings` mit Manager-Rollen-Prüfung
- Bestehende `IstEintragEditDialog`-Logik in PROJ-4 muss die Frist berücksichtigen (Bearbeiten-Button ausblenden)
- Serverseitige Absicherung: Vor jedem Schreiben auf `actual_entries` prüfen, ob `date >= today - max_edit_days_past` (für Werkstudenten; Manager sind ausgenommen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht
Eine globale Konfigurationseinstellung legt fest, wie viele Tage zurück Werkstudenten ihre Zeiterfassung bearbeiten dürfen. Manager konfigurieren den Wert über eine neue Einstellungsseite. Die Bearbeitungs-Buttons werden bei abgelaufenen Einträgen ausgeblendet — sowohl im UI als auch serverseitig abgesichert.

### Komponentenstruktur

```
/manager/settings  (neue Seite, nur für Manager)
+-- SettingsForm  (neues Client-Komponente)
    +-- Card + CardHeader + CardContent  (shadcn)
    |   +-- Label "Bearbeitungsfrist (Tage)"
    |   +-- Input  (shadcn, Typ: Zahl, 1–365)
    |   +-- Button "Speichern"  (shadcn)
    +-- Alert  (shadcn, Erfolg / Fehler-Feedback)

/dashboard  (bestehende Seite — erweitert)
+-- DashboardContent  (bestehend — bekommt neuen Prop: maxEditDaysPast)
    +-- WochenIstübersicht  (bestehend — reicht Prop durch)
        +-- IstEintragEditDialog  (bestehend — bekommt neuen Prop)
            +-- Bearbeiten-Button  → nur sichtbar wenn Datum >= cutoff
```

### Datenmodell

**Neue Tabelle: `app_settings`**

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `key` | Text (Primary Key) | Einstellungsname z.B. `max_edit_days_past` |
| `value` | Text | Gespeicherter Wert z.B. `"14"` |
| `updated_at` | Timestamp | Letzter Änderungszeitpunkt |
| `updated_by` | UUID (→ profiles) | Wer hat zuletzt geändert |

Einziger Datensatz für dieses Feature: `key = "max_edit_days_past"`, `value = "14"` (Standardwert).

**Berechtigungen (RLS):**
- Manager: lesen + schreiben
- Werkstudent: nur lesen (für clientseitige Guard-Logik)

### Datenfluss

1. **Manager konfiguriert Frist:** `SettingsForm → Server Action saveAppSetting → app_settings Tabelle`. Der Wert gilt sofort, da das Dashboard bei jedem Laden serverseitig neu gelesen wird.
2. **Werkstudent öffnet Dashboard:** `/dashboard/page.tsx` liest `max_edit_days_past` aus DB → berechnet cutoff-Datum → übergibt als Prop durch `DashboardContent → WochenIstübersicht → IstEintragEditDialog` → Button nur anzeigen wenn `entry.date >= cutoff`.
3. **Server-seitige Absicherung:** Jede Server Action die `actual_entries` schreibt, prüft: Rolle = werkstudent UND `entry.date < cutoff` → HTTP 403. Manager sind ausgenommen.

### Neue und geänderte Dateien

**Neu:**
- `src/app/manager/settings/page.tsx` — Manager-Einstellungsseite (Server Component)
- `src/app/manager/settings/actions.ts` — Server Action `saveAppSetting`
- `src/app/manager/settings/SettingsForm.tsx` — Formular als Client Component
- `supabase/migrations/XXXXXX_proj14_app_settings.sql` — DB-Migration

**Geändert:**
- `src/app/dashboard/page.tsx` — liest `max_edit_days_past`, gibt als Prop weiter
- `src/components/zeiterfassung/DashboardContent.tsx` — reicht Prop durch
- `src/components/zeiterfassung/WochenIstübersicht.tsx` — reicht Prop durch
- `src/components/zeiterfassung/IstEintragEditDialog.tsx` — blendet Button aus wenn außerhalb Frist
- Bestehende Server Action für `actual_entries`-Updates — serverseitige Datumsprüfung
- `src/lib/database.types.ts` — Typ für `app_settings` ergänzen

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| Schlüssel-Wert-Tabelle | Flexibel für künftige Einstellungen ohne DB-Schema-Änderung |
| Text als Werttyp | Universell für spätere Einstellungen (booleans, Strings, ...) |
| Standardwert 14 im Code wenn kein DB-Eintrag vorhanden | Robustes Verhalten bei Erstinstallation |
| Setting serverseitig laden (Server Component) | Kein Flicker, kein Loading-State; Werkstudent sieht direkt korrekten Zustand |
| Bearbeiten-Button ausblenden statt deaktivieren | Laut Spec explizit: ausgeblendet (nicht nur disabled) |

### Keine neuen Abhängigkeiten
Alle benötigten UI-Komponenten (Card, Input, Button, Alert, Label) sind bereits installiert.

## Implementation Notes
_To be added by /frontend and /backend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
