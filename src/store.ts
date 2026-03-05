import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  AppState, Sheet, SortRule, FilterRule, FilterOperator, PivotConfig,
  Column, Row, CellValue, PipelineStep,
} from './types'
import { generateId } from './lib/utils'

// --- Undo/Redo history system ---
type SheetSnapshot = { columns: Column[]; rows: Row[]; sortRules: SortRule[]; filterRules: FilterRule[]; pivotConfig: PivotConfig | null }
const MAX_HISTORY = 50
const undoStacks = new Map<string, SheetSnapshot[]>()
const redoStacks = new Map<string, SheetSnapshot[]>()

function snapshotSheet(sheet: Sheet): SheetSnapshot {
  return JSON.parse(JSON.stringify({
    columns: sheet.columns,
    rows: sheet.rows,
    sortRules: sheet.sortRules,
    filterRules: sheet.filterRules,
    pivotConfig: sheet.pivotConfig,
  }))
}

function pushHistory(sheet: Sheet) {
  const id = sheet.id
  if (!undoStacks.has(id)) undoStacks.set(id, [])
  const stack = undoStacks.get(id)!
  stack.push(snapshotSheet(sheet))
  if (stack.length > MAX_HISTORY) stack.shift()
  // Clear redo on new action
  redoStacks.set(id, [])
}

interface Actions {
  // Sheet management
  setActiveSheet: (id: string) => void
  addSheet: (name: string, columns: Column[], rows: Row[]) => void
  renameSheet: (id: string, name: string) => void
  removeSheet: (id: string) => void

  // Cell editing
  setCell: (rowId: string, colId: string, value: CellValue) => void
  setCellBatch: (updates: { rowId: string; colId: string; value: CellValue }[]) => void
  selectCell: (row: number, col: number) => void
  setSelectionRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void

  // Column management
  addColumn: (name: string, type: Column['type']) => void
  removeColumn: (colId: string) => void
  renameColumn: (colId: string, name: string) => void
  resizeColumn: (colId: string, width: number) => void

  // Row management
  addRow: () => void
  removeRow: (rowId: string) => void

  // Undo/Redo
  undo: () => void
  redo: () => void

  // Selection helpers
  selectEntireColumn: (colIndex: number, totalRows: number) => void
  selectEntireRow: (rowIndex: number, totalCols: number) => void
  selectAll: (totalRows: number, totalCols: number) => void

  // Sort
  addSortRule: (columnId: string, direction: 'asc' | 'desc') => void
  removeSortRule: (columnId: string) => void
  toggleSortDirection: (columnId: string) => void
  reorderSortRules: (rules: SortRule[]) => void
  clearSortRules: () => void

  // Filter
  addFilterRule: (columnId: string, operator: FilterOperator, value: string) => void
  removeFilterRule: (filterId: string) => void
  toggleFilterRule: (filterId: string) => void
  updateFilterRule: (filterId: string, updates: Partial<FilterRule>) => void
  setFilterRules: (rules: FilterRule[]) => void
  clearFilterRules: () => void

  // Pivot
  setPivotConfig: (config: PivotConfig | null) => void

  // Pipeline
  addPipelineStep: (step: PipelineStep) => void
  removePipelineStep: (stepId: string) => void
  togglePipelineStep: (stepId: string) => void

  // UI state
  toggleCommandPalette: () => void
  setFilterBarExpression: (expr: string) => void
  togglePipeline: () => void
  toggleTheme: () => void

  // Data loading
  loadData: (columns: Column[], rows: Row[], name?: string) => void
}

export const useStore = create<AppState & Actions>()(
  immer((set) => ({
    sheets: [],
    activeSheetId: '',
    commandPaletteOpen: false,
    filterBarExpression: '',
    showPipeline: false,
    theme: (localStorage.getItem('ds-theme') as 'dark' | 'light') || 'dark',

    setActiveSheet: (id) => set((s) => { s.activeSheetId = id }),
    addSheet: (name, columns, rows) => set((s) => {
      const sheet: Sheet = {
        id: generateId(), name, columns, rows,
        sortRules: [], filterRules: [], pivotConfig: null,
        pipeline: [], selectedCell: null, selectionRange: null,
      }
      s.sheets.push(sheet)
      s.activeSheetId = sheet.id
    }),
    renameSheet: (id, name) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === id)
      if (sheet) sheet.name = name
    }),

    setCell: (rowId, colId, value) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      const row = sheet.rows.find(r => r.id === rowId)
      if (row) row.cells[colId] = value
    }),
    setCellBatch: (updates) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet || updates.length === 0) return
      pushHistory(sheet)
      for (const { rowId, colId, value } of updates) {
        const row = sheet.rows.find(r => r.id === rowId)
        if (row) row.cells[colId] = value
      }
    }),
    selectCell: (row, col) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (sheet) {
        sheet.selectedCell = { row, col }
        sheet.selectionRange = null
      }
    }),
    setSelectionRange: (range) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (sheet) sheet.selectionRange = range
    }),

    addColumn: (name, type) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      const col: Column = { id: generateId(), name, type, width: 150 }
      sheet.columns.push(col)
      sheet.rows.forEach(row => { row.cells[col.id] = null })
    }),
    removeColumn: (colId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.columns = sheet.columns.filter(c => c.id !== colId)
      sheet.rows.forEach(row => { delete row.cells[colId] })
    }),
    renameColumn: (colId, name) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const col = sheet.columns.find(c => c.id === colId)
      if (col) col.name = name
    }),
    resizeColumn: (colId, width) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const col = sheet.columns.find(c => c.id === colId)
      if (col) col.width = Math.max(60, width)
    }),

    addRow: () => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      const cells: Record<string, CellValue> = {}
      sheet.columns.forEach(col => { cells[col.id] = null })
      sheet.rows.push({ id: generateId(), cells })
    }),
    removeRow: (rowId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.rows = sheet.rows.filter(r => r.id !== rowId)
    }),

    addSortRule: (columnId, direction) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      const existing = sheet.sortRules.findIndex(r => r.columnId === columnId)
      if (existing >= 0) {
        sheet.sortRules[existing].direction = direction
      } else {
        sheet.sortRules.push({ columnId, direction })
      }
    }),
    removeSortRule: (columnId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.sortRules = sheet.sortRules.filter(r => r.columnId !== columnId)
    }),
    toggleSortDirection: (columnId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const rule = sheet.sortRules.find(r => r.columnId === columnId)
      if (rule) rule.direction = rule.direction === 'asc' ? 'desc' : 'asc'
    }),
    reorderSortRules: (rules) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (sheet) sheet.sortRules = rules
    }),
    clearSortRules: () => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.sortRules = []
    }),

    addFilterRule: (columnId, operator, value) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.filterRules.push({ id: generateId(), columnId, operator, value, enabled: true })
    }),
    removeFilterRule: (filterId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.filterRules = sheet.filterRules.filter(f => f.id !== filterId)
    }),
    toggleFilterRule: (filterId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const rule = sheet.filterRules.find(f => f.id === filterId)
      if (rule) rule.enabled = !rule.enabled
    }),
    updateFilterRule: (filterId, updates) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const rule = sheet.filterRules.find(f => f.id === filterId)
      if (rule) Object.assign(rule, updates)
    }),
    setFilterRules: (rules) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.filterRules = rules
    }),
    clearFilterRules: () => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      pushHistory(sheet)
      sheet.filterRules = []
    }),

    setPivotConfig: (config) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (sheet) sheet.pivotConfig = config
    }),

    addPipelineStep: (step) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (sheet) sheet.pipeline.push(step)
    }),
    removePipelineStep: (stepId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.pipeline = sheet.pipeline.filter(p => p.id !== stepId)
    }),
    togglePipelineStep: (stepId) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const step = sheet.pipeline.find(p => p.id === stepId)
      if (step) step.enabled = !step.enabled
    }),

    removeSheet: (id) => set((s) => {
      s.sheets = s.sheets.filter(sh => sh.id !== id)
      if (s.activeSheetId === id && s.sheets.length > 0) {
        s.activeSheetId = s.sheets[0].id
      } else if (s.sheets.length === 0) {
        s.activeSheetId = ''
      }
    }),

    toggleCommandPalette: () => set((s) => { s.commandPaletteOpen = !s.commandPaletteOpen }),
    setFilterBarExpression: (expr) => set((s) => { s.filterBarExpression = expr }),
    togglePipeline: () => set((s) => { s.showPipeline = !s.showPipeline }),
    toggleTheme: () => set((s) => {
      s.theme = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('ds-theme', s.theme)
    }),

    loadData: (columns, rows, name) => set((s) => {
      const sheet: Sheet = {
        id: generateId(),
        name: name ?? `Sheet ${s.sheets.length + 1}`,
        columns, rows,
        sortRules: [], filterRules: [], pivotConfig: null,
        pipeline: [], selectedCell: null, selectionRange: null,
      }
      s.sheets.push(sheet)
      s.activeSheetId = sheet.id
    }),

    // Column/row/all selection helpers
    selectEntireColumn: (colIndex: number, totalRows: number) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.selectedCell = { row: 0, col: colIndex }
      sheet.selectionRange = { startRow: 0, startCol: colIndex, endRow: totalRows - 1, endCol: colIndex }
    }),
    selectEntireRow: (rowIndex: number, totalCols: number) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.selectedCell = { row: rowIndex, col: 0 }
      sheet.selectionRange = { startRow: rowIndex, startCol: 0, endRow: rowIndex, endCol: totalCols - 1 }
    }),
    selectAll: (totalRows: number, totalCols: number) => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      sheet.selectedCell = { row: 0, col: 0 }
      sheet.selectionRange = { startRow: 0, startCol: 0, endRow: totalRows - 1, endCol: totalCols - 1 }
    }),

    undo: () => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const stack = undoStacks.get(sheet.id)
      if (!stack || stack.length === 0) return
      // Push current state to redo
      if (!redoStacks.has(sheet.id)) redoStacks.set(sheet.id, [])
      redoStacks.get(sheet.id)!.push(snapshotSheet(sheet))
      // Restore from undo
      const snapshot = stack.pop()!
      sheet.columns = snapshot.columns
      sheet.rows = snapshot.rows
      sheet.sortRules = snapshot.sortRules
      sheet.filterRules = snapshot.filterRules
      sheet.pivotConfig = snapshot.pivotConfig
    }),

    redo: () => set((s) => {
      const sheet = s.sheets.find(sh => sh.id === s.activeSheetId)
      if (!sheet) return
      const stack = redoStacks.get(sheet.id)
      if (!stack || stack.length === 0) return
      // Push current state to undo
      if (!undoStacks.has(sheet.id)) undoStacks.set(sheet.id, [])
      undoStacks.get(sheet.id)!.push(snapshotSheet(sheet))
      // Restore from redo
      const snapshot = stack.pop()!
      sheet.columns = snapshot.columns
      sheet.rows = snapshot.rows
      sheet.sortRules = snapshot.sortRules
      sheet.filterRules = snapshot.filterRules
      sheet.pivotConfig = snapshot.pivotConfig
    }),
  }))
)

// --- Theme application (outside React for reliability) ---
const themeVars = {
  light: {
    '--ds-bg': '255 255 255', '--ds-surface': '246 248 250', '--ds-surface2': '234 238 242',
    '--ds-border': '208 215 222', '--ds-text': '31 35 40', '--ds-textMuted': '101 109 118',
    '--ds-accent': '9 105 218', '--ds-accentHover': '5 80 174', '--ds-green': '26 127 55',
    '--ds-red': '207 34 46', '--ds-orange': '154 103 0', '--ds-purple': '130 80 223',
    '--ds-scrollTrack': '#f6f8fa', '--ds-scrollThumb': '#d0d7de', '--ds-scrollThumbHover': '#afb8c1',
    '--ds-selection': 'rgba(9, 105, 218, 0.2)', 'color-scheme': 'light',
  },
  dark: {
    '--ds-bg': '13 17 23', '--ds-surface': '22 27 34', '--ds-surface2': '28 35 51',
    '--ds-border': '48 54 61', '--ds-text': '230 237 243', '--ds-textMuted': '139 148 158',
    '--ds-accent': '88 166 255', '--ds-accentHover': '121 192 255', '--ds-green': '63 185 80',
    '--ds-red': '248 81 73', '--ds-orange': '210 153 34', '--ds-purple': '188 140 255',
    '--ds-scrollTrack': '#161b22', '--ds-scrollThumb': '#30363d', '--ds-scrollThumbHover': '#484f58',
    '--ds-selection': 'rgba(88, 166, 255, 0.3)', 'color-scheme': 'dark',
  },
} as const

function applyTheme(theme: 'dark' | 'light') {
  // Use a dynamic <style> tag to override :root — more reliable than inline setProperty
  let styleEl = document.getElementById('ds-theme-override') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'ds-theme-override'
    document.head.appendChild(styleEl)
  }
  const vars = themeVars[theme]
  const rules = Object.entries(vars).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n')
  styleEl.textContent = `:root {\n${rules}\n}`
}

// Apply immediately on module load
applyTheme(useStore.getState().theme)

// Re-apply whenever theme changes
useStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) applyTheme(state.theme)
})
