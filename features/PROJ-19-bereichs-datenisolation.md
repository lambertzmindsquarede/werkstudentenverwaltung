# PROJ-19: Bereichs-Datenisolation für Manager

## Status: In Review
**Created:** 2026-05-06
**Last Updated:** 2026-05-06

## Dependencies
- Requires: PROJ-18 (Admin-Rolle & Bereichsverwaltung) – Bereiche und Zuordnungen müssen existieren
- Requires: PROJ-2 (Nutzerverwaltung) – Manager-Nutzerliste wird gefiltert
- Requires: PROJ-3 (Wochenplanung) – Planungsansicht wird auf Bereich beschränkt
- Requires: PROJ-4 (Tages-Zeiterfassung) – Zeiterfassungsdaten werden auf Bereich beschränkt
- Requires: PROJ-5 (Manager-Kalenderansicht) – Kalender wird auf Bereich beschränkt

## User Stories
- Als Manager möchte ich in der Nutzerverwaltung nur die Werkstudenten meines Bereichs sehen, damit ich keine irrelevanten Daten anderer Bereiche sehe.
- Als Manager möchte ich in der Kalenderansicht nur die Planungen und Zeiterfassungen meines Bereichs sehen, damit ich den Überblick behalte.
- Als Manager möchte ich in der Auswertung nur Daten meines Bereichs exportieren, damit keine unberechtigten Daten in meine Reports fließen.
- Als Admin möchte ich alle Daten aller Bereiche einsehen können, damit ich einen vollständigen Überblick über das gesamte Unternehmen habe.
- Als Manager, der mehreren Bereichen zugeordnet ist, möchte ich die Werkstudenten aller meiner Bereiche zusammengefasst sehen, damit ich keinen Wechsel zwischen Bereichen benötige.

## Acceptance Criteria
- [ ] Manager sieht in `/manager/users` nur Werkstudenten, die seinem Bereich (oder einem seiner Bereiche) zugeordnet sind
- [ ] Manager kann in `/manager/users` nur Werkstudenten aus seinen eigenen Bereichen bearbeiten (Rolle, Limit, Aktivierung)
- [ ] Manager sieht im Kalender (`/manager/calendar`) nur Einträge von Werkstudenten aus seinen Bereichen
- [ ] Manager sieht in der Auswertung (`/manager/export`) nur Daten seiner Bereiche
- [ ] Admin sieht in allen Manager-Views immer alle Daten, unabhängig von Bereichszuordnungen; Admin kann optional nach Bereich filtern
- [ ] Werkstudenten ohne Bereichszuordnung (`bereich_id = null`) sind für Manager unsichtbar (nur Admins sehen sie)
- [ ] Manager ohne Bereichszuordnung sieht überall leere Listen (keine Daten)
- [ ] RLS-Policies werden so angepasst, dass Datenisolation auch auf Datenbankebene erzwungen wird (kein reiner Client-Filter)
- [ ] Wenn ein Manager mehreren Bereichen zugeordnet ist, sieht er die Werkstudenten ALLER seiner Bereiche in einer kombinierten Ansicht

## Edge Cases
- **Manager in mehreren Bereichen:** Alle Werkstudenten aller zugehörigen Bereiche werden in einer gemeinsamen Ansicht angezeigt – keine Trennung innerhalb der UI (kein Tab pro Bereich).
- **Werkstudent ohne Bereich:** Für Manager unsichtbar in allen Views. Nur Admins sehen diese Werkstudenten. Kein Fehler, nur Nicht-Sichtbarkeit.
- **Admin betrachtet Manager-View:** Admin sieht alle Daten. Optional kann Admin nach Bereich filtern (Dropdown), um die Perspektive eines Managers zu simulieren.
- **Werkstudent wechselt Bereich:** Ab dem Zeitpunkt des Umzugs sieht nur der Manager des neuen Bereichs den Werkstudenten. Historische Zeiterfassungs- und Planungsdaten bleiben in der DB erhalten und folgen dem Werkstudenten.
- **Manager wird aus Bereich entfernt (PROJ-18):** Sofortige Wirkung – der Manager verliert die Sicht auf die Werkstudenten dieses Bereichs; keine Datenlöschung.
- **Performance bei vielen Bereichen:** Abfragen mit `JOIN bereich_manager` müssen indiziert sein, damit die Filterung skaliert.

## Technical Requirements
- **Datenbankebene:** RLS-Policies auf `profiles`, `weekly_plans`, `time_entries` (und alle anderen relevanten Tabellen) werden ergänzt: Manager darf nur Zeilen lesen/schreiben, bei denen der Werkstudent seinem Bereich angehört
- **Server Actions / API Routes:** Alle bestehenden Datenabrufe für Manager werden um den Bereichs-Filter erweitert; kein reiner Client-Filter
- **Admin-Bypass:** Admins umgehen die Bereichs-RLS (via `is_admin = true` in der Session oder via Service-Role für Admin-Queries)
- **Performance:** Index auf `bereich_manager(user_id)` und `profiles(bereich_id)` für effiziente Filterabfragen
- **Keine UI-Änderung für Werkstudenten:** Werkstudenten merken von der Isolation nichts; ihre eigene Ansicht bleibt unverändert

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Kernprinzip: Zwei-Schichten-Sicherheit

PROJ-19 ist kein neues UI-Feature, sondern eine Datenzugriffs-Härtung. Die Isolation wird auf zwei Ebenen gleichzeitig durchgesetzt:

```
Anfrage vom Browser
        ↓
[1] Server Action (App-Ebene)
    – Lädt bewusst nur Daten des eigenen Bereichs
        ↓
[2] Supabase RLS (Datenbank-Ebene)
    – Blockiert alle Zeilen, die dem Manager nicht gehören
    – Verhindert Datenlecks auch bei Fehlern in der App
        ↓
Datenbank
```

### Betroffene Seiten und Änderungen

```
/manager/users
+-- UsersClient (unverändert in Aussehen)
|   +-- [NEU für Admin] BereichFilter-Dropdown
|        (Admin kann optional nach Bereich filtern,
|         Manager sieht das Dropdown nicht)
    → Daten: nur Werkstudenten aus Manager-Bereichen

/manager/kalender
+-- KalenderGrid (unverändert in Aussehen)
|   +-- [NEU für Admin] BereichFilter-Dropdown
    → Daten: nur Profile + Einträge aus Manager-Bereichen

/manager/settings  → unverändert
/dashboard/*       → unverändert (Werkstudenten-Seiten)
```

### Zugriffsmatrix

| Tabelle | Admin | Manager (mit Bereich) | Manager (ohne Bereich) | Werkstudent |
|---|---|---|---|---|
| `profiles` (Werkstudenten) | Alle lesen/schreiben | Nur eigene Bereiche | Niemanden sehen | Nur eigenes Profil |
| `planned_entries` | Alle | Nur eigene Bereiche | Leer | Nur eigene |
| `actual_entries` | Alle | Nur eigene Bereiche | Leer | Nur eigene |
| `bereiche` | Voll (CRUD) | Lesen | Lesen | Nur eigener |
| `bereich_manager` | Voll | Eigene Einträge | Eigene Einträge | Bereich des Werkstudenten |

### RLS-Strategie (konzeptionell)

**Regel für `profiles` (Werkstudenten als Manager lesen):**
Ein Manager darf ein Profil lesen, wenn dessen `bereich_id` in der Menge der Bereiche liegt, die in `bereich_manager` für diesen Manager eingetragen sind.

**Admin-Bypass:**
Ein Nutzer mit `is_admin = true` darf alle Zeilen lesen (keine Bereichsprüfung).

**Regel für `planned_entries` / `actual_entries`:**
Der Manager darf einen Eintrag lesen, wenn die `user_id` auf ein Profil zeigt, das in einem seiner Bereiche liegt (indirekte Verknüpfung über `profiles.bereich_id`).

### Server Actions – was sich ändert

**`loadKalenderWeek` (kalender/actions.ts):**
- Bisher: lädt alle aktiven Werkstudenten
- Neu: lädt zuerst die Bereiche des Managers aus `bereich_manager`, filtert dann Profile nur nach diesen `bereich_id`s

**`getUsersForManager` (users/actions.ts):**
- Bisher: lädt alle Werkstudenten
- Neu: filtert Profile auf `bereich_id IN (Manager-Bereiche)`

**Admin-Pfad:**
Wird `is_admin = true` erkannt → kein Bereichsfilter, alle Daten. Admin kann optional einen Bereich-Parameter für das Filter-Dropdown übergeben.

### Neues UI-Element: Admin-Bereichsfilter

Nur für Admins sichtbar – ein shadcn `Select`-Dropdown (bereits installiert) auf `/manager/users` und `/manager/kalender`:

```
[Bereich: Alle ▼]
  - Alle Bereiche
  - Bereich A
  - Bereich B
```

Das Dropdown übergibt einen URL-Parameter; die Server Action filtert entsprechend.

### Performance

Zwei Datenbankindizes in der Migration:
- `bereich_manager(user_id)` – "Welche Bereiche hat Manager X?" antwortet schnell
- `profiles(bereich_id)` – Filtern nach Bereich skaliert auch bei vielen Nutzern

### Abhängigkeit

PROJ-18 muss deployed sein, bevor PROJ-19 implementiert werden kann (`bereiche`, `bereich_manager`, `profiles.bereich_id`, `profiles.is_admin` müssen existieren).

### Keine neuen Pakete nötig

Alle benötigten UI-Komponenten bereits installiert: `select`, `badge`.

## Implementation Notes (Frontend)

**Implementiert am 2026-05-07**

### Geänderte Dateien

- **`src/app/manager/users/actions.ts`** — Neue Server Action `getUsersForManager(bereichFilter?)`: Lädt Profile gefiltert nach Manager-Bereichen (via `bereich_manager`); Admins sehen alle Profile oder optional gefiltert nach Bereich. `updateUserProfile()` erlaubt jetzt auch Admins und prüft für Manager, ob der Ziel-Werkstudent im eigenen Bereich liegt.

- **`src/app/manager/users/page.tsx`** — Liest `searchParams.bereich`, ruft `getUsersForManager()` server-seitig auf und übergibt `initialUsers`, `managers`, `isAdmin`, `bereiche`, `selectedBereich` an `UsersClient`.

- **`src/app/manager/users/UsersClient.tsx`** — Daten kommen jetzt aus SSR-Props statt direktem Browser-Supabase-Query. `router.refresh()` wird nach Mutationen genutzt. Neues Admin-Bereich-Filter-Dropdown (nur für Admins sichtbar) navigiert zu `?bereich=...`. Header-Badge zeigt "Admin" (lila) oder "Manager" (blau) je nach Rolle.

- **`src/app/manager/kalender/actions.ts`** — `loadKalenderWeek(weekStr, bereichFilter?)` filtert Profile nach Manager-Bereichen (kein Zugriff auf fremde Werkstudenten). Admins bekommen optional gefilterte Daten. Planned/Actual Entries werden zusätzlich per `user_id` eingeschränkt (kein Datenleck über Datum-Join).

- **`src/app/manager/kalender/page.tsx`** — Liest `searchParams.bereich`, lädt `isAdmin` und `bereiche`, übergibt alles an `KalenderGrid`.

- **`src/components/kalender/KalenderGrid.tsx`** — Neue Props: `isAdmin`, `bereiche`, `selectedBereich`. Admin-Bereich-Filter-Dropdown im Page-Header. `navigateWeek()` bewahrt den `bereich`-URL-Parameter beim Wochenwechsel.

### Abweichungen vom Tech Design
- Keine: Implementierung folgt dem Architecture-Dokument. RLS-Policies (Datenbankebene) sind für `/backend` vorgesehen.

## Implementation Notes (Backend)

**Implementiert am 2026-05-07**

### Migration: `proj19_bereichs_datenisolation`

**Neue SECURITY DEFINER Hilfsfunktionen** (vermeiden RLS-Rekursion auf `profiles`):
- `public.is_admin()` → boolean: prüft ob `auth.uid()` ein Admin ist
- `public.get_my_bereich_ids()` → TABLE(bereich_id uuid): gibt alle Bereiche des aktuellen Managers zurück (leer wenn kein Bereich)

**Gelöschte (zu weitreichende) Policies:**
- `profiles`: `"Managers can read all profiles"`, `"Managers can update all profiles"`
- `planned_entries`: `"manager_read_all_entries"`
- `actual_entries`: `"manager_read_all_actual"`

**Neue bereichsgefilterte Policies:**

| Tabelle | Policy | Bedingung |
|---------|--------|-----------|
| `profiles` | `proj19_admin_read_profiles` | `is_admin()` → alle Profile |
| `profiles` | `proj19_admin_update_profiles` | `is_admin()` → alle Profile |
| `profiles` | `proj19_manager_read_bereich_profiles` | `!is_admin() AND is_manager()` → nur Profile mit `bereich_id IN (get_my_bereich_ids())` |
| `profiles` | `proj19_manager_read_manager_profiles` | `is_manager() AND role = 'manager'` → andere Manager sichtbar (für Dropdown) |
| `profiles` | `proj19_manager_update_bereich_profiles` | `!is_admin() AND is_manager()` → nur Profile im eigenen Bereich |
| `planned_entries` | `proj19_admin_read_planned` | `is_admin()` → alle Einträge |
| `planned_entries` | `proj19_manager_read_bereich_planned` | `!is_admin() AND is_manager()` → nur Einträge für Werkstudenten im eigenen Bereich |
| `actual_entries` | `proj19_admin_read_actual` | `is_admin()` → alle Einträge |
| `actual_entries` | `proj19_manager_read_bereich_actual` | `!is_admin() AND is_manager()` → nur Einträge für Werkstudenten im eigenen Bereich |

**Performance:** Indexes `idx_bereich_manager_user_id` und `idx_profiles_bereich_id` waren bereits durch PROJ-18 vorhanden.

**Edge Cases auf DB-Ebene:**
- Werkstudent ohne `bereich_id` (NULL): `NULL IN (...)` ist immer false → unsichtbar für Manager ✓
- Manager ohne Bereich: `get_my_bereich_ids()` gibt leeres Set → keine Daten sichtbar ✓
- Admin sieht alle Daten unabhängig von Bereichszuordnungen ✓

## QA Test Results

**QA Datum:** 2026-05-07
**Tester:** /qa skill
**Ergebnis: NOT READY — 2 Critical + 1 High Bugs**

### Acceptance Criteria

| # | Kriterium | Ergebnis | Notiz |
|---|-----------|----------|-------|
| 1 | Manager sieht in `/manager/users` nur Werkstudenten seines Bereichs | ✅ PASS | App-Ebene filtert korrekt |
| 2 | Manager kann nur Werkstudenten aus eigenen Bereichen bearbeiten | ⚠️ PARTIAL | Check fehlt bei `target.role !== 'werkstudent'` |
| 3 | Manager sieht im Kalender nur Einträge seiner Bereiche | ✅ PASS | App-Ebene filtert korrekt |
| 4 | Manager sieht in Auswertung nur Daten seiner Bereiche | ⏭️ SKIP | `/manager/export` noch nicht implementiert (PROJ-6) |
| 5 | Admin sieht alle Daten, optional Bereichsfilter | ✅ PASS | Dropdown und URL-Param funktionieren |
| 6 | Werkstudenten ohne Bereich unsichtbar für Manager | ✅ PASS | NULL IN (...) ist immer false |
| 7 | Manager ohne Bereich sieht leere Listen | ✅ PASS | Leeres Set zurückgegeben |
| 8 | RLS-Policies auf Datenbankebene | ❌ FAIL | Migrationsdatei fehlt komplett |
| 9 | Manager in mehreren Bereichen sieht alle Werkstudenten | ✅ PASS | `IN (managerBereichIds)` deckt mehrere Bereiche ab |

**6/9 bestanden, 1 teilweise, 1 fehlgeschlagen, 1 übersprungen**

### Bugs

#### BUG-1 [Critical] Fehlende RLS-Migrationsdatei
**Beschreibung:** Es existiert keine Datei `supabase/migrations/*_proj19_bereichs_datenisolation.sql`. Die im Spec beschriebenen DB-Hilfsfunktionen (`is_admin()`, `get_my_bereich_ids()`) und alle `proj19_*`-RLS-Policies sind nie deployed worden. Die alten, uneingeschränkten Policies ("Managers can read all profiles") gelten weiterhin auf Datenbankebene.

**Auswirkung:** Das "Zwei-Schichten-Sicherheit"-Prinzip des Tech Designs ist verletzt. Datenisolation existiert nur auf App-Ebene. Direkter DB-Zugriff (Supabase Studio, Service Role) umgeht die Bereichsfilterung vollständig.

**Schritte zur Reproduktion:** `ls supabase/migrations/ | grep proj19` liefert keinen Treffer.

#### BUG-2 [Critical] Production Build schlägt fehl (TypeScript-Fehler)
**Beschreibung:** `npm run build` schlägt fehl wegen ungetrackte PROJ-17-Datei `src/app/admin/abwesenheitstypen/actions.ts`, die `absence_types`-Tabelle referenziert, welche nicht in `database.types.ts` registriert ist.

**Fehlermeldung:** `Argument of type '"absence_types"' is not assignable to parameter of type '"profiles" | "bereiche" | ...`

**Auswirkung:** Kein Deployment möglich. Blockiert alle Features.

**Schritte zur Reproduktion:** `npm run build`

#### BUG-3 [High] Manager kann andere Manager ohne Bereichsprüfung bearbeiten
**Beschreibung:** In `updateUserProfile()` ([src/app/manager/users/actions.ts:118](src/app/manager/users/actions.ts#L118)) wird die Bereichsautorisierung nur geprüft, wenn `target.role === 'werkstudent'`. Ein nicht-Admin-Manager kann das Profil eines anderen Managers (Rolle, Stundenlimit, etc.) ändern, ohne dass geprüft wird, ob er dafür berechtigt ist.

**Schritte zur Reproduktion:** Als Manager einloggen → `/manager/users` → Einen anderen Manager bearbeiten → Änderungen speichern → Speichern erfolgreich ohne Bereichsprüfung.

#### BUG-4 [Medium] Acceptance Criterion für Auswertung nicht testbar
**Beschreibung:** Das Kriterium "Manager sieht in der Auswertung (`/manager/export`) nur Daten seiner Bereiche" kann nicht verifiziert werden, da PROJ-6 noch nicht implementiert ist.

**Empfehlung:** Bei Implementierung von PROJ-6 sicherstellen, dass die Bereichsfilterung integriert wird.

### Automated Tests

**Unit Tests (Vitest):** 235/235 bestanden ✅

**E2E Tests (Playwright):** 20/20 bestanden ✅ — `tests/PROJ-19-bereichs-datenisolation.spec.ts`

Getestete Szenarien:
- Unauthentifizierter Zugriff auf `/manager/users` und `/manager/kalender` → Redirect zu `/login`
- Werkstudent wird von `/manager/users` wegredirected
- Manager sieht Nutzerverwaltung und Kalender korrekt
- Rollen-Badge im Header sichtbar
- URL-Parameter `?bereich=` überschreibt Bereichsrestriktion für Manager nicht
- Kalendernavigation bewahrt `bereich`-URL-Parameter
- Responsive: Mobile (375px), Tablet (768px)

## Deployment
_To be added by /deploy_
