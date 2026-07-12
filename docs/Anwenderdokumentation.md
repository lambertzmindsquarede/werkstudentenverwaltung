# Werkstudentenverwaltung — Anwenderdokumentation & Schulungsunterlage

**mindsquare AG | Stand: Mai 2026**

---

## Inhaltsverzeichnis

1. [Überblick & Rollen](#1-überblick--rollen)
2. [Anmeldung (Azure AD SSO)](#2-anmeldung-azure-ad-sso)
3. [Werkstudenten-Handbuch](#3-werkstudenten-handbuch)
   - [Dashboard & Navigation](#31-dashboard--navigation)
   - [Wochenplanung](#32-wochenplanung)
   - [Tages-Zeiterfassung (Einstempeln)](#33-tages-zeiterfassung-einstempeln)
   - [Abwesenheiten eintragen](#34-abwesenheiten-eintragen)
   - [Team-Anwesenheitsübersicht](#35-team-anwesenheitsübersicht)
   - [Profil & Personalnummer](#36-profil--personalnummer)
   - [Stundenzettel exportieren](#37-stundenzettel-exportieren)
4. [Manager-Handbuch](#4-manager-handbuch)
   - [Dashboard & Navigation](#41-dashboard--navigation)
   - [Kalenderansicht](#42-kalenderansicht)
   - [Deckungsübersicht](#43-deckungsübersicht)
   - [Auswertung & Reporting](#44-auswertung--reporting)
   - [Manager-Zeitkorrektur](#45-manager-zeitkorrektur)
   - [Arbeitsorte verwalten](#46-arbeitsorte-verwalten)
   - [Abwesenheitstypen konfigurieren](#47-abwesenheitstypen-konfigurieren)
   - [Stundenzettel-Export für Werkstudenten](#48-stundenzettel-export-für-werkstudenten)
5. [Admin-Handbuch](#5-admin-handbuch)
   - [Bereichsverwaltung](#51-bereichsverwaltung)
   - [Nutzerverwaltung](#52-nutzerverwaltung)
   - [Globale Abwesenheitstypen](#53-globale-abwesenheitstypen)
6. [Häufige Fragen (FAQ)](#6-häufige-fragen-faq)
7. [Glossar](#7-glossar)

---

## 1. Überblick & Rollen

Die **Werkstudentenverwaltung** ist eine Web-Applikation von mindsquare zur zentralen Erfassung und Auswertung von Werkstudenten-Arbeitszeiten. Sie ersetzt manuelle Stundenzettel und gibt Managern einen Live-Überblick über Anwesenheit und Planung.

### Benutzerrollen auf einen Blick

```
┌─────────────────────────────────────────────────────────────────┐
│                     WERKSTUDENTENVERWALTUNG                     │
├──────────────────┬──────────────────┬───────────────────────────┤
│   WERKSTUDENT    │     MANAGER      │          ADMIN            │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • Woche planen   │ • Kalenderansicht│ • Bereiche erstellen      │
│ • Einstempeln    │ • Deckungsübers. │ • Manager zuordnen        │
│ • Abwesenheiten  │ • Auswertungen   │ • Nutzer verwalten        │
│ • Stundenzettel  │ • Zeitkorrektur  │ • Abwesenheitstypen       │
│   exportieren    │ • Export starten │   konfigurieren           │
└──────────────────┴──────────────────┴───────────────────────────┘
```

### Prozessfluss im Alltag

```
┌──────────────┐    plant Woche     ┌──────────────┐
│ Werkstudent  │ ─────────────────► │  Wochenplan  │
│              │                    │  (Mo–Fr)     │
│              │ ◄─────────────────  │              │
│              │   sieht Bestätigung └──────────────┘
│              │
│              │  stempelt ein/aus  ┌──────────────┐
│              │ ─────────────────► │  Ist-Zeiten  │
└──────────────┘                    └──────┬───────┘
                                           │ sieht
                                           ▼
┌──────────────┐   prüft & korrig. ┌──────────────┐
│   Manager    │ ◄──────────────── │  Kalender &  │
│              │                   │  Auswertung  │
│              │ ─────────────────►│              │
│              │  exportiert        └──────────────┘
└──────────────┘  Stundenzettel
```

> **Tipp:** Die App ist für **Desktop und Mobilgeräte** optimiert. Auf dem Smartphone kannst du schnell ein- und ausstempeln, auf dem Desktop die Wochenplanung bequem ausfüllen.

---

## 2. Anmeldung (Azure AD SSO)

Die Anmeldung erfolgt ausschließlich über dein **mindsquare Microsoft-Konto** — kein separates Passwort nötig.

### Schritt-für-Schritt

```
┌─────────────────────────────────────────────┐
│           werkstudenten.mindsquare.de        │
│                                             │
│     ┌─────────────────────────────────┐     │
│     │   Mit Microsoft anmelden        │     │
│     │   [  🔵 Mit Microsoft anmelden  ]│     │
│     └─────────────────────────────────┘     │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         Microsoft Login-Seite               │
│                                             │
│   E-Mail: vorname@mindsquare.de             │
│   Passwort: ••••••••••••                    │
│                                             │
│   → Ggf. MFA-Bestätigung (Authenticator)   │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│   Automatische Weiterleitung je nach Rolle  │
│                                             │
│   Werkstudent → /dashboard                  │
│   Manager     → /manager                    │
│   Admin       → /admin                      │
└─────────────────────────────────────────────┘
```

> **Wichtig:** Wenn du nach dem Login auf einer **„Konto ausstehend"-Seite** landest, warte auf die Freischaltung durch deinen Manager oder Admin.

---

## 3. Werkstudenten-Handbuch

### 3.1 Dashboard & Navigation

Nach dem Login siehst du dein persönliches Dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│  mindsquare Werkstudentenverwaltung                    [Profil] │
├────────────────┬────────────────────────────────────────────────┤
│  NAVIGATION    │  DASHBOARD                                      │
│                │                                                │
│ 🏠 Dashboard  │  Willkommen, Max Mustermann!                   │
│ 📅 Wochenpl.  │                                                │
│ ⏱  Zeiterfass.│  ┌──────────────┐  ┌──────────────────────┐  │
│ 🏢 Team-Anw.  │  │ HEUTE        │  │ DIESE WOCHE          │  │
│                │  │ Noch nicht   │  │ Geplant:  16,0 Std   │  │
│                │  │ eingestempelt│  │ Gearbeitet: 8,5 Std  │  │
│                │  │              │  │ Verbleibend: 7,5 Std │  │
│                │  │ [Einstempeln]│  │                      │  │
│                │  └──────────────┘  └──────────────────────┘  │
│                │                                                │
│                │  ┌──────────────────────────────────────────┐ │
│                │  │ ⚠️  Personalnummer fehlt!                 │ │
│                │  │    Bitte hier ergänzen →  [Profil öffnen]│ │
│                │  └──────────────────────────────────────────┘ │
└────────────────┴────────────────────────────────────────────────┘
```

**Symbole & Bedeutung:**

| Symbol | Bedeutung |
|--------|-----------|
| 🏠 | Zum Dashboard zurückkehren |
| 📅 | Wochenplanung aufrufen |
| ⏱ | Zeiterfassung (Stunden einsehen) |
| 🏢 | Team-Anwesenheitsübersicht |
| ⚠️ | Wichtiger Hinweis, der Aktion erfordert |

---

### 3.2 Wochenplanung

Die Wochenplanung erreichst du über **Navigation → Wochenplanung** oder direkt unter `/dashboard/wochenplanung`.

#### Ziel

Plane für die aktuelle und kommende Woche, **wann** du arbeitest und **wo**. Dein Manager sieht diese Planung sofort in seiner Kalenderansicht.

#### Oberfläche

```
┌─────────────────────────────────────────────────────────────────┐
│  Wochenplanung                                                  │
│                                                                 │
│  [← Zurück]   KW 19 · 05.–09. Mai 2026   [Weiter →]           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💡 Vorwoche als Vorlage übernehmen?        [Übernehmen] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────┬──────────┬──────────┬──────────────┬─────────┐  │
│  │ Tag      │ Von      │ Bis      │ Arbeitsort   │ Stunden │  │
│  ├──────────┼──────────┼──────────┼──────────────┼─────────┤  │
│  │ Mo 05.05 │  08:00   │  12:00   │ Büro Padern. │  4,0 h  │  │
│  │ Di 06.05 │  09:00   │  13:00   │ Homeoffice   │  4,0 h  │  │
│  │ Mi 07.05 │  ☐ Kein Arbeitstag                │  —      │  │
│  │ Do 08.05 │  08:00   │  14:00   │ Büro Padern. │  6,0 h  │  │
│  │ Fr 09.05 │  08:00   │  10:00   │ Homeoffice   │  2,0 h  │  │
│  └──────────┴──────────┴──────────┴──────────────┴─────────┘  │
│                                                                 │
│  Geplant diese Woche:  16,0 / 20,0 Std                         │
│                                                                 │
│  [Plan speichern]                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Schritt-für-Schritt: Wochenplan erstellen

1. **Woche wählen** — Über die Pfeiltasten `← Zurück` / `Weiter →` zur gewünschten Woche navigieren.
2. **Vorlage laden (optional)** — Klicke auf **[Übernehmen]** im gelben Banner, um den Plan der Vorwoche als Startpunkt zu übernehmen.
3. **Zeiten eintragen** — Für jeden Arbeitstag **Von**- und **Bis**-Zeit in Viertelstunden-Schritten eingeben (z.B. 08:00, 08:15, 08:30 ...).
4. **Arbeitsort wählen** — Pflichtfeld: Wähle aus den vom Manager konfigurierten Orten (z.B. „Büro Paderborn", „Homeoffice", „Kunde TKSE").
5. **Freie Tage markieren** — An Tagen, an denen du nicht arbeitest, aktiviere **„Kein Arbeitstag"** — dann entfallen Zeitfelder und dieser Tag wird nicht gespeichert.
6. **Plan speichern** — Klicke auf **[Plan speichern]**. Dein Manager sieht die Planung sofort.

#### Regeln & Hinweise

| Situation | Was passiert |
|-----------|-------------|
| Geplante Stunden > 20h | Gelbe Warnung erscheint — Speichern ist trotzdem möglich |
| Startzeit > Endzeit | Rote Fehlermeldung — Speichern ist blockiert |
| Vergangene Wochen | Nur-Lesen — keine Änderungen möglich |
| Feiertage | Werden angezeigt; du kannst den Tag als „Kein Arbeitstag" markieren |

> **Tipp:** Plane mindestens die **aktuelle und nächste Woche** voraus. Dein Manager braucht die Planung für die Kalenderansicht.

---

### 3.3 Tages-Zeiterfassung (Einstempeln)

Die Zeiterfassung erfasst deine **tatsächlich geleisteten** Stunden (Ist-Zeiten). Sie ergänzt die Wochenplanung (Soll-Zeiten).

#### Einstempeln am Morgen

```
┌─────────────────────────────────────────────────────────────────┐
│  Heute, Donnerstag 08.05.2026                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │   Guten Morgen, Max! 👋                                  │  │
│  │                                                          │  │
│  │   Dein Plan heute: 08:00–14:00 (Büro Paderborn)         │  │
│  │                                                          │  │
│  │              [  ▶ Einstempeln  ]                         │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- Klicke auf **[Einstempeln]** — die aktuelle Uhrzeit wird **serverseitig** gespeichert (kein Manipulationsrisiko).
- Der Button wechselt danach zu **[Ausstempeln]**.

#### Ausstempeln am Abend

```
┌──────────────────────────────────────────────────────────────┐
│  Heute, Donnerstag 08.05.2026                                │
│                                                              │
│  ✅ Eingestempelt seit: 08:03 Uhr                            │
│                                                              │
│  Bisherige Arbeitszeit: 5 Std 47 Min                        │
│                                                              │
│              [  ⏹ Ausstempeln  ]                            │
│                                                              │
│  Stimmung: 😀 😊 😐 😕 😞  (optional)                      │
└──────────────────────────────────────────────────────────────┘
```

- Optional kannst du beim Ausstempeln eine **Stimmung** auswählen (Emoji-Skala).
- Nach dem Ausstempeln wird die **Nettoarbeitszeit** berechnet und angezeigt.

#### Wochenübersicht Ist-Zeiten

```
┌─────────────────────────────────────────────────────────────────┐
│  Meine Woche — KW 19                                            │
│                                                                 │
│  ┌──────────┬───────────┬───────────┬────────────┬──────────┐  │
│  │ Tag      │ Plan      │ Ist       │ Differenz  │ Status   │  │
│  ├──────────┼───────────┼───────────┼────────────┼──────────┤  │
│  │ Mo 05.05 │ 08:00–12  │ 08:02–12  │  − 2 Min   │ ✅ OK   │  │
│  │ Di 06.05 │ 09:00–13  │ 09:15–13  │ − 15 Min   │ ✅ OK   │  │
│  │ Mi 07.05 │ —         │ —         │ —          │ —       │  │
│  │ Do 08.05 │ 08:00–14  │ 08:03 …   │ laufend    │ 🟡 Aktiv│  │
│  │ Fr 09.05 │ 08:00–10  │ —         │ —          │ ⏳ Zukunft│ │
│  └──────────┴───────────┴───────────┴────────────┴──────────┘  │
│                                                                 │
│  Wochensumme Ist: 13,8 Std  |  Plan: 16,0 Std                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Eintrag nachträglich bearbeiten

Falls du das Einstempeln vergessen hast, kannst du Zeiten manuell nachtragen:

1. Klicke auf den betreffenden Tag in der Wochenübersicht
2. Wähle **„Zeit bearbeiten"**
3. Trage Start- und Endzeit manuell ein
4. Klicke **[Speichern]**

> **Hinweis:** Einträge können bis zu **7 Tage** rückwirkend bearbeitet werden (gemäß Bearbeitungsfrist). Ältere Einträge sind gesperrt und können nur vom Manager korrigiert werden. Manager-Korrekturen werden mit einem **„Bearbeitet"-Badge** markiert.

#### Sonderfälle

| Situation | Verhalten |
|-----------|-----------|
| Ausstempeln vergessen | App zeigt am nächsten Tag ein rotes Banner: „Eintrag vom [Datum] unvollständig" |
| Wochenendarbeit | Möglich, aber mit Hinweis „Wochenendarbeit" markiert |
| Abwesenheitstag | Einstempeln ist gesperrt — Abwesenheit hat Vorrang |

---

### 3.4 Abwesenheiten eintragen

Wenn du krank bist, Urlaub nimmst oder aus einem anderen Grund nicht arbeitest, trage eine Abwesenheit ein.

#### Abwesenheit erfassen

```
┌─────────────────────────────────────────────────────────────────┐
│  Abwesenheit eintragen                                          │
│                                                                 │
│  Datum:    [08.05.2026          ▼]                              │
│                                                                 │
│  Typ:      [Krank               ▼]                              │
│            ○ Krank                                              │
│            ○ Urlaub                                             │
│            ○ Frei (unbezahlt)                                   │
│            ○ Sonstiges                                          │
│                                                                 │
│  Notiz:    [Optionale Anmerkung        ]  (max. 100 Zeichen)   │
│                                                                 │
│  [Abbrechen]                        [Abwesenheit speichern]    │
└─────────────────────────────────────────────────────────────────┘
```

**Wichtige Regeln:**

| Regel | Details |
|-------|---------|
| Rückwirkend eintragen | Bis zu **7 Tage** in der Vergangenheit möglich |
| Zukünftige Tage | Jederzeit im Voraus eintragbar |
| Löschen | Möglich, solange der Tag in der Zukunft liegt oder innerhalb der Bearbeitungsfrist |
| Manager-Info | Dein Manager erhält automatisch eine **Benachrichtigung** |

> **Automatische Auswirkungen:** Ein abwesend markierter Tag sperrt automatisch die Wochenplanung und das Einstempeln für diesen Tag — du musst nichts manuell löschen.

#### Abwesenheit in der Wochenübersicht

Abwesenheitstage werden in der Wochenansicht farblich hervorgehoben:

```
┌──────────┬────────────────────────────────────────┐
│ Mo 05.05 │ 08:00–12:00   Büro Paderborn           │
│ Di 06.05 │ 🤒 KRANK                               │
│ Mi 07.05 │ —  Kein Arbeitstag                     │
│ Do 08.05 │ 08:00–14:00   Büro Paderborn           │
│ Fr 09.05 │ 🏖️ URLAUB                               │
└──────────┴────────────────────────────────────────┘
```

---

### 3.5 Team-Anwesenheitsübersicht

Unter **„Team-Anwesenheit"** siehst du in Echtzeit, wer heute wo arbeitet — ideal um Kollegen schnell zu finden.

```
┌─────────────────────────────────────────────────────────────────┐
│  Team-Anwesenheit  —  Donnerstag, 08.05.2026      [Live 🟢]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ICH                                                    │  │
│  │  Max Mustermann · Büro Paderborn · Platz 7              │  │
│  │  [Ort ändern ▼]                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  🏢 BÜRO PADERBORN  (3 Personen)                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ Anna Schmidt   │  │ Tom Berger     │  │ Lisa Müller    │   │
│  │ WRK            │  │ Platz 3        │  │ —              │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                 │
│  🏠 HOMEOFFICE  (1 Person)                                     │
│  ┌────────────────┐                                            │
│  │ Jonas Krause   │                                            │
│  │ —              │                                            │
│  └────────────────┘                                            │
│                                                                 │
│  🤒 KRANK  (1 Person)                                          │
│  ┌────────────────┐                                            │
│  │ Mia Fischer    │                                            │
│  └────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Eigenen Sub-Ort setzen:**

1. Klicke auf **[Ort ändern ▼]** in deiner „ICH"-Karte
2. Wähle deinen genauen Sub-Ort (z.B. „WRK", „LAB", „Platz 7")
3. Der Sub-Ort erscheint sofort für alle Teamkollegen (Live-Update)
4. Zum Zurücksetzen: **[Ort ändern ▼] → „Nicht angegeben"**

---

### 3.6 Profil & Personalnummer

Dein Profil erreichst du über das **Profilsymbol** oben rechts.

```
┌─────────────────────────────────────────────────────────────────┐
│  Mein Profil                                                    │
│                                                                 │
│  Name:           Max Mustermann                                 │
│  E-Mail:         max.mustermann@mindsquare.de                  │
│  Bereich:        IT-Consulting                                  │
│  Stundenlimit:   20 Std / Woche                                 │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  Personalnummer: [12345         ]                               │
│                                                                 │
│  ⚠️  Ohne Personalnummer kann der Stundenzettel-Export         │
│     nicht gestartet werden.                                     │
│                                                                 │
│  [Speichern]                                                   │
│                                                                 │
│  Bundesland (für Feiertage):  [Nordrhein-Westfalen   ▼]       │
└─────────────────────────────────────────────────────────────────┘
```

> **Wichtig:** Trage deine **Personalnummer** ein, bevor du deinen ersten Stundenzettel exportierst. Sie steht auf deinem Arbeitsvertrag oder in der Lohnabrechnung.

---

### 3.7 Stundenzettel exportieren

Am Ende jedes Monats musst du deinen Stundenzettel als Excel-Datei herunterladen und an deinen Manager schicken. Die Frist ist der **20. des Monats** (im Dezember der 18.).

#### Export starten

```
┌─────────────────────────────────────────────────────────────────┐
│  Stundenzettel exportieren                                      │
│                                                                 │
│  Monat auswählen:  [April 2026              ▼]                 │
│                    (Standard: aktueller Monat)                  │
│                                                                 │
│  Vorschau:                                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Vorlage zur Dokumentation der täglichen Arbeitszeit    │  │
│  │  Firma: mindsquare AG                                   │  │
│  │  Name:  Max Mustermann                                  │  │
│  │  Monat: 04/2026                                         │  │
│  │  Personalnummer: 12345                                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Dateiname: 2026-04_Mustermann_Max.xlsx                        │
│                                                                 │
│  [Abbrechen]                     [📥 Stundenzettel herunterladen]│
└─────────────────────────────────────────────────────────────────┘
```

**Schritt-für-Schritt:**

1. Klicke im Dashboard auf **„Stundenzettel exportieren"** oder navigiere zur Zeiterfassung
2. Wähle den **Monat** (Standard: aktueller Monat; bis zu 12 Monate zurück auswählbar)
3. Prüfe die Vorschau — Name und Personalnummer müssen korrekt sein
4. Klicke auf **[📥 Stundenzettel herunterladen]**
5. Die Datei wird automatisch mit dem korrekten Dateinamen gespeichert: `JJJJ-MM_Nachname_Vorname.xlsx`
6. Schicke die Datei per E-Mail an deinen Manager

> **Hinweis:** Der Export-Button ist deaktiviert, wenn deine **Personalnummer fehlt**. Ergänze sie zuerst im Profil.

---

## 4. Manager-Handbuch

### 4.1 Dashboard & Navigation

Als Manager landest du nach dem Login auf dem Manager-Dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│  mindsquare Werkstudentenverwaltung                    [Profil] │
├────────────────────────┬────────────────────────────────────────┤
│  MANAGER-NAVIGATION    │  MANAGER DASHBOARD                     │
│                        │                                        │
│ 📅 Kalenderansicht    │  Team: IT-Consulting (5 Werkstudenten) │
│ 📊 Deckungsübersicht  │                                        │
│ 📈 Auswertung         │  ┌──────────────┐  ┌────────────────┐ │
│ 👥 Team-Anwesenheit   │  │ HEUTE ANWES. │  │ NEUE BENACHR. │ │
│ ⚙️  Einstellungen      │  │ 3 von 5      │  │ 2 neue        │ │
│   • Arbeitsorte       │  │ Werkstudenten│  │ Abwesenheiten │ │
│   • Abwesenheitstypen │  └──────────────┘  └────────────────┘ │
│   • Nutzer            │                                        │
│                        │  ⚠️  1 Werkstudent ohne Personalnr.   │
└────────────────────────┴────────────────────────────────────────┘
```

---

### 4.2 Kalenderansicht

Die Kalenderansicht unter `/manager/kalender` zeigt alle deine Werkstudenten auf einen Blick.

#### Farbkodierung

```
┌────────────────────────────────────────────────────────────────┐
│  LEGENDE                                                       │
│  ████ Grau   = Nur Plan vorhanden (noch nicht erschienen)      │
│  ████ Grün   = Plan + Ist vorhanden (pünktlich erschienen)     │
│  ████ Orange = Nur Ist vorhanden (ungeplant erschienen)        │
│  ████ Rot    = Plan vorhanden, kein Ist (fehlt / abwesend)     │
└────────────────────────────────────────────────────────────────┘
```

#### Kalenderansicht

```
┌─────────────────────────────────────────────────────────────────┐
│  Kalenderansicht     [← Zurück]  KW 19 · 05.–09. Mai  [Weiter →]│
│                                                                 │
│  Filter: [Alle Werkstudenten ▼]                                │
│                                                                 │
│  ┌─────────────────┬───────┬───────┬──[HEUTE]──┬───────┬──────┤
│  │ Name            │ Mo 05 │ Di 06 │  Do 08    │ Do 08 │ Fr 09│
│  ├─────────────────┼───────┼───────┼───────────┼───────┼──────┤
│  │ Anna Schmidt    │ ████  │ ████  │  ████     │  ████ │ ████ │
│  │                 │ grün  │ grün  │  grün     │  grau │ —   │
│  ├─────────────────┼───────┼───────┼───────────┼───────┼──────┤
│  │ Tom Berger      │ ████  │ —     │  ████     │  rot  │ ████ │
│  │                 │ grün  │       │  grün     │ fehlt │ grau │
│  ├─────────────────┼───────┼───────┼───────────┼───────┼──────┤
│  │ Mia Fischer     │ ████  │ 🤒    │  🤒       │  🤒   │ ████ │
│  │                 │ grün  │ krank │  krank    │ krank │ grau │
│  └─────────────────┴───────┴───────┴───────────┴───────┴──────┘
└─────────────────────────────────────────────────────────────────┘
```

**Klick auf eine Zelle** öffnet die Detailansicht:

```
┌─────────────────────────────────────────────────┐
│  Tom Berger — Donnerstag, 08.05.2026            │
│                                                 │
│  Plan:  08:00 – 14:00   (6,0 Std)              │
│  Ist:   —               (nicht erschienen)     │
│                                                 │
│  Differenz:  − 6,0 Std                         │
│                                                 │
│  Arbeitsort (geplant): Büro Paderborn           │
│                                                 │
│  [Schließen]         [Zeiteintrag korrigieren]  │
└─────────────────────────────────────────────────┘
```

---

### 4.3 Deckungsübersicht

Die Deckungsübersicht unter `/manager/deckung` zeigt alle Werkstudenten in einem **Gantt-Zeitstrahl** — ideal um Lücken in der Tagesabdeckung zu erkennen.

#### Wochenansicht

```
┌─────────────────────────────────────────────────────────────────┐
│  Deckungsübersicht   [← Zurück]  KW 19  [Weiter →]  [Tab: Woche│Tag]│
│                                                                 │
│  08:00    10:00    12:00    14:00    16:00    18:00             │
│   │        │        │        │        │        │               │
│Mo │  [Anna 8–12]  [Tom 9–14]   [Jonas 10–16]  │               │
│   │  ████████████ █████████████████  ██████████│               │
│Di │  [Anna 8–12]         [Mia 12–17]           │               │
│   │  ████████████        ████████████          │               │
│Mi │                ▲ LÜCKE — niemand geplant    │               │
│   │                │                           │               │
│Do │  [Tom 8–14]  [Jonas 9–15]  [Lisa 11–17]   │               │
│   │  █████████████████████████ ███████████     │               │
│Fr │  [Anna 8–10]                               │               │
│   │  █████                                     │               │
│                                                                 │
│  LEGENDE: █ Anna  █ Tom  █ Jonas  █ Mia  █ Lisa               │
└─────────────────────────────────────────────────────────────────┘
```

#### Tagesansicht (Drill-Down)

Klicke auf eine Tageszeile, um zur 15-Minuten-Granularität zu wechseln:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tagesansicht — Montag, 05.05.2026  [← Di]  [Do →]             │
│                                                                 │
│  08:00  08:30  09:00  09:30  10:00  10:30  11:00  11:30  12:00 │
│   │      │      │      │      │      │      │      │      │     │
│  [Anna Sc. 08:00–12:00                                   ]     │
│  ████████████████████████████████████████████████████████      │
│           [Tom Berger 08:45–14:00                              ]│
│           ████████████████████████████████████████████████     │
│                     ▲ Jetzt (10:23 Uhr)                        │
│                                                                 │
│  Klick auf Block → Details: Tom Berger · 08:45–14:00 · 5,25 Std│
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Auswertung & Reporting

Die Auswertungsseite unter `/manager/auswertung` gibt dir einen monatlichen Überblick über Plan vs. Ist für alle deine Werkstudenten.

#### Zeitraumauswahl

```
┌─────────────────────────────────────────────────────────────────┐
│  [Aktueller Monat]  [Letzter Monat]  [Letzte 3 Monate]         │
│                                      [April 2026 ▼]            │
└─────────────────────────────────────────────────────────────────┘
```

#### Übersichtstabelle

```
┌─────────────────────────────────────────────────────────────────┐
│  Auswertung — Mai 2026                                          │
│                                                                 │
│ ┌────────────────┬──────────┬──────────┬──────────┬──────────┐ │
│ │ Name           │ Plan-Std │ Ist-Std  │ Diff     │ Auslast. │ │
│ ├────────────────┼──────────┼──────────┼──────────┼──────────┤ │
│ │ Anna Schmidt   │ 64,0 Std │ 61,5 Std │ − 2,5 h  │ 96,1 %  │ │
│ │ Tom Berger     │ 48,0 Std │ 52,0 Std │ + 4,0 h  │108,3 %  │ │
│ │ 🔴 Mia Fischer │ 32,0 Std │ 35,5 Std │ + 3,5 h  │110,9 %  │ │
│ │   Jonas Krause │  0,0 Std │  0,0 Std │  —       │  —      │ │
│ │ Lisa Müller    │ 56,0 Std │ 54,0 Std │ − 2,0 h  │ 96,4 %  │ │
│ └────────────────┴──────────┴──────────┴──────────┴──────────┘ │
│                                                                 │
│  🔴 = Stundenlimit in mind. einer Woche überschritten          │
└─────────────────────────────────────────────────────────────────┘
```

#### Detailansicht (Aufklappen)

Klicke auf einen Werkstudenten, um die tagesgenaue Auflistung zu sehen:

```
▼ Mia Fischer  —  Mai 2026

┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Tag      │ Plan Von │ Plan Bis │ Ist Von  │ Ist Bis  │ Differenz│
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Mo 05.05 │ 08:00    │ 12:00    │ 08:05    │ 12:10    │ + 15 Min │
│ Di 06.05 │ —        │ —        │ 09:00    │ 13:00    │🟠Ungeplant│
│ Mi 07.05 │ —        │ —        │ —        │ —        │ —        │
│ Do 08.05 │ 08:00    │ 16:00    │ 08:00    │ 17:30    │ +1,5 Std │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

### 4.5 Manager-Zeitkorrektur

Als Manager kannst du fehlerhafte Zeiteinträge deiner Werkstudenten direkt in der Auswertungsansicht korrigieren.

#### Eintrag bearbeiten

```
┌─────────────────────────────────────────────────────────────────┐
│  Zeiteintrag bearbeiten                                         │
│  Tom Berger — Donnerstag, 08.05.2026                            │
│                                                                 │
│  Startzeit:  [08:00  ▼]  (Viertelstunden-Genauigkeit)          │
│  Endzeit:    [14:15  ▼]                                        │
│                                                                 │
│  Begründung: [Ausstempelzeit aus Kalender nachgetragen   ]     │
│              (Pflichtfeld, max. 200 Zeichen)                    │
│                                                                 │
│  [Abbrechen]                              [Änderungen speichern]│
└─────────────────────────────────────────────────────────────────┘
```

#### Neuen Eintrag hinzufügen

Unterhalb der Tageseinträge findest du **[+ Eintrag hinzufügen]** — damit kannst du vergessene Einstempelungen nachtragen.

#### Eintrag löschen

Klicke auf das 🗑️-Symbol neben einem Eintrag. Ein Bestätigungsdialog erscheint — du musst eine **Begründung** eingeben.

> **Wichtig:** Einträge mit Status **„Genehmigt"** können nicht mehr bearbeitet werden. Die Icons werden grau angezeigt.

**Werkstudenten-Sicht:** Korrigierte Einträge werden beim Werkstudenten mit einem **„Bearbeitet"-Badge** markiert. Bei Hover sieht der Werkstudent deine Begründung.

---

### 4.6 Arbeitsorte verwalten

Unter **Einstellungen → Arbeitsorte** pflegst du die Liste der verfügbaren Arbeitsorte für deine Werkstudenten.

```
┌─────────────────────────────────────────────────────────────────┐
│  Arbeitsorte verwalten                                          │
│                                                                 │
│  ┌────────────────────────────────┬──────────┬───────────────┐ │
│  │ Name                           │ Status   │ Aktionen      │ │
│  ├────────────────────────────────┼──────────┼───────────────┤ │
│  │ Büro Paderborn                 │ ✅ Aktiv  │ [✏️] [🗑️]   │ │
│  │ Homeoffice                     │ ✅ Aktiv  │ [✏️] [🗑️]   │ │
│  │ Kunde TKSE                     │ ✅ Aktiv  │ [✏️] [🗑️]   │ │
│  │ Büro Gütersloh (alt)           │ ⛔ Inaktiv│ [✏️] [✅Reaktiv│ │
│  └────────────────────────────────┴──────────┴───────────────┘ │
│                                                                 │
│  [+ Neuen Arbeitsort hinzufügen]                               │
└─────────────────────────────────────────────────────────────────┘
```

> **Inaktive Arbeitsorte** sind für Werkstudenten nicht mehr auswählbar, bleiben aber in historischen Einträgen sichtbar (kein Datenverlust).

**Sub-Locations:** Für jeden Arbeitsort kannst du Sub-Locations konfigurieren (z.B. „WRK", „LAB", „Platz 1–10" für „Büro Paderborn"), die Werkstudenten dann in der Team-Anwesenheitsübersicht setzen können.

---

### 4.7 Abwesenheitstypen konfigurieren

Du kannst die globale Liste der Abwesenheitstypen für deinen Bereich anpassen.

```
┌─────────────────────────────────────────────────────────────────┐
│  Abwesenheitstypen — Bereich: IT-Consulting                     │
│                                                                 │
│  Globale Typen (von Admin):          Für meinen Bereich:       │
│  ┌──────────────────────────────┐   ┌────────────────────────┐ │
│  │ ✅ Krank                     │   │ ✅ Krank               │ │
│  │ ✅ Urlaub                    │   │ ✅ Urlaub              │ │
│  │ ✅ Frei (unbezahlt)          │   │ ⛔ Frei (deaktiviert)  │ │
│  │ ✅ Sonstiges                 │   │ ✅ Sonstiges           │ │
│  └──────────────────────────────┘   │ ✅ Fortbildung (eigen) │ │
│                                     └────────────────────────┘ │
│                                                                 │
│  [+ Eigenen Typ hinzufügen]    [Auf Standard zurücksetzen]     │
└─────────────────────────────────────────────────────────────────┘
```

> **Hinweis:** Sobald du eine Anpassung machst, erbt dein Bereich die globale Liste nicht mehr automatisch. Neue globale Typen werden dir als Hinweis angezeigt: _„Neuer globaler Typ verfügbar — übernehmen?"_

---

### 4.8 Stundenzettel-Export für Werkstudenten

Als Manager kannst du den Stundenzettel eines Werkstudenten selbst exportieren — z.B. um ihn vor der Weitergabe an payroll@mindsquare.de zu prüfen.

```
┌─────────────────────────────────────────────────────────────────┐
│  Stundenzettel-Export — Team                                    │
│                                                                 │
│  Monat: [April 2026 ▼]                                         │
│                                                                 │
│  ┌─────────────────┬──────────────────┬────────────────────┐   │
│  │ Name            │ Personalnummer   │ Export             │   │
│  ├─────────────────┼──────────────────┼────────────────────┤   │
│  │ Anna Schmidt    │ 12345            │ [📥 Exportieren]   │   │
│  │ Tom Berger      │ 67890            │ [📥 Exportieren]   │   │
│  │ ⚠️ Mia Fischer  │ fehlt!           │ [Gesperrt]         │   │
│  │ Jonas Krause    │ 11223            │ [📥 Exportieren]   │   │
│  └─────────────────┴──────────────────┴────────────────────┘   │
│                                                                 │
│  ⚠️ = Personalnummer fehlt — Werkstudent informieren!          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Admin-Handbuch

Als Admin verwaltest du die organisatorische Struktur der Anwendung. Du hast Zugriff auf den Admin-Bereich unter `/admin`.

> **Admin-Erkennung:** Du wirst automatisch als Admin erkannt, wenn du Mitglied der konfigurierten Azure AD Entra-Gruppe bist. Es ist keine manuelle Zuweisung nötig.

### 5.1 Bereichsverwaltung

```
┌─────────────────────────────────────────────────────────────────┐
│  Bereichsverwaltung                                             │
│                                                                 │
│  ┌──────────────────┬───────────┬──────────────┬────────────┐  │
│  │ Bereichsname     │ Manager   │ Werkstudenten│ Aktionen   │  │
│  ├──────────────────┼───────────┼──────────────┼────────────┤  │
│  │ IT-Consulting    │ 2         │ 5            │ [✏️] [🗑️]  │  │
│  │ SAP-Beratung     │ 1         │ 3            │ [✏️] [🗑️]  │  │
│  │ Standard         │ 0         │ 0            │ [✏️] [🗑️]  │  │
│  └──────────────────┴───────────┴──────────────┴────────────┘  │
│                                                                 │
│  [+ Neuen Bereich erstellen]                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Bereich erstellen:**

1. Klicke auf **[+ Neuen Bereich erstellen]**
2. Gib einen eindeutigen Namen ein (1–100 Zeichen)
3. Klicke **[Erstellen]**

**Manager einem Bereich zuordnen:**

1. Klicke auf einen Bereich → **[Bereich bearbeiten]**
2. Unter „Manager" → **[Manager hinzufügen]** → Person aus der Liste wählen
3. Du kannst dich selbst als Manager zuordnen

**Bereich löschen:**

- Nur möglich, wenn **keine Werkstudenten** mehr zugeordnet sind
- Bei Fehler: Werkstudenten zuerst einem anderen Bereich zuordnen

---

### 5.2 Nutzerverwaltung

```
┌─────────────────────────────────────────────────────────────────┐
│  Nutzerverwaltung                                               │
│                                                                 │
│  [Suche: Name oder E-Mail...        ]  [Rolle: Alle ▼]         │
│                                                                 │
│  ┌─────────────────┬────────────┬──────────────┬─────────────┐ │
│  │ Name            │ Rolle      │ Bereich      │ Aktionen    │ │
│  ├─────────────────┼────────────┼──────────────┼─────────────┤ │
│  │ Anna Schmidt    │ Werkstudent│ IT-Consulting│ [✏️ Bearb.] │ │
│  │ Mark Weber      │ Manager    │ IT-Consulting│ [✏️ Bearb.] │ │
│  │ Kira Bauer      │ Ausstehend │ —            │ [✏️ Bearb.] │ │
│  └─────────────────┴────────────┴──────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Nutzer bearbeiten:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Nutzer bearbeiten: Kira Bauer                                  │
│                                                                 │
│  Rolle:    [Werkstudent    ▼]                                   │
│            ○ Werkstudent                                        │
│            ○ Manager                                            │
│            ○ Deaktiviert                                        │
│                                                                 │
│  Bereich:  [IT-Consulting  ▼]                                   │
│                                                                 │
│  Stundenlimit: [20  ] Std / Woche                               │
│                                                                 │
│  [Abbrechen]                           [Speichern]             │
└─────────────────────────────────────────────────────────────────┘
```

> **Neuer Nutzer:** Wenn sich jemand erstmals einloggt, erscheint er mit Rolle „Ausstehend". Der Admin oder Manager muss die Rolle und den Bereich zuweisen.

---

### 5.3 Globale Abwesenheitstypen

Unter `/admin/abwesenheitstypen` pflegst du die unternehmensweite Standard-Liste.

```
┌─────────────────────────────────────────────────────────────────┐
│  Globale Abwesenheitstypen                                      │
│                                                                 │
│  ┌────────────────────┬──────────┬─────────────────────────┐   │
│  │ Name               │ Status   │ Bereiche mit eigener    │   │
│  │                    │          │ Konfiguration           │   │
│  ├────────────────────┼──────────┼─────────────────────────┤   │
│  │ 🤒 Krank           │ ✅ Aktiv  │ —                      │   │
│  │ 🏖️ Urlaub          │ ✅ Aktiv  │ IT-Consulting           │   │
│  │ 💰 Frei (unbez.)   │ ✅ Aktiv  │ —                      │   │
│  │ 📝 Sonstiges       │ ✅ Aktiv  │ —                      │   │
│  └────────────────────┴──────────┴─────────────────────────┘   │
│                                                                 │
│  [+ Neuen globalen Typ anlegen]                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Achtung:** Bereiche, die ihre eigene Konfiguration haben, erben Änderungen an der globalen Liste **nicht automatisch**. Sie erhalten aber einen Hinweis in ihren Einstellungen.

---

## 6. Häufige Fragen (FAQ)

### Werkstudenten

**F: Ich habe das Einstempeln vergessen. Was tun?**
> Öffne die Zeiterfassung und trage Start- und Endzeit manuell nach. Das ist bis zu **7 Tage** rückwirkend möglich. Danach muss dein Manager die Zeit korrigieren.

**F: Warum kann ich meinen Stundenzettel nicht exportieren?**
> Der Export ist gesperrt, wenn deine **Personalnummer** fehlt. Gehe zu Profil → Personalnummer eintragen → Speichern.

**F: Ich habe mehr als 20 Stunden geplant — wird das blockiert?**
> Nein, du erhältst eine **Warnung**, kannst aber trotzdem speichern. Bitte sprich mit deinem Manager, wenn du eine Ausnahme benötigst.

**F: Kann ich Abwesenheiten für vergangene Wochen nachtragen?**
> Ja, bis zu **7 Tage** rückwirkend. Ältere Abwesenheiten müssen durch den Manager eingetragen werden.

**F: Was passiert, wenn ich den Arbeitsort nicht angebe?**
> Die Wochenplanung kann nicht gespeichert werden, solange kein Arbeitsort ausgewählt ist — es ist ein Pflichtfeld.

**F: Mein Eintrag hat ein „Bearbeitet"-Badge — was bedeutet das?**
> Dein Manager hat einen deiner Zeiteinträge korrigiert. Bewege die Maus über das Badge, um die Begründung zu sehen.

---

### Manager

**F: Ein Werkstudent erscheint nicht in meiner Kalenderansicht.**
> Der Werkstudent ist möglicherweise keinem Bereich zugeordnet oder einem anderen Bereich. Prüfe in der Nutzerverwaltung die Bereichszuordnung.

**F: Ich sehe rote Zellen im Kalender — was muss ich tun?**
> Rote Zellen bedeuten: Werkstudent war geplant, aber **nicht erschienen**. Prüfe, ob eine Abwesenheit nachgetragen werden muss oder ob ein Fehler bei der Zeiterfassung vorliegt. Du kannst die Zeit als Manager korrigieren.

**F: Wo finde ich die Personalnummern meiner Werkstudenten?**
> In der Auswertung siehst du ein ⚠️-Symbol bei Werkstudenten ohne Personalnummer. Bitte sie, diese im Profil zu hinterlegen.

**F: Kann ich Abwesenheiten meiner Werkstudenten selbst eintragen?**
> Ja, über die Kalenderansicht → Klick auf eine Zelle → „Abwesenheit eintragen". Für Korrekturen älterer Abwesenheiten steht dir die Auswertungsansicht zur Verfügung.

**F: Wie erhalte ich Benachrichtigungen über Abwesenheiten?**
> Du erhältst automatisch eine **In-App-Benachrichtigung**, sobald ein Werkstudent eine neue Abwesenheit einträgt. Die Anzahl ungelesener Nachrichten wird in der Navigation angezeigt.

---

### Admin

**F: Wie wird ein neuer Nutzer zum Admin?**
> Admin-Rechte werden automatisch über die **Azure AD Entra-Gruppe** vergeben. Füge die Person in Azure AD zur konfigurierten Gruppe hinzu — beim nächsten Login wird `is_admin = true` gesetzt.

**F: Ich kann einen Bereich nicht löschen.**
> Einem Bereich zugeordnete Werkstudenten müssen zuerst in einen anderen Bereich verschoben werden. Danach ist das Löschen möglich.

**F: Was passiert mit den Daten, wenn ich einen Arbeitsort deaktiviere?**
> Historische Einträge behalten den Ortsnamen (kein Datenverlust). Der Ort ist lediglich für neue Planungseinträge **nicht mehr auswählbar**.

---

## 7. Glossar

| Begriff | Erklärung |
|---------|-----------|
| **Plan-Stunden** | Vom Werkstudenten in der Wochenplanung eingetragene Soll-Zeiten |
| **Ist-Stunden** | Tatsächlich geleistete Stunden (durch Ein-/Ausstempeln erfasst) |
| **Netto-Stunden** | Ist-Stunden abzüglich Pausenzeiten |
| **Deckung** | Zeitlicher Überlapp der Anwesenheiten aller Werkstudenten |
| **Bereich** | Organisationseinheit (z.B. „IT-Consulting"); ein Manager betreut einen oder mehrere Bereiche |
| **Bearbeitungsfrist** | Zeitraum, innerhalb dem Zeiteinträge noch selbst bearbeitet werden können (7 Tage) |
| **RLS** | Row Level Security — jeder Nutzer sieht nur die Daten, für die er berechtigt ist |
| **Soft-Delete** | Deaktivierung ohne Datenlöschung; historische Daten bleiben erhalten |
| **KW** | Kalenderwoche (ISO-Standard: Montag = erster Tag) |
| **Sub-Location** | Genauer Aufenthaltsort innerhalb eines Arbeitsorts (z.B. Raum WRK im Büro) |
| **Entra-Gruppe** | Azure Active Directory Gruppe, die Admin-Rechte in der App steuert |
| **HR-Vorlage** | Offizielle mindsquare Excel-Vorlage für die monatliche Stundenabrechnung |
| **Personalnummer** | Eindeutige Mitarbeiternummer für die Lohnbuchhaltung (steht im Arbeitsvertrag) |

---

*Erstellt: Mai 2026 | mindsquare AG | Werkstudentenverwaltung v1.0*

*Bei Fragen oder Fehlern wende dich an deinen Manager oder Admin.*
