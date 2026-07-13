# Template-Update-Protokoll

Dieses Projekt basiert auf dem [AI Coding Starter Kit](https://github.com/AlexPEClub/ai-coding-starter-kit).
Der Projekt-Klon hat **keine gemeinsame Git-Historie** mit dem Template (Initial-Commit ist ein
Squash) — Updates werden daher **dateiweise** übernommen, niemals per `git merge`.

## Stand

- **Upstream-URL:** https://github.com/AlexPEClub/ai-coding-starter-kit.git
- **Remote-Name:** `template` (bereits eingerichtet; `git fetch template main`)
- **Zuletzt übernommener Upstream-Commit:** `21a97bb` (2026-06-03, "docs(deploy): Note Vercel account must be created manually before deploy")
- **Ursprüngliche Basis des Klons:** `ef85ee7` (2026-03-31)
- **Übernommen am:** 2026-07-13

## Update-Historie

| Datum | Von | Nach | Umfang |
|-------|-----|------|--------|
| 2026-07-13 | `ef85ee7` | `21a97bb` | 6 Commits: `/requirements` → `/init` + `/write-spec` + `/refine`, Angenommen/Wenn/Dann-AC-Format, Decision Log & Out of Scope, Status "Roadmap", Permissions-Härtung (deny-Liste), Vercel-Hinweis in `/deploy` |

## Dateien, die bei Updates von Hand gemergt werden müssen

Diese Dateien enthalten projektspezifische Inhalte und dürfen **nicht** per
`git checkout template/main -- <pfad>` überschrieben werden:

- **`CLAUDE.md`** — Projekt-Doku (Name, Tech Stack, Product Context); nur Workflow-/Struktur-Abschnitte angleichen
- **`README.md`** — Titel ist "Werkstudentenverwaltung" (statt Template-Name); Rest folgt dem Template
- **`features/INDEX.md`** — Feature-Tabelle (PROJ-1 bis PROJ-27) ist projektspezifisch; nur Legende/Struktur übernehmen
- **`.claude/settings.json`** — projektspezifisch gewachsene `allow`-Einträge (Supabase-MCP, Playwright, curl-Smoke-Tests) behalten; Upstream-`deny`-Liste und -Entfernungen übernehmen
- **`docs/PRD.md`** — rein projektspezifisch

Alles andere unter `.claude/skills/`, `.claude/rules/`, `.claude/agents/` ist bisher lokal
unverändert und kann direkt übernommen werden.

## Lokale Infrastruktur-Anpassungen (nicht überschreiben)

- Keine Port-Abweichungen: Dev-Server läuft auf Standard-Port 3000
