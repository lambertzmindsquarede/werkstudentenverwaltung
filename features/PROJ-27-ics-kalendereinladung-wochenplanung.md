# PROJ-27: ICS-Kalendereinladung bei Wochenplanung

## Status: In Progress
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Implementation Notes
- DB migration applied: `manager_ics_settings` and `ics_event_sequences` tables created with RLS
- `src/lib/ics-generator.ts` — pure function using `ical-generator` (RFC 5545), supports UPDATE/CANCEL via SEQUENCE
- `src/lib/ics-sender.ts` — Microsoft Graph API Client Credentials Flow, fire-and-forget, reads `bereich_manager.user_id` (not manager_id)
- `src/app/manager/settings/ics-actions.ts` — Server Actions: `loadIcsSettings`, `saveIcsSettings` with Zod validation
- `src/app/manager/settings/IcsEinstellungen.tsx` — Toggle + recipient badge list UI (max 10 emails)
- `src/app/manager/kalender/IcsDownloadButton.tsx` — Client button triggering `/api/ics/download`
- `src/app/api/ics/download/route.ts` — GET route for manual ICS download by manager
- `saveWeekPlan` in wochenplanung/actions.ts: fire-and-forget `void triggerIcsSend(...)` after successful DB write
- `database.types.ts` updated with new table type definitions
- Env vars required: `MAIL_AZURE_CLIENT_ID`, `MAIL_AZURE_CLIENT_SECRET` (reuses `AZURE_AD_TENANT_ID`)

## Dependencies
- Requires: PROJ-3 (Wochenplanung) — Planeinträge sind die Quelle der ICS-Events
- Requires: PROJ-18 (Admin-Rolle & Bereichsverwaltung) — Bereich-Manager-Zuordnung bestimmt, wer den ICS erhält
- Requires: PROJ-19 (Bereichs-Datenisolation) — Werkstudent gehört zu einem Bereich mit zugeordnetem Manager

## User Stories
- Als Manager möchte ich in meinen Einstellungen ICS-Kalendereinladungen aktivieren oder deaktivieren, damit ich selbst entscheide, ob ich diese Termine erhalte.
- Als Manager möchte ich in meinen Einstellungen eine Liste zusätzlicher E-Mail-Empfänger hinterlegen, damit Kollegen oder Vorgesetzte ebenfalls über geplante Anwesenheiten informiert werden.
- Als Manager möchte ich beim Speichern eines Wochenplans durch einen Werkstudenten automatisch eine E-Mail mit einer .ics-Datei im Anhang erhalten, damit der Termin direkt in meinen Kalender importiert werden kann.
- Als Manager möchte ich, dass jeder geplante Arbeitstag als eigener ganztägiger Termin mit Status „Frei" erscheint und den Betreff „[Vorname Nachname] HH:MM - HH:MM Uhr (X Stunden)" trägt, damit ich auf einen Blick sehe, wann und wie lange der Werkstudent plant.
- Als Manager möchte ich, dass bei einer nachträglichen Planänderung ein aktualisierter ICS (UPDATE) gesendet wird, damit mein Kalender immer den aktuellen Stand zeigt.
- Als Manager möchte ich in der Kalenderansicht einen „ICS herunterladen"-Button sehen, damit ich die Datei manuell erneut abrufen kann, falls eine E-Mail verloren gegangen ist.

## Acceptance Criteria

### Einstellungen
- [ ] In `/manager/settings` gibt es einen Toggle „ICS-Kalendereinladungen aktivieren" (Standard: deaktiviert)
- [ ] Die Einstellung ist pro Manager gespeichert (nicht global)
- [ ] Unter dem Toggle kann der Manager eine Liste zusätzlicher E-Mail-Adressen als Empfänger hinterlegen (max. 10 Adressen)
- [ ] E-Mail-Adressen werden beim Speichern auf gültiges Format validiert; ungültige Adressen werden abgelehnt mit einer klaren Fehlermeldung
- [ ] Empfänger können einzeln hinzugefügt und entfernt werden

### Automatischer Versand (E-Mail)
- [ ] Beim Speichern eines Wochenplans durch einen Werkstudenten wird geprüft, ob der/die zuständige Manager des Bereichs ICS aktiviert haben
- [ ] Nur wenn aktiviert, wird pro geplantem Arbeitstag ein VEVENT erstellt und zusammen als eine .ics-Datei per E-Mail versandt
- [ ] E-Mail-Empfänger: Manager (Azure AD E-Mail aus Profil) + alle konfigurierten zusätzlichen Empfänger
- [ ] Betreff der E-Mail: `Wochenplan [Vorname Nachname] – KW [X], [YYYY]`
- [ ] Anhang: `wochenplan-[nachname]-kw[X]-[YYYY].ics`

### ICS-Format pro Tag
- [ ] Termin-Typ: ganztägig (`DTSTART;VALUE=DATE:YYYYMMDD`, `DTEND;VALUE=DATE` = Folgetag)
- [ ] Termin-Status: Frei (`TRANSP:TRANSPARENT`)
- [ ] Termin-Betreff (SUMMARY): `[Vorname Nachname] HH:MM - HH:MM Uhr (X,X Stunden)` — Stunden auf eine Dezimalstelle gerundet, deutsches Komma
- [ ] Stabile UID pro Termin: `wsv-{user_id}-{date}@werkstudentenverwaltung`
- [ ] SEQUENCE wird bei jeder Änderung desselben Termins erhöht

### Update bei Planänderung
- [ ] Wenn ein bereits einmal gesendeter Plantag erneut gespeichert wird, wird ein ICS mit erhöhtem SEQUENCE-Wert (UPDATE) versandt
- [ ] Wenn ein Tag aus dem Plan entfernt wird (war vorher vorhanden), wird ein `METHOD:CANCEL`-Event für diesen Tag versandt

### Manueller Download
- [ ] In der Manager-Kalenderansicht (`/manager/kalender`) gibt es pro Woche einen „ICS herunterladen"-Button
- [ ] Der Download liefert eine .ics-Datei mit allen geplanten Arbeitstagen der gewählten Woche aller sichtbaren Werkstudenten

### Fehlerverhalten
- [ ] Ein Fehler beim ICS-Versand (z. B. SMTP-Fehler) blockiert nicht das Speichern des Wochenplans für den Werkstudenten
- [ ] Fehler werden serverseitig geloggt

## Edge Cases
- **Werkstudent hat keinen Plan für einen Tag eingetragen** → kein VEVENT für diesen Tag; falls vorher einer existierte, wird ein CANCEL gesendet
- **Manager hat keine E-Mail-Adresse im Profil** → ICS nicht generieren, kein Fehler für den Werkstudenten; Fehlermeldung im Log
- **Mehrere Manager im gleichen Bereich** → alle Manager des Bereichs mit aktivierter ICS-Funktion erhalten die Einladung unabhängig voneinander
- **Kein Manager dem Bereich des Werkstudenten zugeordnet** → kein Versand, kein Fehler
- **Planänderung vor dem ersten Versand** (ICS noch nie gesendet, z. B. Feature wurde erst nach dem Erstplan aktiviert) → beim nächsten Speichern wird ein neuer ICS mit SEQUENCE:0 versandt
- **Feiertag im Wochenplan** → ICS wird erstellt (Werkstudent hat bewusst geplant)
- **Alle 5 Arbeitstage einer Woche im Plan** → 5 VEVENTs in einer .ics-Datei
- **E-Mail-Adresse eines zusätzlichen Empfängers wird nachträglich entfernt** → künftige ICS werden nicht mehr an diese Adresse gesendet; bereits gesendete Einladungen bleiben

## Technical Requirements
- ICS-Generierung gemäß RFC 5545 (iCalendar)
- UID-Schema: `wsv-{user_id}-{date}@werkstudentenverwaltung` (stabil für UPDATE-Semantik)
- SEQUENCE-Tracking: der aktuelle Sequenz-Wert muss pro `(user_id, date)` gespeichert werden, damit Updates korrekt inkrementiert werden können
- ICS-Versand darf den Wochenplan-Speichervorgang nicht blockieren (fire-and-forget / background)
- E-Mail-Versand über konfigurierten E-Mail-Provider (Resend empfohlen, bereits im Projekt oder alternativ SMTP via Supabase)
- Manager-spezifische Einstellungen (ICS aktiv + Empfängerliste) werden pro Manager gespeichert (nicht als globaler `app_settings`-Eintrag)

---

## Tech Design (Solution Architect)

### Neue Datenbankstruktur

**Tabelle: `manager_ics_settings`**
Speichert ICS-Präferenz pro Manager (nicht global).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `manager_id` | UUID (PK, FK → profiles.id) | Welcher Manager |
| `ics_enabled` | Boolean (default: false) | Feature aktiviert? |
| `additional_emails` | Text-Array (max. 10 Einträge) | Zusätzliche Empfänger |
| `updated_at` | Timestamp | Letzte Änderung |

**Tabelle: `ics_event_sequences`**
Verfolgt pro `(user_id, date)`, wie oft ein Termin bereits gesendet wurde — notwendig für iCalendar UPDATE- und CANCEL-Semantik.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `user_id` | UUID (FK → profiles.id) | Werkstudent |
| `date` | Date | Geplanter Arbeitstag |
| `sequence` | Integer (default: 0) | Aktuelle Sequenznummer |
| *(PK: user_id + date)* | | |

Kein Eintrag = noch nie gesendet → SEQUENCE:0. Eintrag vorhanden → SEQUENCE erhöhen. Tag entfernt → CANCEL.

---

### Komponentenstruktur

```
/manager/settings (bestehende Seite — erweitern)
+-- IcsEinstellungen (NEU)
    +-- Switch "ICS-Kalendereinladungen aktivieren"
    +-- EmpfaengerListe (nur sichtbar wenn aktiviert)
        +-- E-Mail-Eingabefeld + Hinzufügen-Button
        +-- EmpfaengerTag × n (einzeln löschbar)
        +-- Fehlermeldung bei ungültigem Format oder > 10 Adressen

/manager/kalender (bestehende Seite — erweitern)
+-- IcsDownloadButton (NEU) — ein Button pro Woche
    Liefert .ics-Datei aller sichtbaren Werkstudenten der gewählten Woche

/dashboard/wochenplanung (keine sichtbare Änderung für Werkstudenten)
  → saveWeekEntries-Action ruft nach erfolgreichem DB-Write
    fire-and-forget triggerIcsSend(userId, weekStr) auf
```

---

### Neue Dateien & API-Routen

```
src/
  app/
    manager/
      settings/
        IcsEinstellungen.tsx        (NEU — UI: Toggle + Empfängerliste)
        ics-actions.ts              (NEU — Server Actions: lesen/speichern)
      kalender/
        IcsDownloadButton.tsx       (NEU — Button-Komponente)
    api/
      ics/
        download/route.ts           (NEU — GET: .ics für Manager-Download)
  lib/
    ics-generator.ts                (NEU — pure function: Planeinträge → .ics-String)
    ics-sender.ts                   (NEU — Graph API Token + sendMail)
```

**Bestehende Dateien, die angepasst werden:**
- `src/app/dashboard/wochenplanung/actions.ts` — `saveWeekEntries` ruft nach DB-Write fire-and-forget `triggerIcsSend()` auf
- `src/app/manager/kalender/page.tsx` — `IcsDownloadButton` einbinden
- `src/app/manager/settings/page.tsx` — `IcsEinstellungen` einbinden

---

### E-Mail-Versand: Microsoft Graph API

Statt eines externen Dienstes (Resend, SMTP) wird die **Microsoft Graph API** genutzt. Die App-Registrierung hat `Mail.Send`-Permission (Application Permission, nicht Delegated) und kann im Namen von `do-not-reply@mindsquare.de` senden.

**Ablauf (Client Credentials Flow):**
```
ics-sender.ts
  1. POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
     → Client Credentials (MAIL_AZURE_CLIENT_ID + MAIL_AZURE_CLIENT_SECRET)
     → scope: https://graph.microsoft.com/.default
     → Antwort: access_token

  2. POST https://graph.microsoft.com/v1.0/users/do-not-reply@mindsquare.de/sendMail
     → Authorization: Bearer {access_token}
     → Body: E-Mail-Objekt mit .ics als Base64-Anhang
     → Kein zusätzliches npm-Paket nötig (nur fetch)
```

**Neue Umgebungsvariablen** (separate App-Registrierung für Mail):
```
MAIL_AZURE_CLIENT_ID=...
MAIL_AZURE_CLIENT_SECRET=...
# AZURE_AD_TENANT_ID (bereits vorhanden) wird wiederverwendet
```

---

### Ablauf beim Speichern des Wochenplans

```
Werkstudent klickt "Speichern"
  → saveWeekEntries() schreibt Planeinträge in DB
  → Sofortige Response an Browser (Werkstudent sieht Bestätigung)
  → fire-and-forget: triggerIcsSend(userId, weekStr)
      → Lädt zugeordnete Manager des Bereichs
      → Prüft ics_enabled je Manager
      → Wenn kein Manager aktiv: fertig
      → Lädt ics_event_sequences für user_id + Wochentage
      → Vergleicht neue Planeinträge mit vorherigen Sequences:
          - Neuer Tag ohne Sequence-Eintrag → VEVENT mit SEQUENCE:0
          - Vorhandener Tag mit Änderung → VEVENT mit SEQUENCE +1
          - Entfernter Tag mit Sequence-Eintrag → CANCEL-VEVENT
      → ics-generator.ts erstellt .ics-Datei (RFC 5545)
      → Graph API Token holen → sendMail an Manager + additional_emails
      → Sequences in DB aktualisieren
      → Fehler → nur Serverlog, kein Fehler für Werkstudenten
```

---

### Abhängigkeiten (neue npm-Pakete)

| Paket | Zweck |
|-------|-------|
| `ical-generator` | RFC 5545 konforme .ics-Erzeugung (UPDATE, CANCEL, SEQUENCE) |

*(Kein Resend, kein Graph-SDK — nur fetch für die Graph API)*

## QA Test Results

**QA Date:** 2026-05-20
**Tester:** QA Engineer (automated + code review)
**Status:** NOT READY — 1 High bug, 2 Medium bugs must be fixed before deployment

### Acceptance Criteria

#### Einstellungen
- [x] Toggle „ICS-Kalendereinladungen aktivieren" vorhanden in `/manager/settings`
- [x] Einstellung ist pro Manager gespeichert (nicht global) — `manager_ics_settings` mit `manager_id` PK
- [x] Zusätzliche E-Mail-Adressen-Liste (max. 10) unter dem Toggle — nur sichtbar wenn aktiviert
- [x] Validierung auf gültiges E-Mail-Format mit klarer Fehlermeldung (client + server via Zod)
- [x] Empfänger einzeln hinzufügen und entfernen (Badge × Button)

#### Automatischer Versand (E-Mail)
- [x] Beim Speichern eines Wochenplans wird Manager-Bereich geladen und ICS-Status geprüft
- [x] ICS wird nur versandt wenn `ics_enabled = true`
- [x] Empfänger: Manager-E-Mail + `additional_emails`
- [x] Betreff: `Wochenplan [Vorname Nachname] – KW [X], [YYYY]`
- [x] Anhang: `wochenplan-[nachname]-kw[X]-[YYYY].ics`

#### ICS-Format pro Tag
- [x] Ganztägiger Termin (`DTSTART;VALUE=DATE`, `DTEND = Folgetag`) — verifiziert via Unit-Tests
- [x] Status Frei (`TRANSP:TRANSPARENT`) — verifiziert via Unit-Tests
- [x] SUMMARY: `[Vorname Nachname] HH:MM - HH:MM Uhr (X,X Stunden)` (deutsches Komma, RFC 5545 escaped als `\,`) — verifiziert via Unit-Tests
- [x] Stabile UID: `wsv-{user_id}-{date}@werkstudentenverwaltung` — verifiziert via Unit-Tests
- [x] SEQUENCE wird bei jeder Änderung erhöht — Logik in `ics_event_sequences` Tabelle

#### Update bei Planänderung
- [ ] **FAIL (BUG-M1):** CANCEL-Events werden nie generiert — `getPreviousDates` prüft nur Daten in `currentEntries`, nicht alle Wochentage
- [x] UPDATE-Events (erhöhtes SEQUENCE) werden korrekt erzeugt für bestehende Termine

#### Manueller Download
- [x] „↓ ICS herunterladen"-Button vorhanden in Kalenderansicht (`KalenderGrid`)
- [x] Download liefert `.ics`-Datei mit korrektem Content-Type
- [x] Auth-Prüfung: 401 ohne Session — verifiziert via E2E-Test
- [x] Ungültige `week`-Parameter werden abgelehnt — verifiziert via E2E-Test

#### Fehlerverhalten
- [x] ICS-Fehler blockieren nicht das Speichern des Wochenplans (fire-and-forget via `void`)
- [x] Fehler werden serverseitig geloggt (`console.error`)

### Bugs Found

#### BUG-27-H1: Authorization bypass in ICS download API (HIGH)
**File:** `src/app/api/ics/download/route.ts:44`
**Steps to reproduce:**
1. Als Manager (nicht Admin) einloggen
2. GET `/api/ics/download?week=2026-W21&bereich=<UUID-eines-anderen-Bereichs>`
3. Erwartetes Verhalten: 403 Forbidden
4. Tatsächliches Verhalten: Die Route springt in den `if (bereichFilter)` Zweig ohne zu prüfen, ob der Manager den Bereich tatsächlich verwaltet — gibt Werkstudenten-Daten eines fremden Bereichs zurück.
**Root cause:** `if (bereichFilter) { profilesQuery = profilesQuery.eq('bereich_id', bereichFilter) }` überspringt den Autorisierungscheck für nicht-Admins komplett wenn ein `bereich` Query-Parameter übergeben wird.
**Fix:** Vor der Anwendung von `bereichFilter` muss geprüft werden, ob der eingeloggte Manager diesen Bereich verwaltet (Lookup in `bereich_manager`).

#### BUG-27-M1: CANCEL-Events werden niemals generiert (MEDIUM)
**File:** `src/lib/ics-sender.ts:124`
**Steps to reproduce:**
1. Werkstudent speichert Wochenplan mit Mo+Di (ICS wird gesendet, Sequences für Mo+Di angelegt)
2. Werkstudent speichert Wochenplan erneut mit nur Mo (Di entfernt)
3. Erwartetes Verhalten: CANCEL-VEVENT für Di wird gesendet
4. Tatsächliches Verhalten: `weekDates = currentEntries.map(e => e.date)` enthält nur Mo → `getPreviousDates` findet Di's Sequence nicht → kein CANCEL
**Root cause:** `getPreviousDates` wird mit `weekDates = currentEntries.map(e.date)` aufgerufen. Wenn Di nicht mehr in `currentEntries` ist, wird Di nicht abgefragt und ist nicht in `previousSequences`. In `buildIcsEntries` ist `allTrackedDates = [...previousSequences.keys()]` dann nur [Mo] → Di wird nie als Cancellation erkannt.
**Fix:** `getPreviousDates` mit allen 5 Wochentagen aufrufen, nicht nur mit den Daten der aktuellen Einträge. Die Wochentage müssen aus `weekStr` berechnet werden.

#### BUG-27-M2: Mehrere Zeitblöcke pro Tag erzeugen doppelte UIDs (MEDIUM)
**File:** `src/lib/ics-sender.ts:158` + `src/app/api/ics/download/route.ts:90`
**Steps to reproduce:**
1. Werkstudent speichert Wochenplan mit 2 Blöcken an einem Tag (PROJ-8)
2. ICS wird erzeugt: beide Blöcke erzeugen je ein VEVENT mit identischer UID `wsv-{userId}-{date}@werkstudentenverwaltung`
3. RFC 5545 verbietet doppelte UIDs in einer Kalenderdatei → Kalender-Apps ignorieren oder überschreiben Duplikate
**Root cause:** `toInsert` in `saveWeekPlan` enthält für multi-block Tage mehrere Einträge mit gleichem `date`. `buildIcsEntries` iteriert über alle und erzeugt VEVENTs mit demselben UID. Gleiche Logik betrifft den Download-Route.
**Fix:** Einträge pro Tag aggregieren (z. B. nur Block 1 für die Event-Zeitangabe verwenden, oder alle Blöcke in einem einzigen VEVENT zusammenfassen).

#### BUG-27-L1: Doppelte E-Mail-Adressen server-seitig nicht abgelehnt (LOW)
**File:** `src/app/manager/settings/ics-actions.ts:37`
**Steps to reproduce:**
1. Direkt `saveIcsSettings` mit doppelter Adresse aufrufen (z. B. `["a@b.de", "a@b.de"]`)
2. Zod-Schema validiert Format und max. 10 Adressen, aber keine Eindeutigkeit
3. Doppelte Adressen werden in DB gespeichert → E-Mails werden mehrfach versandt
**Fix:** `.refine((arr) => new Set(arr).size === arr.length, { message: 'Doppelte E-Mail-Adressen sind nicht erlaubt' })` zu Zod-Schema hinzufügen.

### Test Coverage Added

**Unit Tests:** `src/lib/ics-generator.test.ts` — 14 Tests (alle bestanden)
- generateIcs: VCALENDAR wrapper, UID-Schema, SUMMARY-Format, Dezimalstunden, TRANSP:TRANSPARENT, Ganztags-Datum (DTSTART/DTEND), SEQUENCE:0/1, CANCEL-Status, mehrere VEVENTs, leere Eingabe
- generateIcsWithMethod: METHOD:REQUEST, METHOD:CANCEL, generateIcs ohne METHOD

**E2E Tests:** `tests/PROJ-27-ics-kalendereinladung.spec.ts` — 14 Tests (alle bestanden)
- GET /api/ics/download: 401 ohne Auth, 400/401 für fehlendes week-Param, Ablehnung ungültiger Formate
- /manager/settings und /manager/kalender: Redirect zu /login ohne Session

### Regression Check
- Alle 332 Unit-Tests bestanden (14 neue + 318 bestehende)
- Alle 14 neuen E2E-Tests bestanden

## Deployment
_To be added by /deploy_
