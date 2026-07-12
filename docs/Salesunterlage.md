# Werkstudentenverwaltung — Salesunterlage

---

## Folie 1: Titel

**Werkstudentenverwaltung**
*Digitale Arbeitszeitverwaltung für Werkstudenten — einfach, transparent, compliant.*

Entwickelt von mindsquare | Web-App | Azure AD · Next.js · Supabase

---

## Folie 2: Die Ausgangssituation — Was heute schief läuft

### Schmerzen bei Werkstudenten
- Manuelle Stundenzettel per Excel oder Papier
- Keine Übersicht über verbrauchte vs. verbleibende Stunden
- Zeiterfassung wird vergessen oder nachgetragen

### Schmerzen bei Managern
- Keine zentrale Übersicht über Verfügbarkeit des Teams
- Abweichungen zwischen Planung und Realität schwer nachvollziehbar
- Export für die Lohnbuchhaltung kostet stundenlange Handarbeit

### Schmerzen bei HR / Admins
- Organisationsstruktur manuell gepflegt
- Keine Datenisolation zwischen Bereichen / Teams

---

## Folie 3: Die Lösung

**Eine zentrale Web-App, die Werkstudenten-Zeitverwaltung vollständig digitalisiert.**

- Werkstudenten planen und stempeln direkt im Browser
- Manager sehen Anwesenheiten, Abweichungen und Deckung in Echtzeit
- HR exportiert fertige Stundenzettel per Klick — kein Excel-Aufwand mehr
- Vollständig integriert in die bestehende Azure AD-Infrastruktur — kein separates Login

---

## Folie 4: Key Features — Überblick

| Bereich | Features |
|---|---|
| **Planung & Zeiterfassung** | Wochenplanung, Tages-Zeiterfassung, Mehrere Zeitblöcke, Pausenerfassung |
| **Manager-Tools** | Kalenderansicht, Deckungsübersicht, Zeitkorrektur, Benachrichtigungen |
| **Auswertung & Export** | Stundenzettel-Export (HR-Vorlage), Auswertungsansichten |
| **Compliance & Governance** | Bearbeitungsfristen, Sperren vergangener Tage, 20h-Grenze §20 SGB IV |
| **Organisation** | Bereichsverwaltung, Rollen (Admin / Manager / Werkstudent), Datenisolation |
| **Integration** | Azure AD SSO, Bundesland-Feiertagskalender |

---

## Folie 5: Key Feature — Wochenplanung & Zeiterfassung

### Was es tut
Werkstudenten planen ihre Anwesenheitszeiten für die Woche voraus (Viertelstunden-Genauigkeit) und erfassen täglich ihre tatsächlich geleisteten Stunden — inklusive mehrerer Zeitblöcke pro Tag und Pausenerfassung.

### Mehrwert für den Kunden
- **Transparenz**: Manager sehen vorab, wer wann verfügbar ist
- **Accountability**: Geplante vs. tatsächliche Stunden immer im Vergleich
- **Compliance**: Vergangenheit kann nicht nachträglich manipuliert werden (Sperre + Bearbeitungsfrist)
- **Genauigkeit**: Viertelstunden-Raster verhindert Rundungsfehler

---

## Folie 6: Key Feature — Manager-Kalenderansicht & Deckungsübersicht

### Was es tut
Manager sehen alle Werkstudenten ihres Bereichs in einer Kalenderansicht. Die Deckungsübersicht zeigt auf einen Blick, zu welchen Zeiten das Team gut oder schlecht besetzt ist — Plan vs. Ist im direkten Vergleich.

### Mehrwert für den Kunden
- **Kein manuelles Nachfragen mehr**: Verfügbarkeit immer aktuell sichtbar
- **Engpässe früh erkennen**: Unterdeckung wird visuell hervorgehoben
- **Zeitkorrektur möglich**: Manager können fehlerhafte Einträge direkt korrigieren
- **Benachrichtigungen**: Änderungen durch Werkstudenten werden dem Manager automatisch gemeldet

---

## Folie 7: Key Feature — Excel-Stundenzettel-Export (HR-Vorlage)

### Was es tut
Mit einem Klick wird ein fertiger Stundenzettel im HR-konformen Excel-Format exportiert — pro Werkstudent, pro Monat, direkt verwendbar für die Lohnbuchhaltung.

### Mehrwert für den Kunden
- **Zeitersparnis**: Mindestens 2 Stunden pro Manager und Monat
- **Fehlerfreiheit**: Kein manuelles Übertragen, keine Tippfehler
- **Compliance**: Export entspricht der internen HR-Vorlage
- **Sofort einsatzbereit**: Kein Nachbearbeiten notwendig

---

## Folie 8: Key Feature — Abwesenheitsverwaltung & Arbeitsort

### Was es tut
Werkstudenten können Abwesenheiten (Urlaub, Krankheit etc.) eintragen. Jeder Zeitblock kann mit einem Arbeitsort versehen werden (Büro, Remote, etc.). Abwesenheitsarten sind pro Bereich aktivierbar oder deaktivierbar.

### Mehrwert für den Kunden
- **Vollständiges Bild**: Nicht nur Stunden, sondern auch Abwesenheiten und Ort sichtbar
- **Flexibilität**: Unternehmen konfiguriert, welche Abwesenheitsarten je Team relevant sind
- **Homeoffice-Tracking**: Arbeitsort gibt HR und Management Transparenz über Remote-Anteile

---

## Folie 9: Key Feature — Rollen, Bereiche & Datenisolation

### Was es tut
Die App kennt drei Rollen: **Globaler Admin**, **Manager**, **Werkstudent**. Admins strukturieren die Organisation in Bereiche und weisen Manager zu. Manager sehen ausschließlich die Daten ihres Bereichs — andere Bereiche sind vollständig isoliert.

### Mehrwert für den Kunden
- **Skalierbar**: Beliebig viele Bereiche / Teams abbildbar
- **DSGVO-freundlich**: Datenisolation verhindert unberechtigte Zugriffe
- **Selbstverwaltung**: Admins pflegen die Struktur ohne IT-Ticket
- **Delegierbar**: Ein Admin kann gleichzeitig Manager für seinen eigenen Bereich sein

---

## Folie 10: Key Feature — Azure AD SSO-Integration

### Was es tut
Werkstudenten und Manager melden sich mit ihrem bestehenden Unternehmensaccount (Microsoft/Azure AD) an — kein separates Konto, kein neues Passwort.

### Mehrwert für den Kunden
- **Zero Onboarding-Aufwand**: Nutzer sind sofort dabei, kein Account-Management
- **IT-Security-konform**: Single Sign-On über die bestehende Identity-Infrastruktur
- **Automatische Deaktivierung**: Scheidet ein Werkstudent aus, erlischt der Zugang automatisch mit dem AD-Account
- **Akzeptanz**: Bekannter Login-Flow erhöht die Nutzungsrate

---

## Folie 11: Zielgruppen & deren Nutzen

### Werkstudenten
> "Ich sehe immer, wie viele Stunden ich noch habe — und ich muss nie wieder Excel anfassen."

- Schnelles Einstempeln per Web-App
- Wochenübersicht mit Plan vs. Ist
- Optional: Stimmungs-Emoji beim Einstempeln

### Manager / Vorgesetzte
> "Ich sehe auf einen Blick, wer heute da ist, wer fehlt und wo Engpässe entstehen."

- Kalender- und Deckungsübersicht
- Korrekturfunktion für Fehlerfälle
- Automatische Benachrichtigungen bei Änderungen

### HR / Lohnbuchhaltung
> "Der Stundenzettel-Export macht mir den ersten Montag des Monats wieder erträglich."

- Fertiger Excel-Export in HR-Vorlage
- Kein Handarbeit, keine Fehler

### Globale Admins
> "Ich verwalte die Struktur selbst — ohne IT."

- Bereiche anlegen und Manager zuweisen
- Vollständiger Überblick über alle Daten

---

## Folie 12: Technologie & Sicherheit

| Eigenschaft | Detail |
|---|---|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **Datenbank** | Supabase (PostgreSQL, Row-Level Security) |
| **Hosting** | Vercel (EU-Region möglich) |
| **Auth** | Azure AD / Microsoft Entra ID (OAuth 2.0) |
| **Responsiv** | Vollständig responsive, keine separate Mobile App nötig |
| **Datenschutz** | Row-Level Security: Jeder sieht nur seine eigenen Daten |
| **Export** | Excel (.xlsx), kompatibel mit HR-Vorlagen |

---

## Folie 13: Compliance & Rechtssicherheit

- **§ 20 SGB IV**: Werkstudenten dürfen max. 20h/Woche arbeiten — die App macht Überschreitungen sofort sichtbar
- **Manipulationsschutz**: Vergangene Tage können nach konfigurierbarer Frist nicht mehr bearbeitet werden
- **Audit Trail**: Alle Zeitbuchungen sind nachvollziehbar gespeichert
- **Datenisolation**: Manager sehen nur ihren eigenen Bereich (DSGVO-relevant)

---

## Folie 14: Erfolgsmessung — Was der Kunde gewinnt

| Kennzahl | Vorher | Nachher |
|---|---|---|
| Stundenzettel-Aufwand pro Monat | ~2–4h pro Manager | < 5 Minuten |
| Transparenz über Anwesenheiten | Manuell, verzögert | Echtzeit |
| Fehler bei Zeiterfassung | Häufig (manuell) | Minimal (digitaler Workflow) |
| Compliance-Sicherheit | Manuell prüfen | Automatisch sichtbar |
| Onboarding neuer Werkstudenten | Account anlegen + einweisen | SSO — sofort einsatzbereit |

---

## Folie 15: Fazit & Next Steps

### Werkstudentenverwaltung — kurz zusammengefasst

- **Digitalisiert** den gesamten Prozess von Planung bis Lohnbuchhaltungs-Export
- **Integriert** in bestehende Azure AD / Microsoft-Infrastruktur
- **Skaliert** von einem Team auf beliebig viele Bereiche
- **Compliant** mit §20 SGB IV und DSGVO-Anforderungen
- **Spart** nachweislich Zeit bei Managern und HR

### Mögliche nächste Schritte
1. Live-Demo der Anwendung vereinbaren
2. Pilotbereich / Team für Testbetrieb definieren
3. Azure AD-Mandant für SSO-Integration vorbereiten
4. Go-Live planen

---

*Erstellt: Mai 2026 | mindsquare AG | Kontakt: lambertz@mindsquare.de*
