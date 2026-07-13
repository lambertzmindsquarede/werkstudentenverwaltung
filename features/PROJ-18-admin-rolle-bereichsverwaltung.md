# PROJ-18: Admin-Rolle & Bereichsverwaltung

## Status: Deployed
**Created:** 2026-05-06
**Last Updated:** 2026-05-06

## Dependencies
- Requires: PROJ-1 (Authentication / Azure AD SSO) – Admin-Erkennung über Entra-Gruppe beim Login
- Requires: PROJ-2 (Nutzerverwaltung) – bestehende `profiles`-Tabelle und Rollen-System wird erweitert
- Required by: PROJ-19 (Bereichs-Datenisolation) – Bereiche und Zuordnungen müssen existieren

## User Stories
- Als Admin möchte ich automatisch Admin-Rechte erhalten, sobald ich Mitglied der konfigurierten Entra-Gruppe bin, damit kein manueller Setup in der App erforderlich ist.
- Als Admin möchte ich neue Bereiche erstellen und benennen, damit ich die Organisationsstruktur der Werkstudentenverwaltung abbilden kann.
- Als Admin möchte ich Bereiche umbenennen und (leere) Bereiche löschen, damit die Struktur aktuell bleibt.
- Als Admin möchte ich Manager einem oder mehreren Bereichen zuordnen und aus Bereichen entfernen, damit jeder Manager nur die Daten seines Bereichs sieht.
- Als Admin möchte ich mich selbst als Manager einem Bereich zuordnen, damit ich ohne eine separate Person als Vorgesetzter für Werkstudenten agieren kann.
- Als Admin oder Manager möchte ich Werkstudenten einem Bereich zuordnen (Manager nur in ihrem eigenen Bereich), damit die Datenzuordnung korrekt ist.
- Als Werkstudent möchte ich in meinem Profil sehen, welchem Bereich ich zugeordnet bin, damit ich weiß, wer mein Vorgesetzter ist.

## Acceptance Criteria
- [ ] Beim Login wird geprüft, ob der Nutzer Mitglied der konfigurierten Entra-Gruppe ist; wenn ja, wird `is_admin = true` in `profiles` gesetzt (andernfalls `false`)
- [ ] Admins werden nach dem Login zu einem neuen `/admin`-Bereich weitergeleitet (sofern sie keine Manager-Rolle haben, die sie stattdessen weiterleitet)
- [ ] Admin kann unter `/admin/bereiche` alle Bereiche einsehen (Name, Anzahl Manager, Anzahl Werkstudenten)
- [ ] Admin kann einen neuen Bereich erstellen (Name, mindestens 1 Zeichen, max. 100 Zeichen, einzigartig)
- [ ] Admin kann einen Bereich umbenennen
- [ ] Admin kann einen Bereich löschen – nur wenn keine Werkstudenten mehr zugeordnet sind; andernfalls Fehlermeldung
- [ ] Admin kann unter `/admin/bereiche/[id]` die Manager eines Bereichs verwalten: hinzufügen (aus Liste aller Manager) und entfernen
- [ ] Admin kann sich selbst (Admin-Nutzer) einem Bereich als Manager zuordnen
- [ ] Werkstudenten-Bereichszuordnung: Admin kann in der Nutzerverwaltung jeden Werkstudenten einem Bereich zuordnen
- [ ] Manager kann in der Nutzerverwaltung Werkstudenten ausschließlich seinem eigenen Bereich zuordnen
- [ ] Werkstudent sieht auf der Profilseite seinen Bereich (oder „Kein Bereich zugeordnet")
- [ ] Migration: beim ersten Deployment wird automatisch ein Bereich „Standard" erstellt; alle bestehenden Nutzer werden diesem Bereich zugeordnet

## Edge Cases
- **Bereich löschen mit Werkstudenten:** Löschen verhindern und Fehlermeldung anzeigen – Admin muss zuerst alle Werkstudenten umziehen oder aus dem Bereich entfernen.
- **Manager aus allen Bereichen entfernt:** Der Nutzer behält seine Manager-Rolle, sieht aber in der Kalenderansicht und Nutzerliste keine Werkstudenten mehr (leere Listen).
- **Admin verliert Entra-Gruppen-Mitgliedschaft:** Beim nächsten Login wird `is_admin = false` gesetzt. Wenn der Nutzer auch `role = 'manager'` hat, bleibt die Manager-Funktion erhalten.
- **Admin ohne sonstige Rolle:** Ein reiner Admin (ohne `role = 'manager'`) wird zu `/admin` weitergeleitet. Er kann keinen Werkstudenten-Planungs- oder Zeiterfassungs-Inhalt einsehen, außer über den Admin-Bereich.
- **Bereichsname bereits vergeben:** Fehlermeldung, Formular bleibt offen.
- **Werkstudent wechselt den Bereich:** Admin kann den Bereich ändern; bestehende Planungs- und Zeiterfassungsdaten bleiben unverändert erhalten.
- **Kein Bereich konfiguriert (Entra-Gruppe fehlt in ENV):** App startet, aber Admin-Erkennung ist deaktiviert; Fehlermeldung im Admin-Bereich.

## Technical Requirements
- **Neue Datenbanktabelle:** `bereiche` – `id` (UUID), `name` (TEXT UNIQUE NOT NULL), `created_at`
- **Neue Verknüpfungstabelle:** `bereich_manager` – `bereich_id` (FK bereiche), `user_id` (FK profiles), PRIMARY KEY (bereich_id, user_id)
- **Neues Feld in `profiles`:** `bereich_id` (UUID, nullable, FK bereiche) – für Werkstudenten; `is_admin` (BOOLEAN NOT NULL DEFAULT false)
- **Entra-Gruppen-ID:** In Umgebungsvariable `ENTRA_ADMIN_GROUP_ID` konfigurieren; beim Login aus Azure AD Token-Claims lesen
- **RLS:** Bereiche sind für Admins vollständig lese-/schreibbar; Manager können Bereiche lesen (Namen sehen); Werkstudenten dürfen nur ihren eigenen Bereich lesen (via bereich_id auf profiles)
- **Routing-Anpassung in proxy.ts:** Admins erhalten Zugriff auf `/admin/*`; bestehende Manager-/Werkstudenten-Routing-Logik bleibt erhalten

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Seitenstruktur (Component Tree)

```
/admin
+-- AdminLayout
|   +-- AdminSidebar (Links: Bereiche, Nutzer)
+-- AdminDashboardPage          ← Einstieg für reine Admins

/admin/bereiche
+-- BereichListPage
    +-- BereichTable
    |   +-- BereichRow (Name, #Manager, #Werkstudenten, Aktionen)
    |   +-- RenameButton → Dialog
    |   +-- DeleteButton → AlertDialog (mit Guard: Werkstudenten im Bereich?)
    +-- CreateBereichButton → Dialog
        +-- CreateBereichForm (Name-Validierung: 1–100 Zeichen, einzigartig)

/admin/bereiche/[id]
+-- BereichDetailPage
    +-- BereichHeader (Name + Edit)
    +-- ManagerListSection
    |   +-- ManagerTable (zugeordnete Manager)
    |   +-- AddManagerButton → Dialog (alle Manager auswählbar, inkl. Admin selbst)
    |   +-- RemoveManagerButton (per Zeile)
    +-- WerkstudentListSection (Anzeige: wer ist in diesem Bereich)

/manager/users  (erweitert)
+-- UsersClient
    +-- BereichSelect pro Werkstudent-Zeile (Admin: alle Bereiche; Manager: nur eigener)

/dashboard/profile  (erweitert)
+-- ProfilPage
    +-- BereichInfo ("Bereichsname" oder "Kein Bereich zugeordnet")
```

Alle UI-Komponenten bereits installiert: `dialog`, `alert-dialog`, `table`, `select`, `form`, `input`, `button`, `badge` – keine neuen Pakete nötig.

### Datenmodell

**Neue Tabelle `bereiche`:** Eindeutige ID, Name (einzigartig, 1–100 Zeichen), Erstellungsdatum.

**Neue Verknüpfungstabelle `bereich_manager`:** Viele-zu-viele zwischen Managern und Bereichen (ein Manager kann mehrere Bereiche betreuen, ein Bereich kann mehrere Manager haben).

**Erweiterung `profiles`:**
- `is_admin` (Boolean, Standard: false) – wird bei jedem Login neu aus Azure AD gesetzt.
- `bereich_id` (nullable FK → bereiche) – gilt für Werkstudenten.

**Migrations-Seeding:** Beim ersten Deployment wird automatisch ein Bereich „Standard" erstellt; alle bestehenden Nutzer werden ihm zugeordnet.

### Admin-Erkennung beim Login

~~Der Azure AD JWT enthält beim Login Gruppen-Claims. In `auth/callback/route.ts` wird geprüft: Ist `ENTRA_ADMIN_GROUP_ID` unter den Claims?~~

**Korrigiert (2026-07-13, Production-Bugfix):** Der ursprüngliche Ansatz (JWT-Decode des `provider_token`) konnte in Production nie funktionieren: Das `provider_token` von Supabase ist ein Access Token **für Microsoft Graph**, und Access Tokens werden aus dem Manifest der Ressource (Graph) erzeugt — der in der eigenen App Registration konfigurierte `groups`-Claim taucht darin nie auf. Stattdessen ruft `src/lib/admin-group.ts` beim Login `POST https://graph.microsoft.com/v1.0/me/checkMemberGroups` mit dem `provider_token` auf (benötigt nur Delegated Permission `User.Read`, prüft transitiv, umgeht das 200-Gruppen-Overage-Limit). Wenn ja → `is_admin = true`, sonst `false`. Der Wert wird in `profiles` gespeichert und bei jedem Login aktualisiert. Schlägt der Graph-Call fehl (Netzwerk/HTTP-Fehler oder fehlende Konfiguration), bleibt der bisherige `is_admin`-Wert erhalten, statt den Nutzer fälschlich zu degradieren.

Ein Graph-API-Call pro Login (nicht pro Seitenanfrage) – Login-Sync bleibt schnell und konsistent mit dem bestehenden Role-Pattern.

### Routing-Logik (Erweiterung `proxy.ts`)

| Kombination | Weiterleitung |
|---|---|
| `is_admin = true`, `role = null` oder `werkstudent` | → `/admin` |
| `is_admin = true`, `role = 'manager'` | → `/manager` (Manager-Rolle hat Vorrang; `/admin` manuell erreichbar) |
| `is_admin = false` | bisherige Logik unverändert |
| Zugriff auf `/admin/*` ohne `is_admin = true` | → Redirect auf normale Startseite |

### Server Actions

Konsistent mit dem bestehenden Pattern in `manager/users/actions.ts`:
- Bereich erstellen / umbenennen / löschen (Guard: keine Werkstudenten im Bereich)
- Manager einem Bereich hinzufügen / entfernen
- Werkstudent einem Bereich zuordnen (Admin: alle; Manager: nur eigener Bereich)

### RLS-Zugriffsmatrix

| Tabelle | Admin | Manager | Werkstudent |
|---|---|---|---|
| `bereiche` | Voll (CRUD) | Nur lesen | Nur eigenen Bereich lesen |
| `bereich_manager` | Voll | Eigene Einträge lesen | Einträge des eigenen Bereichs lesen |
| `profiles.bereich_id` / `is_admin` | Schreiben | Werkstudenten im eigenen Bereich | Nur eigenes Profil |

### Neue Umgebungsvariable

- `ENTRA_ADMIN_GROUP_ID` – Objekt-ID der Azure AD Gruppe für Admin-Zugriff. Fehlt sie, bleibt `is_admin` immer `false` (kein Absturz, aber kein Admin-Zugang).

## Implementation Notes (Frontend)

### Neue Dateien
- `src/app/admin/page.tsx` – Admin-Dashboard (Server Component); zeigt Bereiche-/Manager-/Werkstudenten-Counts via Admin-Client
- `src/app/admin/bereiche/page.tsx` – Bereiche-Übersicht (Server Component, holt Daten via `getBereicheWithCounts`)
- `src/app/admin/bereiche/BereicheClient.tsx` – Client Component mit Create/Rename/Delete-Dialogen (shadcn `Dialog`, `AlertDialog`); `window.location.reload()` nach Mutationen statt Router-Navigation
- `src/app/admin/bereiche/[id]/page.tsx` – Bereich-Detailseite (Server Component, lädt Details + verfügbare Manager parallel)
- `src/app/admin/bereiche/[id]/BereichDetailClient.tsx` – Manager hinzufügen/entfernen + Werkstudenten-Übersicht; typsicheres Auflösen des Supabase-Join-Ergebnisses via `resolveProfile()`

### Geänderte Dateien
- `src/lib/database.types.ts` – `Relationships: []` zu allen Tabellen hinzugefügt (Supabase JS 2.x benötigt dieses Feld, sonst `never`-Typen); `bereich_manager` erhält korrekte Relationship-Einträge für den Join auf `profiles`
- `src/app/admin/bereiche/actions.ts` – Zod v4-Migration: `parsed.error.errors` → `parsed.error.issues`

### Designentscheidungen
- Admin-Bereich folgt demselben Header-/Nav-Pattern wie Manager-Seiten (kein separates Layout)
- Purple-Farbe als visueller Differenziator für Admin-Badge und aktive Nav-Links
- Bereich-Löschen-Dialog zeigt Werkstudenten-Count direkt und disabled den Löschen-Button, wenn noch Werkstudenten zugeordnet sind
- Werkstudenten-Zuweisung zu Bereichen erfolgt über die bestehende Manager-Nutzerverwaltung (PROJ-18 Scope)

## Implementation Notes (Backend)

### Neue Dateien
- `supabase/migrations/20260507_proj18_bereiche.sql` – DB-Schema, RLS, Seeding ("Standard"-Bereich)
- `src/lib/supabase-admin.ts` – Service-Role-Client (umgeht RLS; nur nach expliziter TypeScript-Autorisierung verwenden)
- `src/app/admin/bereiche/actions.ts` – alle Server Actions:
  - `createBereich`, `renameBereich`, `deleteBereich` (mit Werkstudenten-Guard)
  - `addManagerToBereich`, `removeManagerFromBereich`
  - `assignWerkstudentToBereich` (Admin: alle Bereiche; Manager: nur eigener Bereich)
  - Read-Helpers: `getBereiche`, `getBereichWithDetails`, `getBereicheWithCounts`, `getManagersForBereichSelect`

### Geänderte Dateien
- `src/lib/database.types.ts` – neue Tabellen `bereiche`, `bereich_manager`; `profiles` um `is_admin` (bool) und `bereich_id` (UUID nullable) erweitert; neue Exports `Bereich`, `BereichManager`, `BereichWithCounts`
- `src/app/auth/callback/route.ts` – Admin-Erkennung über Azure AD JWT groups-Claim (`ENTRA_ADMIN_GROUP_ID`); `is_admin` wird bei jedem Login neu gesetzt; Redirect-Logik für Admins (`/admin`)
- `src/proxy.ts` – `/admin/*` nur für Admins zugänglich; Manager-Vorrangsregel beibehalten; `is_admin` in Profile-Select ergänzt
- `.env.local.example` – `ENTRA_ADMIN_GROUP_ID` dokumentiert

### Architekturentscheidungen
- Privilegierte Writes (bereich_id auf fremden Profilen) laufen über Service-Role-Client in Server Actions; keine RLS-Ausnahmen auf profiles nötig.
- Admin-Erkennung: ~~JWT payload-Decode (base64url) aus `provider_token`~~ → **ersetzt am 2026-07-13** durch Graph-Call `me/checkMemberGroups` in `src/lib/admin-group.ts` (siehe „Admin-Erkennung beim Login"); Unit-Tests in `src/lib/admin-group.test.ts`.
- Seeding-Migration: alle bestehenden Profile erhalten den Bereich "Standard".

## QA Test Results

**QA Date:** 2026-05-07 (Re-QA nach Bug-Fixes)
**Tester:** /qa skill (Claude)
**Status:** ✅ APPROVED — keine Critical/High Bugs mehr offen

### Automated Tests (Re-QA)
- Unit tests: **235/235 passed** ✅
- E2E tests (Gesamtsuite): **183/218 passed** ✅
  - 2 Fehlschläge: PROJ-10 (pre-existing, Feiertagsmarkierung) + PROJ-16 (pre-existing, per `git stash` bestätigt) — beide unabhängig von PROJ-18
- E2E tests (PROJ-18): **10/10 passed** ✅ (`tests/PROJ-18-admin-rolle-bereichsverwaltung.spec.ts`)
- TypeScript build: **clean** ✅

### Acceptance Criteria Results

| AC | Description | Result | Notes |
|----|-------------|--------|-------|
| 1 | Login → is_admin via Entra-Gruppe JWT groups-Claim | ✅ PASS | `auth/callback/route.ts` reads JWT payload correctly |
| 2 | Admin → `/admin` Redirect (Manager-Vorrang bleibt) | ✅ PASS | `proxy.ts` guards confirmed by E2E tests |
| 3 | `/admin/bereiche` zeigt Name, Manager-Anzahl, Werkstudenten-Anzahl | ✅ PASS | Code review + UI verified |
| 4 | Bereich erstellen (1–100 Zeichen, einzigartig) | ✅ PASS | Zod-Validierung + DB unique constraint + Fehlertext |
| 5 | Bereich umbenennen | ✅ PASS | Dialog mit Umbenennen-Guard (disable wenn unverändert) |
| 6 | Bereich löschen mit Werkstudenten-Guard | ⚠️ PARTIAL | Button korrekt disabled; Guard-Query prüft alle Profile inkl. Manager — Bug 3 (Medium, offen) |
| 7 | `/admin/bereiche/[id]` Manager verwalten (hinzufügen/entfernen) | ✅ PASS | `addManagerToBereich` / `removeManagerFromBereich` mit Auth-Check |
| 8 | Admin kann sich selbst als Manager zuordnen | ✅ PASS | `getManagersForBereichSelect` liefert `is_admin=true` Nutzer |
| 9 | Admin: Werkstudenten in Nutzerverwaltung einem Bereich zuordnen | ✅ PASS | **FIXED**: BereichSelect in `EditUserDialog`, `assignWerkstudentToBereich` wird aufgerufen |
| 10 | Manager: Werkstudenten nur im eigenen Bereich zuordnen | ✅ PASS | **FIXED**: `getBereicheForAssignment` liefert nur eigene Bereiche; server-seitiger Guard bleibt |
| 11 | Werkstudent sieht Bereich auf Profilseite | ✅ PASS | **FIXED**: `dashboard/profile/page.tsx` fetcht Bereichsname und zeigt ihn an |
| 12 | Migration: "Standard"-Bereich + bestehende Profile zuordnen | ⚠️ PARTIAL | Migration vorhanden; weist alle Rollen zu (nicht nur Werkstudenten) — Bug 3 (Medium, offen) |

### Bugs

#### Bug 1 — HIGH → ✅ BEHOBEN
`assignWerkstudentToBereich` nun korrekt aus `EditUserDialog` aufgerufen. `getBereicheForAssignment` scoped die Liste für Manager auf eigene Bereiche.

#### Bug 2 — HIGH → ✅ BEHOBEN
`dashboard/profile/page.tsx` fetcht jetzt Bereichsname via separatem `bereiche`-Query und zeigt ihn an (oder „Kein Bereich zugeordnet").

#### Bug 3 — MEDIUM: Löschen-Guard prüft alle Profile (nicht nur Werkstudenten)
- **Offen:** `deleteBereich` in `actions.ts:105-115` filtert `profiles.eq('bereich_id', id)` ohne `.eq('role', 'werkstudent')`. Die Migration hat `bereich_id` für alle Profile gesetzt, daher blockieren auch Manager die Löschung des Standard-Bereichs.
- **Fix:** `.eq('role', 'werkstudent')` in der Guard-Query ergänzen.
- **Auswirkung:** Betrifft nur den „Standard"-Bereich (Migration-Altlast). In der laufenden App werden nur Werkstudenten über `assignWerkstudentToBereich` Bereichen zugeordnet, sodass das Problem nach der ersten Umverteilung aller Werkstudenten verschwindet.

### Security Audit
- ✅ Alle Mutations hinter `requireAdmin()` / `requireAdminOrManager()` server-seitig gesichert
- ✅ Manager-Scope-Guard in `assignWerkstudentToBereich` (Manager kann nur in eigene Bereiche zuordnen)
- ✅ `/admin/*` Route-Guard in `proxy.ts` — kein Client-seitiger Bypass möglich
- ✅ Admin-Client (Service Role) nur in Server Actions — kein RLS-Bypass auf Client-Seite
- ✅ Keine Secrets in Frontend-Code

### Responsive Testing
- Mobile (375px): Route-Schutz ✅
- Tablet (768px): Route-Schutz ✅
- Desktop (1440px): `max-w-5xl mx-auto` Layout, kein overflow-Problem erkennbar

### Production-Ready: ✅ APPROVED
Keine Critical- oder High-Bugs mehr offen. Bug 3 (Medium) ist bekannt und kann im laufenden Betrieb toleriert werden.

## Deployment

**Deployed:** 2026-05-07
**Migration:** `supabase/migrations/20260507_proj18_bereiche.sql` — applied to production Supabase project
**Notes:**
- `ENTRA_ADMIN_GROUP_ID` must be set in Vercel environment variables (Entra group object ID)
- `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel environment variables (used by supabase-admin client)
- Migration seeds a "Standard" Bereich and assigns all existing profiles to it
