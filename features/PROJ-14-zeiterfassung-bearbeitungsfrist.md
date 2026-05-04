# PROJ-14: Bearbeitungsfrist für Zeiterfassung

## Status: Approved
**Created:** 2026-05-02
**Last Updated:** 2026-05-04

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

### Umgesetzte Dateien

**Neu:**
- `supabase/migrations/20260502_proj14_app_settings.sql` — Tabelle `app_settings` mit RLS; Standardwert 14 Tage per INSERT ON CONFLICT DO NOTHING
- `src/app/manager/settings/page.tsx` — Server Component; prüft Manager-Rolle, liest aktuellen Wert, rendert SettingsForm
- `src/app/manager/settings/actions.ts` — Server Action `saveMaxEditDaysPast`: Validierung (1–365), Manager-Check, UPSERT in `app_settings`
- `src/app/manager/settings/SettingsForm.tsx` — Client Component mit Input + Speichern-Button + Erfolgs-/Fehler-Alert
- `src/app/dashboard/actions.ts` — Server Actions `updateActualEntry`, `insertActualEntry`, `deleteActualEntry`; interne Funktion `assertEditPermission` prüft Rolle und Frist-Cutoff für Werkstudenten

**Geändert:**
- `src/lib/database.types.ts` — `app_settings`-Tabelle hinzugefügt; `DEFAULT_MAX_EDIT_DAYS_PAST = 14` und `AppSetting`-Typ exportiert
- `src/app/dashboard/page.tsx` — Liest `app_settings.max_edit_days_past` und Nutzerrolle; berechnet `maxEditDaysPast` (null für Manager = keine Sperre); übergibt als Prop an `DashboardContent`
- `src/components/zeiterfassung/DashboardContent.tsx` — Prop `maxEditDaysPast: number | null` hinzugefügt; wird an `WochenIstübersicht` weitergegeben
- `src/components/zeiterfassung/WochenIstübersicht.tsx` — Prop `maxEditDaysPast` hinzugefügt; berechnet `cutoffStr`; Bearbeiten-Buttons nur sichtbar wenn `dateStr >= cutoffStr` (oder Manager)
- `src/components/zeiterfassung/IstEintragEditDialog.tsx` — Supabase-Browser-Calls durch Server Actions ersetzt (`updateActualEntry`, `insertActualEntry`, `deleteActualEntry`); kein direkter DB-Zugriff mehr im Client
- `src/app/manager/page.tsx` — Einstellungen-Link in Manager-Navigation ergänzt

### Abweichungen von der Spec
- Keine; alle Acceptance Criteria und Tech-Entscheidungen wie spezifiziert umgesetzt.
- `IstEintragEditDialog` nutzt jetzt vollständig Server Actions statt direkter Supabase-Browser-Calls — dies ist eine sauberere Architektur als die ursprünglich geplante "Datumsprüfung in bestehender Server Action", da es vorher keine Server Actions für `actual_entries` gab.

## QA Test Results

**QA Date:** 2026-05-04 (Re-QA: 2026-05-04)
**Tester:** /qa skill (automated + code review)
**Status: READY — Alle Bugs behoben, alle Tests grün**

### Automated Tests
- **Unit tests (Vitest):** 226 passed (9 test files)
- **E2E tests (Playwright):** `tests/PROJ-14-zeiterfassung-bearbeitungsfrist.spec.ts` — **22/22 PASS** (Chromium + Mobile Safari)
- **Regression:** Alle anderen Suiten unverändert grün

### Acceptance Criteria Results

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Manager kann `/manager/settings` konfigurieren | ✅ PASS | Seite existiert, Form funktioniert |
| 2 | Wertebereich 1–365, Standardwert 14 | ✅ PASS | Client + Server Validierung korrekt; `step={1}` verhindert Dezimalwerte |
| 3 | Werkstudenten sehen Bearbeiten-Button nur innerhalb der Frist | ✅ PASS | `cutoffStr`-Logik korrekt umgesetzt |
| 4 | Bearbeiten-Button ausgeblendet (nicht nur disabled) | ✅ PASS | Conditional render, kein `disabled` |
| 5 | Manager sehen alle Bearbeiten-Buttons (keine Frist) | ✅ PASS | `maxEditDaysPast = null` → kein Cutoff; proxy.ts leitet Manager zu `/manager` (unit-tested) |
| 6 | Serverseitige Validierung verhindert direkten SDK-Aufruf | ✅ PASS | `saveBreak` → `updateBreakMinutes` Server Action → `assertEditPermission` |
| 7 | Änderungen sofort wirksam | ✅ PASS | Dashboard nutzt dynamisches Rendering (Auth-Cookies) |
| 8 | Einstellungsseite zeigt aktuelle Frist, Speichern übernimmt Wert | ✅ PASS | Formular korrekt, Erfolgs-Alert erscheint |
| 9 | Nur Manager haben Schreibzugriff; Werkstudenten nur Lesen | ✅ PASS | RLS-Policy + Server Action Rollen-Check |

### Bugs Found

#### ~~Bug #1 — HIGH: `saveBreak` in StempelCard umgeht Server-seitige Berechtigungsprüfung~~ ✅ BEHOBEN
`saveBreak` ruft jetzt `updateBreakMinutes(entryId, date, minutes)` auf — eine Server Action die `assertEditPermission` aufruft. Commit `409349d`.

#### ~~Bug #2 — Low: Dezimale Eingabe in SettingsForm wird still abgerundet~~ ✅ BEHOBEN
`step={1}` zum Input-Element hinzugefügt. Commit `c96f372`.

### Edge Cases Tested

| Edge Case | Result |
|-----------|--------|
| Frist 0 Tage (nur heute editierbar) | ✅ Korrekte Logik in `computeCutoffStr` (unit-tested) |
| Frist 365 Tage (volles Jahr) | ✅ Korrekte Logik (unit-tested) |
| Frist erhöht → ältere Einträge sofort wieder editierbar | ✅ Dynamisches Rendering sorgt für sofortige Wirksamkeit |
| Frist verringert → alte Einträge verlieren Bearbeiten-Button | ✅ Korrekte Logik |
| Kein DB-Eintrag in `app_settings` → Default 14 Tage | ✅ Fallback in page.tsx und assertEditPermission |
| Formular leer abgeschickt → Pflichtfeldvalidierung | ✅ `isNaN(NaN)` blockiert korrekt; HTML5 `min`/`max` als erste Schranke |
| Werkstudent ruft `/manager/settings` auf | ✅ Redirect zu `/dashboard` (E2E) |
| Unauthentifizierter Zugriff auf `/manager/settings` | ✅ Redirect zu `/login` (E2E) |
| Manager ruft `/dashboard` auf | ✅ Proxy-Middleware leitet zu `/manager` (E2E) |

### Security Audit

- **RLS-Policies:** SELECT für alle authenticated ✓, INSERT/UPDATE nur Manager ✓, kein DELETE-Policy (korrekt — Default Deny) ✓
- **Server Action Rollen-Check:** `saveMaxEditDaysPast` prüft Manager-Rolle serverseitig ✓
- **`assertEditPermission`:** Prüft Rolle + Datum für alle vier Server Actions (`updateActualEntry`, `insertActualEntry`, `deleteActualEntry`, `updateBreakMinutes`) ✓
- **Direkter SDK-Zugriff:** Kein direkter Supabase-Browser-Client mehr für `actual_entries`-Updates in `StempelCard` ✓
- **Stamp-API:** `/api/time-entries/stamp` schreibt nur für `date = today` (Berlin-Zeitzone) → nicht betroffen von der Bearbeitungsfrist ✓
- **DB-Migration:** `app_settings`-Tabelle auf Remote-Supabase angelegt; RLS-Policies korrekt gesetzt ✓

### Responsiveness
- 375px: Settings-Seite korrekt dargestellt ✅ (E2E)
- 768px: Settings-Seite korrekt dargestellt ✅ (E2E)
- 1440px: Kein Layout-Problem festgestellt ✅

### Production-Ready Decision
**READY** — Keine Critical- oder High-Bugs. Alle 9 Acceptance Criteria erfüllt. 226 Unit-Tests + 22/22 E2E-Tests grün.

## Deployment
_To be added by /deploy_
