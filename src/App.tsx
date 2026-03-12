import React, { useEffect, useMemo, useCallback } from 'react'
import { useStore } from './store'
import { Toolbar } from './components/Toolbar'
import { SortChips } from './components/SortChips'
import { FilterBar } from './components/FilterBar'
import { Grid } from './components/Grid'
import { PivotBuilder } from './components/PivotBuilder'
import { CommandPalette } from './components/CommandPalette'
import { PipelineView } from './components/PipelineView'
import { StatusBar } from './components/StatusBar'
import { SheetTabs } from './components/SheetTabs'
import { WelcomePage } from './components/WelcomePage'
import { Logo } from './components/Logo'
import { applySortRules, applyFilterRules, computePivot } from './lib/utils'
import { getModifierSymbol } from './lib/platform'
import { Sun, Moon } from 'lucide-react'

export default function App() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)

  // Theme is applied in store.ts via subscribe (outside React for reliability)

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    // Row 0 is the header row (original column names) — always pin it, filter only data rows
    if (sheet.rows.length === 0) return []
    const headerRow = sheet.rows[0]
    const dataRows = applyFilterRules(sheet.rows.slice(1), sheet.filterRules)
    return [headerRow, ...dataRows]
  }, [sheet?.rows, sheet?.filterRules])

  const sortedRows = useMemo(() => {
    if (!sheet) return []
    return applySortRules(filteredRows, sheet.sortRules, sheet.columns)
  }, [filteredRows, sheet?.sortRules, sheet?.columns])

  const pivotData = useMemo(() => {
    if (!sheet?.pivotConfig?.enabled) return null
    return computePivot(sortedRows, sheet.columns, sheet.pivotConfig)
  }, [sortedRows, sheet?.columns, sheet?.pivotConfig])

  const displayColumns = sheet ? (pivotData ? pivotData.pivotColumns : sheet.columns) : []
  const displayRows = sheet ? (pivotData ? pivotData.pivotRows : sortedRows) : []

  // Compute selection summary for multi-cell selection
  const selectionSummary = useMemo(() => {
    if (!sheet?.selectionRange) return null
    const { startRow, startCol, endRow, endCol } = sheet.selectionRange
    const minR = Math.min(startRow, endRow)
    const maxR = Math.max(startRow, endRow)
    const minC = Math.min(startCol, endCol)
    const maxC = Math.max(startCol, endCol)

    const values: (string | number | boolean | null)[] = []
    for (let r = minR; r <= maxR; r++) {
      const row = displayRows[r]
      if (!row) continue
      for (let c = minC; c <= maxC; c++) {
        const col = displayColumns[c]
        if (!col) continue
        values.push(row.cells[col.id])
      }
    }

    const nonNull = values.filter(v => v !== null && v !== '')
    const nums = nonNull.map(v => Number(v)).filter(n => !isNaN(n))

    return {
      count: nonNull.length,
      numericCount: nums.length,
      sum: nums.reduce((a, b) => a + b, 0),
      avg: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
      min: nums.length > 0 ? Math.min(...nums) : 0,
      max: nums.length > 0 ? Math.max(...nums) : 0,
    }
  }, [sheet?.selectionRange, displayRows, displayColumns])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      store.toggleCommandPalette()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault()
      store.redo()
    }
  }, [store])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Show welcome page when no sheets are loaded
  if (!sheet) {
    return <WelcomePage />
  }

  return (
    <div className="h-screen flex flex-col bg-ds-bg text-ds-text overflow-hidden">
      {/* Title bar with macOS traffic light padding */}
      <div className="drag-region h-8 flex items-center pl-[80px] pr-4 bg-ds-surface border-b border-ds-border shrink-0">
        <span className="no-drag text-xs text-ds-textMuted">
          {sheet.name} — {sheet.rows.length} rows × {sheet.columns.length} cols
        </span>
        <div className="flex-1" />
        <button
          onClick={() => store.toggleTheme()}
          className="no-drag text-ds-textMuted hover:text-ds-text p-1 rounded hover:bg-ds-surface2 mr-2"
        >
          {store.theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
        <span className="no-drag text-[10px] text-ds-textMuted bg-ds-surface2 px-2 py-0.5 rounded border border-ds-border">
          {getModifierSymbol()}K
        </span>
      </div>

      <Toolbar />

      {sheet.sortRules.length > 0 && <SortChips />}

      <FilterBar />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {store.showPipeline && (
          <PipelineView
            sortRules={sheet.sortRules}
            filterRules={sheet.filterRules}
            pivotConfig={sheet.pivotConfig}
            columns={sheet.columns}
            totalRows={sheet.rows.length}
            filteredRows={filteredRows.length}
            displayRows={displayRows.length}
          />
        )}

        <div className="flex-1 min-h-0 min-w-0">
          <Grid
            columns={displayColumns}
            rows={displayRows}
            selectedCell={sheet.selectedCell}
            isPivot={!!pivotData}
          />
        </div>

        {sheet.pivotConfig !== null && (
          <PivotBuilder columns={sheet.columns} config={sheet.pivotConfig} />
        )}
      </div>

      <SheetTabs />

      <StatusBar
        totalRows={sheet.rows.length}
        filteredRows={filteredRows.length}
        displayRows={displayRows.length}
        columns={sheet.columns.length}
        sortRules={sheet.sortRules.length}
        filterRules={sheet.filterRules.filter(f => f.enabled).length}
        isPivot={!!pivotData}
        selectionSummary={selectionSummary}
      />

      {store.commandPaletteOpen && <CommandPalette />}
    </div>
  )
}
