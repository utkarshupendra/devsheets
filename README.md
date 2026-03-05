# DevSheets

A developer-friendly alternative to Excel — built for data analysis, not accounting.

![Dark Mode](https://img.shields.io/badge/theme-dark%20%26%20light-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## Why DevSheets?

Excel's sort, filter, and pivot features hide state and are hard to compose. DevSheets makes every data transformation **visible, programmable, and inspectable**.

- **Expression-based filters** — type `stars > 50000 && language == "TypeScript"` instead of clicking through menus
- **Visual sort chips** — see exactly which columns are sorted and in what order
- **Transparent pivot tables** — drag-and-drop builder with live preview
- **Data pipeline view** — see your transformations as a composable pipeline
- **Excel-like selection** — click headers to select columns/rows, shift+arrow to extend
- **Copy/paste to Excel** — seamless clipboard interop with Excel, Google Sheets, and other spreadsheets
- **Undo/redo** — full history with `⌘Z` / `⌘⇧Z`
- **Dark & light themes** — toggle instantly
- **Command palette** — `⌘K` to access any action

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 28 |
| **UI** | React 18 + TypeScript |
| **State** | Zustand + Immer |
| **Styling** | Tailwind CSS |
| **Build** | Vite |
| **Formats** | CSV, JSON, XLSX (via SheetJS) |

---

## Installation

### From DMG (macOS)

1. Download `DevSheets-0.1.0-arm64.dmg` from the `release/` folder
2. Open the DMG and drag **DevSheets** to Applications
3. Right-click → **Open** on first launch (bypasses Gatekeeper since the app isn't code-signed)

### Build from source

```bash
git clone <repo-url>
cd windsurf-project
npm install

# Run in development (browser + hot reload)
npm run dev

# Run as Electron app (dev mode)
npm run electron:dev

# Package as native app (.dmg on macOS, .exe on Windows, .AppImage on Linux)
npm run electron:build
# Output: release/DevSheets-0.1.0-arm64.dmg
```

---

## Usage Guide

### Opening Files

- Click **Import** in the toolbar (or use the Welcome screen)
- Supported formats: **CSV**, **JSON**, **XLSX/XLS**
- Column types (string, number, boolean, date) are auto-detected
- Multiple sheets in an XLSX file are loaded as separate tabs

### Saving Files

| Action | Behavior |
|--------|----------|
| **⌘S** | Saves to the original file (same path, same format) |
| **Save button → format** | Save As dialog, pick CSV / JSON / XLSX |

After the first Save As, subsequent `⌘S` writes directly to that file — no dialog.

### Navigating the Grid

| Action | How |
|--------|-----|
| **Move between cells** | Arrow keys |
| **Edit a cell** | Press `Enter` or double-click |
| **Confirm edit** | `Enter` |
| **Cancel edit** | `Escape` |
| **Clear cell(s)** | `Delete` or `Backspace` |
| **Select range** | Click + drag, or `Shift` + arrow keys |
| **Select entire column** | Click the column header |
| **Select entire row** | Click the row number |
| **Select all cells** | Click the `#` corner button |

### Copy & Paste

- **⌘C** — copies selected cells as tab-separated text
- **⌘V** — pastes tab-separated data starting at the selected cell

Works with:
- DevSheets → Excel / Google Sheets
- Excel / Google Sheets → DevSheets
- DevSheets → DevSheets (across sheets)

### Sorting

- **Right-click** a column header → Sort ascending / descending
- Sort chips appear below the toolbar showing active sorts
- Click a chip to toggle direction, `×` to remove
- Multi-column sort: add sorts on multiple columns — order is shown numerically

### Filtering

Click the **filter bar** and type an expression:

```
name contains "react" && stars > 50000
```

**Supported operators:**

| Operator | Example | Description |
|----------|---------|-------------|
| `==` | `status == "active"` | Equals (case-insensitive) |
| `!=` | `type != "draft"` | Not equals |
| `>` `<` `>=` `<=` | `price > 100` | Numeric comparison |
| `contains` | `name contains "test"` | Substring match |
| `starts_with` | `url starts_with "https"` | Prefix match |
| `ends_with` | `file ends_with ".csv"` | Suffix match |
| `~` | `email ~ ".*@gmail\\.com"` | Regex match |

- Combine conditions with `&&`
- Column names with spaces use backticks: `` `First Name` contains "John" ``
- Autocomplete suggests column names as you type (apply with `Tab`)

### Pivot Tables

1. Click **Pivot** in the toolbar
2. Drag columns to **Group By** rows
3. Add value aggregations: SUM, COUNT, AVG, MIN, MAX
4. The grid updates live with the pivoted view

### Undo / Redo

| Shortcut | Action |
|----------|--------|
| **⌘Z** | Undo last change |
| **⌘⇧Z** | Redo |

Bulk operations (e.g., deleting a selection of 1000 cells) undo in a single step.

### Theme Toggle

Click the sun/moon icon in the top-right corner to switch between **dark** and **light** mode. Your preference is saved across sessions.

### Command Palette

Press **⌘K** to open the command palette for quick access to any action.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `⌘S` | Quick save |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘C` | Copy selected cells |
| `⌘V` | Paste |
| `Arrow keys` | Navigate cells |
| `Shift + Arrows` | Extend selection |
| `Enter` | Edit cell / confirm edit |
| `Escape` | Cancel edit |
| `Delete` / `Backspace` | Clear selected cell(s) |

---

## Project Structure

```
src/
├── types.ts              # Core TypeScript types
├── store.ts              # Zustand state + undo/redo + theme engine
├── lib/utils.ts          # Parsing, sort/filter/pivot logic
├── App.tsx               # Main layout + global shortcuts
├── components/
│   ├── Toolbar.tsx       # Import/Save/Sort/Filter/Pivot buttons
│   ├── Grid.tsx          # Virtualized spreadsheet grid + selection + copy/paste
│   ├── FilterBar.tsx     # Expression-based filter with autocomplete
│   ├── SortChips.tsx     # Visual sort indicators
│   ├── PivotBuilder.tsx  # Pivot table configuration
│   ├── PipelineView.tsx  # Transformation pipeline visualization
│   ├── CommandPalette.tsx # ⌘K command search
│   ├── SheetTabs.tsx     # Multi-sheet tabs
│   ├── StatusBar.tsx     # Row/column/selection stats
│   └── WelcomePage.tsx   # Initial landing page
electron/
├── main.ts               # Electron main process (file I/O via IPC)
└── preload.ts            # Context bridge for renderer ↔ main
```

