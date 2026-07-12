# Style Guide — Werkstudentenverwaltung

> Dieses Dokument beschreibt das vollständige Design-System der App.
> Eine neue Claude-Session kann es einlesen und damit sofort konsistente UI erzeugen.

## Setup: Zu kopierende Dateien

```
src/app/globals.css                     ← CSS-Variablen (shadcn Token-System)
tailwind.config.ts                      ← Tailwind-Erweiterungen
components.json                         ← shadcn/ui Konfiguration
src/lib/utils.ts                        ← cn() Helper
public/logo-mindsquare-176x781.webp     ← mindsquare-Logo
```

## Tech-Stack

| Paket | Version |
|-------|---------|
| Next.js (App Router) | ^16.1.1 |
| React | ^19.0.0 |
| Tailwind CSS | ^3.4.1 |
| shadcn/ui | style: "default", baseColor: slate |
| lucide-react | ^0.562.0 |
| class-variance-authority | ^0.7.1 |
| clsx + tailwind-merge | ^2.1.0 / ^2.2.0 |
| Formulare | zod + react-hook-form |
| Toasts | sonner (`<Toaster richColors />` im Root-Layout) |

**Font:** kein `next/font` — Browser-Systemfont, `antialiased` auf `<body>`.

---

## CSS-Variablen (globals.css — Light Mode)

```css
--background: 0 0% 100%;           /* Weiß */
--foreground: 240 10% 3.9%;        /* Fast-Schwarz */
--card: 0 0% 100%;
--card-foreground: 240 10% 3.9%;
--primary: 240 5.9% 10%;           /* Dunkles Slate — Buttons, aktive El. */
--primary-foreground: 0 0% 98%;
--secondary: 240 4.8% 95.9%;
--secondary-foreground: 240 5.9% 10%;
--muted: 240 4.8% 95.9%;
--muted-foreground: 240 3.8% 46.1%;
--accent: 240 4.8% 95.9%;
--accent-foreground: 240 5.9% 10%;
--destructive: 0 84.2% 60.2%;
--destructive-foreground: 0 0% 98%;
--border: 240 5.9% 90%;
--input: 240 5.9% 90%;
--ring: 240 5.9% 10%;
--radius: 0.5rem;
```

---

## Semantic-Farben (Tailwind-Klassen)

| Zweck | Tailwind-Klassen |
|-------|-----------------|
| App-Hintergrund | `bg-slate-50` |
| Karte / Panel | `bg-white border border-slate-200 rounded-lg shadow-sm` |
| Seitenüberschrift | `text-2xl font-bold text-slate-900` |
| Seitenuntertitel | `text-slate-500 mt-1 text-sm` |
| Abschnittsüberschrift | `text-lg font-semibold text-slate-900` |
| Fließtext | `text-sm text-slate-700` |
| Deaktiviert / Platzhalter | `text-slate-400` |
| Tabellen-Header | `bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide` |
| Positive Werte (Diff, Stunden) | `text-emerald-600` |
| Negative Werte | `text-red-600` |
| Warnwerte | `text-orange-600` |
| Info-Banner | `bg-amber-50 border border-amber-300 text-amber-800` |
| Fehler-Banner | `bg-red-50 border border-red-200 text-red-700` |
| Erfolgs-Banner | `bg-green-50 border border-green-200 text-green-700` |
| Aktive Nav-Linie | `text-slate-900 border-b-2 border-blue-600` |
| Inaktive Nav-Linie | `text-slate-500 border-b-2 border-transparent hover:text-slate-700 hover:border-slate-300` |

---

## Rollen-Badges (Header, oben rechts)

```tsx
// Werkstudent
<span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
  Werkstudent
</span>

// Manager
<span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
  Manager
</span>

// Admin
<span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
  Admin
</span>
```

---

## Layout-Skelett (jede Seite)

```tsx
<div className="min-h-screen bg-slate-50">
  {/* Header */}
  <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
    <div className="flex items-center gap-3">
      <Image src="/logo-mindsquare-176x781.webp" alt="mindsquare" width={90} height={40} />
      <span className="text-slate-300">|</span>
      <span className="text-slate-600 text-sm font-medium">Werkstudentenverwaltung</span>
    </div>
    <div className="flex items-center gap-3">
      {/* Rollen-Badge + Abmelden-Button */}
    </div>
  </header>

  {/* Navigation */}
  <nav className="bg-white border-b border-slate-200 px-6">
    <div className="flex gap-1">
      <Link className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
        text-slate-900 border-blue-600">          {/* aktiv */}
        Seite
      </Link>
      <Link className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 border-transparent
        text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"> {/* inaktiv */}
        Seite
      </Link>
    </div>
  </nav>

  {/* Seiteninhalt */}
  <main className="max-w-5xl mx-auto px-6 py-8">   {/* oder max-w-6xl py-10 für Manager */}
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">Seitentitel</h1>
      <p className="text-slate-500 mt-1 text-sm">Untertitel / Beschreibung</p>
    </div>
    {/* Inhalt */}
  </main>
</div>
```

**Max-Width-Konventionen:**
- Werkstudenten-Seiten: `max-w-5xl mx-auto px-6 py-8`
- Manager-Seiten: `max-w-6xl mx-auto px-6 py-10`

---

## Karten / Panels

```tsx
{/* Standard-Karte */}
<div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
  ...
</div>

{/* Karte mit Warn-Zustand */}
<Card className="border-amber-200 bg-amber-50 shadow-sm">
  ...
</Card>

{/* Tabellen-Container */}
<div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
  <table className="w-full">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Spalte
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 text-sm text-slate-700">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Dialoge / Modals

Immer shadcn `Dialog`. Breite je nach Inhalt `sm:max-w-sm` bis `sm:max-w-lg`.

```tsx
<Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Titel</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-2">
      {/* Formularfelder */}
    </div>

    <DialogFooter className="gap-2">
      <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
      <Button onClick={handleSave}>Speichern</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Formulare (Felder-Muster)

```tsx
{/* Einfaches Label + Input */}
<div className="space-y-2">
  <Label htmlFor="field-id">Feldname</Label>
  <Input id="field-id" value={value} onChange={(e) => setValue(e.target.value)} />
</div>

{/* Pflichtfeld-Label */}
<Label>Begründung <span className="text-red-500">*</span></Label>

{/* Zwei Felder nebeneinander */}
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">...</div>
  <div className="space-y-2">...</div>
</div>

{/* Hinweis-Text unter Feldern */}
<p className="text-xs text-slate-400">Hinweistext</p>
```

---

## Installierte shadcn/ui Komponenten

```bash
npx shadcn@latest add \
  accordion alert alert-dialog avatar badge breadcrumb \
  button card checkbox collapsible command dialog dropdown-menu \
  form input label navigation-menu pagination popover progress \
  radio-group scroll-area select separator sheet sidebar skeleton \
  sonner switch table tabs textarea toast tooltip \
  --yes
```

---

## Icons

Ausschließlich `lucide-react`. Häufig verwendete Icons in dieser App:

```tsx
import {
  ChevronRight, ChevronDown, ChevronLeft,
  Pencil, Trash2, Plus, Check, X,
  Download, FileSpreadsheet,
  AlertCircle, TriangleAlert, Info,
  Loader2,                              // Ladeanimation: className="animate-spin"
  LogOut, Settings, User,
} from 'lucide-react'

// Standard-Größen
<Icon className="h-4 w-4" />           // normal
<Icon className="h-3.5 h-3.5" />       // in engen Buttons
<Icon className="h-5 w-5" />           // hervorgehoben
```

---

## Button-Muster

```tsx
{/* Primary (Speichern, Bestätigen) */}
<Button onClick={handleSave}>Speichern</Button>

{/* Sekundär / Abbrechen */}
<Button variant="outline" onClick={onClose}>Abbrechen</Button>

{/* Destruktiv */}
<Button variant="destructive">Löschen</Button>

{/* Icon-Button in Tabellen */}
<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
  <Pencil className="w-3.5 h-3.5" />
</Button>

{/* Mit Lade-Spinner */}
<Button disabled={loading}>
  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
  Speichern
</Button>

{/* Mit Icon links */}
<Button variant="outline" size="sm" className="gap-2">
  <FileSpreadsheet className="h-4 w-4" />
  Exportieren
</Button>
```

---

## Konventionen

- **Kein custom CSS** — ausschließlich Tailwind-Klassen
- **shadcn-Komponenten nie neu bauen** — immer aus `@/components/ui/` importieren
- **Rohe `<table>`-Tags** für interaktive, komplexe Tabellen (shadcn `Table` nur für einfache)
- **Kein Inline-Style** — Ausnahme: dynamische Farben (z. B. Abwesenheitsfarben aus der DB)
- **`cn()` aus `@/lib/utils`** für bedingte Klassen-Komposition
- **`sonner` toast** mit `toast.success()`, `toast.error()` — kein eigener Toast-State
- **`fullPage: true`** bei Playwright-Screenshots
