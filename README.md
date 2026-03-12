# DevSheets

A developer-friendly alternative to Excel — built for data analysis, not accounting.

![Dark Mode](https://img.shields.io/badge/theme-dark%20%26%20light-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

> **Repo:** https://github.com/utkarshupendra/devsheets

## Why DevSheets?

Excel's sort, filter, and pivot features hide state and are hard to compose. DevSheets makes every data transformation **visible, programmable, and inspectable**.

- **Expression-based filters** — type `stars > 50000 && language == "TypeScript"` instead of clicking through menus
- **15 filter operators** — equals, contains, regex, `in` lists, `is_empty`, and more
- **Editable filter chips** — click any chip to toggle, edit value, or change operator inline
- **Visual sort chips** — see exactly which columns are sorted and in what order
- **Transparent pivot tables** — drag-and-drop builder with live preview
- **Data pipeline view** — see your transformations as a composable pipeline
- **Multi-sheet support** — open multiple files as tabs; add, rename, and remove sheets
- **Excel-like selection** — click headers to select columns/rows, `Shift`+arrow to extend
- **Selection stats** — sum, avg, min, max, count auto-calculated for any numeric selection
- **Copy/paste to Excel** — seamless clipboard interop with Excel, Google Sheets, and other spreadsheets
- **Undo/redo** — 50-step history per sheet with `⌘Z` / `⌘⇧Z`
- **Dark & light themes** — toggle instantly, persisted across sessions
- **Command palette** — `⌘K` to access any action
- **Quick save** — `⌘S` writes directly back to the original file (Electron)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 28 |
| **UI** | React 18 + TypeScript |
| **State** | Zustand + Immer |
| **Drag-and-drop** | @dnd-kit |
| **Styling** | Tailwind CSS |
| **Build** | Vite |
| **Formats** | CSV, TSV, JSON, XLSX/XLS (via SheetJS) |

---

## Installation

### Download Pre-built Binaries

Download the latest release for your platform from [GitHub Releases](https://github.com/utkarshupendra/devsheets/releases):

- **Windows**: `DevSheets-Setup-0.1.1.exe`
- **macOS**: `DevSheets-0.1.1.dmg` (Intel) or `DevSheets-0.1.1-arm64.dmg` (Apple Silicon)
- **Linux**: `DevSheets-0.1.1.AppImage`

#### Windows Installation Note

When installing on Windows, you may see a SmartScreen warning because the app is not yet code-signed. This is normal for new open-source applications.

**To install:**
1. Click **"More info"** on the SmartScreen warning dialog
2. Click **"Run anyway"**

The app is safe — you can verify the source code on GitHub. Code signing will be added in future releases as the project matures.

### Build from source

```bash
git clone https://github.com/utkarshupendra/devsheets.git
cd devsheets
npm install

# Run in development (browser + hot reload)
npm run dev

# Run as Electron app (dev mode)
npm run electron:dev

# Package as native app (.dmg on macOS, .exe on Windows, .AppImage on Linux)
npm run electron:build
# Output: release/DevSheets-0.1.1-arm64.dmg
```

---

## Usage Guide

### Welcome Screen

When no file is open, the welcome screen offers three options:

| Option | Description |
|--------|-------------|
| **Open File** | Import CSV, TSV, JSON, or XLSX from disk |
| **New Blank Sheet** | Start with an empty 26-column × 100-row grid |
| **Load Sample Data** | Load a built-in dataset of 30 GitHub repos |

---

### Opening Files

- Click **Import** in the toolbar or use the welcome screen
- Supported formats: **CSV**, **TSV**, **JSON**, **XLSX / XLS**
- Column types (`string`, `number`, `boolean`, `date`) are auto-detected
- Multiple sheets in an XLSX file are each loaded as a separate tab

---

### Saving Files

| Action | Behavior |
|--------|----------|
| **⌘S** | Saves to the original file (same path, same format) — Electron only |
| **Save button** | Opens a format picker: CSV / JSON / XLSX |

After the first **Save As**, subsequent `⌘S` writes directly to that file without a dialog.

---

### Navigating the Grid

| Action | How |
|--------|-----|
| **Move between cells** | Arrow keys |
| **Edit a cell** | Press `Enter` or double-click |
| **Confirm edit** | `Enter` |
| **Cancel edit** | `Escape` |
| **Clear cell(s)** | `Delete` or `Backspace` |
| **Select a range** | Click + drag, or `Shift` + arrow keys |
| **Select entire column** | Click the column header |
| **Select entire row** | Click the row number |
| **Select all cells** | Click the `#` corner button |

---

### Copy & Paste

- **⌘C** — copies selected cells as tab-separated text
- **⌘V** — pastes tab-separated data starting at the selected cell

Works bidirectionally with Excel, Google Sheets, and between DevSheets tabs.

---

### Selection Stats

When two or more cells are selected, the **status bar** at the bottom automatically shows:

- **Count** — number of non-empty cells
- **Sum / Avg / Min / Max** — calculated across all numeric values in the selection

---

### Sorting

- **Right-click** a column header → Sort ascending / descending
- Or click **Sort** in the toolbar to sort by the first column
- Sort chips appear below the toolbar showing all active sorts
- Click a chip to **toggle direction** (`↑` / `↓`), `×` to remove
- **Multi-column sort**: add sorts on multiple columns — priority is shown numerically (1, 2, 3…)
- Click **Reset** in the toolbar to clear all sorts, filters, and pivot at once

---

### Filtering

Click the **filter bar** (below the toolbar) and type an expression, then press `Enter`:

```
name contains "react" && stars > 50000
```

**Supported operators:**

| Operator | Example | Description |
|----------|---------|-------------|
| `==` | `status == "active"` | Equals (case-insensitive for strings) |
| `!=` | `type != "draft"` | Not equals |
| `>` `<` `>=` `<=` | `price > 100` | Numeric comparison |
| `contains` | `name contains "test"` | Substring match |
| `not in` (via `⊅`) | — | Does not contain substring |
| `starts_with` | `url starts_with "https"` | Prefix match |
| `ends_with` | `file ends_with ".csv"` | Suffix match |
| `~` | `email ~ ".*@gmail\\.com"` | Regex match |
| `in` | `lang in ("Go", "Rust")` | Value is in a list |
| `not in` | `lang not in ("PHP")` | Value is not in a list |
| `∅` / `!∅` | — | Is empty / is not empty |

**Tips:**
- Combine multiple conditions with `&&`
- Column names with spaces: wrap in quotes — `"First Name" contains "John"`
- Autocomplete suggests **column names → operators → values** as you type; press `Tab` to apply
- For `in` / `not in`, keep typing after the first value and press `Tab` to add more values to the list

**Filter chips** appear after you submit. Each chip can be:
- **Toggled** on/off by clicking the toggle icon on the left
- **Edited** by clicking the value — a dropdown of unique column values appears
- **Removed** by hovering and clicking `×`
- **+expression** link adds another expression filter alongside existing chips

---

### Pivot Tables

1. Click **Pivot** in the toolbar (or `⌘K` → "Pivot")
2. The **Pivot Builder** panel opens on the right
3. Drag columns into **Row Fields** (group-by dimensions)
4. Add **Value Fields** and choose an aggregation: `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`
5. The grid updates live with the pivoted view
6. Click **Pivot** again to exit pivot mode and return to the raw data

---

### Pipeline View

Click **Pipeline** in the toolbar to open the pipeline sidebar. It shows your active transformations as ordered steps:

```
Source  →  Filter (n rules)  →  Sort (n rules)  →  Pivot
```

- Each step shows how many rows are passed through vs. filtered out
- Toggle or remove steps directly from the pipeline panel

---

### Sheet Tabs

| Action | How |
|--------|-----|
| **Switch sheet** | Click a tab |
| **Rename sheet** | Double-click a tab, type a new name, press `Enter` |
| **Add blank sheet** | Click `+` at the end of the tab bar |
| **Delete sheet** | Hover a tab → click `×` (only visible when 2+ sheets exist) |

Each sheet has its own independent sort rules, filter rules, and pivot config.

---

### Undo / Redo

| Shortcut | Action |
|----------|--------|
| **⌘Z** | Undo last change |
| **⌘⇧Z** | Redo |

Up to **50 undo steps** per sheet. Bulk operations (e.g., pasting 1000 cells) undo in a single step.

---

### Theme Toggle

Click the **sun / moon** icon in the top-right corner (or title bar) to switch between dark and light mode. The preference is saved to `localStorage` and restored on next launch.

---

### Command Palette

Press **⌘K** to open the command palette. Start typing to search for any action (Import, Save, Sort, Filter, Pivot, Reset, Undo, Redo, toggle Pipeline, toggle Theme).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `⌘S` | Quick save (Electron: writes to disk; browser: opens Save menu) |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘C` | Copy selected cells |
| `⌘V` | Paste |
| `Arrow keys` | Navigate cells |
| `Shift + Arrows` | Extend selection |
| `Enter` | Edit cell / confirm edit |
| `Escape` | Cancel edit / close filter bar |
| `Delete` / `Backspace` | Clear selected cell(s) |
| `Tab` | Apply autocomplete suggestion (filter bar) |

---

## Project Structure

```
src/
├── types.ts                # Core TypeScript types
├── store.ts                # Zustand state + undo/redo + theme engine
├── lib/
│   ├── utils.ts            # Parsing, sort/filter/pivot logic, column aliases
│   └── fileManager.ts      # Electron IPC helpers for native file open/save
├── App.tsx                 # Main layout + global shortcuts + selection stats
├── components/
│   ├── Logo.tsx            # SVG app logo
│   ├── Toolbar.tsx         # Import/Save/Sort/Filter/Pivot/Pipeline/Reset buttons
│   ├── Grid.tsx            # Virtualized spreadsheet grid + selection + copy/paste
│   ├── FilterBar.tsx       # Expression filter bar + filter chips with inline editing
│   ├── SortChips.tsx       # Visual sort indicators
│   ├── PivotBuilder.tsx    # Drag-and-drop pivot table configuration
│   ├── PipelineView.tsx    # Transformation pipeline visualization
│   ├── CommandPalette.tsx  # ⌘K command search
│   ├── SheetTabs.tsx       # Multi-sheet tabs (add / rename / delete)
│   ├── StatusBar.tsx       # Row/column/filter stats + selection sum/avg/min/max
│   └── WelcomePage.tsx     # Landing page (Open / New / Sample)
electron/
├── main.ts                 # Electron main process (file I/O via IPC)
└── preload.ts              # Context bridge for renderer ↔ main
build/
├── icon.icns               # macOS app icon
├── icon.png                # Windows / Linux app icon
└── icon.iconset/           # macOS icon set (all sizes)
```

