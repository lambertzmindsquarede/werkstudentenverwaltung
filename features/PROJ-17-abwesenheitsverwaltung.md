# PROJ-17: Abwesenheitsverwaltung

## Status: Architected
**Created:** 2026-05-06
**Last Updated:** 2026-05-06

## Dependencies
- Requires: PROJ-1 (Authentication) — für eingeloggten Nutzer
- Requires: PROJ-3 (Wochenplanung) — Abwesenheit überschreibt Planung des jeweiligen Tages
- Requires: PROJ-4 (Tages-Zeiterfassung) — Abwesenheitstage sperren die Zeiterfassung
- Requires: PROJ-5 (Manager-Kalenderansicht) — Abwesenheiten werden im Kalender angezeigt
- Requires: PROJ-15 (Änderungsbenachrichtigung) — Manager-Benachrichtigung bei neuer Abwesenheit
- Requires: PROJ-18 (Admin-Rolle & Bereichsverwaltung) — für globale Typkonfiguration durch Admins und Bereichszuordnung

## User Stories

### Werkstudent
- Als Werkstudent möchte ich einen Abwesenheitstag eintragen (Typ + optionale Notiz), damit mein Manager informiert wird und ich keinen Planungs- und Zeiterfassungseintrag manuell löschen muss.
- Als Werkstudent möchte ich eine Krankmeldung auch für gestern oder vorvorgestern nachtragen können (bis zu 7 Tage rückwirkend), damit ich nicht sofort am Krankheitstag handeln muss.
- Als Werkstudent möchte ich eine eingetragene Abwesenheit wieder löschen können (solange sie in der Zukunft liegt oder innerhalb der Bearbeitungsfrist), damit ich Fehler korrigieren kann.
- Als Werkstudent möchte ich in meiner Wochenansicht sehen, welche Tage als abwesend markiert sind, damit ich den Überblick behalte.
- Als Werkstudent möchte ich beim Eintragen einer Abwesenheit nur die für meinen Bereich freigeschalteten Typen sehen, damit die Auswahl übersichtlich und relevant bleibt.

### Manager
- Als Manager möchte ich bei jeder neu eingetragenen Abwesenheit eine Benachrichtigung erhalten, damit ich keine ungeplanten Ausfälle verpasse.
- Als Manager möchte ich Abwesenheiten meiner Werkstudenten direkt im Teamkalender (PROJ-5) sehen, damit ich auf einen Blick erkenne, wer heute fehlt.
- Als Manager möchte ich eine separate Abwesenheitsübersicht aufrufen können (gefiltert nach Person, Zeitraum, Typ), damit ich Auswertungen erstellen kann.
- Als Manager möchte ich die Abwesenheitstypen für meinen Bereich anpassen können (globale Typen aktivieren/deaktivieren, eigene Typen hinzufügen), damit die Liste auf unsere Teamstruktur passt.

### Admin
- Als Admin möchte ich eine unternehmensweite Standard-Liste von Abwesenheitstypen pflegen (anlegen, umbenennen, deaktivieren), damit alle Bereiche eine konsistente Basis haben.
- Als Admin möchte ich sehen, welche Bereiche die globalen Typen überschrieben haben, damit ich den Überblick über abweichende Konfigurationen behalte.

## Acceptance Criteria

### Globale Abwesenheitstypen (Admin)
- [ ] Admin kann in den Einstellungen eine unternehmensweite Liste von Abwesenheitstypen pflegen: Name (max. 50 Zeichen), optionale Farbe/Icon zur Anzeige, aktiv/inaktiv.
- [ ] Initial werden 4 Standardtypen angelegt: Krank, Urlaub, Frei (unbezahlt), Sonstiges.
- [ ] Ein globaler Typ kann deaktiviert (nicht gelöscht) werden. Deaktivierte Typen sind in allen Bereichen ohne eigene Überschreibung nicht mehr auswählbar.
- [ ] Admin kann neue globale Typen anlegen; diese sind sofort in allen Bereichen ohne eigene Überschreibung verfügbar.
- [ ] Admin sieht eine Übersicht, welche Bereiche die globalen Typen durch eine eigene Konfiguration überschrieben haben.

### Bereichsspezifische Abwesenheitstypen (Manager)
- [ ] Manager kann in den Bereichseinstellungen die Typenliste für seinen Bereich anpassen.
- [ ] Anpassungsoptionen pro Bereich: globale Typen aktivieren oder deaktivieren, eigene bereichsspezifische Typen hinzufügen (Name, Farbe/Icon).
- [ ] Solange ein Bereich keine eigene Konfiguration hat, erbt er die globale Liste (nur aktive globale Typen sind sichtbar).
- [ ] Sobald ein Bereich mindestens eine Anpassung hat, gilt seine Liste vollständig — spätere Änderungen an der globalen Liste wirken sich nicht mehr automatisch aus, sondern werden dem Manager als Hinweis angezeigt: „Neue globale Typen wurden hinzugefügt. Möchtest du sie für deinen Bereich übernehmen?"
- [ ] Manager kann die Bereichs-Konfiguration jederzeit auf „globale Standardliste zurücksetzen".

### Eintragen einer Abwesenheit (Werkstudent)
- [ ] Werkstudent kann auf einen Tag in seiner Wochenansicht klicken und „Abwesenheit eintragen" wählen.
- [ ] Das Typauswahlfeld zeigt ausschließlich die aktiven Typen seines Bereichs (bereichsspezifisch oder global-geerbt).
- [ ] Pflichtfeld: Abwesenheitstyp. Optionale Notiz (max. 100 Zeichen) bei allen Typen.
- [ ] Die Abwesenheit kann für heute, vergangene Tage (max. 7 Tage zurück) und zukünftige Tage eingetragen werden.
- [ ] Tage, die länger als 7 Tage in der Vergangenheit liegen, sind gesperrt (Fehlermeldung: „Abwesenheit kann maximal 7 Tage rückwirkend eingetragen werden.").
- [ ] Beim Speichern wird der Manager per Benachrichtigung (PROJ-15) informiert.

### Automatische Integration mit Planung & Zeiterfassung
- [ ] Ein als abwesend markierter Tag zeigt in der Wochenplanung (PROJ-3) automatisch 0h an; das Planungsfeld ist für diesen Tag gesperrt.
- [ ] Die Zeiterfassung (PROJ-4) ist für abwesende Tage deaktiviert (kein Einstempeln möglich).
- [ ] Bereits eingetragene Planungszeiten oder Zeitblöcke für den Tag werden beim Speichern einer Abwesenheit nicht gelöscht, sondern nur ausgeblendet/gesperrt. Wenn die Abwesenheit gelöscht wird, werden sie wieder sichtbar.

### Löschen einer Abwesenheit (Werkstudent)
- [ ] Werkstudent kann eine Abwesenheit löschen, wenn sie in der Zukunft liegt oder innerhalb der letzten 7 Tage eingetragen wurde.
- [ ] Nach dem Löschen sind Planung und Zeiterfassung für den Tag wieder freigegeben.
- [ ] Manager erhält keine Benachrichtigung beim Löschen (nur beim Erstellen).

### Manager-Kalenderansicht (PROJ-5 Integration)
- [ ] Abwesenheitstage werden im Team-Kalender mit einem eigenen visuellen Marker angezeigt (z.B. farbige Markierung + Typ-Kürzel: „K" = Krank, „U" = Urlaub, „F" = Frei, „S" = Sonstiges).
- [ ] Beim Hover/Klick auf einen Abwesenheitseintrag im Kalender sieht der Manager Typ, Notiz und Erstellungsdatum.

### Separate Abwesenheitsübersicht (Manager)
- [ ] Manager kann eine dedizierte Seite „Abwesenheiten" aufrufen.
- [ ] Filteroptionen: Person (einzeln oder alle), Zeitraum (von/bis), Abwesenheitstyp.
- [ ] Liste zeigt: Werkstudent, Datum, Typ, Notiz, Erstellungsdatum.
- [ ] Tabelle ist sortierbar nach Datum und Person.

## Edge Cases

- **Doppelte Abwesenheit:** Werkstudent versucht, für denselben Tag eine zweite Abwesenheit einzutragen → Fehlermeldung: „Für diesen Tag ist bereits eine Abwesenheit eingetragen. Bitte lösche sie zuerst."
- **Abwesenheit an Feiertag:** Ist der Tag bereits als Feiertag markiert (PROJ-10), wird dies angezeigt. Abwesenheit kann trotzdem eingetragen werden (für die Protokollierung).
- **Abwesenheit in der Vergangenheit > 7 Tage:** Eingabe gesperrt mit erklärender Fehlermeldung.
- **Abwesenheit löschen nach Frist:** Liegt der Tag mehr als 7 Tage in der Vergangenheit, ist das Löschen gesperrt. Manager kann im Admin-Bereich dennoch löschen.
- **Zeiterfassung schon aktiv:** Hat der Werkstudent an einem Tag bereits Zeit gebucht und trägt dann nachträglich eine Abwesenheit ein → Warndialog: „An diesem Tag sind bereits Zeitblöcke erfasst. Wenn du die Abwesenheit einträgst, werden die Zeitblöcke gesperrt. Fortfahren?"
- **Fehlende Benachrichtigungskonfiguration:** Wenn PROJ-15 Benachrichtigungen nicht aktiv sind, wird die Abwesenheit trotzdem gespeichert (stille Degradation, kein Fehler für den Werkstudenten).
- **Typ wird deaktiviert, hat aber bestehende Einträge:** Ein global oder bereichsspezifisch deaktivierter Typ bleibt bei vorhandenen Abwesenheitseinträgen erhalten und wird dort lesbar angezeigt (mit Hinweis „[deaktiviert]"). Neue Einträge mit diesem Typ sind nicht mehr möglich.
- **Bereich hat keine aktiven Typen:** Wurde in einem Bereich die gesamte Typenliste deaktiviert, wird beim Eintragen einer Abwesenheit eine Fehlermeldung angezeigt: „Für deinen Bereich sind keine Abwesenheitstypen konfiguriert. Bitte wende dich an deinen Manager."
- **Neuer globaler Typ nach bereichsspezifischer Konfiguration:** Der Manager des Bereichs erhält einen Hinweis-Banner in den Bereichseinstellungen. Der Typ wird nicht automatisch übernommen.

## Technical Requirements
- Performance: Abwesenheit speichern < 300ms
- Security: Werkstudent kann nur eigene Abwesenheiten eintragen/löschen; Manager sieht/verwaltet alle Abwesenheiten im eigenen Bereich; Admin sieht alle
- DB-Tabellen:
  - `absence_types` (global): id, name, color, icon, is_active, created_by (admin), created_at
  - `absence_type_overrides` (pro Bereich): id, bereich_id, absence_type_id (nullable = eigener Typ), name, color, icon, is_active, is_custom, created_at
  - `absences`: id, user_id, bereich_id, absence_type_id, absence_type_override_id (nullable), date, note, created_at
- RLS: Werkstudent liest/schreibt nur eigene `absences`; Manager liest alle `absences` im eigenen Bereich + schreibt `absence_type_overrides` für eigenen Bereich; Admin hat Vollzugriff
- Bearbeitungsfrist analog PROJ-14: konfigurierbar, Standard 7 Tage
- Beim Laden der Typen für einen Bereich: wenn `absence_type_overrides` für den Bereich existieren → bereichsspezifische Liste; sonst → alle globalen aktiven `absence_types`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Umsetzungsreihenfolge
PROJ-18 (Admin-Rolle & Bereichsverwaltung) muss vor PROJ-17 fertiggestellt sein — insbesondere `bereich_id` auf Nutzerprofilen und die `/admin`-Routen-Struktur.

Empfohlene Reihenfolge innerhalb PROJ-17:
1. DB-Tabellen + RLS
2. API-Layer
3. Frontend Werkstudent (Wochenplanung)
4. Frontend Manager (Kalender + Übersicht + Settings)
5. Frontend Admin (Typen-Verwaltung)

### Komponenten-Struktur

**A) Werkstudent – Wochenplanung (bestehende Seite erweitert)**
```
WochenplanungClient (bestehend)
+-- Tag-Zelle (erweitert)
|   +-- AbwesenheitsBadge (neu) — farbige Markierung + Typ-Kürzel
|   +-- [Tag gesperrt wenn abwesend] — Planung & Stempeluhr deaktiviert
+-- AbwesenheitDialog (neu) — Modal beim Klick auf Tag
    +-- Typ-Auswahl (nur aktive Typen des eigenen Bereichs)
    +-- Notizfeld (optional, max. 100 Zeichen)
    +-- Warndialog wenn Zeitblöcke bereits vorhanden
    +-- Löschen-Button (wenn innerhalb Bearbeitungsfrist)
```

**B) Manager – Kalenderansicht (bestehende Komponenten erweitert)**
```
KalenderZelle (erweitert)
+-- AbwesenheitMarker (neu) — Farbe + Kürzel (K/U/F/S)
ZellDetailDialog (erweitert)
+-- AbwesenheitInfo (neu) — Typ, Notiz, Erstellungsdatum
```

**C) Manager – Abwesenheitsübersicht (neue Seite)**
```
/manager/abwesenheiten (neu)
+-- FilterLeiste
|   +-- PersonFilter (Dropdown: alle oder einzelner Werkstudent)
|   +-- ZeitraumFilter (Von/Bis Datepicker)
|   +-- TypFilter (Dropdown)
+-- AbwesenheitenTabelle
    +-- Sortierbare Spalten: Werkstudent | Datum | Typ | Notiz | Erfasst am
```

**D) Manager – Bereichseinstellungen (bestehende Seite `/manager/settings` erweitert)**
```
/manager/settings (erweitert um neuen Abschnitt)
+-- AbwesenheitstypenKonfiguration
    +-- GlobaleTypenListe (aktivieren/deaktivieren per Toggle)
    +-- EigeneTypenListe (eigene Typen anlegen: Name + Farbe)
    +-- HinweisBanner (wenn neue globale Typen nach Konfiguration hinzugefügt)
    +-- "Auf Standard zurücksetzen"-Button
```

**E) Admin – Abwesenheitstypen (neue Seite)**
```
/admin/abwesenheitstypen (neu)
+-- GlobaleTypenVerwaltung
|   +-- Typ-Zeile (Name | Farbe | Kürzel | Aktiv/Inaktiv-Toggle | Bearbeiten)
|   +-- NeuerTypDialog (Name, Farbe, Kürzel)
+-- BereichsKonfigurationsÜbersicht
    +-- Tabelle: welche Bereiche von der globalen Liste abweichen
```

### Datenmodell

**`absence_types`** — Unternehmensweite Standardtypen (Admin-verwaltete)
- ID, Name (max. 50 Zeichen), Farbe (Hex, optional), Kürzel (1 Buchstabe, optional), Aktiv/Inaktiv, erstellt_von (Admin-ID), erstellt_am
- Initial-Daten: Krank (K), Urlaub (U), Frei/unbezahlt (F), Sonstiges (S)

**`absence_type_overrides`** — Bereichsspezifische Anpassungen (Manager-verwaltete)
- ID, bereich_id, absence_type_id (nullable = eigener Typ), Name, Farbe, Kürzel, Aktiv/Inaktiv, is_custom (Boolean), erstellt_am
- Null-Einträge-Logik: hat ein Bereich keinen einzigen Override → erbt er die globale Liste

**`absences`** — Abwesenheitseinträge
- ID, user_id (Werkstudent), bereich_id (zum Zeitpunkt der Erfassung), absence_type_id (nullable), absence_type_override_id (nullable), date, note (max. 100 Zeichen, optional), erstellt_am
- Unique-Constraint: (user_id, date) — kein Duplikat pro Tag

**Typ-Auflösungslogik:**
- Hat Bereich Einträge in `absence_type_overrides` → zeige diese (nur aktive)
- Sonst → zeige alle aktiven globalen `absence_types`

### Neue & erweiterte Routen

| Route | Typ | Beschreibung |
|-------|-----|--------------|
| `/manager/abwesenheiten` | Neu | Gefilterte Abwesenheitsübersicht für Manager |
| `/admin/abwesenheitstypen` | Neu | Globale Typen-Verwaltung für Admin |
| `/dashboard/wochenplanung` | Erweitert | Abwesenheitsbadge + Dialog pro Tag |
| `/manager/kalender` | Erweitert | Abwesenheitsmarker in KalenderZelle + ZellDetailDialog |
| `/manager/settings` | Erweitert | Neuer Abschnitt: Typen-Konfiguration pro Bereich |

### Neue API-Endpunkte

| Endpunkt | Methoden | Berechtigungen |
|----------|----------|----------------|
| `/api/absences` | GET, POST | WS (eigene), Manager (Bereich), Admin (alle) |
| `/api/absences/[id]` | DELETE | WS (eigene + Frist), Manager, Admin |
| `/api/absence-types` | GET, POST, PATCH | GET: alle; POST/PATCH: Admin |
| `/api/absence-type-overrides` | GET, POST, PATCH, DELETE | Manager (eigener Bereich), Admin |
| `/api/absence-types/resolved` | GET | WS + Manager — aufgelöste Liste für einen Bereich |

### Sicherheit (RLS)

| Rolle | `absences` | `absence_types` | `absence_type_overrides` |
|-------|-----------|-----------------|--------------------------|
| Werkstudent | Lesen + Schreiben: nur eigene | Lesen (aktive) | Lesen (eigener Bereich) |
| Manager | Lesen: gesamter Bereich | Lesen | Lesen + Schreiben: eigener Bereich |
| Admin | Vollzugriff | Vollzugriff | Vollzugriff |

### Technische Entscheidungen

- **Separate `absence_type_overrides`-Tabelle:** Ein Bereich kann globale Typen deaktivieren UND eigene hinzufügen — zwei unabhängige Operationen, die eine eigene Tabelle erfordern.
- **`bereich_id` auf `absences` redundant:** Werkstudenten können den Bereich wechseln. Die Speicherung zum Erfassungszeitpunkt sichert historische Korrektheit.
- **Wochenladen-Integration (PROJ-3 & PROJ-4):** Beim Laden der Woche werden alle Abwesenheiten für den Zeitraum einmalig abgefragt und betroffene Tage clientseitig gesperrt — kein API-Call pro Tag.
- **PROJ-15-Benachrichtigung:** Serverseitiger Trigger beim POST; bei Fehler stille Degradation (Abwesenheit wird trotzdem gespeichert).

### Abhängigkeiten / Packages
Keine neuen npm-Pakete notwendig — alle benötigten UI-Komponenten (Dialog, Select, Table, Badge, Switch, Popover) sind bereits als shadcn/ui installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
