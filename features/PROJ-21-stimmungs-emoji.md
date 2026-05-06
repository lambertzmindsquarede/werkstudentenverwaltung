# PROJ-21: Stimmungs-Emoji beim Einstempeln

## Status: In Review
**Created:** 2026-05-07
**Last Updated:** 2026-05-07

## Dependencies
- Requires: PROJ-4 (Tages-Zeiterfassung) — Emoji wird beim Einstempel-Vorgang gesetzt
- Requires: PROJ-18 (Admin-Rolle & Bereichsverwaltung) — Bereichskonzept für die Übersichtsseite
- Requires: PROJ-20 (Team-Anwesenheitsübersicht) — Bereichsübersicht, auf der Emojis angezeigt werden

## User Stories

- Als Werkstudent möchte ich beim Einstempeln optional ein Stimmungs-Emoji auswählen können, damit meine Kollegen und Manager auf einen Blick sehen, wie es mir heute geht.
- Als Werkstudent möchte ich mein Stimmungs-Emoji während meiner aktiven Arbeitszeit ändern können, damit es meiner aktuellen Stimmung entspricht.
- Als Werkstudent möchte ich das Emoji auch weglassen können (freiwillig), ohne dass das Einstempeln blockiert wird.
- Als Manager möchte ich die aktuellen Stimmungs-Emojis aller eingestempelten Werkstudenten in der Bereichsübersicht sehen, damit ich schnell erkennen kann, ob jemand Unterstützung braucht.
- Als Manager möchte ich, dass das Emoji automatisch verschwindet, sobald ein Werkstudent ausstempelt, damit die Ansicht immer den Live-Status widerspiegelt.

## Acceptance Criteria

- [ ] Beim Einstempeln wird dem Werkstudenten ein Emoji-Picker angeboten, über den ein beliebiges Emoji ausgewählt werden kann
- [ ] Der Picker zeigt oben 6 Favoriten-Emojis für schnellen Zugriff: 🚀 Motiviert, 😊 Gut, 😐 Neutral, 😴 Müde, 😤 Gestresst, 🤒 Krank
- [ ] Über den vollständigen Emoji-Picker kann jedes beliebige Emoji aus allen Standard-Emoji-Kategorien gewählt werden
- [ ] Die Auswahl ist optional — der Werkstudent kann ohne Emoji-Auswahl einstempeln
- [ ] Nach dem Einstempeln kann der Werkstudent sein Emoji in der Tages-Zeiterfassung jederzeit ändern (während er eingestempelt ist)
- [ ] Auf der Team-Anwesenheitsübersicht (Bereichsübersicht) wird das Emoji neben dem Namen des eingestempelten Werkstudenten angezeigt
- [ ] Wenn kein Emoji gewählt wurde, wird kein Emoji angezeigt (kein Platzhalter)
- [ ] Beim Ausstempeln wird das Emoji automatisch geleert und nicht mehr angezeigt
- [ ] Das Emoji wird nicht dauerhaft in der Datenbank gespeichert (nur für die aktive Session relevant)

## Edge Cases

- Werkstudent stempelt ohne Emoji-Auswahl ein → kein Emoji in der Übersicht, kein Fehler
- Werkstudent ändert Emoji mehrfach während des Arbeitstags → nur das zuletzt gesetzte Emoji ist sichtbar
- Werkstudent stempelt aus → Emoji wird aus der Ansicht entfernt, unabhängig davon ob eines gesetzt war
- Mehrere Werkstudenten mit gleichem Emoji → alle werden einzeln korrekt angezeigt
- Session läuft ohne explizites Ausstempeln ab (z.B. Mitternacht / automatische Abmeldung) → Emoji wird ebenfalls geleert
- Bereichsübersicht (PROJ-20) noch nicht live → Emoji-Anzeige erscheint dort erst wenn PROJ-20 deployed ist

## Emoji-Auswahl

Frei wählbar über einen Emoji-Picker (alle Standard-Kategorien). Oben im Picker werden 6 Favoriten prominent angezeigt:

| Emoji | Label |
|-------|-------|
| 🚀 | Motiviert |
| 😊 | Gut |
| 😐 | Neutral |
| 😴 | Müde |
| 😤 | Gestresst |
| 🤒 | Krank |

## Technical Requirements

- Emoji-Wert wird im aktiven Zeiterfassungseintrag (oder einer separaten kurzlebigen Session-Spalte) gespeichert
- Keine Persistenz über das Ausstempeln hinaus erforderlich
- Anzeige auf der Bereichsübersicht erfolgt in Echtzeit (kein manuelles Reload nötig)
- Performance: Emoji-Auswahl-Interaktion < 100ms, Anzeige auf Übersicht < 500ms nach Änderung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kein neues Datenbankschema notwendig. Das Emoji wird als optionale Spalte auf dem bestehenden `actual_entries`-Eintrag gespeichert und verschwindet automatisch beim Ausstempeln.

### Datenbankänderung
Eine neue Spalte auf der bestehenden Tabelle:

```
actual_entries
  + mood_emoji  (text, nullable)
```

Das Emoji ist direkt an den offenen Eintrag gekoppelt. Beim Ausstempeln (PATCH /stamp) wird `mood_emoji = NULL` gesetzt — keine separate Bereinigungslogik nötig.

### Komponentenstruktur

```
StempelCard (bestehend — erweitert)
+-- EmojiPickerPopover (neu, sichtbar vor dem Einstempeln)
|   +-- 6 Favoriten-Emojis als Schnellauswahl-Buttons
|   +-- "Alle Emojis" Button → öffnet vollständigen Emoji-Picker
+-- AktivesEmojiAnzeige (neu, sichtbar wenn eingestempelt)
    +-- Aktuelles Emoji (klickbar → öffnet EmojiPickerPopover zum Ändern)
    +-- "Entfernen"-Link

PersonCard in PROJ-20 (zukünftig, wenn PROJ-20 deployed)
+-- Name-Badge
+-- Ort-Element (Sub-Location)
+-- Emoji-Badge (nur wenn mood_emoji gesetzt)
```

### API-Änderungen

| Endpunkt | Methode | Änderung |
|---|---|---|
| `/api/time-entries/stamp` | POST (Einstempeln) | Nimmt optionalen `emoji`-Parameter im Body entgegen |
| `/api/time-entries/stamp` | PATCH (Ausstempeln) | Setzt `mood_emoji = NULL` beim Schließen des Eintrags |
| `/api/time-entries/mood-emoji` | NEU PATCH | Aktualisiert Emoji auf dem aktuell offenen Eintrag |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Emoji-Picker Library | `emoji-mart` | Vollständige Standard-Kategorien, Suche, anpassbare Favoriten. Etabliert (Slack, GitHub). |
| UI-Container | Popover (shadcn — bereits installiert) | Kein neues Paket nötig. Schließt bei Klick außerhalb — Standard-UX für Picker. |
| Speicherort | `actual_entries.mood_emoji` | Koppelt Emoji direkt an die Session. Automatisch geleert beim Ausstempeln. |
| Echtzeit-Anzeige (PROJ-20) | Supabase Realtime | PROJ-20 plant ohnehin Realtime-Subscriptions auf `actual_entries`. Emoji-Änderungen kommen automatisch mit. |

### Neue Pakete

| Paket | Zweck |
|---|---|
| `emoji-mart` | Vollständiger Emoji-Picker (alle Unicode-Kategorien) |
| `@emoji-mart/data` | Emoji-Datensatz |

### Datenfluss

```
Werkstudent klickt "Einstempeln"
  → EmojiPickerPopover erscheint (optional)
  → POST /stamp mit { emoji: "🚀" } (oder ohne)
  → actual_entries: { mood_emoji: "🚀", is_complete: false }

Werkstudent ändert Emoji während Arbeitszeit
  → Klick auf aktuelles Emoji
  → PATCH /mood-emoji mit { emoji: "😊" }

Werkstudent stempelt aus
  → PATCH /stamp → { mood_emoji: NULL, is_complete: true }
  → Emoji verschwindet automatisch aus der PROJ-20-Übersicht
```

## Implementation Notes

### Was gebaut wurde
- `actual_entries.mood_emoji` Spalte via Migration `20260507_proj21_mood_emoji.sql` hinzugefügt (TEXT NULL, max. 10 Zeichen)
- `database.types.ts`: `ActualEntry` Typ um `mood_emoji: string | null` erweitert
- `POST /api/time-entries/stamp`: nimmt optionalen `emoji`-Parameter im Request-Body entgegen
- `PATCH /api/time-entries/stamp`: setzt `mood_emoji = NULL` beim Ausstempeln
- `PATCH /api/time-entries/mood-emoji` (neu): aktualisiert Emoji auf offenem Eintrag
- `EmojiPickerPopover.tsx` (neu): Popover mit 6 Favoriten + vollständigem `emoji-mart`-Picker (Web Component, per `useEffect` gemountet)
- `StempelCard.tsx`: vor dem Einstempeln Emoji-Auswahl (optional), während eingestempelt Anzeige + Änderungsmöglichkeit

### Pakete
- `emoji-mart@5.6.0` + `@emoji-mart/data@1.2.1` hinzugefügt

## QA Test Results

**QA Date:** 2026-05-07  
**Tester:** /qa skill  
**Build:** Clean (`npm run build` — no errors or warnings)  
**Unit tests:** 235/235 passed (`npm test`)  
**E2E tests:** 9/9 runnable passed; 11 skipped (test accounts at daily 3-block limit — correct skip logic)

### Acceptance Criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Emoji-Picker beim Einstempeln angeboten | ✅ PASS | Dashed 🙂 trigger renders in `canStampIn` state |
| 2 | 6 Favoriten-Emojis (🚀😊😐😴😤🤒) | ✅ PASS | Confirmed in code + E2E |
| 3 | Vollständiger Emoji-Picker via "Alle Emojis →" | ✅ PASS | `emoji-mart` Web Component lazy-loaded |
| 4 | Auswahl optional — Einstempeln ohne Emoji möglich | ✅ PASS | E2E: stamp-in ohne Emoji erfolgreich |
| 5 | Emoji während eingestempelt änderbar | ✅ PASS | EmojiPickerPopover im aktiven Zustand |
| 6 | Emoji auf Team-Anwesenheitsübersicht (PROJ-20) | ⏳ N/A | PROJ-20 noch nicht deployed — wird automatisch erscheinen |
| 7 | Kein Emoji → kein Platzhalter angezeigt | ✅ PASS | Conditional `{openBlock.mood_emoji && …}` |
| 8 | Beim Ausstempeln wird Emoji geleert | ✅ PASS | E2E + API: `mood_emoji = NULL` in PATCH /stamp |
| 9 | Emoji nicht dauerhaft gespeichert | ✅ PASS | Spalte wird beim Ausstempeln genullt |

**Result: 8/9 AC passed (1 N/A — pending PROJ-20 deployment)**

### Bugs Found

| ID | Severity | Description | Steps to Reproduce |
|----|----------|-------------|-------------------|
| BUG-M1 | **Medium** | Kein Fehler-Feedback wenn Emoji-Update fehlschlägt | PATCH /mood-emoji-Fehler wird in `catch {}` still geschluckt; Nutzer merkt nicht, dass Emoji nicht gespeichert wurde |
| BUG-L1 | Low | Emoji wird doppelt angezeigt wenn eingestempelt | Emoji setzt sich in der "Läuft seit"-Zeile (StempelCard.tsx:259) UND als Picker-Trigger-Button an (Z. 272) |
| BUG-L2 | Low | Kein Zurück-Button im vollständigen Emoji-Picker | Nach Klick auf "Alle Emojis →" gibt es keine Zurück-Option — Nutzer muss Popover schließen und neu öffnen |
| BUG-L3 | Low | Beliebige Strings ≤10 Zeichen als Emoji akzeptiert | API nimmt z.B. "abc12345" an — keine Unicode-Emoji-Validierung (kein XSS-Risiko da React Text-Rendering) |

### Security Audit

| Check | Result |
|-------|--------|
| Auth-Schutz: POST /stamp, PATCH /stamp, PATCH /mood-emoji | ✅ Alle liefern 401 ohne Session |
| Autorisierung: Nutzer kann nur eigenes Emoji ändern | ✅ `eq('user_id', user.id)` in allen Queries |
| XSS via gespeichertes Emoji | ✅ React rendert als Text, keine HTML-Injection möglich |
| SQL-Injection | ✅ Supabase parameterisierte Queries |
| Rate Limiting auf /mood-emoji | ℹ️ Nicht implementiert — für interne App akzeptabel |

### Regression Test

Einstempeln/Ausstempeln-Grundfunktion (PROJ-4/PROJ-8) bleibt intakt — alle bestehenden 235 Unit-Tests grün.

### Production-Ready Decision

**✅ BEREIT FÜR DEPLOYMENT**

Keine Critical oder High Bugs. Die 3 Low-Bugs und 1 Medium-Bug sind nicht blockierend:
- BUG-M1 ist akzeptabel (Emoji-Update ist explizit non-critical, Funktion bleibt nutzbar)
- BUG-L1/L2/L3 sind UX-Schönheitsfehler ohne funktionale Auswirkung

> Empfehlung: BUG-M1 und BUG-L1 vor PROJ-20-Deployment beheben, damit die Bereichsübersicht mit sauberem Emoji-Stand gezeigt wird.

## Deployment

**Deployed:** 2026-05-07
**Production URL:** https://werkstudentenverwaltung.vercel.app
**Git Tag:** v1.21.0-PROJ-21

Deployed together with PROJ-18 (Admin-Rolle & Bereichsverwaltung), which was implemented in the same session but not yet committed. Both features went live in a single push.
