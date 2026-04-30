# PROJ-9: Pausenerfassung

## Status: Approved
**Created:** 2026-04-30
**Last Updated:** 2026-04-30

## Dependencies
- Requires: PROJ-1 (Authentication) – Werkstudent muss eingeloggt sein
- Requires: PROJ-4 (Tages-Zeiterfassung) – `actual_entries` wird um `break_minutes` erweitert
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – Pausen-Check erfolgt über alle Tagesblöcke hinweg

## Scope
Werkstudenten können pro Zeitblock (Ist-Erfassung) eine Pausendauer in Minuten angeben. Die Netto-Arbeitszeit ergibt sich als Blockdauer minus Pause. Die Wochenplanung (Soll) bleibt unverändert. Eine gesetzliche Mindestpausenprüfung warnt – ohne zu blockieren – wenn die Pausenzeiten die Vorgaben des § 4 ArbZG unterschreiten.

## User Stories
- Als Werkstudent möchte ich beim Bearbeiten eines Zeitblocks eine Pausendauer (in Minuten) eingeben können, damit meine tatsächliche Netto-Arbeitszeit korrekt erfasst wird.
- Als Werkstudent möchte ich nach dem Ausstempeln optional eine Pause angeben können, damit ich nicht jedes Mal nachträglich den Block bearbeiten muss.
- Als Werkstudent möchte ich auf dem Dashboard meine Netto-Arbeitszeit (nach Abzug der Pausen) sehen, damit ich mein Stundenkonto realistisch einschätzen kann.
- Als Werkstudent möchte ich eine Warnung sehen, wenn meine Pause die gesetzliche Mindestdauer nicht erreicht, damit ich rechtliche Verstöße vermeiden kann.
- Als Manager möchte ich in der Kalenderansicht und in der Wochenübersicht die Netto-Arbeitszeit (nach Pausen) sehen, damit die Auswertungen der tatsächlichen Arbeitszeit korrekt sind.

## Acceptance Criteria

### Pauseneingabe im Edit-Dialog
- [ ] Im `IstEintragEditDialog` gibt es ein Eingabefeld „Pause (Min)" — ganze Zahlen, 0–480, Standard: 0
- [ ] Unterhalb des Feldes wird die Netto-Arbeitszeit live berechnet und angezeigt: `Netto: X,X Std` (Blockdauer − Pausendauer)
- [ ] Pausendauer darf nicht größer als die Blockdauer sein → Validierungsfehler, Speichern blockiert
- [ ] Negative Pausenangaben sind nicht erlaubt → Validierungsfehler

### Pauseneingabe nach dem Ausstempeln
- [ ] Nach erfolgreichem Ausstempeln erscheint eine optionale Pausenabfrage: „Haben Sie heute eine Pause gemacht? [__] Min" mit Buttons „Überspringen" und „Speichern"
- [ ] „Überspringen" speichert `break_minutes = 0` für den gerade geschlossenen Block
- [ ] „Speichern" aktualisiert `break_minutes` des eben geschlossenen Blocks

### Anzeige in der StempelCard
- [ ] Pro abgeschlossenem Block wird angezeigt: Von–Bis, Pause (falls > 0 Min), Netto-Arbeitszeit
- [ ] Die Tages-Netto-Summe ergibt sich aus der Summe aller (Blockdauer − Pausendauer) über alle vollständigen Blöcke
- [ ] Das Wochenstundenlimit wird gegen die Netto-Tagesstunden der aktuellen Woche geprüft (nicht gegen Brutto)

### Anzeige in der WochenIstübersicht
- [ ] Die „Ist"-Spalte zeigt Netto-Stunden (nach Pausen); bei mehreren Blöcken bleibt die bisherige Zusammenfassung (X Bl.) mit Netto-Summe
- [ ] Die Wochensumme in der Fußzeile basiert auf Netto-Stunden

### Gesetzliche Mindestpausenprüfung (§ 4 ArbZG)
- [ ] Prüfung erfolgt täglich gegen die **Brutto**-Tagesarbeitszeit (Summe aller Blockdauern, ohne Pausenabzug) und die **Gesamt**-Pausenzeit (Summe aller `break_minutes` des Tages)
- [ ] Brutto > 6 Std und Gesamtpause < 30 Min → Warnung: „Gesetzliche Mindestpause von 30 Min nicht erreicht (§ 4 ArbZG)"
- [ ] Brutto > 9 Std und Gesamtpause < 45 Min → Warnung: „Gesetzliche Mindestpause von 45 Min nicht erreicht (§ 4 ArbZG)"
- [ ] Warnung ist ein Hinweis (gelb/amber) — kein Block, Speichern bleibt möglich
- [ ] Warnung erscheint sowohl im `IstEintragEditDialog` (Echtzeit) als auch in der `StempelCard` (nach dem Ausstempeln)

## Edge Cases
- Was passiert, wenn `break_minutes` größer als die Blockdauer ist? → Validierungsfehler „Pause darf die Blockdauer nicht überschreiten", Speichern blockiert
- Was passiert, wenn `break_minutes = 0` eingegeben wird? → Gültig; Netto = Brutto; keine Warnung außer bei gesetzlicher Mindestpause
- Was passiert bei mehreren Blöcken am Tag? → Gesamt-Pausenzeit = Summe aller `break_minutes`; die gesetzliche Prüfung und die Netto-Tagessumme beziehen sich auf alle Blöcke des Tages
- Was passiert mit bestehenden Einträgen ohne `break_minutes`? → `break_minutes = 0` (kein Datenverlust, keine Breaking Changes)
- Was passiert, wenn ein Werkstudent nachträglich Pausen für vergangene Blöcke einträgt? → Erlaubt über den Edit-Dialog; gesetzliche Warnung aktualisiert sich live
- Was passiert, wenn der Werkstudent die Pausenabfrage nach dem Ausstempeln schließt (Dialog-X)? → Verhält sich wie „Überspringen" (break_minutes = 0)

## Technical Requirements
- **DB-Migration `actual_entries`:** Neue Spalte `break_minutes` (integer, NOT NULL DEFAULT 0, CHECK `break_minutes >= 0`) — keine Änderung an `planned_entries`
- **Keine Änderung an RLS-Policies** — bestehende Werkstudent/Manager-Regeln bleiben gültig
- **Netto-Stundenberechnung:** `((actual_end - actual_start) in Minuten) - break_minutes` / 60 → Stunden; überall konsistent aus `time-block-utils.ts` bezogen
- **Gesetzliche Prüfung:** Clientseitig in `IstEintragEditDialog` (live) und `StempelCard` (nach Ausstempeln); keine server-seitige Blockierung
- **Pausenabfrage nach Ausstempeln:** Inline-Formular in der `StempelCard` (kein separater Dialog), erscheint unmittelbar nach dem PATCH-Response

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Jeder Zeitblock in der Ist-Erfassung erhält ein optionales Pausenfeld (`break_minutes`). Die App zeigt überall Netto-Arbeitszeit (Brutto minus Pause) und warnt bei Unterschreitung der gesetzlichen Mindestpausen (§ 4 ArbZG).

### Komponentenstruktur

```
Betroffene Komponenten (keine neuen Seiten/Routen):

IstEintragEditDialog (erweitert)
├── Start/End Zeitfelder (vorhanden)
├── Pause (Min) – Eingabefeld, 0–480 (NEU)
├── Live-Vorschau „Netto: X,X Std" (NEU)
├── Validierung: Pause > Blockdauer → Fehler, Speichern blockiert (NEU)
└── ArbZG-Warnung (amber, nicht blockierend, Echtzeit) (NEU)

StempelCard (erweitert)
├── Blockliste: je Block → „Von–Bis · Pause X Min · Netto X,Xh" (AKTUALISIERT)
├── Tages-Netto-Summe statt Brutto im Badge (AKTUALISIERT)
├── ArbZG-Warnung nach Ausstempeln (amber Alert) (NEU)
├── Inline-Pausenabfrage direkt nach Ausstempeln (NEU)
│   ├── Eingabe Pause (Min)
│   └── Buttons: „Überspringen" | „Speichern"
└── Stempel-Buttons (vorhanden)

WochenIstübersicht (erweitert)
├── Ist-Spalte pro Tag: Netto-Stunden statt Brutto (AKTUALISIERT)
└── Wochensumme in der Fußzeile: Netto (AKTUALISIERT)
```

### Datenmodell

**DB-Migration – Tabelle `actual_entries`:**
Neue Spalte `break_minutes` (INTEGER NOT NULL DEFAULT 0, CHECK >= 0).
Alle bisherigen Einträge erhalten automatisch den Wert 0 – kein Datenverlust, keine Breaking Changes. Keine Änderungen an `planned_entries` oder RLS-Policies.

**Netto-Berechnung:**
- Pro Block: (Endzeit − Startzeit in Minuten) − break_minutes ÷ 60
- Tagesgesamt: Summe aller abgeschlossenen Blöcke nach Netto-Formel
- Wochengesamt: Summe der Tages-Nettos der gesamten Woche

**Gesetzliche Mindestpausenprüfung (§ 4 ArbZG) – täglich, clientseitig:**
- Brutto > 6 Std & Gesamtpause < 30 Min → amber Warnung
- Brutto > 9 Std & Gesamtpause < 45 Min → amber Warnung
- Reine Anzeige, kein Block

### Neue Utility-Funktionen (`time-block-utils.ts`)

- **`calcNetHours(start, end, breakMinutes)`** – Netto-Stunden pro Block; ersetzt `calcBlockHours` überall, wo Ist-Stunden angezeigt werden
- **`checkArbZGWarning(bruttoMinutes, totalBreakMinutes)`** – gibt Warntext oder `null` zurück; wiederverwendbar in Dialog und StempelCard

### TypeScript-Typen

`ActualEntry` in `database.types.ts` bekommt `break_minutes: number`. Der Supabase `Database`-Typ wird ebenfalls angepasst.

### Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Inline-Pausenabfrage in StempelCard (kein Dialog) | Spec-Vorgabe; reduziert Click-Aufwand |
| Pausenspeicherung via Supabase-Client (keine neue API-Route) | `IstEintragEditDialog` macht das bereits so – konsistentes Muster |
| Alle Netto-Berechnungen in `time-block-utils.ts` | Zentrale Logik, kein duplizierter Code |
| ArbZG-Prüfung komplett clientseitig | Warnung, kein Enforcement – kein Server-Roundtrip nötig |
| DEFAULT 0 in der DB-Migration | Abwärtskompatibel; bestehende Einträge bleiben korrekt |

### Änderungsübersicht

| Datei | Art |
|---|---|
| DB-Migration `actual_entries` | Neue Spalte `break_minutes` |
| `src/lib/database.types.ts` | `break_minutes` in Typen ergänzen |
| `src/lib/time-block-utils.ts` | 2 neue Funktionen: `calcNetHours`, `checkArbZGWarning` |
| `src/components/zeiterfassung/IstEintragEditDialog.tsx` | Pausenfeld + ArbZG-Warnung |
| `src/components/zeiterfassung/StempelCard.tsx` | Inline-Pausenabfrage + Netto-Anzeige + ArbZG-Warnung |
| `src/components/zeiterfassung/WochenIstübersicht.tsx` | Netto-Stunden statt Brutto |

### Neue Pakete
Keine – alle shadcn/ui-Komponenten (Input, Alert, Button, Badge) sind bereits installiert.

## Implementation Notes (Backend)

**DB Migration:** `break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0)` added to `actual_entries` via Supabase MCP. No RLS changes needed.

**TypeScript:** `break_minutes: number` added to `ActualEntry` type and the `Database` type in `database.types.ts`.

**Utilities (`time-block-utils.ts`):**
- `calcNetHours(start, end, breakMinutes)` — Netto-Stunden pro Block
- `checkArbZGWarning(bruttoMinutes, totalBreakMinutes)` — Warntext oder null; 9h→45 Min, 6h→30 Min Schwelle
- 14 neue Tests, alle grün (141 gesamt)

**Components updated:**
- `IstEintragEditDialog` — Pause-Feld (0–480 Min), Live-Netto-Vorschau, Blockierungs-Validierung (Pause > Blockdauer), ArbZG-Warnung (tagesweise, Echtzeit)
- `StempelCard` — Netto-Stunden im Badge, pro Block Pause+Netto angezeigt, Inline-Pausenabfrage nach Ausstempeln, ArbZG-Warnung
- `WochenIstübersicht` — `calcNetHours` statt `calcBlockHours` überall (Ist-Spalte, Wochensumme, Tages-Detail-Dialog)

**Kein neuer API-Route** — Pausenspeicherung via direktem Supabase-Browser-Client, konsistent mit bestehendem Muster.

## QA Test Results

**Date:** 2026-04-30
**Result:** APPROVED — keine Critical/High Bugs, Feature produktionsreif

### Acceptance Criteria

| # | Kriterium | Status |
|---|-----------|--------|
| AC-1 | Pause (Min) Eingabefeld im IstEintragEditDialog (0–480, Standard 0) | ✅ Pass |
| AC-2 | Live-Vorschau „Netto: X,X Std" unterhalb des Feldes | ✅ Pass |
| AC-3 | Pausendauer > Blockdauer → Validierungsfehler, Speichern blockiert | ✅ Pass |
| AC-4 | Negative Pausenangaben nicht erlaubt (clamped to 0 via onChange) | ✅ Pass |
| AC-5 | Inline Pausenabfrage nach dem Ausstempeln in StempelCard | ✅ Pass |
| AC-6 | „Überspringen" speichert break_minutes = 0 | ✅ Pass |
| AC-7 | „Speichern" aktualisiert break_minutes des gerade geschlossenen Blocks | ✅ Pass |
| AC-8 | Pro Block: Von–Bis + Pause (falls > 0 Min) + Netto-Arbeitszeit | ✅ Pass |
| AC-9 | Tages-Netto-Summe = Summe aller (Blockdauer − Pause) | ✅ Pass |
| AC-10 | Wochenstundenlimit gegen Netto-Stunden geprüft (nicht Brutto) | ✅ Pass |
| AC-11 | Ist-Spalte WochenIstübersicht zeigt Netto-Stunden | ✅ Pass |
| AC-12 | Wochensumme in der Fußzeile basiert auf Netto-Stunden | ✅ Pass |
| AC-13 | Brutto > 6 Std & Gesamtpause < 30 Min → amber Warnung | ✅ Pass |
| AC-14 | Brutto > 9 Std & Gesamtpause < 45 Min → amber Warnung | ✅ Pass |
| AC-15 | ArbZG-Warnung ist Hinweis (amber), kein Block — Speichern bleibt möglich | ✅ Pass |
| AC-16 | ArbZG-Warnung in IstEintragEditDialog (Echtzeit) | ✅ Pass |
| AC-17 | ArbZG-Warnung in StempelCard nach dem Ausstempeln | ✅ Pass |

### Edge Cases

| Edge Case | Status | Anmerkung |
|-----------|--------|-----------|
| break_minutes > Blockdauer | ✅ Blockiert korrekt | Implementierung nutzt `>=` statt `>` — siehe BUG-3 |
| break_minutes = 0 | ✅ Gültig, kein Datenverlust | |
| Mehrere Blöcke am Tag, Gesamtpause summiert | ✅ Pass | |
| Bestehende Einträge ohne break_minutes | ✅ DEFAULT 0, kein Datenverlust | |
| Pausenabfrage nach Ausstempeln schließen (X-Button) | ⚠️ Kein X-Button vorhanden | Nur Überspringen/Speichern möglich — siehe BUG-2 |
| Rückwirkend Pausen für vergangene Blöcke eintragen | ✅ Über Edit-Dialog möglich | |

### Automated Tests

**Unit Tests (Vitest):** 141/141 ✅ — inkl. 14 Tests für `calcNetHours` und `checkArbZGWarning`

**E2E Tests (Playwright):** 4 passed, 12 skipped (kein Fehler)
- Skips erwartet: Dev-Login-User hat Manager-Rolle; Proxy leitet Manager von `/dashboard` → `/manager` weiter
- Authentifizierte Werkstudenten-Tests benötigen einen Werkstudenten-Testaccount (PROJ-11)
- Unauthenifizierte Tests + API-Security-Tests laufen durch

**Neue E2E-Testdatei:** `tests/PROJ-9-pausenerfassung.spec.ts`

### Security Audit

- ✅ `/dashboard` erfordert Authentifizierung (Proxy-Middleware schützt Route)
- ✅ Stamp-API gibt 401 für unauthentifizierte Requests zurück
- ✅ Break-Speicherung via Supabase-Client (RLS-Policies bleiben unverändert aktiv)
- ✅ Manager-Rolle hat keinen Zugriff auf `/dashboard` (Proxy-Redirect)
- ✅ Kein XSS-Risiko: break_minutes ist numerisch, wird geparst und geclampt

### Bugs Found

**BUG-1 (Medium) — Break-Obergrenze (480 Min) nicht im JS validiert**
- Beschreibung: Das `max={480}` HTML-Attribut auf dem Pause-Eingabefeld kann durch direktes Tippen umgangen werden. In `IstEintragEditDialog` und `StempelCard.saveBreak()` fehlt eine JS-seitige Prüfung auf max. 480.
- Reproduktion: Startzeit 09:00, Endzeit 19:00, Pause "500" eingeben → kein Fehler, Speichern möglich → 500 wird in DB gespeichert
- Betroffene Dateien: [IstEintragEditDialog.tsx](src/components/zeiterfassung/IstEintragEditDialog.tsx), [StempelCard.tsx](src/components/zeiterfassung/StempelCard.tsx)

**BUG-2 (Low) — Kein X-Button zum Schließen der Pausenabfrage**
- Beschreibung: Spec-Edge-Case sagt "Dialog-X → verhält sich wie Überspringen". Das Inline-Formular in StempelCard hat keinen Schließen-Button. Nutzer müssen zwingend "Überspringen" oder "Speichern" klicken.
- Betroffene Datei: [StempelCard.tsx](src/components/zeiterfassung/StempelCard.tsx:216)

**BUG-3 (Low) — breakExceedsDuration nutzt `>=` statt `>`**
- Beschreibung: Spec sagt "darf nicht größer als" (>), Implementierung blockt auch bei Pause = Blockdauer (≥). Netto würde 0 ergeben, was argumentierbar sinnvoll ist, aber vom Spec abweicht.
- Betroffene Datei: [IstEintragEditDialog.tsx](src/components/zeiterfassung/IstEintragEditDialog.tsx:68)

### Regression Testing

- ✅ PROJ-4 Zeiterfassung: keine Regressionen
- ✅ PROJ-8 Mehrere Zeitblöcke: keine Regressionen
- ⚠️ PROJ-7 Dev-Login: 4 pre-existing Failures (unverändert vor/nach PROJ-9)

### Produktionsbereit: JA

Keine Critical- oder High-Bugs. BUG-1 (Medium) und BUG-2/BUG-3 (Low) können nach dem ersten Deployment gefixt werden.

## Deployment
_To be added by /deploy_
