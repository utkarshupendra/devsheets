import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useStore } from '../store'
import { FilterOperator, Column, Row } from '../types'
import { parseFilterExpression } from '../lib/utils'
import { Search, X, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'

const OPERATORS: { value: FilterOperator; label: string; symbol: string }[] = [
  { value: 'equals', label: 'Equals', symbol: '==' },
  { value: 'not_equals', label: 'Not equals', symbol: '!=' },
  { value: 'contains', label: 'Contains', symbol: '⊃' },
  { value: 'not_contains', label: 'Not contains', symbol: '⊅' },
  { value: 'starts_with', label: 'Starts with', symbol: '^' },
  { value: 'ends_with', label: 'Ends with', symbol: '$' },
  { value: 'greater_than', label: 'Greater than', symbol: '>' },
  { value: 'less_than', label: 'Less than', symbol: '<' },
  { value: 'greater_equal', label: 'Greater or equal', symbol: '>=' },
  { value: 'less_equal', label: 'Less or equal', symbol: '<=' },
  { value: 'is_empty', label: 'Is empty', symbol: '∅' },
  { value: 'not_empty', label: 'Not empty', symbol: '!∅' },
  { value: 'regex', label: 'Regex', symbol: '~' },
]

const OP_SYMBOLS = ['==', '!=', '>=', '<=', '>', '<', '~', 'contains', 'starts_with', 'ends_with']

type SuggestionKind = 'column' | 'operator' | 'value'
interface Suggestion { kind: SuggestionKind; text: string; detail?: string }

function getUniqueValues(rows: Row[], colId: string, limit = 50): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const v = row.cells[colId]
    if (v === null || v === undefined || v === '') continue
    seen.add(String(v))
    if (seen.size >= limit) break
  }
  return Array.from(seen).sort()
}

export function FilterBar() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!
  const [expressionMode, setExpressionMode] = useState(false)
  const [expression, setExpression] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const handleExpressionSubmit = () => {
    if (!expression.trim()) return
    const rules = parseFilterExpression(expression, sheet.columns)
    if (rules.length > 0) {
      store.setFilterRules([...sheet.filterRules, ...rules])
      setExpression('')
      setShowSuggestions(false)
    }
  }

  // Determine what kind of suggestion to show based on cursor context
  const suggestions = useMemo((): Suggestion[] => {
    if (!expression) {
      // Show all column names when empty
      return sheet.columns.map(c => ({ kind: 'column' as const, text: c.name, detail: c.type }))
    }

    // Get the last segment (after the last &&)
    const parts = expression.split(/&&/)
    const lastPart = (parts[parts.length - 1] || '').trimStart()

    // Check if user already typed an operator
    const sortedCols = [...sheet.columns].sort((a, b) => b.name.length - a.name.length)
    let matchedCol: Column | undefined
    let afterCol = ''

    // Try quoted column name
    const quotedMatch = lastPart.match(/^["'`](.+?)["'`]\s*(.*)$/)
    if (quotedMatch) {
      matchedCol = sheet.columns.find(c => c.name.toLowerCase() === quotedMatch[1].toLowerCase())
      afterCol = quotedMatch[2]
    } else {
      // Try unquoted column name match
      for (const c of sortedCols) {
        if (lastPart.toLowerCase().startsWith(c.name.toLowerCase())) {
          const rest = lastPart.slice(c.name.length)
          if (rest === '' || rest.match(/^\s/)) {
            matchedCol = c
            afterCol = rest.trim()
            break
          }
        }
      }
    }

    if (!matchedCol) {
      // Suggest column names that match what's typed
      const typed = lastPart.toLowerCase()
      const matches = sheet.columns.filter(c => c.name.toLowerCase().includes(typed))
      return matches.map(c => ({ kind: 'column' as const, text: c.name, detail: c.type }))
    }

    // Column matched — check if operator is typed
    let matchedOp = ''
    let afterOp = ''
    for (const op of OP_SYMBOLS.sort((a, b) => b.length - a.length)) {
      if (afterCol.toLowerCase().startsWith(op)) {
        const rest = afterCol.slice(op.length)
        if (rest === '' || rest.match(/^\s/)) {
          matchedOp = op
          afterOp = rest.trim()
          break
        }
      }
    }

    if (!matchedOp) {
      // Suggest operators
      const typed = afterCol.toLowerCase()
      const opSuggestions = OP_SYMBOLS.filter(o => o.startsWith(typed) || typed === '')
      return opSuggestions.map(o => {
        const opDef = OPERATORS.find(d => d.symbol === o)
        return { kind: 'operator' as const, text: o, detail: opDef?.label ?? '' }
      })
    }

    // Operator matched — suggest unique values
    const typed = afterOp.toLowerCase().replace(/^["']/, '')
    const uniqueVals = getUniqueValues(sheet.rows, matchedCol.id, 200)
    const filtered = typed ? uniqueVals.filter(v => v.toLowerCase().includes(typed)) : uniqueVals
    return filtered.slice(0, 30).map(v => ({ kind: 'value' as const, text: v }))
  }, [expression, sheet.columns, sheet.rows])

  useEffect(() => { setSelectedIdx(0) }, [suggestions])

  const applySuggestion = useCallback((suggestion: Suggestion) => {
    const parts = expression.split(/&&/)
    const prefix = parts.length > 1 ? parts.slice(0, -1).join('&&') + '&& ' : ''
    const lastPart = (parts[parts.length - 1] || '').trimStart()

    if (suggestion.kind === 'column') {
      const name = suggestion.text.includes(' ') ? `"${suggestion.text}"` : suggestion.text
      setExpression(prefix + name + ' ')
    } else if (suggestion.kind === 'operator') {
      // Find the column portion and append operator
      const sortedCols = [...sheet.columns].sort((a, b) => b.name.length - a.name.length)
      let colPart = lastPart
      const quotedMatch = lastPart.match(/^(["'`].+?["'`])\s*/)
      if (quotedMatch) {
        colPart = quotedMatch[1]
      } else {
        for (const c of sortedCols) {
          if (lastPart.toLowerCase().startsWith(c.name.toLowerCase())) {
            colPart = lastPart.slice(0, c.name.length)
            break
          }
        }
      }
      setExpression(prefix + colPart + ' ' + suggestion.text + ' ')
    } else {
      // Value — wrap in quotes if it has spaces
      const val = suggestion.text.includes(' ') ? `"${suggestion.text}"` : suggestion.text
      // Replace everything after operator with the value
      const sortedCols = [...sheet.columns].sort((a, b) => b.name.length - a.name.length)
      let colPart = ''
      let afterCol = lastPart

      const quotedMatch = lastPart.match(/^(["'`].+?["'`])\s*(.*)$/)
      if (quotedMatch) {
        colPart = quotedMatch[1]
        afterCol = quotedMatch[2]
      } else {
        for (const c of sortedCols) {
          if (lastPart.toLowerCase().startsWith(c.name.toLowerCase())) {
            colPart = lastPart.slice(0, c.name.length)
            afterCol = lastPart.slice(c.name.length).trim()
            break
          }
        }
      }

      let opPart = ''
      for (const op of OP_SYMBOLS.sort((a, b) => b.length - a.length)) {
        if (afterCol.toLowerCase().startsWith(op)) {
          opPart = op
          break
        }
      }
      setExpression(prefix + colPart + ' ' + opPart + ' ' + val)
      setShowSuggestions(false)
    }
    inputRef.current?.focus()
  }, [expression, sheet.columns])

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' && suggestions[selectedIdx]) {
        e.preventDefault()
        applySuggestion(suggestions[selectedIdx])
        return
      }
    }
    if (e.key === 'Enter') { setShowSuggestions(false); handleExpressionSubmit() }
    if (e.key === 'Escape') { setShowSuggestions(false); if (!expression) setExpressionMode(false) }
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (!suggestionsRef.current) return
    const el = suggestionsRef.current.children[selectedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  return (
    <div className="shrink-0">
      {expressionMode && (
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-ds-surface2 border-b border-ds-border animate-fade-in">
            <Search size={13} className="text-ds-textMuted shrink-0" />
            <input
              ref={inputRef}
              value={expression}
              onChange={e => { setExpression(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder='Filter: column operator value (Tab to autocomplete)'
              className="flex-1 bg-transparent text-xs font-mono text-ds-text placeholder-ds-textMuted/50 outline-none"
              autoFocus
            />
            <button
              onClick={() => { setExpressionMode(false); setShowSuggestions(false) }}
              className="text-ds-textMuted hover:text-ds-text"
            >
              <X size={13} />
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-8 right-8 top-full z-50 bg-ds-surface border border-ds-border rounded-b shadow-lg max-h-[200px] overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.text + i}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs font-mono
                    ${i === selectedIdx ? 'bg-ds-accent/15 text-ds-accent' : 'text-ds-text hover:bg-ds-surface2'}`}
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className={`w-[3px] h-3 rounded-full shrink-0 ${
                    s.kind === 'column' ? 'bg-ds-accent' :
                    s.kind === 'operator' ? 'bg-ds-orange' : 'bg-ds-green'
                  }`} />
                  <span className="truncate">{s.text}</span>
                  {s.detail && <span className="ml-auto text-ds-textMuted text-[10px]">{s.detail}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!expressionMode && sheet.filterRules.length === 0 && (
        <button
          onClick={() => setExpressionMode(true)}
          className="w-full flex items-center gap-2 px-3 py-1 bg-ds-surface border-b border-ds-border text-ds-textMuted hover:text-ds-text hover:bg-ds-surface2 transition-colors"
        >
          <Search size={12} />
          <span className="text-[11px] font-mono">Filter: type an expression or use the toolbar...</span>
        </button>
      )}

      {sheet.filterRules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-ds-surface border-b border-ds-border animate-fade-in">
          <span className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold mr-1">Filter</span>
          {sheet.filterRules.map(rule => {
            const col = sheet.columns.find(c => c.id === rule.columnId)
            const op = OPERATORS.find(o => o.value === rule.operator)
            return (
              <FilterChip
                key={rule.id}
                ruleId={rule.id}
                columnName={col?.name ?? '?'}
                columnId={rule.columnId}
                operator={op?.symbol ?? rule.operator}
                operatorValue={rule.operator}
                value={rule.value}
                enabled={rule.enabled}
                onToggle={() => store.toggleFilterRule(rule.id)}
                onRemove={() => store.removeFilterRule(rule.id)}
                onChangeColumn={(colId) => store.updateFilterRule(rule.id, { columnId: colId })}
                onChangeOperator={(op) => store.updateFilterRule(rule.id, { operator: op })}
                onChangeValue={(val) => store.updateFilterRule(rule.id, { value: val })}
                columns={sheet.columns}
                rows={sheet.rows}
              />
            )
          })}
          <button
            onClick={() => setExpressionMode(true)}
            className="text-ds-accent text-[10px] hover:text-ds-accentHover ml-1"
          >
            + expression
          </button>
          <button
            onClick={() => store.clearFilterRules()}
            className="text-[10px] text-ds-textMuted hover:text-ds-red ml-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  ruleId, columnName, columnId, operator, operatorValue, value, enabled, onToggle, onRemove,
  onChangeColumn, onChangeOperator, onChangeValue, columns, rows,
}: {
  ruleId: string
  columnName: string
  columnId: string
  operator: string
  operatorValue: FilterOperator
  value: string
  enabled: boolean
  onToggle: () => void
  onRemove: () => void
  onChangeColumn: (colId: string) => void
  onChangeOperator: (op: FilterOperator) => void
  onChangeValue: (val: string) => void
  columns: Column[]
  rows: Row[]
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [showValues, setShowValues] = useState(false)
  const [valueFilter, setValueFilter] = useState('')
  const chipRef = useRef<HTMLDivElement>(null)
  const valueInputRef = useRef<HTMLInputElement>(null)

  const uniqueValues = useMemo(() => {
    return getUniqueValues(rows, columnId, 200)
  }, [rows, columnId])

  const filteredValues = useMemo(() => {
    if (!valueFilter) return uniqueValues.slice(0, 30)
    const q = valueFilter.toLowerCase()
    return uniqueValues.filter(v => v.toLowerCase().includes(q)).slice(0, 30)
  }, [uniqueValues, valueFilter])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showValues) return
    const handleClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setShowValues(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [showValues])

  const startEditing = () => {
    setEditing(true)
    setEditValue(value)
    setShowValues(true)
    setValueFilter('')
  }

  const commitValue = (val: string) => {
    onChangeValue(val)
    setEditing(false)
    setShowValues(false)
    setEditValue(val)
  }

  return (
    <div ref={chipRef} className={`relative flex items-center gap-1 rounded px-2 py-1 text-xs group transition-opacity
      ${enabled
        ? 'bg-ds-green/10 border border-ds-green/25 text-ds-green'
        : 'bg-ds-surface2 border border-ds-border text-ds-textMuted opacity-60'
      }`}
    >
      <button onClick={onToggle} className="shrink-0">
        {enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
      </button>
      <span className="font-mono font-medium">{columnName}</span>
      <span className="text-ds-textMuted">{operator}</span>
      {editing ? (
        <input
          ref={valueInputRef}
          value={editValue}
          onChange={e => { setEditValue(e.target.value); setValueFilter(e.target.value); setShowValues(true) }}
          onBlur={() => { setTimeout(() => { if (!showValues) commitValue(editValue) }, 150) }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitValue(editValue)
            if (e.key === 'Escape') { setEditing(false); setShowValues(false) }
          }}
          className="bg-ds-bg border border-ds-border rounded px-1 py-0.5 w-24 text-xs font-mono outline-none text-ds-text"
          autoFocus
        />
      ) : (
        <span
          onClick={startEditing}
          className="font-mono cursor-pointer hover:underline"
        >
          {value || <span className="italic text-ds-textMuted">click to set</span>}
        </span>
      )}
      <button
        onClick={onRemove}
        className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-ds-red transition-all"
      >
        <X size={11} />
      </button>

      {/* Value suggestions dropdown */}
      {showValues && filteredValues.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-ds-surface border border-ds-border rounded shadow-lg max-h-[180px] min-w-[160px] max-w-[280px] overflow-y-auto">
          {filteredValues.map(v => (
            <button
              key={v}
              className="w-full text-left px-3 py-1 text-xs font-mono text-ds-text hover:bg-ds-accent/15 hover:text-ds-accent truncate"
              onMouseDown={(e) => { e.preventDefault(); commitValue(v) }}
            >
              {v}
            </button>
          ))}
          {uniqueValues.length > filteredValues.length && (
            <div className="px-3 py-1 text-[10px] text-ds-textMuted border-t border-ds-border">
              {uniqueValues.length - filteredValues.length} more values…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
