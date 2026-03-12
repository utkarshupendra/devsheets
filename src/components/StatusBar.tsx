import React from 'react'
import { Database, Filter, ArrowUpDown, Table2, Grid3x3 } from 'lucide-react'

interface SelectionSummary {
  count: number
  numericCount: number
  sum: number
  avg: number
  min: number
  max: number
}

interface StatusBarProps {
  totalRows: number
  filteredRows: number
  displayRows: number
  columns: number
  sortRules: number
  filterRules: number
  isPivot: boolean
  selectionSummary?: SelectionSummary | null
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function StatusBar({
  totalRows, filteredRows, displayRows, columns, sortRules, filterRules, isPivot, selectionSummary,
}: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-ds-surface2 border-t border-ds-border text-[10px] text-ds-textMuted shrink-0">
      <div className="flex items-center gap-1.5">
        <Database size={10} />
        <span>{totalRows.toLocaleString()} rows × {columns} cols</span>
      </div>

      {filterRules > 0 && (
        <div className="flex items-center gap-1.5 text-ds-green">
          <Filter size={10} />
          <span>{filterRules} filter{filterRules > 1 ? 's' : ''} → {filteredRows.toLocaleString()} rows</span>
        </div>
      )}

      {sortRules > 0 && (
        <div className="flex items-center gap-1.5 text-ds-orange">
          <ArrowUpDown size={10} />
          <span>{sortRules} sort{sortRules > 1 ? 's' : ''}</span>
        </div>
      )}

      {isPivot && (
        <div className="flex items-center gap-1.5 text-ds-purple">
          <Table2 size={10} />
          <span>Pivot: {displayRows.toLocaleString()} groups</span>
        </div>
      )}

      <div className="flex-1" />

      {selectionSummary && selectionSummary.count > 1 && (
        <div className="flex items-center gap-3 text-ds-accent font-mono">
          <Grid3x3 size={10} />
          <span>Count: {selectionSummary.count}</span>
          {selectionSummary.numericCount > 0 && (
            <>
              <span>Sum: {fmt(selectionSummary.sum)}</span>
              <span>Avg: {fmt(selectionSummary.avg)}</span>
              <span>Min: {fmt(selectionSummary.min)}</span>
              <span>Max: {fmt(selectionSummary.max)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
