import React from 'react'
import { useStore } from '../store'
import { ArrowUp, ArrowDown, X, GripVertical } from 'lucide-react'

export function SortChips() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!

  if (sheet.sortRules.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-ds-surface border-b border-ds-border animate-fade-in shrink-0">
      <span className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold mr-1">Sort</span>
      {sheet.sortRules.map((rule, index) => {
        const col = sheet.columns.find(c => c.id === rule.columnId)
        if (!col) return null
        return (
          <div
            key={rule.columnId}
            className="flex items-center gap-1 bg-ds-accent/10 border border-ds-accent/25 rounded px-2 py-1 group"
          >
            <GripVertical size={10} className="text-ds-textMuted opacity-0 group-hover:opacity-100 cursor-grab" />
            <span className="text-xs text-ds-accent font-mono">{col.name}</span>
            <button
              onClick={() => store.toggleSortDirection(rule.columnId)}
              className="flex items-center gap-0.5 text-ds-accent hover:text-ds-accentHover transition-colors"
              title={`Sort ${rule.direction === 'asc' ? 'ascending' : 'descending'} (click to toggle)`}
            >
              {rule.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="text-[10px] uppercase">{rule.direction}</span>
            </button>
            {index > 0 && (
              <span className="text-[9px] text-ds-textMuted ml-0.5">#{index + 1}</span>
            )}
            <button
              onClick={() => store.removeSortRule(rule.columnId)}
              className="ml-0.5 text-ds-textMuted hover:text-ds-red transition-colors opacity-0 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
      <button
        onClick={() => store.clearSortRules()}
        className="text-[10px] text-ds-textMuted hover:text-ds-red ml-2 transition-colors"
      >
        Clear all
      </button>
    </div>
  )
}
