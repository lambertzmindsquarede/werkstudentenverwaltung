# PROJ-7: Lokaler Dev-Login

## Status: In Progress
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Implementation Notes
- `src/components/DevLoginButton.tsx` – Client Component; gibt `null` zurück wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED !== 'true'`
- `src/app/api/auth/dev-login/route.ts` – POST-Route mit doppeltem Guard (`NODE_ENV=development` + `DEV_LOGIN_ENABLED=true`); nutzt Supabase Admin `generateLink` + SSR-Client `verifyOtp` um Session-Cookies identisch zum Azure-AD-Flow zu setzen
- `src/app/login/page.tsx` – `<DevLoginButton />` nach `<MicrosoftSignInButton />` eingefügt
- `docs/dev-seed.sql` – Legt Dev-Admin in `auth.users` und `public.profiles` an (mit `ON CONFLICT DO NOTHING/UPDATE`)
- `.env.local` enthält `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` und `DEV_LOGIN_ENABLED=true`
- **Offenes Handlungsitem:** `SUPABASE_SERVICE_ROLE_KEY` muss in `.env.local` eingetragen werden (Supabase Dashboard → Project Settings → API → service_role key); ohne diesen Key schlägt der API-Endpunkt mit 500 fehl
- `.env.local.example` um alle drei Dev-Login-Variablen erweitert

## Dependencies
- Requires: PROJ-1 (Authentication / Azure AD SSO) – der Dev-Login ist ein Bypass der bestehenden Auth-Schicht und muss in dasselbe Session-/Cookie-System integriert sein.
- Requires: PROJ-2 (Nutzerverwaltung) – der Dev-Admin-User muss in der `users`-Tabelle als Manager-Rolle existieren.

## Context / Motivation
Während der lokalen Entwicklung ist ein Azure-AD-Tenant und eine laufende SSO-Konfiguration erforderlich. Das verlangsamt das Onboarding neuer Entwickler und erschwert das Testen von Manager-Funktionalitäten. PROJ-7 fügt einen rein entwicklungsinternen Bypass hinzu: Auf der Login-Seite erscheint ein Button „Als Admin einloggen", der ohne Passwort sofort eine authentifizierte Session als seeded Admin-User öffnet. Der Button ist in Production-Deployments vollständig unsichtbar und der zugehörige API-Endpunkt liefert in Production immer HTTP 403.

## Scope
- **In Scope:** Dev-Login-Button auf der Login-Seite, ein `/api/auth/dev-login`-Endpunkt, Seed-SQL für den Admin-User
- **Out of Scope:** Produktiv-Login ohne Azure AD, Passwortbasiertes Login für reguläre Nutzer, Admin-UI zur Nutzerverwaltung lokaler Accounts

## User Stories
- Als Entwickler möchte ich mich lokal mit einem Klick als Admin einloggen, damit ich ohne Azure-AD-Konfiguration alle Manager-Funktionen testen kann.
- Als Entwickler möchte ich, dass der Dev-Login-Button nur in lokalen Umgebungen sichtbar ist, damit ich sicher sein kann, dass kein Bypass in Production existiert.
- Als Datenbankadmin möchte ich ein fertiges SQL-Snippet haben, mit dem ich den Dev-Admin-User in Supabase anlegen kann, ohne alles manuell konfigurieren zu müssen.
- Als Entwickler möchte ich nach dem Dev-Login exakt dieselbe Session-Erfahrung haben wie nach einem echten Azure-AD-Login, damit ich keine sonderfallbedingte Testverzerrung habe.

## Acceptance Criteria
- [ ] Auf der Login-Seite (`/login`) ist der Button „Als Admin einloggen" sichtbar, wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` (und ausschließlich dann).
- [ ] Der Button ist klar von der regulären Azure-AD-Schaltfläche unterscheidbar (z.B. andersfarbig, gelbes Warning-Badge oder Label „Dev only").
- [ ] Ein Klick auf den Button löst einen POST-Request an `/api/auth/dev-login` aus.
- [ ] `/api/auth/dev-login` ist nur aktiv, wenn `NODE_ENV=development` **und** `DEV_LOGIN_ENABLED=true` (server-seitige Doppelabsicherung). Andernfalls antwortet der Endpunkt mit HTTP 403.
- [ ] Der Endpunkt schreibt dieselbe Session / dasselbe Cookie wie der normale Azure-AD-Flow (gleicher Cookie-Name, gleiche Felder).
- [ ] Nach dem Dev-Login wird der Nutzer auf `/dashboard` (Werkstudent) oder `/manager` (Manager) weitergeleitet – abhängig von der Rolle des seeded Users.
- [ ] Der seeded Dev-Admin-User hat die Rolle `manager`, damit alle Manager-Ansichten getestet werden können.
- [ ] Ein SQL-Seed-Snippet (in `docs/dev-seed.sql` oder als Kommentar in der Spec) legt den Dev-Admin-User in der Supabase-Datenbank an.
- [ ] Ohne seeded User in der DB zeigt der Dev-Login einen verständlichen Fehler (z.B. Toast: „Dev-Admin-User nicht gefunden – bitte Seed-Script ausführen").
- [ ] Im Production-Build (`NODE_ENV=production`) ist der Button im DOM nicht vorhanden (kein reines CSS-Hide, sondern kein Rendering).

## Edge Cases
- **Seeded User fehlt in der DB:** API antwortet mit 404, Frontend zeigt Toast mit Hinweis auf das Seed-Script.
- **`NEXT_PUBLIC_DEV_LOGIN_ENABLED` in Production gesetzt (Konfigurationsfehler):** Server-seitiger `NODE_ENV`-Check verhindert trotzdem die Session-Erzeugung (HTTP 403). Der Button kann im Frontend sichtbar sein, der Login schlägt aber fehl.
- **Gleichzeitiger Einsatz mit Azure-AD-Login:** Beide Buttons sind in Dev-Modus nebeneinander sichtbar und funktionieren unabhängig.
- **Dev-User hat eine andere Rolle (z.B. `werkstudent`):** Login funktioniert, Weiterleitung geht auf `/dashboard`; Entwickler sieht bewusst die Werkstudenten-Ansicht. Kein Fehler.
- **Browser-Cookies bereits vorhanden (alter Session):** Der Dev-Login überschreibt die bestehende Session.
- **Mehrere Dev-Users in der DB:** Der Endpunkt wählt immer den ersten Nutzer mit `is_active=true` und `role=manager` – kein UI zur Nutzerauswahl.

## Technical Requirements
- **Security:** Doppelte Umgebungsprüfung (NEXT_PUBLIC_DEV_LOGIN_ENABLED client-seitig + NODE_ENV + DEV_LOGIN_ENABLED server-seitig); API-Route niemals in Production erreichbar.
- **Session-Kompatibilität:** Session-Cookie identisch zur Azure-AD-Auth (gleiche Supabase-Session-Struktur oder NextAuth-Session, je nachdem was PROJ-1 verwendet).
- **Kein Passwort gespeichert:** Der Dev-User braucht kein Passwort-Hash in der Datenbank – die Session wird serverseitig direkt erzeugt (Supabase `admin.auth.signInWithPassword` mit dev-only Service-Role-Key oder direkter Session-Erzeugung).
- **Performance:** Dev-Login-Roundtrip < 500 ms (kein Azure-AD-Redirect-Flow).
- **Keine Produktions-Abhängigkeit:** Der gesamte Dev-Login-Code (Button, API-Route, Seed-SQL) soll klar als `dev-only` markiert sein; ggf. mit einem Kommentar-Block.

## Seed-SQL (Vorschlag)
```sql
-- Dev-only Admin-User für PROJ-7 lokalen Login
-- Nur in lokaler Supabase-Instanz ausführen!
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  'Dev Admin',
  'manager',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/login page (existing, Server Component)
+-- mindsquare logo + title (existing)
+-- MicrosoftSignInButton (existing, unchanged)
+-- DevLoginButton (NEW – Client Component, conditional)
    +-- Amber warning badge: "Dev only"
    +-- Button: "Als Admin einloggen"
    +-- Loading state while login request is pending
    +-- Error toast if seed user is missing in DB
```

`DevLoginButton` wird nur gerendert wenn `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true`. In Production gibt die Komponente `null` zurück – kein DOM-Eintrag.

### Data Flow

```
.env.local (dev flags gesetzt)
  → /login rendert DevLoginButton
  → Klick "Als Admin einloggen"
  → POST /api/auth/dev-login
      [Guard 1] NODE_ENV ≠ development → 403
      [Guard 2] DEV_LOGIN_ENABLED ≠ true  → 403
      → Query profiles table: erster aktiver Manager
      → Nicht gefunden → 404 (Frontend-Toast: "Bitte Seed-Script ausführen")
      → Gefunden → Supabase-Session via Service Role Key erstellen
      → Selbe Session-Cookies wie Azure-AD-Callback-Flow setzen
      → { redirectTo: "/manager" }
  → Frontend navigiert zu /manager
```

### Security: Two-Layer Environment Gate

| Layer | Variable | Geprüft in | Wirkung |
|---|---|---|---|
| Client | `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true` | Login-Seite | Button gerendert vs. nicht gerendert |
| Server | `NODE_ENV=development` + `DEV_LOGIN_ENABLED=true` | API-Route | 403 wenn eine Bedingung fehlt |

### Session-Kompatibilität

Die API-Route nutzt den **Supabase Service Role Key** um eine Session für den Seed-User zu erzeugen. Die resultierenden Cookies sind strukturell identisch mit denen des bestehenden `/api/auth/callback`-Flows (`sb-<project>-auth-token`).

### Hinweis: profiles vs. users Tabelle

Die PROJ-7-Spec referenziert eine `users`-Tabelle, PROJ-1 implementiert aber eine `profiles`-Tabelle. Das Design zielt auf `profiles` – konsistent mit dem bestehenden Auth-Flow.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/app/login/page.tsx` | `DevLoginButton` hinzufügen (bedingt) |
| `src/components/DevLoginButton.tsx` | Neu – Client Component |
| `src/app/api/auth/dev-login/route.ts` | Neu – geschützte POST-Route |
| `docs/dev-seed.sql` | Neu – Seed-Script für Dev-Admin-User |
| `.env.local` (nicht committed) | `NEXT_PUBLIC_DEV_LOGIN_ENABLED=true`, `DEV_LOGIN_ENABLED=true` |

### Environment Variables

| Variable | Side | Committed? |
|---|---|---|
| `NEXT_PUBLIC_DEV_LOGIN_ENABLED` | Client | Nein (.env.local) |
| `DEV_LOGIN_ENABLED` | Server | Nein (.env.local) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Nein (bereits in .env.local) |

### Dependencies

Keine neuen npm-Pakete – `@supabase/ssr`, shadcn `Button`, `Badge`, `sonner` sind bereits installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
