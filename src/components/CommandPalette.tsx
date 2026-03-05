import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { Search, ArrowUpDown, Filter, Table2, Plus, Download, Layers, RotateCcw, Columns3 } from 'lucide-react'

interface Command {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
}

export function CommandPalette() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commands: Command[] = useMemo(() => [
    {
      id: 'sort-asc', label: 'Sort ascending', description: 'Sort first column ascending',
      icon: <ArrowUpDown size={14} />, keywords: ['sort', 'ascending', 'order', 'asc'],
      action: () => { if (sheet.columns[0]) store.addSortRule(sheet.columns[0].id, 'asc'); store.toggleCommandPalette() },
    },
    {
      id: 'sort-desc', label: 'Sort descending', description: 'Sort first column descending',
      icon: <ArrowUpDown size={14} />, keywords: ['sort', 'descending', 'order', 'desc'],
      action: () => { if (sheet.columns[0]) store.addSortRule(sheet.columns[0].id, 'desc'); store.toggleCommandPalette() },
    },
    {
      id: 'clear-sort', label: 'Clear all sorts', description: 'Remove all sort rules',
      icon: <RotateCcw size={14} />, keywords: ['sort', 'clear', 'reset', 'remove'],
      action: () => { store.clearSortRules(); store.toggleCommandPalette() },
    },
    {
      id: 'add-filter', label: 'Add filter', description: 'Add a new filter rule',
      icon: <Filter size={14} />, keywords: ['filter', 'search', 'find', 'where'],
      action: () => { if (sheet.columns[0]) store.addFilterRule(sheet.columns[0].id, 'contains', ''); store.toggleCommandPalette() },
    },
    {
      id: 'clear-filters', label: 'Clear all filters', description: 'Remove all filter rules',
      icon: <RotateCcw size={14} />, keywords: ['filter', 'clear', 'reset', 'remove'],
      action: () => { store.clearFilterRules(); store.toggleCommandPalette() },
    },
    {
      id: 'toggle-pivot', label: 'Toggle pivot table', description: 'Show or hide pivot table builder',
      icon: <Table2 size={14} />, keywords: ['pivot', 'table', 'group', 'aggregate', 'summarize'],
      action: () => {
        if (sheet.pivotConfig) store.setPivotConfig(null)
        else store.setPivotConfig({ rowFields: [], colFields: [], valueFields: [], enabled: true })
        store.toggleCommandPalette()
      },
    },
    {
      id: 'toggle-pipeline', label: 'Toggle pipeline view', description: 'Show transformation pipeline',
      icon: <Layers size={14} />, keywords: ['pipeline', 'transform', 'steps', 'debug'],
      action: () => { store.togglePipeline(); store.toggleCommandPalette() },
    },
    {
      id: 'add-column', label: 'Add column', description: 'Add a new column to the sheet',
      icon: <Plus size={14} />, keywords: ['column', 'add', 'new', 'field'],
      action: () => { store.addColumn(`col_${sheet.columns.length + 1}`, 'string'); store.toggleCommandPalette() },
    },
    {
      id: 'add-row', label: 'Add row', description: 'Add a new row to the sheet',
      icon: <Columns3 size={14} />, keywords: ['row', 'add', 'new', 'record'],
      action: () => { store.addRow(); store.toggleCommandPalette() },
    },
    {
      id: 'reset-all', label: 'Reset all transformations', description: 'Clear sorts, filters, and pivot',
      icon: <RotateCcw size={14} />, keywords: ['reset', 'clear', 'all', 'clean'],
      action: () => { store.clearSortRules(); store.clearFilterRules(); store.setPivotConfig(null); store.toggleCommandPalette() },
    },
  ], [sheet, store])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    )
  }, [query, commands])

  const [selected, setSelected] = useState(0)

  useEffect(() => { setSelected(0) }, [filtered])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action() }
    if (e.key === 'Escape') { store.toggleCommandPalette() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => store.toggleCommandPalette()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-ds-surface border border-ds-border rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ds-border">
          <Search size={16} className="text-ds-textMuted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-ds-text placeholder-ds-textMuted/50 outline-none font-mono"
          />
          <span className="text-[10px] text-ds-textMuted bg-ds-surface2 px-2 py-0.5 rounded border border-ds-border">ESC</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-ds-textMuted">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${i === selected ? 'bg-ds-accent/10 text-ds-accent' : 'text-ds-text hover:bg-ds-surface2'}`}
              >
                <span className={i === selected ? 'text-ds-accent' : 'text-ds-textMuted'}>{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{cmd.label}</div>
                  <div className="text-[10px] text-ds-textMuted truncate">{cmd.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
