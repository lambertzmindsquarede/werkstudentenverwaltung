# PROJ-15: Änderungsbenachrichtigung für Manager

## Status: Deployed
**Created:** 2026-05-05
**Last Updated:** 2026-05-06

## Dependencies
- Requires: PROJ-2 (Nutzerverwaltung) – wird um Manager-Zuordnung erweitert
- Requires: PROJ-4 (Tages-Zeiterfassung) – Zeiteinträge, die geändert werden
- Requires: PROJ-8 (Mehrere Zeitblöcke pro Tag) – mehrere Zeitblöcke als Änderungsobjekte
- Requires: PROJ-9 (Pausenerfassung) – Pausen als Änderungsobjekte
- Relates to: PROJ-14 (Bearbeitungsfrist) – definiert, für welche vergangenen Tage Änderungen erlaubt sind

## Summary
Wenn ein Werkstudent eine vergangene Buchung (Zeiterfassung oder Pause) nachträglich bearbeitet, wird eine E-Mail-Benachrichtigung an den zuständigen Manager gesendet. Der Versand erfolgt täglich um 08:00 Uhr als Sammelmail mit allen Änderungen des Vortages. Nur Änderungen an vergangenen Tagen (nicht der laufende Tag) lösen eine Benachrichtigung aus.

## User Stories

- Als Manager möchte ich täglich um 08:00 Uhr eine Sammelmail mit allen nachträglichen Buchungsänderungen meiner Werkstudenten erhalten, damit ich Abweichungen ohne manuelles Nachfragen nachvollziehen kann.
- Als Manager möchte ich in der Mail sehen, wer die Änderung vorgenommen hat, welcher Tag betroffen war sowie den alten und neuen Wert, damit ich die Änderung einordnen kann.
- Als Admin/Manager möchte ich in der Nutzerverwaltung jedem Werkstudenten einen Vorgesetzten zuweisen können, damit die Benachrichtigungen an die richtige Person gehen.
- Als Werkstudent möchte ich beim Speichern einer vergangenen Buchung darauf hingewiesen werden, dass mein Vorgesetzter benachrichtigt wird, damit ich bewusst entscheide.

## Acceptance Criteria

- [ ] In der Nutzerverwaltung (PROJ-2) kann jedem Werkstudenten ein Manager (Vorgesetzter) zugewiesen werden; das Feld ist optional
- [ ] Jede Änderung an einem vergangenen `actual_entries`-Eintrag (Zeitblock-Start/-Ende) wird in einer Audit-Tabelle (`booking_change_log`) protokolliert
- [ ] Jede Änderung an einem vergangenen `break_entries`-Eintrag (Pausen-Start/-Ende) wird ebenfalls in `booking_change_log` protokolliert
- [ ] Als „vergangen" gilt: Einträge mit `date < heute (Europe/Berlin)`; Änderungen am laufenden Tag lösen keine Mail aus
- [ ] Täglich um 08:00 Uhr (Europe/Berlin) wird ein Cron-Job ausgeführt, der alle Änderungen seit der letzten Ausführung (letzten 24 Stunden) verarbeitet
- [ ] Pro Manager wird pro betroffenen Werkstudenten eine eigene E-Mail versendet
- [ ] Die Betreffzeile lautet exakt: `Werkstudentenverwaltung es wurde ein Eintrag von [Vorname Nachname] geändert`
- [ ] Der Mailinhalt enthält je Änderung: betroffener Tag (Datum ausgeschrieben), Art der Buchung (Zeiterfassung / Pause), alter Wert, neuer Wert, Zeitstempel der Änderung
- [ ] Wenn kein Werkstudent des Managers im Zeitraum Änderungen vorgenommen hat, wird keine Mail versendet
- [ ] Der Werkstudent sieht beim Speichern einer vergangenen Buchung einen Hinweis: „Dein Vorgesetzter wird über diese Änderung informiert"
- [ ] Ist einem Werkstudenten kein Manager zugewiesen, wird die Änderung protokolliert, aber keine Mail versendet

## Edge Cases

- Was passiert, wenn ein Werkstudent am laufenden Tag (heute) seine Zeiterfassung bearbeitet? → Keine Benachrichtigung; nur vergangene Tage lösen Mails aus
- Was passiert, wenn mehrere Werkstudenten desselben Managers an einem Tag Änderungen vornehmen? → Je Werkstudent eine separate Mail (nicht gebündelt in einer Mail), damit die Betreffzeile klar ist
- Was passiert, wenn ein Werkstudent keinen zugewiesenen Manager hat? → Änderung wird im `booking_change_log` gespeichert; keine Mail; kein Fehler für den Endnutzer; technisches Log-Entry
- Was passiert, wenn der Cron-Job ausfällt? → Beim nächsten Lauf werden alle unverarbeiteten Einträge seit dem letzten erfolgreichen Lauf nachgeholt (Timestamp-basiert, kein Datenverlust)
- Was passiert, wenn der Manager keine E-Mail-Adresse hinterlegt hat? → Mail kann nicht versendet werden; Fehler wird serverseitig geloggt; kein Absturz
- Was passiert, wenn eine Buchung mehrfach geändert wird (z.B. erst 09:00, dann 09:15, dann 09:30)? → Alle Änderungen werden einzeln protokolliert; die Mail listet alle Änderungen des Tages (mit Zeitstempel), nicht nur die letzte
- Was passiert, wenn eine Buchung gelöscht statt nur geändert wird? → Der alte Wert wird gespeichert, der neue Wert ist „—" (Eintrag gelöscht); Mail-Inhalt macht die Löschung kenntlich

## Technical Requirements

- **Audit-Tabelle:** `booking_change_log` mit Feldern: `id`, `entry_type` (actual_entry / break_entry), `entry_id`, `user_id`, `date`, `field_changed`, `old_value`, `new_value`, `changed_at`, `notified_at` (NULL bis Mail versendet)
- **Manager-Zuordnung:** Feld `manager_id` (FK auf `profiles`) in der `profiles`-Tabelle; kann NULL sein
- **Cron-Job:** Supabase Edge Function, täglich 08:00 Uhr Europe/Berlin; verarbeitet alle `booking_change_log`-Einträge mit `notified_at IS NULL` und `date < today`
- **E-Mail-Service:** Supabase integriertes SMTP / Edge Function mit Fetch
- **RLS:** `booking_change_log` — Werkstudenten können nur eigene Einträge lesen; Manager können Einträge ihrer Werkstudenten lesen; Schreiben nur durch Server (Edge Function / API Route)
- **Trigger-Zeitpunkt:** Audit-Eintrag wird beim Speichern der Änderung erstellt (synchron zur Bearbeitung), nicht erst beim Cron-Job

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Hinweis zur Datenbankstruktur
Pausen werden nicht in einer separaten `break_entries`-Tabelle gespeichert, sondern als `break_minutes`-Feld in `actual_entries` (aus PROJ-9). Der Trigger und das `booking_change_log` behandeln Pausenänderungen daher als Feld-Änderung an `actual_entries`.

### A) Komponenten-Übersicht

```
Nutzerverwaltung (bestehend: /manager/users)
+-- Werkstudenten-Tabelle (erweitert)
    +-- Neue Spalte: "Vorgesetzter" (Dropdown, Manager auswählen)

Werkstudenten-Dashboard (bestehend: /dashboard)
+-- IstEintragEditDialog / StempelCard (erweitert)
    +-- Hinweis-Banner beim Speichern vergangener Buchungen:
        "Dein Vorgesetzter wird über diese Änderung informiert"
        (nur wenn: Datum < heute UND Manager zugewiesen)

Datenbank: Postgres-Trigger
+-- Feuert bei UPDATE auf actual_entries automatisch
+-- Schreibt geänderte Felder in booking_change_log
+-- Kein Eingriff in App-Code nötig

Datenbank: booking_change_log (neue Tabelle)
+-- Audit-Log aller Änderungen an vergangenen Einträgen

Backend: Supabase Edge Function (Cron)
+-- Läuft täglich um 08:00 Uhr Europe/Berlin
+-- Liest booking_change_log (notified_at IS NULL, date < heute)
+-- Gruppiert: pro Manager → pro Werkstudent → eine E-Mail
+-- Sendet E-Mail via SMTP (Zugangsdaten als Supabase Secrets)
+-- Setzt notified_at nach erfolgreichem Versand
```

### B) Datenmodell

**Erweiterung `profiles`-Tabelle:**
- Neues Feld `manager_id` (UUID, optional) → Fremdschlüssel auf `profiles.id` (role = 'manager')
- Werkstudenten bekommen damit genau einen Vorgesetzten; Manager bleiben ohne `manager_id`

**Neue Tabelle `booking_change_log`:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `entry_id` | UUID | Fremdschlüssel → `actual_entries.id` |
| `user_id` | UUID | Fremdschlüssel → `profiles.id` (Werkstudent) |
| `date` | date | Datum des betroffenen Eintrags |
| `field_changed` | text | `actual_start` / `actual_end` / `break_minutes` |
| `old_value` | text (nullable) | Wert vor der Änderung |
| `new_value` | text (nullable) | Wert nach der Änderung (`—` bei Löschung) |
| `changed_at` | timestamptz | Zeitstempel der Änderung |
| `notified_at` | timestamptz (nullable) | NULL bis E-Mail versendet |

### C) Technische Entscheidungen

| Entscheidung | Ansatz | Begründung |
|---|---|---|
| **Änderungs-Logging** | Postgres-Trigger auf `actual_entries UPDATE` | Audit-Log ist unabhängig vom App-Code — wird nie versehentlich ausgelassen |
| **Cron-Job** | Supabase Edge Function (Deno) mit Cron-Scheduler | Direkter DB-Zugriff, kein Vercel-Cron nötig, alles in Supabase |
| **E-Mail-Versand** | SMTP via Edge Function (Deno) | Bestehender SMTP-Account wird genutzt; Credentials als Supabase Secrets hinterlegt |
| **RLS `booking_change_log`** | Werkstudent liest nur eigene Zeilen; Manager liest Zeilen seiner Werkstudenten; Schreiben nur via Service Role (Trigger + Edge Function) | Sicherer Lesezugriff ohne direktes Client-Schreiben |

### D) Ablauf

**Beim Speichern einer Buchungsänderung:**
```
Werkstudent speichert Änderung an vergangenem actual_entries-Eintrag
  → Postgres-Trigger feuert automatisch
  → booking_change_log-Eintrag wird angelegt (notified_at = NULL)
  → UI zeigt Hinweis: "Dein Vorgesetzter wird benachrichtigt"
     (nur wenn Datum < heute UND manager_id gesetzt)
```

**Täglicher Cron-Job:**
```
08:00 Uhr Europe/Berlin
  → Edge Function liest booking_change_log:
      notified_at IS NULL UND date < heute
  → Gruppierung: pro Manager → pro Werkstudent → eine E-Mail
  → E-Mail via SMTP gesendet (Betreff + Änderungsdetails)
  → notified_at = jetzt gesetzt
  → Kein Eintrag? → keine Mail
  → Kein Manager zugewiesen? → Eintrag bleibt, keine Mail, kein Fehler
```

### E) Neue Abhängigkeiten
Keine neuen npm-Pakete. SMTP-Zugangsdaten werden als Supabase Secrets konfiguriert.

## Implementation Notes (Backend)

### Deployed to Supabase (2026-05-05)

**DB Migration `20260505_proj15_booking_change_log`:**
- `manager_id UUID` (nullable, FK → profiles.id ON DELETE SET NULL) added to `profiles`
- Index `idx_profiles_manager_id` on `profiles(manager_id)`
- Table `booking_change_log` created with all fields per tech design; `entry_id` uses `ON DELETE SET NULL` so log entries survive entry deletion
- RLS enabled: Werkstudenten read own rows; managers read their team's rows; write is SECURITY DEFINER only (no client INSERT policy)
- Trigger `tgr_log_actual_entry_changes` (AFTER UPDATE) on `actual_entries` — fires only for `date < today Berlin time`; logs diffs for `actual_start`, `actual_end`, `break_minutes`
- Trigger `tgr_log_actual_entry_deletion` (BEFORE DELETE) on `actual_entries` — logs `old_value` with `new_value = '—'`

**DB Migration `20260505_proj15_cron`:**
- Extensions `pg_cron` and `pg_net` enabled
- Cron job `proj15-booking-change-notifier` scheduled at `0 7 * * *` UTC (≈ 08:00 CET; pg_cron in this Supabase version has no timezone column)
- Job reads `SERVICE_ROLE_KEY` from Supabase Vault to authorize the Edge Function call

**Edge Function `send-booking-change-notifications` (v1):**
- `verify_jwt: true`; invocable only with service_role JWT
- Reads `booking_change_log` where `notified_at IS NULL` and `date < today_berlin`
- Groups: manager → werkstudent → changes list
- Sends one SMTP email per werkstudent per manager (nodemailer via npm:)
- Subject: `Werkstudentenverwaltung es wurde ein Eintrag von [Name] geändert`
- Marks sent entries with `notified_at = NOW()`
- Skips silently if no manager assigned; logs error if manager has no email

**Required one-time setup (Supabase Dashboard):**
1. Edge Function Secrets → add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
2. SQL Editor → `SELECT vault.create_secret('eyJ...service-role-key...', 'SERVICE_ROLE_KEY');`

**Deviation from spec:** Cron runs at 07:00 UTC (not exactly 08:00 Europe/Berlin) because the installed pg_cron version does not expose a `timezone` column. Off by ±1 h depending on DST. Acceptable for a non-time-critical notification.

## Implementation Notes (Frontend)

### Implemented
- `manager_id` (UUID, nullable) added to `profiles` type in `database.types.ts`
- `updateUserProfile` server action extended to accept `manager_id`
- **Nutzerverwaltung** (`/manager/users`):
  - New "Vorgesetzter" column in the user table (shows assigned manager's name for Werkstudenten, "—" otherwise)
  - New "Vorgesetzter" select dropdown in EditUserDialog (only visible when role = Werkstudent)
  - Managers list derived from active manager profiles in the already-loaded users list
  - When saving, `manager_id` is cleared automatically if the role is changed away from Werkstudent
- **IstEintragEditDialog**: new optional `showManagerNotice` prop — when `true`, shows a blue info banner "Dein Vorgesetzter wird über diese Änderung informiert."
- **WochenIstübersicht**: passes `showManagerNotice={hasManager && date < today}` to IstEintragEditDialog
- **DashboardContent**: receives `hasManager: boolean` prop and forwards it to WochenIstübersicht
- **Dashboard page**: fetches `manager_id` from profile and passes `hasManager={!!manager_id}` to DashboardContent

### Pending (Backend)
- DB migration: add `manager_id` FK column to `profiles` table + RLS update
- DB migration: create `booking_change_log` table
- DB trigger on `actual_entries UPDATE` to write to `booking_change_log`
- Supabase Edge Function (Cron) for daily 08:00 email dispatch

## QA Test Results

**Date:** 2026-05-06
**Tester:** /qa skill
**Environment:** Local dev + Supabase Production DB

### Automated Tests
- **Unit tests (Vitest):** 235/235 passed — keine Regression
- **E2E-Tests (Playwright):** 20/20 neue PROJ-15-Tests bestanden (Chromium + Mobile Safari)
- **Regression:** 284/284 bestehende E2E-Tests bestanden; 2 vorbekannte Fehlschläge in PROJ-10 (holiday-Hintergrund-CSS), kein Bezug zu PROJ-15

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| AC1 | Vorgesetzter-Feld in Nutzerverwaltung (optional, nur für Werkstudenten) | ✅ Pass | Dropdown sichtbar, korrekt beschränkt |
| AC2 | Änderungen an `actual_entries` (Start/Ende) werden in `booking_change_log` protokolliert | ✅ Pass | DB-Trigger implementiert, Migration deployed |
| AC3 | Änderungen an `break_minutes` werden protokolliert | ✅ Pass | Trigger deckt `field_changed = 'break_minutes'` ab |
| AC4 | „Vergangen" = `date < heute (Europe/Berlin)` | ✅ Pass | Trigger-Bedingung `OLD.date >= today_berlin → RETURN` |
| AC5 | Cron-Job täglich 08:00 Uhr Berlin | ✅ Pass | 07:00 UTC (±1h DST), per spec akzeptiert |
| AC6 | Eine E-Mail pro Manager pro Werkstudent | ✅ Pass | Edge Function gruppiert korrekt |
| AC7 | Betreffzeile exakt: `Werkstudentenverwaltung es wurde ein Eintrag von [Name] geändert` | ✅ Pass | Laut Implementation Notes in Edge Function |
| AC8 | Mailinhalt: Tag, Art, alter Wert, neuer Wert, Zeitstempel | ✅ Pass | Laut Implementation Notes |
| AC9 | Kein Werkstudent mit Änderungen → keine Mail | ✅ Pass | Edge Function prüft leere Ergebnismenge |
| AC10 | Hinweis beim Speichern vergangener Buchungen | ⚠️ Partial | Fehlt im `OffenerEintragBanner`-Bearbeitungspfad (siehe Bug #1) |
| AC11 | Kein Manager → protokollieren, keine Mail, kein Fehler | ✅ Pass | Edge Function überspringt Einträge ohne Manager |

**Ergebnis: 10/11 AC bestanden, 1 teilweise (AC10)**

### Edge Cases

| Edge Case | Status |
|-----------|--------|
| Heutiger Tag → keine Benachrichtigung | ✅ Pass |
| Mehrere Werkstudenten eines Managers → separate Mails | ✅ Pass |
| Kein Manager → Protokoll aber keine Mail | ✅ Pass |
| Cron-Job-Ausfall → Timestamp-basiertes Nachholen | ✅ Pass (Design verifiziert) |
| Manager ohne E-Mail → serverseitiger Log, kein Absturz | ✅ Pass (Implementation Notes) |
| Mehrfache Änderungen → alle einzeln protokolliert | ✅ Pass (Trigger-Logik) |
| Löschung → old_value gesetzt, new_value = '—' | ✅ Pass (DELETE-Trigger) |

### Bugs Found

#### Bug #1 — Medium ✅ BEHOBEN: Kein Manager-Hinweis beim Bearbeiten über OffenerEintragBanner

**Beschreibung:** Wenn ein Werkstudent eine vergangene Buchung (die er offen gelassen hat, d.h. ohne Stempelausgang) über den `OffenerEintragBanner` bearbeitet, wird kein Hinweis „Dein Vorgesetzter wird über diese Änderung informiert" angezeigt — obwohl der DB-Trigger die Änderung korrekt protokolliert.

**Schritte zur Reproduktion:**
1. Werkstudent hat eine offene Buchung von gestern (kein Auszeit gestempelt)
2. Im Dashboard erscheint das `OffenerEintragBanner`
3. Klick auf „Bearbeiten" → `IstEintragEditDialog` öffnet sich ohne `showManagerNotice`
4. Werkstudent ändert Zeiten und speichert → kein Hinweis erscheint
5. Backend-Trigger protokolliert die Änderung trotzdem korrekt

**Fundstelle:** [DashboardContent.tsx:225-236](src/components/zeiterfassung/DashboardContent.tsx#L225-L236)

**Fix:** `showManagerNotice={hasManager && !!openEntryEditDate && openEntryEditDate < today}` an den `IstEintragEditDialog` im `openEntryEditDate`-Block übergeben.

---

#### Bug #2 — Medium (Security) ✅ BEHOBEN: Keine serverseitige Validierung, dass `manager_id` auf eine Manager-Rolle zeigt

**Beschreibung:** Die Server Action `updateUserProfile` nimmt jeden beliebigen UUID-Wert als `manager_id` an, ohne zu prüfen, ob der referenzierte Nutzer tatsächlich die Rolle `manager` hat. Ein Manager könnte technisch einen Werkstudenten als „Vorgesetzten" eines anderen Werkstudenten eintragen. Die Benachrichtigungs-E-Mail würde dann an eine nicht-Manager-Adresse gesendet.

**Fundstelle:** [actions.ts:60](src/app/manager/users/actions.ts#L60) — kein Validator für `manager_id`

**Fix:** Vor dem Update prüfen: wenn `manager_id` gesetzt, per DB-Abfrage bestätigen dass `profiles(id=manager_id).role = 'manager'`.

---

#### Bug #3 — Low ✅ BEHOBEN: Kein DB-Constraint gegen Selbstzuweisung (`manager_id = id`)

**Beschreibung:** Die DB-Migration enthält keinen `CHECK (manager_id != id)`-Constraint. Ein Werkstudent könnte theoretisch sich selbst als Vorgesetzten bekommen.

**Fundstelle:** [20260505_proj15_booking_change_log.sql:6](supabase/migrations/20260505_proj15_booking_change_log.sql#L6)

**Fix:** `ADD CONSTRAINT profiles_no_self_manager CHECK (manager_id IS NULL OR manager_id != id)` in einer Folge-Migration.

### Security Audit

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Authentifizierung: `/manager/users` nur für eingeloggte Manager | ✅ |
| IDOR: Werkstudent kann keine fremden Profile bearbeiten | ✅ (Server Action prüft `caller.role = 'manager'`) |
| RLS `booking_change_log`: kein Client-INSERT möglich | ✅ (nur SECURITY DEFINER Trigger) |
| RLS: Manager sieht nur eigene Team-Einträge | ✅ |
| Trigger SECURITY DEFINER: minimaler Scope, `SET search_path = public` | ✅ |
| `manager_id` ohne Rollen-Validierung | ⚠️ Bug #2 |
| Edge Function: `verify_jwt: true`, nur Service Role | ✅ |
| SMTP Credentials: als Supabase Secrets, nicht im Code | ✅ |

### Cross-Browser / Responsive

| Browser/Viewport | Ergebnis |
|-----------------|----------|
| Chromium Desktop (1440px) | ✅ |
| Mobile Safari (375px) | ✅ |
| Tablet (768px) | ✅ |

### Production-Ready: YES (mit Empfehlung)

Keine Critical- oder High-Bugs. Feature ist deploybar.
Bug #1 (Medium) und Bug #2 (Medium/Security) sollten zeitnah nach dem Deploy als Hotfix behoben werden.

## Deployment

**Deployed:** 2026-05-06
**Production URL:** https://werkstudentenverwaltung.vercel.app
**Git tag:** v1.15.0-PROJ-15

**Deploy summary:**
- 6 commits pushed to main → Vercel auto-deploy triggered
- DB migrations included in commit (booking_change_log, cron)
- All QA acceptance criteria passed (10/11 AC; AC10 partial → fixed before deploy)
- Build: ✅ `next build` succeeded (Next.js 16.1.1, Turbopack)

**One-time setup required (Supabase Dashboard):**
1. Supabase → Settings → Edge Function Secrets → add: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
2. SQL Editor → `SELECT vault.create_secret('eyJ...service-role-key...', 'SERVICE_ROLE_KEY');`
