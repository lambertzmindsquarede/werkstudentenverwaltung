# PROJ-19: Bereichs-Datenisolation für Manager

## Status: Architected
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
_To be added by /frontend_

## Implementation Notes (Backend)
_To be added by /backend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
